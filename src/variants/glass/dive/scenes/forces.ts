// 四种力的「家谱」：横轴是时间（对数刻度），一开始可能是拧在一起的一股；
// 10^-43 s 引力先分出去，10^-36 s 强力分出去（暴胀跟着开始），10^-12 s 剩下的弱力和电磁力也分开（希格斯场打开那一刻）。
// 「一开始是同一种力」是物理学家的猜想，图上的字也是这么写的。图只画到「现在」，线头上一颗亮点。

import { G, lineGlyph } from '../charset';
import { plot, put, smooth, walk, type Grid } from '../grid';
import { note, type Rgb } from '../notes';
import { interpolate } from '../timeline';

/** 时间（log10 秒）→ 图上从左到右的位置（0..1）：几次分家隔得开一点，别挤在一起 */
const AXIS: [number, number][] = [
  [-44, 0],
  [-43, 0.14],
  [-36, 0.5],
  [-12, 0.9],
  [-10, 1],
];

type Strand = { name: string; color: Rgb; split: number; lane: number };
const STRANDS: Strand[] = [
  { name: 'gravity', color: [255, 214, 140], split: -43, lane: 2.4 },
  { name: 'strong force', color: [255, 110, 150], split: -36, lane: -2.4 },
  { name: 'weak force', color: [140, 255, 170], split: -12, lane: 1.1 },
  { name: 'electromagnetism', color: [130, 205, 255], split: -12, lane: -1.1 },
];
const INK: Rgb = [236, 230, 250];

export type ForceView = {
  /** 图的左右两端、中线（屏幕坐标） */
  left: number;
  right: number;
  y: number;
  /** 分开以后每一股之间隔多远 */
  lane: number;
  /** 现在是什么时候（log10 秒）：图只画到这 */
  log: number;
  show: number;
  /** 字的透明度；compact 时只写最后一次分家 */
  labels: number;
  compact: boolean;
};

export function drawForces(g: Grid, v: ForceView, time: number) {
  if (v.show < 0.03) return;
  const width = v.right - v.left;
  const head = interpolate(AXIS, v.log);
  const end = v.left + head * width;
  const twist = v.lane * 0.42;
  const xAt = (log: number) => v.left + interpolate(AXIS, log) * width;
  STRANDS.forEach((s, k) => {
    const from = interpolate(AXIS, s.split);
    let px = 0;
    let py = 0;
    let first = true;
    for (let x = v.left; x <= end + 1e-6; x += g.cw) {
      const f = (x - v.left) / width;
      const free = smooth(from, from + 0.07, f);
      // 还没分开的时候四股拧在一起；分开以后各走各的一条
      const braid = Math.sin((f / 0.045) * Math.PI + k * Math.PI * 0.5 - time * 1.6);
      const y = v.y + braid * twist * (1 - free) + s.lane * v.lane * free;
      if (!first) {
        const glyph = lineGlyph((x - px) / g.cw, (y - py) / g.ch);
        const c = v.show * (0.75 + 0.25 * free);
        walk(g, px, py, x, y, (i) => put(g, i, glyph, s.color[0] * c, s.color[1] * c, s.color[2] * c));
      }
      px = x;
      py = y;
      first = false;
    }
    if (!first) plot(g, px, py, G.star, 255 * v.show, 255 * v.show, 255 * v.show);
  });
  // 还没发生的那一截：虚虚的一条，画到弱力和电磁力分家的地方
  if (!v.compact && head < 0.9) {
    const stop = xAt(-12);
    for (let x = end + g.cw * 3; x < stop; x += g.cw * 3) plot(g, x, v.y, G.mid, 110 * v.show, 110 * v.show, 140 * v.show);
    note(g, stop, v.y, '?', [170, 170, 200], 0.5, v.show * smooth(0.52, 0.58, head));
  }
  if (v.labels < 0.03) return;
  const label = (text: string, x: number, y: number, color: Rgb, show: number) => note(g, x, y, text, color, 0, show * v.labels);
  if (!v.compact) {
    label('all four forces, maybe one to begin with', v.left, v.y + v.lane * 3.8, INK, 1 - smooth(0.3, 0.42, head));
    label('gravity splits off · 10^-43 s', xAt(-43) + 0.05, v.y + 2.4 * v.lane + 0.03, STRANDS[0].color, smooth(0.17, 0.23, head));
    label('the strong force splits off · 10^-36 s', xAt(-36) + 0.05, v.y - 2.4 * v.lane - 0.03, STRANDS[1].color, smooth(0.52, 0.56, head));
    label('weak force + electromagnetism: still one', xAt(-36) + 0.07, v.y + twist + 0.035, [200, 236, 220], smooth(0.56, 0.6, head));
    return;
  }
  label('gravity', v.left + 0.02, v.y + 2.4 * v.lane + 0.02, STRANDS[0].color, 1);
  label('strong force', v.left + 0.02, v.y - 2.4 * v.lane - 0.02, STRANDS[1].color, 1);
  label('weak force splits off · 10^-12 s', xAt(-12) + 0.04, v.y + 1.1 * v.lane + 0.025, STRANDS[2].color, smooth(0.9, 0.93, head));
  label('electromagnetism', xAt(-12) + 0.04, v.y - 1.1 * v.lane - 0.025, STRANDS[3].color, smooth(0.9, 0.93, head));
}
