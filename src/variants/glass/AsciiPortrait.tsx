import { useEffect, useRef } from 'react';
import type { Portrait } from './portrait';

/**
 * 把烘焙好的彩色字符画画到一块画布上：每个字用它自己的颜色，后面再垫一层很淡的同色底，
 * 远看是原画的颜色，凑近看全是字。第一次进视口时一行一行“打印”出来，之后就是一张静止的画布。
 */

const FONT = '"VT323", ui-monospace, monospace';
/** 每个字后面垫的底色有多浓：0 只有字，1 就成了马赛克。字只占格子的一小部分，底色负责把原画的颜色撑住 */
const CELL_TINT = 0.5;
/** 字本身最多提亮多少：三个通道按同一个倍数放大（不会把亮的那个通道顶到头、把颜色冲淡） */
const GLYPH_LIFT = 1.32;

const lift = (hex: string, amount = GLYPH_LIFT) => {
  const value = parseInt(hex, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const k = Math.min(amount, 252 / Math.max(r, g, b, 1));
  return `rgb(${Math.round(r * k)} ${Math.round(g * k)} ${Math.round(b * k)})`;
};
/** 细线条格子：底色换成线条自己的深色（压得更实），字用同一个颜色提亮一些，线条字符本身还看得见 */
const INK_TINT = 0.9;
const INK_LIFT = 1.9;

type Props = { portrait: Portrait; reducedMotion: boolean; label: string };

export function AsciiPortrait({ portrait, reducedMotion, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { cols, rows, cell, text, colors } = portrait;
    const inks = portrait.inks ?? {};
    let shownRows = reducedMotion ? rows : 0;
    let drawnRows = 0;
    let frame = 0;
    let started = reducedMotion;

    // 每一格画什么颜色先算好（一万多格，算一次就够），画的时候不再切字符串、不再算提亮
    const total = cols * rows;
    const tintColor: (string | null)[] = new Array(total);
    const tintAlpha = new Float32Array(total);
    const glyphColor: (string | null)[] = new Array(total);
    for (let index = 0; index < total; index += 1) {
      const hex = colors.slice(index * 6, index * 6 + 6);
      // 抠掉的背景：什么都不画
      if (hex === '000000') {
        tintColor[index] = null;
        glyphColor[index] = null;
        continue;
      }
      // 细线条（嘴、眉毛、眼眶、鼻尖）：这一格整个压成线条的深色，旁边亮的皮肤一衬就看出来了
      const ink = inks[index];
      tintColor[index] = `#${ink ?? hex}`;
      tintAlpha[index] = ink ? INK_TINT : CELL_TINT;
      glyphColor[index] = text[index] === ' ' ? null : ink ? lift(ink, INK_LIFT) : lift(hex);
    }

    let cellW = 1;
    let cellH = 1;
    /** 按容器宽度定画布尺寸；尺寸变了返回 true（画布被清空，要全部重画） */
    const layout = () => {
      const width = host.clientWidth;
      if (width <= 0) return false;
      cellW = width / cols;
      cellH = cellW / cell;
      const height = Math.round(cellH * rows);
      const ratio = window.devicePixelRatio || 1;
      if (canvas.width === Math.round(width * ratio) && canvas.height === Math.round(height * ratio)) return false;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.height = `${height}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      return true;
    };

    /** 只画 [from, to) 这几行：逐行显示时每帧只画新冒出来的一两行，不把前面的再画一遍 */
    const drawRows = (from: number, to: number) => {
      ctx.font = `${(cellH * 1.02).toFixed(2)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      for (let y = from; y < to; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const index = y * cols + x;
          const tint = tintColor[index];
          if (!tint) continue;
          ctx.globalAlpha = tintAlpha[index];
          ctx.fillStyle = tint;
          ctx.fillRect(x * cellW, y * cellH, cellW + 0.5, cellH + 0.5);
          const glyph = glyphColor[index];
          if (glyph) {
            ctx.globalAlpha = 1;
            ctx.fillStyle = glyph;
            ctx.fillText(text[index], x * cellW + cellW / 2, y * cellH + cellH * 0.82);
          }
        }
      }
      ctx.globalAlpha = 1;
    };

    const paint = () => {
      // 还没排版（宽度 0）就先不画
      if (host.clientWidth <= 0) return;
      if (layout()) drawnRows = 0;
      if (shownRows > drawnRows) {
        drawRows(drawnRows, shownRows);
        drawnRows = shownRows;
      }
    };

    // 一行一行打出来（约 1 秒），打完就停
    const reveal = () => {
      const t0 = performance.now();
      const step = () => {
        shownRows = Math.min(rows, Math.ceil(((performance.now() - t0) / 1000) * rows));
        paint();
        if (shownRows < rows) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };

    let fontsReady = false;
    document.fonts
      .load(`20px ${FONT}`)
      .catch(() => undefined)
      .then(() => {
        fontsReady = true;
        paint();
      });

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          started = true;
          observer.disconnect();
          if (fontsReady) reveal();
          else document.fonts.ready.then(reveal);
        }
      },
      { threshold: 0.25 },
    );
    if (!started) observer.observe(canvas);
    const resize = new ResizeObserver(() => paint());
    resize.observe(host);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
    };
  }, [portrait, reducedMotion]);

  return (
    <>
      <canvas ref={canvasRef} className="ga-canvas" aria-hidden="true" />
      <p className="sr-only">{label}</p>
    </>
  );
}
