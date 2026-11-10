// 电视里播放的「梦境分类」控制台：在 2D 画布上按 4:3 重画一遍 DOM 版的样子，给 CRT 屏幕当纹理。

import type { ConsoleCopy } from '../../../components/DreamConsole';

export const CONSOLE_W = 1024;
export const CONSOLE_H = 768;
/** 画布按 2 倍分辨率画（坐标还是 1024 × 768）：镜头拉近、屏幕铺满整个视口时也不糊 */
const SCALE = 2;

export type ConsoleState = {
  index: number;
  previous: number;
  /** 0..1，切换分类的过场 */
  switchT: number;
  time: number;
  playing: boolean;
  seconds: number;
  /** 0..1，盖在画面上的雪花（换台、和控制台交接时） */
  snow?: number;
};

type Images = HTMLImageElement[];

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
/** 竖排大标题的字号，以及一列最多能占的长度（再长就整体缩小） */
const TITLE_SIZE = 118;
const TITLE_ROOM = CONSOLE_H - 70 - 190;

function tinted(image: HTMLImageElement, color: string) {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(image, 0, 0);
  return canvas;
}

/** 铺满取景；focusY 是“离图片底部的比例”（0.7 = 偏上，留住脸） */
function coverRect(sourceW: number, sourceH: number, x: number, y: number, w: number, h: number, focusY = 0.5) {
  const scale = Math.max(w / sourceW, h / sourceH);
  const dw = sourceW * scale;
  const dh = sourceH * scale;
  const fromTop = 1 - focusY;
  const dy = Math.min(y, Math.max(y + h - dh, y + h / 2 - fromTop * dh));
  return { dx: x + (w - dw) / 2, dy, dw, dh };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  });
  if (line) lines.push(line);
  return lines;
}

