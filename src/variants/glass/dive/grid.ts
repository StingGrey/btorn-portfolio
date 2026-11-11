// 字符网格（CPU 这边）：每一格一个字、一个字色、一个底色。场景函数往里写，每帧整块传给 GPU。
// 坐标约定：屏幕高度 = 1，原点在屏幕正中，x 朝右、y 朝上；ox / oy 是每一列 / 每一行格子中心的坐标。

import { BLOCKS, RAMP } from './charset';

export const BG: [number, number, number] = [7, 6, 11];

export type Grid = {
  cols: number;
  rows: number;
  count: number;
  /** 每格 r, g, b, 字的序号 */
  fg: Uint8Array;
  /** 每格底色 r, g, b, (不用) */
  bg: Uint8Array;
  ox: Float32Array;
  oy: Float32Array;
  /** 一格多宽、多高（屏幕高度 = 1） */
  cw: number;
  ch: number;
  /** 网格有多宽（屏幕单位） */
  aspect: number;
  /** 半个网格有多高（屏幕单位；横屏是 0.5，竖屏会更大） */
  half: number;
  time: number;
  reduced: boolean;
};

/**
 * 一个「屏幕单位」有多少像素：横屏就是屏幕高度；竖屏（手机）太窄，用宽度的 1.25 倍，
 * 不然同样的视野在手机上左右只剩一小条
 */
export const screenUnit = (width: number, height: number) => Math.min(height, width * 1.25);

export function makeGrid(cols: number, rows: number, cwDev: number, chDev: number): Grid {
  const unit = screenUnit(cols * cwDev, rows * chDev);
  const cw = cwDev / unit;
  const ch = chDev / unit;
  const aspect = cols * cw;
  const half = (rows * ch) / 2;
  const ox = new Float32Array(cols);
  const oy = new Float32Array(rows);
  for (let x = 0; x < cols; x += 1) ox[x] = (x + 0.5) * cw - aspect / 2;
  for (let y = 0; y < rows; y += 1) oy[y] = half - (y + 0.5) * ch;
  return {
    cols,
    rows,
    count: cols * rows,
    fg: new Uint8Array(cols * rows * 4),
    bg: new Uint8Array(cols * rows * 4),
    ox,
    oy,
    cw,
    ch,
    aspect,
    half,
    time: 0,
    reduced: false,
  };
}

/** 同样大小的另一块网格（坐标表共用） */
export function twin(g: Grid): Grid {
  return { ...g, fg: new Uint8Array(g.fg.length), bg: new Uint8Array(g.bg.length) };
}

/** 按 w（0..1）把 b 溶解到 a 上：每格按自己的阈值决定用谁 */
export function dissolve(a: Grid, b: Grid, w: number) {
  if (w <= 0) return;
  for (let y = 0; y < a.rows; y += 1) {
    for (let x = 0; x < a.cols; x += 1) {
      if (w < 1 && threshold(x, y) >= w) continue;
      const o = (y * a.cols + x) * 4;
      a.fg[o] = b.fg[o];
      a.fg[o + 1] = b.fg[o + 1];
      a.fg[o + 2] = b.fg[o + 2];
      a.fg[o + 3] = b.fg[o + 3];
      a.bg[o] = b.bg[o];
      a.bg[o + 1] = b.bg[o + 1];
      a.bg[o + 2] = b.bg[o + 2];
    }
  }
}

export function clearGrid(g: Grid, r = BG[0], gr = BG[1], b = BG[2]) {
  const { fg, bg } = g;
  for (let o = 0; o < fg.length; o += 4) {
    fg[o + 3] = 0;
    bg[o] = r;
    bg[o + 1] = gr;
    bg[o + 2] = b;
  }
}

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

/** 写一个字（颜色 0..255） */
export function put(g: Grid, i: number, glyph: number, r: number, gr: number, b: number) {
  const o = i * 4;
  g.fg[o] = clamp255(r);
  g.fg[o + 1] = clamp255(gr);
  g.fg[o + 2] = clamp255(b);
  g.fg[o + 3] = glyph;
}

/** 写底色 */
export function tint(g: Grid, i: number, r: number, gr: number, b: number) {
  const o = i * 4;
  g.bg[o] = clamp255(r);
  g.bg[o + 1] = clamp255(gr);
  g.bg[o + 2] = clamp255(b);
}

