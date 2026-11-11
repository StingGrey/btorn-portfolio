// 开场的后半段（字掉光以后）：黑屏上三处裂纹 → 三道裂纹爬向粉色的 O → 大爆炸 → 只剩一颗粉色的 O。
// 全部按滚动位置算，往回滑就原样倒放。

import { G, gi, lineGlyph } from '../charset';
import { BG, clamp01, fbm2, hash1, hash2, put, smooth, threshold, tint, walk, type Grid } from '../grid';
import { BOOM, CONVERGE, IMPACTS } from '../timeline';

type Path = { xs: number[]; ys: number[]; cum: number[]; len: number };
type Impact = { x: number; y: number; rays: Path[]; arcs: { r: number; a0: number; a1: number }[] };
type Model = { key: string; impacts: Impact[]; lines: Path[]; bolts: Path[] };
type Rgb = [number, number, number];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makePath(points: [number, number][]): Path {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const cum = [0];
  for (let k = 1; k < points.length; k += 1) cum.push(cum[k - 1] + Math.hypot(xs[k] - xs[k - 1], ys[k] - ys[k - 1]));
  return { xs, ys, cum, len: cum[cum.length - 1] };
}

/** 一条参差的线：从 a 到 b，中间按垂直方向随机错开 */
function jagged(random: () => number, ax: number, ay: number, bx: number, by: number, segments: number, amount: number) {
  const nx = -(by - ay);
  const ny = bx - ax;
  const nl = Math.hypot(nx, ny) || 1;
  const points: [number, number][] = [];
  for (let k = 0; k <= segments; k += 1) {
    const t = k / segments;
    const j = k === 0 || k === segments ? 0 : (random() - 0.5) * 2 * amount * Math.sin(Math.PI * t);
    points.push([ax + (bx - ax) * t + (nx / nl) * j, ay + (by - ay) * t + (ny / nl) * j]);
  }
  return makePath(points);
}

let cached: Model | null = null;

function model(aspect: number, half: number, ox: number, oy: number): Model {
  const key = `${aspect.toFixed(3)}|${half.toFixed(3)}|${ox.toFixed(3)}|${oy.toFixed(3)}`;
  if (cached?.key === key) return cached;
  const random = rng(20261111);
  // 三处落点围着 O 散开（先朝屏幕中间那一侧），离 O 有一段距离，裂纹要「爬」过去才有看头
  const toward = Math.atan2(-oy, -ox || -0.001);
  const impacts: Impact[] = [0, 1, 2].map((k) => {
    const a = toward - 0.75 + k * 0.95;
    const reach = 0.36 + 0.07 * k;
    const x = Math.max(-aspect / 2 + 0.07, Math.min(aspect / 2 - 0.07, ox + Math.cos(a) * reach * 1.3));
    const y = Math.max(-half + 0.08, Math.min(half - 0.08, oy + Math.sin(a) * reach));
    const rays: Path[] = [];
    const count = 6 + Math.floor(random() * 2);
    const turn = random() * Math.PI * 2;
    for (let n = 0; n < count; n += 1) {
      const angle = turn + (n / count) * Math.PI * 2 + (random() - 0.5) * 0.5;
      const length = 0.04 + random() * 0.07;
      rays.push(jagged(random, x, y, x + Math.cos(angle) * length, y + Math.sin(angle) * length, 4, 0.012));
    }
    const arcs = [0.026, 0.048].map((r) => {
      const a0 = random() * Math.PI * 2;
      return { r: r * (0.9 + random() * 0.3), a0, a1: a0 + 0.8 + random() * 1.6 };
    });
    return { x, y, rays, arcs };
  });
  const lines = impacts.map((impact) => jagged(random, impact.x, impact.y, ox, oy, 16, 0.05));
  // 爆炸时从 O 往四面八方劈出去的裂纹，一直劈到屏幕外面，半路还会分叉
  const bolts: Path[] = [];
  const count = 15;
  for (let k = 0; k < count; k += 1) {
    const a = (k / count) * Math.PI * 2 + (random() - 0.5) * 0.3;
    const length = 0.75 + random() * 1.1;
    const ex = ox + Math.cos(a) * length * 1.15;
    const ey = oy + Math.sin(a) * length;
    bolts.push(jagged(random, ox, oy, ex, ey, 16, 0.045));
    if (random() < 0.75) {
      const t = 0.25 + random() * 0.35;
      const bx = ox + (ex - ox) * t;
      const by = oy + (ey - oy) * t;
      const turn = a + (random() < 0.5 ? 0.55 : -0.55);
      bolts.push(jagged(random, bx, by, bx + Math.cos(turn) * length * 0.45, by + Math.sin(turn) * length * 0.4, 7, 0.025));
    }
  }
  cached = { key, impacts, lines, bolts };
  return cached;
}

