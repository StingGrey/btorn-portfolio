// 星系的一生：两个星系相撞、合并 → 银河系。
// 相撞是真算出来的（Toomre 兄弟那种「受限三体」：两个星系核互相吸引，各带 900 颗只受核吸引的试验星；
// 核靠近时再加一点阻力，代替真实星系里暗物质晕吃掉的那部分能量，它们才会绕回来合成一个）。
// 整段模拟大约要几十毫秒，页面加载这一段时就在后台一小段一小段地算好，存成一帧帧位置，滚动时只是回放。
// 银河系是一个棒旋星系，画法 drawSpiral 在最后拉远时也用。

import { G, RAMP } from '../charset';
import { BG, clamp01, clock, colOf, hash1, hash2, noise2, plot, put, rowOf, smooth, tint, type Grid } from '../grid';
import { callout, note, status, type Rgb } from '../notes';
import { interpolate } from '../timeline';
import { PINK, ball, glow } from './shapes';

/* ====================== 两个星系相撞 ====================== */

const STARS = 900;
const N = STARS * 2;
const DT = 0.008;
/** 从第几步开始录（之前两个星系还离得很远），录到第几步，每几步录一帧 */
const FIRST = 500;
const LAST = 2400;
const EVERY = 16;
const FRAMES = Math.floor((LAST - FIRST) / EVERY) + 1;
/** 星和核之间、两个核之间的软化长度（别让距离为 0 时引力变无穷大） */
const EPS = 0.05;
const CORE_EPS = 0.12;
/** 两个核靠近时的阻力：多大、在多远以内起作用 */
const DRAG = 0.35;
const DRAG_RANGE = 2.5;

const pos = new Float64Array(N * 3);
const vel = new Float64Array(N * 3);
const acc = new Float64Array(N * 3);
const core = new Float64Array(6);
const coreV = new Float64Array(6);
const coreA = new Float64Array(6);
const drag = new Float64Array(6);
/** 录下来的每一帧：星（投影到屏幕平面以后的 x, y）和两个核 */
let frames: Float32Array | null = null;
let coreFrames: Float32Array | null = null;
let step = -1;

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function setup() {
  const random = mulberry(7);
  // 两个核沿抛物线轨道相向而来，近心距 1.3（两个星系的盘差不多擦边）
  const q = 1.3;
  const nu = -2.3;
  const r = (2 * q) / (1 + Math.cos(nu));
  const rel = [r * Math.cos(nu), r * Math.sin(nu), 0];
  const speed = Math.sqrt(2 / (2 * q));
  const relV = [speed * -Math.sin(nu), speed * (1 + Math.cos(nu)), 0];
  for (let k = 0; k < 3; k += 1) {
    core[k] = -0.5 * rel[k];
    core[3 + k] = 0.5 * rel[k];
    coreV[k] = -0.5 * relV[k];
    coreV[3 + k] = 0.5 * relV[k];
  }
  // 每个星系一张盘，星在圆轨道上；第一个几乎和轨道面平着转（同向，尾巴最长），第二个斜着
  const tilt = [0.25, 1.0];
  const node = [0, 0.9];
  for (let gi = 0; gi < 2; gi += 1) {
    const ci = Math.cos(tilt[gi]);
    const si = Math.sin(tilt[gi]);
    const cn = Math.cos(node[gi]);
    const sn = Math.sin(node[gi]);
    for (let s = 0; s < STARS; s += 1) {
      const i = gi * STARS + s;
      const radius = 0.1 + 0.6 * random() ** 0.75;
      const angle = random() * Math.PI * 2;
      const vc = Math.sqrt((radius * radius) / (radius * radius + EPS * EPS) ** 1.5);
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);
      const vx = -vc * Math.sin(angle);
      const vy = vc * Math.cos(angle);
      const y2 = y * ci;
      const z2 = y * si;
      const vy2 = vy * ci;
      const vz2 = vy * si;
      pos[i * 3] = x * cn - y2 * sn + core[gi * 3];
      pos[i * 3 + 1] = x * sn + y2 * cn + core[gi * 3 + 1];
      pos[i * 3 + 2] = z2 + core[gi * 3 + 2];
      vel[i * 3] = vx * cn - vy2 * sn + coreV[gi * 3];
      vel[i * 3 + 1] = vx * sn + vy2 * cn + coreV[gi * 3 + 1];
      vel[i * 3 + 2] = vz2 + coreV[gi * 3 + 2];
    }
  }
  frames = new Float32Array(FRAMES * N * 2);
  coreFrames = new Float32Array(FRAMES * 4);
  accelerate();
  step = 0;
}

