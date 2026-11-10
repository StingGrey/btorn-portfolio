import * as THREE from 'three/webgpu';
import { Fn, abs, float, length, max, min, smoothstep, uv, vec2, vec3 } from 'three/tsl';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Font } from 'opentype.js';
import { extrudeGlyph, flatText, glyphAdvance } from './fontGeometry';

export const SCREEN_W = 3;
export const SCREEN_H = 2.25;
export const SCREEN_ASPECT = SCREEN_W / SCREEN_H;
/** 屏幕中心在电视局部坐标里的位置（屏幕四边贴着面板，凹在鼓起来的屏幕框里面） */
export const SCREEN_CENTER = new THREE.Vector3(-0.55, 0.05, 1.332);

/* 机身尺寸：半宽、半高、圆角；外壳前沿、粉色面板、面板四周白边的宽度 */
const BODY_HW = 2.65;
const BODY_HH = 1.8;
const BODY_R = 0.66;
const FRONT_Z = 1.4;
const FACE_Z = 1.32;
const RIM = 0.215;
/** 屏幕框开口的圆角（在屏幕边线上量） */
const SCREEN_R = 0.16;
/** 右侧控制区的中线 */
const COLUMN_X = 1.81;
const DIAL_Y = 0.94;

/* eslint-disable @typescript-eslint/no-explicit-any */
/** 封面式取景：图片铺满 4:3 屏幕，竖图按 focus 往上偏一点留住脸 */
export const coverUv = (p: any, aspect: any, focus: any) => {
  const sx = min(float(1), float(SCREEN_ASPECT).div(aspect));
  const sy = min(float(1), aspect.div(SCREEN_ASPECT));
  const cy = focus.clamp(sy.mul(0.5), float(1).sub(sy.mul(0.5)));
  return vec2(p.x.sub(0.5).mul(sx).add(0.5), p.y.sub(0.5).mul(sy).add(cy));
};

export function plastic(hex: string, roughness = 0.38) {
  return new THREE.MeshPhysicalNodeMaterial({
    color: new THREE.Color(hex),
    roughness,
    metalness: 0,
    clearcoat: 0.8,
    clearcoatRoughness: 0.25,
    sheen: 0.25,
    sheenColor: new THREE.Color('#ffd9ea'),
  });
}

/** 天线杆的电镀金属 */
function chrome() {
  return new THREE.MeshPhysicalNodeMaterial({
    color: new THREE.Color('#ece8f6'),
    roughness: 0.22,
    metalness: 0.92,
    clearcoat: 0.4,
    clearcoatRoughness: 0.2,
  });
}

/** 微微鼓起的 CRT 屏幕 */
export function curvedScreenGeometry() {
  const geometry = new THREE.PlaneGeometry(SCREEN_W, SCREEN_H, 48, 36);
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index) / (SCREEN_W / 2);
    const y = positions.getY(index) / (SCREEN_H / 2);
    positions.setZ(index, 0.13 * (1 - x * x * 0.85) * (1 - y * y * 0.85));
  }
  geometry.computeVertexNormals();
  return geometry;
}

/* ---------- 放样小工具：一圈圈截面沿 z 缝起来 ---------- */

type Ring = { points: number[]; crease?: boolean };
type Cap = { sign: 1 | -1; smooth?: boolean };

/**
 * 把一串点数相同的闭合截面缝成曲面。截面都按逆时针（从 +z 看）排，
 * 路径「沿外壁往 +z 走 → 在顶上往里收 → 再沿内壁往 -z 走」时法线始终朝外，和车削一样。
 * crease：在这一圈把法线断开，得到一道硬棱。
 */
