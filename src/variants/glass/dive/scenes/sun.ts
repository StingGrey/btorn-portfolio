// 太阳和地球：银河系边上一团气体和尘埃塌缩、越转越快，中间点亮成太阳，周围留下一圈尘埃盘；
// 盘里的尘埃先聚成一圈圈的环、再聚成一颗颗行星，第三颗是地球。镜头跟着地球一直放大到整颗星球（那时候还是一团岩浆），
// 时间一跳四十五亿年：今天的地球，上面有一个粉色的点是「你」。地球的画法 drawGlobe 在最后拉远时也用。

import { G, gi, lineGlyph } from '../charset';
import { BG, clamp01, clock, colOf, hash1, hash2, lerp, noise2, noise3, plot, put, rowOf, smooth, tint, walk, type Grid } from '../grid';
import { callout, status, type Rgb } from '../notes';
import { PINK, ball, bump, glow, ringAt } from './shapes';

/** 今天那颗地球在屏幕上的半径：拉远那一段从这里接着往外拉（地球直径 12,742 km，屏幕高 22,400 km） */
export const EARTH_R = 6.371e6 / 10 ** 7.35;
/** 地球转到哪个经度朝着我们（固定，「你在这」那个粉点才待得住） */
export const EARTH_SPIN = 2.1;

/* ====================== 地球 ====================== */

const OCEAN: Rgb = [30, 84, 196];
const LAND: Rgb = [70, 150, 82];
const DESERT: Rgb = [196, 164, 104];
const ICE: Rgb = [232, 240, 255];
const CRUST: Rgb = [70, 32, 28];
const LAVA: Rgb = [255, 118, 40];
const OUT: Rgb = [0, 0, 0];

/*
 * 地球的地图：经纬度 → 陆地（三层噪声叠出曲折的海岸线）、干湿、云、冰。第一次要用时一行行算好存起来，之后每帧只是查表。
 * 存的是「还没取阈值」的值，查表插值以后再取阈值：海岸线怎么放大都是圆滑的，不会糊也不会长台阶。
 */
const MAP_W = 384;
const MAP_H = 192;
const landMap = new Float32Array(MAP_W * MAP_H);
const dryMap = new Float32Array(MAP_W * MAP_H);
const cloudMap = new Float32Array(MAP_W * MAP_H);
const iceMap = new Float32Array(MAP_W * MAP_H);
let mapRow = 0;

/** 在 budget 毫秒内能算几行算几行；全部算完返回 true */
export function prepareEarth(budget = Infinity) {
  const start = performance.now();
  for (; mapRow < MAP_H; mapRow += 1) {
    if (performance.now() - start > budget) return false;
    const lat = (0.5 - (mapRow + 0.5) / MAP_H) * Math.PI;
    const y = Math.sin(lat);
    const cl = Math.cos(lat);
    for (let i = 0; i < MAP_W; i += 1) {
      const lon = ((i + 0.5) / MAP_W - 0.5) * 2 * Math.PI;
      const x = cl * Math.cos(lon);
      const z = cl * Math.sin(lon);
      const o = mapRow * MAP_W + i;
      // 大陆的大样子和原来那一层一样（「你」还在原来那块陆地上），再叠两层更细的
      landMap[o] = noise3(x * 2.1 + 4, y * 2.1 + 1, z * 2.1 - 3) + 0.2 * (noise3(x * 5.3 - 8, y * 5.3 + 2, z * 5.3 + 6) - 0.5) + 0.09 * (noise3(x * 12 + 1, y * 12 - 4, z * 12 + 3) - 0.5);
      // 沙漠多在南北回归线附近
      const belt = Math.exp(-(((Math.abs(lat) - 0.42) / 0.16) ** 2));
      dryMap[o] = noise3(x * 4 + 9, y * 4, z * 4 - 5) + 0.25 * (noise3(x * 9, y * 9 + 3, z * 9) - 0.5) + 0.22 * belt - 0.08;
      // 云：东西向拉长一点，一团团带着丝
      cloudMap[o] = noise3(x * 3.4 - 2, y * 3.4 + 9, z * 3.4 + 1) + 0.3 * (noise3(x * 7, y * 13 + 5, z * 7 - 2) - 0.5) + 0.14 * (noise3(x * 17 + 4, y * 26, z * 17) - 0.5);
      iceMap[o] = Math.abs(y) + 0.05 * (noise3(x * 6 + 2, y * 6, z * 6 + 8) - 0.5);
    }
  }
  return true;
}

