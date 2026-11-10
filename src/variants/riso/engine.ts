// 孔版（Riso）印刷模拟：把看板娘拆成三块版（荧光粉 / 中蓝 / 黄），每块版用网点、线条或砂目重新排出来，再错版叠印。

export type Ink = 'pink' | 'blue' | 'yellow';
export type Screen = 'dot' | 'line' | 'grain';

export const INKS: Record<Ink, { name: string; css: string }> = {
  pink: { name: '荧光粉', css: '#ff48b0' },
  blue: { name: '中蓝', css: '#3255a4' },
  yellow: { name: '黄', css: '#ffe800' },
};

export const SCREEN_NAMES: Record<Screen, string> = {
  dot: '网点',
  line: '线条',
  grain: '砂目',
};

export type PrintParams = {
  inks: Ink[];
  fountain: boolean;
  screen: Screen;
  /** 网格大小，单位是原图像素 */
  cell: number;
  angles: Record<Ink, number>;
  /** 错版位移，单位是原图像素 */
  offsets: Record<Ink, [number, number]>;
  seed: number;
};

export type Source = {
  width: number;
  height: number;
  coverage: Record<Ink, Float32Array>;
};

const SOURCE_WIDTH = 320;
export const MARGIN = 0.07;

export async function loadSource(src: string): Promise<Source> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`无法载入 ${src}`));
    image.src = src;
  });
  const width = SOURCE_WIDTH;
  const height = Math.round((image.naturalHeight / image.naturalWidth) * width);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  const size = width * height;
  const pink = new Float32Array(size);
  const blue = new Float32Array(size);
  const yellow = new Float32Array(size);
  const shape = (value: number) => Math.min(Math.max((value - 0.02) * 1.6, 0), 1) ** 0.85;
  for (let index = 0; index < size; index += 1) {
    const r = data[index * 4] / 255;
    const g = data[index * 4 + 1] / 255;
    const b = data[index * 4 + 2] / 255;
    const a = data[index * 4 + 3] / 255;
    pink[index] = shape(1 - g) * a;
    blue[index] = shape(1 - r) * a;
    yellow[index] = shape(1 - b) * a * 0.9;
  }
  return { width, height, coverage: { pink, blue, yellow } };
}

export function mulberry(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomParams(inks: Ink[], fountain: boolean, seed: number): PrintParams {
  const rand = mulberry(seed);
  const screens: Screen[] = ['dot', 'dot', 'line', 'grain'];
  const spread = 0.8 + rand() * 3.6;
  const jitter = (): [number, number] => [(rand() - 0.5) * 2 * spread, (rand() - 0.5) * 2 * spread];
  return {
    inks,
    fountain,
    screen: screens[Math.floor(rand() * screens.length)],
    cell: 2.2 + rand() * 2.6,
    angles: {
      pink: 15 + Math.round(rand() * 2) * 30,
      blue: 75 - Math.round(rand() * 2) * 15,
      yellow: Math.round(rand() * 2) * 45,
    },
    offsets: { pink: jitter(), blue: [0, 0], yellow: jitter() },
    seed,
  };
}

type Region = { x: number; y: number; w: number; h: number };

type PlateOptions = {
  coverage: Float32Array;
  source: Source;
  region: Region;
  scale: number;
  screen: Screen;
  cell: number;
  angle: number;
  fill: string | ((ctx: CanvasRenderingContext2D, w: number, h: number) => CanvasGradient);
  seed: number;
};

/** 排一块版：只有这一种油墨的图形，透明底 */
export function renderPlate(options: PlateOptions) {
  const { coverage, source, region, scale, screen, cell, angle, fill, seed } = options;
  const outW = Math.round(region.w * scale);
  const outH = Math.round(region.h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = typeof fill === 'string' ? fill : fill(ctx, outW, outH);

  const sample = (x: number, y: number) => {
    const sx = Math.floor(region.x + x / scale);
    const sy = Math.floor(region.y + y / scale);
    if (sx < 0 || sy < 0 || sx >= source.width || sy >= source.height) return 0;
    return coverage[sy * source.width + sx];
  };

  const c = cell * scale;
  ctx.beginPath();

  if (screen === 'grain') {
    const rand = mulberry(seed);
    const count = Math.round(((outW * outH) / (c * c)) * 10);
    const grain = Math.max(1.2, c * 0.32);
    for (let index = 0; index < count; index += 1) {
      const x = rand() * outW;
      const y = rand() * outH;
      const k = sample(x, y);
      if (k > 0.02 && rand() < Math.min(1, k * 1.15)) ctx.rect(x, y, grain, grain);
    }
  } else {
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const half = Math.hypot(outW, outH) / 2;
    const cx = outW / 2;
    const cy = outH / 2;
    if (screen === 'line') {
      // 线条：在旋转后的坐标系里逐格画短横条，相邻的连成一条粗细会变的线
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rad);
    }
    for (let v = -half; v < half; v += c) {
      for (let u = -half; u < half; u += c) {
        const x = cx + u * cos - v * sin;
        const y = cy + u * sin + v * cos;
        if (x < -c || y < -c || x > outW + c || y > outH + c) continue;
        const k = sample(x, y);
        if (k < 0.03) continue;
        if (screen === 'dot') {
          const r = c * 0.6 * Math.sqrt(k);
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, Math.PI * 2);
        } else {
          const t = c * 0.52 * k;
          ctx.fillRect(u - c * 0.52, v - t, c * 1.04, t * 2);
        }
      }
    }
    if (screen === 'line') {
      ctx.restore();
      return canvas;
    }
  }
  ctx.fill();
  return canvas;
}

