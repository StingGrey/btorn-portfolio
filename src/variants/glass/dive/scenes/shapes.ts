// 宇宙那几段共用的小画法：往底色上加光、3×2 的小球、一圈小点、一小团星系、一张会被拉开的坐标纸。

import { G } from '../charset';
import { clamp01, colOf, hash3, plot, put, rowOf, smooth, type Grid } from '../grid';
import type { Rgb } from '../notes';

/** 开头那颗粉色的 O 的颜色：「你在这」也用它 */
export const PINK: Rgb = [255, 95, 143];

/** 先升后降：a 处开始、peak 处最强、c 处回到 0 */
export const bump = (x: number, a: number, peak: number, c: number) => smooth(a, peak, x) * (1 - smooth(peak, c, x));

/** 往底色上加一点光（不是盖掉）；这一格是上下两个像素（▀）的话，上半格也一起加，不然只亮下半格、看起来是一道道横线 */
export function glow(g: Grid, i: number, r: number, gr: number, b: number) {
  const o = i * 4;
  g.bg[o] = Math.min(255, g.bg[o] + r);
  g.bg[o + 1] = Math.min(255, g.bg[o + 1] + gr);
  g.bg[o + 2] = Math.min(255, g.bg[o + 2] + b);
  if (g.fg[o + 3] === G.top) {
    g.fg[o] = Math.min(255, g.fg[o] + r);
    g.fg[o + 1] = Math.min(255, g.fg[o + 1] + gr);
    g.fg[o + 2] = Math.min(255, g.fg[o + 2] + b);
  }
}

/** 一个小球（格子太细，单个字只是一个小点）：见 orb */
export function ball(g: Grid, x: number, y: number, r: number, gr: number, b: number) {
  orb(g, x, y, r, gr, b);
}

/** 球面打光：光从左上前方来 */
const LX = -0.45;
const LY = -0.55;
const LZ = Math.sqrt(1 - LX * LX - LY * LY);

/**
 * 一个像素小球。用 ▀ 把一格切成上下两个方像素（字色画上半、底色画下半），竖着的分辨率翻一倍；
 * 球心可以落在像素之间（动起来是滑的，不是一格一格跳），边缘按覆盖多少和原来的底色混（不长锯齿），
 * 左上亮、右下暗、带一个小高光，外面再往底色上晕一圈光。radius 以方像素（半格高）为单位。
 */
export function orb(g: Grid, x: number, y: number, r: number, gr: number, b: number, radius = 1.75, halo = 0.45) {
  const pc = (x + g.aspect / 2) / g.cw;
  const ph = (g.half - y) / (g.ch / 2);
  const reach = radius + (halo > 0 ? 3.5 : 0.6);
  const c0 = Math.max(0, Math.floor(pc - reach));
  const c1 = Math.min(g.cols - 1, Math.floor(pc + reach));
  const r0 = Math.max(0, Math.floor((ph - reach) / 2));
  const r1 = Math.min(g.rows - 1, Math.floor((ph + reach) / 2));
  for (let row = r0; row <= r1; row += 1) {
    for (let col = c0; col <= c1; col += 1) {
      const i = row * g.cols + col;
      const o = i * 4;
      const br = g.bg[o];
      const bgg = g.bg[o + 1];
      const bb = g.bg[o + 2];
      const dx = col + 0.5 - pc;
      // 上半格、下半格两个像素
      let hit = false;
      let tr = br;
      let tg = bgg;
      let tb = bb;
      let ur = br;
      let ug = bgg;
      let ub = bb;
      for (let half = 0; half < 2; half += 1) {
        const dy = row * 2 + half + 0.5 - ph;
        const d = Math.sqrt(dx * dx + dy * dy);
        const cover = clamp01(radius - d + 0.5);
        if (cover <= 0) continue;
        hit = true;
        const nx = clamp01(d / radius) * (d > 0 ? dx / d : 0);
        const ny = clamp01(d / radius) * (d > 0 ? dy / d : 0);
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const lambert = Math.max(0, nx * LX + ny * LY + nz * LZ);
        const shade = 0.42 + 0.68 * lambert;
        const spec = lambert ** 18 * 0.55;
        const pr = br + (Math.min(255, r * shade + 255 * spec) - br) * cover;
        const pg = bgg + (Math.min(255, gr * shade + 255 * spec) - bgg) * cover;
        const pb = bb + (Math.min(255, b * shade + 255 * spec) - bb) * cover;
        if (half === 0) {
          tr = pr;
          tg = pg;
          tb = pb;
        } else {
          ur = pr;
          ug = pg;
          ub = pb;
        }
      }
      if (hit) {
        put(g, i, G.top, tr, tg, tb);
        g.bg[o] = Math.min(255, ur);
        g.bg[o + 1] = Math.min(255, ug);
        g.bg[o + 2] = Math.min(255, ub);
        continue;
      }
      if (halo <= 0) continue;
      // 球外面：往底色上晕一圈光（越远越淡）
      const dy = row * 2 + 1 - ph;
      const d = Math.sqrt(dx * dx + dy * dy) - radius;
      const k = halo * Math.exp(-d * 0.9) * 0.35;
      if (k > 0.01) glow(g, i, r * k, gr * k, b * k);
    }
  }
}

