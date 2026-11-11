// 原子以下：硅原子的电子云 → 原子里的空旷 → 原子核 → 质子（三个夸克、胶子流管、海夸克）→
// 一个夸克（一个点，周围的虚粒子往外飞）→ 16 个数量级的未知 → 张开成一根振动的弦 → 普朗克尺度的时空泡沫。

import { G, RAMP, lineGlyph } from '../charset';
import { BG, hash1, hash2, noise2, put, smooth, tint, walk, type Grid } from '../grid';
import { logScaleAt } from '../timeline';

const fovIn = (zz: number, unit: number) => 10 ** logScaleAt(zz) / unit;

/**
 * 有些东西要「慢慢停下来」（原子核转着转着停住、夸克越绕越慢）：直接拿时间乘一个跟着滚动变的倍率会跳，
 * 所以每帧把走过的时间乘上倍率累加起来。
 */
function clock() {
  let last = NaN;
  let phase = 0;
  return (g: Grid, rate: number) => {
    if (g.reduced) return 0;
    const dt = Number.isNaN(last) ? 0 : Math.min(Math.max(g.time - last, 0), 0.1);
    last = g.time;
    phase += dt * rate;
    return phase;
  };
}

/** 一格的「概率云」：值越大字越密；中间那段用随机撒点，看起来是一团闪烁的可能性 */
function cloud(g: Grid, i: number, v: number, frame: number, r: number, gr: number, b: number) {
  if (v > 0.72) {
    put(g, i, RAMP[Math.min(9, 6 + Math.floor((v - 0.72) * 12))], r, gr, b);
    tint(g, i, r * 0.18, gr * 0.18, b * 0.22);
    return;
  }
  const p = hash2(i, frame);
  if (p > v * 1.35) return;
  put(g, i, v > 0.4 ? G.colon : p < v * 0.5 ? G.mid : G.dot, r * (0.45 + v), gr * (0.45 + v), b * (0.5 + v * 0.5));
}

/* ====================== 硅原子 + 原子里的空旷 ====================== */

/** 目标原子的几个邻居（皮米），和晶格那一段对得上：哑铃里的另一个、斜上方两个 */
const NEIGHBORS: [number, number][] = [
  [0, -136],
  [-192, 135.5],
  [192, 135.5],
];

/**
 * 一个硅原子的电子密度（皮米）：1s 一小团、2s2p 一圈、最外层 3p 两瓣（跟着 spin 慢慢转）。
 * c2 / s2 是 cos 2·spin、sin 2·spin：两瓣的方向不用每格算三角函数
 */
function electronDensity(x: number, y: number, c2: number, s2: number) {
  const r2 = x * x + y * y;
  if (r2 > 260 * 260) return 0;
  const r = Math.sqrt(r2);
  const core = r < 40 ? Math.exp(-r / 4) * 1.4 : 0;
  const second = r < 70 ? Math.exp(-(((r - 20) / 12) ** 2)) * 0.8 : 0;
  const cos2 = r2 > 1 ? ((x * x - y * y) * c2 + 2 * x * y * s2) / r2 : 0;
  const valence = Math.exp(-(((r - 95) / 45) ** 2)) * 0.3 * (1 + 0.85 * cos2);
  return core + second + valence;
}