function accelerate() {
  const dx = core[3] - core[0];
  const dy = core[4] - core[1];
  const dz = core[5] - core[2];
  const d2 = dx * dx + dy * dy + dz * dz;
  const inv = 1 / (d2 + CORE_EPS * CORE_EPS) ** 1.5;
  const near = Math.exp(-d2 / DRAG_RANGE) * DRAG * 0.5;
  for (let k = 0; k < 3; k += 1) {
    drag[k] = near * (coreV[3 + k] - coreV[k]);
    drag[3 + k] = -drag[k];
  }
  coreA[0] = dx * inv + drag[0];
  coreA[1] = dy * inv + drag[1];
  coreA[2] = dz * inv + drag[2];
  coreA[3] = -dx * inv + drag[3];
  coreA[4] = -dy * inv + drag[4];
  coreA[5] = -dz * inv + drag[5];
  for (let i = 0; i < N; i += 1) {
    let ax = 0;
    let ay = 0;
    let az = 0;
    for (let k = 0; k < 2; k += 1) {
      const ex = core[k * 3] - pos[i * 3];
      const ey = core[k * 3 + 1] - pos[i * 3 + 1];
      const ez = core[k * 3 + 2] - pos[i * 3 + 2];
      const e2 = ex * ex + ey * ey + ez * ez + EPS * EPS;
      const w = 1 / (e2 * Math.sqrt(e2));
      ax += ex * w;
      ay += ey * w;
      az += ez * w;
      // 离核很近的星跟着核一起被拖慢（不然核一减速，它们全被甩掉）
      const ride = Math.exp(-e2 / 0.45);
      ax += ride * drag[k * 3];
      ay += ride * drag[k * 3 + 1];
      az += ride * drag[k * 3 + 2];
    }
    acc[i * 3] = ax;
    acc[i * 3 + 1] = ay;
    acc[i * 3 + 2] = az;
  }
}

/** 投影到屏幕平面：轨道面往前倾一点 */
function record() {
  if (!frames || !coreFrames || step < FIRST || (step - FIRST) % EVERY !== 0) return;
  const f = (step - FIRST) / EVERY;
  if (f >= FRAMES) return;
  for (let i = 0; i < N; i += 1) {
    frames[(f * N + i) * 2] = pos[i * 3];
    frames[(f * N + i) * 2 + 1] = pos[i * 3 + 1] * 0.85 + pos[i * 3 + 2] * 0.5;
  }
  for (let k = 0; k < 2; k += 1) {
    coreFrames[f * 4 + k * 2] = core[k * 3];
    coreFrames[f * 4 + k * 2 + 1] = core[k * 3 + 1] * 0.85 + core[k * 3 + 2] * 0.5;
  }
}

/** 往前走一步（蛙跳法：踢半步、走一步、再踢半步） */
function advance() {
  for (let k = 0; k < 6; k += 1) coreV[k] += 0.5 * DT * coreA[k];
  for (let i = 0; i < N * 3; i += 1) vel[i] += 0.5 * DT * acc[i];
  for (let k = 0; k < 6; k += 1) core[k] += DT * coreV[k];
  for (let i = 0; i < N * 3; i += 1) pos[i] += DT * vel[i];
  accelerate();
  for (let k = 0; k < 6; k += 1) coreV[k] += 0.5 * DT * coreA[k];
  for (let i = 0; i < N * 3; i += 1) vel[i] += 0.5 * DT * acc[i];
  step += 1;
  record();
}

