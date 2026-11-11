// 普朗克尺度以后，宇宙的头十亿年：时空泡沫 →（左下角的读数从尺度翻成时间：再小下去没有意义了，但还能更早）→
// 四种力一股股分家 → 暴胀 → 热大爆炸 → 希格斯场打开 → 夸克汤 → 物质赢过反物质 → 质子和中子 → 中微子飞走 → 氢和氦 →
// 发光的雾 → 雾散开（微波背景）→ 黑暗时代 → 暗物质的网 → 第一批恒星 → 再电离 → 星系。
// 再往后（星系相撞、银河系、太阳和地球、一路拉远到宇宙网）在 galaxies.ts、sun.ts、pullback.ts。
// 整段共用一张花纹：泡沫定住以后被暴胀一层层拉大、抹平，成了汤里和雾里那点几乎看不出的起伏、微波背景上的冷热斑，
// 再被引力收成一道道墙；最后镜头拉远回泡沫原来的大小，宇宙网就是当初那片泡沫。
// 大爆炸画成「没有中心的膨胀」：没有火球、没有冲击波，每一点都在离开其它所有点，最后整屏在同一刻烧白。

import { G, RAMP, lineGlyph } from '../charset';
import { BG, clamp01, clock, colOf, hash1, hash2, hash3, lerp, noise2, plot, put, rowOf, smooth, threshold, tint, walk, type Grid } from '../grid';
import { callout, legend, note, status, type Rgb } from '../notes';
import { formatScale, interpolate, timeAt } from '../timeline';
import { drawForces } from './forces';
import { ball, bump, drawSpread, glow, ringAt, smudge } from './shapes';

/* ====================== 普朗克尺度：时空泡沫 ====================== */

/** 读数翻成时间以后，泡沫慢慢定住（屏住一口气，接着就是暴胀） */
const CALM: [number, number] = [1000, 1030];
const foamClock = clock();
/** 泡沫走到哪了。定住以后，后面整段宇宙史用的都是这一刻的花纹 */
let phase = 0;
/** 泡沫多大：一边慢慢胀缩，一边跟着放大一点点；定住以后两样都停 */
const foamScale = (t: number, zz: number, calm: number) =>
  3.2 * (1 + 0.08 * (1 - calm) * Math.sin(t * 0.35)) * (1 + (0.04 * (Math.min(zz, CALM[1]) - 960)) / 100);
/** 定住那一刻泡沫的大小：后面所有花纹都按它来 */
const BASE = foamScale(0, CALM[1], 1);

/** 泡沫的一个样本，返回 n（泡泡本身，接近 0.5 的地方是泡壁）；顺便留下扭曲场 fq1 / fq2（泡壁往哪走）和扭曲后的坐标 */
let fq1 = 0;
let fq2 = 0;
let fwx = 0;
let fwy = 0;
function foamN(px: number, py: number, t: number) {
  fq1 = noise2(px * 1.7 + t * 0.35, py * 1.7);
  fq2 = noise2(px * 1.7 + 5.2, py * 1.7 - t * 0.3);
  fwx = px + 1.6 * fq1;
  fwy = py + 1.6 * fq2;
  return noise2(fwx * 2.2 - t * 0.25, fwy * 2.2 + t * 0.2);
}

/** 泡沫的一格：v 是亮度，m 是更细的一层（越大越偏粉），wall 是泡壁有多清楚，(dx, dy) 是扭曲场；k 整体调暗 */
function foamCell(g: Grid, i: number, v: number, m: number, wall: number, dx: number, dy: number, k = 1) {
  if (v < 0.1) return;
  const pink = smooth(0.35, 0.75, m);
  const r = (170 + 85 * v) * k;
  const gr = (150 + 105 * v) * (1 - pink * 0.55) * k;
  const b = (220 + 35 * v) * k;
  if (wall > 0.5) {
    put(g, i, lineGlyph(-(dy - 0.5), dx - 0.5), r, gr, b);
    tint(g, i, 46 * v * k, 30 * v * k, 58 * v * k);
  } else put(g, i, RAMP[Math.min(9, 1 + Math.floor(v * 9))], r * 0.62, gr * 0.55, b * 0.75);
}

export function drawFoam(g: Grid, zz: number) {
  const calm = smooth(CALM[0], CALM[1], zz);
  const wild = 1 - calm;
  const t = foamClock(g, wild);
  phase = t;
  const frame = g.reduced ? 0 : Math.floor(g.time * 8);
  // 四种力的家谱叠在定住的泡沫上：这时候泡沫暗一点，线才看得清
  const tree = smooth(1024, 1032, zz) * (1 - smooth(1054, 1062, zz));
  const dim = 1 - 0.72 * tree;
  // 泡沫在哪个尺度看都差不多乱：不再跟着放大，只是慢慢地一胀一缩
  const scale = foamScale(t, zz, calm);
  // 噪声隔一列算一次（两格共用），省一半时间
  for (let y = 0; y < g.rows; y += 1) {
    // 「距离」在这里不太靠得住：时不时有几行整行错开（定住以后就不错了）
    const tear = hash2(y, frame) < 0.08 * wild ? (hash2(frame, y) - 0.5) * 0.25 : 0;
    for (let x = 0; x < g.cols; x += 2) {
      const jitter = (hash2(x + y * 977, frame) - 0.5) * 0.05 * wild + tear;
      const n = foamN(g.ox[x] * scale + jitter, g.oy[y] * scale, t);
      const m = noise2(fwx * 4.4 + 7, fwy * 4.4 - t * 0.5);
      // 泡泡的壁：噪声接近 0.5 的地方是一条亮线
      const wall = (1 - Math.abs(2 * n - 1)) ** 8;
      const v = Math.min(1, wall * 1.25 + m * 0.1);
      for (let c = x; c < Math.min(x + 2, g.cols); c += 1) foamCell(g, y * g.cols + c, v, m, wall, fq1, fq2, dim);
    }
  }
  // 冒出来又消失的小涨落（定住以后就不冒了）
  for (let k = 0; k < 18; k += 1) {
    if (hash2(k, frame) > 0.5 * wild) continue;
    const sx = (hash2(frame, k + 1) - 0.5) * g.aspect;
    const sy = (hash2(k + 5, frame * 3) - 0.5) * g.half * 2;
    walk(g, sx, sy, sx, sy, (i) => put(g, i, hash2(k, frame + 1) < 0.5 ? G.star : G.plus, 255, 220, 240));
  }
  // 一把量不准的尺子：刻度自己在乱跳；读数翻成时间以后它就散掉了
  const ruler = 1 - smooth(994, 1012, zz);
  if (ruler > 0.02) {
    const row = Math.floor(g.rows * 0.2);
    const from = Math.floor(g.cols * 0.3);
    const to = Math.floor(g.cols * 0.7);
    let next = from;
    for (let c = from; c <= to; c += 1) {
      const tick = c === next;
      if (tick) next = c + 4 + Math.floor(hash2(c, frame >> 1) * 9);
      if (threshold(c, row) > ruler) continue;
      const i = (row + (hash2(c, frame) < 0.06 ? 1 : 0)) * g.cols + c;
      put(g, i, tick ? G.pipe : G.dash, 255, 143, 189);
      tint(g, i, 12, 10, 20);
    }
    note(g, 0, g.half - (row - 1.5) * g.ch, 'a ruler stops working here', [255, 190, 215], 0.5, ruler);
  }
  if (tree > 0.02) {
    const time = g.reduced ? 0 : g.time;
    drawForces(g, { left: -0.42 * g.aspect, right: 0.42 * g.aspect, y: 0.04, lane: 0.075, log: timeAt(zz), show: tree, labels: tree, compact: false }, time);
  }
}

/* ====================== 一张花纹，从泡沫一路传到宇宙网 ====================== */

/** 暴胀在画面上一共拉大 2^Z_END 倍（真实是 10^26 倍，读数里写着）；停在半层的地方，最后留下几层粗细不同的起伏 */
const Z_END = 3.5;
/** 一层泡沫拉大到 2^LIFE 倍（六倍多）以后看不出花纹了，就淡掉 */
const LIFE = 2.6;
/** 每一层泡沫各取一块不同的地方（第 0 层就是刚才那片泡沫） */
const SHIFT: [number, number][] = [
  [0, 0],
  [13.7, -8.2],
  [-21.3, 15.4],
  [31.9, 4.6],
  [-7.1, -27.8],
];

/**
 * 暴胀不是把一片泡沫放大就完了：老的那层被拉大、抹平的同时，更细的新泡沫一直在冒，接着也被拉大。
 * 第 j 层在 z 时有多重：刚长出来时慢慢浮现，被拉到 2^LIFE 倍时淡掉；第 0 层一开始就在。
 */
function layerWeight(j: number, z: number) {
  const age = z - j;
  if (age < 0) return 0;
  return (j === 0 ? 1 : smooth(0, 0.6, age)) * (1 - smooth(LIFE - 1, LIFE, age));
}