export function drawAtom(g: Grid, zz: number) {
  const fov = fovIn(zz, 1e-12);
  const frame = g.reduced ? 0 : Math.floor(g.time * 10);
  const spin = g.reduced ? 0.4 : g.time * 0.25;
  const c2 = Math.cos(2 * spin);
  const s2 = Math.sin(2 * spin);
  const n2 = Math.cos(1.2);
  const ns2 = Math.sin(1.2);
  // 钻进原子里：电子云在 30 皮米到 3 皮米之间淡掉，剩下一片空
  const fade = smooth(1.5, 30, fov);
  const nucleusR = 3.65e-3;
  if (fade > 0.01) {
    for (let y = 0; y < g.rows; y += 1) {
      const wy = g.oy[y] * fov;
      for (let x = 0; x < g.cols; x += 1) {
        const wx = g.ox[x] * fov;
        const i = y * g.cols + x;
        let v = electronDensity(wx, wy, c2, s2);
        if (fov > 150) {
          // 远一点还看得见邻居和它们之间的共价键
          for (const [nx, ny] of NEIGHBORS) {
            v += electronDensity(wx - nx, wy - ny, n2, ns2) * 0.55;
            const h = Math.max(0, Math.min(1, (wx * nx + wy * ny) / (nx * nx + ny * ny)));
            const bx = wx - nx * h;
            const by = wy - ny * h;
            const b2 = bx * bx + by * by;
            if (b2 < 6400) v += Math.exp(-b2 / 900) * 0.22;
          }
        }
        v = Math.min(1, v * 0.9) * fade;
        if (v < 0.02) continue;
        const k = Math.min(1, v * 1.3);
        cloud(g, i, v, frame, 110 + 145 * k * k, 220 + 35 * k, 255);
      }
    }
  }
  // 空旷里零星闪过的几个点，和正中间的瞄准框
  if (fade < 1) {
    for (let k = 0; k < 24; k += 1) {
      if (hash2(k, frame) > 0.4) continue;
      const sx = (hash2(frame, k) - 0.5) * g.aspect;
      const sy = (hash2(k * 7, frame + 3) - 0.5) * g.half * 2;
      walk(g, sx, sy, sx, sy, (i) => put(g, i, G.dot, 70, 90, 140));
    }
    const marks: [number, number, number][] = [
      [-3, 0, G.dash],
      [3, 0, G.dash],
      [0, -2, G.pipe],
      [0, 2, G.pipe],
    ];
    if (nucleusR / fov < g.ch) {
      marks.forEach(([dx, dy, glyph]) => walk(g, dx * g.cw, dy * g.ch, dx * g.cw, dy * g.ch, (i) => put(g, i, glyph, 255, 143, 189)));
    }
  }
  // 原子核：一开始只是正中间一个亮点，后面是一团粉蓝相间的小球
  const radius = nucleusR / fov;
  if (radius < g.ch * 0.6) {
    if (fov < 2) walk(g, 0, 0, 0, 0, (i) => put(g, i, G.mid, 255, 200, 220));
    return;
  }
  for (let y = 0; y < g.rows; y += 1) {
    const sy = g.oy[y];
    if (Math.abs(sy) > radius) continue;
    for (let x = 0; x < g.cols; x += 1) {
      const sx = g.ox[x];
      const d = Math.sqrt(sx * sx + sy * sy) / radius;
      if (d > 1) continue;
      const i = y * g.cols + x;
      const n = noise2(sx / radius * 3 + 5, sy / radius * 3);
      const proton = n > 0.5;
      const v = 0.35 + 0.65 * Math.sqrt(1 - d * d);
      put(g, i, RAMP[Math.min(9, 3 + Math.floor(v * 7))], proton ? 255 * v : 150 * v, proton ? 110 * v : 170 * v, proton ? 140 * v : 230 * v);
      tint(g, i, 30 * v, 20 * v, 36 * v);
    }
  }
}

/* ====================== 原子核：14 个质子 + 14 个中子 ====================== */

type Nucleon = { x: number; y: number; z: number; proton: boolean };
const NUCLEON_R = 0.85;
const NUCLEONS: Nucleon[] = (() => {
  let seed = 9;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const list: Nucleon[] = [];
  while (list.length < 28) {
    const x = random() * 5.4 - 2.7;
    const y = random() * 5.4 - 2.7;
    const z = random() * 5.4 - 2.7;
    if (x * x + y * y + z * z < 2.7 * 2.7) list.push({ x, y, z, proton: list.length % 2 === 0 });
  }
  // 互相推开一点，别叠成一团
  for (let iteration = 0; iteration < 80; iteration += 1) {
    for (let a = 0; a < list.length; a += 1) {
      for (let b = a + 1; b < list.length; b += 1) {
        const dx = list[b].x - list[a].x;
        const dy = list[b].y - list[a].y;
        const dz = list[b].z - list[a].z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        if (d < 1.55) {
          const push = (1.55 - d) * 0.5;
          list[a].x -= (dx / d) * push;
          list[a].y -= (dy / d) * push;
          list[a].z -= (dz / d) * push;
          list[b].x += (dx / d) * push;
          list[b].y += (dy / d) * push;
          list[b].z += (dz / d) * push;
        }
      }
      const r = Math.sqrt(list[a].x ** 2 + list[a].y ** 2 + list[a].z ** 2);
      if (r > 2.8) {
        list[a].x *= 2.8 / r;
        list[a].y *= 2.8 / r;
        list[a].z *= 2.8 / r;
      }
    }
  }
  return list;
})();
const nucleusClock = clock();
const projected = new Float32Array(NUCLEONS.length * 3);