const mergerDone = () => step >= LAST;

/** 在 budget 毫秒以内能算多少算多少 */
export function prepareMerger(budget: number) {
  if (mergerDone()) return;
  if (step < 0) {
    setup();
    record();
  }
  const start = performance.now();
  while (!mergerDone() && performance.now() - start < budget) for (let k = 0; k < 20 && !mergerDone(); k += 1) advance();
}

/** 页面加载这一段时就开始在后台一小段一小段地算，到了那一站一般早就算好了 */
export function startMerger() {
  const run = () => {
    prepareMerger(4);
    if (!mergerDone()) setTimeout(run, 16);
  };
  setTimeout(run, 200);
}

/** 滚动位置 → 模拟里的时间：远远飞来 → 第一次擦身而过、甩出尾巴 → 绕回来合成一个 */
const PLAY: [number, number][] = [
  [1558, 4],
  [1568, 8.6],
  [1584, 13.2],
  [1600, 19],
];
const TONE_A: Rgb = [175, 195, 255];
const TONE_B: Rgb = [255, 210, 150];
let countA = new Uint8Array(0);
let countB = new Uint8Array(0);
/** 粗一点的格子（4 列 × 2 行一格）上的星数：画成一层柔和的光，星系才是一团，不只是一把点 */
let coarse = new Float32Array(0);
let coarseW = 0;
let coarseH = 0;
const tips: [number, number, number][] = [];

