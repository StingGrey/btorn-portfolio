// 从粉色的 O 一路往里：像素 → 子像素 → 穿过屏幕的夹层（彩色滤光片、液晶、TFT 背板、背光）→ 屏幕背后的主板 →
// 芯片顶盖上刻着的小女孩（通电、蹦）→ 镜头对准她的黄星星发夹钻进去。

import { CHIP_GIRL } from '../chipGirl';
import { G, RAMP, gi, lineGlyph } from '../charset';
import { girlFrames } from '../girl';
import { BG, block, clearGrid, hash2, noise2, put, smooth, threshold, tint, walk, type Grid } from '../grid';
import { INK, callout, note, status } from '../notes';
import { drawO } from './intro';
import { interpolate, logScaleAt } from '../timeline';

/* ====================== ① 像素：粉色 O → 像素 → 子像素 ====================== */

/** 一个像素多大（米）：13 寸笔记本屏幕差不多这个点距 */
const PITCH = 2e-4;
/** 5 × 7 点阵的 O（从上到下） */
const O_ROWS = ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'];
const lit = (px: number, py: number) => px >= 0 && px < 5 && py >= 0 && py < 7 && O_ROWS[6 - py][px] === '#';

let cr = 0;
let cg = 0;
let cb = 0;
/**
 * 屏幕上一个点的颜色（0..1）：黑色矩阵、红绿蓝三条子像素；亮着的是粉色 O 的像素。
 * 子像素不是死板的方块：四个角是圆的，左下角被晶体管占掉一小块，中间比两边亮一点，正中有一道分成上下两半的细缝
 */
function pixelColor(wx: number, wy: number, unlit: number) {
  const px = Math.floor(wx);
  const py = Math.floor(wy);
  const fy = wy - py;
  cr = 0;
  cg = 0;
  cb = 0;
  if (fy < 0.07 || fy > 0.93) return;
  const s = (wx - px) * 3;
  const k = Math.floor(s);
  const sf = s - k;
  if (sf < 0.1 || sf > 0.9) return;
  const u = (sf - 0.1) / 0.8;
  const w = (fy - 0.07) / 0.86;
  const cu = Math.abs(u - 0.5) * 2;
  const cw = Math.abs(w - 0.5) * 2;
  if (cu > 0.7 && cw > 0.9 && (cu - 0.7) / 0.3 + (cw - 0.9) / 0.1 > 1) return;
  if (u < 0.42 && w < 0.085) return;
  let v = lit(px, py) ? (k === 0 ? 1 : k === 1 ? 0.37 : 0.56) : unlit;
  v *= 0.8 + 0.2 * (1 - cu * cu);
  if (Math.abs(w - 0.5) < 0.012) v *= 0.5;
  if (k === 0) {
    cr = v;
    cg = v * 0.12;
    cb = v * 0.16;
  } else if (k === 1) {
    cr = v * 0.12;
    cg = v;
    cb = v * 0.3;
  } else {
    cr = v * 0.2;
    cg = v * 0.32;
    cb = v;
  }
}

/** ax / ay：开场最后那颗 O 在屏幕上的位置；放大的同时慢慢挪到正中间 */
export function drawPixels(g: Grid, zz: number, ax: number, ay: number) {
  const fov = 10 ** logScaleAt(zz) / PITCH;
  const drift = 1 - smooth(0, 60, zz);
  // 镜头最后对准的是 O 左边那一竖中间那个像素
  const cx = 0.5 - ax * drift * fov;
  const cy = 3.5 - ay * drift * fov;
  const fpx = g.cw * fov;
  const fpy = g.ch * fov;
  if (fpy > 2.4) {
    // 整个 O 还只有两三格高：就是开场留下的那个小圆环
    drawO(g, (2.5 - cx) / fov, (3.5 - cy) / fov);
    return;
  }
  const unlit = 0.07 * smooth(6, 1.5, fpy);
  const n = fpy > 1 ? 4 : 2;
  const inv = 1 / (n * n);
  for (let y = 0; y < g.rows; y += 1) {
    const wy = cy + g.oy[y] * fov;
    for (let x = 0; x < g.cols; x += 1) {
      const wx = cx + g.ox[x] * fov;
      let r = 0;
      let gg = 0;
      let b = 0;
      for (let sy = 0; sy < n; sy += 1) {
        for (let sx = 0; sx < n; sx += 1) {
          pixelColor(wx + ((sx + 0.5) / n - 0.5) * fpx, wy + ((sy + 0.5) / n - 0.5) * fpy, unlit);
          r += cr;
          gg += cg;
          b += cb;
        }
      }
      r *= inv;
      gg *= inv;
      b *= inv;
      const m = Math.max(r, gg, b);
      if (m < 0.03) continue;
      block(g, y * g.cols + x, m * 1.2, (r / m) * 255, (gg / m) * 255, (b / m) * 255, 0.3);
    }
  }
  // 标注：这一格是一个像素；再近一点，三条子像素各是什么颜色
  const toX = (wx: number) => (wx - cx) / fov;
  const toY = (wy: number) => (wy - cy) / fov;
  const rows = 1 / fpy;
  const one = smooth(4, 7, rows) * (1 - smooth(24, 36, rows));
  callout(g, toX(0.5), toY(4), toX(0.5) + 0.16, toY(4) + 0.1, 'one pixel', INK, one);
  const sub = smooth(20, 32, rows);
  const names = rows > 70 ? ['red subpixel', 'green subpixel', 'blue subpixel'] : ['R', 'G', 'B'];
  names.forEach((name, k) => note(g, toX((k * 2 + 1) / 6), toY(3.5), name, INK, 0.5, sub));
}