const CRACK: Rgb = [226, 218, 255];
const PINK: Rgb = [255, 95, 143];

/** 把一条路径画到 progress（0..1）那么长；前沿冒一点粉色的火星 */
function drawPath(g: Grid, path: Path, progress: number, fade: number, frame: number, color: Rgb = CRACK, sparks = true) {
  if (progress <= 0) return;
  const target = path.len * Math.min(progress, 1);
  for (let k = 1; k < path.xs.length; k += 1) {
    const a = path.cum[k - 1];
    if (a >= target) break;
    const b = Math.min(path.cum[k], target);
    const t = (b - a) / (path.cum[k] - a || 1);
    const x0 = path.xs[k - 1];
    const y0 = path.ys[k - 1];
    const x1 = x0 + (path.xs[k] - x0) * t;
    const y1 = y0 + (path.ys[k] - y0) * t;
    const glyph = lineGlyph((path.xs[k] - x0) / g.cw, (path.ys[k] - y0) / g.ch);
    walk(g, x0, y0, x1, y1, (i) => {
      const x = i % g.cols;
      const y = (i / g.cols) | 0;
      if (fade > 0 && threshold(x, y) < fade) return;
      put(g, i, glyph, color[0], color[1], color[2]);
      tint(g, i, 24, 20, 38);
      // 一格只有三四个像素宽：线画两格粗才看得清
      if (x + 1 < g.cols) {
        put(g, i + 1, glyph, color[0], color[1], color[2]);
        tint(g, i + 1, 24, 20, 38);
      }
    });
    if (sparks && b >= target && progress < 1) {
      walk(g, x1, y1, x1, y1, (i) => put(g, i, G.star, PINK[0], PINK[1], PINK[2]));
      for (let s = 0; s < 3; s += 1) {
        const ax = x1 + (hash2(k * 7 + s, frame) - 0.5) * g.cw * 5;
        const ay = y1 + (hash2(frame, k * 13 + s) - 0.5) * g.ch * 3;
        walk(g, ax, ay, ax, ay, (i) => put(g, i, hash1(i + frame) < 0.5 ? G.dot : G.quote, 255, 160, 200));
      }
    }
  }
}

function drawArc(g: Grid, cx: number, cy: number, r: number, a0: number, a1: number, progress: number, fade: number) {
  const end = a0 + (a1 - a0) * progress;
  const steps = Math.ceil(((end - a0) * r) / Math.min(g.cw, g.ch)) * 2 + 2;
  for (let s = 0; s <= steps; s += 1) {
    const a = a0 + ((end - a0) * s) / steps;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    const glyph = lineGlyph(-Math.sin(a) / g.cw, Math.cos(a) / g.ch);
    walk(g, x, y, x, y, (i) => {
      if (fade > 0 && threshold(i % g.cols, (i / g.cols) | 0) < fade) return;
      put(g, i, glyph, 200, 190, 240);
      if ((i + 1) % g.cols !== 0) put(g, i + 1, glyph, 200, 190, 240);
    });
  }
}

/**
 * z：故事位置；ox / oy：粉色 O 在屏幕上的位置。只管字掉光以后的部分：裂纹、爆炸、最后那颗 O。
 * 返回这一刻整屏该抖多厉害（0..1）。
 */