export function drawNucleus(g: Grid, zz: number) {
  const fov = fovIn(zz, 1e-15);
  const angle = 0.6 + nucleusClock(g, 0.35 * (1 - smooth(745, 768, zz)));
  const jiggle = g.reduced ? 0 : 0.12 * (1 - smooth(750, 772, zz));
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  // 转一下、抖一下，投影到屏幕上（正交，z 朝向镜头）
  let target = 0;
  let targetZ = -1e9;
  NUCLEONS.forEach((n, k) => {
    const jx = jiggle * Math.sin(g.time * 3.1 + k);
    const jy = jiggle * Math.cos(g.time * 2.7 + k * 1.3);
    const x = n.x * ca + n.z * sa + jx;
    const z = -n.x * sa + n.z * ca;
    const y = n.y * 0.96 + z * 0.12 + jy;
    projected[k * 3] = x;
    projected[k * 3 + 1] = y;
    projected[k * 3 + 2] = z;
    // 镜头要钻的：离中间近、又在最前面的那个质子
    const score = z - Math.sqrt(x * x + y * y) * 1.2;
    if (n.proton && score > targetZ) {
      targetZ = score;
      target = k;
    }
  });
  const dive = smooth(740, 772, zz);
  const cx = projected[target * 3] * dive;
  const cy = projected[target * 3 + 1] * dive;
  const r2 = NUCLEON_R * NUCLEON_R;
  for (let y = 0; y < g.rows; y += 1) {
    const wy = cy + g.oy[y] * fov;
    for (let x = 0; x < g.cols; x += 1) {
      const wx = cx + g.ox[x] * fov;
      if (wx * wx + wy * wy > 13.5) continue;
      let front = -1e9;
      let hit = -1;
      let hx = 0;
      let hy = 0;
      for (let k = 0; k < NUCLEONS.length; k += 1) {
        const dx = wx - projected[k * 3];
        const dy = wy - projected[k * 3 + 1];
        const d2 = dx * dx + dy * dy;
        if (d2 >= r2) continue;
        const z = projected[k * 3 + 2] + Math.sqrt(r2 - d2);
        if (z > front) {
          front = z;
          hit = k;
          hx = dx;
          hy = dy;
        }
      }
      if (hit < 0) continue;
      const i = y * g.cols + x;
      const nz = Math.sqrt(Math.max(0, r2 - hx * hx - hy * hy)) / NUCLEON_R;
      const light = Math.max(0, (-hx * 0.5 + hy * 0.6) / NUCLEON_R + nz * 0.62);
      const depth = 0.55 + 0.45 * smooth(-3, 3, projected[hit * 3 + 2]);
      const v = Math.min(1, light) * depth;
      const proton = NUCLEONS[hit].proton;
      put(g, i, RAMP[Math.min(9, 2 + Math.floor(v * 8))], proton ? 120 + 135 * v : 70 + 100 * v, proton ? 50 + 80 * v : 90 + 100 * v, proton ? 80 + 90 * v : 150 + 105 * v);
      tint(g, i, proton ? 60 * v : 26 * v, proton ? 16 * v : 34 * v, proton ? 30 * v : 70 * v);
    }
  }
}

/* ====================== 质子：三个夸克、胶子、海夸克 ====================== */

const QUARKS: { color: [number, number, number]; speed: number; phase: number; radius: number }[] = [
  { color: [255, 72, 72], speed: 1.3, phase: 0, radius: 0.32 },
  { color: [72, 255, 112], speed: -1.1, phase: 2.2, radius: 0.36 },
  { color: [96, 136, 255], speed: 0.9, phase: 4.3, radius: 0.3 },
];
const protonClock = clock();
const qx = new Float32Array(3);
const qy = new Float32Array(3);

function placeQuarks(phase: number) {
  QUARKS.forEach((q, k) => {
    const a = q.phase + phase * q.speed;
    qx[k] = Math.cos(a) * q.radius + 0.06 * Math.sin(phase * 2.3 + k);
    qy[k] = Math.sin(a) * q.radius * 0.8;
  });
}