/* ====================== ② 穿过屏幕：一层层夹层 + 背后的主板 ====================== */

/** 镜头往前推了多远（层的深度单位）随 zz 怎么走：每一层「对上焦」的那一刻正好是它那一站 */
const DEPTH: [number, number][] = [
  [100, 0],
  [122, 0.25],
  [152, 0.5],
  [182, 0.75],
  [212, 1.0],
  [252, 1.36],
  [330, 1.44],
  [380, 1.585],
];
/** 一层离镜头 dist 远时，视野 = F × dist（各层用自己的单位） */
const LAYERS = [
  { d: 0.1, F: 5 },
  { d: 0.35, F: 110 },
  { d: 0.6, F: 28 },
  { d: 0.85, F: 90 },
];
const BOARD_D = 1.6;
const BOARD_F = 50;

let lg = 0;
let lr = 0;
let lgr = 0;
let lb = 0;
let lcov = 0;

/** 彩色滤光片：红绿蓝竖条（黑色矩阵的地方是空的，镜头从缝里穿过去） */
function filterLayer(wx: number, wy: number) {
  lcov = 0;
  const x = wx + 0.5;
  const y = wy + 0.5;
  const fy = y - Math.floor(y);
  if (fy < 0.06 || fy > 0.94) return;
  const s = (x - Math.floor(x)) * 3;
  const k = Math.floor(s);
  const sf = s - k;
  if (sf < 0.08 || sf > 0.92) return;
  lcov = 1;
  lg = noise2(wx * 9, wy * 3) > 0.62 ? G.dark : G.full;
  if (k === 0) {
    lr = 235;
    lgr = 50;
    lb = 70;
  } else if (k === 1) {
    lr = 50;
    lgr = 220;
    lb = 100;
  } else {
    lr = 70;
    lgr = 100;
    lb = 245;
  }
}

/**
 * 液晶棍子的位置和方向，每帧按格点算一次存起来（一格要看周围九根，现算三角函数太慢）。
 * 用一张按格点取模的小表当缓存，键是「格点 + 这一帧的时间」。
 */
const ROD_SLOTS = 64 * 64;
const rods = new Float32Array(ROD_SLOTS * 4);
const rodKey = new Float64Array(ROD_SLOTS).fill(NaN);
let rodTime = NaN;
function rodSlot(i: number, j: number, t: number) {
  if (t !== rodTime) {
    rodTime = t;
    rodKey.fill(NaN);
  }
  const slot = (((i & 63) << 6) | (j & 63)) >>> 0;
  const key = i * 100003 + j;
  const o = slot * 4;
  if (rodKey[slot] !== key) {
    rodKey[slot] = key;
    // 一片一片地跟着电压转：相邻的棍子方向差不多，整体像波浪一样扭
    const a = 0.75 * Math.sin(0.27 * i + t * 0.9) + 0.6 * Math.sin(0.23 * j - t * 0.7) + 0.12 * j + (hash2(i + 3, j) - 0.5) * 0.22;
    rods[o] = i + (hash2(i, j) - 0.5) * 0.16;
    rods[o + 1] = j + (hash2(j, i + 7) - 0.5) * 0.16;
    rods[o + 2] = Math.cos(a);
    rods[o + 3] = Math.sin(a);
  }
  return o;
}