export function drawIntro(g: Grid, z: number, ox: number, oy: number) {
  const m = model(g.aspect, g.half, ox, oy);
  const frame = g.reduced ? 0 : Math.floor(g.time * 14);
  const boom = clamp01((z - BOOM[0]) / (BOOM[1] - BOOM[0]));
  // 一炸开，原来那几道裂纹就被白光吞掉了
  const crackFade = smooth(0.06, 0.16, boom);

  if (crackFade < 1) {
    m.impacts.forEach((impact, k) => {
      const [from, to] = IMPACTS[k];
      const grow = g.reduced ? (z >= from ? 1 : 0) : clamp01((z - from) / (to - from));
      if (grow <= 0) return;
      impact.rays.forEach((ray, r) => drawPath(g, ray, clamp01(grow * 1.4 - r * 0.06), crackFade, frame));
      impact.arcs.forEach((arc) => drawArc(g, impact.x, impact.y, arc.r, arc.a0, arc.a1, clamp01(grow * 1.6 - 0.4), crackFade));
      // 落点本身：一颗亮一点的星
      walk(g, impact.x, impact.y, impact.x, impact.y, (i) => put(g, i, G.star, 255, 240, 255));
    });
    m.lines.forEach((line, k) => {
      const from = CONVERGE[0] + k * 5;
      const grow = clamp01((z - from) / (CONVERGE[1] - 10 - from));
      drawPath(g, line, g.reduced ? (grow > 0 ? 1 : 0) : grow, crackFade, frame + k * 31);
    });
  }

  let shake = 0;
  if (boom > 0 && boom < 1 && !g.reduced) shake = drawBoom(g, boom, ox, oy, frame, m.bolts);

  // 烟散了，只剩一颗粉色的 O；它亮起来的时候外面荡开一小圈
  const dot = g.reduced ? smooth(0.5, 0.9, boom) : smooth(0.8, 0.96, boom);
  if (dot > 0) {
    if (dot < 1 && !g.reduced) ring(g, ox, oy, 0.02 + 0.09 * dot, [255 * (1 - dot), 95 * (1 - dot), 143 * (1 - dot)], 0, frame);
    drawO(g, ox, oy, dot);
  }
  return shake;
}

/** 先升后降：a 处开始、peak 处最强、c 处回到 0 */
const bump = (x: number, a: number, peak: number, c: number) => smooth(a, peak, x) * (1 - smooth(peak, c, x));

/** 火的颜色：暗紫的烟 → 红 → 橙 → 黄 → 白热 */
const HEAT: Rgb[] = [
  [58, 30, 74],
  [200, 52, 66],
  [255, 124, 52],
  [255, 214, 96],
  [255, 252, 232],
];
function heatColor(h: number): Rgb {
  const s = Math.min(HEAT.length - 1.001, Math.max(0, h) * (HEAT.length - 1));
  const k = Math.floor(s);
  const f = s - k;
  return [HEAT[k][0] + (HEAT[k + 1][0] - HEAT[k][0]) * f, HEAT[k][1] + (HEAT[k + 1][1] - HEAT[k][1]) * f, HEAT[k][2] + (HEAT[k + 1][2] - HEAT[k][2]) * f];
}

/** 一整圈：字跟着切线方向走；gap > 0 时随机缺一些 */
function ring(g: Grid, cx: number, cy: number, r: number, color: Rgb, gap: number, frame: number) {
  if (r <= 0) return;
  const steps = Math.ceil((r * 2 * Math.PI) / g.cw) + 8;
  for (let s = 0; s < steps; s += 1) {
    if (gap > 0 && hash2(s, frame) < gap) continue;
    const a = (s / steps) * Math.PI * 2;
    const x = cx + Math.cos(a) * r * 1.12;
    const y = cy + Math.sin(a) * r;
    const glyph = lineGlyph(-Math.sin(a) / g.cw, Math.cos(a) / g.ch);
    walk(g, x, y, x, y, (i) => {
      put(g, i, glyph, color[0], color[1], color[2]);
      if ((i + 1) % g.cols !== 0) put(g, i + 1, glyph, color[0], color[1], color[2]);
    });
  }
}

/** 那颗粉色的 O：几格字拼成的一个小圆环（单独一个字太小了）。show < 1 时缺着口慢慢长出来 */
export function drawO(g: Grid, x: number, y: number, show = 1) {
  if (show <= 0.02) return;
  ring(g, x, y, g.ch * 1.7, PINK, 1 - show, 3);
  ring(g, x, y, g.ch * 1.1, [200, 70, 110], 1 - show, 5);
}