/** 一整圈小点（gap > 0 时每隔几个点空一个，画成虚线）；圈大到整个屏幕都装不下时不画（一圈要画几千万个点） */
export function ringAt(g: Grid, cx: number, cy: number, r: number, color: Rgb, flat = 1, gap = 0) {
  if (r <= 0 || r > 3) return;
  const steps = Math.max(10, Math.ceil((r * 2 * Math.PI) / g.cw));
  for (let s = 0; s < steps; s += 1) {
    if (gap > 0 && s % gap !== 0) continue;
    const a = (s / steps) * Math.PI * 2;
    plot(g, cx + Math.cos(a) * r * 1.1, cy + Math.sin(a) * r * flat, G.mid, color[0], color[1], color[2]);
  }
}

/** 一个星系：中间亮、外面淡的一小团（size 是半长轴，flat 是扁的程度） */
export function smudge(g: Grid, cx: number, cy: number, size: number, angle: number, flat: number, color: Rgb, show: number) {
  if (show < 0.03) return;
  if (size < g.ch * 0.7) {
    plot(g, cx, cy, G.star, color[0] * show, color[1] * show, color[2] * show);
    return;
  }
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const c0 = colOf(g, cx - size * 1.2);
  const c1 = colOf(g, cx + size * 1.2);
  const r0 = rowOf(g, cy + size);
  const r1 = rowOf(g, cy - size);
  for (let row = Math.max(0, r0); row <= Math.min(g.rows - 1, r1); row += 1) {
    for (let col = Math.max(0, c0); col <= Math.min(g.cols - 1, c1); col += 1) {
      const dx = (g.ox[col] - cx) / 1.1;
      const dy = g.oy[row] - cy;
      const u = dx * ca + dy * sa;
      const w = (-dx * sa + dy * ca) / flat;
      const d = Math.sqrt(u * u + w * w) / size;
      if (d > 1) continue;
      const k = show * (d < 0.25 ? 1 : 0.85 - d * 0.45);
      put(g, row * g.cols + col, d < 0.25 ? G.at : d < 0.5 ? G.star : d < 0.78 ? G.colon : G.dot, color[0] * k, color[1] * k, color[2] * k);
    }
  }
}

/**
 * 一张被拉开的坐标纸：每一点都在离开其它所有点，格点本身不变大，只是间距越拉越大（镜头放大的话，点会跟着变大）。
 * 一层格点的间距拉到四五倍就淡掉，换更密的一层接上，所以怎么拉都拉不完。z 是拉开了多少。
 */
export function drawSpread(g: Grid, z: number, show: number) {
  if (show < 0.02) return;
  const zd = z * 1.6;
  for (let level = Math.floor(zd) - 2; level <= Math.floor(zd); level += 1) {
    const age = zd - level;
    const w = smooth(0, 0.6, age) * (1 - smooth(1.5, 2.2, age)) * show;
    if (w < 0.03) continue;
    const s = 0.032 * 2 ** age;
    const nx = Math.ceil(g.aspect / 2 / s) + 1;
    const ny = Math.ceil(g.half / s) + 1;
    for (let j = -ny; j <= ny; j += 1) {
      for (let i = -nx; i <= nx; i += 1) {
        const v = w * (0.7 + 0.3 * hash3(i + 7, j, level));
        plot(g, i * s * 1.1, j * s, G.plus, 225 * v, 232 * v, 255 * v);
      }
    }
  }
}