/** 这一帧有哪几层、各自多重、缩放多少（每帧算一次，别在每个样本里重复算） */
type Layer = { j: number; w: number; k: number; sx: number; sy: number; soft: number };
const plan: Layer[] = SHIFT.map(() => ({ j: 0, w: 0, k: 1, sx: 0, sy: 0, soft: 1 }));
let planCount = 0;
let planNorm = 1;

/** z：拉大了多少（log2）；soften：0 = 泡壁清清楚楚，1 = 全抹成了起伏 */
function prepare(z: number, soften: number) {
  planCount = 0;
  let w2 = 0;
  for (let j = Math.max(0, Math.ceil(z - LIFE)); j <= Math.min(SHIFT.length - 1, Math.floor(z)); j += 1) {
    const w = layerWeight(j, z);
    // 太淡的层（刚冒头、快淡掉）看不出来，省掉一层三次噪声
    if (w < 0.06) continue;
    const layer = plan[planCount];
    planCount += 1;
    layer.j = j;
    layer.w = w;
    layer.k = 2 ** (j - z);
    layer.sx = SHIFT[j][0];
    layer.sy = SHIFT[j][1];
    layer.soft = Math.max(soften, smooth(0.25, 1.5, z - j));
    w2 += w * w;
  }
  // 按权重的平方和归一：叠几层起伏都一样大
  planNorm = w2 > 0 ? 1 / Math.sqrt(w2) : 0;
}

/** 叠起来以后的一个样本：sBlob 是冷热起伏（大约 -0.5..0.5，只有一层时就是 n - 0.5）；sWall 是还没被抹平的泡壁，sDx / sDy / sM 是它的走向和粉不粉 */
let sBlob = 0;
let sWall = 0;
let sDx = 0.5;
let sDy = 0.5;
let sM = 0.4;

/** (px, py) 是泡沫坐标；层由 prepare 定 */
function sample(px: number, py: number, t: number) {
  let sum = 0;
  let wall = 0;
  sM = 0.4;
  for (let n = 0; n < planCount; n += 1) {
    const layer = plan[n];
    const v0 = foamN(px * layer.k + layer.sx, py * layer.k + layer.sy, t);
    sum += layer.w * (v0 - 0.5);
    if (layer.soft < 1) {
      const r = 1 - Math.abs(2 * v0 - 1);
      const r2 = r * r;
      const r4 = r2 * r2;
      const v = r4 * r4 * (1 - layer.soft) * layer.w;
      if (v > wall) {
        wall = v;
        sDx = fq1;
        sDy = fq2;
        if (layer.j === 0) sM = noise2(fwx * 4.4 + 7, fwy * 4.4 - t * 0.5);
      }
    }
  }
  sBlob = sum * planNorm;
  sWall = wall;
}

/**
 * 一张花纹按每两列一个样本存下来（几个场景共用）；格子、泡沫的相位或 z 变了才重算。
 * cmb 是微波背景用的：再叠上暴胀停下那一刻刚冒出来、还没来得及被拉大的那层最细的泡沫，冷热斑才有大有小
 */
type Field = { key: string; cols: number; blob: Float32Array; cmb: Float32Array };
const frozenSlot: Field = { key: '', cols: 0, blob: new Float32Array(0), cmb: new Float32Array(0) };
const NEWEST = SHIFT[SHIFT.length - 1];
function field(g: Grid, z: number, slot: Field) {
  const key = `${g.cols}x${g.rows}:${phase}:${z}`;
  if (slot.key === key) return slot;
  const cols = Math.ceil(g.cols / 2);
  if (slot.blob.length !== cols * g.rows) {
    slot.blob = new Float32Array(cols * g.rows);
    slot.cmb = new Float32Array(cols * g.rows);
  }
  prepare(z, 1);
  for (let y = 0; y < g.rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const px = g.ox[x * 2] * BASE;
      const py = g.oy[y] * BASE;
      sample(px, py, phase);
      const o = y * cols + x;
      slot.blob[o] = sBlob;
      slot.cmb[o] = (sBlob + 0.6 * (foamN(px + NEWEST[0], py + NEWEST[1], phase) - 0.5)) / 1.166;
    }
  }
  slot.key = key;
  slot.cols = cols;
  return slot;
}
/** 暴胀停下来以后的花纹：汤、雾、微波背景、黑暗时代都用它 */
const frozen = (g: Grid) => field(g, Z_END, frozenSlot);
/** 起伏换成 -1..1（冷热斑上色用） */
const spot = (b: number) => Math.max(-1, Math.min(1, b / 0.28));
/** 泡壁（起伏的「零线」）：1 在墙上，0 离墙最远 */
const ridgeOf = (b: number) => clamp01(1 - 2 * Math.abs(b));
/** 收紧以后的墙：ridge^7（乘出来，比 ** 快） */
function wallOf(b: number) {
  const r = ridgeOf(b);
  const r2 = r * r;
  return r2 * r2 * r2 * r;
}

/* ====================== 暴胀 + 热大爆炸 ====================== */

/** 暴胀从哪拉到哪（zz）：画面上是 2^Z_END 倍，真实是 10^26 倍 */
const STRETCH: [number, number] = [1064, 1098];
/** 暴胀一停，能量变成热：整屏同时烧起来 */
const HEAT: [number, number] = [1100, 1114];
const HOT: Rgb = [255, 244, 226];
/** 整个今天看得见的宇宙有多大（log10 米）：暴胀前比质子小得多，暴胀完大概一个柚子那么大 */
const SIZE_KEYS: [number, number][] = [
  [1066, -26.7],
  [1098, -1],
];

export function drawInflation(g: Grid, zz: number) {
  const t = phase;
  const z = Z_END * smooth(STRETCH[0], STRETCH[1], zz);
  // 越往后泡壁越被抹平，只剩大片柔和的起伏；暴胀的时候宇宙其实是冷的：越来越暗、越来越蓝
  const soften = smooth(1072, 1096, zz);
  const ripple = smooth(1068, 1086, zz);
  const cool = smooth(1066, 1098, zz);
  const dim = 1 - 0.35 * cool;
  const heat = smooth(HEAT[0], HEAT[1], zz);
  const frame = g.reduced ? 0 : Math.floor(g.time * 12);
  // 拉完了、泡壁也全抹平了：花纹就是暴胀停下来时那张，不用每帧重算
  const done = z >= Z_END && soften >= 1 ? frozen(g) : null;
  if (!done) prepare(z, soften);
  for (let y = 0; y < g.rows; y += 1) {
    for (let x = 0; x < g.cols; x += 2) {
      if (done) {
        sBlob = done.blob[y * done.cols + (x >> 1)];
        sWall = 0;
        sM = 0.4;
      } else sample(g.ox[x] * BASE, g.oy[y] * BASE, t);
      const blob = sBlob;
      const wall = sWall;
      const v = Math.min(1, wall * 1.25 + sM * 0.1 * (1 - soften));
      // 起伏：鼓起来的地方是一团团方块（后面就成了微波背景上的斑），瘪下去的地方空着
      const shade = ((clamp01(0.5 + blob * 1.6) - 0.3) / 0.7) * ripple;
      const sk = (0.75 + 0.25 * shade) * (1 - 0.15 * cool);
      const sr = lerp(210, 105, cool) * sk;
      const sg = lerp(150, 125, cool) * sk;
      const sb = 255 * sk;
      for (let c = x; c < Math.min(x + 2, g.cols); c += 1) {
        const i = y * g.cols + c;
        if (heat > 0 && threshold(c, y) < heat * 1.15) {
          // 整屏同时烧白：不是从哪一点开始的，每一格都在同一刻亮起来；刚才的起伏还留着一点点
          const k = heat * (0.92 + 0.2 * blob) * 0.92;
          tint(g, i, BG[0] + (HOT[0] - BG[0]) * k, BG[1] + (HOT[1] - BG[1]) * k, BG[2] + (HOT[2] - BG[2]) * k);
          // 白光里零零星星翻着更亮的火星（只占三成格子，不然满屏的字反而显得发灰）
          const h = hash2(i, frame);
          if (h < 0.3) put(g, i, h < 0.08 ? G.star : h < 0.18 ? G.plus : G.dot, 255, 255, 250);
          continue;
        }
        if (v >= 0.1 && (shade < 0.05 || v > 0.4)) {
          foamCell(g, i, v, sM, wall, sDx, sDy, dim);
          continue;
        }
        if (shade < 0.05) continue;
        // 方块字在这么细的格子里很稀，亮度主要靠底色撑
        const under = 0.1 + 0.28 * shade;
        put(g, i, shade < 0.25 ? G.light : shade < 0.55 ? G.medium : G.dark, sr, sg, sb);
        tint(g, i, BG[0] + sr * under, BG[1] + sg * under, BG[2] + sb * under);
      }
    }
  }
  drawSpread(g, z, smooth(STRETCH[0], STRETCH[0] + 8, zz) * (1 - smooth(1094, 1104, zz)));
  note(g, 0, g.half - 0.09, 'every point moves away from every other point', [190, 200, 255], 0.5, smooth(1070, 1076, zz) * (1 - smooth(1092, 1098, zz)));
  if (heat < 0.5) {
    const size = interpolate(SIZE_KEYS, zz);
    status(g, `everything you can see today: ${formatScale(size)} across`, [190, 200, 255], smooth(1066, 1071, zz) * (1 - heat * 2));
  } else status(g, 'no center, no edge: it happens everywhere at once', [255, 236, 200], (heat - 0.5) * 2);
}

