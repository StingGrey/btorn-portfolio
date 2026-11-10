import * as THREE from 'three/webgpu';
import {
  Fn,
  abs,
  clamp,
  color,
  cos,
  dot,
  exp,
  float,
  floor,
  fract,
  length,
  max,
  min,
  mix,
  normalView,
  pass,
  positionLocal,
  positionViewDirection,
  pow,
  screenSize,
  screenUV,
  sin,
  smoothstep,
  sRGBTransferOETF,
  step,
  texture,
  textureBicubicLevel,
  time,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
  viewportMipTexture,
} from 'three/tsl';
import RAPIER from '@dimforge/rapier3d-simd-compat';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import fredokaBold from '@fontsource/fredoka/files/fredoka-latin-600-normal.woff?url';
import fredokaMedium from '@fontsource/fredoka/files/fredoka-latin-500-normal.woff?url';
import { assets } from '../../../content/assets';
import { tagline } from '../content';
import { buildCrackModel, createCrackState, stepCracks } from './crack';
import { createCrackMasks } from './crackMasks';
import { extrudeGlyph, flatText, glyphAdvance, loadFont } from './fontGeometry';
import { createToy, frostedGlass, toyKinds, type ToyKind } from './toys';
import { disposeObject } from './dispose';

export type HeroStage = {
  backend: 'WebGPU' | 'WebGL2';
  /** 能扔进瓶子的东西一共几个（六个玩具 + Logo 里的 O） */
  total: number;
  setProgress: (progress: number) => void;
  setActive: (active: boolean) => void;
  dispose: () => void;
};

type Options = {
  reducedMotion: boolean;
  forceWebGL?: boolean;
  onJarCount?: (count: number) => void;
};

/** float：没有重力，弹簧拉回原位；jar：有重力（被扔出去、在瓶子里） */
type Mode = 'float' | 'jar';

type Toy = {
  kind: ToyKind | 'ring';
  object: THREE.Object3D;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider | null;
  home: THREE.Vector3;
  mode: Mode;
  since: number;
  baseScale: number;
  scale: number;
  scaleVel: number;
  targetScale: number;
  phase: number;
  delay: number;
  /** 上一个物理步的位置和朝向：渲染时在上一步和这一步之间插值，帧率比物理步频高也不会一顿一顿 */
  prevPosition: THREE.Vector3;
  prevRotation: THREE.Quaternion;
};

type Letter = {
  mesh: THREE.Mesh;
  hop: number;
  hopVel: number;
  spin: number;
  spinVel: number;
  scale: number;
  scaleVel: number;
  delay: number;
  hovered: boolean;
};

const CAMERA_Z = 14;
const FOV = 32;
const MASCOT_Z = -2.6;
const BG_Z = -9;
const MASCOT_ASPECT = 1148 / 1800;
const STEP = 1 / 60;
/** 拖瓶子时它最快能跑多快（每秒多少个世界单位） */
const JAR_SPEED = 14;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

function viewSize(aspect: number, depth = 0) {
  const height = 2 * (CAMERA_Z - depth) * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  return { width: height * aspect, height };
}

type JarLayout = { x: number; y: number; z: number; h: number; r: number };

type Layout = {
  wide: boolean;
  mascot: { x: number; y: number; h: number };
  logo: { x: number; y: number; size: number };
  tagline: { x: number; y: number };
  jar: JarLayout;
  toyHomes: [number, number, number][];
  toyScale: number;
};

/**
 * 看板娘固定贴在右下角；Logo 在左侧；玻璃瓶立在画面底部。
 * toyHomes 是屏幕上的位置（相对画面中心，占宽高的比例）和深度，透视在 applyLayout 里换算。
 * 右上角（窄屏是导航下面）留给提示条。
 */
function computeLayout(aspect: number, cssWidth: number): Layout {
  const view = viewSize(aspect);
  const depthScale = (CAMERA_Z - MASCOT_Z) / CAMERA_Z;
  const wide = aspect >= 1.05;
  const mascotH = view.height * (wide ? 0.86 : 0.52) * depthScale;
  const mascotW = mascotH * MASCOT_ASPECT;
  const mascot = {
    h: mascotH,
    x: (view.width / 2) * depthScale - mascotW / 2 - view.width * (wide ? 0.015 : 0) * depthScale,
    y: -(view.height / 2) * depthScale + mascotH / 2 - mascotH * 0.015,
  };
  if (wide) {
    const size = view.height * 0.16;
    const logoY = view.height * 0.16;
    const jarH = view.height * 0.4;
    return {
      wide,
      mascot,
      logo: { x: -view.width * 0.27, y: logoY, size },
      tagline: { x: -view.width * 0.27, y: logoY - size * 0.52 },
      jar: { x: -view.width * 0.05, y: -view.height * 0.45, z: 0.4, h: jarH, r: jarH * 0.36 },
      toyHomes: [
        [-0.13, 0.375, 1.2],
        [-0.014, 0.244, 0.8],
        [-0.424, -0.122, 1.8],
        [0.097, 0.356, 2.0],
        [-0.271, -0.211, 1.4],
        [0.083, 0.056, 1.0],
      ],
      toyScale: Math.min(1.1, view.height / 7.8),
    };
  }
  const size = Math.min(view.width * 0.19, view.height * 0.095);
  const logoY = view.height * 0.24;
  const jarH = view.height * 0.28;
  return {
    wide,
    mascot,
    logo: { x: 0, y: logoY, size },
    tagline: { x: 0, y: logoY - size * 0.52 },
    jar: { x: -view.width * (cssWidth > 560 ? 0.2 : 0.24), y: -view.height * 0.46, z: 0.4, h: jarH, r: jarH * 0.36 },
    toyHomes: [
      [-0.32, 0.109, 1.4],
      [0.346, 0.109, 0.8],
      [-0.013, 0.0, 2.0],
      [0.051, 0.121, 2.2],
      [-0.346, -0.092, 1.2],
      [-0.051, -0.116, 1.0],
    ],
    toyScale: Math.min(0.85, view.width / 5.2),
  };
}

/** 玻璃瓶的旋转轮廓：圆角平底、直身、收肩、瓶口外翻一圈 */
function jarProfile(r: number, h: number) {
  const points: THREE.Vector2[] = [new THREE.Vector2(0.001, 0), new THREE.Vector2(r * 0.8, 0)];
  const corner = r * 0.2;
  for (let index = 1; index <= 6; index += 1) {
    const angle = -Math.PI / 2 + (index / 6) * (Math.PI / 2);
    points.push(new THREE.Vector2(r - corner + Math.cos(angle) * corner, corner + Math.sin(angle) * corner));
  }
  points.push(new THREE.Vector2(r, h * 0.72));
  for (let index = 1; index <= 8; index += 1) {
    const t = index / 8;
    points.push(new THREE.Vector2(r - r * 0.3 * ((1 - Math.cos(t * Math.PI)) / 2), h * 0.72 + t * h * 0.16));
  }
  points.push(new THREE.Vector2(r * 0.7, h * 0.95));
  points.push(new THREE.Vector2(r * 0.77, h * 0.985));
  points.push(new THREE.Vector2(r * 0.74, h));
  points.push(new THREE.Vector2(r * 0.68, h * 0.992));
  return points;
}

// TSL 节点的类型推导非常细，这些纯数学小工具把参数放宽成 any
/* eslint-disable @typescript-eslint/no-explicit-any */
const hash2 = (p: any) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));

let rapierReady: Promise<void> | null = null;

