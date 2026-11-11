// 开场的后半段（字掉光以后）：黑屏上三处裂纹 → 三道裂纹爬向粉色的 O → 炸开 → 只剩一颗粉色的 O。
// 全部按滚动位置算，往回滑就原样倒放。

import { G, lineGlyph } from '../charset';
import { clamp01, fbm2, hash1, hash2, put, smooth, threshold, tint, walk, type Grid } from '../grid';
import { BOOM, CONVERGE, IMPACTS } from '../timeline';

type Path = { xs: number[]; ys: number[]; cum: number[]; len: number };
type Impact = { x: number; y: number; rays: Path[]; arcs: { r: number; a0: number; a1: number }[] };
type Model = { key: string; impacts: Impact[]; lines: Path[] };

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
    for (let k = 0; k < count; k += 1) {
      const a = turn + (k / count) * Math.PI * 2 + (random() - 0.5) * 0.5;
      const length = 0.04 + random() * 0.07;
      rays.push(jagged(random, x, y, x + Math.cos(a) * length, y + Math.sin(a) * length, 4, 0.012));
    }
    const arcs = [0.026, 0.048].map((r) => {
      const a0 = random() * Math.PI * 2;
      return { r: r * (0.9 + random() * 0.3), a0, a1: a0 + 0.8 + random() * 1.6 };
    });
    return { x, y, rays, arcs };
  });
  const lines = impacts.map((impact) => jagged(random, impact.x, impact.y, ox, oy, 16, 0.05));
  cached = { key, impacts, lines };
  return cached;
}

const CRACK: [number, number, number] = [226, 218, 255];
const PINK: [number, number, number] = [255, 95, 143];

/** 把一条路径画到 progress（0..1）那么长；前沿冒一点粉色的火星 */
function drawPath(g: Grid, path: Path, progress: number, fade: number, frame: number) {
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
      put(g, i, glyph, CRACK[0], CRACK[1], CRACK[2]);
      tint(g, i, 24, 20, 38);
    });
    if (b >= target && progress < 1) {
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
    });
  }
}

/**
 * z：这一段滚过的距离（svh）；ox / oy：粉色 O 在屏幕上的位置。
 * 只管字掉光以后的部分：裂纹、爆炸、最后那颗 O。
 */
export function drawIntro(g: Grid, z: number, ox: number, oy: number) {
  const m = model(g.aspect, g.half, ox, oy);
  const frame = g.reduced ? 0 : Math.floor(g.time * 14);
  const boom = clamp01((z - BOOM[0]) / (BOOM[1] - BOOM[0]));
  // 炸开的前三分之一里，裂纹一块块碎掉
  const crackFade = smooth(0, 0.35, boom);

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

  if (boom > 0 && boom < 1 && !g.reduced) drawBoom(g, boom, ox, oy, frame);

  // 烟散了，只剩一颗粉色的 O
  const dot = smooth(0.62, 0.9, boom);
  if (dot > 0) {
    walk(g, ox, oy, ox, oy, (i) => {
      if (threshold(i % g.cols, (i / g.cols) | 0) > dot) return;
      put(g, i, G.O, PINK[0], PINK[1], PINK[2]);
      tint(g, i, 52, 12, 30);
    });
  }
}

function drawBoom(g: Grid, b: number, ox: number, oy: number, frame: number) {
  const ease = 1 - (1 - b) ** 3;
  const ringR = 0.03 + 0.3 * ease;
  const ringW = 0.018 + 0.03 * (1 - b);
  const life = 1 - b;
  // 颜色：白 → 黄 → 橙 → 粉 → 暗紫
  const stops: [number, number, number][] = [
    [255, 250, 230],
    [255, 222, 120],
    [255, 150, 80],
    [255, 95, 143],
    [110, 60, 140],
  ];
  const pick = (t: number): [number, number, number] => {
    const s = Math.min(stops.length - 1.001, Math.max(0, t) * (stops.length - 1));
    const k = Math.floor(s);
    const f = s - k;
    return [0, 1, 2].map((c) => stops[k][c] + (stops[k + 1][c] - stops[k][c]) * f) as [number, number, number];
  };
  const ringColor = pick(b * 1.1);
  const flash = 1 - smooth(0, 0.2, b);
  const sparks = [G.star, G.plus, G.x, G.hash, G.at];
  const reach = ringR + ringW * 2;
  const x0 = Math.max(0, Math.floor((ox - reach * 1.2 + g.aspect / 2) / g.cw));
  const x1 = Math.min(g.cols - 1, Math.ceil((ox + reach * 1.2 + g.aspect / 2) / g.cw));
  const y0 = Math.max(0, Math.floor((g.half - oy - reach * 1.2) / g.ch));
  const y1 = Math.min(g.rows - 1, Math.ceil((g.half - oy + reach * 1.2) / g.ch));
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const i = y * g.cols + x;
      const dx = g.ox[x] - ox;
      const dy = g.oy[y] - oy;
      const d = Math.sqrt(dx * dx + dy * dy);
      // 一开始那一下白光
      if (flash > 0 && d < 0.02 + 0.08 * (1 - flash)) {
        const v = flash * (1 - d / (0.1 + 1e-3));
        if (v > 0.1) {
          put(g, i, v > 0.6 ? G.at : v > 0.35 ? G.hash : G.star, 255, 250, 225);
          tint(g, i, 90 * v, 80 * v, 60 * v);
          continue;
        }
      }
      // 冲击波那一圈
      const ring = 1 - Math.abs(d - ringR) / ringW;
      if (ring > 0 && hash2(i, frame) < 0.35 + ring * 0.6) {
        put(g, i, sparks[(hash2(frame, i) * sparks.length) | 0], ringColor[0] * life + 40, ringColor[1] * life + 20, ringColor[2] * life + 40);
        continue;
      }
      // 圈里面的烟
      if (d < ringR * 0.95) {
        const n = fbm2(dx * 18 + frame * 0.05, dy * 18 - b * 3, 3);
        if (n > 0.56 - 0.1 * life) {
          const k = (n - 0.46) * life * 1.6;
          put(g, i, n > 0.66 ? G.colon : G.dot, 150 * k + 30, 90 * k + 20, 170 * k + 40);
        }
      }
    }
  }
  // 碎屑：往外飞，越来越暗
  for (let k = 0; k < 90; k += 1) {
    const a = hash1(k * 3 + 1) * Math.PI * 2;
    const speed = 0.12 + 0.4 * hash1(k * 3 + 2);
    const r = speed * ease;
    const x = ox + Math.cos(a) * r * (0.9 + 0.2 * hash1(k));
    const y = oy + Math.sin(a) * r * 0.85;
    const c = pick(b + hash1(k * 5) * 0.3);
    const glyph = [G.dot, G.comma, G.quote, G.star, G.plus][(hash1(k * 7) * 5) | 0];
    walk(g, x, y, x, y, (i) => put(g, i, glyph, c[0] * life + 20, c[1] * life + 10, c[2] * life + 25));
  }
}