let mapU = 0;
let mapV = 0;
/** 先算好这一点在地图上的位置（一次 atan2 / asin，给四张图共用） */
function mapAt(x: number, y: number, z: number) {
  mapU = (Math.atan2(z, x) / (2 * Math.PI) + 0.5) * MAP_W - 0.5;
  mapV = (0.5 - Math.asin(Math.max(-1, Math.min(1, y))) / Math.PI) * MAP_H - 0.5;
}
/** 双线性查表（经度方向首尾相接） */
function look(map: Float32Array) {
  const u0 = Math.floor(mapU);
  const v0 = Math.max(0, Math.min(MAP_H - 2, Math.floor(mapV)));
  const fu = mapU - u0;
  const fv = Math.max(0, Math.min(1, mapV - v0));
  const a0 = ((u0 % MAP_W) + MAP_W) % MAP_W;
  const a1 = (a0 + 1) % MAP_W;
  const r0 = v0 * MAP_W;
  const r1 = r0 + MAP_W;
  const top = map[r0 + a0] + (map[r0 + a1] - map[r0 + a0]) * fu;
  const bottom = map[r1 + a0] + (map[r1 + a1] - map[r1 + a0]) * fu;
  return top + (bottom - top) * fv;
}

/**
 * 球面上一点 (x, y, z)（转过 spin 以后）是什么颜色：modern 0 = 刚形成时一团岩浆，1 = 今天；
 * light 是朝着太阳的程度，glint 是海面反光，night 是夜里的那一面（城市的灯）
 */
function surface(x: number, y: number, z: number, modern: number, light: number, glint: number, night: number) {
  mapAt(x, y, z);
  const n = look(landMap);
  const land = smooth(0.555, 0.575, n);
  const dry = smooth(0.47, 0.6, look(dryMap));
  const ice = smooth(0.83, 0.86, look(iceMap));
  // 海：近岸浅一点
  const shallow = smooth(0.5, 0.56, n);
  let r = lerp(OCEAN[0], 48, shallow * 0.6);
  let gr = lerp(OCEAN[1], 120, shallow * 0.6);
  let b = lerp(OCEAN[2], 200, shallow * 0.6);
  // 陆地：绿的、黄的，高一点的地方暗一点
  const high = smooth(0.62, 0.75, n) * 0.25;
  r = lerp(r, lerp(LAND[0], DESERT[0], dry) * (1 - high), land);
  gr = lerp(gr, lerp(LAND[1], DESERT[1], dry) * (1 - high), land);
  b = lerp(b, lerp(LAND[2], DESERT[2], dry) * (1 - high), land);
  r = lerp(r, ICE[0], ice);
  gr = lerp(gr, ICE[1], ice);
  b = lerp(b, ICE[2], ice);
  const cloud = smooth(0.58, 0.72, look(cloudMap)) * 0.9;
  r = lerp(r, 255, cloud);
  gr = lerp(gr, 255, cloud);
  b = lerp(b, 255, cloud);
  // 白天那面亮、晚上那面暗；海面上太阳的倒影
  const sea = (1 - land) * (1 - ice) * (1 - cloud);
  r = r * light + 255 * glint * sea;
  gr = gr * light + 240 * glint * sea;
  b = b * light + 210 * glint * sea;
  // 夜里那面：陆地上星星点点的城市灯光
  if (night > 0.02 && land > 0.5 && cloud < 0.4) {
    const city = smooth(0.87, 0.98, hash2(Math.floor(mapU * 2), Math.floor(mapV * 2))) * smooth(0.25, 0.7, night) * (1 - ice);
    r += 255 * city * 0.65;
    gr += 190 * city * 0.65;
    b += 110 * city * 0.65;
  }
  if (modern < 1) {
    // 那时候：暗红的壳上裂着发光的岩浆（自己发光，不管哪边朝着太阳）
    const crack = (1 - Math.abs(2 * n - 1)) ** 6;
    const yr = CRUST[0] * light + LAVA[0] * crack;
    const yg = CRUST[1] * light + LAVA[1] * crack;
    const yb = CRUST[2] * light + LAVA[2] * crack;
    r = lerp(yr, r, modern);
    gr = lerp(yg, gr, modern);
    b = lerp(yb, b, modern);
  }
  OUT[0] = r;
  OUT[1] = gr;
  OUT[2] = b;
  return OUT;
}