function blob(g: Grid, sx: number, sy: number, size: number, color: [number, number, number]) {
  const rows = Math.max(1, Math.ceil(size / g.ch));
  const cols = Math.max(1, Math.ceil(size / g.cw));
  const c0 = Math.floor((sx + g.aspect / 2) / g.cw);
  const r0 = Math.floor((g.half - sy) / g.ch);
  for (let r = r0 - rows; r <= r0 + rows; r += 1) {
    if (r < 0 || r >= g.rows) continue;
    for (let c = c0 - cols; c <= c0 + cols; c += 1) {
      if (c < 0 || c >= g.cols) continue;
      const dx = g.ox[c] - sx;
      const dy = g.oy[r] - sy;
      const d = Math.sqrt(dx * dx + dy * dy) / Math.max(size, g.ch * 0.5);
      if (d > 1.6) continue;
      const i = r * g.cols + c;
      const glyph = d < 0.45 ? G.at : d < 0.9 ? G.hash : d < 1.25 ? G.star : G.dot;
      const k = d < 0.9 ? 1 : 0.6;
      put(g, i, glyph, color[0] * k + (d < 0.45 ? 60 : 0), color[1] * k + (d < 0.45 ? 60 : 0), color[2] * k + (d < 0.45 ? 60 : 0));
      if (d < 1) tint(g, i, color[0] * 0.25, color[1] * 0.25, color[2] * 0.25);
    }
  }
}

export function drawProton(g: Grid, zz: number) {
  const fov = fovIn(zz, 1e-15);
  const fp = g.ch * fov;
  const t = g.reduced ? 0 : g.time;
  const phase = protonClock(g, 1 - smooth(805, 826, zz));
  placeQuarks(phase);
  const dive = smooth(790, 826, zz);
  const cx = qx[0] * dive;
  const cy = qy[0] * dive;
  const toX = (x: number) => (x - cx) / fov;
  const toY = (y: number) => (y - cy) / fov;
  const frame = g.reduced ? 0 : Math.floor(t * 12);
  // 边界：一层淡淡的「袋子」，里面有一点雾
  for (let y = 0; y < g.rows; y += 1) {
    const wy = cy + g.oy[y] * fov;
    for (let x = 0; x < g.cols; x += 1) {
      const wx = cx + g.ox[x] * fov;
      const d = Math.sqrt(wx * wx + wy * wy);
      const i = y * g.cols + x;
      if (Math.abs(d - 0.84) < Math.max(fp * 0.6, 0.012)) {
        put(g, i, G.mid, 150, 80, 120);
        continue;
      }
      if (d < 0.84) {
        const n = noise2(wx * 9 + t * 0.6, wy * 9 - t * 0.4);
        if (n > 0.62) put(g, i, G.dot, 90 + 80 * n, 50 + 40 * n, 110 + 60 * n);
        tint(g, i, BG[0] + 10, BG[1] + 4, BG[2] + 14);
      }
    }
  }
  // 胶子流管：三个夸克各连一根到中间的结点，一直在扭
  const jx = (qx[0] + qx[1] + qx[2]) / 3;
  const jy = (qy[0] + qy[1] + qy[2]) / 3;
  for (let k = 0; k < 3; k += 1) {
    const ax = qx[k];
    const ay = qy[k];
    const length = Math.sqrt((jx - ax) ** 2 + (jy - ay) ** 2) || 1;
    const nx = -(jy - ay) / length;
    const ny = (jx - ax) / length;
    let px = toX(ax);
    let py = toY(ay);
    const steps = 48;
    for (let s = 1; s <= steps; s += 1) {
      const u = s / steps;
      const wobble = 0.035 * Math.sin(u * Math.PI * 6 - t * 7 + k * 2) * Math.sin(u * Math.PI);
      const x = toX(ax + (jx - ax) * u + nx * wobble);
      const y = toY(ay + (jy - ay) * u + ny * wobble);
      const glyph = lineGlyph((x - px) / g.cw, (y - py) / g.ch);
      const flicker = 0.7 + 0.3 * hash2(s + k * 50, frame);
      walk(g, px, py, x, y, (i) => put(g, i, glyph, 255 * flicker, 236 * flicker, 170 * flicker));
      px = x;
      py = y;
    }
  }
  // 海夸克：一对对冒出来、分开一点、又湮灭掉
  for (let k = 0; k < 14; k += 1) {
    const period = 0.7 + hash1(k * 3) * 0.9;
    const cycle = (t + hash1(k * 5) * period) / period;
    const n = Math.floor(cycle);
    const f = cycle - n;
    if (f > 0.6) continue;
    const a = hash2(k, n) * Math.PI * 2;
    const r = Math.sqrt(hash2(n, k + 9)) * 0.7;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    const sep = 0.06 * Math.sin((Math.PI * f) / 0.6);
    const tone = QUARKS[(hash2(k, n + 1) * 3) | 0].color;
    walk(g, toX(px - sep), toY(py), toX(px - sep), toY(py), (i) => put(g, i, G.plus, tone[0] * 0.7, tone[1] * 0.7, tone[2] * 0.7));
    walk(g, toX(px + sep), toY(py), toX(px + sep), toY(py), (i) => put(g, i, G.dash, 255 - tone[0] * 0.5, 255 - tone[1] * 0.5, 255 - tone[2] * 0.5));
  }
  QUARKS.forEach((q, k) => blob(g, toX(qx[k]), toY(qy[k]), 0.055 / fov, q.color));
}

