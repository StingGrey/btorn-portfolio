// 结尾这一段的 GPU 部分：一块 WebGPU 画布（不支持就退回 WebGL2），只干两件很轻的活——
//   ① 字符网格：CPU 每帧算好每一格的字和颜色（两张很小的数据纹理），这里按格子从图集里把字贴上去；
//   ② 页脚掉下去的字：每个字一个实例化的小四边形，往下掉、掉的时候乱换字，全在顶点着色器里算。
// 画面内容全在 CPU 的场景函数里（scenes/），这里不关心画的是什么。

import * as THREE from 'three/webgpu';
import {
  Fn,
  attribute,
  clamp,
  float,
  floor,
  fract,
  int,
  ivec2,
  max,
  mix,
  mod,
  positionGeometry,
  select,
  sin,
  smoothstep,
  texture,
  textureLoad,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { ATLAS_COLUMNS, freeAtlas, gridAtlas, measureFont, type Atlas, type FontMetrics } from './atlas';
import { BG, makeGrid, type Grid } from './grid';

/** 页脚上的一个字（掉落用）。位置是相对舞台左上角的 CSS 像素 */
export type FreeGlyph = {
  x: number;
  y: number;
  w: number;
  h: number;
  glyph: number;
  fg: [number, number, number];
  bg: [number, number, number];
  /** 底色的浓度（字符画的格子有一层底色；普通文字是 0） */
  tint: number;
  /** 这一列什么时候开始掉（0..1，掉落进度） */
  delay: number;
  /** 同一列里越靠上的越晚一点 */
  lag: number;
  /** 粉色的 O：不掉，最后收成一个点 */
  stay: boolean;
  seed: number;
};

/** 掉落进度里，一个字从开始掉到掉出屏幕用多久 */
export const FALL_SPAN = 0.34;

export type DiveRenderer = {
  metrics: FontMetrics;
  backend: string;
  /** 尺寸变了就重新排格子，返回当前的网格（场景函数往里写） */
  resize: (cssWidth: number, cssHeight: number, dpr: number) => Grid;
  upload: () => void;
  setGlyphs: (glyphs: FreeGlyph[]) => void;
  setFall: (fall: number, gather: number, gatherX: number, gatherY: number, reduced: boolean) => void;
  render: (drawGlyphs: boolean) => void;
  dispose: () => void;
};

type Layout = { cols: number; rows: number; cw: number; ch: number; offX: number; offY: number; wDev: number; hDev: number };

/* eslint-disable @typescript-eslint/no-explicit-any */

function canvasTexture(atlas: Atlas, smooth: boolean) {
  const tex = new THREE.CanvasTexture(atlas.canvas);
  tex.flipY = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = smooth;
  tex.minFilter = smooth ? THREE.LinearMipmapLinearFilter : THREE.NearestFilter;
  tex.magFilter = smooth ? THREE.LinearFilter : THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

function dataTexture(data: Uint8Array, cols: number, rows: number) {
  const tex = new THREE.DataTexture(data, cols, rows, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** 网格的材质：按物理像素找到所在的格子，读出字和颜色，从网格图集里取这个字在格子里对应的那个像素 */
function gridMaterial(L: Layout, fgTex: THREE.Texture, bgTex: THREE.Texture, atlasTex: THREE.Texture) {
  const material = new THREE.MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
  material.toneMapped = false;
  const bgColor = vec3(BG[0] / 255, BG[1] / 255, BG[2] / 255);
  material.colorNode = Fn(() => {
    const p = vec2(uv().x.mul(L.wDev), float(1).sub(uv().y).mul(L.hDev)).sub(vec2(L.offX, L.offY));
    const size = vec2(L.cw, L.ch);
    const cell = floor(p.div(size));
    const inside = cell.x
      .greaterThanEqual(0)
      .and(cell.y.greaterThanEqual(0))
      .and(cell.x.lessThan(L.cols))
      .and(cell.y.lessThan(L.rows));
    const c = clamp(cell, vec2(0, 0), vec2(L.cols - 1, L.rows - 1));
    const at = ivec2(int(c.x), int(c.y));
    const fg = textureLoad(fgTex, at) as any;
    const bg = textureLoad(bgTex, at) as any;
    const glyph = floor(fg.a.mul(255).add(0.5));
    const local = clamp(floor(p.sub(c.mul(size))), vec2(0, 0), vec2(L.cw - 1, L.ch - 1));
    const texel = ivec2(
      int(mod(glyph, ATLAS_COLUMNS).mul(L.cw).add(local.x)),
      int(floor(glyph.div(ATLAS_COLUMNS)).mul(L.ch).add(local.y)),
    );
    const mask = (textureLoad(atlasTex, texel) as any).r;
    return vec4(select(inside, mix(bg.rgb, fg.rgb, mask), bgColor) as any, 1);
  })();
  return material;
}

export async function createDiveRenderer(canvas: HTMLCanvasElement, options: { forceWebGL?: boolean } = {}): Promise<DiveRenderer> {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: false, alpha: false, forceWebGL: options.forceWebGL });
  await renderer.init();
  // 网格里的颜色本来就是 sRGB 的字节值：输出时不再转一遍
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.autoClear = false;
  renderer.setClearColor(new THREE.Color(BG[0] / 255, BG[1] / 255, BG[2] / 255), 1);

  await document.fonts.load(`20px "VT323"`).catch(() => undefined);
  const metrics = measureFont();

  /* ---------- ① 字符网格 ---------- */
  const gridScene = new THREE.Scene();
  const gridCamera = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1));
  quad.position.set(0.5, 0.5, 0);
  quad.frustumCulled = false;
  gridScene.add(quad);

  let layout: Layout | null = null;
  let grid: Grid = makeGrid(1, 1, 1, 1);
  let fgTex: THREE.DataTexture | null = null;
  let bgTex: THREE.DataTexture | null = null;
  let atlasTex: THREE.CanvasTexture | null = null;
  let material: THREE.MeshBasicNodeMaterial | null = null;

  /* ---------- ② 页脚掉下去的字 ---------- */
  const free = freeAtlas(metrics);
  const freeTex = canvasTexture(free, true);
  const glyphScene = new THREE.Scene();
  const glyphCamera = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]), 3));
  geometry.setIndex([0, 1, 2, 2, 1, 3]);
  const empty = () => new THREE.InstancedBufferAttribute(new Float32Array(4), 4);
  geometry.setAttribute('aRect', empty());
  geometry.setAttribute('aFg', empty());
  geometry.setAttribute('aBg', empty());
  geometry.setAttribute('aFall', empty());
  geometry.instanceCount = 0;

  const uFall = uniform(0);
  const uGather = uniform(0);
  const uGatherAt = uniform(new THREE.Vector2(0, 0));
  const uH = uniform(1);
  const uReduced = uniform(0);

  const glyphMaterial = new THREE.MeshBasicNodeMaterial({ transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
  glyphMaterial.toneMapped = false;
  {
    const rect = attribute('aRect', 'vec4') as any;
    const fgA = attribute('aFg', 'vec4') as any;
    const bgA = attribute('aBg', 'vec4') as any;
    const fallA = attribute('aFall', 'vec4') as any;
    const corner = (positionGeometry as any).xy;
    const stay = fallA.z;
    const start = fallA.x.add(fallA.y);
    const local = max(uFall.sub(start), 0).div(FALL_SPAN);
    const moving = float(1).sub(stay).mul(float(1).sub(uReduced));
    // 像重力一样越掉越快，按自己的字高一格一格地跳（终端里的字不会滑）
    const dist = local.mul(local).mul(uH).mul(1.3);
    const stepPx = max(rect.w, 1);
    const steps = floor(dist.div(stepPx));
    const dy = steps.mul(stepPx).mul(moving);
    // 粉色的 O 往一个点收，越收越小
    const gather = uGather.mul(stay);
    const ease = gather.mul(gather);
    const centre = vec2(rect.x.add(rect.z.mul(0.5)), rect.y.add(rect.w.mul(0.5))) as any;
    const size = vec2(rect.z, rect.w).mul(float(1).sub(ease.mul(0.8))) as any;
    const pos = (mix(centre, uGatherAt as any, ease) as any).sub(size.mul(0.5)).add(size.mul(corner)).add(vec2(0, dy));
    glyphMaterial.positionNode = vec3(pos.x, uH.sub(pos.y), 0);
    // 掉的时候时不时换成别的字
    const h = fract(sin(fallA.w.mul(91.7).add(steps.mul(12.9898))).mul(43758.5453));
    const mutate = float(local.greaterThan(0.02)).mul(float(h.lessThan(0.28))).mul(moving);
    const glyph = mix(fgA.w, floor(fract(h.mul(7.31)).mul(93)).add(1), mutate);
    // 减少动效：不掉，一列一列淡掉
    const fade = float(1).sub(smoothstep(start, start.add(0.16), uFall).mul(uReduced).mul(float(1).sub(stay)));
    const fadeStay = float(1).sub(smoothstep(0.72, 1, uGather).mul(stay));
    const vGlyph = varying(glyph) as any;
    const vCorner = varying(corner) as any;
    const vFg = varying(fgA) as any;
    const vBg = varying(bgA) as any;
    const vAlpha = varying(fade.mul(fadeStay)) as any;
    glyphMaterial.colorNode = Fn(() => {
      const g = floor(vGlyph.add(0.5));
      const auv = vec2(
        mod(g, ATLAS_COLUMNS).mul(free.cellW).add(free.pad).add(vCorner.x.mul(free.boxW)),
        floor(g.div(ATLAS_COLUMNS)).mul(free.cellH).add(free.pad).add(vCorner.y.mul(free.boxH)),
      ).div(vec2(free.canvas.width, free.canvas.height));
      const mask = (texture(freeTex, auv) as any).r;
      const ta = vBg.w;
      const keep = float(1).sub(mask);
      const alpha = ta.mul(keep).add(mask).mul(vAlpha);
      const rgb = vBg.rgb.mul(ta).mul(keep).add(vFg.rgb.mul(mask)).mul(vAlpha);
      return vec4(rgb, alpha);
    })();
  }
  glyphMaterial.blending = THREE.CustomBlending;
  glyphMaterial.blendEquation = THREE.AddEquation;
  glyphMaterial.blendSrc = THREE.OneFactor;
  glyphMaterial.blendDst = THREE.OneMinusSrcAlphaFactor;
  glyphMaterial.blendSrcAlpha = THREE.OneFactor;
  glyphMaterial.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  const glyphMesh = new THREE.Mesh(geometry, glyphMaterial);
  glyphMesh.frustumCulled = false;
  glyphScene.add(glyphMesh);

  const disposeGrid = () => {
    material?.dispose();
    fgTex?.dispose();
    bgTex?.dispose();
    atlasTex?.dispose();
  };

  const resize = (cssWidth: number, cssHeight: number, dpr: number) => {
    const wDev = Math.max(1, Math.round(cssWidth * dpr));
    const hDev = Math.max(1, Math.round(cssHeight * dpr));
    // 一屏大约 72 行字；字太小看不清、太大又太粗，夹在 9..15 CSS 像素之间
    const cellCss = Math.min(15, Math.max(9, cssHeight / 72));
    const ch = Math.max(8, Math.round(cellCss * dpr));
    const cw = Math.max(4, Math.round(ch * 0.5));
    const cols = Math.max(1, Math.floor(wDev / cw));
    const rows = Math.max(1, Math.floor(hDev / ch));
    const next: Layout = { cols, rows, cw, ch, offX: Math.floor((wDev - cols * cw) / 2), offY: Math.floor((hDev - rows * ch) / 2), wDev, hDev };
    renderer.setPixelRatio(dpr);
    renderer.setSize(cssWidth, cssHeight, false);
    glyphCamera.right = cssWidth;
    glyphCamera.top = cssHeight;
    glyphCamera.updateProjectionMatrix();
    uH.value = cssHeight;
    if (layout && JSON.stringify(layout) === JSON.stringify(next)) return grid;
    disposeGrid();
    layout = next;
    grid = makeGrid(cols, rows, cw, ch);
    fgTex = dataTexture(grid.fg, cols, rows);
    bgTex = dataTexture(grid.bg, cols, rows);
    atlasTex = canvasTexture(gridAtlas(cw, ch), false);
    material = gridMaterial(next, fgTex, bgTex, atlasTex);
    quad.material = material;
    return grid;
  };

  return {
    metrics,
    backend: (renderer.backend as any)?.isWebGPUBackend ? 'webgpu' : 'webgl2',
    resize,
    upload: () => {
      if (fgTex) fgTex.needsUpdate = true;
      if (bgTex) bgTex.needsUpdate = true;
    },
    setGlyphs: (glyphs) => {
      const n = glyphs.length;
      const rect = new Float32Array(Math.max(n, 1) * 4);
      const fg = new Float32Array(Math.max(n, 1) * 4);
      const bg = new Float32Array(Math.max(n, 1) * 4);
      const fall = new Float32Array(Math.max(n, 1) * 4);
      glyphs.forEach((g, index) => {
        const o = index * 4;
        rect.set([g.x, g.y, g.w, g.h], o);
        fg.set([g.fg[0] / 255, g.fg[1] / 255, g.fg[2] / 255, g.glyph], o);
        bg.set([g.bg[0] / 255, g.bg[1] / 255, g.bg[2] / 255, g.tint], o);
        fall.set([g.delay, g.lag, g.stay ? 1 : 0, g.seed], o);
      });
      geometry.setAttribute('aRect', new THREE.InstancedBufferAttribute(rect, 4));
      geometry.setAttribute('aFg', new THREE.InstancedBufferAttribute(fg, 4));
      geometry.setAttribute('aBg', new THREE.InstancedBufferAttribute(bg, 4));
      geometry.setAttribute('aFall', new THREE.InstancedBufferAttribute(fall, 4));
      geometry.instanceCount = n;
    },
    setFall: (fall, gather, gatherX, gatherY, reduced) => {
      uFall.value = fall;
      uGather.value = gather;
      uGatherAt.value.set(gatherX, gatherY);
      uReduced.value = reduced ? 1 : 0;
    },
    render: (drawGlyphs) => {
      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(gridScene, gridCamera);
      if (drawGlyphs && geometry.instanceCount > 0) renderer.render(glyphScene, glyphCamera);
    },
    dispose: () => {
      disposeGrid();
      freeTex.dispose();
      geometry.dispose();
      glyphMaterial.dispose();
      quad.geometry.dispose();
      renderer.dispose();
    },
  };
}