/** 太阳从左上前方照过来 */
const SUN_DIR = (() => {
  const v = [-0.55, 0.45, 0.7];
  const l = Math.hypot(v[0], v[1], v[2]);
  return v.map((c) => c / l);
})();
/** 太阳的倒影：光和视线（朝着我们）的半程向量 */
const HALF = (() => {
  const v = [SUN_DIR[0], SUN_DIR[1], SUN_DIR[2] + 1];
  const l = Math.hypot(v[0], v[1], v[2]);
  return v.map((c) => c / l);
})();

/**
 * 一颗地球：中心在屏幕 (cx, cy)，半径 R；太阳从左上照过来，外面一圈淡淡的大气。
 * 一格切成上下两个方像素（▀：字色画上半、底色画下半），竖着的分辨率翻倍；球的边按覆盖多少和背景混，不长锯齿。
 */
export function drawGlobe(g: Grid, cx: number, cy: number, R: number, modern: number, show: number) {
  if (show < 0.03) return;
  if (R < g.ch * 1.2) {
    const tone = modern > 0.5 ? [110, 175, 255] : [255, 130, 70];
    plot(g, cx, cy, G.disc, tone[0] * show, tone[1] * show, tone[2] * show);
    return;
  }
  prepareEarth();
  const c0 = Math.max(0, colOf(g, cx - R * 1.2));
  const c1 = Math.min(g.cols - 1, colOf(g, cx + R * 1.2));
  const r0 = Math.max(0, rowOf(g, cy + R * 1.1));
  const r1 = Math.min(g.rows - 1, rowOf(g, cy - R * 1.1));
  const cs = Math.cos(EARTH_SPIN);
  const ss = Math.sin(EARTH_SPIN);
  // 一个方像素有多大（以半径为单位）：边缘抗锯齿用
  const px = g.ch / 2 / R;
  for (let row = r0; row <= r1; row += 1) {
    for (let col = c0; col <= c1; col += 1) {
      const i = row * g.cols + col;
      const o = i * 4;
      const dx = (g.ox[col] - cx) / (R * 1.1);
      const br = g.bg[o];
      const bgg = g.bg[o + 1];
      const bb = g.bg[o + 2];
      let hit = false;
      let tr = br;
      let tg = bgg;
      let tb = bb;
      let ur = br;
      let ug = bgg;
      let ub = bb;
      let haloTop = 0;
      let haloBottom = 0;
      for (let half = 0; half < 2; half += 1) {
        const dy = (g.oy[row] + (half === 0 ? 0.25 : -0.25) * g.ch - cy) / R;
        const d2 = dx * dx + dy * dy;
        const d = Math.sqrt(d2);
        const cover = clamp01((1 - d) / px + 0.5);
        // 大气：球外面一圈蓝，朝着太阳的那边亮、背着的那边几乎看不见
        if (d > 1 - px && d < 1.14 && modern > 0) {
          const side = clamp01(0.3 + 0.9 * ((dx * SUN_DIR[0] + dy * SUN_DIR[1]) / d));
          const a = (1 - smooth(1, 1.14, d)) ** 2 * side * modern * show * (1 - cover);
          if (half === 0) haloTop = a;
          else haloBottom = a;
        }
        if (cover <= 0) continue;
        hit = true;
        const dz = Math.sqrt(Math.max(0, 1 - Math.min(1, d2)));
        const sun = dx * SUN_DIR[0] + dy * SUN_DIR[1] + dz * SUN_DIR[2];
        const light = 0.06 + 0.94 * smooth(-0.08, 0.35, sun) * (0.35 + 0.65 * clamp01(sun * 1.3));
        const glint = clamp01(dx * HALF[0] + dy * HALF[1] + dz * HALF[2]) ** 60 * 0.75 * modern;
        const night = (1 - smooth(-0.12, 0.05, sun)) * modern;
        const x = dx * cs + dz * ss;
        const z = -dx * ss + dz * cs;
        const c = surface(x, dy, z, modern, light, glint, night);
        // 大气：朝着太阳那一边的球边上一层薄薄的蓝
        const rim = (1 - dz) ** 3 * modern * clamp01(sun * 2 + 0.3);
        const pr = lerp(c[0], 120, rim * 0.6) * show;
        const pg = lerp(c[1], 175, rim * 0.6) * show;
        const pb = lerp(c[2], 255, rim * 0.6) * show;
        if (half === 0) {
          tr = br + (pr - br) * cover;
          tg = bgg + (pg - bgg) * cover;
          tb = bb + (pb - bb) * cover;
        } else {
          ur = br + (pr - br) * cover;
          ug = bgg + (pg - bgg) * cover;
          ub = bb + (pb - bb) * cover;
        }
      }
      if (!hit && haloTop + haloBottom < 0.01) continue;
      put(g, i, G.top, tr + 60 * haloTop, tg + 120 * haloTop, tb + 230 * haloTop);
      tint(g, i, ur + 60 * haloBottom, ug + 120 * haloBottom, ub + 230 * haloBottom);
    }
  }
}