/* ============ 希格斯场 → 夸克汤 → 物质赢过反物质 → 质子和中子 → 中微子飞走 → 氢和氦 ============ */

const QUARK: Rgb[] = [
  [255, 72, 72],
  [72, 255, 112],
  [96, 136, 255],
];
/** 反夸克用补色：反红是青、反绿是品红、反蓝是黄 */
const ANTI: Rgb[] = [
  [72, 250, 255],
  [255, 90, 255],
  [255, 250, 96],
];
const PROTON: Rgb = [255, 130, 170];
const NEUTRON: Rgb = [170, 190, 255];
const ELECTRON: Rgb = [150, 235, 255];
const GLUON: Rgb = [255, 236, 170];
const NEUTRINO: Rgb = [190, 255, 225];

/** 汤冷下来的过程：zz → 温度（1 = 白热） */
const TEMP: [number, number][] = [
  [1114, 1],
  [1152, 0.88],
  [1204, 0.66],
  [1260, 0.52],
  [1290, 0.42],
];
/** 希格斯场打开：每个粒子在这段里的某一刻突然有了质量，从光速的一道线变成一个慢下来的小球 */
const MASS: [number, number] = [1134, 1144];
/** 一对对正反夸克撞在一起、变成光 */
const WIPE: [number, number] = [1176, 1194];
/** 夸克三个三个抱成一团 */
const HUDDLE: [number, number] = [1196, 1216];
/** 一团三个夸克缩成一个质子 / 中子 */
const SHRINK: [number, number] = [1222, 1232];
/** 中微子不再撞东西，直直地飞走 */
const LOOSE: [number, number] = [1226, 1262];
/** 两个质子、两个中子聚成一个氦核 */
const FUSE: [number, number] = [1260, 1276];

/** 火的颜色：暗红 → 红 → 橙 → 黄 → 白热（写进 FIRE_OUT，不分配内存） */
const FIRE: Rgb[] = [
  [40, 14, 30],
  [150, 34, 40],
  [255, 110, 50],
  [255, 200, 100],
  [255, 248, 230],
];
const FIRE_OUT: Rgb = [0, 0, 0];
function fire(h: number) {
  const s = Math.min(FIRE.length - 1.001, Math.max(0, h) * (FIRE.length - 1));
  const k = Math.floor(s);
  const f = s - k;
  for (let c = 0; c < 3; c += 1) FIRE_OUT[c] = FIRE[k][c] + (FIRE[k + 1][c] - FIRE[k][c]) * f;
  return FIRE_OUT;
}

/**
 * 一个核子（以后的质子或中子）落在第 (bx, by) 格。每 4×4 格里有 2 个中子、14 个质子（中子:质子 ≈ 1:7）；
 * 左上角那 2×2 格（两个中子在对角）最后聚成一个氦核，其余 12 个质子就是氢核：按质量正好 1/4 是氦。
 */
type Baryon = { x: number; y: number; mx: number; my: number; neutron: boolean; helium: boolean; hx: number; hy: number; seed: number };
/** 一对注定要湮灭的正反夸克：在 (hx, hy) 附近乱跑，到了 end 撞在一起变成光 */
type Pair = { hx: number; hy: number; color: number; end: number };
const SPACING = 0.085;
let baryons: Baryon[] = [];
let pairs: Pair[] = [];
let layoutKey = '';
/** 讲解时指着的那几个：一个质子、一个中子、一个氦核 */
const picks = { proton: 0, neutron: 0, helium: 0 };

function layout(g: Grid) {
  const key = `${g.aspect.toFixed(3)}|${g.half.toFixed(3)}`;
  if (key === layoutKey) return baryons;
  layoutKey = key;
  baryons = [];
  const nx = Math.ceil(g.aspect / 2 / SPACING) + 1;
  const ny = Math.ceil(g.half / SPACING) + 1;
  for (let by = -ny; by <= ny; by += 1) {
    for (let bx = -nx; bx <= nx; bx += 1) {
      const mx = ((bx % 4) + 4) % 4;
      const my = ((by % 4) + 4) % 4;
      const helium = mx < 2 && my < 2;
      baryons.push({
        x: (bx + (hash2(bx, by) - 0.5) * 0.55) * SPACING,
        y: (by + (hash2(by + 31, bx) - 0.5) * 0.55) * SPACING,
        mx,
        my,
        helium,
        neutron: helium && mx === my,
        hx: (bx - mx + 0.5) * SPACING,
        hy: (by - my + 0.5) * SPACING,
        seed: hash2(bx * 7 + 3, by * 13 + 5),
      });
    }
  }
  // 比留下来的多出一倍半的正反夸克对：撞完以后汤一下子空了一大半
  pairs = [];
  const count = Math.round(baryons.length * 1.6);
  for (let p = 0; p < count; p += 1) {
    pairs.push({
      hx: p === 0 ? 0.24 : (hash2(p, 71) - 0.5) * (g.aspect + 0.1),
      hy: p === 0 ? 0.08 : (hash2(73, p) - 0.5) * (g.half * 2 + 0.1),
      color: p % 3,
      end: p === 0 ? 1182 : WIPE[0] + hash1(p * 7 + 3) * (WIPE[1] - WIPE[0]),
    });
  }
  const nearest = (x: number, y: number, ok: (b: Baryon) => boolean) => {
    let best = 0;
    let d = Infinity;
    baryons.forEach((b, k) => {
      const e = (b.x - x) ** 2 + (b.y - y) ** 2;
      if (ok(b) && e < d) {
        d = e;
        best = k;
      }
    });
    return best;
  };
  picks.proton = nearest(-0.3, 0.12, (b) => !b.helium);
  picks.neutron = nearest(0.28, -0.16, (b) => b.neutron);
  picks.helium = nearest(0.2, 0.04, (b) => b.helium && b.mx === 0 && b.my === 0);
  return baryons;
}

/** 汤里、雾里的东西自己的钟：越冷动得越慢 */
const matterClock = clock();

let bx0 = 0;
let by0 = 0;
/** 第 k 个核子现在在哪（慢慢漂；聚成氦核的那几个往一处收） */
function baryonAt(g: Grid, k: number, t: number, fuse: number) {
  const b = baryons[k];
  let x = b.x + 0.012 * Math.sin(t * 0.5 + b.seed * 40);
  let y = b.y + 0.01 * Math.cos(t * 0.43 + b.seed * 27);
  if (b.helium && fuse > 0) {
    // 四个小球挤成 2×2：中子在对角
    const hx = b.hx + 0.01 * Math.sin(t * 0.5 + b.hx * 31) + (b.mx - 0.5) * 3 * g.cw;
    const hy = b.hy + 0.008 * Math.cos(t * 0.43 + b.hy * 23) + (0.5 - b.my) * 2 * g.ch;
    x = lerp(x, hx, fuse);
    y = lerp(y, hy, fuse);
  }
  bx0 = x;
  by0 = y;
}

let qx0 = 0;
let qy0 = 0;
/** 汤里一个粒子（编号 id）绕着 (cx, cy) 乱跑；huddle 时改成和同一团的另外两个一起绕着中心转 */
function wander(id: number, t: number, cx: number, cy: number) {
  const p1 = hash1(id * 4 + 1) * 6.283;
  const p2 = hash1(id * 4 + 2) * 6.283;
  const w1 = 1.1 + hash1(id * 4 + 3) * 1.7;
  const w2 = 0.8 + hash1(id * 4 + 4) * 1.5;
  const reach = 0.07;
  qx0 = cx + reach * (Math.sin(t * w1 + p1) + 0.6 * Math.sin(t * w2 * 1.7 + p2));
  qy0 = cy + reach * 0.85 * (Math.cos(t * w2 + p2) + 0.6 * Math.sin(t * w1 * 1.3 + p1));
}

/** 核子 k 里的第 q 个夸克：汤里各跑各的，抱成一团以后绕着中心转 */
function quarkAt(g: Grid, k: number, q: number, t: number, cx: number, cy: number, huddle: number) {
  wander(k * 3 + q, t, cx, cy);
  const turn = hash1(k * 9 + 5) < 0.5 ? 1 : -1;
  const a = hash1(k * 9 + 7) * 6.283 + q * 2.094 + t * 2.2 * turn;
  const r = g.ch * 1.6;
  qx0 = lerp(qx0, cx + Math.cos(a) * r * 1.15, huddle);
  qy0 = lerp(qy0, cy + Math.sin(a) * r, huddle);
}

