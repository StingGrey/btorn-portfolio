// 开始掉字的那一刻：把页脚（DOM 文字 + 字符画画布）换成画布上一模一样的一堆字。
// 文字逐个字量出它在屏幕上的盒子；字符画按烘焙数据重新算一遍每一格（和 AsciiPortrait 的配色一模一样）。

import type { Portrait } from '../portrait';
import type { FontMetrics } from './atlas';
import { gi } from './charset';
import { hash1 } from './grid';
import type { FreeGlyph } from './renderer';

// 这几个数和 AsciiPortrait 里的一致：底色浓度、字的提亮
const CELL_TINT = 0.5;
const GLYPH_LIFT = 1.32;
const INK_TINT = 0.9;
const INK_LIFT = 1.9;

const parseColor = (css: string): [number, number, number] => {
  const m = css.match(/[\d.]+/g);
  return m && m.length >= 3 ? [Number(m[0]), Number(m[1]), Number(m[2])] : [233, 226, 245];
};

const hexColor = (hex: string): [number, number, number] => {
  const value = parseInt(hex, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const lift = (hex: string, amount: number): [number, number, number] => {
  const [r, g, b] = hexColor(hex);
  const k = Math.min(amount, 252 / Math.max(r, g, b, 1));
  return [Math.round(r * k), Math.round(g * k), Math.round(b * k)];
};

export type FooterCapture = {
  glyphs: FreeGlyph[];
  /** 粉色 O 的中心（相对舞台的 CSS 像素）；看不见就是 null */
  pink: [number, number] | null;
};

export function captureFooter(footer: HTMLElement, stage: HTMLElement, portrait: Portrait | null, metrics: FontMetrics): FooterCapture {
  const origin = stage.getBoundingClientRect();
  const height = origin.height;
  const glyphs: FreeGlyph[] = [];
  // 同一竖列（按 6px 归一）用同一个开始时间，一列一列地掉
  const delays = new Map<number, number>();
  const delayFor = (x: number) => {
    const key = Math.round(x / 6);
    let delay = delays.get(key);
    if (delay === undefined) {
      delay = hash1(key * 7 + 3) * 0.62;
      delays.set(key, delay);
    }
    return delay;
  };
  const lagFor = (y: number) => (1 - Math.min(Math.max(y / height, 0), 1)) * 0.07;
  const seedFor = () => hash1(glyphs.length + 11) * 1000;
  let pinkX = 0;
  let pinkY = 0;
  let pinkCount = 0;

  /* ---------- 文字：Logo、标语、边框小窗、小字 ---------- */
  const walker = document.createTreeWalker(footer, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || parent.closest('.sr-only, .ga-portrait, .ga-loose')) continue;
    const line = parent.closest('.ga-ln') as HTMLElement | null;
    if (line && Number(getComputedStyle(line).opacity) < 0.05) continue;
    const color = parseColor(getComputedStyle(parent).color);
    const pink = parent.dataset.tone === 'pink';
    const text = node.textContent ?? '';
    for (let k = 0; k < text.length; k += 1) {
      const ch = text[k];
      if (ch === ' ' || ch === '\n' || ch === '\t') continue;
      range.setStart(node, k);
      range.setEnd(node, k + 1);
      const rect = range.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      const x = rect.left - origin.left;
      const y = rect.top - origin.top;
      if (y > height + 4 || y + rect.height < -height) continue;
      const visible = y + rect.height > 0 && y < height;
      if (pink && visible) {
        pinkX += x + rect.width / 2;
        pinkY += y + rect.height / 2;
        pinkCount += 1;
      }
      glyphs.push({
        x,
        y,
        w: rect.width,
        h: rect.height,
        glyph: gi(ch),
        fg: color,
        bg: color,
        tint: 0,
        delay: delayFor(x + rect.width / 2),
        lag: lagFor(y),
        stay: pink && visible,
        seed: seedFor(),
      });
    }
  }

  /* ---------- 标语后面那个粉色的光标 ---------- */
  const cursor = footer.querySelector('.ga-cursor');
  if (cursor) {
    const rect = cursor.getBoundingClientRect();
    if (rect.width > 0) {
      const x = rect.left - origin.left;
      const y = rect.top - origin.top;
      const color = parseColor(getComputedStyle(cursor).backgroundColor);
      glyphs.push({ x, y, w: rect.width, h: rect.height, glyph: gi('█'), fg: color, bg: color, tint: 0, delay: delayFor(x), lag: lagFor(y), stay: false, seed: seedFor() });
    }
  }

  /* ---------- 左边的字符画：每格一块底色 + 一个字 ---------- */
  const canvas = footer.querySelector('.ga-canvas');
  if (portrait && canvas) {
    const rect = canvas.getBoundingClientRect();
    const { cols, rows, cell, text, colors } = portrait;
    const inks = portrait.inks ?? {};
    const cellW = rect.width / cols;
    const cellH = cellW / cell;
    const size = cellH * 1.02;
    const boxW = metrics.advance * size;
    const boxH = (metrics.ascent + metrics.descent) * size;
    for (let index = 0; index < cols * rows; index += 1) {
      const hex = colors.slice(index * 6, index * 6 + 6);
      if (hex === '000000') continue;
      const x = rect.left - origin.left + (index % cols) * cellW;
      const y = rect.top - origin.top + Math.floor(index / cols) * cellH;
      if (y > height + 4 || y + cellH < -height || x > origin.width || x + cellW < 0) continue;
      const ink = inks[index];
      const delay = delayFor(x + cellW / 2);
      const lag = lagFor(y);
      const seed = seedFor();
      glyphs.push({ x, y, w: cellW + 0.4, h: cellH + 0.4, glyph: 0, fg: [0, 0, 0], bg: hexColor(ink ?? hex), tint: ink ? INK_TINT : CELL_TINT, delay, lag, stay: false, seed });
      if (text[index] !== ' ') {
        glyphs.push({
          x: x + cellW / 2 - boxW / 2,
          y: y + cellH * 0.82 - metrics.ascent * size,
          w: boxW,
          h: boxH,
          glyph: gi(text[index]),
          fg: ink ? lift(ink, INK_LIFT) : lift(hex, GLYPH_LIFT),
          bg: [0, 0, 0],
          tint: 0,
          delay,
          lag,
          stay: false,
          seed: seed + 0.5,
        });
      }
    }
  }

  return { glyphs, pink: pinkCount > 0 ? [pinkX / pinkCount, pinkY / pinkCount] : null };
}