/** 液晶：一根根两头圆的小棍子（中间亮、边上暗），排着队扭；跟着电压一阵一阵地转 */
function lcLayer(wx: number, wy: number, fp: number, t: number, g: Grid) {
  lcov = 0;
  if (fp > 0.7) {
    // 远得一格里挤好几根：只剩一层细碎的纹理
    if (hash2(Math.floor(wx * 2), Math.floor(wy * 2)) < 0.3) {
      lcov = 0.5;
      lg = G.dot;
      lr = 120;
      lgr = 180;
      lb = 210;
    }
    return;
  }
  const ix = Math.round(wx);
  const iy = Math.round(wy);
  let best = 1e9;
  let bestDx = 1;
  let bestDy = 0;
  for (let j = iy - 1; j <= iy + 1; j += 1) {
    for (let i = ix - 1; i <= ix + 1; i += 1) {
      const o = rodSlot(i, j, t);
      const px = rods[o];
      const py = rods[o + 1];
      const dx = rods[o + 2];
      const dy = rods[o + 3];
      const along = Math.max(-0.33, Math.min(0.33, (wx - px) * dx + (wy - py) * dy));
      const ex = wx - px - dx * along;
      const ey = wy - py - dy * along;
      const d = ex * ex + ey * ey;
      if (d < best) {
        best = d;
        bestDx = dx;
        bestDy = dy;
      }
    }
  }
  const radius = 0.13;
  const d = Math.sqrt(best);
  if (d < radius + fp * 0.4) {
    lcov = 1;
    const core = Math.max(0, 1 - d / radius);
    if (fp < 0.1) lg = core > 0.5 ? G.full : core > 0.28 ? G.dark : core > 0.1 ? G.medium : G.light;
    else lg = lineGlyph(bestDx / g.cw, bestDy / g.ch);
    // 斜着的棍子透光最多，看起来最亮
    const k = (0.4 + 0.6 * core) * (0.62 + 0.38 * Math.abs(2 * bestDx * bestDy));
    lr = 140 * k + 110 * core * core;
    lgr = 226 * k + 28 * core * core;
    lb = 255 * k;
  } else if (d < radius * 2 && fp < 0.2) {
    lcov = 0.3;
    lg = G.dot;
    lr = 60;
    lgr = 110;
    lb = 150;
  }
}

/**
 * TFT 背板：栅极线（横）、数据线（竖）；每个子像素角上一个晶体管（栅极、半导体小岛、源漏两根指头、一个接触孔），
 * 上面是带「人」字形细缝的透明像素电极（IPS 屏在显微镜下就是这个样子）；一行一行地扫
 */
function tftLayer(wx: number, wy: number, fp: number, t: number) {
  lcov = 0;
  const fx = wx - Math.floor(wx);
  const ry = wy / 3;
  const row = Math.floor(ry);
  const fy = ry - row;
  const active = Math.floor(t * 7) % 18 === ((row % 18) + 18) % 18;
  const thick = fp < 0.06;
  if (fy < 0.045 || fy > 0.955) {
    lcov = 1;
    const edge = (fy > 0.03 && fy < 0.045) || (fy > 0.955 && fy < 0.97);
    lg = thick ? (edge ? G.dark : G.full) : G.h;
    lr = active ? 140 : edge ? 232 : 204;
    lgr = active ? 240 : edge ? 212 : 182;
    lb = active ? 255 : edge ? 150 : 118;
    return;
  }
  if (fx < 0.055 || fx > 0.945) {
    lcov = 1;
    lg = thick ? G.full : G.v;
    lr = 196;
    lgr = 172;
    lb = 112;
    return;
  }
  if (fx > 0.07 && fx < 0.46 && fy > 0.055 && fy < 0.3) {
    const u = (fx - 0.07) / 0.39;
    const v = (fy - 0.055) / 0.245;
    lcov = 1;
    lg = thick ? G.full : G.square;
    if (v < 0.3) {
      // 栅极：从栅极线伸上来的一小块
      lr = active ? 150 : 204;
      lgr = active ? 240 : 182;
      lb = active ? 255 : 118;
    } else if (Math.abs(u - 0.84) < 0.09 && Math.abs(v - 0.7) < 0.15) {
      // 接触孔：漏极从这里连到像素电极
      lr = 250;
      lgr = 250;
      lb = 240;
    } else if (u > 0.32 && u < 0.68) {
      // 半导体小岛：开关就在这里
      lg = thick ? G.dark : G.square;
      lr = active ? 210 : 158;
      lgr = active ? 150 : 112;
      lb = active ? 255 : 214;
    } else {
      // 源 / 漏
      lr = 238;
      lgr = u <= 0.32 ? 146 : 170;
      lb = u <= 0.32 ? 72 : 96;
    }
    return;
  }
  if (fy >= 0.3 && fy <= 0.335) {
    // 存储电容的公共线
    lcov = 0.7;
    lg = G.h;
    lr = 150;
    lgr = 132;
    lb = 92;
    return;
  }
  if (fx > 0.1 && fx < 0.92 && fy > 0.335 && fy < 0.935) {
    const u = (fx - 0.1) / 0.82;
    const v = (fy - 0.335) / 0.6;
    const s = u * 5 + Math.abs(v - 0.5) * 2.6;
    const slit = s - Math.floor(s) < 0.42;
    lcov = slit ? 0.2 : 0.85;
    lg = slit ? G.light : thick ? G.dark : G.medium;
    lr = slit ? 44 : active ? 126 : 96;
    lgr = slit ? 66 : active ? 200 : 150;
    lb = slit ? 104 : active ? 230 : 190;
  }
}