let lx0 = 0;
let ly0 = 0;
let ldx = 1;
let ldy = 0;
/** 还没有质量的时候：每个粒子以光速直直地飞，飞出屏幕从另一边回来 */
function lightAt(g: Grid, id: number, t: number) {
  const a = hash1(id * 7 + 3) * Math.PI * 2;
  ldx = Math.cos(a);
  ldy = Math.sin(a);
  const wx = g.aspect + 0.2;
  const wy = g.half * 2 + 0.2;
  let x = (hash1(id * 7 + 1) * wx + ldx * 0.5 * t) % wx;
  let y = (hash1(id * 7 + 2) * wy + ldy * 0.5 * t) % wy;
  if (x < 0) x += wx;
  if (y < 0) y += wy;
  lx0 = x - wx / 2;
  ly0 = y - wy / 2;
}

/** 一道光速的线：线头亮，后面渐渐淡掉；颜色往白里提一点、画两格粗，不然在火星里看不出来 */
function streak(g: Grid, id: number, t: number, color: Rgb, k: number) {
  lightAt(g, id, t);
  const len = 0.075;
  const glyph = lineGlyph(ldx / g.cw, ldy / g.ch);
  const r = color[0] * 0.7 + 76;
  const gr = color[1] * 0.7 + 76;
  const b = color[2] * 0.7 + 76;
  walk(g, lx0 - ldx * len * 1.1, ly0 - ldy * len, lx0, ly0, (i, s) => {
    const v = k * (0.4 + 0.6 * s);
    put(g, i, glyph, r * v, gr * v, b * v);
    if ((i + 1) % g.cols !== 0) put(g, i + 1, glyph, r * v, gr * v, b * v);
  });
}

/** 这个粒子有质量了没有（每个粒子在 MASS 这一段里各有各的一刻；讲解时指着的那个放在正中间） */
const heavy = (id: number, zz: number, focus: number) => zz >= (id === focus ? 1139 : MASS[0] + hash1(id * 13 + 5) * (MASS[1] - MASS[0]));

let ex0 = 0;
let ey0 = 0;
/** 第 k 个电子：直直地飞，飞出屏幕从另一边回来；第 0 个在一小块地方转（讲解时指着它） */
function electronAt(g: Grid, k: number, t: number) {
  if (k === 0) {
    ex0 = 0.34 + 0.05 * Math.sin(t * 0.9);
    ey0 = -0.12 + 0.04 * Math.cos(t * 1.3);
    return;
  }
  const wx = g.aspect + 0.1;
  const wy = g.half * 2 + 0.1;
  let x = (hash1(k * 5 + 3) * wx + (hash1(k * 5 + 1) - 0.5) * 0.36 * t) % wx;
  let y = (hash1(k * 5 + 4) * wy + (hash1(k * 5 + 2) - 0.5) * 0.3 * t) % wy;
  if (x < 0) x += wx;
  if (y < 0) y += wy;
  ex0 = x - wx / 2;
  ey0 = y - wy / 2;
}
const ELECTRONS = 220;

/** 电子；zz 还在希格斯场打开之前的话，没有质量的那些画成光速的线 */
function drawElectrons(g: Grid, t: number, show: number, zz = Infinity) {
  if (show < 0.03) return;
  for (let k = 0; k < ELECTRONS; k += 1) {
    if (zz < MASS[1] && !heavy(90000 + k, zz, -1)) {
      streak(g, 90000 + k, t, ELECTRON, show);
      continue;
    }
    electronAt(g, k, t);
    plot(g, ex0, ey0, G.disc, ELECTRON[0] * show, ELECTRON[1] * show, ELECTRON[2] * show);
  }
}

/** 已经缩成一个小球的核子：质子粉、中子蓝；聚好的氦核是四个挤在一起的小球；atom > 0.5 时电子被抓住，变成原子（颜色变淡） */
function drawNucleons(g: Grid, t: number, fuse: number, show: number, atom = 0, only = -1) {
  if (show < 0.03) return;
  const pale = atom > 0.5 ? 0.55 : 1;
  for (let k = only < 0 ? 0 : only; k < (only < 0 ? baryons.length : only + 1); k += 1) {
    const b = baryons[k];
    baryonAt(g, k, t, fuse);
    const color = b.neutron ? NEUTRON : PROTON;
    const v = show * pale;
    ball(g, bx0, by0, lerp(255, color[0], pale) * v, lerp(255, color[1], pale) * v, lerp(255, color[2], pale) * v);
  }
}

let nx0 = 0;
let ny0 = 0;
/** 中微子：一秒钟以后几乎不再撞任何东西，一道道淡淡的直线，穿过一切飞出去（按滚动算） */
function drawNeutrinos(g: Grid, zz: number) {
  const fade = 1 - smooth(LOOSE[1] - 6, LOOSE[1], zz);
  if (zz < LOOSE[0] || fade < 0.03) return;
  for (let k = 0; k < 140; k += 1) {
    const from = k === 0 ? 1228 : LOOSE[0] + hash1(k * 5 + 1) * 12;
    if (zz < from) continue;
    const a = k === 0 ? 0.42 : hash1(k * 5 + 2) * Math.PI * 2;
    const x0 = k === 0 ? -0.38 : (hash1(k * 5 + 3) - 0.5) * g.aspect;
    const y0 = k === 0 ? -0.14 : (hash1(k * 5 + 4) - 0.5) * g.half * 2;
    const d = (zz - from) * 0.05;
    const len = Math.min(d, 0.22);
    const hx = x0 + Math.cos(a) * d * 1.1;
    const hy = y0 + Math.sin(a) * d;
    const glyph = lineGlyph(Math.cos(a) / g.cw, Math.sin(a) / g.ch);
    walk(g, hx - Math.cos(a) * len * 1.1, hy - Math.sin(a) * len, hx, hy, (i, s) => {
      const v = fade * (0.2 + 0.6 * s);
      put(g, i, glyph, NEUTRINO[0] * v, NEUTRINO[1] * v, NEUTRINO[2] * v);
    });
    if (k === 0) {
      nx0 = hx;
      ny0 = hy;
    }
  }
}