function skin(rings: Ring[], caps: { start?: Cap; end?: Cap } = {}) {
  const positions: number[] = [];
  const indices: number[] = [];
  const count = rings[0].points.length / 3;
  const pushRing = (ring: Ring) => {
    const start = positions.length / 3;
    for (const value of ring.points) positions.push(value);
    return start;
  };
  const fan = (start: number, ring: Ring, sign: 1 | -1) => {
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (let index = 0; index < count; index += 1) {
      cx += ring.points[index * 3];
      cy += ring.points[index * 3 + 1];
      cz += ring.points[index * 3 + 2];
    }
    const center = positions.length / 3;
    positions.push(cx / count, cy / count, cz / count);
    for (let index = 0; index < count; index += 1) {
      const next = (index + 1) % count;
      if (sign > 0) indices.push(center, start + index, start + next);
      else indices.push(center, start + next, start + index);
    }
  };

  let previous = -1;
  rings.forEach((ring, ringIndex) => {
    const start = pushRing(ring);
    if (ringIndex === 0 && caps.start) fan(caps.start.smooth ? start : pushRing(ring), ring, caps.start.sign);
    if (previous >= 0) {
      for (let index = 0; index < count; index += 1) {
        const next = (index + 1) % count;
        indices.push(previous + index, previous + next, start + index, previous + next, start + next, start + index);
      }
    }
    previous = ring.crease ? pushRing(ring) : start;
    if (ringIndex === rings.length - 1 && caps.end) fan(caps.end.smooth ? previous : pushRing(ring), ring, caps.end.sign);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

type Section = { hw: number; hh: number; r: number; z: number; crease?: boolean };

/** 圆角矩形截面的放样：机身、面板、屏幕框、按键都用它 */
function loft(sections: Section[], caps: { start?: Cap; end?: Cap } = {}, corner = 10) {
  const rings = sections.map(({ hw, hh, r, z, crease }) => {
    const radius = Math.max(0.002, Math.min(r, hw, hh));
    const points: number[] = [];
    const centers: [number, number][] = [
      [hw - radius, hh - radius],
      [-(hw - radius), hh - radius],
      [-(hw - radius), -(hh - radius)],
      [hw - radius, -(hh - radius)],
    ];
    centers.forEach(([cx, cy], quadrant) => {
      for (let index = 0; index <= corner; index += 1) {
        const angle = (quadrant + index / corner) * (Math.PI / 2);
        points.push(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, z);
      }
    });
    return { points, crease };
  });
  return skin(rings, caps);
}

type ProfilePoint = { r: number; z: number; crease?: boolean; flute?: number };

/** 绕 z 轴的车削；flutes > 0 时在 flute 权重不为 0 的那几圈上压出一圈防滑齿纹 */
function revolve(profile: ProfilePoint[], segments: number, caps: { start?: Cap; end?: Cap } = {}, flutes = 0, depth = 0) {
  const rings = profile.map(({ r, z, crease, flute = 0 }) => {
    const points: number[] = [];
    for (let index = 0; index < segments; index += 1) {
      const angle = (index / segments) * Math.PI * 2;
      const radius = r * (1 - depth * flute * (0.5 - 0.5 * Math.cos(angle * flutes)));
      points.push(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
    }
    return { points, crease };
  });
  return skin(rings, caps);
}

/**
 * 四分之一圆弧上的点（不含起点、含终点），用来给截面倒圆。
 * lead = 'v'：先沿 v 走、再拐向 u；lead = 'u' 反过来。
 */
function quarter(u0: number, v0: number, u1: number, v1: number, steps: number, lead: 'u' | 'v') {
  const points: [number, number][] = [];
  for (let index = 1; index <= steps; index += 1) {
    const angle = (index / steps) * (Math.PI / 2);
    const sin = Math.sin(angle);
    const cos = 1 - Math.cos(angle);
    points.push(lead === 'v' ? [u0 + (u1 - u0) * cos, v0 + (v1 - v0) * sin] : [u0 + (u1 - u0) * sin, v0 + (v1 - v0) * cos]);
  }
  return points;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ---------- 各个零件的几何体 ---------- */

/** 外壳：后盖 → 显像管的鼓包 → 合模线 → 直身 → 前沿倒圆 → 一圈白边 → 往里凹一级放面板 */
function shellGeometry() {
  const at = (inset: number, z: number, crease = false): Section => ({
    hw: BODY_HW - inset,
    hh: BODY_HH - inset,
    r: Math.max(0.03, BODY_R - inset),
    z,
    crease,
  });
  const back = { hw: 1.4, hh: 1.04, r: 0.44 };
  const sections: Section[] = [{ ...back, z: -1.62 }];
  quarter(0, -1.62, 0.1, -1.52, 5, 'u').forEach(([grow, z]) => {
    sections.push({ hw: back.hw + grow, hh: back.hh + grow, r: back.r + grow, z });
  });
  const steps = 18;
  for (let index = 1; index <= steps; index += 1) {
    const t = index / steps;
    const s = 1 - (1 - t) ** 2.2;
    sections.push({ hw: lerp(1.5, BODY_HW, s), hh: lerp(1.14, BODY_HH, s), r: lerp(0.54, BODY_R, s), z: lerp(-1.52, -0.05, t) });
  }
  sections.push(at(0, 0.02, true), at(0.018, 0.02, true), at(0.018, 0.055, true), at(0, 0.055, true));
  sections.push(at(0, FRONT_Z - 0.17));
  quarter(0, FRONT_Z - 0.17, 0.17, FRONT_Z, 8, 'v').forEach(([inset, z]) => sections.push(at(inset, z)));
  sections.push(at(RIM - 0.022, FRONT_Z));
  quarter(RIM - 0.022, FRONT_Z, RIM, FRONT_Z - 0.022, 4, 'u').forEach(([inset, z]) => sections.push(at(inset, z)));
  sections.push(at(RIM, FACE_Z - 0.05));
  return loft(sections, { start: { sign: -1, smooth: true } }, 12);
}

function facePlateGeometry() {
  const section = { hw: BODY_HW - RIM + 0.002, hh: BODY_HH - RIM + 0.002, r: BODY_R - RIM };
  return loft([{ ...section, z: FACE_Z - 0.06 }, { ...section, z: FACE_Z }], { end: { sign: 1 } }, 12);
}

const screenSection = (outset: number, z: number, crease = false): Section => ({
  hw: SCREEN_W / 2 + outset,
  hh: SCREEN_H / 2 + outset,
  r: SCREEN_R + outset,
  z,
  crease,
});

/** 屏幕外面那圈鼓鼓的白框 */
function bezelGeometry() {
  const sections: Section[] = [screenSection(0.24, FACE_Z - 0.02), screenSection(0.24, FACE_Z + 0.09)];
  quarter(0.24, FACE_Z + 0.09, 0.14, FACE_Z + 0.19, 9, 'v').forEach(([outset, z]) => sections.push(screenSection(outset, z)));
  sections.push(screenSection(0.095, FACE_Z + 0.198));
  quarter(0.095, FACE_Z + 0.198, 0.062, FACE_Z + 0.172, 5, 'u').forEach(([outset, z]) => sections.push(screenSection(outset, z)));
  return loft(sections);
}

/** 白框里面往屏幕斜下去的深色遮罩，下沿压住屏幕四边 */
function maskGeometry() {
  return loft([
    screenSection(0.063, FACE_Z + 0.174),
    screenSection(0.042, FACE_Z + 0.125),
    screenSection(0.012, FACE_Z + 0.066),
    screenSection(-0.024, FACE_Z + 0.014),
    screenSection(-0.05, FACE_Z - 0.02),
  ]);
}

/** 换台旋钮：外翻的裙边、一圈防滑齿纹、倒圆的顶和微微下凹的顶面 */
function knobGeometry() {
  const radius = 0.38;
  const profile: ProfilePoint[] = [
    { r: radius + 0.045, z: 0 },
    { r: radius + 0.04, z: 0.022 },
    { r: radius + 0.014, z: 0.05 },
    { r: radius, z: 0.078, flute: 1 },
    { r: radius, z: 0.19, flute: 1 },
  ];
  quarter(radius, 0.19, radius - 0.055, 0.245, 7, 'v').forEach(([r, z], index) => profile.push({ r, z, flute: 1 - (index + 1) / 7 }));
  profile.push({ r: radius - 0.085, z: 0.241 }, { r: 0.2, z: 0.229 }, { r: 0.09, z: 0.224 }, { r: 0.0005, z: 0.223 });
  return revolve(profile, 176, {}, 22, 0.034);
}

/** 圆顶的小帽子：电源键、天线底座、脚垫 */
function domeGeometry(radius: number, wall: number, height: number, round: number, segments = 48) {
  // 侧壁往上略收一点，再倒圆到顶面
  const shoulder = radius - round * 0.12;
  const top = shoulder - round;
  const profile: ProfilePoint[] = [
    { r: radius, z: 0 },
    { r: shoulder, z: wall },
  ];
  quarter(shoulder, wall, top, height, 7, 'v').forEach(([r, z]) => profile.push({ r, z }));
  profile.push({ r: top * 0.5, z: height + 0.002 }, { r: 0.0005, z: height + 0.003 });
  return revolve(profile, segments);
}

/** 一块很薄的圆角垫片（按键底下的凹槽、喇叭条） */
function plateGeometry(width: number, height: number, radius: number, thickness: number) {
  const section = { hw: width / 2, hh: height / 2, r: radius };
  return loft([{ ...section, z: 0 }, { ...section, z: thickness }], { end: { sign: 1 } }, 6);
}

/** 预设键的键帽：侧面直上去，顶边倒圆 */
function keycapGeometry(width: number, height: number, radius: number) {
  const hw = width / 2;
  const hh = height / 2;
  const sections: Section[] = [
    { hw, hh, r: radius, z: -0.08 },
    { hw, hh, r: radius, z: 0.045 },
  ];
  quarter(0, 0.045, 0.055, 0.1, 6, 'v').forEach(([inset, z]) => sections.push({ hw: hw - inset, hh: hh - inset, r: radius - inset * 0.7, z }));
  return loft(sections, { end: { sign: 1, smooth: true } }, 8);
}

const BUTTON_COLORS = ['#ff9cc2', '#9fd2ff', '#8fe3bf', '#ffe27a'];
const buttonSpot = (index: number) => ({ x: COLUMN_X + (index % 2 ? 0.27 : -0.27), y: 0.1 - Math.floor(index / 2) * 0.41 });
const POWER_ROW_Y = -0.76;

/**
 * 面板上的一层「烘焙」软影：屏幕框、旋钮、按键、电源键各自往右下方落一小圈影子，
 * 面板四周再压一圈很淡的暗边（它本来就凹在白边里面）。一张平面、一次绘制，手机上也不费。
 * 没用实时阴影贴图：试过给主光开 shadowMap，在「场景通道 + MRT 泛光」这条管线下机身上收不到影子。
 */
function faceShadeMaterial() {
  const material = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  const faceHw = BODY_HW - RIM;
  const faceHh = BODY_HH - RIM;
  const shade = Fn(() => {
    const p = uv().sub(0.5).mul(vec2(faceHw * 2, faceHh * 2));
    const box = (cx: number, cy: number, hw: number, hh: number, r: number) => {
      const q = abs(p.sub(vec2(cx, cy))).sub(vec2(hw - r, hh - r));
      return length(q.max(0)).add(max(q.x, q.y).min(0)).sub(r);
    };
    const disc = (cx: number, cy: number, r: number) => length(p.sub(vec2(cx, cy))).sub(r);
    const soft = (distance: any, spread: number, strength: number) => float(1).sub(smoothstep(-0.03, spread, distance)).mul(strength);

    let amount: any = soft(box(SCREEN_CENTER.x + 0.045, SCREEN_CENTER.y - 0.07, SCREEN_W / 2 + 0.24, SCREEN_H / 2 + 0.24, SCREEN_R + 0.24), 0.2, 0.5);
    amount = max(amount, soft(disc(COLUMN_X + 0.035, DIAL_Y - 0.055, 0.41), 0.17, 0.48));
    amount = max(amount, soft(disc(COLUMN_X + 0.27 + 0.02, POWER_ROW_Y - 0.03, 0.19), 0.1, 0.38));
    amount = max(amount, soft(disc(COLUMN_X - 0.27 + 0.012, POWER_ROW_Y - 0.02, 0.1), 0.07, 0.28));
    BUTTON_COLORS.forEach((_, index) => {
      const { x, y } = buttonSpot(index);
      amount = max(amount, soft(box(x + 0.02, y - 0.03, 0.26, 0.19, 0.12), 0.08, 0.3));
    });
    // 凹进白边里的那一圈
    const recess = smoothstep(-0.13, 0.01, box(0, 0, faceHw, faceHh, BODY_R - RIM)).mul(0.26);
    return max(amount, recess);
  });
  material.colorNode = vec3(0.3, 0.1, 0.27);
  material.opacityNode = shade();
  return material;
}

export type TvModel = ReturnType<typeof buildTvModel>;
export type TvPart = 'screen' | 'dial' | 'power' | 'button' | 'body';

/** 从射线打到的物体往上找，它属于电视的哪个零件 */
export function partOf(object: THREE.Object3D | null): { part: TvPart; button: number } | null {
  if (!object) return null;
  let node: THREE.Object3D | null = object;
  while (node) {
    if (typeof node.userData.button === 'number') return { part: 'button', button: node.userData.button as number };
    if (typeof node.userData.part === 'string') return { part: node.userData.part as TvPart, button: -1 };
    node = node.parent;
  }
  return { part: 'body', button: -1 };
}

/**
 * 小 CRT 电视：白色外壳（带显像管鼓包和合模线）、凹进去的粉色面板、鼓鼓的白色屏幕框、
 * 带齿纹的薄荷色旋钮、四个预设键、电源键和指示灯、喇叭条、伸缩天线、四只脚垫。
 * 屏幕的几何体和材质由调用方决定。
 */
export function buildTvModel(font: Font, screenGeometry: THREE.BufferGeometry, screenMaterial: THREE.Material) {
  const shell = plastic('#fdfbff');
  const panel = plastic('#ffd0e3', 0.46);
  const cream = plastic('#fffafc', 0.3);
  const bezel = plastic('#2a2140', 0.42);
  // 屏幕四周的遮罩要压得住画面：比别的塑料更哑、几乎不反光
  const maskMaterial = new THREE.MeshPhysicalNodeMaterial({ color: new THREE.Color('#1d1730'), roughness: 0.7, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.5 });
  const dialMaterial = plastic('#a3e9cc', 0.32);
  const plum = plastic('#4a3878', 0.3);
  const well = plastic('#f4b4cf', 0.5);
  const lilac = plastic('#e4dcf5', 0.45);
  const metal = chrome();
  const pink = plastic('#ff8fbd', 0.3);

  const root = new THREE.Group();
  const tv = new THREE.Group();
  root.add(tv);
  const addMesh = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = tv) => {
    const mesh = new THREE.Mesh(geometry, material);
    parent.add(mesh);
    return mesh;
  };

  /* 机身 */
  const body = addMesh(shellGeometry(), shell);
  const front = addMesh(facePlateGeometry(), panel);
  const faceShade = addMesh(new THREE.PlaneGeometry((BODY_HW - RIM) * 2, (BODY_HH - RIM) * 2), faceShadeMaterial());
  faceShade.position.z = FACE_Z + 0.003;
  faceShade.renderOrder = 1;

  // 两侧的散热格栅：浅浅的淡紫色细槽
  const ventGeometry = new RoundedBoxGeometry(0.03, 0.05, 0.62, 2, 0.012);
  const vents = new THREE.InstancedMesh(ventGeometry, plastic('#cdc2e2', 0.6), 12);
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < 12; index += 1) {
    const side = index < 6 ? -1 : 1;
    matrix.makeTranslation(side * (BODY_HW - 0.009), 0.3 - (index % 6) * 0.12, 0.66);
    vents.setMatrixAt(index, matrix);
  }
  tv.add(vents);

  /* 屏幕：白框 → 深色遮罩 → 屏幕 */
  const frame = addMesh(bezelGeometry(), cream);
  frame.position.set(SCREEN_CENTER.x, SCREEN_CENTER.y, 0);
  const mask = addMesh(maskGeometry(), maskMaterial);
  mask.position.copy(frame.position);
  const screen = addMesh(screenGeometry, screenMaterial);
  screen.position.copy(SCREEN_CENTER);
  screen.userData.part = 'screen';

  // 屏幕下面的小铭牌：BT·O·RN，O 是粉色的
  const badge = new THREE.Group();
  const badgeSize = 0.15;
  const glyphs = ['B', 'T', 'O', 'R', 'N'];
  const tracking = 0.012;
  const advances = glyphs.map((char) => glyphAdvance(font, char, badgeSize));
  let cursor = -(advances.reduce((sum, value) => sum + value, 0) + tracking * (glyphs.length - 1)) / 2;
  glyphs.forEach((char, index) => {
    const letter = addMesh(extrudeGlyph(font, char, badgeSize, 0.03), char === 'O' ? pink : plum, badge);
    letter.position.x = cursor;
    cursor += advances[index] + tracking;
  });
  badge.position.set(SCREEN_CENTER.x, -1.502, FACE_Z + 0.012);
  tv.add(badge);

  /* 换台旋钮 */
  const dial = new THREE.Group();
  dial.position.set(COLUMN_X, DIAL_Y, FACE_Z);
  dial.userData.part = 'dial';
  tv.add(dial);
  addMesh(knobGeometry(), dialMaterial, dial);
  const pointer = addMesh(new RoundedBoxGeometry(0.07, 0.2, 0.04, 3, 0.02), plum, dial);
  pointer.position.set(0, 0.2, 0.236);
  // 旋钮外面一圈刻度：四个台位是大点，中间各夹两个小点
  const tickGeometry = new THREE.SphereGeometry(1, 16, 10);
  const ticks = new THREE.InstancedMesh(tickGeometry, plum, 4);
  const minorTicks = new THREE.InstancedMesh(tickGeometry, well, 8);
  const scale = new THREE.Vector3();
  const noRotation = new THREE.Quaternion();
  const place = new THREE.Vector3();
  let major = 0;
  let minor = 0;
  for (let index = 0; index < 12; index += 1) {
    const angle = Math.PI / 2 - (index * Math.PI) / 6;
    const isMajor = index % 3 === 0;
    const size = isMajor ? 0.034 : 0.02;
    place.set(COLUMN_X + Math.cos(angle) * 0.5, DIAL_Y + Math.sin(angle) * 0.5, FACE_Z);
    matrix.compose(place, noRotation, scale.set(size, size, size * 0.6));
    if (isMajor) ticks.setMatrixAt(major++, matrix);
    else minorTicks.setMatrixAt(minor++, matrix);
  }
  tv.add(ticks, minorTicks);

  /* 四个预设键，各自坐在一块浅凹槽里 */
  const keyGeometry = keycapGeometry(0.44, 0.3, 0.09);
  const wellGeometry = plateGeometry(0.52, 0.38, 0.12, 0.012);
  const baseZ = FACE_Z + 0.075;
  const buttons = BUTTON_COLORS.map((hex, index) => {
    const { x, y } = buttonSpot(index);
    const socket = addMesh(wellGeometry, well);
    socket.position.set(x, y, FACE_Z);
    const mesh = addMesh(keyGeometry, plastic(hex, 0.3));
    mesh.position.set(x, y, baseZ);
    const label = flatText(font, String(index + 1), 0.17);
    label.geometry.translate(-label.width / 2, -0.06, 0);
    const labelMesh = new THREE.Mesh(label.geometry, plum);
    labelMesh.position.z = 0.103;
    mesh.add(labelMesh);
    mesh.userData.button = index;
    return { mesh, depth: 0, vel: 0, baseZ };
  });

  /* 电源键 + 指示灯 */
  const rowY = POWER_ROW_Y;
  const power = new THREE.Group();
  power.position.set(COLUMN_X + 0.27, rowY, FACE_Z);
  power.userData.part = 'power';
  tv.add(power);
  addMesh(new THREE.TorusGeometry(0.175, 0.026, 12, 48), well, power).position.z = 0.004;
  const powerCap = addMesh(domeGeometry(0.15, 0.05, 0.095, 0.045), cream, power);
  // 键帽上的电源符号：缺口朝上的圆环 + 一小竖
  const iconRing = addMesh(new THREE.TorusGeometry(0.052, 0.011, 8, 32, Math.PI * 1.55), pink, power);
  iconRing.rotation.z = Math.PI / 2 + (Math.PI * 0.45) / 2;
  iconRing.position.z = 0.097;
  const iconBar = addMesh(new RoundedBoxGeometry(0.022, 0.07, 0.02, 2, 0.01), pink, power);
  iconBar.position.set(0, 0.042, 0.097);

  addMesh(new THREE.TorusGeometry(0.082, 0.022, 12, 40), cream).position.set(COLUMN_X - 0.27, rowY, FACE_Z + 0.006);
  const ledMaterial = new THREE.MeshBasicNodeMaterial({ color: new THREE.Color('#ff5f7a') });
  const led = addMesh(new THREE.SphereGeometry(0.062, 20, 14), ledMaterial);
  led.scale.z = 0.7;
  led.position.set(COLUMN_X - 0.27, rowY, FACE_Z + 0.012);

  /* 喇叭：四道圆头的深色细槽 */
  const slotGeometry = plateGeometry(0.74, 0.046, 0.023, 0.008);
  const grille = new THREE.InstancedMesh(slotGeometry, bezel, 4);
  for (let index = 0; index < 4; index += 1) {
    matrix.makeTranslation(COLUMN_X, -1.1 - index * 0.092, FACE_Z);
    grille.setMatrixAt(index, matrix);
  }
  tv.add(grille);

  /* 四只圆脚垫 */
  const footGeometry = domeGeometry(0.3, 0.13, 0.21, 0.07).rotateX(Math.PI / 2);
  [-1.62, 1.62].forEach((x) => {
    [0.98, 0.2].forEach((z) => {
      addMesh(footGeometry, lilac).position.set(x, -BODY_HH + 0.012, z);
    });
  });

  /* 伸缩天线：圆顶底座 + 两根三节的电镀杆 + 彩色小球 */
  const antennaBase = addMesh(domeGeometry(0.3, 0.04, 0.17, 0.2).rotateX(-Math.PI / 2), lilac);
  antennaBase.position.set(0.62, BODY_HH - 0.012, 0.42);
  const pivotY = BODY_HH + 0.12;
  const segments = [
    { length: 0.74, radius: 0.034 },
    { length: 0.62, radius: 0.026 },
    { length: 0.5, radius: 0.019 },
  ];
  const rods = [
    { tip: '#ff9cc2', rest: 0.46 },
    { tip: '#9fd2ff', rest: -0.42 },
  ].map(({ tip, rest }) => {
    const pivot = new THREE.Group();
    pivot.position.set(antennaBase.position.x, pivotY, antennaBase.position.z);
    tv.add(pivot);
    addMesh(new THREE.SphereGeometry(0.06, 20, 14), metal, pivot);
    let y = 0;
    segments.forEach(({ length, radius }, index) => {
      const rod = addMesh(new THREE.CylinderGeometry(radius, radius, length, 16), metal, pivot);
      rod.position.y = y + length / 2;
      y += length;
      if (index < segments.length - 1) {
        // 每一节顶上有一圈收口的小环
        addMesh(new THREE.CylinderGeometry(radius + 0.006, radius + 0.009, 0.05, 16), metal, pivot).position.y = y - 0.02;
      }
    });
    const ball = addMesh(new THREE.SphereGeometry(0.1, 24, 16), plastic(tip, 0.3), pivot);
    ball.position.y = y + 0.07;
    pivot.rotation.set(-0.1, 0, rest);
    return { pivot, rest, angle: 0, vel: 0 };
  });

  /* 桌面上的一团软影子 */
  const shadowMaterial = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  const falloff = Fn(() => {
    const d = length(uv().sub(0.5).mul(vec2(1, 1.7)));
    return float(1).sub(smoothstep(0.04, 0.5, d)).mul(0.46);
  });
  shadowMaterial.colorNode = vec3(0.42, 0.3, 0.5);
  shadowMaterial.opacityNode = falloff();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 4.2), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, -BODY_HH - 0.21, -0.1);
  root.add(shadow);

  return { root, tv, body, front, frame, mask, screen, dial, buttons, power, powerCap, led, ledMaterial, rods, bezel, shadow };
}

export function disposeObject(object: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    const material = mesh.material as THREE.Material | THREE.Material[];
    (Array.isArray(material) ? material : [material]).forEach((item) => materials.add(item));
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}