/** 背光的导光板：一片印着小白点的板子，点子大小渐变，每个点中间亮、边上暗，外面两圈淡淡的光晕 */
function backlightLayer(wx: number, wy: number, fp: number) {
  lcov = 0;
  const j0 = Math.round(wy / 0.866);
  let best = 1e9;
  let radius = 0;
  for (let j = j0 - 1; j <= j0 + 1; j += 1) {
    const shift = (j & 1) * 0.5;
    const i = Math.round(wx - shift);
    const ddx = wx - (i + shift);
    const ddy = wy - j * 0.866;
    const d = Math.sqrt(ddx * ddx + ddy * ddy);
    if (d < best) {
      best = d;
      radius = 0.12 + 0.16 * (0.5 + 0.5 * Math.sin(i * 0.07 + j * 0.05));
    }
  }
  if (best < radius + fp * 0.3) {
    lcov = 1;
    const core = Math.max(0, 1 - best / radius);
    lg = fp < radius * 0.5 ? (core > 0.45 ? G.full : core > 0.18 ? G.dark : G.medium) : fp < radius * 1.5 ? G.disc : G.o;
    const k = 0.72 + 0.28 * core;
    lr = 232 * k + 23 * core;
    lgr = 238 * k + 17 * core;
    lb = 255 * k;
  } else if (best < radius * 1.7) {
    lcov = 0.55;
    lg = G.colon;
    lr = 150;
    lgr = 162;
    lb = 215;
  } else if (best < radius * 2.6) {
    lcov = 0.32;
    lg = G.dot;
    lr = 96;
    lgr = 108;
    lb = 165;
  } else if (hash2(Math.floor(wx * 4), Math.floor(wy * 4)) < 0.1) {
    lcov = 0.3;
    lg = G.dot;
    lr = 46;
    lgr = 56;
    lb = 104;
  }
}

/* ---------- 主板：阻焊绿、铜走线、过孔、贴片元件，正中间是芯片 ---------- */

type Part = { x: number; y: number; w: number; h: number; kind: number };
type Trace = { pts: number[]; w: number; via: boolean };

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SUBSTRATE = 7.5;
const LID = 6;

const PARTS: Part[] = (() => {
  const parts: Part[] = [];
  const random = rng(3);
  // 芯片四周一圈去耦电容（0402），外面一圈电阻；四个角上大一点的钽电容
  for (let side = 0; side < 4; side += 1) {
    for (let k = -3; k <= 3; k += 1) {
      const along = k * 1.9 + (random() - 0.5) * 0.3;
      const flip = side % 2 === 1;
      const r = 9.4;
      const [x, y] = [
        [r, along],
        [along, r],
        [-r, along],
        [along, -r],
      ][side];
      parts.push({ x, y, w: flip ? 1.0 : 0.5, h: flip ? 0.5 : 1.0, kind: 0 });
      if (k % 2 === 0) {
        const r2 = 11.6;
        const [x2, y2] = [
          [r2, along],
          [along, r2],
          [-r2, along],
          [along, -r2],
        ][side];
        parts.push({ x: x2, y: y2, w: flip ? 1.0 : 0.5, h: flip ? 0.5 : 1.0, kind: 1 });
      }
    }
  }
  [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ].forEach(([sx, sy]) => {
    parts.push({ x: sx * 11.2, y: sy * 11.2, w: 2.0, h: 1.3, kind: 2 });
    // 封装基板上、顶盖外面的小电容
    parts.push({ x: sx * 6.8, y: sy * 6.8, w: 0.6, h: 0.32, kind: 3 });
  });
  // 远一点还有几颗小芯片（黑身子、两排引脚）、一颗晶振（银色的小罐子）、一排连接器
  parts.push({ x: -19, y: 9, w: 5, h: 4, kind: 4 });
  parts.push({ x: 20, y: 11, w: 4, h: 3, kind: 4 });
  parts.push({ x: 18, y: -9, w: 3.4, h: 3.4, kind: 4 });
  parts.push({ x: -17, y: -6, w: 3.4, h: 1.5, kind: 5 });
  parts.push({ x: -2, y: -17, w: 12, h: 2.2, kind: 6 });
  parts.push({ x: 4, y: 17.5, w: 9, h: 2, kind: 6 });
  return parts;
})();