export function createConsoleRenderer(images: Images, copy: ConsoleCopy, focus: number[]) {
  const canvas = document.createElement('canvas');
  canvas.width = CONSOLE_W * SCALE;
  canvas.height = CONSOLE_H * SCALE;
  const ctx = canvas.getContext('2d')!;
  const reds = images.map((image) => tinted(image, '#ff2a5c'));
  const blues = images.map((image) => tinted(image, '#22e6ff'));

  // 平时每帧画的都是同一张「大图 + 红蓝错位」：三次全幅缩放绘制，其中两次还是 screen 混合。
  // 把它合成好存起来（每个分类一张，用到才合），平时一帧只贴一次图
  const composed: (HTMLCanvasElement | undefined)[] = [];
  const composedMedia = (index: number) => {
    let cached = composed[index];
    if (!cached) {
      cached = document.createElement('canvas');
      cached.width = CONSOLE_W * SCALE;
      cached.height = CONSOLE_H * SCALE;
      const target = cached.getContext('2d')!;
      target.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      paintMedia(target, index, 1, 0);
      composed[index] = cached;
    }
    return cached;
  };

  const drawMedia = (index: number, alpha: number, jitter: number) => paintMedia(ctx, index, alpha, jitter);
  const paintMedia = (ctx: CanvasRenderingContext2D, index: number, alpha: number, jitter: number) => {
    const image = images[index];
    const { dx, dy, dw, dh } = coverRect(image.naturalWidth, image.naturalHeight, 180, -30, CONSOLE_W - 150, CONSOLE_H + 60, focus[index]);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(image, dx + jitter, dy, dw, dh);
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = alpha * 0.42;
    ctx.drawImage(reds[index], dx - 9 - jitter * 2, dy + 2, dw, dh);
    ctx.drawImage(blues[index], dx + 9 + jitter * 2, dy - 2, dw, dh);
    ctx.restore();
  };

  // 雪花：几张事先生成好的小噪点图，每次随机挑一张、不做平滑地放大铺满（一粒约 6px），比逐像素现算便宜得多
  const snowTiles: HTMLCanvasElement[] = [];
  const snowTile = () => {
    if (snowTiles.length === 0) {
      for (let tile = 0; tile < 6; tile += 1) {
        const noise = document.createElement('canvas');
        noise.width = 160;
        noise.height = 120;
        const noiseCtx = noise.getContext('2d')!;
        const pixels = noiseCtx.createImageData(noise.width, noise.height);
        for (let offset = 0; offset < pixels.data.length; offset += 4) {
          const value = Math.random() * 255;
          pixels.data[offset] = value;
          pixels.data[offset + 1] = value;
          pixels.data[offset + 2] = value;
          pixels.data[offset + 3] = 255;
        }
        noiseCtx.putImageData(pixels, 0, 0);
        snowTiles.push(noise);
      }
    }
    return snowTiles[Math.floor(Math.random() * snowTiles.length)];
  };

  const draw = (state: ConsoleState) => {
    const item = copy.items[state.index];
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#070709';
    ctx.fillRect(0, 0, CONSOLE_W, CONSOLE_H);
    const glow = ctx.createRadialGradient(CONSOLE_W * 0.55, CONSOLE_H * 0.48, 20, CONSOLE_W * 0.55, CONSOLE_H * 0.48, CONSOLE_W * 0.6);
    glow.addColorStop(0, 'rgba(255, 78, 150, 0.22)');
    glow.addColorStop(1, 'rgba(255, 78, 150, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CONSOLE_W, CONSOLE_H);

    // 大图：切换时旧图撕成横条退场，新图从中间的细条展开
    const t = state.switchT;
    if (t < 1 && state.previous !== state.index) {
      drawMedia(state.previous, 1 - t, (1 - t) * 30);
      ctx.save();
      ctx.beginPath();
      const open = Math.min(1, t * 1.6);
      ctx.rect(0, CONSOLE_H * (0.5 - open / 2), CONSOLE_W, CONSOLE_H * open);
      ctx.clip();
      drawMedia(state.index, 1, (1 - t) * -24);
      ctx.restore();
    } else {
      ctx.drawImage(composedMedia(state.index), Math.sin(state.time * 1.3) * 2, 0, CONSOLE_W, CONSOLE_H);
    }

    // 左侧索引栏
    const strip = ctx.createLinearGradient(0, 0, 250, 0);
    strip.addColorStop(0, 'rgba(10, 6, 10, 0.96)');
    strip.addColorStop(1, 'rgba(10, 6, 10, 0.55)');
    ctx.fillStyle = strip;
    ctx.fillRect(0, 0, 250, CONSOLE_H);
    ctx.fillStyle = '#f7f3f6';
    ctx.beginPath();
    ctx.arc(42, 66, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `700 30px ${MONO}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(copy.heading, 62, 66);
    copy.items.forEach((entry, index) => {
      const active = index === state.index;
      ctx.font = `700 ${active ? 21 : 19}px ${MONO}`;
      ctx.fillStyle = active ? '#ffffff' : 'rgba(247, 243, 246, 0.62)';
      const y = 122 + index * 40;
      ctx.fillText(`${entry.id}: ${entry.label}`, active ? 40 : 34, y);
      if (active && Math.floor(state.time * 2) % 2 === 0) {
        ctx.fillStyle = '#68f6ff';
        ctx.fillText('←', 40 + ctx.measureText(`${entry.id}: ${entry.label} `).width, y);
      }
    });

    // 竖排大标题：粉色字 + 红蓝错位。和 DOM 版一样一个词占一列、从下往上读；
    // 之前整句排成一列，CANDY HEART、DREAMY FRAMES 这种长标题会顶出屏幕上沿被截掉
    const words = item.label.split(' ');
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.font = `900 ${TITLE_SIZE}px ${MONO}`;
    const longest = Math.max(...words.map((word) => ctx.measureText(word).width));
    const titleSize = Math.floor(TITLE_SIZE * Math.min(1, TITLE_ROOM / longest));
    ctx.font = `900 ${titleSize}px ${MONO}`;
    ctx.globalAlpha = 0.9;
    words.forEach((word, column) => {
      ctx.save();
      ctx.translate(250 + column * titleSize * 0.84, CONSOLE_H - 70);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#ff164b';
      ctx.fillText(word, -4, 0);
      ctx.fillStyle = '#00eaff';
      ctx.fillText(word, 4, 0);
      ctx.fillStyle = 'rgba(255, 196, 214, 0.92)';
      ctx.fillText(word, 0, 0);
      ctx.restore();
    });
    ctx.restore();

    // 绿色扫描线
    const lineY = (0.12 + 0.76 * ((state.time * 0.07) % 1)) * CONSOLE_H;
    ctx.fillStyle = 'rgba(99, 255, 119, 0.85)';
    ctx.shadowColor = 'rgba(99, 255, 119, 0.9)';
    ctx.shadowBlur = 14;
    ctx.fillRect(0, lineY, CONSOLE_W, 3);
    ctx.shadowBlur = 0;

    // 右下角弹窗
    const cardX = 586;
    const cardY = 402;
    const cardW = 400;
    const cardH = 318;
    ctx.fillStyle = 'rgba(244, 242, 251, 0.56)';
    ctx.fillRect(cardX + 16, cardY + 16, cardW, cardH);
    ctx.fillStyle = 'rgba(244, 242, 251, 0.82)';
    ctx.fillRect(cardX + 8, cardY + 8, cardW, cardH);
    ctx.fillStyle = '#f4f2fb';
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.strokeStyle = '#7c7b83';
    ctx.lineWidth = 2;
    ctx.strokeRect(cardX, cardY, cardW, cardH);
    ctx.beginPath();
    ctx.moveTo(cardX, cardY + 40);
    ctx.lineTo(cardX + cardW, cardY + 40);
    ctx.stroke();
    ctx.fillStyle = '#101016';
    ctx.font = `500 19px ${MONO}`;
    ctx.fillText(item.file, cardX + 14, cardY + 21);
    ctx.font = `400 24px ${MONO}`;
    ctx.fillText('×', cardX + cardW - 30, cardY + 21);
    ctx.font = `600 31px "Fredoka", ui-rounded, system-ui, sans-serif`;
    ctx.fillText(item.title, cardX + 26, cardY + 84);
    ctx.font = `400 17px "Fredoka", ui-rounded, system-ui, sans-serif`;
    wrap(ctx, item.desc, cardW - 52)
      .slice(0, 4)
      .forEach((line, index) => ctx.fillText(line, cardX + 26, cardY + 132 + index * 26));
    ctx.fillStyle = '#08090b';
    const ctaW = ctx.measureText(`${item.cta} →`).width + 36;
    ctx.beginPath();
    ctx.roundRect(cardX + 26, cardY + cardH - 74, ctaW, 38, 19);
    ctx.fill();
    ctx.fillStyle = '#f4f2fb';
    ctx.font = `500 16px ${MONO}`;
    ctx.fillText(`${item.cta} →`, cardX + 44, cardY + cardH - 55);
    ctx.fillStyle = '#101016';
    let barX = cardX + cardW - 170;
    for (let index = 0; index < 34; index += 1) {
      const w = index % 5 === 0 ? 4 : index % 3 === 0 ? 3 : 2;
      ctx.fillRect(barX, cardY + cardH - 72, w, 36);
      barX += w + (index % 4 === 0 ? 4 : 2);
    }

    // 播放状态 + 时间码
    ctx.fillStyle = '#f7f3f6';
    ctx.font = `800 21px ${MONO}`;
    const blink = Math.floor(state.time * 1.6) % 2 === 0;
    if (blink || !state.playing) {
      ctx.fillText(state.playing ? copy.playing : copy.paused, 40, CONSOLE_H - 88);
      const labelW = ctx.measureText(state.playing ? copy.playing : copy.paused).width;
      ctx.beginPath();
      if (state.playing) {
        ctx.moveTo(52 + labelW, CONSOLE_H - 98);
        ctx.lineTo(66 + labelW, CONSOLE_H - 88);
        ctx.lineTo(52 + labelW, CONSOLE_H - 78);
        ctx.fill();
      } else {
        ctx.fillRect(52 + labelW, CONSOLE_H - 98, 5, 20);
        ctx.fillRect(62 + labelW, CONSOLE_H - 98, 5, 20);
      }
    }
    const total = Math.floor(state.seconds * 100);
    const mm = String(Math.floor(total / 6000) % 60).padStart(2, '0');
    const ss = String(Math.floor(total / 100) % 60).padStart(2, '0');
    const ff = String(total % 100).padStart(2, '0');
    ctx.fillText(`00.${mm}.${ss}.${ff}`, 40, CONSOLE_H - 46);
    ctx.restore();

    const snow = Math.min(Math.max(state.snow ?? 0, 0), 1);
    if (snow > 0.01) {
      ctx.save();
      // 信号越差，画面本身也跟着往旁边错开几条
      if (snow > 0.25) {
        for (let band = 0; band < 3; band += 1) {
          const y = Math.floor(Math.random() * (CONSOLE_H - 60));
          const h = 14 + Math.floor(Math.random() * 46);
          ctx.drawImage(canvas, 0, y * SCALE, CONSOLE_W * SCALE, h * SCALE, (Math.random() - 0.5) * 70 * snow, y, CONSOLE_W, h);
        }
      }
      ctx.globalAlpha = snow;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(snowTile(), 0, 0, CONSOLE_W, CONSOLE_H);
      ctx.restore();
    }
  };

  return { canvas, draw };
}
