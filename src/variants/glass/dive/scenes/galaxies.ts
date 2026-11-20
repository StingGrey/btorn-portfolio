// 星系的一生：两个星系相撞、合并 → 银河系。
// 相撞是真算出来的（Toomre 兄弟那种「受限三体」：两个星系核互相吸引，各带 2400 颗只受核吸引的试验星；
// 核靠近时再加一点阻力，代替真实星系里暗物质晕吃掉的那部分能量，它们才会绕回来合成一个）。
// 整段模拟要一两百毫秒，页面加载这一段时就在后台一小段一小段地算好，存成一帧帧的位置和速度，滚动时只是回放。
// 帧与帧之间按位置和速度画三次曲线（Hermite），内圈转得飞快的星也走弧线，不会抄近路穿过中心。
// 画的时候不是一颗星一个字：先把星洒进一张密度图（落在格子之间的星按距离分给相邻几格），
// 再按密度挑字、把密度抹开垫一层光；核球、旋臂、潮汐尾里新生的星团各画各的。
// 银河系是一个棒旋星系，画法 drawSpiral 在最后拉远时也用。

import { G, gi } from '../charset';
import { BG, clamp01, clock, colOf, hash1, hash2, noise2, plot, put, rowOf, smooth, tint, type Grid } from '../grid';
import { callout, note, status, type Rgb } from '../notes';
import { interpolate } from '../timeline';
import { PINK, glow } from './shapes';

/* ====================== 两个星系相撞 ====================== */

const STARS = 2400;
const N = STARS * 2;
const DT = 0.008;
/** 从第几步开始录（之前两个星系还离得很远），录到第几步，每几步录一帧 */
const FIRST = 500;
const LAST = 2400;
const EVERY = 16;
const FRAMES = Math.floor((LAST - FIRST) / EVERY) + 1;
/** 两帧之间隔了多少模拟时间 */
const SPAN = EVERY * DT;
/**
 * 星和核之间、两个核之间的软化长度（别让距离为 0 时引力变无穷大）。
 * 星这边取得比较软：真的星系核外面裹着一大团暗物质晕，不是一个点，路过另一个核的星不该被一下子弹飞
 */
const EPS = 0.15;
const CORE_EPS = 0.12;
/** 两个核靠近时的阻力：多大、在多远以内起作用 */
const DRAG = 0.35;
const DRAG_RANGE = 2.5;
/** 录下来的位置、速度存成 16 位整数：位置精确到 1/2048、速度精确到 1/4096，比一格细得多，内存省一半 */
const PQ = 2048;
const VQ = 4096;

const pos = new Float64Array(N * 3);
const vel = new Float64Array(N * 3);
const acc = new Float64Array(N * 3);
const core = new Float64Array(6);
const coreV = new Float64Array(6);
const coreA = new Float64Array(6);
const drag = new Float64Array(6);
/** 每颗星出发时在自己盘上的半径、角度、角速度：画旋臂用（旋臂是一道转得比星慢的密度波，星穿过它时亮一下） */
const homeR = new Float32Array(N);
const homeLog = new Float32Array(N);
const homeA = new Float32Array(N);
const homeW = new Float32Array(N);
/** 0 普通的星、1 特别亮的星（单独点出来）、2 外盘的气体（相撞以后挤成粉色的新星团） */
const kind = new Uint8Array(N);
/** 录下来的每一帧：每颗星投影到屏幕平面以后的 x, y, vx, vy；两个核另存（浮点） */
let rec: Int16Array | null = null;
let coreRec: Float32Array | null = null;
let step = -1;
/** 两个核第一次擦身而过是在模拟里的什么时候（算完以后才知道） */
let periTime = 9;

/** 两张盘怎么摆：倾角、升交点（第一个几乎平躺在轨道面上，第二个斜着） */
const TILT = [0.25, 1.0];
const NODE = [0, 0.9];
/** 盘的星按半径怎么分布：从 DISK_IN 起、尺度 DISK_H 的指数盘，截到 DISK_OUT */
const DISK_IN = 0.04;
const DISK_H = 0.19;
const DISK_OUT = 0.85;

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