/** 今天的地球上「你」在哪（单位球面上朝着我们的那一面，一块陆地上） */
let you: [number, number] | null = null;
export function youOnGlobe(): [number, number] {
  if (you) return you;
  prepareEarth();
  const cs = Math.cos(EARTH_SPIN);
  const ss = Math.sin(EARTH_SPIN);
  let best = Infinity;
  you = [-0.2, 0.2];
  for (let j = -12; j <= 12; j += 1) {
    for (let i = -12; i <= 12; i += 1) {
      const dx = i * 0.05;
      const dy = j * 0.05;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0.5) continue;
      const dz = Math.sqrt(1 - d2);
      const x = dx * cs + dz * ss;
      const z = -dx * ss + dz * cs;
      mapAt(x, dy, z);
      // 要在陆地正中一点（离海岸远一点），不在云底下
      if (look(landMap) < 0.6 || look(cloudMap) > 0.56 || look(iceMap) > 0.7) continue;
      const score = Math.hypot(dx + 0.2, dy - 0.15);
      if (score < best) {
        best = score;
        you = [dx, dy];
      }
    }
  }
  return you;
}

/* ====================== 太阳、尘埃盘、行星 ====================== */

type Planet = { name: string; r: number; color: Rgb; big: boolean; phase: number };
const PLANETS: Planet[] = [
  { name: 'Mercury', r: 0.07, color: [175, 168, 160], big: false, phase: 0.4 },
  { name: 'Venus', r: 0.1, color: [240, 214, 160], big: false, phase: 2.2 },
  { name: 'Earth', r: 0.135, color: [100, 170, 255], big: false, phase: 3.9 },
  { name: 'Mars', r: 0.172, color: [235, 115, 75], big: false, phase: 5.1 },
  { name: 'Jupiter', r: 0.245, color: [232, 196, 150], big: true, phase: 1.2 },
  { name: 'Saturn', r: 0.315, color: [240, 220, 160], big: true, phase: 4.4 },
  { name: 'Uranus', r: 0.385, color: [160, 232, 240], big: false, phase: 0.1 },
  { name: 'Neptune', r: 0.44, color: [110, 150, 255], big: false, phase: 2.9 },
];
/** 盘和轨道是斜着看的：上下压扁 */
const TILT = 0.32;
/** 示意图里地球的真实半径（轨道半径不按比例）：放大到最后正好是 EARTH_R */
const ZOOM_MAX = 15.6;
const EARTH_TRUE = EARTH_R / 2 ** ZOOM_MAX;

let wx0 = 0;
let wy0 = 0;
/** 第 k 颗行星在 tau 时刻的位置（离太阳越近转得越快） */
function planetAt(k: number, tau: number) {
  const p = PLANETS[k];
  const a = p.phase + tau * 0.9 * (0.135 / p.r) ** 1.5;
  wx0 = p.r * 1.1 * Math.cos(a);
  wy0 = p.r * TILT * Math.sin(a);
}

/**
 * 太阳：一个像素圆盘（▀ 切成上下两个方像素），中间白热、边上暗一点偏橙（临边昏暗），表面有一点点米粒组织在翻；
 * 外面往底色上晕一大圈光。r 是屏幕上的半径
 */