export function drawSoup(g: Grid, zz: number) {
  const list = layout(g);
  const f = frozen(g);
  const temp = interpolate(TEMP, zz);
  const t = matterClock(g, 0.3 + 0.9 * temp);
  const time = g.reduced ? 0 : g.time;
  const frame = g.reduced ? 0 : Math.floor(g.time * 12);
  const huddle = smooth(HUDDLE[0], HUDDLE[1], zz);
  const shrink = smooth(SHRINK[0], SHRINK[1], zz);
  const fuse = smooth(FUSE[0], FUSE[1], zz);
  const fogIn = smooth(1268, 1286, zz);
  // 讲解希格斯场时指着的那个夸克
  const focus = picks.proton * 3;

  // 底下一整片在沸腾的等离子体：刚烧白时整屏都亮，很快沿着火的颜色（白 → 黄 → 橙 → 红）沉下去，成了暗红的炭火底，
  // 只剩满屏乱闪的火星；越冷越稀、越红。暴胀留下的起伏还在，只是很淡。希格斯场打开那一下，整屏同时亮一下
  const settle = smooth(1114, 1132, zz);
  const heat = fire(lerp(1, 0.38, settle));
  const hr = heat[0];
  const hg = heat[1];
  const hb = heat[2];
  const bright = lerp(0.8, 0.42, settle) * (1 - 0.4 * smooth(1150, 1280, zz));
  const pulse = bump(zz, 1133, 1137, 1146);
  // 粒子还没有质量、满屏都是光速的线时，火星少一点，线才看得清
  const sparks = (0.06 + 0.3 * temp) * lerp(0.4, 1, smooth(MASS[0], MASS[1], zz));
  const boil = fire(Math.min(1, temp + 0.15));
  for (let y = 0; y < g.rows; y += 1) {
    for (let x = 0; x < g.cols; x += 1) {
      const i = y * g.cols + x;
      const ripple = spot(f.blob[y * f.cols + (x >> 1)]);
      const k = bright * (1 + 0.22 * ripple);
      tint(g, i, BG[0] + (hr - BG[0]) * k + 40 * pulse, BG[1] + (hg - BG[1]) * k + 80 * pulse, BG[2] + (hb - BG[2]) * k + 30 * pulse);
      if (fogIn > 0 && threshold(x, y) < fogIn * 0.85) {
        put(g, i, G.light, 255 * 0.55, 128 * 0.55, 56 * 0.55);
        continue;
      }
      const h = hash2(i, frame) / (sparks * (1 + 0.25 * ripple));
      if (h >= 1) continue;
      const v = 0.45 + 0.55 * (1 - h);
      put(g, i, h < 0.12 ? G.star : h < 0.3 ? G.plus : h < 0.6 ? G.colon : G.dot, boil[0] * v, boil[1] * v, boil[2] * v);
    }
  }

  // 胶子：到处一闪一闪的小波浪
  const free = 1 - huddle;
  if (free > 0.02) {
    const count = Math.floor(g.count * 0.035 * free);
    for (let k = 0; k < count; k += 1) {
      const i = Math.floor(hash2(k, frame) * g.count);
      put(g, i, G.tilde, GLUON[0] * 0.85, GLUON[1] * 0.85, GLUON[2] * 0.85);
    }
  }

  drawElectrons(g, t, 1, zz);

  // 注定要湮灭的正反夸克：希格斯场打开前也是光速的线；到了时候互相靠拢，「啪」一下变成两道往反方向飞走的光
  if (zz < WIPE[1] + 6) {
    for (let p = 0; p < pairs.length; p += 1) {
      const pr = pairs[p];
      const gone = zz - pr.end;
      if (gone >= 0) {
        if (gone < 2.5) plot(g, pr.hx, pr.hy, G.starShape, 255, 255, 255 * (1 - gone / 2.5));
        if (gone < 1.6) ringAt(g, pr.hx, pr.hy, 0.006 + 0.018 * gone, [255, 250, 220]);
        if (gone < 5) {
          const a = hash1(p * 11 + 1) * Math.PI;
          const d = gone * 0.05;
          const k = 1 - gone / 5;
          const glyph = lineGlyph(Math.cos(a) / g.cw, Math.sin(a) / g.ch);
          for (const side of [-1, 1]) {
            const hx = pr.hx + side * Math.cos(a) * d * 1.1;
            const hy = pr.hy + side * Math.sin(a) * d;
            walk(g, hx - side * Math.cos(a) * 0.03 * 1.1, hy - side * Math.sin(a) * 0.03, hx, hy, (i) => put(g, i, glyph, 255 * k, 245 * k, 200 * k));
          }
        }
        continue;
      }
      const meet = smooth(pr.end - 3, pr.end, zz);
      for (let m = 0; m < 2; m += 1) {
        const id = 50000 + p * 2 + m;
        const color = m === 0 ? QUARK[pr.color] : ANTI[pr.color];
        if (!heavy(id, zz, -1)) {
          streak(g, id, t, color, 1);
          continue;
        }
        wander(id, t, pr.hx, pr.hy);
        ball(g, lerp(qx0, pr.hx, meet), lerp(qy0, pr.hy, meet), color[0], color[1], color[2]);
      }
    }
  }

  // 留下来的夸克：汤里乱跑（带一点拖影），冷下来三个三个抱成一团，再缩成一个质子或中子
  for (let k = 0; k < list.length; k += 1) {
    if (shrink > 0 && hash1(k * 9 + 11) < shrink) continue;
    baryonAt(g, k, t, 0);
    const cx = bx0;
    const cy = by0;
    for (let q = 0; q < 3; q += 1) {
      const color = QUARK[q];
      const id = k * 3 + q;
      if (!heavy(id, zz, focus)) {
        streak(g, id, t, color, 1);
        continue;
      }
      if (huddle < 0.8) {
        const trail = (1 - huddle / 0.8) * 0.45;
        for (let s = 2; s >= 1; s -= 1) {
          quarkAt(g, k, q, t - s * 0.045, cx, cy, huddle);
          const v = trail / s;
          plot(g, qx0, qy0, G.mid, color[0] * v, color[1] * v, color[2] * v);
        }
      }
      quarkAt(g, k, q, t, cx, cy, huddle);
      ball(g, qx0, qy0, color[0], color[1], color[2]);
    }
  }
  if (shrink > 0) {
    for (let k = 0; k < list.length; k += 1) {
      if (hash1(k * 9 + 11) >= shrink) continue;
      drawNucleons(g, t, fuse, 1, 0, k);
    }
  }
  drawNeutrinos(g, zz);

  // 四种力的家谱又出现在上面：这次画到最后一次分家（弱力和电磁力）
  const tree = smooth(1122, 1128, zz) * (1 - smooth(1146, 1152, zz));
  if (tree > 0.02) {
    const y = g.half - 0.15;
    // 先把那一条压暗，线才看得清
    const r0 = Math.max(0, rowOf(g, y + 0.1));
    const r1 = Math.min(g.rows - 1, rowOf(g, y - 0.1));
    const keep = 1 - 0.8 * tree;
    for (let row = r0; row <= r1; row += 1) {
      for (let col = 0; col < g.cols; col += 1) {
        const o = (row * g.cols + col) * 4;
        g.bg[o] *= keep;
        g.bg[o + 1] *= keep;
        g.bg[o + 2] *= keep;
        g.fg[o] *= keep;
        g.fg[o + 1] *= keep;
        g.fg[o + 2] *= keep;
      }
    }
    drawForces(g, { left: -0.42 * g.aspect, right: 0.42 * g.aspect, y, lane: 0.026, log: timeAt(zz), show: tree, labels: tree, compact: true }, time);
  }

  // 标注
  const id = focus;
  if (!heavy(id, zz, focus)) {
    lightAt(g, id, t);
    callout(g, lx0, ly0, lx0 - 0.18, ly0 - 0.14, 'massless: zipping at the speed of light', [255, 200, 200], smooth(1124, 1128, zz));
  } else {
    baryonAt(g, picks.proton, t, 0);
    quarkAt(g, picks.proton, 0, t, bx0, by0, huddle);
    callout(g, qx0, qy0, qx0 - 0.18, qy0 - 0.14, 'now it has mass, so it slows down', [255, 200, 200], smooth(1140, 1143, zz) * (1 - smooth(1148, 1152, zz)));
  }
  status(g, 'the Higgs field switches on everywhere at once', [210, 255, 190], smooth(1132, 1136, zz) * (1 - smooth(1146, 1150, zz)));
  legend(
    g,
    [
      [G.full, QUARK[0], 'quarks'],
      [G.full, ANTI[0], 'antiquarks'],
      [G.tilde, GLUON, 'gluons: the glue'],
      [G.disc, ELECTRON, 'electrons'],
    ],
    smooth(1150, 1156, zz) * (1 - smooth(1172, 1178, zz)),
  );
  const flash = pairs[0];
  if (flash) callout(g, flash.hx, flash.hy, flash.hx + 0.16, flash.hy + 0.15, 'a quark meets its antiquark: both turn into light', [255, 250, 220], smooth(1179, 1181, zz) * (1 - smooth(1188, 1192, zz)));
  status(g, 'for every billion pairs, one extra quark survives', [255, 220, 200], smooth(1184, 1190, zz) * (1 - smooth(1200, 1206, zz)));
  const tag = smooth(1206, 1212, zz) * (1 - smooth(1222, 1228, zz));
  if (tag > 0.03) {
    baryonAt(g, picks.proton, t, 0);
    callout(g, bx0, by0, bx0 - 0.2, by0 + 0.15, 'proton: 2 up quarks + 1 down', PROTON, tag);
    baryonAt(g, picks.neutron, t, 0);
    callout(g, bx0, by0, bx0 + 0.2, by0 - 0.15, 'neutron: 1 up quark + 2 down', NEUTRON, tag);
  }
  callout(g, nx0, ny0, nx0 + 0.1, ny0 + 0.18, 'a neutrino: almost nothing can stop it', NEUTRINO, smooth(1232, 1236, zz) * (1 - smooth(1250, 1256, zz)));
  status(g, 'about 300 of them are in every cm³ around you, right now', NEUTRINO, smooth(1238, 1244, zz) * (1 - smooth(1254, 1260, zz)));
  const nuclei = smooth(1258, 1266, zz) * (1 - smooth(1280, 1288, zz));
  if (nuclei > 0.03) {
    legend(
      g,
      [
        [G.full, PROTON, 'proton = hydrogen nucleus'],
        [G.full, NEUTRON, 'neutron (only inside helium now)'],
        [G.disc, ELECTRON, 'electrons, still loose'],
      ],
      nuclei,
    );
    const b = baryons[picks.helium];
    callout(g, b.hx, b.hy, b.hx + 0.16, b.hy - 0.13, 'helium nucleus: 2 protons + 2 neutrons', NEUTRON, nuclei * fuse);
    status(g, 'by weight: about 3/4 hydrogen, 1/4 helium', [255, 220, 200], smooth(1266, 1272, zz) * (1 - smooth(1280, 1286, zz)));
  }
}

/* ====================== 发光的雾 → 雾散开 → 微波背景 ====================== */

const FOG: Rgb = [255, 128, 56];
/** 微波背景的冷、不冷不热、暖（颜色是夸张过的：真实的差别只有十万分之一） */
const COLD: Rgb = [60, 110, 255];
const MILD: Rgb = [255, 236, 196];
const WARM: Rgb = [255, 84, 52];
/** 电子被原子核抓住，雾在同一刻到处散开 */
const CLEAR: [number, number] = [1313, 1331];
/** 留下来的那束光：冷热斑 */
const GLOW: [number, number] = [1321, 1339];

/**
 * 微波背景的一格：b 是 -1（冷）..1（暖），k 是亮度；red 让它往暗红褪（光被拉长成看不见的微波）。
 * 用方块字铺满，看起来像一张温度图。
 */