export async function createHeroStage(canvas: HTMLCanvasElement, options: Options): Promise<HeroStage> {
  // 场景通道自己做 MSAA，画布本身不用再抗锯齿；alpha 打开，碎掉的地方能透出下面的控制台
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: false, alpha: true, forceWebGL: options.forceWebGL });
  rapierReady ??= RAPIER.init();
  await Promise.all([renderer.init(), rapierReady]);
  const backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'WebGPU' : 'WebGL2';
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const [boldFont, mediumFont, mascotTexture] = await Promise.all([
    loadFont(fredokaBold),
    loadFont(fredokaMedium),
    new THREE.TextureLoader().loadAsync(assets.characterCutout),
  ]);
  mascotTexture.colorSpace = THREE.SRGBColorSpace;
  mascotTexture.anisotropy = 8;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#fffafd');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.9;

  const key = new THREE.DirectionalLight('#ffffff', 2.4);
  key.position.set(-5, 7, 9);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#ffd1e6', 1.2);
  rim.position.set(6, -2, 4);
  scene.add(rim);
  scene.add(new THREE.AmbientLight('#fff3f8', 0.35));

  // 镜头完全固定，不做视差
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);
  camera.position.set(0, 0, CAMERA_Z);
  camera.lookAt(0, 0, 0);

  /* ---------- 背景：白底上的粉、蓝、薄荷、柠檬色光斑 + 小圆点 ---------- */
  const uAspect = uniform(1.6);
  const uPointer = uniform(new THREE.Vector2(0.5, 0.5));
  const uIntro = uniform(options.reducedMotion ? 1 : 0);

  const background = Fn(() => {
    const p = uv();
    const q = vec2(p.x.mul(uAspect), p.y);
    const t = time.mul(0.07);
    const col = (color('#fffbfd') as any).toVar();
    const blob = (cx: any, cy: any, radius: number, tint: string, strength: number) => {
      const d = length(q.sub(vec2(cx.mul(uAspect), cy)));
      const weight = float(1).sub(smoothstep(0, radius, d)).mul(strength).mul(uIntro);
      col.assign(mix(col, color(tint), weight));
    };
    blob(float(0.2).add(sin(t).mul(0.06)), float(0.72).add(cos(t.mul(1.3)).mul(0.05)), 0.62, '#ffd2e3', 0.95);
    blob(float(0.86).add(cos(t.mul(0.8)).mul(0.05)), float(0.8).add(sin(t.mul(0.9)).mul(0.04)), 0.48, '#cfe8ff', 0.9);
    blob(float(0.1).add(sin(t.mul(1.1)).mul(0.04)), float(0.16).add(cos(t.mul(0.7)).mul(0.05)), 0.46, '#d2f6e4', 0.9);
    blob(float(0.64).add(cos(t.mul(0.6)).mul(0.06)), float(0.1), 0.38, '#fff1c2', 0.85);
    blob(float(0.56).add(sin(t.mul(0.5)).mul(0.05)), float(0.46), 0.3, '#ebe0ff', 0.6);
    blob(uPointer.x, uPointer.y, 0.24, '#ffc6dd', 0.35);
    const cell = fract(q.mul(30)).sub(0.5);
    const dots = float(1).sub(smoothstep(0.05, 0.09, length(cell)));
    col.assign(mix(col, color('#ffbfd8'), dots.mul(0.2).mul(uIntro)));
    return col;
  });
  const backgroundMaterial = new THREE.MeshBasicNodeMaterial();
  backgroundMaterial.colorNode = background();
  const backgroundMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), backgroundMaterial);
  backgroundMesh.position.z = BG_Z;
  scene.add(backgroundMesh);

  /* ---------- 看板娘：固定在右下角，不跟鼠标 ---------- */
  // 看板娘的贴图会按她在屏幕上的实际像素高度预先缩好（高质量缩放、不用 mipmap），线条才清楚
  const mascotSampler = texture(mascotTexture);
  const mascotMaterial = new THREE.MeshBasicNodeMaterial({ alphaTest: 0.5 });
  mascotMaterial.colorNode = mascotSampler;
  mascotMaterial.alphaToCoverage = true;
  const mascot = new THREE.Mesh(new THREE.PlaneGeometry(MASCOT_ASPECT, 1), mascotMaterial);
  mascot.position.z = MASCOT_Z;
  scene.add(mascot);

  /* ---------- 玻璃瓶：和之前的磨砂台面同一种物理磨砂玻璃 ---------- */
  // 透射材质只会折射不透明的东西，瓶里的玻璃玩具会被它盖掉。
  // 所以瓶身在自己绘制前拷一份画面（背景、看板娘、瓶里的玩具都在），做磨砂模糊 + 折射 + 色散，
  // 替换掉漫反射，再叠上物理材质自己的清漆高光和薄膜彩虹。
  // 夹一下再求幂：点积因为精度略大于 1 时，负数的幂会变成 NaN
  const jarRim: any = clamp(float(1).sub(abs(dot(normalView, positionViewDirection))), 0, 1);
  const fresnel: any = pow(jarRim, 2.2);
  const jarView: any = viewportMipTexture();
  const uJarH = uniform(1);
  const jarY: any = positionLocal.y.div(uJarH);
  const frostedJar = Fn(() => {
    // 磨砂颗粒贴在瓶身上（用瓶子的 uv，不跟着屏幕走）
    const grainUv = floor(uv().mul(vec2(900, 520)));
    const grain = vec2(hash2(grainUv), hash2(grainUv.add(17.3))).sub(0.5).mul(0.005);
    const bend = vec2(normalView.x, normalView.y.negate()).mul(jarRim.mul(0.1).add(0.01)).add(grain);
    const lod = float(2.2).add(jarRim.mul(1.6));
    const spread = jarRim.mul(0.02).add(0.002);
    const base = screenUV.sub(bend);
    const seen = vec3(
      textureBicubicLevel(jarView.sample(base.add(vec2(spread, 0))), lod).r,
      textureBicubicLevel(jarView.sample(base), lod).g,
      textureBicubicLevel(jarView.sample(base.sub(vec2(spread, 0))), lod).b,
    );
    // 一层奶白的雾：瓶壁越斜越白，瓶底最厚、最白，边上再透一点粉
    const thick = float(1).sub(smoothstep(0, 0.1, jarY));
    const milky = mix(seen, vec3(1, 0.975, 0.99), float(0.08).add(jarRim.mul(0.28)).add(thick.mul(0.35)));
    // 侧面看过去玻璃最厚：轮廓压成淡淡的薰衣草灰，内侧再留一道亮边，白底上也看得出是玻璃
    const outline = milky.mul(mix(vec3(1), vec3(0.8, 0.74, 0.92), smoothstep(0.55, 0.96, jarRim)));
    const innerLight = smoothstep(0.8, 0.88, jarRim).mul(float(1).sub(smoothstep(0.88, 0.95, jarRim))).mul(0.45);
    return outline.mul(vec3(1, 0.965, 0.985)).add(vec3(innerLight));
  });
  const jarFrontMaterial = new THREE.MeshPhysicalNodeMaterial({
    color: new THREE.Color('#ffffff'),
    transparent: true,
    depthWrite: false,
    roughness: 0.22,
    metalness: 0,
    ior: 1.46,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    iridescence: 0.55,
    iridescenceIOR: 1.3,
    specularIntensity: 1,
  });
  jarFrontMaterial.backdropNode = frostedJar();
  // 玻璃罐子标志性的竖条高光：左边一宽一窄两条，右边缘一圈柔光（只在瓶身直的那段）
  const jarBody = smoothstep(0.08, 0.16, jarY).mul(float(1).sub(smoothstep(0.64, 0.72, jarY)));
  const streaks = float(1)
    .sub(smoothstep(0, 0.05, abs(normalView.x.add(0.62))))
    .mul(0.85)
    .add(float(1).sub(smoothstep(0, 0.022, abs(normalView.x.add(0.44)))).mul(0.6))
    .add(smoothstep(0.78, 0.98, normalView.x).mul(0.35));
  jarFrontMaterial.emissiveNode = vec3(1, 0.98, 1).mul(streaks.mul(jarBody));
  // 后壁只描一圈淡淡的边，让瓶口和瓶底的轮廓看得出来
  const jarBackMaterial = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.BackSide });
  jarBackMaterial.colorNode = color('#fff0f7');
  jarBackMaterial.opacityNode = float(0.04).add(fresnel.mul(0.45));
  const jar = new THREE.Group();
  const jarGeometry = { current: new THREE.BufferGeometry() };
  const jarBack = new THREE.Mesh(jarGeometry.current, jarBackMaterial);
  const jarFront = new THREE.Mesh(jarGeometry.current, jarFrontMaterial);
  // 透明队列里按 renderOrder 排：玩具（0）→ 后壁（1）→ 前壁（3），前壁拷画面时瓶里的玩具已经画好了
  jarBack.renderOrder = 1;
  jarFront.renderOrder = 3;
  const ribbonMaterial = new THREE.MeshPhysicalNodeMaterial({
    color: new THREE.Color('#ff8fbd'),
    roughness: 0.42,
    clearcoat: 0.6,
    sheen: 0.6,
    sheenColor: new THREE.Color('#ffd6e8'),
  });
  const ribbon = new THREE.Mesh(new THREE.BufferGeometry(), ribbonMaterial);
  const bowGeometry = new THREE.SphereGeometry(1, 24, 16);
  const bowLeft = new THREE.Mesh(bowGeometry, ribbonMaterial);
  const bowRight = new THREE.Mesh(bowGeometry, ribbonMaterial);
  const bowKnot = new THREE.Mesh(bowGeometry, ribbonMaterial);
  jar.add(jarBack, jarFront, ribbon, bowLeft, bowRight, bowKnot);
  scene.add(jar);

  /* ---------- Logo：挤出的 B T R N + 粉色玻璃 O 环（O 也能扔进瓶子） ---------- */
  const letterMaterial = new THREE.MeshPhysicalNodeMaterial({
    color: new THREE.Color('#3d2b6c'),
    roughness: 0.32,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    sheen: 0.45,
    sheenColor: new THREE.Color('#ffb6d8'),
    sheenRoughness: 0.45,
  });
  const logo = new THREE.Group();
  scene.add(logo);
  const letters: Letter[] = [];
  const glyphs = ['B', 'T', 'O', 'R', 'N'];
  const advances = glyphs.map((char) => glyphAdvance(boldFont, char, 1));
  const tracking = 0.02;
  const totalWidth = advances.reduce((sum, value) => sum + value, 0) + tracking * (glyphs.length - 1);
  let cursor = -totalWidth / 2;
  let ringX = 0;
  glyphs.forEach((char, index) => {
    if (char === 'O') {
      ringX = cursor + advances[index] / 2;
    } else {
      const mesh = new THREE.Mesh(extrudeGlyph(boldFont, char, 1, 0.32), letterMaterial);
      const box = new THREE.Box3().setFromObject(mesh);
      mesh.geometry.translate(-(box.min.x + box.max.x) / 2, 0, 0);
      mesh.position.x = cursor + advances[index] / 2;
      logo.add(mesh);
      letters.push({
        mesh,
        hop: 0,
        hopVel: 0,
        spin: 0,
        spinVel: 0,
        scale: options.reducedMotion ? 1 : 0,
        scaleVel: 0,
        delay: 0.35 + index * 0.08,
        hovered: false,
      });
    }
    cursor += advances[index] + tracking;
  });
  const taglineText = flatText(mediumFont, tagline, 1);
  const taglineMesh = new THREE.Mesh(taglineText.geometry, new THREE.MeshBasicNodeMaterial({ color: new THREE.Color('#7a6c9e') }));
  taglineMesh.geometry.translate(-taglineText.width / 2, 0, 0);
  scene.add(taglineMesh);

  /* ---------- 物理世界 ---------- */
  const world = new RAPIER.World({ x: 0, y: -16, z: 0 });
  world.timestep = STEP;
  // 瓶子是一个运动学刚体：点它摇晃的时候碰撞体跟着一起转，瓶里的玩具真的会被晃起来，也不会穿出瓶壁
  let jarRigid: RAPIER.RigidBody | null = null;

  const ringMaterial = frostedGlass('#ff5f9a', { base: '#ffe6ef', roughness: 0.14, thickness: 0.6, attenuation: 0.85, dispersion: 5 });
  const ringObject = new THREE.Group();
  ringObject.add(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.115, 32, 96), ringMaterial));
  scene.add(ringObject);

  const makeBody = () =>
    world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setCcdEnabled(true).setLinearDamping(0.15).setAngularDamping(0.7).setGravityScale(0),
    );

  const makeToy = (kind: Toy['kind'], object: THREE.Object3D, phase: number, delay: number): Toy => ({
    kind,
    object,
    body: makeBody(),
    collider: null,
    home: new THREE.Vector3(),
    mode: 'float',
    since: 0,
    baseScale: 1,
    scale: 1,
    scaleVel: 0,
    targetScale: 1,
    phase,
    delay: options.reducedMotion ? 0 : delay,
    prevPosition: new THREE.Vector3(),
    prevRotation: new THREE.Quaternion(),
  });

  const toys: Toy[] = toyKinds.map((kind, index) => {
    const toy = createToy(kind);
    scene.add(toy.object);
    return makeToy(kind, toy.object, index * 1.37, 0.2 + index * 0.11);
  });
  const ring = makeToy('ring', ringObject, 0.4, 0.6);
  toys.push(ring);
  toys.forEach((toy) => {
    toy.object.traverse((child) => {
      child.userData.toy = toy;
    });
  });
  letters.forEach((letter) => {
    letter.mesh.userData.letter = letter;
  });
  jarFront.userData.jar = true;

  /** 按当前缩放，用网格顶点生成贴合形状的凸包碰撞体 */
  const hullOf = (object: THREE.Object3D, scale: number) => {
    const points: number[] = [];
    const v = new THREE.Vector3();
    object.updateMatrixWorld(true);
    const inverse = new THREE.Matrix4().copy(object.matrixWorld).invert();
    const local = new THREE.Matrix4();
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const position = mesh.geometry.attributes.position;
      local.multiplyMatrices(inverse, mesh.matrixWorld);
      const stride = Math.max(1, Math.floor(position.count / 400));
      for (let index = 0; index < position.count; index += stride) {
        v.fromBufferAttribute(position, index).applyMatrix4(local).multiplyScalar(scale);
        points.push(v.x, v.y, v.z);
      }
    });
    return RAPIER.ColliderDesc.convexHull(new Float32Array(points));
  };

  const rebuildCollider = (toy: Toy, scale: number) => {
    if (toy.collider) world.removeCollider(toy.collider, false);
    toy.object.scale.setScalar(1);
    toy.object.quaternion.identity();
    let desc: RAPIER.ColliderDesc | null;
    if (toy.kind === 'bubble') desc = RAPIER.ColliderDesc.ball(0.42 * scale);
    else if (toy.kind === 'cube') desc = RAPIER.ColliderDesc.roundCuboid(0.26 * scale, 0.26 * scale, 0.26 * scale, 0.1 * scale);
    else desc = hullOf(toy.object, scale);
    desc ??= RAPIER.ColliderDesc.ball(0.45 * scale);
    desc.setRestitution(0.42).setFriction(0.6).setDensity(1);
    toy.collider = world.createCollider(desc, toy.body);
    toy.baseScale = scale;
    const q = toy.body.rotation();
    toy.object.quaternion.set(q.x, q.y, q.z, q.w);
  };

  const rebuildJar = () => {
    const { x, y, z, h, r } = layout.jar;
    const geometry = new THREE.LatheGeometry(jarProfile(r, h), 72);
    jarGeometry.current.dispose();
    jarGeometry.current = geometry;
    jarFront.geometry = geometry;
    jarBack.geometry = geometry;
    ribbon.geometry.dispose();
    ribbon.geometry = new THREE.TorusGeometry(r * 0.715, h * 0.02, 16, 72);
    ribbon.rotation.x = Math.PI / 2;
    ribbon.position.y = h * 0.905;
    const bowY = h * 0.905;
    const bowZ = r * 0.74;
    bowLeft.scale.set(r * 0.17, r * 0.1, r * 0.06);
    bowRight.scale.set(r * 0.17, r * 0.1, r * 0.06);
    bowKnot.scale.set(r * 0.06, r * 0.06, r * 0.05);
    bowLeft.position.set(-r * 0.15, bowY, bowZ);
    bowRight.position.set(r * 0.15, bowY, bowZ);
    bowKnot.position.set(0, bowY, bowZ + r * 0.02);
    bowLeft.rotation.z = 0.45;
    bowRight.rotation.z = -0.45;
    jar.position.set(x, y, z);
    uJarH.value = h;

    // 瓶子本身是固定的三角网格碰撞体，玩具能真的落进去、堆起来
    if (jarRigid) world.removeRigidBody(jarRigid);
    jarRigid = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z));
    const position = geometry.attributes.position;
    const vertices = new Float32Array(position.count * 3);
    for (let index = 0; index < position.count; index += 1) {
      vertices[index * 3] = position.getX(index);
      vertices[index * 3 + 1] = position.getY(index);
      vertices[index * 3 + 2] = position.getZ(index);
    }
    const indices = new Uint32Array(geometry.index!.array);
    world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices).setRestitution(0.25).setFriction(0.5), jarRigid);
  };

  /* ---------- 布局 ---------- */
  let layout = computeLayout(1.6, 1440);
  let view = viewSize(1.6);
  let intro = options.reducedMotion ? 1 : 0;
  const mascotIntro = { offset: options.reducedMotion ? 0 : -1.6, vel: 0 };
  const uCell = uniform(14);
  let firstLayout = true;
  // 按屏幕原生的像素比画，不设上限、不自动降级
  const pixelRatio = window.devicePixelRatio || 1;
  let cssSize = { width: 1, height: 1 };
  let masksNeedFit = true;
  const applyResolution = () => {
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(cssSize.width, cssSize.height, false);
    // 点阵一格的边长（CSS 像素）：5 / 4.5，比原来的 8 / 7 小一圈、密一倍多
    uCell.value = Math.max(4, Math.round((layout.wide ? 5 : 4.5) * pixelRatio));
  };
  let lastSize = '';
  let elapsed = 0;

  /* 瓶子也能拖着走，layout.jar 一直是它此刻的位置。
     jarHome 是布局里的原位，jarShift 记它被拖开了多远（占画面宽高的比例），改窗口大小后还在同一个地方；
     jarTarget 是手指要它去的位置，物理步里一小段一小段挪过去；jarPrev 是上一个物理步的位置，渲染时插值用 */
  const jarHome = new THREE.Vector2();
  const jarShift = new THREE.Vector2();
  const jarTarget = new THREE.Vector2();
  const jarPrev = new THREE.Vector2();
  let jarVelX = 0;
  /** 拖动范围：左右瓶身最多出画面四分之一，往下最多沉一成，瓶口不出画面顶 */
  const clampJar = (target: THREE.Vector2) => {
    const { h, r } = layout.jar;
    const limitX = Math.max(view.width * 0.5 - r * 0.5, Math.abs(jarHome.x));
    target.x = THREE.MathUtils.clamp(target.x, -limitX, limitX);
    target.y = THREE.MathUtils.clamp(target.y, Math.min(jarHome.y, -view.height * 0.5 - h * 0.1), view.height * 0.47 - h);
    return target;
  };

  const setMode = (toy: Toy, mode: Mode) => {
    toy.mode = mode;
    toy.since = elapsed;
    toy.body.setGravityScale(mode === 'jar' ? 1 : 0, true);
    toy.body.setLinearDamping(mode === 'jar' ? 0.05 : 0.15);
  };

  const mascotSource = mascotTexture.image as HTMLImageElement;
  let mascotFitted: THREE.Texture = mascotTexture;
  const fitMascot = () => {
    // 她在屏幕上的物理像素高度（平面在后面，按透视换算）
    const depthScale = (CAMERA_Z - MASCOT_Z) / CAMERA_Z;
    const target = Math.round((layout.mascot.h / depthScale / view.height) * cssSize.height * pixelRatio);
    const height = Math.max(64, Math.min(target, mascotSource.naturalHeight));
    if (mascotFitted !== mascotTexture && Math.abs((mascotFitted.image as { height: number }).height - height) / height < 0.06) return;
    const width = Math.round((height * mascotSource.naturalWidth) / mascotSource.naturalHeight);
    const scaled = document.createElement('canvas');
    scaled.width = width;
    scaled.height = height;
    const ctx = scaled.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(mascotSource, 0, 0, width, height);
    const fitted = new THREE.CanvasTexture(scaled);
    fitted.colorSpace = THREE.SRGBColorSpace;
    fitted.generateMipmaps = false;
    fitted.minFilter = THREE.LinearFilter;
    fitted.magFilter = THREE.LinearFilter;
    const old = mascotFitted;
    mascotFitted = fitted;
    mascotSampler.value = fitted;
    if (old !== mascotTexture) old.dispose();
  };

  const applyLayout = (width: number, height: number) => {
    const sizeKey = `${Math.round(width)}x${Math.round(height)}`;
    if (sizeKey === lastSize) return;
    lastSize = sizeKey;
    const aspect = width / height;
    const oldJar = { ...layout.jar };
    layout = computeLayout(aspect, width);
    view = viewSize(aspect);
    // 瓶子被拖开过的话，按同样的画面比例放回去（新画面里放不下就收进拖动范围）
    jarHome.set(layout.jar.x, layout.jar.y);
    clampJar(jarTarget.set(jarHome.x + jarShift.x * view.width, jarHome.y + jarShift.y * view.height));
    layout.jar.x = jarTarget.x;
    layout.jar.y = jarTarget.y;
    jarPrev.copy(jarTarget);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    uAspect.value = aspect;

    const bg = viewSize(aspect, BG_Z);
    backgroundMesh.scale.set(bg.width * 1.08, bg.height * 1.08, 1);
    mascot.scale.set(layout.mascot.h, layout.mascot.h, 1);
    mascot.position.x = layout.mascot.x;

    const size = layout.logo.size;
    logo.scale.setScalar(size);
    logo.position.set(layout.logo.x, layout.logo.y, 0.06);
    taglineMesh.scale.setScalar(size * 0.17);
    taglineMesh.position.set(layout.tagline.x, layout.tagline.y, 0.06);

    rebuildJar();
    toys.forEach((toy, index) => {
      if (toy.kind === 'ring') {
        toy.home.set(layout.logo.x + ringX * size, layout.logo.y + size * 0.36, 0.06);
        rebuildCollider(toy, size);
      } else {
        // 按深度做透视换算，让玩具落在想要的屏幕位置上
        const [fx, fy, z] = layout.toyHomes[index];
        const k = (CAMERA_Z - z) / CAMERA_Z;
        toy.home.set(fx * view.width * k, fy * view.height * k, z);
        rebuildCollider(toy, layout.toyScale);
      }
      if (firstLayout) {
        const start = toy.home.clone();
        if (!options.reducedMotion) start.y += view.height * 0.9 + index * 0.5;
        toy.body.setTranslation(start, true);
      } else if (toy.mode === 'jar') {
        // 瓶子里的东西跟着瓶子一起换位置，换算成相对坐标再放回去
        const p = toy.body.translation();
        const jar = layout.jar;
        toy.body.setTranslation(
          {
            x: jar.x + ((p.x - oldJar.x) / oldJar.r) * jar.r,
            y: jar.y + ((p.y - oldJar.y) / oldJar.h) * jar.h,
            z: jar.z + ((p.z - oldJar.z) / oldJar.r) * jar.r,
          },
          true,
        );
        toy.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      } else {
        toy.body.setTranslation(toy.home, true);
        toy.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
    });
    firstLayout = false;
    toys.forEach((toy) => {
      const t = toy.body.translation();
      const r = toy.body.rotation();
      toy.prevPosition.set(t.x, t.y, t.z);
      toy.prevRotation.set(r.x, r.y, r.z, r.w);
    });

    cssSize = { width, height };
    applyResolution();
    masksNeedFit = true;
    fitMascot();
  };

  const host = canvas.parentElement ?? canvas;
  applyLayout(host.clientWidth || window.innerWidth, host.clientHeight || window.innerHeight);
  const resizeObserver = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    if (width > 0 && height > 0) applyLayout(width, height);
  });
  resizeObserver.observe(host);

  /* ---------- 裂痕和像素扩散的遮罩：直接在 GPU 上画（见 crackMasks.ts） ---------- */
  // 以前是每帧在 2D 画布上重画再上传，Safari 里裂纹一跑每帧就要吃掉 14ms 主线程；
  // 现在几何体只传一次，每帧只更新每条裂纹跑到了哪，重画几乎不花 CPU
  const crackModel = buildCrackModel();
  const crackState = createCrackState(crackModel);
  const masks = createCrackMasks(renderer, crackModel, crackState);
  let drawnCrack = -1;
  let drawnOpen = -1;
  let drawnSpread = -1;
  const fitMasks = () => {
    masksNeedFit = false;
    masks.resize(cssSize.width, cssSize.height);
    drawnCrack = -1;
    drawnOpen = -1;
    drawnSpread = -1;
  };
  const redrawCracks = (crack: number, open: number) => {
    masks.drawCracks(crack, open);
    drawnCrack = crack;
    drawnOpen = open;
  };
  const redrawSpread = (spread: number) => {
    masks.drawSpread(spread);
    drawnSpread = spread;
  };
  fitMasks();
  redrawCracks(0, 0);
  redrawSpread(0);

  /* ---------- 崩坏后处理（TSL）：方点阵像素入侵 → 人字裂痕 → 一格格碎落成透明 ---------- */
  const uBars = uniform(0);
  const uPixelGate = uniform(0);
  // 闪屏：整屏上下跳帧、左右一抖、亮一下 / 暗一下、反相
  const uRoll = uniform(0);
  const uShake = uniform(0);
  const uFlash = uniform(0);
  const uInvert = uniform(0);
  const uFront = uniform(0);
  const uGlitch = uniform(0);
  // 裂缝两边的反光 / 阴影偏开多少：按 CSS 像素给，乘上设备像素比
  const uDpr = uniform(pixelRatio);
  const uReveal = uniform(0);
  const uBurst = uniform(0);
  const uDissolve = uniform(0);
  // 故障的节拍：每秒跳几下。原来是 11，太急，现在减半
  const uRate = uniform(options.reducedMotion ? 2 : 5.5);

  const scenePass = pass(scene, camera, { samples: 4 });
  const sceneColor = scenePass.getTextureNode('output');
  const crackSampler = texture(masks.crackTexture);
  const spreadSampler = texture(masks.spreadTexture);

  const breakdown = Fn(() => {
    const res = screenSize;
    const aspect = res.x.div(res.y);
    const tick = floor(time.mul(uRate));
    const slow = floor(time.mul(1.1));

    // ⓪ 闪屏：整屏上下跳帧（像电视场同步失调）+ 左右一抖；接缝处有一道黑色消隐条
    const rolledY = fract(screenUV.y.add(uRoll));
    const uv0 = vec2(screenUV.x.add(uShake), rolledY);
    const blanking = float(1).sub(smoothstep(0, 0.02, rolledY)).mul(step(0.001, uRoll));
    const crack = crackSampler.sample(uv0);

    // ① 错位数据条：一段段横条往旁边错开（只错位，不变点阵），从底下往上长
    const reach = float(1).sub(smoothstep(uFront.sub(0.3), uFront, float(1).sub(uv0.y)));
    const segRow = floor(uv0.y.mul(34));
    const segLen = hash2(vec2(segRow, 1.1)).mul(0.12).add(0.035);
    const segId = floor(uv0.x.add(hash2(vec2(segRow, 2.2))).div(segLen));
    const barOn = step(hash2(vec2(segId, segRow.add(slow.mul(0.618)))), uBars.mul(0.18)).mul(reach);
    const barShift = hash2(vec2(segId, segRow.add(5.5))).sub(0.5).mul(0.07).mul(barOn);

    // 故障热度：全局、裂缝周围、数据条里都有；碎落时整屏都在错位
    const heat = clamp(
      uGlitch.mul(0.6).add(crack.g.mul(0.9)).add(uBurst.mul(0.8)).add(barOn.mul(0.7)).add(uDissolve.mul(0.9)),
      0,
      1.6,
    );

    // ② 横向撕裂条：每一拍随机挑几条往左右错开
    const sliceH = float(0.01).add(hash2(vec2(tick, 1.3)).mul(0.05));
    const slice = floor(uv0.y.div(sliceH));
    const sliceOn = step(float(1).sub(heat.mul(0.2).add(uBurst.mul(0.2))), hash2(vec2(slice, tick)));
    const sliceShift = hash2(vec2(slice, tick.add(3.1))).sub(0.5).mul(0.11).mul(sliceOn).mul(heat.min(1.2));
    const sliceMode = hash2(vec2(slice, tick.add(11)));

    // ③ 宏块错位：像视频解码出错那样整块挪走
    const blockId = floor(uv0.mul(vec2(aspect.mul(12), 12)));
    const blockOn = step(
      float(1).sub(heat.mul(0.09).add(uBurst.mul(0.1))),
      hash2(blockId.add(vec2(tick.mul(0.37), slow.mul(1.7)))),
    );
    const blockShift = vec2(hash2(blockId.add(5.1)).sub(0.5).mul(0.07), hash2(blockId.add(9.7)).sub(0.5).mul(0.025)).mul(blockOn);

    // ④ 碎落时整条整条地错开撕走（条的高低不一，位置固定）
    const tear = floor(uv0.y.mul(36).add(sin(uv0.y.mul(13.7)).mul(1.4)));
    const tearRand = hash2(vec2(tear, 4.2));
    const tearShift = hash2(vec2(tear, 8.4)).sub(0.5).mul(0.3).mul(uDissolve.mul(uDissolve));

    const uv1 = uv0
      .add(vec2(sliceShift.add(tearShift).add(barShift), 0))
      .add(blockShift)
      // 被裂纹围住的碎块各自错开一点（错多少写在 B 通道里，碎块是“啪”地一下到位的）
      .add(vec2(0.01, -0.007).mul(crack.b));

    // ⑤ 点阵格子：每格只取一次色
    const fc = uv1.mul(res);
    const cellId = floor(fc.div(uCell));
    const local = fract(fc.div(uCell)).sub(0.5);
    const cUv = cellId.add(0.5).mul(uCell).div(res);
    const zone = crackSampler.sample(cUv).g;
    const spread = spreadSampler.sample(cUv).r;

    // 入侵密度：只从裂缝长出来（闪屏阶段过了一阵才开闸）
    const coarse = floor(cUv.mul(vec2(aspect.mul(26), 26)));
    const threshold = hash2(coarse).mul(0.16).add(0.02);
    const spreadD = smoothstep(threshold, threshold.add(0.4), spread);
    const zoneD = smoothstep(0.1, 0.55, zone);
    const raw = max(spreadD, zoneD).mul(uPixelGate);
    // 入侵前沿的格子慢慢地一闪一闪，不再噼里啪啦
    const front = smoothstep(0.02, 0.25, raw).mul(float(1).sub(smoothstep(0.3, 0.6, raw)));
    const blink = step(0.4, hash2(cellId.add(slow.mul(0.71))));
    const density = raw.mul(mix(float(1), blink, front.mul(0.4)));

    // 数据拖尾：有些行沿用左边那一格的颜色，拉成横向色带
    const row = floor(cellId.y.div(3));
    const streakOn = step(float(1).sub(heat.mul(0.14).add(density.mul(0.08))), hash2(vec2(row, slow.add(2.3))));
    const streakLen = floor(hash2(vec2(row, 7.7)).mul(26).add(8));
    const sampleX = mix(cellId.x, floor(cellId.x.div(streakLen)).mul(streakLen), streakOn);
    const sUv = vec2(sampleX, cellId.y).add(0.5).mul(uCell).div(res);

    // 每格的颜色：红、青两路错开取样
    const splitC = uCell.div(res.x).mul(heat.mul(1.6).add(0.3));
    const cellCol = vec3(
      sceneColor.sample(sUv.add(vec2(splitC, 0))).r,
      sceneColor.sample(sUv).g,
      sceneColor.sample(sUv.sub(vec2(splitC, 0))).b,
    );
    // 墨量用接近 sRGB 的值算（开根号近似）：粉彩背景是中号点，看板娘和字是大点，白的地方是小点
    const cellS = cellCol.max(0).sqrt();
    const lumS = dot(cellS, vec3(0.2126, 0.7152, 0.0722));
    const chromaS = max(max(cellS.r, cellS.g), cellS.b).sub(min(min(cellS.r, cellS.g), cellS.b));
    const ink = clamp(float(1).sub(lumS).mul(1.7).add(chromaS.mul(2.2)), 0, 1);

    // ⑥ 像素是一点点变出来的，点的颜色都来自页面本身：
    //    马赛克（整块原色）→ 半调圆点 → 裂缝附近的点开始发光。
    //    点后面的底色以黑为主：格子一缩成点，底就沉成黑的（只带一丝紫，不是纯 #000）
    const pixelate = smoothstep(0.02, 0.3, density);
    const shrink = smoothstep(0.3, 0.75, density);
    const deep = max(smoothstep(0.75, 1, density), zone.mul(0.85).mul(uPixelGate));
    const linLum = dot(cellCol, vec3(0.2126, 0.7152, 0.0722));
    const vivid = mix(vec3(linLum), cellCol, 1.6).max(0);
    const dotCol = mix(cellCol, vivid.mul(1.08), shrink).mul(float(1).add(deep.mul(0.3)));
    // 点后面是纯黑
    const ground = mix(cellCol.mul(0.6), vec3(0), max(deep, smoothstep(0.05, 0.6, shrink)));
    const twinkle = step(0.975, hash2(cellId.add(tick.mul(0.53)))).mul(shrink);
    // 黑多白少：白、浅的格子只有一成多出点，颜色越浓、越深的格子越容易出点
    const present = mix(float(1), step(hash2(cellId.add(0.5)), ink.mul(0.78).add(0.12)).max(twinkle), shrink);
    const size = mix(float(0.47), mix(float(0.2), float(0.4), ink), shrink);
    const aa = float(1.1).div(uCell);
    // 红、绿、蓝三个子点左右错开：错位越凶，彩边越宽
    const mis = heat.mul(0.15).add(0.03).mul(pixelate);
    const square = (offset: any) =>
      float(1).sub(smoothstep(size.sub(aa), size.add(aa), max(abs(local.x.sub(offset)), abs(local.y))));
    const mask = vec3(square(mis.negate()), square(0), square(mis)).mul(present);
    const halo = exp(dot(local, local).mul(-12)).mul(0.28).mul(present).mul(deep);
    const pixelImage = mix(ground, dotCol.add(vec3(twinkle.mul(0.5))), mask).add(dotCol.mul(halo));

    // 没被侵入的地方：整体红青错位
    const dsplit = heat.mul(0.009).add(uBurst.mul(0.006));
    const direct = vec3(
      sceneColor.sample(uv1.add(vec2(dsplit, 0))).r,
      sceneColor.sample(uv1).g,
      sceneColor.sample(uv1.sub(vec2(dsplit, 0))).b,
    );
    const col = mix(direct, pixelImage, pixelate).toVar();

    // ⑦ 撕裂条里的颜色故障：通道互换、粉紫双色调、宏块色阶断层
    const torn = sliceOn.mul(heat.min(1));
    col.assign(mix(col, col.gbr, torn.mul(step(0.62, sliceMode))));
    const duo = mix(vec3(0.05, 0.015, 0.12), vec3(1, 0.32, 0.62), dot(col, vec3(0.3, 0.55, 0.15)).min(1));
    col.assign(mix(col, duo, torn.mul(step(0.86, sliceMode)).mul(0.85)));
    col.assign(mix(col, floor(col.mul(4).add(0.5)).div(4), blockOn.mul(0.85)));

    // ⑧ 扫描线 + 噪点
    const scan = sin(fc.y.mul(Math.PI)).mul(0.5).add(0.5);
    col.mulAssign(float(1).sub(scan.mul(0.07).mul(heat.min(1).add(pixelate.mul(0.4)))));
    const noise = hash2(fract(uv0.mul(res).mul(0.0137)).add(fract(time.mul(0.731)))).sub(0.5).mul(0.06);
    col.addAssign(vec3(noise.mul(heat.min(1))));

    // ⑨ 裂缝：一两个像素宽的深色断面，左上一侧贴着一道很细的反光、右下一侧一丝阴影（玻璃的“脆”就靠这两道边）；
    //    越裂越开以后芯变透明，直接露出后面的控制台
    const core = crack.r;
    const coreLine = smoothstep(0.06, 0.62, core);
    const px = vec2(uDpr, uDpr).div(res);
    const lit = crackSampler.sample(uv0.sub(px.mul(1.3))).r.sub(core).max(0).min(1);
    const shade = crackSampler.sample(uv0.add(px.mul(1.3))).r.sub(core).max(0).min(1);
    col.assign(mix(col, vec3(0.09, 0.05, 0.16), coreLine));
    col.mulAssign(float(1).sub(shade.mul(0.5)));
    col.addAssign(vec3(0.96, 0.97, 1).mul(lit.mul(1.15)));

    // ⑩ 碎落：一条条错开着撕走，条里的格子再参差着掉；快掉的格子闪一下青色
    const order = tearRand.mul(0.45).add(hash2(cellId.mul(0.37)).mul(0.3)).add(float(1).sub(spread).mul(0.25));
    const gone = step(order, uDissolve);
    const flash = smoothstep(order.sub(0.06), order, uDissolve).mul(float(1).sub(gone));
    col.addAssign(vec3(0.45, 0.95, 1).mul(flash).mul(0.8));

    // ⑪ 闪屏：反相成粉紫双色、整屏一亮 / 一暗、跳帧的消隐黑条
    const lumC = clamp(dot(col, vec3(0.3, 0.55, 0.15)), 0, 1);
    const inverted = mix(vec3(0.05, 0.02, 0.13), vec3(1, 0.55, 0.78), float(1).sub(lumC));
    col.assign(mix(col, inverted, uInvert));
    col.assign(col.mul(float(1).add(uFlash)).add(vec3(uFlash.max(0).mul(0.2))));
    col.mulAssign(float(1).sub(blanking.mul(0.9)));

    const alpha = float(1).sub(gone).mul(float(1).sub(coreLine.mul(uReveal)));
    // 自己转 sRGB 再预乘 alpha，半透明的裂缝边才不会发灰
    return vec4((sRGBTransferOETF(col.max(0)) as any).mul(alpha), alpha);
  });

  const pipeline = new THREE.RenderPipeline(renderer);
  pipeline.outputColorTransform = false;
  pipeline.outputNode = breakdown();
  // 页面还完好的时候（在顶上玩瓶子）走这条最便宜的：只把场景转成 sRGB 输出
  const cleanPipeline = new THREE.RenderPipeline(renderer);
  cleanPipeline.outputColorTransform = false;
  cleanPipeline.outputNode = vec4(sRGBTransferOETF(sceneColor.sample(screenUV).rgb.max(0)) as any, 1);
  const renderFrame = () => (progress > 0.0005 ? pipeline : cleanPipeline).render();

  /* ---------- 指针：拖、扔、戳、拖瓶子、摇瓶子 ---------- */
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pickables: THREE.Object3D[] = [...toys.map((toy) => toy.object), ...letters.map((letter) => letter.mesh), jarFront];
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hitPoint = new THREE.Vector3();
  let drag: {
    toy: Toy;
    target: THREE.Vector3;
    z: number;
    offset: THREE.Vector3;
    last: THREE.Vector3;
    vel: THREE.Vector3;
    time: number;
    moved: number;
    x: number;
    y: number;
    pointerId: number;
  } | null = null;
  // 按住空玻璃拖瓶子：z 是按住的那一点的深度（在这个深度的平面上跟手），offset 是瓶子原点相对那一点的偏移
  let jarDrag: { z: number; offset: THREE.Vector2; moved: number; x: number; y: number; pointerId: number } | null = null;
  let hovered: Toy | null = null;
  let jarWobble = 0;
  let jarWobbleVel = 0;
  let progress = 0;

  const jarTop = () => layout.jar.y + layout.jar.h;
  /** 瓶口正上方：拖到这里会自动对准瓶子的深度，松手就掉进去 */
  const inCatchZone = (p: { x: number; y: number }) =>
    Math.abs(p.x - layout.jar.x) < layout.jar.r * 1.05 && p.y > jarTop() - 0.3 && p.y < jarTop() + 4.5;
  const insideJar = (p: { x: number; y: number; z: number }) =>
    Math.hypot(p.x - layout.jar.x, p.z - layout.jar.z) < layout.jar.r * 1.05 && p.y > layout.jar.y - 0.2 && p.y < jarTop() + 0.6;

  const setNdc = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    uPointer.value.set((event.clientX - rect.left) / rect.width, 1 - (event.clientY - rect.top) / rect.height);
  };

  /** 玩具优先：瓶子里的玩具也能直接拿出来，按到空玻璃才算碰瓶子（jar 是按住的那一点） */
  const pick = () => {
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(pickables, true);
    for (const hit of hits) {
      const toy = hit.object.userData.toy as Toy | undefined;
      const letter = hit.object.userData.letter as Letter | undefined;
      if (toy || letter) return { toy, letter, jar: null };
    }
    return hits.length > 0 ? { toy: undefined, letter: undefined, jar: hits[0].point } : null;
  };

  const shakeJar = () => {
    jarWobbleVel += 6;
    toys.forEach((toy) => {
      if (toy.mode !== 'jar') return;
      const mass = toy.body.mass();
      toy.body.applyImpulse({ x: (Math.random() - 0.5) * 3 * mass, y: (4 + Math.random() * 3) * mass, z: (Math.random() - 0.5) * 2 * mass }, true);
      toy.body.applyTorqueImpulse({ x: (Math.random() - 0.5) * mass, y: (Math.random() - 0.5) * mass, z: (Math.random() - 0.5) * mass }, true);
    });
  };

  const onPointerDown = (event: PointerEvent) => {
    if (progress > 0.3) return;
    setNdc(event);
    const hit = pick();
    if (!hit) return;
    if (hit.letter) {
      hit.letter.hopVel += 4.2;
      hit.letter.spinVel += 14;
      return;
    }
    if (hit.jar) {
      // 先当成拖：松手时没怎么动才算点了一下（摇一摇）
      jarDrag = {
        z: hit.jar.z,
        offset: new THREE.Vector2(layout.jar.x - hit.jar.x, layout.jar.y - hit.jar.y),
        moved: 0,
        x: event.clientX,
        y: event.clientY,
        pointerId: event.pointerId,
      };
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = 'grabbing';
      return;
    }
    if (!hit.toy) return;
    const toy = hit.toy;
    const p = toy.body.translation();
    plane.constant = -p.z;
    raycaster.ray.intersectPlane(plane, hitPoint);
    // 拖的时候还是动态刚体，只是关掉重力、每步把速度对准手指：会被瓶壁和别的玩具挡住，不会穿模
    toy.body.setGravityScale(0, true);
    drag = {
      toy,
      target: new THREE.Vector3(p.x, p.y, p.z),
      z: p.z,
      offset: new THREE.Vector3(p.x, p.y, p.z).sub(hitPoint),
      last: new THREE.Vector3(p.x, p.y, p.z),
      vel: new THREE.Vector3(),
      time: performance.now(),
      moved: 0,
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    };
    // 瓶子里的玩具拿起来不放大，免得蹭进瓶壁
    toy.targetScale = insideJar(p) ? 1 : 1.12;
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
  };

  const onPointerMove = (event: PointerEvent) => {
    setNdc(event);
    if (jarDrag && jarDrag.pointerId === event.pointerId) {
      raycaster.setFromCamera(ndc, camera);
      plane.constant = -jarDrag.z;
      if (raycaster.ray.intersectPlane(plane, hitPoint)) {
        clampJar(jarTarget.set(hitPoint.x + jarDrag.offset.x, hitPoint.y + jarDrag.offset.y));
      }
      jarDrag.moved += Math.hypot(event.clientX - jarDrag.x, event.clientY - jarDrag.y);
      jarDrag.x = event.clientX;
      jarDrag.y = event.clientY;
      return;
    }
    if (drag) {
      raycaster.setFromCamera(ndc, camera);
      plane.constant = -drag.z;
      if (raycaster.ray.intersectPlane(plane, hitPoint)) {
        const target = hitPoint.add(drag.offset);
        target.x = THREE.MathUtils.clamp(target.x, -view.width * 0.55, view.width * 0.55);
        target.y = THREE.MathUtils.clamp(target.y, -view.height * 0.5, view.height * 0.55);
        if (inCatchZone(target)) {
          drag.z += (layout.jar.z - drag.z) * 0.25;
          target.z = drag.z;
        }
        const now = performance.now();
        const dt = Math.max((now - drag.time) / 1000, 1 / 240);
        drag.vel.lerp(target.clone().sub(drag.last).divideScalar(dt), 0.5);
        drag.last.copy(target);
        drag.time = now;
        drag.target.copy(target);
      }
      drag.moved += Math.hypot(event.clientX - drag.x, event.clientY - drag.y);
      drag.x = event.clientX;
      drag.y = event.clientY;
      return;
    }
    if (progress > 0.3) {
      canvas.style.cursor = '';
      return;
    }
    const hit = pick();
    const toy = hit?.toy ?? null;
    if (hovered && hovered !== toy) hovered.targetScale = 1;
    hovered = toy;
    if (toy) toy.targetScale = toy.mode === 'jar' ? 1 : 1.1;
    letters.forEach((letter) => {
      const isHovered = hit?.letter === letter;
      if (isHovered && !letter.hovered) letter.hopVel += 3;
      letter.hovered = isHovered;
    });
    canvas.style.cursor = toy || hit?.jar ? 'grab' : hit?.letter ? 'pointer' : '';
  };

  const release = (event: PointerEvent) => {
    if (jarDrag && jarDrag.pointerId === event.pointerId) {
      // 瓶子松手就停在那儿；没怎么动就是点了一下（被系统取消的不算）
      if (jarDrag.moved < 6 && event.type === 'pointerup') shakeJar();
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor = '';
      jarDrag = null;
      return;
    }
    if (!drag || drag.pointerId !== event.pointerId) return;
    const { toy } = drag;
    toy.targetScale = hovered === toy && toy.mode !== 'jar' ? 1.1 : 1;
    const p = toy.body.translation();
    const mass = toy.body.mass();
    if (drag.moved < 6) {
      // 戳一下：蹦起来转半圈
      toy.body.applyImpulse({ x: 0, y: 5.5 * mass, z: 0 }, true);
      toy.body.applyTorqueImpulse({ x: (Math.random() - 0.5) * 2 * mass, y: (Math.random() - 0.5) * 3 * mass, z: 0 }, true);
      toy.scaleVel -= 7;
      setMode(toy, insideJar(p) ? 'jar' : toy.mode === 'jar' ? 'jar' : 'float');
    } else {
      const v = drag.vel.clampLength(0, 15);
      toy.body.setLinvel(v, true);
      toy.body.setAngvel({ x: -v.y * 0.6, y: v.x * 0.6, z: 0 }, true);
      // 甩出去（够快）或者在瓶口松手，就交给重力；慢慢放下的就浮回原位
      setMode(toy, inCatchZone(p) || insideJar(p) || v.length() > 4 ? 'jar' : 'float');
    }
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    canvas.style.cursor = '';
    drag = null;
  };

  const onPointerLeave = () => {
    if (hovered) hovered.targetScale = 1;
    hovered = null;
    letters.forEach((letter) => {
      letter.hovered = false;
    });
  };

  // 手机上：按住玩具或瓶子时取消这次触摸的页面滚动（pointerdown 先于 touchstart 触发），按在空白处照常滚动
  const onTouchStart = (event: TouchEvent) => {
    if (drag || jarDrag) event.preventDefault();
  };

  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', onPointerLeave);

  /* ---------- 每帧 ---------- */
  let lastProgress = 0;
  let burstValue = 0;
  let nextFlick = 0;
  let flickUntil = 0;
  let lastFlash = -1;
  const flick = { roll: 0, shake: 0, flash: 0, invert: 0 };
  let accumulator = 0;
  let lastCount = -1;
  let last = performance.now();
  const jitter = new THREE.Vector3();
  const interpPosition = new THREE.Vector3();
  const interpRotation = new THREE.Quaternion();
  const qTarget = new THREE.Quaternion();
  const qCurrent = new THREE.Quaternion();
  const euler = new THREE.Euler();

  const physicsStep = () => {
    const J = layout.jar;
    // 瓶子朝手指要它去的位置挪。它是运动学刚体，每步只挪一小段（限速）：
    // 瓶壁和瓶底才推得动里面的玩具，一步跨太远玩具会直接从玻璃里穿出去
    const jx = jarTarget.x - J.x;
    const jy = jarTarget.y - J.y;
    const gap = Math.hypot(jx, jy);
    if (gap > 1e-4) {
      const move = Math.min(gap * 0.24, JAR_SPEED * STEP) / gap;
      J.x += jx * move;
      J.y += jy * move;
      jarVelX = (jx * move) / STEP;
      jarRigid?.setNextKinematicTranslation({ x: J.x, y: J.y, z: J.z });
      jarShift.set((J.x - jarHome.x) / view.width, (J.y - jarHome.y) / view.height);
    } else {
      jarVelX = 0;
    }
    toys.forEach((toy) => {
      if (drag?.toy === toy) {
        const p = toy.body.translation();
        const t = drag.target;
        let vx = (t.x - p.x) * 22;
        let vy = (t.y - p.y) * 22;
        let vz = (t.z - p.z) * 22;
        const speed = Math.hypot(vx, vy, vz);
        if (speed > 28) {
          vx *= 28 / speed;
          vy *= 28 / speed;
          vz *= 28 / speed;
        }
        toy.body.setLinvel({ x: vx, y: vy, z: vz }, true);
        const w = toy.body.angvel();
        toy.body.setAngvel({ x: w.x * 0.9, y: w.y * 0.9, z: w.z * 0.9 }, true);
        return;
      }
      if (elapsed < toy.delay) {
        toy.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        return;
      }
      const p = toy.body.translation();
      const v = toy.body.linvel();
      if (toy.mode === 'float') {
        // 被拖着的瓶子兜住了（在瓶身里、卡在收口的瓶颈里、或者大半个陷在瓶口里）：
        // 就算装进去了，交给重力，别再隔着玻璃往原位拽
        const toyR = toy.baseScale * 0.45;
        const fromJar = Math.hypot(p.x - J.x, p.z - J.z);
        const rise = (p.y - J.y) / J.h;
        const opening = rise < 0.7 ? 0.8 : rise < 0.97 ? 0.62 : 0.77;
        if (rise > 0 && p.y < jarTop() + toyR * 0.6 && fromJar < J.r * opening) {
          setMode(toy, 'jar');
          return;
        }
        // 瓶子被挪到了它的原位上（原位落进玻璃里）：就浮到瓶子前面去，不然会一直顶着玻璃挤
        let homeZ = toy.home.z;
        const reach = J.r + toyR;
        const dx = toy.home.x - J.x;
        if (Math.abs(dx) < reach && toy.home.y > J.y - toyR && toy.home.y < jarTop() + toyR) {
          homeZ = Math.max(homeZ, J.z + Math.sqrt(reach * reach - dx * dx) + 0.05);
        }
        // 位置弹簧：浮回原位，带一点上下呼吸
        const bob = options.reducedMotion ? 0 : Math.sin(elapsed * 1.3 + toy.phase) * 0.07;
        const ax = (toy.home.x - p.x) * 7 - v.x * 3.1;
        const ay = (toy.home.y + bob - p.y) * 7 - v.y * 3.1;
        const az = (homeZ - p.z) * 7 - v.z * 3.1;
        toy.body.setLinvel({ x: v.x + ax * STEP, y: v.y + ay * STEP, z: v.z + az * STEP }, true);
        // 姿态弹簧：慢慢摆回正面朝前，轻轻左右晃
        const sway = options.reducedMotion ? 0 : 1;
        euler.set(
          Math.sin(elapsed * 0.7 + toy.phase) * 0.22 * sway,
          Math.sin(elapsed * 0.5 + toy.phase) * 0.55 * sway,
          Math.sin(elapsed * 0.6 + toy.phase * 2) * 0.12 * sway,
        );
        qTarget.setFromEuler(euler);
        const r = toy.body.rotation();
        qCurrent.set(r.x, r.y, r.z, r.w).invert();
        qTarget.multiply(qCurrent);
        if (qTarget.w < 0) qTarget.set(-qTarget.x, -qTarget.y, -qTarget.z, -qTarget.w);
        const angle = 2 * Math.acos(Math.min(1, qTarget.w));
        const s = Math.sqrt(Math.max(1 - qTarget.w * qTarget.w, 0));
        const w = toy.body.angvel();
        const k = s > 1e-4 ? (angle / s) * 9 : 0;
        toy.body.setAngvel(
          {
            x: w.x + (qTarget.x * k - w.x * 3.4) * STEP,
            y: w.y + (qTarget.y * k - w.y * 3.4) * STEP,
            z: w.z + (qTarget.z * k - w.z * 3.4) * STEP,
          },
          true,
        );
        return;
      }

      // jar 模式：飞出屏幕、或者落在瓶子外面一会儿了，就浮回去
      const offscreen = p.y < -view.height * 0.5 - 1.5 || Math.abs(p.x) > view.width * 0.75 || p.y > view.height * 1.6;
      const nearJar = Math.hypot(p.x - J.x, p.z - J.z) < J.r * 1.3 && p.y > J.y - 0.6 && p.y < jarTop() + 1.2;
      if (offscreen || (!nearJar && elapsed - toy.since > 1.6)) {
        setMode(toy, 'float');
        if (offscreen) {
          // 从屏幕顶上重新掉回原位
          toy.body.setTranslation({ x: toy.home.x, y: view.height * 0.6 + 1, z: toy.home.z }, true);
          toy.body.setLinvel({ x: 0, y: -2, z: 0 }, true);
        }
        return;
      }
      // 飞到瓶口上方时，悄悄对准瓶子的深度、往瓶口中间收一点，扔得准一些
      if (Math.abs(p.x - J.x) < J.r * 1.8 && p.y > jarTop() - 0.2 && p.y < jarTop() + 5) {
        toy.body.setLinvel({ x: v.x + (J.x - p.x) * 1.6 * STEP, y: v.y, z: (J.z - p.z) * 5 }, true);
      }
    });
    world.step();
  };

  const update = (dt: number, force = false) => {
    elapsed += dt;
    const reduce = options.reducedMotion;
    if (!reduce) intro = Math.min(1, intro + dt * 0.9);
    uIntro.value = smooth(0, 1, intro);

    // 阶段：闪屏故障 + 错位数据条 → 人字裂痕 →（隔一段）像素从裂缝里慢慢长出来 → 裂缝透出控制台 → 一条条撕走
    const glitch = smooth(0.02, 0.22, progress) * (1 - 0.35 * smooth(0.62, 0.88, progress));
    const crack = smooth(0.3, 0.74, progress);
    const open = smooth(0.64, 0.84, progress);
    const spread = smooth(0.46, 0.86, progress);
    uBars.value = smooth(0.06, 0.3, progress);
    uFront.value = 1.25 * smooth(0.04, 0.4, progress);
    uPixelGate.value = smooth(0.38, 0.52, progress);
    uGlitch.value = glitch;
    uReveal.value = open;
    uDissolve.value = smooth(0.88, 1, progress);

    // 裂纹：滚动只决定崩到第几下，每一下按时间自己跑完（停下 / 减少动效时直接跳到该在的样子）
    if (masksNeedFit) fitMasks();
    const stepped = stepCracks(crackModel, crackState, crack, dt * 1000, reduce || force);
    const pendingSnap = stepped.snap;
    // 遮罩：裂纹在跑、张开程度变了、故障范围该变宽了才重画（在 GPU 上画，很便宜，所以不再攒着一段才画一次）
    let crackRedrawn = false;
    if (stepped.changed || crack !== drawnCrack || open !== drawnOpen) {
      redrawCracks(crack, open);
      crackRedrawn = stepped.changed || drawnSpread < 0;
    }
    if ((spread > 0 || drawnSpread > 0) && (spread !== drawnSpread || (crackRedrawn && spread > 0))) {
      redrawSpread(spread);
    }

    // 闪屏故障：一阵一阵的，越往下越密，有时连着抽两三下。
    // 亮度类的闪（变亮、变暗、反相）至少隔 0.5 秒，每秒不超过两次，避免光敏不适
    if (!reduce && glitch > 0.03 && elapsed >= nextFlick) {
      flickUntil = elapsed + 0.09 + Math.random() * 0.16;
      burstValue = 0.45 + Math.random() * 0.55;
      flick.roll = Math.random() < 0.38 ? 0.04 + Math.random() * 0.32 : 0;
      flick.shake = (Math.random() - 0.5) * 0.024;
      const canFlash = elapsed - lastFlash > 0.5;
      flick.flash = canFlash && Math.random() < 0.45 ? (Math.random() < 0.65 ? 0.18 + Math.random() * 0.22 : -(0.25 + Math.random() * 0.25)) : 0;
      flick.invert = canFlash && flick.flash === 0 && Math.random() < 0.16 ? 1 : 0;
      if (flick.flash !== 0 || flick.invert) lastFlash = elapsed;
      // 两阵之间隔得更开，连抽也少一些
      nextFlick = elapsed + (Math.random() < 0.2 ? 0.16 + Math.random() * 0.14 : 0.25 - Math.log(1 - Math.random()) / (0.14 + 1.1 * glitch));
    }
    // 崩开的那一下：整屏横着一震、裂纹周围一阵乱（不闪亮度）
    if (pendingSnap > 0) {
      flickUntil = Math.max(flickUntil, elapsed + 0.045 + 0.035 * pendingSnap);
      burstValue = Math.max(0.3, 0.6 * pendingSnap);
      flick.roll = 0;
      flick.shake = (Math.random() < 0.5 ? -1 : 1) * (0.002 + 0.004 * pendingSnap);
      flick.flash = 0;
      flick.invert = 0;
    }
    const flicking = elapsed < flickUntil;
    const burst = flicking ? burstValue : 0;
    uBurst.value = burst;
    uRoll.value = flicking ? flick.roll : 0;
    uShake.value = flicking ? flick.shake : 0;
    uInvert.value = flicking ? flick.invert : 0;
    // 平时还有一点点显像管式的亮度抖动（±1.5%，远低于闪烁标准）
    uFlash.value = flicking ? flick.flash : reduce ? 0 : (Math.random() - 0.5) * 0.03 * glitch;

    // 滚动时漂浮的玩具会被轻轻颠一下
    const kick = THREE.MathUtils.clamp((progress - lastProgress) * 26, -2.4, 2.4);
    lastProgress = progress;
    if (kick !== 0 && !reduce) {
      toys.forEach((toy, index) => {
        if (toy.mode !== 'float' || drag?.toy === toy) return;
        const v = toy.body.linvel();
        toy.body.setLinvel({ x: v.x, y: v.y + kick * (0.6 + (index % 3) * 0.3), z: v.z }, true);
      });
    }

    accumulator = Math.min(accumulator + dt, STEP * 3);
    while (accumulator >= STEP) {
      toys.forEach((toy) => {
        const p = toy.body.translation();
        const q = toy.body.rotation();
        toy.prevPosition.set(p.x, p.y, p.z);
        toy.prevRotation.set(q.x, q.y, q.z, q.w);
      });
      jarPrev.set(layout.jar.x, layout.jar.y);
      physicsStep();
      accumulator -= STEP;
    }
    // 物理固定 60 步/秒，画面跟屏幕走（120Hz 时每两帧才有一次新位置）：按剩下的时间在两步之间插值
    const alpha = accumulator / STEP;

    let count = 0;
    toys.forEach((toy) => {
      const p = toy.body.translation();
      const q = toy.body.rotation();
      if (toy.mode === 'jar' && insideJar(p)) count += 1;
      toy.scaleVel += ((toy.targetScale - toy.scale) * 140 - toy.scaleVel * 12) * dt;
      toy.scale += toy.scaleVel * dt;
      jitter.set(0, 0, 0);
      if (burst > 0) jitter.set((Math.random() - 0.5) * 0.25 * burst, (Math.random() - 0.5) * 0.1 * burst, 0);
      interpPosition.set(p.x, p.y, p.z);
      interpRotation.set(q.x, q.y, q.z, q.w);
      toy.object.position.copy(toy.prevPosition).lerp(interpPosition, alpha).add(jitter);
      toy.object.quaternion.copy(toy.prevRotation).slerp(interpRotation, alpha);
      toy.object.scale.setScalar(Math.max(0.01, toy.scale) * toy.baseScale);
    });
    if (count !== lastCount) {
      lastCount = count;
      options.onJarCount?.(count);
    }

    // 字母：弹出来入场，摸一下跳，点一下转一圈；整个 Logo 轻轻浮着
    letters.forEach((letter) => {
      if (elapsed > letter.delay) {
        letter.scaleVel += ((1 - letter.scale) * 120 - letter.scaleVel * 11) * dt;
        letter.scale += letter.scaleVel * dt;
      }
      letter.hopVel += (-letter.hop * 90 - letter.hopVel * 9) * dt;
      letter.hop += letter.hopVel * dt;
      letter.spinVel *= Math.exp(-dt * 3.2);
      letter.spin += letter.spinVel * dt;
      if (Math.abs(letter.spinVel) < 1.5) letter.spin += (Math.round(letter.spin / (Math.PI * 2)) * Math.PI * 2 - letter.spin) * 4 * dt;
      letter.mesh.position.y = Math.max(0, letter.hop) * 0.6;
      letter.mesh.rotation.y = letter.spin;
      const s = Math.max(0.0001, letter.scale);
      letter.mesh.scale.set(s, s * (1 + Math.min(0, letter.hop) * 0.4), s);
    });
    const drift = reduce ? 0 : Math.sin(elapsed * 1.1) * 0.08;
    logo.position.y = layout.logo.y + drift;
    taglineMesh.position.y = layout.tagline.y + drift;
    ring.home.y = layout.logo.y + layout.logo.size * 0.36 + drift;

    // 瓶子的位置和玩具一样在两个物理步之间插值
    jar.position.set(
      THREE.MathUtils.lerp(jarPrev.x, layout.jar.x, alpha),
      THREE.MathUtils.lerp(jarPrev.y, layout.jar.y, alpha),
      layout.jar.z,
    );
    // 瓶子被点时晃一下；拖着它横着走的时候瓶口往后仰一点（碰撞体跟着转，里面的玩具也会晃）
    if (!reduce) jarWobbleVel += jarVelX * 30 * dt;
    jarWobbleVel += (-jarWobble * 120 - jarWobbleVel * 8) * dt;
    jarWobble += jarWobbleVel * dt;
    jar.rotation.z = jarWobble * 0.035;
    const halfAngle = jar.rotation.z / 2;
    jarRigid?.setNextKinematicRotation({ x: 0, y: 0, z: Math.sin(halfAngle), w: Math.cos(halfAngle) });

    // 看板娘：只有入场和故障时的抖动，其余时间一动不动
    mascotIntro.vel += (-mascotIntro.offset * 40 - mascotIntro.vel * 9) * dt;
    mascotIntro.offset += mascotIntro.vel * dt;
    mascot.position.y = layout.mascot.y + mascotIntro.offset + (burst > 0 ? (Math.random() - 0.5) * 0.08 : 0);
    mascot.position.x = layout.mascot.x + (burst > 0 ? (Math.random() - 0.5) * 0.3 * burst : 0);
  };

  // 两条管线都先渲染一次，把着色器编译掉：不然第一次往下滑时会卡一下
  try {
    pipeline.render();
    cleanPipeline.render();
  } catch (error) {
    console.error('[hero] prewarm failed', error);
  }

  let active = true;
  // 每一帧都画，跟着屏幕的刷新率走（120Hz 的屏幕就是 120 帧），不设上限
  const loop = () => {
    const now = performance.now();
    const gap = now - last;
    const dt = Math.min(gap / 1000, 1 / 30);
    last = now;
    try {
      update(dt);
      renderFrame();
    } catch (error) {
      console.error('[hero] frame failed', error);
    }
  };
  renderer.setAnimationLoop(loop);

  return {
    backend,
    total: toys.length,
    setProgress: (value) => {
      progress = Math.min(Math.max(value, 0), 1);
    },
    setActive: (value) => {
      if (value === active) return;
      active = value;
      last = performance.now();
      // 停着的这段时间进度可能变了很多（比如从页脚直接跳回顶上）：不算作这一帧的滚动
      lastProgress = progress;
      if (!value) {
        // 停下之前按当前进度补渲染一帧，碎落完的画面要真的是透明的
        update(0, true);
        renderFrame();
      }
      // 停着的时候整张画布是透明的：标出来让样式把它藏掉，合成器就不用每帧再混一层全屏透明图
      canvas.dataset.active = String(value);
      renderer.setAnimationLoop(value ? loop : null);
    },
    dispose: () => {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', release);
      canvas.removeEventListener('pointercancel', release);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      disposeObject(scene);
      jarGeometry.current.dispose();
      masks.dispose();
      mascotTexture.dispose();
      environment.dispose();
      pmrem.dispose();
      pipeline.dispose();
      cleanPipeline.dispose();
      world.free();
      renderer.dispose();
    },
  };
}