const quantize = (v: number, s: number) => {
  const q = Math.round(v * s);
  return q < -32767 ? -32767 : q > 32767 ? 32767 : q;
};

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
  for (let gi2 = 0; gi2 < 2; gi2 += 1) {
    const ci = Math.cos(TILT[gi2]);
    const si = Math.sin(TILT[gi2]);
    const cn = Math.cos(NODE[gi2]);
    const sn = Math.sin(NODE[gi2]);
    for (let s = 0; s < STARS; s += 1) {
      const i = gi2 * STARS + s;
      // 一半多的星是中间密、往外按指数变稀的盘；剩下的铺满外盘（潮汐尾全靠外盘的星）
      let radius: number;
      do radius = DISK_IN - DISK_H * Math.log(random() * random() + 1e-12);
      while (radius > DISK_OUT);
      const angle = random() * Math.PI * 2;
      const vc = Math.sqrt((radius * radius) / (radius * radius + EPS * EPS) ** 1.5);
      homeR[i] = radius;
      homeLog[i] = Math.log(radius);
      homeA[i] = angle;
      homeW[i] = vc / radius;
      const roll = random();
      kind[i] = roll < 0.045 ? 1 : radius > 0.32 && roll > 0.955 ? 2 : 0;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);
      const vx = -vc * Math.sin(angle);
      const vy = vc * Math.cos(angle);
      const y2 = y * ci;
      const z2 = y * si;
      const vy2 = vy * ci;
      const vz2 = vy * si;
      pos[i * 3] = x * cn - y2 * sn + core[gi2 * 3];
      pos[i * 3 + 1] = x * sn + y2 * cn + core[gi2 * 3 + 1];
      pos[i * 3 + 2] = z2 + core[gi2 * 3 + 2];
      vel[i * 3] = vx * cn - vy2 * sn + coreV[gi2 * 3];
      vel[i * 3 + 1] = vx * sn + vy2 * cn + coreV[gi2 * 3 + 1];
      vel[i * 3 + 2] = vz2 + coreV[gi2 * 3 + 2];
    }
  }
  rec = new Int16Array(FRAMES * N * 4);
  coreRec = new Float32Array(FRAMES * 8);
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
  // 阻力小到可以不管的时候，「离核近的星跟着核一起被拖慢」那一项也省掉
  const riding = Math.abs(drag[0]) + Math.abs(drag[1]) + Math.abs(drag[2]) > 1e-7;
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
      if (riding) {
        const ride = Math.exp(-e2 / 0.45);
        ax += ride * drag[k * 3];
        ay += ride * drag[k * 3 + 1];
        az += ride * drag[k * 3 + 2];
      }
    }
    acc[i * 3] = ax;
    acc[i * 3 + 1] = ay;
    acc[i * 3 + 2] = az;
  }
}