const TRACES: Trace[] = (() => {
  const traces: Trace[] = [];
  const random = rng(11);
  const dirs = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ];
  dirs.forEach(([dx, dy]) => {
    const px = -dy;
    const py = dx;
    for (let k = 0; k < 12; k += 1) {
      const along = -5.5 + k + (random() - 0.5) * 0.2;
      const sx = dx * SUBSTRATE + px * along;
      const sy = dy * SUBSTRATE + py * along;
      const l1 = 0.8 + (k % 3) * 0.5;
      const x1 = sx + dx * l1;
      const y1 = sy + dy * l1;
      const spread = along * (0.6 + random() * 0.4);
      const l2 = Math.abs(spread);
      const x2 = x1 + dx * l2 + px * spread;
      const y2 = y1 + dy * l2 + py * spread;
      const l3 = 12 + random() * 26;
      traces.push({ pts: [sx, sy, x1, y1, x2, y2, x2 + dx * l3, y2 + dy * l3], w: 0.14, via: random() < 0.35 });
    }
  });
  // 四个角往外的电源线，粗一些
  [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ].forEach(([sx, sy]) => {
    traces.push({ pts: [sx * 7.2, sy * 7.2, sx * 14, sy * 14, sx * 14, sy * 40], w: 0.7, via: true });
  });
  // 远处零零散散的走线
  for (let k = 0; k < 70; k += 1) {
    let x = (random() - 0.5) * 90;
    let y = (random() - 0.5) * 60;
    if (Math.abs(x) < 16 && Math.abs(y) < 16) x += Math.sign(x || 1) * 16;
    const horizontal = random() < 0.5;
    const length = 4 + random() * 18;
    const bend = (random() - 0.5) * 6;
    const pts = horizontal ? [x, y, x + length, y, x + length + Math.abs(bend), y + bend] : [x, y, x, y + length, x + bend, y + length + Math.abs(bend)];
    traces.push({ pts, w: 0.1 + random() * 0.25, via: random() < 0.5 });
  }
  return traces;
})();

/** 小女孩在顶盖上占的那一块（毫米，顶盖中心为原点） */
const ART = { x0: -5, y1: 5.2, size: 10 };
/** 第 frame 帧里黄星星发夹的中心（毫米） */
const starX = (frame: number) => ART.x0 + (CHIP_GIRL.stars[frame * 2] / CHIP_GIRL.size) * ART.size;
const starY = (frame: number) => ART.y1 - (CHIP_GIRL.stars[frame * 2 + 1] / CHIP_GIRL.size) * ART.size;
/** 她蹦一轮，星星的平均位置 */
const STAR_MEAN_X = Array.from({ length: CHIP_GIRL.frames }, (_, k) => starX(k)).reduce((a, b) => a + b) / CHIP_GIRL.frames;
const STAR_MEAN_Y = Array.from({ length: CHIP_GIRL.frames }, (_, k) => starY(k)).reduce((a, b) => a + b) / CHIP_GIRL.frames;

const roundedBox = (x: number, y: number, hx: number, hy: number, r: number) => {
  const qx = Math.abs(x) - hx + r;
  const qy = Math.abs(y) - hy + r;
  const mx = Math.max(qx, 0);
  const my = Math.max(qy, 0);
  return Math.sqrt(mx * mx + my * my) + Math.min(Math.max(qx, qy), 0) - r;
};

const lift = (v: number) => Math.min(255, v * 1.28 + 10);