function cmbCell(g: Grid, i: number, b: number, k: number, red = 0) {
  if (k < 0.03) return;
  const a = Math.min(1, Math.abs(b) * 1.3) ** 0.6;
  const to = b < 0 ? COLD : WARM;
  let r = lerp(MILD[0], to[0], a);
  let gr = lerp(MILD[1], to[1], a);
  let bl = lerp(MILD[2], to[2], a);
  if (red > 0) {
    r = lerp(r, 150, red);
    gr = lerp(gr, 24, red);
    bl = lerp(bl, 30, red);
  }
  put(g, i, a < 0.33 ? G.light : a < 0.66 ? G.medium : G.dark, r * k, gr * k, bl * k);
  // 方块字在这么细的格子里很稀，亮度主要靠底色撑
  const under = 0.2 + 0.2 * a;
  tint(g, i, BG[0] + r * k * under, BG[1] + gr * k * under, BG[2] + bl * k * under);
}

const PHOTONS = 64;
const LEGS = 7;
let px0 = 0;
let py0 = 0;
/** 一个光子在雾里的一段路：从一个点出发，撞上电子就换个方向，一段撞七次；第 0 个一直在左边那一块（讲解时指着它） */
function drawPhoton(g: Grid, k: number, t: number, show: number) {
  const span = 1.3 + hash1(k * 7 + 1) * 0.6;
  const u = t / span + hash1(k * 7 + 2);
  const e = Math.floor(u);
  const f = u - e;
  let x = k === 0 ? -0.3 : (hash2(k, e) - 0.5) * g.aspect * 0.95;
  let y = k === 0 ? 0.08 : (hash2(e + 17, k) - 0.5) * g.half * 1.9;
  const fade = show * smooth(0, 0.08, f) * (1 - smooth(0.88, 1, f));
  const reach = f * LEGS;
  for (let s = 0; s < LEGS && s < reach; s += 1) {
    const a = hash3(k, e, s) * Math.PI * 2;
    const len = 0.022 + hash3(e, s, k) * 0.03;
    const part = Math.min(1, reach - s);
    const x1 = x + Math.cos(a) * len * part * 1.1;
    const y1 = y + Math.sin(a) * len * part;
    // 越早走过的路越暗
    const v = fade * (0.55 + 0.45 * clamp01(1 - (reach - s - 1) / 3));
    if (v > 0.03) walk(g, x, y, x1, y1, (i) => put(g, i, G.mid, 255 * v, 248 * v, 200 * v));
    x = x1;
    y = y1;
  }
  if (fade > 0.03) plot(g, x, y, G.star, 255 * fade, 252 * fade, 220 * fade);
  if (k === 0) {
    px0 = x;
    py0 = y;
  }
}

/** 雾一散，光终于能直直地飞出去了（按滚动算，往回滑会倒回去） */
function drawFreeLight(g: Grid, zz: number, clear: number) {
  const fade = 1 - smooth(1335, 1347, zz);
  if (clear <= 0 || fade < 0.03) return;
  for (let k = 0; k < 90; k += 1) {
    const from = CLEAR[0] + hash1(k * 3 + 1) * 14;
    if (zz < from) continue;
    const a = hash1(k * 3 + 2) * Math.PI * 2;
    const x0 = (hash1(k * 3 + 3) - 0.5) * g.aspect;
    const y0 = (hash1(k * 3 + 4) - 0.5) * g.half * 2;
    const d = (zz - from) * 0.045;
    const len = Math.min(d, 0.14);
    const x1 = x0 + Math.cos(a) * d * 1.1;
    const y1 = y0 + Math.sin(a) * d;
    const glyph = lineGlyph(Math.cos(a) / g.cw, Math.sin(a) / g.ch);
    walk(g, x1 - Math.cos(a) * len * 1.1, y1 - Math.sin(a) * len, x1, y1, (i, s) => {
      if (threshold(i % g.cols, (i / g.cols) | 0) >= clear) return;
      const v = fade * (0.3 + 0.7 * s);
      put(g, i, glyph, 255 * v, 236 * v, 160 * v);
    });
  }
}

export function drawFog(g: Grid, zz: number) {
  layout(g);
  const f = frozen(g);
  const t = matterClock(g, 0.45);
  const clear = smooth(CLEAR[0], CLEAR[1], zz);
  const shine = smooth(GLOW[0], GLOW[1], zz);
  for (let y = 0; y < g.rows; y += 1) {
    for (let x = 0; x < g.cols; x += 2) {
      const b = spot(f.cmb[y * f.cols + (x >> 1)]);
      // 雾自己在慢慢翻涌
      const n = noise2(g.ox[x] * 7 + t * 0.12, g.oy[y] * 7 - t * 0.09);
      for (let c = x; c < Math.min(x + 2, g.cols); c += 1) {
        const i = y * g.cols + c;
        const cell = threshold(c, y);
        if (cell >= clear) {
          const k = 0.3 + 0.06 * b + 0.06 * n;
          tint(g, i, BG[0] + (FOG[0] - BG[0]) * k, BG[1] + (FOG[1] - BG[1]) * k, BG[2] + (FOG[2] - BG[2]) * k);
          const v = 0.42 + 0.3 * n + 0.06 * b;
          put(g, i, G.medium, FOG[0] * v, FOG[1] * v, FOG[2] * v);
        } else if (cell < shine) cmbCell(g, i, b, 0.9);
      }
    }
  }
  // 雾里：原子核、乱撞的光、到处跑的电子；雾一散，电子被抓住、光直直地飞走
  drawNucleons(g, t, 1, (1 - shine) * 0.9, clear);
  drawElectrons(g, t, 1 - clear);
  if (clear < 1) for (let k = 0; k < PHOTONS; k += 1) drawPhoton(g, k, t, 1 - clear);
  drawFreeLight(g, zz, clear);

  // 标注
  const fog = smooth(1285, 1291, zz) * (1 - smooth(1309, 1315, zz));
  if (fog > 0.03) {
    callout(g, px0, py0, px0 - 0.16, py0 + 0.16, 'light, bouncing around', [255, 236, 160], fog);
    electronAt(g, 0, t);
    callout(g, ex0, ey0, ex0 + 0.18, ey0 - 0.14, 'free electron', ELECTRON, fog);
  }
  const light = smooth(1333, 1339, zz) * (1 - smooth(1369, 1377, zz));
  legend(
    g,
    [
      [G.medium, WARM, 'a hair warmer (1 part in 100,000)'],
      [G.medium, COLD, 'a hair cooler'],
    ],
    light,
  );
  callout(g, -0.34, 0.16, -0.5, 0.3, 'the ripples from the foam, stretched huge', [255, 236, 200], smooth(1337, 1343, zz) * (1 - smooth(1359, 1365, zz)));
  status(g, 'remember the TV snow? about 1% of it was this light', [255, 236, 200], smooth(1343, 1349, zz) * (1 - smooth(1369, 1377, zz)));
}

/* ====================== 黑暗时代 → 暗物质的网 → 第一批恒星 → 再电离 ====================== */

const DARK_MATTER: Rgb = [80, 205, 145];

/** 气体：暗暗的一道道墙，越来越清楚；(tx, ty) 是墙的走向（格子单位） */
function gasCell(g: Grid, i: number, v: number, tx: number, ty: number) {
  if (v < 0.08) return;
  const r = 120 * v;
  const gr = 100 * v;
  const b = 190 * v;
  if (v > 0.55) put(g, i, lineGlyph(tx, ty), r * 1.15, gr * 1.15, b * 1.15);
  else put(g, i, RAMP[1 + Math.floor(v * 6)], r, gr, b);
}

/** 第一批恒星亮起来的地方：墙上，墙越清楚的地方越早亮（on / nova 是 zz：什么时候亮、什么时候炸） */
type Site = { x: number; y: number; on: number; nova: number; seed: number };
let sites: Site[] = [];
let sitesKey = '';

function starSites(g: Grid, f: Field) {
  if (sitesKey === f.key) return sites;
  sitesKey = f.key;
  const found: { x: number; y: number; score: number; seed: number }[] = [];
  const step = 0.045;
  const nx = Math.ceil(g.aspect / 2 / step);
  const ny = Math.ceil(g.half / step);
  for (let j = -ny; j <= ny; j += 1) {
    for (let i = -nx; i <= nx; i += 1) {
      const x = (i + (hash2(i * 5, j) - 0.5) * 0.9) * step;
      const y = (j + (hash2(j * 3, i + 9) - 0.5) * 0.9) * step;
      const c = colOf(g, x);
      const r = rowOf(g, y);
      if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) continue;
      const ridge = ridgeOf(f.blob[r * f.cols + (c >> 1)]);
      if (ridge < 0.8) continue;
      found.push({ x, y, score: ridge + hash2(i, j * 7) * 0.12, seed: hash2(i * 11, j * 17) });
    }
  }
  found.sort((a, b) => b.score - a.score);
  // 第一个亮的放在离屏幕中间近的地方，讲解时好指
  const first = found.findIndex((s) => Math.abs(s.x) < 0.35 && Math.abs(s.y) < 0.24);
  if (first > 0) found.unshift(...found.splice(first, 1));
  const list = found.slice(0, 150);
  sites = list.map((s, k) => {
    const on = 1442 + 40 * (k / list.length) ** 1.4;
    // 最重的那些几百万年就烧完、炸掉
    const nova = k === 0 ? on + 16 : s.seed < 0.16 ? on + 16 + s.seed * 30 : Infinity;
    return { x: s.x, y: s.y, on, nova, seed: s.seed };
  });
  return sites;
}

