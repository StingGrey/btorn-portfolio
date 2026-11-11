// 从粉色的 O 一路往里：像素 → 子像素 → 穿过屏幕的夹层（彩色滤光片、液晶、TFT 背板、背光）→ 屏幕背后的主板 →
// 芯片顶盖上刻着的小女孩（通电、蹦）→ 镜头对准她的黄星星发夹钻进去。

import { CHIP_GIRL } from '../chipGirl';
import { G, RAMP, gi, lineGlyph } from '../charset';
import { girlFrames } from '../girl';
import { BG, block, clearGrid, hash2, noise2, put, smooth, threshold, tint, walk, type Grid } from '../grid';
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
/** 屏幕上一个点的颜色（0..1）：黑色矩阵、红绿蓝三条子像素；亮着的是粉色 O 的像素 */
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
  const v = lit(px, py) ? (k === 0 ? 1 : k === 1 ? 0.37 : 0.56) : unlit;
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
  if (fpy > 7) {
    // 整个 O 还装不满一格：就是开场留下的那一个字
    const sx = (2.5 - cx) / fov;
    const sy = (3.5 - cy) / fov;
    walk(g, sx, sy, sx, sy, (i) => {
      put(g, i, G.O, 255, 95, 143);
      tint(g, i, 52, 12, 30);
    });
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
    const a = 0.9 * Math.sin(0.31 * i + 0.17 * j) + 0.7 * Math.sin(t * 1.4 + 0.27 * i - 0.22 * j) + (hash2(i + 3, j) - 0.5) * 0.4;
    rods[o] = i + (hash2(i, j) - 0.5) * 0.35;
    rods[o + 1] = j + (hash2(j, i + 7) - 0.5) * 0.35;
    rods[o + 2] = Math.cos(a);
    rods[o + 3] = Math.sin(a);
  }
  return o;
}

/** 液晶：一根根小棍子，排着队扭；跟着电压一阵一阵地转 */
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
      const along = Math.max(-0.36, Math.min(0.36, (wx - px) * dx + (wy - py) * dy));
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
  const reach = 0.08 + fp * 0.5;
  if (best > reach * reach) return;
  lcov = 1;
  lg = fp < 0.05 ? G.full : lineGlyph(bestDx / g.cw, bestDy / g.ch);
  const k = 0.55 + 0.45 * Math.abs(2 * bestDx * bestDy);
  lr = 170 * k;
  lgr = 232 * k;
  lb = 255 * k;
}

/** TFT 背板：栅极线（横）、数据线（竖），每个子像素角上一个晶体管；一行一行地扫 */
function tftLayer(wx: number, wy: number, fp: number, t: number) {
  lcov = 0;
  const fx = wx - Math.floor(wx);
  const ry = wy / 3;
  const row = Math.floor(ry);
  const fy = ry - row;
  const active = Math.floor(t * 7) % 18 === ((row % 18) + 18) % 18;
  const thick = fp < 0.06;
  if (fy < 0.035 || fy > 0.965) {
    lcov = 1;
    lg = thick ? G.full : G.h;
    lr = active ? 140 : 200;
    lgr = active ? 240 : 180;
    lb = active ? 255 : 120;
    return;
  }
  if (fx < 0.05 || fx > 0.95) {
    lcov = 1;
    lg = thick ? G.full : G.v;
    lr = 200;
    lgr = 180;
    lb = 120;
    return;
  }
  if (fx > 0.1 && fx < 0.42 && fy > 0.06 && fy < 0.26) {
    lcov = 1;
    lg = thick ? G.full : G.square;
    lr = active ? 255 : 235;
    lgr = active ? 210 : 140;
    lb = active ? 130 : 70;
    return;
  }
  if (fx > 0.12 && fx < 0.9 && fy > 0.3 && fy < 0.92) {
    lcov = 0.35;
    lg = G.light;
    lr = 70;
    lgr = 100;
    lb = 150;
  }
}

/** 背光的导光板：一片印着小白点的板子，点子大小渐变，周围一圈淡淡的光 */
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
    lg = fp < radius * 0.6 ? G.full : fp < radius * 1.5 ? G.disc : G.o;
    lr = 235;
    lgr = 240;
    lb = 255;
  } else if (best < radius * 2.2) {
    lcov = 0.45;
    lg = G.mid;
    lr = 130;
    lgr = 140;
    lb = 185;
  } else if (hash2(Math.floor(wx * 4), Math.floor(wy * 4)) < 0.12) {
    lcov = 0.3;
    lg = G.dot;
    lr = 50;
    lgr = 60;
    lb = 110;
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

/** 镜头钻进去的黄星星（毫米，顶盖中心为原点） */
const ART = { x0: -5, y1: 5.2, size: 10 };
const STAR_X = ART.x0 + (CHIP_GIRL.star.x / CHIP_GIRL.size) * ART.size;
const STAR_Y = ART.y1 - (CHIP_GIRL.star.y / CHIP_GIRL.size) * ART.size;

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
  const dive = smooth(330, 372, zz);
  const cx = STAR_X * dive;
  const cy = STAR_Y * dive;
  const fp = g.ch * fov;
  const frames = girlFrames();
  // 通电：一道扫描线从上往下扫过去，扫过的地方亮成彩色；通完电开始蹦，镜头要钻星星了就停在最高那一帧
  const power = g.reduced ? (zz >= 290 ? 1 : 0) : smooth(282, 298, zz);
  const bouncing = power >= 1 && zz < 336 && !g.reduced;
  const frame = bouncing ? Math.floor((g.time * 1000) / CHIP_GIRL.delayMs) % CHIP_GIRL.frames : CHIP_GIRL.holdFrame;
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
      // 阻焊绿
      tint(g, i, 10, 40, 25);
      if (hash2(Math.floor(wx * 3), Math.floor(wy * 3)) < 0.16) put(g, i, G.dot, 30, 100, 58);
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
    const far = 1 - smooth(0.35, 0.9, dist);
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
}
