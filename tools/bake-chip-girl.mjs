// 把芯片顶盖上那个小女孩的 GIF 烘焙成页面用的数据：
//   chip-girl.bin  —— 每一帧缩成 SIZE × SIZE 的调色板序号（255 = 透明），所有帧连在一起，zlib 压缩
//   chipGirl.ts    —— 调色板、帧数、帧间隔、勾线和黄星星发夹的位置
// 页面不加载原 GIF。换图的话把新 GIF 放到 tools/chip-girl.gif，再跑：
//   node tools/bake-chip-girl.mjs
// 不依赖任何第三方包：GIF 解码（LZW）、取色（k-means）、缩图（按格子投票）都在这里。

import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(root, 'tools/chip-girl.gif');
const OUT_BIN = join(root, 'src/variants/glass/dive/chip-girl.bin');
const OUT_TS = join(root, 'src/variants/glass/dive/chipGirl.ts');
/** 每帧缩到多大（正方形） */
const SIZE = 160;
/** 调色板几种颜色 */
const COLORS = 14;
/** 镜头钻星星时她停在哪一帧（跳得最高、身子最直的那一帧） */
const HOLD_FRAME = 8;
const TRANSPARENT = 255;

/* ---------- GIF 解码 ---------- */

function lzw(minCodeSize, data, pixelCount) {
  const out = new Uint8Array(pixelCount);
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  const prefix = new Int16Array(4096);
  const suffix = new Uint8Array(4096);
  const first = new Uint8Array(4096);
  const length = new Uint16Array(4096);
  for (let i = 0; i < clear; i += 1) {
    prefix[i] = -1;
    suffix[i] = i;
    first[i] = i;
    length[i] = 1;
  }
  const stack = new Uint8Array(4097);
  let codeSize = minCodeSize + 1;
  let next = end + 1;
  let prev = -1;
  let acc = 0;
  let bits = 0;
  let pos = 0;
  let op = 0;
  const emit = (code) => {
    const n = length[code];
    let k = code;
    for (let i = n - 1; i >= 0; i -= 1) {
      stack[i] = suffix[k];
      k = prefix[k];
    }
    for (let i = 0; i < n && op < pixelCount; i += 1) out[op++] = stack[i];
  };
  while (op < pixelCount) {
    while (bits < codeSize) {
      if (pos >= data.length) return out;
      acc |= data[pos++] << bits;
      bits += 8;
    }
    const code = acc & ((1 << codeSize) - 1);
    acc >>>= codeSize;
    bits -= codeSize;
    if (code === clear) {
      codeSize = minCodeSize + 1;
      next = end + 1;
      prev = -1;
      continue;
    }
    if (code === end) break;
    if (prev === -1) {
      out[op++] = suffix[code];
      prev = code;
      continue;
    }
    const known = code < next;
    const head = known ? first[code] : first[prev];
    if (next < 4096) {
      prefix[next] = prev;
      suffix[next] = head;
      first[next] = first[prev];
      length[next] = length[prev] + 1;
      next += 1;
    }
    emit(code);
    if (next === 1 << codeSize && codeSize < 12) codeSize += 1;
    prev = code;
  }
  return out;
}