function drawBoard(g: Grid, zz: number, zc: number) {
  const fov = BOARD_F * (BOARD_D - zc);
  const fp = g.ch * fov;
  const frames = girlFrames();
  // 通电：一道扫描线从上往下扫过去，扫过的地方亮成彩色；通完电就一直蹦（减少动效时停在一帧）
  const power = g.reduced ? (zz >= 290 ? 1 : 0) : smooth(282, 298, zz);
  const bouncing = power >= 1 && !g.reduced;
  const frame = bouncing ? Math.floor((g.time * 1000) / CHIP_GIRL.delayMs) % CHIP_GIRL.frames : CHIP_GIRL.holdFrame;
  // 镜头钻她的黄星星：先对准星星蹦一轮的平均位置，越钻越近，越牢地跟着这一帧的星星走。
  // 她一蹦星星要上下动将近 1mm，比钻到最后的整个视野还大，不跟就会跳出画面
  const dive = smooth(330, 372, zz);
  const lock = dive ** 2.5;
  const cx = STAR_MEAN_X * dive + (starX(frame) - STAR_MEAN_X) * lock;
  const cy = STAR_MEAN_Y * dive + (starY(frame) - STAR_MEAN_Y) * lock;
  const sweep = power * 176 - 8;
  const sheen = -9 + 18 * smooth(212, 340, zz);
  const S = CHIP_GIRL.size;
  const palette = CHIP_GIRL.palette;
  const base = frame * S * S;

  for (let y = 0; y < g.rows; y += 1) {
    const wy = cy + g.oy[y] * fov;
    for (let x = 0; x < g.cols; x += 1) {
      const wx = cx + g.ox[x] * fov;
      const i = y * g.cols + x;
      const lid = roundedBox(wx, wy, LID, LID, 0.9);
      if (lid < 0) {
        // 顶盖：拉丝的银色金属，一道反光跟着镜头慢慢扫过
        const shine = Math.exp(-((wx * 0.8 + wy * 0.6 - sheen) ** 2) / 3);
        const b = 0.55 + 0.07 * noise2(wx * 2.2, wy * 55) + 0.28 * shine;
        let glyph = fp > 0.35 ? G.medium : hash2(Math.floor(wx * 9), Math.floor(wy * 40)) < 0.2 ? G.eq : G.dash;
        let fr = 205 * b;
        let fg = 210 * b;
        let fb = 224 * b;
        let br = 118 * b;
        let bgc = 121 * b;
        let bb = 132 * b;
        if (lid > -0.14) {
          glyph = G.h;
          fr = fg = fb = 245;
        }
        // 小女孩那一块外面的刻线框
        const badge = Math.abs(roundedBox(wx, wy - 0.2, 5.25, 5.25, 0.6));
        if (badge < Math.max(0.05, fp * 0.5)) {
          glyph = G.hash;
          fr = 70;
          fg = 72;
          fb = 82;
        } else if (frames && wx >= ART.x0 && wx < ART.x0 + ART.size && wy <= ART.y1 && wy > ART.y1 - ART.size) {
          const sx = Math.floor(((wx - ART.x0) / ART.size) * S);
          const sy = Math.floor(((ART.y1 - wy) / ART.size) * S);
          const index = frames[base + sy * S + sx];
          if (index !== CHIP_GIRL.transparent) {
            if (sy < sweep) {
              const [pr, pg, pb] = palette[index];
              const lum = (0.3 * pr + 0.59 * pg + 0.11 * pb) / 255;
              glyph = RAMP[Math.min(RAMP.length - 1, Math.floor(lum * RAMP.length))];
              fr = lift(pr);
              fg = lift(pg);
              fb = lift(pb);
              br = pr * 0.58;
              bgc = pg * 0.58;
              bb = pb * 0.58;
            } else if (index === CHIP_GIRL.outline) {
              glyph = G.hash;
              fr = 52;
              fg = 54;
              fb = 62;
              br = 78 * b;
              bgc = 80 * b;
              bb = 90 * b;
            } else if (index <= 3) {
              glyph = G.colon;
              fr = 120;
              fg = 122;
              fb = 132;
            }
          }
          if (sy >= sweep - 1 && sy < sweep + 3 && power > 0 && power < 1) {
            glyph = G.eq;
            fr = 235;
            fg = 250;
            fb = 255;
          }
        }
        put(g, i, glyph, fr, fg, fb);
        tint(g, i, br, bgc, bb);
        continue;
      }
      if (Math.abs(wx) < SUBSTRATE && Math.abs(wy) < SUBSTRATE) {
        // 封装基板：深一点的绿褐色
        put(g, i, hash2(Math.floor(wx * 4), Math.floor(wy * 4)) < 0.3 ? G.dot : G.colon, 70, 92, 60);
        tint(g, i, 34, 48, 32);
        continue;
      }
      // 阻焊绿；每隔一段有一个接地的小过孔
      tint(g, i, 10, 40, 25);
      const vx = Math.round(wx / 2.6);
      const vy = Math.round(wy / 2.6);
      const vd = Math.max(Math.abs(wx - vx * 2.6), Math.abs(wy - vy * 2.6) * 0.9);
      if (vd < Math.max(0.16, fp * 0.5) && hash2(vx * 5 + 1, vy * 3) < 0.4) put(g, i, fp < 0.2 ? G.ring : G.o, 214, 176, 96);
      else if (hash2(Math.floor(wx * 3), Math.floor(wy * 3)) < 0.16) put(g, i, G.dot, 30, 100, 58);
    }
  }

  const toX = (wx: number) => (wx - cx) / fov;
  const toY = (wy: number) => (wy - cy) / fov;
  const half = g.aspect / 2 + 0.05;
  const visible = (ax: number, ay: number, bx: number, by: number) =>
    !(Math.max(toX(ax), toX(bx)) < -half || Math.min(toX(ax), toX(bx)) > half || Math.max(toY(ay), toY(by)) < -g.half - 0.05 || Math.min(toY(ay), toY(by)) > g.half + 0.05);
  const onBoard = (i: number) => {
    const wx = cx + g.ox[i % g.cols] * fov;
    const wy = cy + g.oy[(i / g.cols) | 0] * fov;
    return Math.abs(wx) >= SUBSTRATE || Math.abs(wy) >= SUBSTRATE;
  };

  // 铜走线
  TRACES.forEach((trace) => {
    const { pts, w } = trace;
    const lanes = Math.min(6, Math.floor(w / fp / 2));
    for (let k = 2; k < pts.length; k += 2) {
      const ax = pts[k - 2];
      const ay = pts[k - 1];
      const bx = pts[k];
      const by = pts[k + 1];
      if (!visible(ax, ay, bx, by)) continue;
      const length = Math.hypot(bx - ax, by - ay) || 1;
      const nx = -(by - ay) / length;
      const ny = (bx - ax) / length;
      const glyph = lanes > 0 ? G.full : Math.abs(bx - ax) < 1e-6 ? G.v : Math.abs(by - ay) < 1e-6 ? G.h : lineGlyph((bx - ax) / g.cw, (by - ay) / g.ch);
      for (let lane = -lanes; lane <= lanes; lane += 1) {
        const ox = nx * lane * fp * 0.9;
        const oy = ny * lane * fp * 0.9;
        walk(g, toX(ax + ox), toY(ay + oy), toX(bx + ox), toY(by + oy), (i) => {
          if (!onBoard(i)) return;
          put(g, i, glyph, 214, 166, 80);
          tint(g, i, 40, 46, 22);
        });
      }
    }
    if (trace.via && pts.length >= 6) {
      const vx = toX(pts[4]);
      const vy = toY(pts[5]);
      walk(g, vx, vy, vx, vy, (i) => put(g, i, fp < 0.25 ? G.O : G.o, 236, 196, 120));
    }
  });

  // 贴片元件：电容（米黄身子、银色两头）、电阻（黑身子）、钽电容（黄）
  PARTS.forEach((part) => {
    const x0 = Math.floor((toX(part.x - part.w / 2) + g.aspect / 2) / g.cw);
    const x1 = Math.floor((toX(part.x + part.w / 2) + g.aspect / 2) / g.cw);
    const y0 = Math.floor((g.half - toY(part.y + part.h / 2)) / g.ch);
    const y1 = Math.floor((g.half - toY(part.y - part.h / 2)) / g.ch);
    if (x1 < 0 || y1 < 0 || x0 >= g.cols || y0 >= g.rows) return;
    const horizontal = part.w >= part.h;
    for (let y = Math.max(0, y0); y <= Math.min(g.rows - 1, y1); y += 1) {
      for (let x = Math.max(0, x0); x <= Math.min(g.cols - 1, x1); x += 1) {
        const i = y * g.cols + x;
        const along = horizontal ? (x - x0 + 0.5) / (x1 - x0 + 1) : (y - y0 + 0.5) / (y1 - y0 + 1);
        if (part.kind >= 4) {
          const top = y === y0 || y === y1;
          if (part.kind === 4) {
            // 小芯片：上下两排银色引脚，左上角一个小圆点标着 1 脚
            if (top && (x - x0) % 2 === 0) put(g, i, G.left, 206, 208, 220);
            else if (top) tint(g, i, 10, 40, 25);
            else if (x === x0 + 1 && y === y0 + 1) put(g, i, G.disc, 220, 220, 230);
            else put(g, i, G.full, 30, 30, 36);
            if (!top) tint(g, i, 18, 18, 22);
          } else if (part.kind === 5) {
            put(g, i, along < 0.12 || along > 0.88 ? G.medium : G.dark, 208, 212, 222);
            tint(g, i, 96, 98, 108);
          } else {
            const pin = y === Math.round((y0 + y1) / 2) && (x - x0) % 2 === 1;
            put(g, i, pin ? G.square : G.full, pin ? 240 : 228, pin ? 200 : 218, pin ? 110 : 192);
            tint(g, i, pin ? 60 : 120, pin ? 50 : 114, pin ? 20 : 98);
          }
          continue;
        }
        const end = along < 0.22 || along > 0.78;
        if (end) {
          put(g, i, G.dark, 210, 212, 222);
          tint(g, i, 90, 92, 100);
        } else if (part.kind === 1) {
          put(g, i, G.full, 34, 34, 40);
          tint(g, i, 20, 20, 24);
        } else if (part.kind === 2) {
          put(g, i, G.full, 232, 190, 70);
          tint(g, i, 120, 95, 30);
        } else {
          put(g, i, G.full, 196, 160, 112);
          tint(g, i, 100, 80, 55);
        }
      }
    }
  });

  // 丝印：芯片外面一圈虚线框和「U1」
  const frame8 = 8.1;
  for (let k = 0; k < 4; k += 1) {
    const [ax, ay, bx, by] = [
      [-frame8, frame8, frame8, frame8],
      [frame8, frame8, frame8, -frame8],
      [frame8, -frame8, -frame8, -frame8],
      [-frame8, -frame8, -frame8, frame8],
    ][k];
    if (!visible(ax, ay, bx, by)) continue;
    walk(g, toX(ax), toY(ay), toX(bx), toY(by), (i, t) => {
      if (Math.floor(t * 60) % 2 === 0) put(g, i, G.mid, 220, 222, 210);
    });
  }
  const lx = toX(-frame8);
  const ly = toY(frame8 + 0.6);
  walk(g, lx, ly, lx, ly, (i) => {
    put(g, i, gi('U'), 220, 222, 210);
    if ((i + 1) % g.cols !== 0) put(g, i + 1, gi('1'), 220, 222, 210);
  });

  // 顶盖下沿刻着的型号
  if (fp < 0.45) {
    const mark = 'BTORN SOFT-1';
    const col = Math.floor((toX(0) + g.aspect / 2) / g.cw - mark.length / 2);
    const row = Math.floor((g.half - toY(-5.62)) / g.ch);
    if (row >= 0 && row < g.rows) {
      for (let k = 0; k < mark.length; k += 1) {
        const c = col + k;
        if (c >= 0 && c < g.cols && mark[k] !== ' ') put(g, row * g.cols + c, gi(mark[k]), 66, 68, 78);
      }
    }
  }

  // 标注：主板上这些东西都是什么
  const show = smooth(204, 214, zz) * (1 - smooth(246, 258, zz));
  if (show > 0.02) {
    const bend = TRACES[14].pts;
    callout(g, toX(9.4), toY(0), toX(9.4) + 0.2, toY(0) + 0.12, 'capacitor', INK, show);
    callout(g, toX(bend[4]), toY(bend[5]), toX(bend[4]) - 0.16, toY(bend[5]) + 0.1, 'copper trace', [236, 196, 120], show);
    callout(g, toX(-4.4), toY(-6), toX(-4.4) - 0.22, toY(-6) - 0.14, 'the chip, under a metal lid', INK, show);
  }
}

