// 宇宙那几段共用的小画法：往底色上加光、3×2 的小球、一圈小点、一小团星系、一张会被拉开的坐标纸。

import { G } from '../charset';
import { colOf, hash3, plot, put, rowOf, smooth, type Grid } from '../grid';
import type { Rgb } from '../notes';

/** 开头那颗粉色的 O 的颜色：「你在这」也用它 */
export const PINK: Rgb = [255, 95, 143];

/** 先升后降：a 处开始、peak 处最强、c 处回到 0 */
export const bump = (x: number, a: number, peak: number, c: number) => smooth(a, peak, x) * (1 - smooth(peak, c, x));

/** 往底色上加一点光（不是盖掉） */
export function glow(g: Grid, i: number, r: number, gr: number, b: number) {
  const o = i * 4;
  g.bg[o] = Math.min(255, g.bg[o] + r);
  g.bg[o + 1] = Math.min(255, g.bg[o + 1] + gr);
  g.bg[o + 2] = Math.min(255, g.bg[o + 2] + b);
}

/** 一个小球：3 列 × 2 行（▄█▄ / ▀█▀），格子太细，单个字只是一个小点 */
export function ball(g: Grid, x: number, y: number, r: number, gr: number, b: number) {
  const c = colOf(g, x);
  const top = rowOf(g, y + g.ch * 0.5);
  for (let dy = 0; dy < 2; dy += 1) {
    const row = top + dy;
    if (row < 0 || row >= g.rows) continue;
    for (let dx = -1; dx <= 1; dx += 1) {
      const col = c + dx;
      if (col < 0 || col >= g.cols) continue;
      put(g, row * g.cols + col, dx === 0 ? G.full : dy === 0 ? G.bottom : G.top, r, gr, b);
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