function decodeGif(bytes) {
  const u8 = bytes;
  if (String.fromCharCode(...u8.subarray(0, 3)) !== 'GIF') throw new Error('not a GIF');
  let p = 6;
  const width = u8[p] | (u8[p + 1] << 8);
  const height = u8[p + 2] | (u8[p + 3] << 8);
  const flags = u8[p + 4];
  p += 7;
  let globalTable = null;
  if (flags & 0x80) {
    const n = 2 << (flags & 7);
    globalTable = u8.subarray(p, p + n * 3);
    p += n * 3;
  }
  const canvas = new Uint8Array(width * height * 4);
  const frames = [];
  let control = { disposal: 0, transparent: -1, delay: 0 };
  let previous = null;
  while (p < u8.length) {
    const block = u8[p++];
    if (block === 0x3b) break;
    if (block === 0x21) {
      const label = u8[p++];
      if (label === 0xf9) {
        const packed = u8[p + 1];
        control = {
          disposal: (packed >> 2) & 7,
          transparent: packed & 1 ? u8[p + 4] : -1,
          delay: (u8[p + 2] | (u8[p + 3] << 8)) * 10,
        };
      }
      while (u8[p] !== 0) p += u8[p] + 1;
      p += 1;
      continue;
    }
    if (block !== 0x2c) throw new Error(`unexpected block 0x${block.toString(16)} at ${p - 1}`);
    const x = u8[p] | (u8[p + 1] << 8);
    const y = u8[p + 2] | (u8[p + 3] << 8);
    const w = u8[p + 4] | (u8[p + 5] << 8);
    const h = u8[p + 6] | (u8[p + 7] << 8);
    const f = u8[p + 8];
    p += 9;
    let table = globalTable;
    if (f & 0x80) {
      const n = 2 << (f & 7);
      table = u8.subarray(p, p + n * 3);
      p += n * 3;
    }
    const interlaced = (f & 0x40) !== 0;
    const minCodeSize = u8[p++];
    const parts = [];
    let total = 0;
    while (u8[p] !== 0) {
      parts.push(u8.subarray(p + 1, p + 1 + u8[p]));
      total += u8[p];
      p += u8[p] + 1;
    }
    p += 1;
    const data = new Uint8Array(total);
    let offset = 0;
    parts.forEach((part) => {
      data.set(part, offset);
      offset += part.length;
    });
    const indices = lzw(minCodeSize, data, w * h);

    // 上一帧的处置方式：2 = 清回透明，3 = 还原成画它之前的样子
    if (previous?.disposal === 2) {
      for (let row = previous.y; row < previous.y + previous.h; row += 1) {
        canvas.fill(0, (row * width + previous.x) * 4, (row * width + previous.x + previous.w) * 4);
      }
    } else if (previous?.disposal === 3 && previous.saved) {
      canvas.set(previous.saved);
    }
    const saved = control.disposal === 3 ? canvas.slice() : null;

    const rowOrder = [];
    if (interlaced) {
      [[0, 8], [4, 8], [2, 4], [1, 2]].forEach(([start, step]) => {
        for (let row = start; row < h; row += step) rowOrder.push(row);
      });
    } else {
      for (let row = 0; row < h; row += 1) rowOrder.push(row);
    }
    rowOrder.forEach((row, k) => {
      for (let col = 0; col < w; col += 1) {
        const index = indices[k * w + col];
        if (index === control.transparent) continue;
        const o = ((y + row) * width + x + col) * 4;
        canvas[o] = table[index * 3];
        canvas[o + 1] = table[index * 3 + 1];
        canvas[o + 2] = table[index * 3 + 2];
        canvas[o + 3] = 255;
      }
    });
    frames.push({ rgba: canvas.slice(), delay: control.delay });
    previous = { disposal: control.disposal, x, y, w, h, saved };
    control = { disposal: 0, transparent: -1, delay: 0 };
  }
  return { width, height, frames };
}

/* ---------- 取色：k-means ---------- */

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function kmeans(samples, k) {
  const random = mulberry32(7);
  const n = samples.length / 3;
  const centers = new Float64Array(k * 3);
  const distance = new Float64Array(n).fill(Infinity);
  // k-means++：离已有中心越远的点越容易被选成下一个中心
  let pick = Math.floor(random() * n);
  for (let c = 0; c < k; c += 1) {
    centers.set(samples.subarray(pick * 3, pick * 3 + 3), c * 3);
    let sum = 0;
    for (let i = 0; i < n; i += 1) {
      const dr = samples[i * 3] - centers[c * 3];
      const dg = samples[i * 3 + 1] - centers[c * 3 + 1];
      const db = samples[i * 3 + 2] - centers[c * 3 + 2];
      distance[i] = Math.min(distance[i], dr * dr + dg * dg + db * db);
      sum += distance[i];
    }
    let target = random() * sum;
    pick = 0;
    for (let i = 0; i < n; i += 1) {
      target -= distance[i];
      if (target <= 0) {
        pick = i;
        break;
      }
    }
  }
  const assign = new Uint8Array(n);
  for (let iteration = 0; iteration < 16; iteration += 1) {
    const sums = new Float64Array(k * 4);
    for (let i = 0; i < n; i += 1) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c += 1) {
        const dr = samples[i * 3] - centers[c * 3];
        const dg = samples[i * 3 + 1] - centers[c * 3 + 1];
        const db = samples[i * 3 + 2] - centers[c * 3 + 2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      assign[i] = best;
      sums[best * 4] += samples[i * 3];
      sums[best * 4 + 1] += samples[i * 3 + 1];
      sums[best * 4 + 2] += samples[i * 3 + 2];
      sums[best * 4 + 3] += 1;
    }
    for (let c = 0; c < k; c += 1) {
      if (sums[c * 4 + 3] === 0) continue;
      centers[c * 3] = sums[c * 4] / sums[c * 4 + 3];
      centers[c * 3 + 1] = sums[c * 4 + 1] / sums[c * 4 + 3];
      centers[c * 3 + 2] = sums[c * 4 + 2] / sums[c * 4 + 3];
    }
  }
  const palette = [];
  for (let c = 0; c < k; c += 1) palette.push([0, 1, 2].map((j) => Math.round(centers[c * 3 + j])));
  // 从暗到亮排好，0 号就是勾线
  const luma = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;
  palette.sort((a, b) => luma(a) - luma(b));
  return palette;
}

/* ---------- 开始 ---------- */

const gif = decodeGif(new Uint8Array(readFileSync(SOURCE)));
const { width, height, frames } = gif;
console.log(`${frames.length} frames, ${width}x${height}, delays ${[...new Set(frames.map((f) => f.delay))].join('/')} ms`);