function sunDisc(g: Grid, x: number, y: number, r: number, core: number, ignite: number, time: number) {
  const reach = r * 4;
  const c0 = Math.max(0, colOf(g, x - reach * 1.1));
  const c1 = Math.min(g.cols - 1, colOf(g, x + reach * 1.1));
  const r0 = Math.max(0, rowOf(g, y + reach));
  const r1 = Math.min(g.rows - 1, rowOf(g, y - reach));
  const px = g.ch / 2 / r;
  const boil = time * 0.6;
  for (let row = r0; row <= r1; row += 1) {
    for (let col = c0; col <= c1; col += 1) {
      const i = row * g.cols + col;
      const o = i * 4;
      const dx = (g.ox[col] - x) / (r * 1.1);
      const br = g.bg[o];
      const bgg = g.bg[o + 1];
      const bb = g.bg[o + 2];
      let hit = false;
      let tr = br;
      let tg = bgg;
      let tb = bb;
      let ur = br;
      let ug = bgg;
      let ub = bb;
      for (let half = 0; half < 2; half += 1) {
        const dy = (g.oy[row] + (half === 0 ? 0.25 : -0.25) * g.ch - y) / r;
        const d = Math.sqrt(dx * dx + dy * dy);
        const cover = clamp01((1 - d) / px + 0.5);
        if (cover <= 0) continue;
        hit = true;
        const mu = Math.sqrt(Math.max(0, 1 - Math.min(1, d * d)));
        const limb = 0.45 + 0.55 * mu;
        const grain = 0.92 + 0.16 * noise2(dx * 9 + boil, dy * 9 - boil * 0.7);
        // 发光是往上加的：还没点着、很暗的时候也不会在云里挖出一个黑洞
        const k = core * limb * grain * cover;
        const pr = 255 * Math.min(1, k * 1.15);
        const pg = (lerp(150, 236, mu) + 20 * ignite) * k;
        const pb = (lerp(60, 190, mu * mu) + 40 * ignite) * k;
        if (half === 0) {
          tr = Math.min(255, br + pr);
          tg = Math.min(255, bgg + pg);
          tb = Math.min(255, bb + pb);
        } else {
          ur = Math.min(255, br + pr);
          ug = Math.min(255, bgg + pg);
          ub = Math.min(255, bb + pb);
        }
      }
      if (hit) {
        put(g, i, G.top, tr, tg, tb);
        tint(g, i, ur, ug, ub);
        continue;
      }
      // 日冕一样的一大圈光：离得越远越淡
      const d = Math.hypot(dx, (g.oy[row] - y) / r);
      const a = core * Math.exp(-(d - 1) * 1.3) * 0.55;
      if (a > 0.01) glow(g, i, 120 * a, 82 * a, 34 * a);
    }
  }
}

/** 云从疏到密的字（不用 - 和 =：横笔画连起来像扫描线） */
const CLOUD_RAMP = [...' .·:;+*#%@'].map(gi);
let cloudV = new Float32Array(0);
let cloudH = new Float32Array(0);

const orbit = clock();
const swirl = clock();