/** zz 100..380：穿过屏幕的夹层，落到主板上，再一路钻进芯片顶盖上的黄星星 */
export function drawStack(g: Grid, board: Grid, zz: number) {
  const zc = interpolate(DEPTH, zz);
  const t = g.reduced ? 0 : g.time;
  const boardAlpha = 1 - smooth(0.7, 1.3, BOARD_D - zc);
  if (boardAlpha > 0.01) {
    clearGrid(board);
    board.time = g.time;
    board.reduced = g.reduced;
    drawBoard(board, zz, zc);
  }
  const active = LAYERS.map((layer, index) => {
    const dist = layer.d - zc;
    const near = smooth(0.012, 0.05, dist);
    // 离得远的层先不露面，不然几层叠在一起分不清谁是谁
    const far = 1 - smooth(0.16, 0.42, dist);
    return { index, fov: layer.F * Math.max(dist, 1e-4), alpha: near * far, near };
  }).filter((layer) => layer.alpha > 0.01);

  for (let y = 0; y < g.rows; y += 1) {
    for (let x = 0; x < g.cols; x += 1) {
      const i = y * g.cols + x;
      const th = threshold(x, y);
      let done = false;
      for (const layer of active) {
        const wx = g.ox[x] * layer.fov;
        const wy = g.oy[y] * layer.fov;
        const fp = g.ch * layer.fov;
        if (layer.index === 0) filterLayer(wx, wy);
        else if (layer.index === 1) lcLayer(wx, wy, fp, t, g);
        else if (layer.index === 2) tftLayer(wx, wy, fp, t);
        else backlightLayer(wx, wy, fp);
        if (lcov * layer.alpha <= th) continue;
        const k = 0.4 + 0.6 * layer.near;
        put(g, i, lg, lr * k, lgr * k, lb * k);
        tint(g, i, BG[0] + lr * k * 0.12, BG[1] + lgr * k * 0.12, BG[2] + lb * k * 0.12);
        done = true;
        break;
      }
      if (!done && boardAlpha > 0.01 && boardAlpha > th) {
        const o = i * 4;
        g.fg[o] = board.fg[o];
        g.fg[o + 1] = board.fg[o + 1];
        g.fg[o + 2] = board.fg[o + 2];
        g.fg[o + 3] = board.fg[o + 3];
        g.bg[o] = board.bg[o];
        g.bg[o + 1] = board.bg[o + 1];
        g.bg[o + 2] = board.bg[o + 2];
      }
    }
  }

  // 标注：每一层对上焦的时候，指给人看哪个是什么
  const focus = (centre: number) => 1 - smooth(0.05, 0.1, Math.abs(zc - centre));
  const lc = focus(0.25);
  if (lc > 0.02) {
    const f = LAYERS[1].F * (LAYERS[1].d - zc);
    const o = rodSlot(2, 1, t);
    callout(g, rods[o] / f, rods[o + 1] / f, 0.34, 0.3, 'liquid crystal molecule', INK, lc);
    status(g, 'voltage twists them: light passes, or is blocked', [170, 232, 255], lc);
  }
  const tft = focus(0.5);
  if (tft > 0.02) {
    const f = LAYERS[2].F * (LAYERS[2].d - zc);
    callout(g, 0.26 / f, 0.48 / f, 0.4, 0.34, 'transistor (one per subpixel)', [255, 200, 130], tft);
    callout(g, -1.5 / f, 0, -0.42, 0.2, 'gate line: picks a row', INK, tft);
    callout(g, 1 / f, -1.3 / f, 0.42, -0.3, 'data line: sets the brightness', INK, tft);
    callout(g, -0.5 / f, 1.9 / f, -0.4, 0.4, 'pixel electrode', [150, 180, 230], tft);
  }
  const bl = focus(0.75);
  if (bl > 0.02) {
    const f = LAYERS[3].F * (LAYERS[3].d - zc);
    callout(g, 1.5 / f, 0.866 / f, 0.42, 0.32, 'dot printed on the light guide', INK, bl);
    status(g, 'LED light bounces off these dots, up through the screen', [235, 240, 255], bl);
  }
}