const samples = [];
frames.forEach(({ rgba }) => {
  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      const o = (y * width + x) * 4;
      if (rgba[o + 3] < 128) continue;
      samples.push(rgba[o], rgba[o + 1], rgba[o + 2]);
    }
  }
});
const palette = kmeans(new Float64Array(samples), COLORS);

const nearestCache = new Map();
const nearest = (r, g, b) => {
  const key = (r << 16) | (g << 8) | b;
  let hit = nearestCache.get(key);
  if (hit !== undefined) return hit;
  let best = 0;
  let bestD = Infinity;
  palette.forEach(([pr, pg, pb], index) => {
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (d < bestD) {
      bestD = d;
      best = index;
    }
  });
  nearestCache.set(key, best);
  return best;
};

// 缩图：每个目标格子里的源像素投票，勾线（0 号）票数加重，细线才不会在缩小时断掉
const OUTLINE = 0;
const out = new Uint8Array(SIZE * SIZE * frames.length);
const votes = new Float64Array(COLORS + 1);
frames.forEach(({ rgba }, frameIndex) => {
  for (let ty = 0; ty < SIZE; ty += 1) {
    const y0 = Math.floor((ty * height) / SIZE);
    const y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * height) / SIZE));
    for (let tx = 0; tx < SIZE; tx += 1) {
      const x0 = Math.floor((tx * width) / SIZE);
      const x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * width) / SIZE));
      votes.fill(0);
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const o = (y * width + x) * 4;
          if (rgba[o + 3] < 128) votes[COLORS] += 1;
          else {
            const index = nearest(rgba[o], rgba[o + 1], rgba[o + 2]);
            votes[index] += index === OUTLINE ? 1.6 : 1;
          }
        }
      }
      let best = COLORS;
      for (let c = 0; c <= COLORS; c += 1) if (votes[c] > votes[best]) best = c;
      out[frameIndex * SIZE * SIZE + ty * SIZE + tx] = best === COLORS ? TRANSPARENT : best;
    }
  }
});

// 黄星星发夹：最「黄」的那种颜色，在停住的那一帧里、上半身那一团的中心和大小（胸口还有一颗小星星，要避开）
const yellowness = ([r, g, b]) => Math.min(r, g) - b;
const star = palette.reduce((best, color, index) => (yellowness(color) > yellowness(palette[best]) ? index : best), 0);
const hold = out.subarray(HOLD_FRAME * SIZE * SIZE, (HOLD_FRAME + 1) * SIZE * SIZE);
const seen = new Uint8Array(SIZE * SIZE);
let bestBlob = null;
for (let start = 0; start < SIZE * SIZE; start += 1) {
  if (seen[start] || hold[start] !== star) continue;
  const queue = [start];
  seen[start] = 1;
  let count = 0;
  let sx = 0;
  let sy = 0;
  while (queue.length) {
    const i = queue.pop();
    const x = i % SIZE;
    const y = Math.floor(i / SIZE);
    count += 1;
    sx += x;
    sy += y;
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) return;
      const j = ny * SIZE + nx;
      if (!seen[j] && hold[j] === star) {
        seen[j] = 1;
        queue.push(j);
      }
    });
  }
  const cy = sy / count;
  if (cy < SIZE * 0.6 && (!bestBlob || count > bestBlob.count)) bestBlob = { count, x: sx / count, y: cy };
}
if (!bestBlob) throw new Error('could not find the star hair clip');

const packed = deflateSync(out, { level: 9 });
writeFileSync(OUT_BIN, packed);

const delay = frames[0].delay || 30;
const ts = `// 由 tools/bake-chip-girl.mjs 生成，别手改。源文件：tools/chip-girl.gif
// 芯片顶盖上的小女孩：${frames.length} 帧，每帧 ${SIZE} × ${SIZE} 个调色板序号（${TRANSPARENT} = 透明），数据在 chip-girl.bin（zlib）。

export const CHIP_GIRL = {
  size: ${SIZE},
  frames: ${frames.length},
  delayMs: ${delay},
  transparent: ${TRANSPARENT},
  /** 从暗到亮；0 号是勾线 */
  palette: ${JSON.stringify(palette)} as [number, number, number][],
  outline: ${OUTLINE},
  /** 镜头钻进去的那一帧，和那一帧里黄星星发夹的中心（像素）、大概半径 */
  holdFrame: ${HOLD_FRAME},
  star: { index: ${star}, x: ${bestBlob.x.toFixed(2)}, y: ${bestBlob.y.toFixed(2)}, r: ${Math.sqrt(bestBlob.count / Math.PI).toFixed(2)} },
};
`;
writeFileSync(OUT_TS, ts);
console.log(`palette ${JSON.stringify(palette)}`);
console.log(`star index ${star} at (${bestBlob.x.toFixed(1)}, ${bestBlob.y.toFixed(1)}), ${bestBlob.count} px`);
console.log(`bin ${packed.length} bytes (raw ${out.length})`);
