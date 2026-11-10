// 裂纹遮罩和像素扩散遮罩，直接在 GPU 上画。
//
// 以前是每帧在 2D 画布上把三百来条裂纹重画一遍，再整张传成纹理：Chromium 里还好，
// Safari 的 2D 画布要在主线程上光栅化、上传也要拷一遍，裂纹在跑的那几秒每帧要吃掉 14ms 左右（60 帧一共才 16.7ms）。
// 现在每段裂纹是一个实例化的小四边形，几何体只在开始时传一次；每帧只更新「每条裂纹跑到哪了」这几百个数，
// 宽度、张开、针尖、故障范围都在着色器里按到线段的距离算出来（自带抗锯齿）。
//
// 输出和原来的画布一样：
//   裂纹遮罩 R = 裂缝芯，G = 周围的故障范围，B = 碎块的错位量；
//   扩散遮罩 R = 从主要裂纹一圈圈膨胀出去的范围（越靠近裂缝越大）。
// 坐标：model 里原点在屏幕底边正中、y 朝上、单位是 base；画的时候换成 CSS 像素（y 朝上），正交相机正好铺满。

import * as THREE from 'three/webgpu';
import {
  Fn,
  attribute,
  clamp,
  dot,
  float,
  int,
  ivec2,
  length,
  max,
  min,
  mix,
  positionGeometry,
  select,
  textureLoad,
  uniform,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { SHARD_POP_MS, TIP, type CrackModel, type CrackState } from './crack';

export type CrackMasks = {
  /** R 裂缝芯、G 故障范围、B 碎块错位；长边 2048 */
  crackTexture: THREE.Texture;
  /** R 扩散范围；本来就是糊的一大片，长边 128 */
  spreadTexture: THREE.Texture;
  resize: (cssWidth: number, cssHeight: number) => void;
  drawCracks: (crack: number, open: number) => void;
  drawSpread: (spread: number) => void;
  dispose: () => void;
};

/** 张开时左右两边参差的最大倍数（crack.ts 里 jag 取 0.35 ~ 1.65） */
const JAG_MAX = 1.65;
/** 故障范围的三层宽笔画：[粗细（base 的比例）, 强度 0..255]，叠起来是一个柔和的衰减 */
const ZONE_LAYERS: [number, number][] = [
  [0.12, 30],
  [0.065, 46],
  [0.03, 70],
];
const SPREAD_LAYERS = 5;
const SPREAD_LONG_SIDE = 128;
const CRACK_LONG_SIDE = 2048;

// TSL 节点的类型推导非常细，这里的小工具把参数放宽成 any
/* eslint-disable @typescript-eslint/no-explicit-any */

/** 点到线段的距离 */
const segmentDistance = (p: any, a: any, b: any) => {
  const ab = b.sub(a);
  const t = clamp(dot(p.sub(a), ab).div(max(dot(ab, ab), 1e-6)), 0, 1);
  return length(p.sub(a.add(ab.mul(t))));
};

/** 一条 width 宽的边（按遮罩像素抗锯齿）：在里面 1，外面 0 */
const inside = (halfWidth: any, distance: any, pixel: any) => clamp(halfWidth.sub(distance).div(pixel).add(0.5), 0, 1);

export function createCrackMasks(renderer: THREE.WebGPURenderer, model: CrackModel, state: CrackState): CrackMasks {
  const pathCount = model.paths.length;
  const shardCount = model.shards.length;

  /* ---------- 每帧会变的数据：每条裂纹的前沿和「刚崩出来」的热度、每块碎片的透明度 ---------- */
  const dataWidth = Math.max(pathCount, shardCount, 1);
  const data = new Float32Array(dataWidth * 2 * 4);
  const dataTexture = new THREE.DataTexture(data, dataWidth, 2, THREE.RGBAFormat, THREE.FloatType);
  dataTexture.minFilter = THREE.NearestFilter;
  dataTexture.magFilter = THREE.NearestFilter;
  dataTexture.generateMipmaps = false;
  dataTexture.needsUpdate = true;

  const uploadState = () => {
    for (let index = 0; index < pathCount; index += 1) {
      data[index * 4] = state.front[index];
      data[index * 4 + 1] = state.fresh[index];
    }
    const row = dataWidth * 4;
    model.shards.forEach((shard, index) => {
      const t = state.ages[shard.event] - shard.delay;
      data[row + index * 4] = Math.min(Math.max(t / SHARD_POP_MS, 0), 1);
    });
    dataTexture.needsUpdate = true;
  };

  /* ---------- 每段裂纹一个实例：两个端点、前后相邻的点、弧长、所属裂纹的参数 ---------- */
  let segmentCount = 0;
  model.paths.forEach((path) => {
    segmentCount += path.points.length - 1;
  });
  const aSeg = new Float32Array(segmentCount * 4);
  const aNbr = new Float32Array(segmentCount * 4);
  const aArc = new Float32Array(segmentCount * 4);
  const aPath = new Float32Array(segmentCount * 4);
  const aJag = new Float32Array(segmentCount * 4);
  const aFlag = new Float32Array(segmentCount * 4);
  let cursor = 0;
  model.paths.forEach((path, pathIndex) => {
    const { points, cum, jag } = path;
    const last = points.length - 1;
    for (let index = 0; index < last; index += 1) {
      const o = cursor * 4;
      const [ax, ay] = points[index];
      const [bx, by] = points[index + 1];
      const [px, py] = points[Math.max(0, index - 1)];
      const [nx, ny] = points[Math.min(last, index + 2)];
      aSeg.set([ax, ay, bx, by], o);
      aNbr.set([px, py, nx, ny], o);
      aArc.set([cum[index], cum[index + 1], pathIndex, path.length], o);
      aPath.set([path.width, path.open, path.taper, path.zone], o);
      aJag.set([jag[index * 2], jag[index * 2 + 1], jag[(index + 1) * 2], jag[(index + 1) * 2 + 1]], o);
      aFlag.set([index > 0 ? 1 : 0, index + 1 < last ? 1 : 0, Math.min(TIP, path.length * 0.6), 0], o);
      cursor += 1;
    }
  });

  const segmentGeometry = new THREE.InstancedBufferGeometry();
  // 一个单位四边形：x = 沿线段 0..1，y = 横向 -1..1；真正的位置在顶点着色器里算
  segmentGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
  segmentGeometry.setAttribute('corner', new THREE.BufferAttribute(new Float32Array([0, -1, 1, -1, 0, 1, 1, 1]), 2));
  segmentGeometry.setIndex([0, 1, 2, 2, 1, 3]);
  segmentGeometry.setAttribute('aSeg', new THREE.InstancedBufferAttribute(aSeg, 4));
  segmentGeometry.setAttribute('aNbr', new THREE.InstancedBufferAttribute(aNbr, 4));
  segmentGeometry.setAttribute('aArc', new THREE.InstancedBufferAttribute(aArc, 4));
  segmentGeometry.setAttribute('aPath', new THREE.InstancedBufferAttribute(aPath, 4));
  segmentGeometry.setAttribute('aJag', new THREE.InstancedBufferAttribute(aJag, 4));
  segmentGeometry.setAttribute('aFlag', new THREE.InstancedBufferAttribute(aFlag, 4));
  segmentGeometry.instanceCount = segmentCount;

  /* ---------- 碎块：多边形三角化，各自错开的量写在 B 通道 ---------- */
  const shardPositions: number[] = [];
  const shardIndex: number[] = [];
  const shardB: number[] = [];
  model.shards.forEach((shard, index) => {
    const contour: THREE.Vector2[] = [];
    shard.polygon.forEach(([x, y]) => {
      const prev = contour[contour.length - 1];
      if (!prev || Math.hypot(prev.x - x, prev.y - y) > 1e-6) contour.push(new THREE.Vector2(x, y));
    });
    if (contour.length < 3) return;
    THREE.ShapeUtils.triangulateShape(contour, []).forEach((triangle) => {
      triangle.forEach((vertex) => {
        shardPositions.push(contour[vertex].x, contour[vertex].y, 0);
        shardIndex.push(index);
        shardB.push(shard.b);
      });
    });
  });
  const shardGeometry = new THREE.BufferGeometry();
  shardGeometry.setAttribute('position', new THREE.Float32BufferAttribute(shardPositions, 3));
  shardGeometry.setAttribute('shard', new THREE.Float32BufferAttribute(shardIndex, 1));
  shardGeometry.setAttribute('shardB', new THREE.Float32BufferAttribute(shardB, 1));

  /* ---------- 公共的 uniform ---------- */
  const uWidth = uniform(1);
  const uBase = uniform(1);
  /** 裂缝芯的线宽倍数（屏幕大一点稍微粗一点） */
  const uCorePx = uniform(1);
  const uOpen = uniform(0);
  /** 故障范围跟着滚动进度变宽 */
  const uGrow = uniform(0.35);
  /** 一个遮罩像素是多少 CSS 像素（抗锯齿用） */
  const uCrackPixel = uniform(1);
  const uSpreadPixel = uniform(1);
  const uSpreadRadius = uniform(0);

  const toCss = (p: any) => vec2(uWidth.mul(0.5).add(p.x.mul(uBase)), p.y.mul(uBase));

  /**
   * 每个实例的顶点：把线段截到前沿，四边形按需要的宽度（margin，CSS 像素）向四周撑开。
   * 前沿还没跑到这一段、或者 show 为假的，四个顶点都塌成一个点，什么都不画。
   */
  const segmentVertex = (margin: (front: any, fresh: any) => any, show: any = null) => {
    const seg = attribute('aSeg', 'vec4') as any;
    const nbr = attribute('aNbr', 'vec4') as any;
    const arc = attribute('aArc', 'vec4') as any;
    const flag = attribute('aFlag', 'vec4') as any;
    const corner = attribute('corner', 'vec2') as any;
    const live = textureLoad(dataTexture, ivec2(int(arc.z), int(0))) as any;
    const front = live.x;
    const fresh = live.y;
    const a = toCss(seg.xy);
    const bFull = toCss(seg.zw);
    // 这一段只露出前沿以内的部分
    const k = clamp(front.sub(arc.x).div(max(arc.y.sub(arc.x), 1e-6)), 0, 1);
    const b = mix(a, bFull, k);
    // 下一段露出来的部分（用来判断重叠的地方归谁，不重复叠加）
    const nextLength = max(length(nbr.zw.sub(seg.zw)), 1e-6);
    const nextK = clamp(front.sub(arc.y).div(nextLength), 0, 1);
    const hasNext = flag.y.mul(float(front.greaterThan(arc.y)));
    const nextEnd = mix(bFull, toCss(nbr.zw), nextK);
    const along = bFull.sub(a);
    const dir = along.div(max(length(along), 1e-6));
    const normal = vec2(dir.y.negate(), dir.x);
    const m = margin(front, fresh);
    const start = a.sub(dir.mul(m));
    const end = b.add(dir.mul(m));
    const visible = show ? front.greaterThan(arc.x).and(show) : front.greaterThan(arc.x);
    const placed: any = select(visible, mix(start, end, corner.x).add(normal.mul(m).mul(corner.y)), vec2(-1e5, -1e5));
    return {
      position: vec3(placed.x, placed.y, 0),
      pos: varying(placed) as any,
      seg: varying(vec4(a, b)) as any,
      nbr: varying(vec4(toCss(nbr.xy), nextEnd)) as any,
      arc: varying(vec4(arc.x, min(arc.y, front), front, fresh)) as any,
      hasPrev: flag.x,
      hasNext: varying(hasNext) as any,
    };
  };

  /* ---------- ① 裂纹遮罩：裂缝芯（R）和故障范围（G） ---------- */
  // 和画布上的 lighter 一样：不同裂纹之间相加，同一条裂纹自己重叠的地方（拐角）只算一次——
  // 每个像素只交给离它最近的那一段来画
  const crackVertex = segmentVertex((_front: any, fresh: any) => {
    const path = attribute('aPath', 'vec4') as any;
    const core = path.x.add(path.y.mul(uOpen).mul(JAG_MAX)).mul(uCorePx);
    const zoneOn = float(path.w.greaterThan(0));
    const zone = max(float(2), uBase.mul(ZONE_LAYERS[0][0]).mul(path.w).mul(uGrow).mul(0.5)).mul(0.5).mul(zoneOn);
    const freshOn = zoneOn.mul(float(fresh.greaterThan(0.01)));
    const hot = max(float(3), uBase.mul(0.03).mul(max(path.w, 0.4))).mul(0.5).mul(freshOn);
    return max(max(core, zone), hot).add(uCrackPixel.mul(2));
  });

  const crackColor = Fn(() => {
    const v = crackVertex;
    const path = attribute('aPath', 'vec4') as any;
    const jag = attribute('aJag', 'vec4') as any;
    const arcStatic = attribute('aArc', 'vec4') as any;
    const flag = attribute('aFlag', 'vec4') as any;
    const p = v.pos;
    const a = v.seg.xy;
    const b = v.seg.zw;
    const ab = b.sub(a);
    const t = clamp(dot(p.sub(a), ab).div(max(dot(ab, ab), 1e-6)), 0, 1);
    const distance = length(p.sub(a.add(ab.mul(t))));
    // 拐角处前后两段都盖得到：只留离得最近的那一段
    const prevDistance = select(v.hasPrev.greaterThan(0.5), segmentDistance(p, v.nbr.xy, a), float(1e9));
    const nextDistance = select(v.hasNext.greaterThan(0.5), segmentDistance(p, b, v.nbr.zw), float(1e9));
    const own = float(distance.lessThan(prevDistance).and(distance.lessThanEqual(nextDistance)));

    // 裂缝芯：沿途收窄，前沿收成针尖，张开时左右各自参差
    const s = mix(v.arc.x, v.arc.y, t);
    const front = v.arc.z;
    const fresh = v.arc.w;
    const along = s.div(arcStatic.w);
    const needle = clamp(front.sub(s).div(flag.z), 0, 1);
    const left = ab.x.mul(p.y.sub(a.y)).sub(ab.y.mul(p.x.sub(a.x))).greaterThanEqual(0);
    const side = select(left, mix(jag.x, jag.z, t), mix(jag.y, jag.w, t));
    const baseWidth = path.x.mul(uCorePx).mul(float(1).sub(path.z.mul(along)));
    const openWidth = path.y.mul(uOpen).mul(uCorePx).mul(float(1).sub(along.mul(0.55))).mul(side);
    const half = baseWidth.add(openWidth).mul(needle);
    // 比一个像素还细的线按覆盖面积变淡（和画布的抗锯齿一样）
    const core = clamp(half.sub(distance).add(uCrackPixel.mul(0.5)), 0, min(uCrackPixel, half.mul(2))).div(uCrackPixel);

    // 故障范围：三层宽笔画叠出柔和的衰减；刚崩出来的再叠一层
    const zoneOn = float(path.w.greaterThan(0));
    let zone: any = float(0);
    ZONE_LAYERS.forEach(([size, value]) => {
      const halfWidth = max(float(2), uBase.mul(size).mul(path.w).mul(uGrow).mul(0.5)).mul(0.5);
      zone = zone.add(inside(halfWidth, distance, uCrackPixel).mul(value / 255));
    });
    const hotWidth = max(float(3), uBase.mul(0.03).mul(max(path.w, 0.4))).mul(0.5);
    const hot = inside(hotWidth, distance, uCrackPixel)
      .mul(fresh.mul(130).round().div(255))
      .mul(float(fresh.greaterThan(0.01)));
    zone = zone.add(hot).mul(zoneOn);
    return vec4(core.mul(own), zone.mul(own), 0, 1);
  });

  const crackMaterial = new THREE.MeshBasicNodeMaterial({ transparent: true, depthTest: false, depthWrite: false });
  crackMaterial.positionNode = crackVertex.position;
  crackMaterial.colorNode = crackColor();
  crackMaterial.blending = THREE.CustomBlending;
  crackMaterial.blendEquation = THREE.AddEquation;
  crackMaterial.blendSrc = THREE.OneFactor;
  crackMaterial.blendDst = THREE.OneFactor;
  crackMaterial.toneMapped = false;
  const crackMesh = new THREE.Mesh(segmentGeometry, crackMaterial);
  crackMesh.frustumCulled = false;
  crackMesh.renderOrder = 1;

  // 碎块先画（和画布上一样在最底下），后画的小碎块盖住大碎块
  const shardMaterial = new THREE.MeshBasicNodeMaterial({ transparent: true, depthTest: false, depthWrite: false });
  shardMaterial.positionNode = vec3(toCss(positionGeometry.xy), 0);
  const shardAlpha = textureLoad(dataTexture, ivec2(int(attribute('shard', 'float')), int(1))) as any;
  shardMaterial.colorNode = vec4(0, 0, attribute('shardB', 'float'), shardAlpha.x);
  shardMaterial.blending = THREE.CustomBlending;
  shardMaterial.blendEquation = THREE.AddEquation;
  shardMaterial.blendSrc = THREE.SrcAlphaFactor;
  shardMaterial.blendDst = THREE.OneMinusSrcAlphaFactor;
  shardMaterial.blendSrcAlpha = THREE.OneFactor;
  shardMaterial.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  shardMaterial.toneMapped = false;
  const shardMesh = new THREE.Mesh(shardGeometry, shardMaterial);
  shardMesh.frustumCulled = false;
  shardMesh.renderOrder = 0;

  const crackScene = new THREE.Scene();
  crackScene.add(shardMesh, crackMesh);

  /* ---------- ② 扩散遮罩：主要裂纹一圈圈膨胀出去，越靠近裂缝数值越大 ---------- */
  // 五层越来越窄的笔画叠在一起（同一层里所有裂纹是一笔，所以取最近的那条裂纹），用 max 混合正好就是这样
  const spreadVertex = segmentVertex(
    () => uSpreadRadius.add(1).add(uSpreadPixel.mul(2)),
    (attribute('aPath', 'vec4') as any).w.greaterThanEqual(0.5),
  );
  const spreadColor = Fn(() => {
    const v = spreadVertex;
    const distance = segmentDistance(v.pos, v.seg.xy, v.seg.zw);
    let value: any = float(0);
    for (let layer = 0; layer < SPREAD_LAYERS; layer += 1) {
      const halfWidth = uSpreadRadius.mul(1 - layer / SPREAD_LAYERS).add(1);
      value = value.add(inside(halfWidth, distance, uSpreadPixel).mul(Math.floor(255 / SPREAD_LAYERS) / 255));
    }
    return vec4(value, 0, 0, 1);
  });
  const spreadMaterial = new THREE.MeshBasicNodeMaterial({ transparent: true, depthTest: false, depthWrite: false });
  spreadMaterial.positionNode = spreadVertex.position;
  spreadMaterial.colorNode = spreadColor();
  spreadMaterial.blending = THREE.CustomBlending;
  spreadMaterial.blendEquation = THREE.MaxEquation;
  spreadMaterial.blendSrc = THREE.OneFactor;
  spreadMaterial.blendDst = THREE.OneFactor;
  spreadMaterial.toneMapped = false;
  const spreadMesh = new THREE.Mesh(segmentGeometry, spreadMaterial);
  spreadMesh.frustumCulled = false;
  const spreadScene = new THREE.Scene();
  spreadScene.add(spreadMesh);

  /* ---------- 渲染目标 ---------- */
  const targetOptions = {
    depthBuffer: false,
    generateMipmaps: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  } as const;
  const crackTarget = new THREE.RenderTarget(4, 4, targetOptions);
  const spreadTarget = new THREE.RenderTarget(4, 4, targetOptions);
  // 正交相机按 CSS 像素铺满（y 朝上）
  const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
  let cssWidth = 1;
  let cssHeight = 1;

  const resize = (width: number, height: number) => {
    cssWidth = Math.max(1, width);
    cssHeight = Math.max(1, height);
    // 裂缝是一两个像素宽的细线，遮罩要够细才不会糊成软软的粗管子：长边 2048（和原来的画布一样）。
    // 再大（按 3000 多的物理像素开）反而更慢：崩坏着色器每个像素要采四次这张图，图越大越不吃缓存
    const fit = (longSide: number) => {
      const k = longSide / Math.max(cssWidth, cssHeight);
      return [Math.max(4, Math.round(cssWidth * k)), Math.max(4, Math.round(cssHeight * k))] as const;
    };
    const [crackW, crackH] = fit(CRACK_LONG_SIDE);
    const [spreadW, spreadH] = fit(SPREAD_LONG_SIDE);
    crackTarget.setSize(crackW, crackH);
    spreadTarget.setSize(spreadW, spreadH);
    camera.right = cssWidth;
    camera.top = cssHeight;
    camera.updateProjectionMatrix();
    const base = Math.min(cssHeight, cssWidth * 1.15);
    uWidth.value = cssWidth;
    uBase.value = base;
    uCorePx.value = Math.min(Math.max(base / 900, 0.8), 1.6);
    uCrackPixel.value = cssWidth / crackW;
    uSpreadPixel.value = cssWidth / spreadW;
  };

  const renderInto = (target: THREE.RenderTarget, scene: THREE.Scene) => {
    const previous = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(previous);
  };

  return {
    crackTexture: crackTarget.texture,
    spreadTexture: spreadTarget.texture,
    resize,
    drawCracks: (crack, open) => {
      uploadState();
      uOpen.value = open;
      uGrow.value = 0.35 + 1.1 * crack;
      renderInto(crackTarget, crackScene);
    },
    drawSpread: (spread) => {
      uploadState();
      // 还没开始扩散：清空就行，不画那一大片什么都不留下的四边形
      spreadMesh.visible = spread > 0.001;
      uSpreadRadius.value = spread * Math.hypot(cssWidth, cssHeight) * 0.62;
      renderInto(spreadTarget, spreadScene);
    },
    dispose: () => {
      crackTarget.dispose();
      spreadTarget.dispose();
      segmentGeometry.dispose();
      shardGeometry.dispose();
      crackMaterial.dispose();
      shardMaterial.dispose();
      spreadMaterial.dispose();
      dataTexture.dispose();
    },
  };
}