export function drawMerger(g: Grid, zz: number) {
  // 滑得太快、后台还没算完：剩下的当场算完
  if (!mergerDone()) prepareMerger(1e9);
  if (!frames || !coreFrames) return;
  if (countA.length !== g.count) {
    countA = new Uint8Array(g.count);
    countB = new Uint8Array(g.count);
  } else {
    countA.fill(0);
    countB.fill(0);
  }
  coarseW = Math.ceil(g.cols / 4) + 1;
  coarseH = Math.ceil(g.rows / 2) + 1;
  if (coarse.length !== coarseW * coarseH) coarse = new Float32Array(coarseW * coarseH);
  else coarse.fill(0);
  const at = clamp01((interpolate(PLAY, zz) / DT - FIRST) / EVERY / (FRAMES - 1)) * (FRAMES - 1);
  const f0 = Math.floor(at);
  const f1 = Math.min(FRAMES - 1, f0 + 1);
  const w = at - f0;
  const scale = 0.5 / 1.9;
  const appear = smooth(1550, 1558, zz);
  // 每一格数一数落进来几颗星（两个星系分开数，好上色）
  for (let i = 0; i < N; i += 1) {
    const a = (f0 * N + i) * 2;
    const b = (f1 * N + i) * 2;
    const x = (frames[a] + (frames[b] - frames[a]) * w) * scale * 1.1;
    const y = (frames[a + 1] + (frames[b + 1] - frames[a + 1]) * w) * scale;
    const c = colOf(g, x);
    const r = rowOf(g, y);
    if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) continue;
    coarse[(r >> 1) * coarseW + (c >> 2)] += 1;
    // 一颗星占两格宽（格子是瘦长的，这样看起来才是一个点）
    for (let k = r * g.cols + c; k <= r * g.cols + Math.min(g.cols - 1, c + 1); k += 1) {
      if (i < STARS) countA[k] = Math.min(255, countA[k] + 1);
      else countB[k] = Math.min(255, countB[k] + 1);
    }
  }
  // 那层柔和的光：粗格子上的星数，双线性插开
  for (let row = 0; row < g.rows; row += 1) {
    const fy = row / 2 - 0.5;
    const y0 = Math.max(0, Math.min(coarseH - 2, Math.floor(fy)));
    const v = Math.max(0, Math.min(1, fy - y0));
    for (let col = 0; col < g.cols; col += 1) {
      const fx = col / 4 - 0.5;
      const x0 = Math.max(0, Math.min(coarseW - 2, Math.floor(fx)));
      const u = Math.max(0, Math.min(1, fx - x0));
      const a = coarse[y0 * coarseW + x0];
      const b = coarse[y0 * coarseW + x0 + 1];
      const c = coarse[(y0 + 1) * coarseW + x0];
      const d = coarse[(y0 + 1) * coarseW + x0 + 1];
      const density = a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
      if (density < 0.6) continue;
      const k = Math.min(1, density / 9) * appear;
      glow(g, row * g.cols + col, 70 * k, 64 * k, 80 * k);
    }
  }
  for (let k = 0; k < g.count; k += 1) {
    const total = countA[k] + countB[k];
    if (total === 0) continue;
    const mix = countA[k] / total;
    const v = Math.min(1, 0.5 + 0.16 * total) * appear;
    const glyph = total >= 8 ? G.at : total >= 5 ? G.hash : total >= 3 ? G.star : total >= 2 ? G.colon : G.dot;
    const red = TONE_A[0] * mix + TONE_B[0] * (1 - mix);
    const green = TONE_A[1] * mix + TONE_B[1] * (1 - mix);
    const blue = TONE_A[2] * mix + TONE_B[2] * (1 - mix);
    put(g, k, glyph, red * v, green * v, blue * v);
    // 星多的地方底下也亮一点：一团团的星系，不只是一把点
    const haze = Math.min(1, total / 8) * appear;
    if (haze > 0.1) tint(g, k, BG[0] + red * 0.22 * haze, BG[1] + green * 0.22 * haze, BG[2] + blue * 0.22 * haze);
  }
  // 两个核，和撞在一起时被挤出来的新星（粉色的一小团一小团）
  const core0x = (coreFrames[f0 * 4] + (coreFrames[f1 * 4] - coreFrames[f0 * 4]) * w) * scale * 1.1;
  const core0y = (coreFrames[f0 * 4 + 1] + (coreFrames[f1 * 4 + 1] - coreFrames[f0 * 4 + 1]) * w) * scale;
  const core1x = (coreFrames[f0 * 4 + 2] + (coreFrames[f1 * 4 + 2] - coreFrames[f0 * 4 + 2]) * w) * scale * 1.1;
  const core1y = (coreFrames[f0 * 4 + 3] + (coreFrames[f1 * 4 + 3] - coreFrames[f0 * 4 + 3]) * w) * scale;
  const sep = Math.hypot((core1x - core0x) / 1.1, core1y - core0y) / scale;
  ball(g, core0x, core0y, 255 * appear, 245 * appear, 225 * appear);
  ball(g, core1x, core1y, 255 * appear, 240 * appear, 200 * appear);
  const burst = smooth(1.8, 0.6, sep) * appear;
  if (burst > 0.03) {
    const frame = g.reduced ? 0 : Math.floor(g.time * 5);
    for (let k = 0; k < 40; k += 1) {
      if (hash2(k, frame) > burst) continue;
      const which = k % 2 === 0;
      const a = hash1(k * 3 + frame * 7) * Math.PI * 2;
      const r = 0.02 + 0.09 * hash1(k * 5 + 1);
      plot(g, (which ? core0x : core1x) + Math.cos(a) * r * 1.1, (which ? core0y : core1y) + Math.sin(a) * r, G.star, PINK[0], PINK[1] + 60, PINK[2] + 40);
    }
  }
  // 标注：尾巴尖（第一个星系里离中心最远的那一成星，挑一颗；别挑那几颗被甩飞的散星）
  let tipX = 0;
  let tipY = 0;
  tips.length = 0;
  for (let i = 0; i < STARS; i += 5) {
    const a = (f0 * N + i) * 2;
    const x = frames[a] * scale * 1.1;
    const y = frames[a + 1] * scale;
    if (Math.abs(x) < g.aspect * 0.42 && Math.abs(y) < g.half * 0.8) tips.push([Math.hypot(x, y), x, y]);
  }
  if (tips.length) {
    tips.sort((p, q) => p[0] - q[0]);
    const tip = tips[Math.floor(tips.length * 0.9)];
    tipX = tip[1];
    tipY = tip[2];
  }
  callout(g, core1x, core1y, core1x + 0.18, core1y + 0.14, 'two galaxies, falling toward each other', TONE_B, smooth(1558, 1562, zz) * (1 - smooth(1566, 1570, zz)));
  callout(g, tipX, tipY, tipX + (tipX > 0 ? 0.1 : -0.1), tipY + 0.12, 'tidal tails: stars flung out by gravity', TONE_A, smooth(1574, 1578, zz) * (1 - smooth(1588, 1592, zz)));
  status(g, "the stars almost never hit each other: there's that much room between them", [230, 220, 250], smooth(1576, 1580, zz) * (1 - smooth(1594, 1600, zz)));
  callout(g, (core0x + core1x) / 2, (core0y + core1y) / 2, (core0x + core1x) / 2 + 0.18, (core0y + core1y) / 2 - 0.15, 'two became one bigger galaxy', [255, 236, 210], smooth(1590, 1594, zz) * (1 - smooth(1602, 1608, zz)));
}