/** 投影到屏幕平面：轨道面往前倾一点；位置和速度一起录 */
function record() {
  if (!rec || !coreRec || step < FIRST || (step - FIRST) % EVERY !== 0) return;
  const f = (step - FIRST) / EVERY;
  if (f >= FRAMES) return;
  let o = f * N * 4;
  for (let i = 0; i < N; i += 1, o += 4) {
    const k = i * 3;
    rec[o] = quantize(pos[k], PQ);
    rec[o + 1] = quantize(pos[k + 1] * 0.85 + pos[k + 2] * 0.5, PQ);
    rec[o + 2] = quantize(vel[k], VQ);
    rec[o + 3] = quantize(vel[k + 1] * 0.85 + vel[k + 2] * 0.5, VQ);
  }
  for (let c = 0; c < 2; c += 1) {
    const k = c * 3;
    const oc = f * 8 + c * 4;
    coreRec[oc] = core[k];
    coreRec[oc + 1] = core[k + 1] * 0.85 + core[k + 2] * 0.5;
    coreRec[oc + 2] = coreV[k];
    coreRec[oc + 3] = coreV[k + 1] * 0.85 + coreV[k + 2] * 0.5;
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
  if (step === LAST) findPericenter();
}

/** 算完以后找两个核第一次离得最近的那一刻：旋臂在那之后交给模拟自己，粉色的新星团也从那时开始亮 */
function findPericenter() {
  if (!coreRec) return;
  let best = Infinity;
  for (let f = 0; f < FRAMES; f += 1) {
    const o = f * 8;
    const d = Math.hypot(coreRec[o + 4] - coreRec[o], coreRec[o + 5] - coreRec[o + 1]);
    if (d > best) break;
    best = d;
    periTime = (FIRST + f * EVERY) * DT;
  }
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
  while (!mergerDone() && performance.now() - start < budget) for (let k = 0; k < 10 && !mergerDone(); k += 1) advance();
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
const TONE_A: Rgb = [170, 192, 255];
const TONE_B: Rgb = [255, 206, 150];
/** 核球：老的、偏黄的星挤成一团 */
const TONE_CORE: Rgb = [255, 232, 196];
/** 旋臂上年轻的星：又亮又偏蓝白 */
const TONE_YOUNG: Rgb = [214, 226, 255];
/** 星的明暗从疏到密：不用 - 和 =（横着的笔画看起来像拖影） */
const STAR_RAMP = [...' .·:;+*#%@'].map(gi);
/** 旋臂：两条，螺距约 26°，整条以 PATTERN 的角速度转（比外盘的星慢，内圈的星从后面追上来穿过去） */
const PITCH = 1 / Math.tan(0.45);
const PATTERN = 2.2;

/** 旋臂上亮多少：r 是在盘上的半径，phase 是这一点（或这颗星）在盘上的角度减去旋臂转到的角度 */
function armWeight(r: number, logR: number, phase: number) {
  if (r < 0.12) return 1;
  const wave = (0.5 + 0.5 * Math.cos(2 * (phase + logR * PITCH))) ** 5;
  return 1 + smooth(0.12, 0.24, r) * (wave * 3 - 0.74);
}

/** 盘的边上淡下去，不是一刀切的圆片 */
const rim = (r: number) => 1 - 0.55 * smooth(0.4, DISK_OUT, r);

/**
 * 星系盘上「数不过来的那几千亿颗星」：一层平滑的光，按和粒子同一条旋臂公式调亮暗，直接加进密度图。
 * 粒子一格平均不到一颗，单靠它们旋臂会被噪声淹掉。只在擦身而过以前画（那之前盘还是圆的，平滑的模型是对的）。
 */
function smoothDisk(g: Grid, field: Float32Array, k: number, cx: number, cy: number, sx: number, scale: number, time: number, amount: number) {
  // 老的星铺成一张平滑的盘（旋臂内侧压一条暗的尘埃带），旋臂上年轻的星另记在 densY 里：更亮、偏蓝白
  if (amount < 0.01) return;
  const ci = Math.cos(TILT[k]);
  const si = Math.sin(TILT[k]);
  const cn = Math.cos(NODE[k]);
  const sn = Math.sin(NODE[k]);
  // 盘上 (x, y) → 屏幕（模拟单位）：X = m11 x + m12 y，Y = m21 x + m22 y；反过来解
  const m11 = cn;
  const m12 = -ci * sn;
  const m21 = 0.85 * sn;
  const m22 = 0.85 * ci * cn + 0.5 * si;
  const det = m11 * m22 - m12 * m21;
  // 一格有多大（盘上的面积），乘上盘的面密度就是这一格该有几颗星
  const cell = ((g.cw / sx) * (g.ch / scale)) / Math.abs(det);
  const norm = (STARS / (2 * Math.PI * DISK_H * DISK_H)) * cell * amount;
  const pattern = PATTERN * time;
  const reach = DISK_OUT * Math.max(Math.abs(m11) + Math.abs(m12), Math.abs(m21) + Math.abs(m22));
  const c0 = Math.max(0, colOf(g, cx - reach * sx));
  const c1 = Math.min(g.cols - 1, colOf(g, cx + reach * sx));
  const r0 = Math.max(0, rowOf(g, cy + reach * scale));
  const r1 = Math.min(g.rows - 1, rowOf(g, cy - reach * scale));
  for (let row = r0; row <= r1; row += 1) {
    const Y = (g.oy[row] - cy) / scale;
    for (let col = c0; col <= c1; col += 1) {
      const X = (g.ox[col] - cx) / sx;
      const x = (m22 * X - m12 * Y) / det;
      const y = (-m21 * X + m11 * Y) / det;
      const r = Math.sqrt(x * x + y * y);
      if (r <= DISK_IN || r > DISK_OUT) continue;
      const u = r - DISK_IN;
      const sigma = (u / r) * Math.exp(-u / DISK_H);
      const disk = norm * sigma * rim(r);
      const arm = smooth(0.12, 0.24, r);
      const phase = 2 * (Math.atan2(y, x) - pattern + Math.log(r) * PITCH);
      const wave = (0.5 + 0.5 * Math.cos(phase)) ** 6;
      const dust = (0.5 + 0.5 * Math.cos(phase - 0.6)) ** 10;
      const cell2 = row * g.cols + col;
      field[cell2] += disk * (0.6 + arm * (0.9 * wave - 0.45 * dust));
      // 年轻的星不像老星那样往外掉得那么快：外盘的旋臂一样清楚
      densY[cell2] += norm * 0.6 * Math.exp(-u / 0.42) * rim(r) * arm * wave;
    }
  }
}
/** 密度怎么换成亮度：1 - exp(-密度 × GAIN)（稀的地方近乎线性，旋臂和臂间拉得开；密到核球才饱和） */
const GAIN = 0.42;
const toneMap = (density: number) => 1 - Math.exp(-density * GAIN);
const HAZE_GAIN = 8;
const HAZE_NORM = 1 / Math.log(1 + HAZE_GAIN * 10);

let densA = new Float32Array(0);
let densB = new Float32Array(0);
let densC = new Float32Array(0);
let densY = new Float32Array(0);
let blurA = new Float32Array(0);
let scratch2 = new Float32Array(0);
let softA = new Float32Array(0);
let softB = new Float32Array(0);
let scratch = new Float32Array(0);
const tips: [number, number, number][] = [];
const sparks: number[] = [];

/** 一维的盒子模糊（滑动窗口求和，和半径无关的开销）：src → dst，按 stride 跳着走 count 个 */
function boxLine(src: Float32Array, dst: Float32Array, start: number, stride: number, count: number, radius: number) {
  const norm = 1 / (radius * 2 + 1);
  let sum = 0;
  for (let k = -radius; k <= radius; k += 1) sum += k >= 0 && k < count ? src[start + k * stride] : 0;
  for (let k = 0; k < count; k += 1) {
    dst[start + k * stride] = sum * norm;
    const add = k + radius + 1;
    const drop = k - radius;
    if (add < count) sum += src[start + add * stride];
    if (drop >= 0) sum -= src[start + drop * stride];
  }
}

/** 把一张密度图抹开（横竖各两遍盒子模糊，差不多是高斯） */
function blur(g: Grid, src: Float32Array, dst: Float32Array, rx: number, ry: number) {
  for (let pass = 0; pass < 2; pass += 1) {
    const from = pass === 0 ? src : dst;
    for (let row = 0; row < g.rows; row += 1) boxLine(from, scratch, row * g.cols, 1, g.cols, rx);
    for (let col = 0; col < g.cols; col += 1) boxLine(scratch, dst, col, g.cols, g.rows, ry);
  }
}

function ensure(g: Grid) {
  if (densA.length === g.count) {
    densA.fill(0);
    densB.fill(0);
    densC.fill(0);
    densY.fill(0);
    return;
  }
  densA = new Float32Array(g.count);
  densB = new Float32Array(g.count);
  densC = new Float32Array(g.count);
  densY = new Float32Array(g.count);
  blurA = new Float32Array(g.count);
  scratch2 = new Float32Array(g.count);
  softA = new Float32Array(g.count);
  softB = new Float32Array(g.count);
  scratch = new Float32Array(g.count);
}

/** 一颗星洒进密度图：上下分给相邻两行，左右分给相邻四列（格子是瘦长的，一颗星横着要占两格才是一个圆点） */
function splat(g: Grid, field: Float32Array, x: number, y: number, w: number) {
  const fc = (x + g.aspect / 2) / g.cw - 0.5;
  const fr = (g.half - y) / g.ch - 0.5;
  const r0 = Math.floor(fr);
  const c0 = Math.floor(fc);
  if (r0 < -1 || r0 >= g.rows || c0 < -2 || c0 > g.cols + 1) return;
  const v1 = fr - r0;
  for (let dr = 0; dr < 2; dr += 1) {
    const row = r0 + dr;
    if (row < 0 || row >= g.rows) continue;
    const wr = (dr === 0 ? 1 - v1 : v1) * w * 0.5;
    const base = row * g.cols;
    for (let col = c0 - 1; col <= c0 + 2; col += 1) {
      if (col < 0 || col >= g.cols) continue;
      const wc = 1 - Math.abs(col - fc) * 0.5;
      if (wc > 0) field[base + col] += wr * wc;
    }
  }
}

/** 核球：中间很亮、往外平滑地暗下去（Plummer 球那种轮廓），直接加进密度图 */
function bulge(g: Grid, cx: number, cy: number, size: number, strength: number) {
  const reach = size * 8;
  const c0 = Math.max(0, colOf(g, cx - reach * 1.1));
  const c1 = Math.min(g.cols - 1, colOf(g, cx + reach * 1.1));
  const r0 = Math.max(0, rowOf(g, cy + reach));
  const r1 = Math.min(g.rows - 1, rowOf(g, cy - reach));
  for (let row = r0; row <= r1; row += 1) {
    const dy = g.oy[row] - cy;
    for (let col = c0; col <= c1; col += 1) {
      const dx = (g.ox[col] - cx) / 1.1;
      const d2 = (dx * dx + dy * dy) / (size * size);
      if (d2 > 64) continue;
      densC[row * g.cols + col] += strength * ((1 + d2) ** -1.5 - 0.0019);
    }
  }
}

export function drawMerger(g: Grid, zz: number) {
  // 滑得太快、后台还没算完：剩下的当场算完
  if (!mergerDone()) prepareMerger(1e9);
  if (!rec || !coreRec) return;
  ensure(g);
  const time = interpolate(PLAY, zz);
  const at = clamp01((time / DT - FIRST) / EVERY / (FRAMES - 1)) * (FRAMES - 1);
  const f0 = Math.min(FRAMES - 2, Math.floor(at));
  const s = at - f0;
  // 三次 Hermite 的四个系数（位置用 h00/h01，速度乘上两帧的间隔用 h10/h11）
  const h00 = 2 * s * s * s - 3 * s * s + 1;
  const h01 = 1 - h00;
  const h10 = (s * s * s - 2 * s * s + s) * SPAN;
  const h11 = (s * s * s - s * s) * SPAN;
  const scale = 0.5 / 1.9;
  const sx = scale * 1.1;
  const appear = smooth(1550, 1558, zz);
  // 擦身而过以前，盘上的旋臂是画上去的密度波；擦身而过以后，交给模拟自己甩出来的潮汐臂
  const arms = 1 - smooth(periTime - 1.2, periTime + 1.5, time);
  // 星暴：擦身而过时点燃，合并以后慢慢熄掉一大半
  const burst = smooth(periTime - 0.4, periTime + 1.2, time) * (1 - 0.65 * smooth(periTime + 3, periTime + 8, time));
  const pattern = PATTERN * time;
  // 擦身而过以前，一大半的光由平滑的盘来画，粒子只负责颗粒感；之后全交给粒子
  const share = 0.6 * (1 - smooth(periTime - 1.6, periTime + 0.4, time));
  const particle = 1 - share;
  sparks.length = 0;
  const a0 = f0 * N * 4;
  const a1 = a0 + N * 4;
  for (let i = 0; i < N; i += 1) {
    const o0 = a0 + i * 4;
    const o1 = a1 + i * 4;
    const x = ((h00 * rec[o0] + h01 * rec[o1]) / PQ + (h10 * rec[o0 + 2] + h11 * rec[o1 + 2]) / VQ) * sx;
    const y = ((h00 * rec[o0 + 1] + h01 * rec[o1 + 1]) / PQ + (h10 * rec[o0 + 3] + h11 * rec[o1 + 3]) / VQ) * scale;
    if (x < -g.aspect / 2 - 0.02 || x > g.aspect / 2 + 0.02 || y < -g.half - 0.02 || y > g.half + 0.02) continue;
    let w = 1;
    if (arms > 0.01) w = 1 + arms * (armWeight(homeR[i], homeLog[i], homeA[i] + homeW[i] * time - pattern) - 1);
    w *= rim(homeR[i]) * particle;
    splat(g, i < STARS ? densA : densB, x, y, w * appear);
    if (kind[i] !== 0) sparks.push(i, x, y);
  }
  // 两个核（也用三次曲线插），核球直接加进密度图
  const co0 = f0 * 8;
  const co1 = co0 + 8;
  const coreAt = (k: number) => (h00 * coreRec![co0 + k] + h01 * coreRec![co1 + k] + h10 * coreRec![co0 + k + 2] + h11 * coreRec![co1 + k + 2]);
  const core0x = coreAt(0) * sx;
  const core0y = coreAt(1) * scale;
  const core1x = coreAt(4) * sx;
  const core1y = coreAt(5) * scale;
  bulge(g, core0x, core0y, 0.011, 15 * appear);
  bulge(g, core1x, core1y, 0.01, 13 * appear);
  smoothDisk(g, densA, 0, core0x, core0y, sx, scale, time, share * appear);
  smoothDisk(g, densB, 1, core1x, core1y, sx, scale, time, share * appear);
  // 星数有限，一格一格数会很「噪」：挑字用稍微抹开一点的密度，垫底的光用抹得很开的
  blur(g, densA, softA, 2, 1);
  blur(g, densB, softB, 2, 1);
  // 垫底的光只抹一张（三张加起来），颜色按这一格附近哪个星系的星多来定：省掉两次大范围的模糊
  for (let k = 0; k < g.count; k += 1) scratch2[k] = densA[k] + densB[k] + densC[k];
  blur(g, scratch2, blurA, 9, 4);
  // 每一格：密度挑字和亮度，抹开的密度垫底色
  for (let row = 0; row < g.rows; row += 1) {
    for (let col = 0; col < g.cols; col += 1) {
      const k = row * g.cols + col;
      const a = densA[k] * 0.4 + softA[k] * 0.6;
      const b = densB[k] * 0.4 + softB[k] * 0.6;
      const c = densC[k];
      const yy = densY[k];
      const haze = blurA[k];
      if (haze > 0.004) {
        const h = Math.log(1 + haze * HAZE_GAIN) * HAZE_NORM;
        // 这一格的颜色：附近两个星系、核球各占多少（一颗星都没有的地方用两个星系的中间色）
        const sa = softA[k] + 0.02;
        const sb = softB[k] + 0.02;
        const sc = densC[k];
        const w = h / (sa + sb + sc);
        const red = (sa * TONE_A[0] + sb * TONE_B[0] + sc * TONE_CORE[0]) * w;
        const green = (sa * TONE_A[1] + sb * TONE_B[1] + sc * TONE_CORE[1]) * w;
        const blue = (sa * TONE_A[2] + sb * TONE_B[2] + sc * TONE_CORE[2]) * w;
        tint(g, k, BG[0] + red * 0.16, BG[1] + green * 0.13, BG[2] + blue * 0.17);
      }
      const total = a + b + c + yy;
      if (total < 0.03) continue;
      const v = toneMap(total);
      // 抖一点点，免得亮度台阶连成一圈圈的线（用哈希不用 Bayer：规则的网点在暗处会排成格子）
      const pick = v + (hash2(col, row) - 0.5) * 0.08;
      if (pick < 0.04) continue;
      const glyph = STAR_RAMP[Math.max(1, Math.min(STAR_RAMP.length - 1, Math.round(pick * (STAR_RAMP.length - 1))))];
      const lum = (0.3 + 0.95 * v) / total;
      put(
        g,
        k,
        glyph,
        (a * TONE_A[0] + b * TONE_B[0] + c * TONE_CORE[0] + yy * TONE_YOUNG[0]) * lum,
        (a * TONE_A[1] + b * TONE_B[1] + c * TONE_CORE[1] + yy * TONE_YOUNG[1]) * lum,
        (a * TONE_A[2] + b * TONE_B[2] + c * TONE_CORE[2] + yy * TONE_YOUNG[2]) * lum,
      );
    }
  }
  // 特别亮的星：一颗一个小十字；外盘的气体在相撞以后挤成新星团，粉色的一小团一小团
  for (let k = 0; k < sparks.length; k += 3) {
    const i = sparks[k];
    const x = sparks[k + 1];
    const y = sparks[k + 2];
    const cell = colOf(g, x) + rowOf(g, y) * g.cols;
    if (kind[i] === 1) {
      const v = toneMap(softA[cell] + softB[cell] + densC[cell] + densY[cell]);
      if (v > 0.7) continue;
      const tone = i < STARS ? TONE_A : TONE_B;
      const lift = (0.75 + 0.25 * hash1(i)) * appear;
      plot(g, x, y, hash1(i * 3) < 0.5 ? G.plus : G.star, (tone[0] * 0.4 + 150) * lift, (tone[1] * 0.4 + 150) * lift, (tone[2] * 0.4 + 150) * lift);
      continue;
    }
    // 擦身而过以前：只有正好在旋臂上的气体亮（旋臂上的 HII 区）；之后：被挤压的气体到处点燃
    const onArm = arms * smooth(1.8, 2.6, armWeight(homeR[i], homeLog[i], homeA[i] + homeW[i] * time - pattern)) * 0.8;
    const fire = Math.max(onArm, hash1(i * 7 + 1) < burst * 0.8 ? Math.min(1, burst * 1.6) : 0);
    if (fire > 0.03) {
      const lift = (0.7 + 0.3 * hash1(i * 5)) * appear * fire;
      const at2 = plot(g, x, y, hash1(i) < 0.6 ? G.star : G.o, PINK[0] * lift, (PINK[1] + 50) * lift, (PINK[2] + 50) * lift);
      if (at2 >= 0) {
        glow(g, at2, 40 * lift, 8 * lift, 20 * lift);
        if (at2 % g.cols > 0) glow(g, at2 - 1, 22 * lift, 4 * lift, 11 * lift);
        if (at2 % g.cols < g.cols - 1) glow(g, at2 + 1, 22 * lift, 4 * lift, 11 * lift);
      }
    }
  }
  // 远处的背景星系：稀稀拉拉的暗点，给画面一点纵深
  for (let k = 0; k < 90; k += 1) {
    const x = (hash1(k * 13 + 5) - 0.5) * g.aspect;
    const y = (hash1(k * 17 + 9) - 0.5) * g.half * 2;
    const v = (0.25 + 0.35 * hash1(k * 29)) * appear;
    const cell = colOf(g, x) + rowOf(g, y) * g.cols;
    if (cell >= 0 && cell < g.count && g.fg[cell * 4 + 3] === 0) plot(g, x, y, k % 7 === 0 ? G.mid : G.dot, 170 * v, 160 * v, 220 * v);
  }
  // 标注：尾巴尖（第一个星系里离中心最远的那一成星，挑一颗；别挑那几颗被甩飞的散星）
  let tipX = 0;
  let tipY = 0;
  tips.length = 0;
  for (let i = 0; i < STARS; i += 5) {
    const o = a0 + i * 4;
    const x = (rec[o] / PQ) * sx;
    const y = (rec[o + 1] / PQ) * scale;
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
/** 旋涡星系从疏到密的字（不用 - 和 =：横笔画连起来像扫描线） */
const SPIRAL_RAMP = [...' .·:;+*#%@'].map(gi);
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
  // 一格一格算；只有放大到比屏幕还大很多（钻进去那一段）才隔一列算一次
  const stride = size > 6 ? 4 : size > 3 ? 3 : size > 0.9 ? 2 : 1;
  // 放大到这么大时细节反正看不清：省掉两层细噪声
  const fine = stride === 1;
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
      const clump = 0.55 + 0.6 * noise2(x * 9 + 3, y * 9 - 2) + (fine ? 0.3 * noise2(x * 23 - 5, y * 23 + 7) : 0.15);
      const arms = (main + minor) * clump;
      const dust = (0.5 + 0.5 * Math.cos(2 * phi - 0.55)) ** 9 * smooth(0.2, 0.35, r) * (fine ? 0.7 + 0.5 * noise2(x * 17, y * 17 + 4) : 0.95);
      const disk = Math.exp(-r / 0.3) * (1 - smooth(0.85, 1.12, r));
      const bar = Math.exp(-((x / 0.24) ** 2 + (y / 0.085) ** 2));
      const bulge = Math.exp(-((r / 0.09) ** 2));
      const glowArm = disk * (0.25 + 1.6 * arms) * (1 - 0.65 * Math.min(1, dust));
      const glowCore = 1.2 * bar + 1.5 * bulge;
      const raw = (glowArm + glowCore) * show;
      // 高光压住：棒和核球不会糊成一整块 @
      const light = 1 - Math.exp(-raw * 1.4);
      if (light < 0.05) continue;
      const warm = clamp01(glowCore / (glowCore + glowArm + 1e-4));
      const red = ARM_TONE[0] + (CORE_TONE[0] - ARM_TONE[0]) * warm;
      const green = ARM_TONE[1] + (CORE_TONE[1] - ARM_TONE[1]) * warm;
      const blue = ARM_TONE[2] + (CORE_TONE[2] - ARM_TONE[2]) * warm;
      for (let c = col; c < Math.min(col + stride, c1 + 1); c += 1) {
        const i = row * g.cols + c;
        // 底下一层柔光：星系是一团光，不只是一把字
        glow(g, i, red * light * 0.1, green * light * 0.09, blue * light * 0.11);
        const h = hash2(c * 7, row * 3);
        // 旋臂上正在生新星的地方：粉色的一小团
        if (detail > 0 && arms > 0.55 && h < 0.05 * detail) {
          put(g, i, G.star, PINK[0] * show, (PINK[1] + 70) * show, (PINK[2] + 60) * show);
          glow(g, i, 30 * show, 6 * show, 14 * show);
          continue;
        }
        // 零零星星特别亮的星
        if (detail > 0 && h > 1 - 0.012 * detail && light < 0.8) {
          put(g, i, h > 1 - 0.004 * detail ? G.plus : G.mid, 235 * show, 238 * show, 255 * show);
          continue;
        }
        const pick = light + (hash2(c * 3 + 1, row * 5 + 2) - 0.5) * 0.1;
        if (pick < 0.06) continue;
        const lum = 0.42 + 0.6 * light;
        put(g, i, SPIRAL_RAMP[Math.min(SPIRAL_RAMP.length - 1, 1 + Math.floor(pick * (SPIRAL_RAMP.length - 1)))], red * lum, green * lum, blue * lum);
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