/** 画恒星（k：镜头拉远时位置往中间收多少；bubble：周围被照亮的那一小圈气体） */
function drawStars(g: Grid, zz: number, k: number, show: number, bubble: number) {
  if (show < 0.03) return;
  const frame = g.reduced ? 0 : Math.floor(g.time * 6);
  for (const s of sites) {
    if (zz < s.on) continue;
    const x = s.x * k;
    const y = s.y * k;
    if (zz >= s.nova) {
      // 超新星：一闪，一圈往外散的光，留下一小团带颜色的气体（第一批碳、氧、铁）
      const n = zz - s.nova;
      const flash = (1 - smooth(0, 2.5, n)) * show;
      const life = (1 - smooth(5, 14, n)) * show;
      if (flash > 0.03) plot(g, x, y, G.starShape, 255 * flash, 240 * flash, 255 * flash);
      if (life > 0.03) ringAt(g, x, y, (0.006 + 0.045 * smooth(0, 10, n)) * k, [255 * life, 170 * life, 210 * life]);
      const left = smooth(4, 12, n) * show * 0.5;
      if (left > 0.03) {
        for (let d = 0; d < 6; d += 1) {
          const a = s.seed * 40 + d * 1.05;
          const r = (0.006 + 0.008 * hash1(d + s.seed * 1000)) * k;
          plot(g, x + Math.cos(a) * r * 1.1, y + Math.sin(a) * r, G.dot, 255 * left, 150 * left, 200 * left);
        }
      }
      continue;
    }
    const age = zz - s.on;
    const flare = 1 - smooth(0, 3, age);
    const v = show * (0.82 + 0.18 * hash2((s.seed * 1000) | 0, frame));
    if (bubble > 0.02) {
      // 星光把周围的气体照得发蓝
      const r = (0.006 + 0.03 * smooth(0, 24, age)) * k;
      const c0 = colOf(g, x - r * 1.1);
      const c1 = colOf(g, x + r * 1.1);
      const r0 = rowOf(g, y + r);
      const r1 = rowOf(g, y - r);
      for (let row = Math.max(0, r0); row <= Math.min(g.rows - 1, r1); row += 1) {
        for (let col = Math.max(0, c0); col <= Math.min(g.cols - 1, c1); col += 1) {
          const dx = (g.ox[col] - x) / 1.1;
          const dy = g.oy[row] - y;
          const d = Math.sqrt(dx * dx + dy * dy) / r;
          if (d < 1) glow(g, row * g.cols + col, 10 * (1 - d) * bubble, 16 * (1 - d) * bubble, 40 * (1 - d) * bubble);
        }
      }
    }
    plot(g, x, y, flare > 0.35 ? G.starShape : G.star, (190 + 65 * flare) * v, (210 + 45 * flare) * v, 255 * v);
    if (flare > 0.05) {
      const f = flare * v * 0.8;
      plot(g, x - g.cw * 1.5, y, G.dash, 200 * f, 220 * f, 255 * f);
      plot(g, x + g.cw * 1.5, y, G.dash, 200 * f, 220 * f, 255 * f);
      plot(g, x, y + g.ch, G.pipe, 200 * f, 220 * f, 255 * f);
      plot(g, x, y - g.ch, G.pipe, 200 * f, 220 * f, 255 * f);
    }
  }
}

/**
 * 再电离：第一批恒星的光在剩下的中性气体（黑暗时代那层淡淡的雾）里烧出一个个泡泡，泡泡越长越大、连成一片。
 * 在一张粗格子上算（一个粗格是 8×4 格），画的时候双线性插出来；每个星的泡泡半径跟着它亮了多久长。
 */