/* ====================== 夸克，以及夸克以下的未知 ====================== */

export function drawQuark(g: Grid, zz: number) {
  const log = logScaleAt(zz);
  const t = g.reduced ? 0 : g.time;
  // 周围的虚粒子：按对数均匀地撒在不同尺度上，镜头一放大它们就往外飞；越过 10^-18 m 以后只剩白色的零星几点
  const colored = smooth(-19.5, -17.5, log);
  const count = 460;
  for (let k = 0; k < count; k += 1) {
    const a = hash1(k * 11 + 1) * Math.PI * 2;
    const u = (hash1(k * 11 + 2) - log / 1.4 + t * 0.04) % 1;
    const frac = u < 0 ? u + 1 : u;
    const r = 0.8 * 10 ** (-1.7 * (1 - frac));
    const x = Math.cos(a) * r * 1.15;
    const y = Math.sin(a) * r * 0.85;
    const glow = smooth(0.02, 0.25, r) * (1 - smooth(0.6, 0.85, r));
    if (glow < 0.08) continue;
    const quarkish = hash1(k * 11 + 3) < colored;
    const tone = quarkish ? QUARKS[k % 3].color : [205, 210, 255];
    const dx = Math.cos(a) / g.cw;
    const dy = Math.sin(a) / g.ch;
    const glyph = r > 0.45 ? lineGlyph(dx, dy) : r > 0.2 ? G.plus : G.dot;
    const k2 = Math.min(1, glow * 1.35) * (quarkish ? 1 : 0.8);
    walk(g, x, y, x, y, (i) => put(g, i, glyph, tone[0] * k2, tone[1] * k2, tone[2] * k2));
  }
  // 夸克本身：不管放多大都是一个点
  walk(g, 0, 0, 0, 0, (i) => {
    put(g, i, G.at, 255, 96, 96);
    tint(g, i, 90, 20, 20);
  });
  const halo: [number, number, number][] = [
    [-1, 0, G.dash],
    [1, 0, G.dash],
    [0, -1, G.quote],
    [0, 1, G.dot],
  ];
  halo.forEach(([dx, dy, glyph]) => walk(g, dx * g.cw, dy * g.ch, dx * g.cw, dy * g.ch, (i) => put(g, i, glyph, 200, 60, 70)));
}

/* ====================== 弦 ====================== */

function drawLoop(g: Grid, cx: number, cy: number, radius: number, t: number, modes: number[], tone: (u: number) => [number, number, number], glow: boolean) {
  const steps = Math.max(120, Math.ceil((radius * 2 * Math.PI) / g.cw) * 3);
  let px = 0;
  let py = 0;
  for (let s = 0; s <= steps; s += 1) {
    const a = (s / steps) * Math.PI * 2;
    const r = radius * (1 + modes[0] * Math.sin(3 * a + 2.1 * t) + modes[1] * Math.sin(5 * a - 3.3 * t) + modes[2] * Math.sin(2 * a + 1.3 * t));
    const x = cx + Math.cos(a) * r * 1.1;
    const y = cy + Math.sin(a) * r * 0.9;
    if (s > 0) {
      const glyph = lineGlyph((x - px) / g.cw, (y - py) / g.ch);
      const [cr, cg, cb] = tone(s / steps);
      walk(g, px, py, x, y, (i) => put(g, i, glyph, cr, cg, cb));
      if (glow && s % 2 === 0) {
        const ox = Math.cos(a) * g.ch;
        const oy = Math.sin(a) * g.ch;
        walk(g, x + ox, y + oy, x + ox, y + oy, (i) => {
          if (g.fg[i * 4 + 3] === 0) put(g, i, G.dot, cr * 0.4, cg * 0.4, cb * 0.45);
        });
      }
    }
    px = x;
    py = y;
  }
}

