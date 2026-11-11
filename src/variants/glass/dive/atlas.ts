// 字形图集：把字形表里的每个字画进一张 2D 画布，传给 GPU 当纹理（只在尺寸变化时画一次，不是每帧画）。
// 两种：
//   网格图集 —— 格子正好是屏幕上一个字的物理像素大小，GPU 上按像素直接取，VT323 的像素感不会被糊掉；
//   自由图集 —— 大字号、带边距和多级纹理，给页脚掉下去的那些大小不一的字用。

import { FONT_COUNT, GLYPH_COUNT, glyphChar } from './charset';

export const FONT = '"VT323", ui-monospace, monospace';
export const ATLAS_COLUMNS = 16;

export type FontMetrics = { advance: number; ascent: number; descent: number };

/** VT323 的字宽、上下高度（都是相对字号的比例），和 DOM 里一个字的盒子是同一套量法 */
export function measureFont(): FontMetrics {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return { advance: 0.5, ascent: 0.8, descent: 0.2 };
  ctx.font = `100px ${FONT}`;
  const m = ctx.measureText('M');
  return {
    advance: m.width / 100,
    ascent: (m.fontBoundingBoxAscent || 80) / 100,
    descent: (m.fontBoundingBoxDescent || 20) / 100,
  };
}

/** 方块、框线、圆点：在 (x, y, w, h) 这个盒子里画 */
function drawShape(ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, w: number, h: number) {
  const unit = Math.max(1, Math.round(h / 12));
  const pattern = (on: (i: number, j: number) => boolean) => {
    for (let j = 0; j * unit < h; j += 1) {
      for (let i = 0; i * unit < w; i += 1) {
        if (on(i, j)) ctx.fillRect(x + i * unit, y + j * unit, Math.min(unit, w - i * unit), Math.min(unit, h - j * unit));
      }
    }
  };
  const t = Math.max(1, Math.round(w * 0.17));
  const cx = x + Math.round(w / 2 - t / 2);
  const cy = y + Math.round(h / 2 - t / 2);
  const hLine = (from: number, to: number, yy = cy) => ctx.fillRect(x + from * w, yy, (to - from) * w, t);
  const vLine = (from: number, to: number, xx = cx) => ctx.fillRect(xx, y + from * h, t, (to - from) * h);
  const gap = Math.max(t + 1, Math.round(w * 0.2));
  const r = Math.min(w, h) / 2;
  switch (ch) {
    case '█':
      ctx.fillRect(x, y, w, h);
      break;
    case '▓':
      pattern((i, j) => (i + j * 2) % 4 !== 0);
      break;
    case '▒':
      pattern((i, j) => (i + j) % 2 === 0);
      break;
    case '░':
      pattern((i, j) => i % 2 === 0 && j % 2 === 0);
      break;
    case '▀':
      ctx.fillRect(x, y, w, Math.round(h / 2));
      break;
    case '▄':
      ctx.fillRect(x, y + Math.round(h / 2), w, h - Math.round(h / 2));
      break;
    case '▌':
      ctx.fillRect(x, y, Math.round(w / 2), h);
      break;
    case '▐':
      ctx.fillRect(x + Math.round(w / 2), y, w - Math.round(w / 2), h);
      break;
    case '─':
      hLine(0, 1);
      break;
    case '│':
      vLine(0, 1);
      break;
    case '┌':
      ctx.fillRect(cx, cy, x + w - cx, t);
      ctx.fillRect(cx, cy, t, y + h - cy);
      break;
    case '┐':
      ctx.fillRect(x, cy, cx + t - x, t);
      ctx.fillRect(cx, cy, t, y + h - cy);
      break;
    case '└':
      ctx.fillRect(cx, cy, x + w - cx, t);
      ctx.fillRect(cx, y, t, cy + t - y);
      break;
    case '┘':
      ctx.fillRect(x, cy, cx + t - x, t);
      ctx.fillRect(cx, y, t, cy + t - y);
      break;
    case '├':
      vLine(0, 1);
      ctx.fillRect(cx, cy, x + w - cx, t);
      break;
    case '┤':
      vLine(0, 1);
      ctx.fillRect(x, cy, cx + t - x, t);
      break;
    case '┬':
      hLine(0, 1);
      ctx.fillRect(cx, cy, t, y + h - cy);
      break;
    case '┴':
      hLine(0, 1);
      ctx.fillRect(cx, y, t, cy + t - y);
      break;
    case '┼':
      hLine(0, 1);
      vLine(0, 1);
      break;
    case '═':
      hLine(0, 1, cy - gap / 2);
      hLine(0, 1, cy + gap / 2);
      break;
    case '║':
      vLine(0, 1, cx - gap / 2);
      vLine(0, 1, cx + gap / 2);
      break;
    case '╬':
      hLine(0, 1, cy - gap / 2);
      hLine(0, 1, cy + gap / 2);
      vLine(0, 1, cx - gap / 2);
      vLine(0, 1, cx + gap / 2);
      break;
    case '●':
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, r * 0.78, 0, Math.PI * 2);
      ctx.fill();
      break;
    case '○':
      ctx.lineWidth = t;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, r * 0.72 - t / 2, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case '■': {
      const s = r * 1.3;
      ctx.fillRect(x + w / 2 - s / 2, y + h / 2 - s / 2, s, s);
      break;
    }
    case '□': {
      const s = r * 1.4;
      ctx.lineWidth = t;
      ctx.strokeRect(x + w / 2 - s / 2 + t / 2, y + h / 2 - s / 2 + t / 2, s - t, s - t);
      break;
    }
    case '◆':
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y + h / 2 - r * 0.95);
      ctx.lineTo(x + w / 2 + r * 0.8, y + h / 2);
      ctx.lineTo(x + w / 2, y + h / 2 + r * 0.95);
      ctx.lineTo(x + w / 2 - r * 0.8, y + h / 2);
      ctx.closePath();
      ctx.fill();
      break;
    case '★': {
      ctx.beginPath();
      for (let k = 0; k < 10; k += 1) {
        const a = -Math.PI / 2 + (k * Math.PI) / 5;
        const rr = k % 2 === 0 ? r * 0.95 : r * 0.4;
        const px = x + w / 2 + Math.cos(a) * rr;
        const py = y + h / 2 + Math.sin(a) * rr;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    default:
      break;
  }
}