/* ====================== 棒旋星系（银河系） ====================== */

const CORE_TONE: Rgb = [255, 226, 175];
const ARM_TONE: Rgb = [170, 196, 255];

/**
 * 一个棒旋星系，中心在屏幕 (cx, cy)，半径 size（屏幕单位），转了 rot，tilt < 1 是斜着看（上下被压扁）。
 * 两条主旋臂从棒的两头伸出去，再加两条淡一点的；旋臂里一团团粉色的是正在生新星的气体，内侧一条条暗的是尘埃带。
 */
export function drawSpiral(g: Grid, cx: number, cy: number, size: number, rot: number, tilt: number, show: number, detail = 1) {
  if (show < 0.03) return;
  if (size < g.ch * 1.2) {
    plot(g, cx, cy, G.star, CORE_TONE[0] * show, CORE_TONE[1] * show, CORE_TONE[2] * show);
    return;
  }
  const c0 = Math.max(0, colOf(g, cx - size * 1.15));
  const c1 = Math.min(g.cols - 1, colOf(g, cx + size * 1.15));
  const r0 = Math.max(0, rowOf(g, cy + size * tilt * 1.15));
  const r1 = Math.min(g.rows - 1, rowOf(g, cy - size * tilt * 1.15));
  if (c0 > c1 || r0 > r1) return;
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  const pitch = 0.22;
  // 大的时候隔一列算一次（两格共用），小的时候一格一格算
  const stride = size > 0.06 ? 2 : 1;
  for (let row = r0; row <= r1; row += 1) {
    const v = (g.oy[row] - cy) / (size * tilt);
    for (let col = c0; col <= c1; col += stride) {
      const u = (g.ox[col] - cx) / (size * 1.1);
      const x = u * cr + v * sr;
      const y = -u * sr + v * cr;
      const r = Math.sqrt(x * x + y * y);
      if (r > 1.15) continue;
      const theta = Math.atan2(y, x);
      const phi = theta - Math.log(Math.max(r, 0.05) / 0.22) / pitch;
      const main = (0.5 + 0.5 * Math.cos(2 * phi)) ** 5 * smooth(0.16, 0.3, r);
      const minor = (0.5 + 0.5 * Math.cos(2 * phi + 1.6)) ** 7 * 0.45 * smooth(0.3, 0.45, r);
      const clump = 0.55 + 0.9 * noise2(x * 9 + 3, y * 9 - 2);
      const arms = (main + minor) * clump;
      const dust = (0.5 + 0.5 * Math.cos(2 * phi - 0.55)) ** 9 * smooth(0.2, 0.35, r);
      const disk = Math.exp(-r / 0.3) * (1 - smooth(0.85, 1.12, r));
      const bar = Math.exp(-((x / 0.24) ** 2 + (y / 0.085) ** 2));
      const bulge = Math.exp(-((r / 0.09) ** 2));
      const glowArm = disk * (0.25 + 1.6 * arms) * (1 - 0.6 * dust);
      const glowCore = 1.2 * bar + 1.5 * bulge;
      const light = Math.min(1.2, glowArm + glowCore) * show;
      if (light < 0.06) continue;
      const warm = clamp01(glowCore / (glowCore + glowArm + 1e-4));
      const red = ARM_TONE[0] + (CORE_TONE[0] - ARM_TONE[0]) * warm;
      const green = ARM_TONE[1] + (CORE_TONE[1] - ARM_TONE[1]) * warm;
      const blue = ARM_TONE[2] + (CORE_TONE[2] - ARM_TONE[2]) * warm;
      for (let c = col; c < Math.min(col + stride, c1 + 1); c += 1) {
        const i = row * g.cols + c;
        // 旋臂上正在生新星的地方：粉色的一小团
        if (detail > 0 && arms > 0.55 && hash2(c * 7, row * 3) < 0.06 * detail) {
          put(g, i, G.star, PINK[0] * show, (PINK[1] + 70) * show, (PINK[2] + 60) * show);
          continue;
        }
        const k = Math.min(1, light);
        put(g, i, RAMP[Math.min(9, 1 + Math.floor(k * 8.99))], red * (0.45 + 0.55 * k), green * (0.45 + 0.55 * k), blue * (0.45 + 0.55 * k));
        if (k > 0.25) glow(g, i, red * k * 0.12, green * k * 0.12, blue * k * 0.12);
      }
    }
  }
}