export function drawSunScene(g: Grid, zz: number) {
  const time = g.reduced ? 0 : g.time;
  // 后面那颗地球的地图：这一段开头就在后台一行行算
  prepareEarth(1.5);
  const collapse = smooth(1648, 1664, zz);
  const cloudShow = 1 - smooth(1664, 1680, zz);
  const ignite = smooth(1662, 1665, zz);
  const flash = bump(zz, 1662, 1665, 1673);
  const diskShow = smooth(1658, 1670, zz) * (1 - smooth(1690, 1702, zz));
  const rings = smooth(1676, 1686, zz);
  const form = smooth(1682, 1694, zz);
  // 行星转着；镜头要钻向地球之前慢慢停住，免得目标跑掉
  const tau = orbit(g, 1 - smooth(1696, 1702, zz));
  const spin = swirl(g, 1);
  // 镜头：先对准地球，再一路放大
  const aim = smooth(1700, 1708, zz);
  const zoom = smooth(1702, 1714, zz);
  const m = 2 ** (ZOOM_MAX * zoom ** 1.3);
  planetAt(2, tau);
  const camX = wx0 * aim;
  const camY = wy0 * aim;
  const toX = (x: number) => (x - camX) * m;
  const toY = (y: number) => (y - camY) * m;
  const sunX = toX(0);
  const sunY = toY(0);

  // 远处的星：一直在，不动
  for (let k = 0; k < 120; k += 1) {
    const x = (hash1(k * 3 + 1) - 0.5) * g.aspect;
    const y = (hash1(k * 3 + 2) - 0.5) * g.half * 2;
    const v = 0.3 + 0.4 * hash1(k * 3 + 3);
    plot(g, x, y, G.dot, 200 * v, 205 * v, 230 * v);
  }

  // 一团塌缩的气体和尘埃：越往里收转得越快，中间越来越热
  if (cloudShow > 0.02 && m < 1.5) {
    const inner = 0.05 + 0.25 * (1 - collapse);
    const half = (g.cols >> 1) + 2;
    if (cloudV.length < half * 2) {
      cloudV = new Float32Array(half * 2);
      cloudH = new Float32Array(half * 2);
    }
    // 一行样本：每两列一个（三层噪声叠出来的气体、一层尘埃），存进第 slot 个缓冲
    const sampleRow = (y: number, slot: number) => {
      const yy = Math.min(g.rows - 1, y);
      for (let k = 0; k < half; k += 1) {
        const o = slot * half + k;
        const x = Math.min(g.cols - 1, k * 2);
        const ax = (g.ox[x] - sunX) / 1.1;
        const ay = g.oy[yy] - sunY;
        const r = Math.sqrt(ax * ax + ay * ay);
        const R = r * (1 + 2.2 * collapse);
        cloudV[o] = 0;
        cloudH[o] = 0;
        if (R > 1.4) continue;
        const theta = Math.atan2(ay, ax) + (1.6 * collapse) / (R + 0.12) + spin * 0.05;
        const X = R * Math.cos(theta);
        const Y = R * Math.sin(theta);
        // 发光的气体：一大团里拉着一缕缕的丝
        const d = 0.5 * noise2(X * 4.2 + 11, Y * 4.2 - 3) + 0.3 * noise2(X * 9 - 7, Y * 9 + 5) + 0.2 * noise2(X * 21 + 2, Y * 21 - 9);
        // 尘埃：挡光的暗带
        const dust = smooth(0.58, 0.78, noise2(X * 7 - 13, Y * 7 + 4));
        const env = Math.exp(-((R / 0.85) ** 2));
        const dens = clamp01((d - 0.38) * 2.4) * env;
        const heat = Math.exp(-((r / inner) ** 2)) * collapse;
        cloudV[o] = (dens * (0.75 + 0.9 * heat) * (1 - 0.75 * dust * (1 - heat)) + 0.1 * env) * cloudShow;
        cloudH[o] = heat;
      }
    };
    // 隔一行算一行样本，中间那行上下插出来（云本来就是软的，看不出差别，省四分之三）
    let cur = 0;
    sampleRow(0, cur);
    for (let y = 0; y < g.rows; y += 2) {
      const next = 1 - cur;
      sampleRow(y + 2, next);
      for (let dy = 0; dy < 2 && y + dy < g.rows; dy += 1) {
        const row = y + dy;
        for (let c = 0; c < g.cols; c += 1) {
          const k = c >> 1;
          const k1 = c & 1 ? k + 1 : k;
          const a0 = cur * half;
          const a1 = next * half;
          let v = (cloudV[a0 + k] + cloudV[a0 + k1]) * 0.5;
          let heat = (cloudH[a0 + k] + cloudH[a0 + k1]) * 0.5;
          if (dy === 1) {
            v = (v + (cloudV[a1 + k] + cloudV[a1 + k1]) * 0.5) * 0.5;
            heat = (heat + (cloudH[a1 + k] + cloudH[a1 + k1]) * 0.5) * 0.5;
          }
          if (v < 0.04) continue;
          const red = lerp(225, 255, heat);
          const green = lerp(96, 170, heat);
          const blue = lerp(170, 80, heat);
          const i = row * g.cols + c;
          const pick = Math.min(1, v) + (hash2(c * 5, row * 3) - 0.5) * 0.08;
          tint(g, i, BG[0] + red * v * 0.26, BG[1] + green * v * 0.22, BG[2] + blue * v * 0.26);
          if (pick < 0.08) continue;
          const lum = 0.4 + 0.6 * Math.min(1, v);
          put(g, i, CLOUD_RAMP[Math.min(CLOUD_RAMP.length - 1, 1 + Math.floor(pick * (CLOUD_RAMP.length - 1)))], red * lum, green * lum, blue * lum);
        }
      }
      cur = next;
    }
  }

  // 尘埃盘：斜着看是一个扁扁的椭圆，里面转得快、外面转得慢，所以一条条拉成细纹；后来聚成一圈圈环、再聚成行星
  if (diskShow > 0.02 && m < 1.5) {
    const c0 = Math.max(0, colOf(g, sunX - 0.52 * 1.1));
    const c1 = Math.min(g.cols - 1, colOf(g, sunX + 0.52 * 1.1));
    const r0 = Math.max(0, rowOf(g, sunY + 0.52 * TILT));
    const r1 = Math.min(g.rows - 1, rowOf(g, sunY - 0.52 * TILT));
    for (let row = r0; row <= r1; row += 1) {
      for (let col = c0; col <= c1; col += 1) {
        const dx = (g.ox[col] - sunX) / 1.1;
        const dy = (g.oy[row] - sunY) / TILT;
        const rho = Math.sqrt(dx * dx + dy * dy);
        if (rho < 0.035 || rho > 0.5) continue;
        const phi = Math.atan2(dy, dx) - (spin * 0.35) / rho ** 1.5;
        let v = smooth(0.035, 0.07, rho) * (1 - smooth(0.4, 0.5, rho)) * (0.45 + 0.7 * noise2(rho * 18, Math.cos(phi) * 2.5 + Math.sin(phi) * 1.7));
        if (rings > 0) {
          let ring = 0;
          for (let k = 0; k < PLANETS.length; k += 1) ring = Math.max(ring, Math.exp(-(((rho - PLANETS[k].r) / 0.013) ** 2)));
          v *= 1 - rings + rings * ring * 1.4 * (1 - form * 0.9);
        }
        v *= diskShow;
        if (v < 0.06) continue;
        // 太阳后面那一半被太阳挡住一点
        const behind = dy > 0 && rho < 0.06 ? 0.3 : 1;
        const hot = 1 - smooth(0.05, 0.3, rho);
        const k = v * behind;
        const i = row * g.cols + col;
        // 尘埃顺着轨道转：亮的地方画成顺着轨道方向的笔画，暗的地方是点
        const a = Math.atan2(dy, dx);
        const glyph = k > 0.32 ? lineGlyph((-Math.sin(a) * 1.1) / g.cw, (Math.cos(a) * TILT) / g.ch) : k > 0.16 ? G.mid : G.dot;
        put(g, i, glyph, lerp(170, 255, hot) * (0.5 + 0.5 * k), lerp(110, 200, hot) * (0.5 + 0.5 * k), lerp(90, 130, hot) * (0.5 + 0.5 * k));
        tint(g, i, BG[0] + lerp(60, 110, hot) * k * 0.25, BG[1] + lerp(36, 80, hot) * k * 0.25, BG[2] + 30 * k * 0.25);
      }
    }
  }

  // 太阳：先是中间一团越来越亮的热气，点着的那一下整屏亮一下
  if (m < 40) {
    const core = clamp01(collapse * 1.4) * (0.4 + 0.6 * ignite);
    const r = (0.012 + 0.012 * ignite) * m;
    if (core > 0.05) sunDisc(g, sunX, sunY, r, core, ignite, time);
    if (flash > 0.02) {
      for (let o = 0; o < g.bg.length; o += 4) {
        g.bg[o] = Math.min(255, g.bg[o] + 90 * flash);
        g.bg[o + 1] = Math.min(255, g.bg[o + 1] + 80 * flash);
        g.bg[o + 2] = Math.min(255, g.bg[o + 2] + 50 * flash);
      }
    }
    // 刚点着时上下各喷出一道细细的气流
    const jets = smooth(1660, 1664, zz) * (1 - smooth(1668, 1675, zz));
    if (jets > 0.03) {
      const reach = 0.03 + 0.3 * smooth(1660, 1667, zz);
      const frame = g.reduced ? 0 : Math.floor(time * 10);
      for (const side of [-1, 1]) {
        walk(g, sunX, sunY + side * 0.03, sunX, sunY + side * reach, (i, s) => {
          const v = jets * (1 - s * 0.7) * (0.7 + 0.3 * hash2(i, frame));
          put(g, i, G.pipe, 190 * v, 220 * v, 255 * v);
        });
      }
    }
  }

  // 轨道和行星
  if (form > 0.02) {
    const orbitShow = form * 0.35 * (1 - zoom);
    if (orbitShow > 0.03) PLANETS.forEach((p) => ringAt(g, sunX, sunY, p.r * m, [120 * orbitShow, 130 * orbitShow, 170 * orbitShow], TILT, 2));
    PLANETS.forEach((p, k) => {
      planetAt(k, tau);
      const x = toX(wx0);
      const y = toY(wy0);
      if (k === 2) return;
      if (Math.abs(x) > g.aspect || Math.abs(y) > g.half * 1.5) return;
      const v = form;
      if (p.big) {
        ball(g, x, y, p.color[0] * v, p.color[1] * v, p.color[2] * v);
        if (p.name === 'Saturn') {
          plot(g, x - g.cw * 2.5, y, G.dash, p.color[0] * v, p.color[1] * v, p.color[2] * v);
          plot(g, x + g.cw * 2.5, y, G.dash, p.color[0] * v, p.color[1] * v, p.color[2] * v);
        }
      } else plot(g, x, y, G.disc, p.color[0] * v, p.color[1] * v, p.color[2] * v);
    });
  }

  // 地球：放大到够大了就画成一整颗球（刚形成时是岩浆，时间一跳就成了今天的样子）
  const modern = smooth(1712, 1720, zz);
  planetAt(2, tau);
  const ex = toX(wx0);
  const ey = toY(wy0);
  const R = EARTH_TRUE * m;
  if (form > 0.02 || zz > 1700) {
    if (R < g.ch * 1.2) {
      const v = Math.max(form, smooth(1700, 1702, zz));
      plot(g, ex, ey, G.disc, PLANETS[2].color[0] * v, PLANETS[2].color[1] * v, PLANETS[2].color[2] * v);
    } else drawGlobe(g, ex, ey, R, modern, 1);
  }

  // 标注
  callout(g, -0.3, 0.12, -0.46, 0.26, 'a cloud of gas and dust, light-years across', [200, 160, 220], smooth(1648, 1652, zz) * (1 - smooth(1656, 1660, zz)));
  status(g, 'it collapses, and spins faster as it shrinks', [220, 190, 240], smooth(1654, 1658, zz) * (1 - smooth(1662, 1665, zz)));
  callout(g, sunX, sunY, sunX + 0.18, sunY + 0.16, 'its middle gets hot enough to fuse hydrogen: the Sun', [255, 230, 170], smooth(1665, 1668, zz) * (1 - smooth(1676, 1680, zz)));
  status(g, 'the hydrogen it burns was made in the first three minutes', [255, 230, 170], smooth(1667, 1671, zz) * (1 - smooth(1680, 1684, zz)));
  if (form > 0.5) {
    callout(g, ex, ey, ex - 0.14, ey - 0.16, 'Earth: the third planet out', PLANETS[2].color, smooth(1688, 1692, zz) * (1 - smooth(1700, 1704, zz)));
    planetAt(4, tau);
    callout(g, toX(wx0), toY(wy0), toX(wx0) + 0.14, toY(wy0) + 0.15, 'Jupiter, the biggest', PLANETS[4].color, smooth(1690, 1694, zz) * (1 - smooth(1700, 1704, zz)));
  }
  status(g, 'the iron in your blood was made in stars that blew up before the Sun was born', [255, 200, 190], smooth(1686, 1690, zz) * (1 - smooth(1702, 1706, zz)));
  if (R > 0.1) {
    callout(g, ex + R * 0.7 * 1.1, ey + R * 0.5, ex + R * 1.1 + 0.08, ey + R * 0.7, 'young Earth: a ball of molten rock', LAVA, smooth(1710, 1712, zz) * (1 - smooth(1714, 1717, zz)));
    const [ux, uy] = youOnGlobe();
    const here = smooth(1716, 1720, zz);
    if (here > 0.03) {
      const px = ex + ux * R * 1.1;
      const py = ey + uy * R;
      plot(g, px, py, G.ring, PINK[0] * here, PINK[1] * here, PINK[2] * here);
      callout(g, px, py, px - 0.2, py + 0.16, 'you are here', PINK, here);
    }
  }
}