export type Atlas = {
  canvas: HTMLCanvasElement;
  /** 一个格子（含边距）多大，物理像素 */
  cellW: number;
  cellH: number;
  /** 格子里四周留多少边距 */
  pad: number;
  /** 字的盒子 */
  boxW: number;
  boxH: number;
};

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  return { canvas, ctx };
}

/**
 * 网格图集：一个格子 = 屏幕上一个字的物理像素（cw × ch，不留边距）。
 * 字号和页脚那幅字符画一样取格子高度的 1.02 倍、基线在 0.82 处，两边的字长得一模一样。
 */
export function gridAtlas(cw: number, ch: number): Atlas {
  const rows = Math.ceil(GLYPH_COUNT / ATLAS_COLUMNS);
  const { canvas, ctx } = makeCanvas(cw * ATLAS_COLUMNS, ch * rows);
  ctx.font = `${(ch * 1.02).toFixed(2)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (let index = 1; index < GLYPH_COUNT; index += 1) {
    const x = (index % ATLAS_COLUMNS) * cw;
    const y = Math.floor(index / ATLAS_COLUMNS) * ch;
    const ch2 = glyphChar(index);
    if (index < FONT_COUNT) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, cw, ch);
      ctx.clip();
      ctx.fillText(ch2, x + cw / 2, y + ch * 0.82);
      ctx.restore();
    } else drawShape(ctx, ch2, x, y, cw, ch);
  }
  return { canvas, cellW: cw, cellH: ch, pad: 0, boxW: cw, boxH: ch };
}

/** 自由图集：字盒子 = 字宽 × (上高 + 下深)，和 DOM 里量出来的一个字的矩形是同一个比例 */
export function freeAtlas(metrics: FontMetrics, size = 48): Atlas {
  const pad = 8;
  const boxW = Math.ceil(metrics.advance * size);
  const boxH = Math.ceil((metrics.ascent + metrics.descent) * size);
  const cellW = boxW + pad * 2;
  const cellH = boxH + pad * 2;
  const rows = Math.ceil(GLYPH_COUNT / ATLAS_COLUMNS);
  const { canvas, ctx } = makeCanvas(cellW * ATLAS_COLUMNS, cellH * rows);
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (let index = 1; index < GLYPH_COUNT; index += 1) {
    const x = (index % ATLAS_COLUMNS) * cellW + pad;
    const y = Math.floor(index / ATLAS_COLUMNS) * cellH + pad;
    const ch = glyphChar(index);
    if (index < FONT_COUNT) ctx.fillText(ch, x + boxW / 2, y + metrics.ascent * size);
    else drawShape(ctx, ch, x, y, boxW, boxH);
  }
  return { canvas, cellW, cellH, pad, boxW, boxH };
}