export function drawString(g: Grid, zz: number) {
  const t = g.reduced ? 0 : g.time;
  const open = smooth(905, 928, zz);
  const zoom = 10 ** (logScaleAt(930) - logScaleAt(zz));
  const radius = 0.2 * open * zoom;
  if (open < 0.04) {
    walk(g, 0, 0, 0, 0, (i) => put(g, i, G.at, 255, 96, 96));
    return;
  }
  // 远处还有两根小一点的，各振各的
  [
    [-0.55, 0.22, 0.06, 1.7],
    [0.5, -0.24, 0.05, -1.3],
  ].forEach(([x, y, r, speed]) => {
    const fade = smooth(915, 940, zz);
    if (fade > 0.05) drawLoop(g, x * g.aspect * 0.8 * zoom * 0.5, y * zoom * 0.5, r * zoom * fade, t * speed, [0.18, 0.1, 0.06], () => [150 * fade, 120 * fade, 210 * fade], false);
  });
  const heat = 1 - open;
  // 外面再描一圈暗一点的，线条粗一些、像在发光
  drawLoop(g, 0, 0, radius + g.ch * 0.9, t, [0.13, 0.08, 0.05], () => [170, 70 * (1 - heat * 0.6), 120 * (1 - heat * 0.6)], false);
  drawLoop(g, 0, 0, radius, t, [0.13, 0.08, 0.05], (u) => {
    const pulse = 0.6 + 0.4 * Math.sin(u * Math.PI * 4 - t * 4);
    return [255, (110 + 145 * pulse) * (1 - heat * 0.6), (150 + 105 * pulse) * (1 - heat * 0.6)];
  }, true);
}

/* ====================== 普朗克尺度：时空泡沫 ====================== */

export function drawFoam(g: Grid, zz: number) {
  const t = g.reduced ? 0 : g.time;
  const frame = g.reduced ? 0 : Math.floor(t * 8);
  // 泡沫在哪个尺度看都差不多乱：不再跟着放大，只是慢慢地一胀一缩
  const scale = 3.2 * (1 + 0.08 * Math.sin(t * 0.35)) * (1 + 0.04 * (zz - 960) / 100);
  // 噪声隔一列算一次（两格共用），省一半时间
  for (let y = 0; y < g.rows; y += 1) {
    // 「距离」在这里不太靠得住：时不时有几行整行错开
    const tear = hash2(y, frame) < 0.08 ? (hash2(frame, y) - 0.5) * 0.25 : 0;
    for (let x = 0; x < g.cols; x += 2) {
      const jitter = (hash2(x + y * 977, frame) - 0.5) * 0.05 + tear;
      const px = g.ox[x] * scale + jitter;
      const py = g.oy[y] * scale;
      const qx1 = noise2(px * 1.7 + t * 0.35, py * 1.7);
      const qy1 = noise2(px * 1.7 + 5.2, py * 1.7 - t * 0.3);
      const wx = px + 1.6 * qx1;
      const wy = py + 1.6 * qy1;
      const n = noise2(wx * 2.2 - t * 0.25, wy * 2.2 + t * 0.2);
      const m = noise2(wx * 4.4 + 7, wy * 4.4 - t * 0.5);
      // 泡泡的壁：噪声接近 0.5 的地方是一条亮线
      const ridge = 1 - Math.abs(2 * n - 1);
      const wall = ridge ** 8;
      const v = Math.min(1, wall * 1.25 + m * 0.1);
      for (let c = x; c < Math.min(x + 2, g.cols); c += 1) {
        const i = y * g.cols + c;
        if (v < 0.1) continue;
        const pink = smooth(0.35, 0.75, m);
        const r = 170 + 85 * v;
        const gr = (150 + 105 * v) * (1 - pink * 0.55);
        const b = 220 + 35 * v;
        if (wall > 0.5) {
          put(g, i, lineGlyph(-(qy1 - 0.5), qx1 - 0.5), r, gr, b);
          tint(g, i, 46 * v, 30 * v, 58 * v);
        } else {
          put(g, i, RAMP[Math.min(9, 1 + Math.floor(v * 9))], r * 0.62, gr * 0.55, b * 0.75);
        }
      }
    }
  }
  // 冒出来又消失的小涨落
  for (let k = 0; k < 18; k += 1) {
    if (hash2(k, frame) > 0.5) continue;
    const sx = (hash2(frame, k + 1) - 0.5) * g.aspect;
    const sy = (hash2(k + 5, frame * 3) - 0.5) * g.half * 2;
    walk(g, sx, sy, sx, sy, (i) => put(g, i, hash2(k, frame + 1) < 0.5 ? G.star : G.plus, 255, 220, 240));
  }
}