let ion = new Float32Array(0);
let ionW = 0;
let ionH = 0;
const litX = new Float32Array(256);
const litY = new Float32Array(256);
const litR = new Float32Array(256);
function ionize(g: Grid, zz: number) {
  ionW = Math.ceil(g.cols / 8) + 1;
  ionH = Math.ceil(g.rows / 4) + 1;
  if (ion.length !== ionW * ionH) ion = new Float32Array(ionW * ionH);
  const all = smooth(1500, 1514, zz);
  // 这一帧已经亮了的星和它们的泡泡多大，先挑出来
  let lit = 0;
  for (const s of sites) {
    if (zz < s.on || lit >= litX.length) continue;
    litX[lit] = s.x;
    litY[lit] = s.y;
    litR[lit] = 0.008 + 0.3 * smooth(s.on, s.on + 36, zz);
    lit += 1;
  }
  for (let ly = 0; ly < ionH; ly += 1) {
    const y = g.half - ly * 4 * g.ch;
    for (let lx = 0; lx < ionW; lx += 1) {
      const x = lx * 8 * g.cw - g.aspect / 2;
      let v = all;
      for (let k = 0; k < lit && v < 1; k += 1) {
        const dx = (x - litX[k]) / 1.1;
        const dy = y - litY[k];
        const r = litR[k];
        if (dx > r || dx < -r || dy > r || dy < -r) continue;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < r) v = Math.max(v, clamp01((r - d) / 0.018));
      }
      ion[ly * ionW + lx] = v;
    }
  }
}
function ionAt(x: number, y: number) {
  const fx = x / 8;
  const fy = y / 4;
  const x0 = Math.min(ionW - 2, fx | 0);
  const y0 = Math.min(ionH - 2, fy | 0);
  const u = fx - x0;
  const v = fy - y0;
  const a = ion[y0 * ionW + x0];
  const b = ion[y0 * ionW + x0 + 1];
  const c = ion[(y0 + 1) * ionW + x0];
  const d = ion[(y0 + 1) * ionW + x0 + 1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function drawDark(g: Grid, zz: number) {
  const f = frozen(g);
  starSites(g, f);
  // 那束光被宇宙越拉越长：从看得见的光褪成暗红，最后成了看不见的微波
  const fade = smooth(1373, 1399, zz);
  // 黑暗时代的中性气体：淡淡的一层雾，后面被星光一个个泡泡烧掉
  const haze = smooth(1379, 1395, zz);
  // 暗物质先收成一张网（不发光，画成绿色），气体晚一步才掉进去
  const dm = smooth(1390, 1408, zz) * (1 - 0.55 * smooth(1430, 1452, zz));
  const dmSharp = lerp(2, 8, smooth(1390, 1426, zz));
  const gas = smooth(1410, 1432, zz);
  const gasSharp = lerp(1.6, 7, smooth(1412, 1448, zz));
  const reion = zz > 1440;
  if (reion) ionize(g, zz);
  const cols = f.cols;
  for (let y = 0; y < g.rows; y += 1) {
    for (let x = 0; x < g.cols; x += 1) {
      const sx = x >> 1;
      const b = f.blob[y * cols + sx];
      const i = y * g.cols + x;
      if (fade < 1) cmbCell(g, i, spot(f.cmb[y * cols + sx]), 0.9 * (1 - fade), smooth(0, 0.7, fade));
      const lit = reion ? ionAt(x, y) : 0;
      if (haze > 0.02) {
        const fog = haze * (1 - lit);
        glow(g, i, 14 * fog, 15 * fog, 24 * fog);
        // 泡泡的边上：星光正在烧的那一圈
        const edge = 4 * lit * (1 - lit) * haze;
        if (edge > 0.05) glow(g, i, 18 * edge, 40 * edge, 100 * edge);
      }
      const ridge = ridgeOf(b);
      if (dm > 0.02) {
        // 暗物质：一道道淡绿的光（宽一点）加上点点；它本身不发光，这里是为了看得见才画成绿色
        const soft = ridge ** (dmSharp * 0.5) * dm;
        if (soft > 0.05) glow(g, i, 6 * soft, 34 * soft, 22 * soft);
        const v = ridge ** dmSharp * dm;
        if (v > 0.1 && hash2(x * 3 + 7, y * 5 + 1) < v) put(g, i, v > 0.55 ? G.colon : G.dot, DARK_MATTER[0] * (0.55 + 0.45 * v), DARK_MATTER[1] * (0.55 + 0.45 * v), DARK_MATTER[2] * (0.55 + 0.45 * v));
      }
      if (gas < 0.02) continue;
      const v = ridge ** gasSharp * gas;
      if (v < 0.08) continue;
      // 墙的走向：沿着花纹的梯度转 90°
      const gx = (f.blob[y * cols + Math.min(cols - 1, sx + 1)] - f.blob[y * cols + Math.max(0, sx - 1)]) / (4 * g.cw);
      const gy = (f.blob[Math.max(0, y - 1) * cols + sx] - f.blob[Math.min(g.rows - 1, y + 1) * cols + sx]) / (2 * g.ch);
      gasCell(g, i, v, -gy / g.cw, gx / g.ch);
    }
  }
  drawStars(g, zz, 1, 1, 1);

  // 标注
  status(g, 'the afterglow stretches into invisible microwaves', [230, 150, 140], smooth(1375, 1381, zz) * (1 - smooth(1401, 1407, zz)));
  legend(
    g,
    [
      [G.colon, DARK_MATTER, 'dark matter: no light at all (drawn green)'],
      [G.dash, [150, 130, 230], 'ordinary gas, falling in'],
    ],
    smooth(1408, 1414, zz) * (1 - smooth(1440, 1446, zz)),
  );
  status(g, 'there is about 5 times more dark matter than ordinary matter', DARK_MATTER, smooth(1414, 1420, zz) * (1 - smooth(1436, 1442, zz)));
  const s = sites[0];
  if (!s) return;
  callout(g, s.x, s.y, s.x - 0.2, s.y + 0.16, 'gas, falling into the dark matter web', [170, 150, 230], smooth(1426, 1430, zz) * (1 - smooth(1438, 1442, zz)));
  callout(g, s.x, s.y, s.x + 0.2, s.y + 0.15, 'a first star: maybe 100 times heavier than the Sun', [200, 220, 255], smooth(s.on + 1, s.on + 4, zz) * (1 - smooth(s.nova - 3, s.nova, zz)));
  callout(g, s.x, s.y, s.x + 0.2, s.y - 0.15, 'supernova: the first carbon, oxygen and iron', [255, 170, 210], smooth(s.nova, s.nova + 2, zz) * (1 - smooth(s.nova + 12, s.nova + 16, zz)));
  // 指着第一颗星那个泡泡的边
  const r = 0.008 + 0.3 * smooth(s.on, s.on + 36, zz);
  callout(g, s.x + r * 0.75, s.y + r * 0.6, s.x + r * 0.75 + 0.14, s.y + r * 0.6 + 0.12, 'a bubble of starlight, burning off the fog', [150, 190, 255], smooth(1484, 1488, zz) * (1 - smooth(1500, 1506, zz)));
}

/* ====================== 星系；宇宙网（镜头拉远那一段用） ====================== */

const TONES: Rgb[] = [
  [165, 180, 255],
  [255, 214, 160],
  [220, 160, 255],
];

/** 宇宙网每个样本的起伏、泡壁和它的走向：先整张算完再一格一格画（画气体的走向要用到上下左右的样本） */
let webBlob = new Float32Array(0);
let webWall = new Float32Array(0);
let webDx = new Float32Array(0);
let webDy = new Float32Array(0);
let webKey = '';
/** 上一次画出来的那张（找标注的位置用） */
let lastBlob: Float32Array = new Float32Array(0);
let lastCols = 0;

/**
 * 画宇宙网：z 是放大了多少（0 = 泡沫原来的大小，也就是最后那一眼），(cx, cy) 是镜头对着哪（按 z = 0 时的屏幕坐标），
 * web：星系点有多密，lines：泡壁本身浮出来多少（最后那一眼才有），gas：黑暗时代那些气体还剩多少。
 * z 比暴胀停下来时还大的话，就把那时候的花纹再放大（远远看过去本来就模糊）。
 */
export function drawWebAt(g: Grid, z: number, cx: number, cy: number, web: number, lines: number, gas: number) {
  const f = frozen(g);
  const cols = f.cols;
  const size = cols * g.rows;
  if (webBlob.length !== size) {
    webBlob = new Float32Array(size);
    webWall = new Float32Array(size);
    webDx = new Float32Array(size);
    webDy = new Float32Array(size);
  }
  // 还停在暴胀那一刻的大小、镜头也没挪：花纹就是那时候那张，不用重算；停在某一处不动时也不用重算
  const still = z === Z_END && cx === 0 && cy === 0 && lines <= 0;
  let blob = f.blob;
  if (!still) {
    const key = `${g.cols}x${g.rows}:${phase}:${z}:${cx}:${cy}:${lines}`;
    if (key !== webKey) {
      webKey = key;
      const zc = Math.min(z, Z_END);
      prepare(zc, 1 - lines);
      const shrink = 2 ** (zc - z);
      const ox = cx * 2 ** zc;
      const oy = cy * 2 ** zc;
      for (let y = 0; y < g.rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          sample((g.ox[x * 2] * shrink + ox) * BASE, (g.oy[y] * shrink + oy) * BASE, phase);
          const o = y * cols + x;
          webBlob[o] = sBlob;
          webWall[o] = sWall;
          webDx[o] = sDx;
          webDy[o] = sDy;
        }
      }
    }
    blob = webBlob;
  }
  lastBlob = blob;
  lastCols = cols;
  const lineK = lines * 0.55;
  for (let y = 0; y < g.rows; y += 1) {
    for (let sx = 0; sx < cols; sx += 1) {
      const o = y * cols + sx;
      const v = wallOf(blob[o]);
      const p = (0.004 + 0.5 * v * v * Math.sqrt(v)) * web;
      const bright = 0.55 + 0.45 * v;
      const ghost = !still && lines > 0.02 && webWall[o] > 0.45 ? lineK * webWall[o] : 0;
      const left = gas > 0.02 && v > 0.08 ? v * gas : 0;
      let tx = 1;
      let ty = 0;
      if (left > 0.08) {
        // 墙的走向：沿着花纹的梯度转 90°
        const gx = (blob[y * cols + Math.min(cols - 1, sx + 1)] - blob[y * cols + Math.max(0, sx - 1)]) / (4 * g.cw);
        const gy = (blob[Math.max(0, y - 1) * cols + sx] - blob[Math.min(g.rows - 1, y + 1) * cols + sx]) / (2 * g.ch);
        tx = -gy / g.cw;
        ty = gx / g.ch;
      }
      for (let x = sx * 2; x < Math.min(sx * 2 + 2, g.cols); x += 1) {
        const i = y * g.cols + x;
        // 沿着墙的一点点光
        glow(g, i, 20 * v * web, 14 * v * web, 42 * v * web);
        // 星系：一格一个点，墙上密，空洞里几乎没有
        const h = hash2(x * 3 + 1, y * 7 + 3);
        if (h < p) {
          const tone = TONES[(hash2(x * 5, y * 11) * 3) | 0];
          put(g, i, v > 0.85 && h < p * 0.2 ? G.star : h < p * 0.55 ? G.mid : G.dot, tone[0] * bright, tone[1] * bright, tone[2] * bright);
          continue;
        }
        if (ghost > 0) {
          put(g, i, lineGlyph(-(webDy[o] - 0.5), webDx[o] - 0.5), 120 * ghost, 96 * ghost, 190 * ghost);
          continue;
        }
        // 黑暗时代那些气体，慢慢让位给星系
        if (left > 0.08) gasCell(g, i, left, tx, ty);
      }
    }
  }
}

/** 刚画的那张宇宙网上，屏幕坐标 (x, y) 离墙多近（0..1） */
export function wallAt(g: Grid, x: number, y: number) {
  const c = colOf(g, x);
  const r = rowOf(g, y);
  if (c < 0 || r < 0 || c >= g.cols || r >= g.rows || !lastBlob.length) return 0;
  return wallOf(lastBlob[r * lastCols + (c >> 1)]);
}

/** 最后那一眼宇宙网里「你」所在的地方：离屏幕中间近、又在一道墙上（按 z = 0 时的屏幕坐标） */
let home: [number, number] = [0, 0];
let homeKey = '';
export function homeSpot(g: Grid): [number, number] {
  const key = `${g.cols}x${g.rows}:${phase}`;
  if (key === homeKey) return home;
  homeKey = key;
  prepare(0, 1);
  let best = -1;
  for (let j = -5; j <= 5; j += 1) {
    for (let i = -8; i <= 8; i += 1) {
      const x = i * 0.018 * Math.min(1.6, g.aspect);
      const y = j * 0.022;
      sample(x * BASE, y * BASE, phase);
      // 墙上，越靠近中间越好
      const v = wallOf(sBlob) - Math.hypot(x, y) * 0.6;
      if (v > best) {
        best = v;
        home = [x, y];
      }
    }
  }
  return home;
}

export function drawWeb(g: Grid, zz: number) {
  const f = frozen(g);
  starSites(g, f);
  const web = smooth(1520, 1544, zz);
  drawWebAt(g, Z_END, 0, 0, web, 0, 1 - web);
  // 第一批恒星聚成一个个星系
  const gather = smooth(1516, 1530, zz);
  drawStars(g, zz, 1, 1 - gather, 0);
  if (gather > 0.03) {
    for (const s of sites) {
      if (zz < s.on) continue;
      const tone = TONES[s.seed < 0.55 ? 0 : s.seed < 0.85 ? 1 : 2];
      smudge(g, s.x, s.y, 0.005 + 0.016 * gather, s.seed * 9, 0.45 + 0.4 * hash1((s.seed * 1e4) | 0), tone, gather);
    }
  }
  const s = sites[1] ?? sites[0];
  if (s) callout(g, s.x, s.y, s.x + 0.2, s.y + 0.15, 'a galaxy: billions of stars', TONES[0], smooth(1526, 1532, zz) * (1 - smooth(1544, 1550, zz)));
}