export type Plate = { key: string; canvas: HTMLCanvasElement; offset: [number, number] };

const fountainFill = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  const gradient = ctx.createLinearGradient(0, 0, w * 0.3, h);
  gradient.addColorStop(0, INKS.pink.css);
  gradient.addColorStop(0.55, '#ff9a6a');
  gradient.addColorStop(1, INKS.yellow.css);
  return gradient;
};

/** 按参数排出所有版。region 默认是整张纸（含留白） */
export function renderPlates(source: Source, params: PrintParams, scale: number, region?: Region): Plate[] {
  const area: Region = region ?? {
    x: -source.width * MARGIN,
    y: -source.width * MARGIN,
    w: source.width * (1 + MARGIN * 2),
    h: source.height + source.width * MARGIN * 2,
  };
  const plates: Plate[] = [];
  const base = { source, region: area, scale, screen: params.screen, cell: params.cell };

  if (params.fountain) {
    const mixed = new Float32Array(source.coverage.pink.length);
    for (let index = 0; index < mixed.length; index += 1) {
      mixed[index] = Math.min(1, source.coverage.pink[index] * 0.7 + source.coverage.yellow[index] * 0.5);
    }
    plates.push({
      key: 'fountain',
      canvas: renderPlate({ ...base, coverage: mixed, angle: params.angles.pink, fill: fountainFill, seed: params.seed + 11 }),
      offset: params.offsets.pink,
    });
    if (params.inks.includes('blue')) {
      plates.push({
        key: 'blue',
        canvas: renderPlate({ ...base, coverage: source.coverage.blue, angle: params.angles.blue, fill: INKS.blue.css, seed: params.seed + 23 }),
        offset: params.offsets.blue,
      });
    }
    return plates;
  }

  params.inks.forEach((ink, index) => {
    plates.push({
      key: ink,
      canvas: renderPlate({
        ...base,
        coverage: source.coverage[ink],
        angle: params.angles[ink],
        fill: INKS[ink].css,
        seed: params.seed + index * 17,
      }),
      offset: params.offsets[ink],
    });
  });
  return plates;
}

let paperNoise: HTMLCanvasElement | null = null;
function getPaperNoise() {
  if (paperNoise) return paperNoise;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(256, 256);
  const rand = mulberry(7);
  for (let index = 0; index < 256 * 256; index += 1) {
    const value = 238 + rand() * 17;
    image.data[index * 4] = value;
    image.data[index * 4 + 1] = value;
    image.data[index * 4 + 2] = value + 2;
    image.data[index * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  paperNoise = canvas;
  return canvas;
}

/** 把版叠印到纸上。shift 是额外的错版（指针拖出来的），单位是原图像素 */
export function composite(target: HTMLCanvasElement, plates: Plate[], scale: number, shift: [number, number] = [0, 0]) {
  const ctx = target.getContext('2d')!;
  const { width, height } = target;
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = ctx.createPattern(getPaperNoise(), 'repeat')!;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'multiply';
  plates.forEach((plate, index) => {
    const direction = index === 0 ? 1 : index === 1 ? -0.6 : -1.2;
    const dx = (plate.offset[0] + shift[0] * direction) * scale;
    const dy = (plate.offset[1] + shift[1] * direction) * scale;
    ctx.globalAlpha = 0.94;
    ctx.drawImage(plate.canvas, dx, dy);
  });
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

export function paperSize(source: Source, scale: number) {
  return {
    width: Math.round(source.width * (1 + MARGIN * 2) * scale),
    height: Math.round((source.height + source.width * MARGIN * 2) * scale),
  };
}