/** 太阳以后会在银河系的什么地方出生（盘的半径的 0.55 倍，一条小旋臂上） */
export const SUN_R = 0.55;
export const SUN_A = 2.35;

/** 银河系上太阳的位置在屏幕上（相对星系中心）：给拉远那一段对准用 */
export function sunOffset(size: number, rot: number, tilt: number): [number, number] {
  const x = SUN_R * Math.cos(SUN_A);
  const y = SUN_R * Math.sin(SUN_A);
  return [size * 1.1 * (x * Math.cos(rot) - y * Math.sin(rot)), size * tilt * (x * Math.sin(rot) + y * Math.cos(rot))];
}

const spin = clock();

export function drawMilkyWay(g: Grid, zz: number) {
  const appear = smooth(1604, 1616, zz);
  // 镜头钻向太阳要出生的地方；钻的时候星系不再转，免得目标跑掉
  const zoom = smooth(1630, 1646, zz);
  const rot = 0.4 + spin(g, 0.05 * (1 - smooth(1626, 1632, zz)));
  const tilt = 0.72;
  const size = 0.44 * (1 + 0.05 * smooth(1606, 1630, zz)) * 2 ** (11 * zoom ** 1.4);
  const [sx, sy] = sunOffset(size, rot, tilt);
  const aim = smooth(1626, 1640, zz);
  const cx = -sx * aim;
  const cy = -sy * aim;
  drawSpiral(g, cx, cy, size, rot, tilt, appear, 1 - zoom);
  // 太阳会在这出生
  const here = smooth(1618, 1624, zz) * (1 - smooth(1640, 1646, zz));
  if (here > 0.03) {
    plot(g, cx + sx, cy + sy, G.ring, PINK[0] * here, PINK[1] * here, PINK[2] * here);
    callout(g, cx + sx, cy + sy, cx + sx - 0.16, cy + sy + 0.15, 'the Sun will be born out here', PINK, here * (1 - smooth(1634, 1638, zz)));
  }
  const label = smooth(1610, 1616, zz) * (1 - smooth(1626, 1630, zz));
  if (label > 0.03) {
    const [ax, ay] = sunOffset(size * 0.85, rot + 2.6, tilt);
    callout(g, cx + ax, cy + ay, cx + ax + 0.16, cy + ay - 0.14, 'spiral arms: where new stars are born', [255, 190, 215], label);
    callout(g, cx, cy, cx + 0.2, cy + 0.2, 'the bar: old stars, packed tight', CORE_TONE, label);
    note(g, cx, cy - size * tilt - 0.04, '<-------- 100,000 light-years -------->', [200, 200, 230], 0.5, label);
  }
}