/** 亮度 v（0..1）挑一个由疏到密的字，颜色是 (r, g, b)；底色跟着淡淡地垫一层 */
export function shade(g: Grid, i: number, v: number, r: number, gr: number, b: number, under = 0.18) {
  if (v <= 0.03) return;
  const k = v > 1 ? 1 : v;
  put(g, i, RAMP[Math.min(RAMP.length - 1, 1 + Math.floor(k * (RAMP.length - 1)))], r, gr, b);
  if (under > 0) tint(g, i, BG[0] + r * k * under, BG[1] + gr * k * under, BG[2] + b * k * under);
}

/** 同上，用方块：░ ▒ ▓ █ */
export function block(g: Grid, i: number, v: number, r: number, gr: number, b: number, under = 0.22) {
  if (v <= 0.04) return;
  const k = v > 1 ? 1 : v;
  put(g, i, BLOCKS[Math.min(4, 1 + Math.floor(k * 3.999))], r, gr, b);
  if (under > 0) tint(g, i, BG[0] + r * k * under, BG[1] + gr * k * under, BG[2] + b * k * under);
}

/* ---------- 随机和噪声（整数哈希，不分配内存） ---------- */

export function hash1(n: number) {
  let h = Math.imul(n | 0, 0x27d4eb2d) ^ 0x165667b1;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const hash2 = (x: number, y: number) => hash1(Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663));
export const hash3 = (x: number, y: number, z: number) =>
  hash1(Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(z | 0, 83492791));

export function noise2(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function noise3(x: number, y: number, z: number) {
  const zi = Math.floor(z);
  const zf = z - zi;
  const w = zf * zf * (3 - 2 * zf);
  const a = noise2(x + zi * 17.3, y - zi * 11.1);
  const b = noise2(x + (zi + 1) * 17.3, y - (zi + 1) * 11.1);
  return a + (b - a) * w;
}

export function fbm2(x: number, y: number, octaves = 4) {
  let sum = 0;
  let norm = 0;
  let amp = 0.5;
  let fx = x;
  let fy = y;
  for (let k = 0; k < octaves; k += 1) {
    sum += noise2(fx, fy) * amp;
    norm += amp;
    fx = fx * 2.03 + 17.1;
    fy = fy * 2.03 - 9.7;
    amp *= 0.5;
  }
  return sum / norm;
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 每格一个稳定的抖动阈值（4×4 Bayer + 一点哈希），溶解、半透明都靠它 */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function threshold(x: number, y: number) {
  return (BAYER[(y & 3) * 4 + (x & 3)] + hash2(x >> 2, y >> 2) * 0.999) / 16;
}

/* ---------- 屏幕坐标 ↔ 格子 ---------- */

export const colOf = (g: Grid, x: number) => Math.floor((x + g.aspect / 2) / g.cw);
export const rowOf = (g: Grid, y: number) => Math.floor((g.half - y) / g.ch);

/** 在格子里写一个字（越界就不写） */
export function plot(g: Grid, x: number, y: number, glyph: number, r: number, gr: number, b: number) {
  const cx = colOf(g, x);
  const cy = rowOf(g, y);
  if (cx < 0 || cy < 0 || cx >= g.cols || cy >= g.rows) return -1;
  const i = cy * g.cols + cx;
  put(g, i, glyph, r, gr, b);
  return i;
}

/** 从 (x0, y0) 到 (x1, y1) 一格一格地走，每一格交给 visit（屏幕坐标） */
export function walk(g: Grid, x0: number, y0: number, x1: number, y1: number, visit: (i: number, t: number) => void) {
  const c0 = (x0 + g.aspect / 2) / g.cw;
  const r0 = (g.half - y0) / g.ch;
  const c1 = (x1 + g.aspect / 2) / g.cw;
  const r1 = (g.half - y1) / g.ch;
  const steps = Math.ceil(Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0)) * 1.4) + 1;
  let last = -1;
  for (let s = 0; s <= steps; s += 1) {
    const t = s / steps;
    const cx = Math.floor(c0 + (c1 - c0) * t);
    const cy = Math.floor(r0 + (r1 - r0) * t);
    if (cx < 0 || cy < 0 || cx >= g.cols || cy >= g.rows) continue;
    const i = cy * g.cols + cx;
    if (i === last) continue;
    last = i;
    visit(i, t);
  }
}