const CHUNKS = [...'BTORN@#&%$?!'].map(gi);
const DUST = [G.dot, G.comma, G.quote, G.star, G.plus];

/**
 * 爆炸，一层一层叠起来：先往里吸一口气 → 整屏一闪 → 翻滚的火球 → 三圈冲击波（最外一圈红绿蓝错开）→
 * 裂纹从 O 劈向四面八方 → 带拖尾的碎屑（里面混着页面自己的字）受重力落下 → 余烬慢慢飘。
 */
function drawBoom(g: Grid, b: number, ox: number, oy: number, frame: number, bolts: Path[]) {
  const reach = Math.hypot(g.aspect, g.half * 2);

  // 整屏一闪：所有格子的底色一起亮起来
  const flash = bump(b, 0.07, 0.12, 0.3);
  if (flash > 0.01) {
    const k = flash * 0.9;
    for (let o = 0; o < g.bg.length; o += 4) {
      g.bg[o] = BG[0] + (255 - BG[0]) * k;
      g.bg[o + 1] = BG[1] + (226 - BG[1]) * k;
      g.bg[o + 2] = BG[2] + (240 - BG[2]) * k;
    }
  }

  // 爆之前那一下：一圈速度线被吸向 O
  const suck = 1 - smooth(0, 0.11, b);
  if (suck > 0.02) {
    for (let k = 0; k < 80; k += 1) {
      const a = hash1(k * 3 + 1) * Math.PI * 2;
      const phase = (hash1(k * 3 + 2) + b * 10) % 1;
      const glyph = lineGlyph(Math.cos(a) / g.cw, Math.sin(a) / g.ch);
      for (let s = 0; s < 3; s += 1) {
        const r = (1 - phase) * 0.8 + 0.03 + s * g.ch * 1.2;
        const x = ox + Math.cos(a) * r * 1.15;
        const y = oy + Math.sin(a) * r;
        const v = suck * phase * (1 - s * 0.3);
        walk(g, x, y, x, y, (i) => put(g, i, glyph, 255 * v, 190 * v, 225 * v));
      }
    }
  }

  // 从 O 劈出去的裂纹：一下子窜到屏幕边上，白得发亮，然后碎掉
  const boltGrow = smooth(0.09, 0.3, b);
  const boltFade = smooth(0.4, 0.78, b);
  if (boltGrow > 0 && boltFade < 1) {
    const hot = 1 - smooth(0.2, 0.6, b);
    const color: Rgb = [255, 170 + 85 * hot, 205 + 50 * hot];
    bolts.forEach((bolt, k) => drawPath(g, bolt, clamp01(boltGrow * 1.25 - (k % 5) * 0.04), boltFade, frame + k * 7, color, false));
  }

  // 火球：边缘翻滚，里面白热，越往后越凉，最后散成烟
  const grow = 1 - (1 - smooth(0.08, 0.6, b)) ** 2;
  const cool = 1 - smooth(0.4, 0.92, b);
  const radius = 0.04 + 0.4 * grow;
  if (b > 0.08 && cool > 0.02) {
    const box = radius * 1.4;
    const x0 = Math.max(0, Math.floor((ox - box * 1.15 + g.aspect / 2) / g.cw));
    const x1 = Math.min(g.cols - 1, Math.ceil((ox + box * 1.15 + g.aspect / 2) / g.cw));
    const y0 = Math.max(0, Math.floor((g.half - oy - box) / g.ch));
    const y1 = Math.min(g.rows - 1, Math.ceil((g.half - oy + box) / g.ch));
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const dx = (g.ox[x] - ox) / 1.12;
        const dy = g.oy[y] - oy;
        const d = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const edge = radius * (0.72 + 0.56 * fbm2(angle * 2.4 + 7, b * 7 + frame * 0.03, 3));
        if (d >= edge) continue;
        const inside = 1 - d / edge;
        const n = fbm2(dx * 15 + b * 9, dy * 15 - b * 6 - frame * 0.025, 3);
        const heat = (inside * 1.3 + (n - 0.5) * 0.8) * (0.3 + 0.7 * cool);
        if (heat < 0.1 + (1 - cool) * 0.22) continue;
        const i = y * g.cols + x;
        const c = heatColor(heat);
        const glyph = heat > 0.82 ? G.at : heat > 0.66 ? G.hash : heat > 0.5 ? gi('%') : heat > 0.38 ? G.star : heat > 0.26 ? G.plus : heat > 0.16 ? G.colon : G.dot;
        put(g, i, glyph, c[0], c[1], c[2]);
        tint(g, i, c[0] * 0.42 * heat, c[1] * 0.42 * heat, c[2] * 0.42 * heat);
      }
    }
  }

  // 冲击波：三圈，各有各的速度；最外面那圈红绿蓝错开一点
  const waves: [number, number, number][] = [
    [0.1, 1.15, 1],
    [0.16, 0.72, 0.8],
    [0.24, 0.46, 0.6],
  ];
  waves.forEach(([start, speed, strength], k) => {
    const t = clamp01((b - start) / (1 - start));
    if (t <= 0) return;
    const r = (1 - (1 - t) ** 2.4) * reach * speed;
    const life = strength * (1 - smooth(0.55, 1, t));
    if (life < 0.03) return;
    if (k === 0) {
      ring(g, ox, oy, r - g.ch * 2.4, [90 * life, 120 * life, 255 * life], 0.25, frame);
      ring(g, ox, oy, r - g.ch * 1.2, [80 * life, 255 * life, 190 * life], 0.15, frame + 1);
      ring(g, ox, oy, r, [255 * life, 240 * life, 250 * life], 0, frame);
    } else {
      ring(g, ox, oy, r, [255 * life, 150 * life, 190 * life], 0.3, frame + k);
      ring(g, ox, oy, r - g.ch * 1.1, [255 * life * 0.6, 110 * life * 0.6, 60 * life * 0.6], 0.5, frame + k + 3);
    }
  });

  // 碎屑：往外飞、带拖尾、被重力拽下来；每五个里有两个是页面自己的字
  const out = 1 - (1 - b) ** 2.2;
  for (let k = 0; k < 380; k += 1) {
    const a = hash1(k * 3 + 1) * Math.PI * 2;
    const speed = 0.2 + 1.25 * hash1(k * 3 + 2) ** 1.6;
    const weight = 0.35 + hash1(k * 9) * 0.6;
    const chunk = k % 5 < 2;
    const glyph = chunk ? CHUNKS[(hash1(k * 7) * CHUNKS.length) | 0] : DUST[(hash1(k * 7) * DUST.length) | 0];
    const c = heatColor(1.05 - b * 1.25 + hash1(k * 5) * 0.3);
    const life = 1 - smooth(0.75, 1, b);
    for (let s = 0; s < (chunk ? 1 : 4); s += 1) {
      const e = Math.max(0, out - s * 0.018 * (1 - b));
      const x = ox + Math.cos(a) * speed * e * 1.12;
      const y = oy + Math.sin(a) * speed * e - weight * 0.55 * e * e;
      const v = life * (1 - s * 0.25);
      walk(g, x, y, x, y, (i) => put(g, i, s === 0 ? glyph : G.dot, c[0] * v + 14, c[1] * v + 10, c[2] * v + 18));
    }
  }

  // 余烬：火球散了以后，零零星星地往下飘
  const ember = smooth(0.4, 0.6, b) * (1 - smooth(0.85, 1, b));
  if (ember > 0.02) {
    for (let k = 0; k < 70; k += 1) {
      if (hash2(k, frame >> 1) > 0.75) continue;
      const x = ox + (hash1(k * 4 + 1) - 0.5) * 1.1;
      const y = oy + (hash1(k * 4 + 2) - 0.35) * 0.7 - (b - 0.4) * (0.25 + hash1(k * 4 + 3) * 0.5);
      const v = ember * (0.5 + 0.5 * hash2(k, frame));
      walk(g, x, y, x, y, (i) => put(g, i, hash1(k) < 0.5 ? G.dot : G.comma, 255 * v, 140 * v, 70 * v));
    }
  }

  return bump(b, 0.07, 0.15, 0.62);
}
