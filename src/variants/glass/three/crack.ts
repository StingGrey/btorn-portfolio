// 玻璃裂纹。
// 一个主撞击点（人字的交叉处）+ 左右两个小撞击点。每个撞击点崩出：放射裂纹（人字的两条腿和主干是最长的三条）、
// 绕着撞击点的环形裂纹、撞击点上的一小撮碎纹；裂纹往前跑的时候会分叉，边上还带着细小的毛刺。
//
// 裂纹是按「事件」一下一下崩出来的：滚动只决定崩到第几下，每一下自己按时间跑完（前沿极快、跑到头减速），
// 所以看起来是「咔、咔」地裂开，而不是跟着滚轮一点点画出来。往回滑时按 3 倍速收回去。
//
// 坐标：原点在屏幕底边正中，y 朝上，单位是 base（≈ 屏幕高度，不随进度缩放）。
// 画到一张 2D 画布上：R = 裂缝芯（真实宽度的细线，张开时变宽、边缘参差），
// G = 裂缝周围的故障范围（刚崩出来的那一下更强），B = 碎块的错位量（被裂纹围住的碎块“啪”地错开一点）。

type Point = [number, number];
type Rand = () => number;

type CrackPath = {
  points: Point[];
  /** 每个点到起点的弧长 */
  cum: Float32Array;
  length: number;
  event: number;
  /** 所属事件开始后多少毫秒开始跑 */
  delay: number;
  /** 从头跑到尾用多少毫秒 */
  duration: number;
  /** 半宽，CSS 像素 */
  width: number;
  /** 张开时额外的半宽，CSS 像素 */
  open: number;
  /** 越往末端越细的程度 */
  taper: number;
  /** 周围故障范围的强度，0 = 没有 */
  zone: number;
  /** 张开时左右两边各自的参差（每个点两个数） */
  jag: Float32Array;
};

type CrackShard = { polygon: Point[]; b: number; event: number; delay: number; layer: number };
type CrackEvent = { at: number; strength: number; length: number };

export type CrackModel = { paths: CrackPath[]; shards: CrackShard[]; events: CrackEvent[] };
export type CrackState = { ages: Float32Array; front: Float32Array; fresh: Float32Array };

/** 前沿减速的程度：1 = 匀速 */
const EASE = 1.8;
/** 刚崩出来的裂纹周围多“热”一会儿（毫秒） */
const FRESH_MS = 420;
/** 前沿和末端收成针尖的长度（base 单位） */
const TIP = 0.022;
/** 碎块错开用多久（毫秒）：很短，是“啪”地一下 */
const SHARD_POP_MS = 40;
/** 往回滑时收回去的倍速 */
const RETRACT = 3;

/** 每一下崩开：在 crack 进度到多少时触发、震一下的力度 */
const EVENTS: [number, number][] = [
  [0.03, 0.45], // 0 撞击：一小撮碎纹
  [0.11, 1], // 1 人字的两条腿崩到底
  [0.21, 0.85], // 2 主干往上崩
  [0.31, 0.6], // 3 短放射纹 + 第一圈环纹 + 腿上分叉
  [0.41, 0.6], // 4 第二、三圈环纹，圈里的碎块错开
  [0.5, 0.75], // 5 左边小撞击点
  [0.59, 0.5], // 6 主干分叉 + 第二代分叉
  [0.67, 0.65], // 7 右边小撞击点
  [0.75, 0.85], // 8 两腿之间的大碎块错开，分叉往外延
  [0.83, 0.45], // 9 小撞击点的分叉、外圈和碎块
  [0.9, 0.35], // 10 细分叉
  [0.96, 0.25], // 11 最后几道发丝纹
];

function mulberry(seed: number): Rand {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

/** 朝着目标走：一段段直线，偶尔急折一下（玻璃裂纹是“折”过去的，不是弯过去的） */
function walkTo(from: Point, to: Point, step: number, wander: number, rand: Rand): Point[] {
  const points: Point[] = [from];
  let [x, y] = from;
  let heading = Math.atan2(to[1] - y, to[0] - x);
  for (let guard = 0; guard < 400; guard += 1) {
    const dx = to[0] - x;
    const dy = to[1] - y;
    const left = Math.hypot(dx, dy);
    if (left < step * 0.7) break;
    heading += wrap(Math.atan2(dy, dx) - heading) * 0.45 + (rand() - 0.5) * wander;
    if (rand() < 0.12) heading += (rand() < 0.5 ? -1 : 1) * wander * (0.8 + rand());
    const len = Math.min(left, step * (0.55 + rand() * 0.9));
    x += Math.cos(heading) * len;
    y += Math.sin(heading) * len;
    points.push([x, y]);
  }
  points.push(to);
  return points;
}

/** 沿一个方向走一段：分叉、短放射纹、毛刺都用它 */
function walk(from: Point, heading: number, length: number, step: number, wander: number, curl: number, rand: Rand): Point[] {
  const points: Point[] = [from];
  let [x, y] = from;
  let h = heading;
  let left = length;
  while (left > 1e-5) {
    const len = Math.min(left, step * (0.55 + rand() * 0.9));
    x += Math.cos(h) * len;
    y += Math.sin(h) * len;
    points.push([x, y]);
    left -= len;
    h += (rand() - 0.5) * wander + curl * len;
    if (rand() < 0.1) h += (rand() < 0.5 ? -1 : 1) * wander;
  }
  return points;
}

/** 每段中间再插一个稍微偏开的点：近看是细碎的锯齿，不是光滑的直线 */
function roughen(points: Point[], amp: number, rand: Rand): Point[] {
  const out: Point[] = [points[0]];
  for (let index = 1; index < points.length; index += 1) {
    const [ax, ay] = points[index - 1];
    const [bx, by] = points[index];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    if (len > amp * 6) {
      const k = 0.3 + rand() * 0.4;
      const off = (rand() - 0.5) * 2 * amp;
      out.push([ax + dx * k - (dy / len) * off, ay + dy * k + (dx / len) * off]);
    }
    out.push(points[index]);
  }
  return out;
}

function at(path: CrackPath, s: number): { point: Point; heading: number } {
  const { points, cum } = path;
  let index = 1;
  while (index < points.length - 1 && cum[index] < s) index += 1;
  const a = points[index - 1];
  const b = points[index];
  const k = clamp01((s - cum[index - 1]) / (cum[index] - cum[index - 1] || 1e-6));
  return { point: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], heading: Math.atan2(b[1] - a[1], b[0] - a[0]) };
}

const ease = (f: number) => 1 - Math.pow(1 - f, EASE);
/** 前沿跑到弧长 s 的时刻（相对事件开始） */
const timeAt = (path: CrackPath, s: number) => path.delay + path.duration * (1 - Math.pow(1 - clamp01(s / path.length), 1 / EASE));

type Part = { event: number; delay?: number };
type ImpactConfig = {
  J: Point;
  /** 人字的大小（主撞击点 = 1） */
  scale: number;
  /** 线宽倍数 */
  weight: number;
  feet: [Point, Point];
  top: Point;
  /** 短放射纹：[角度（度）, 长度（scale 单位）] */
  spokes: [number, number][];
  /** 环纹：半径（scale 单位）、每一段出现的概率、事件、开始延迟 */
  rings: { r: number; chance: number; event: number; delay: number }[];
  crush: Part;
  legs: Part;
  stem: Part;
  spokesAt: Part;
  legForks: number;
  stemForks: number;
  gen2: number;
  extend: number;
  gen3: number;
  hair: { event: number; count: number };
  legsShard: number;
};

export function buildCrackModel(seed = 20261110): CrackModel {
  const rand = mulberry(seed);
  const rnd = (a: number, b: number) => a + rand() * (b - a);
  const model: CrackModel = {
    paths: [],
    shards: [],
    events: EVENTS.map(([at, strength]) => ({ at, strength, length: 0 })),
  };

  const add = (
    points: Point[],
    o: { event: number; delay: number; speed?: number; duration?: number; width: number; open: number; taper: number; zone: number },
  ) => {
    const cum = new Float32Array(points.length);
    for (let index = 1; index < points.length; index += 1) {
      cum[index] = cum[index - 1] + Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]);
    }
    const length = cum[points.length - 1] || 1e-6;
    const jag = new Float32Array(points.length * 2);
    for (let index = 0; index < jag.length; index += 1) jag[index] = 0.35 + rand() * 1.3;
    const path: CrackPath = {
      points,
      cum,
      length,
      event: o.event,
      delay: o.delay,
      // speed：每秒跑多少 base
      duration: o.duration ?? (length / (o.speed ?? 3)) * 1000,
      width: o.width,
      open: o.open,
      taper: o.taper,
      zone: o.zone,
      jag,
    };
    model.paths.push(path);
    return path;
  };

  const impact = (c: ImpactConfig) => {
    const first = model.paths.length;
    const s = c.scale;
    // 步长、毛刺这些细节不跟着人字一起缩得太小
    const unit = Math.max(s, 0.5);
    const step = 0.034 * unit;
    const rough = 0.0022 * unit;
    const w = c.weight;

    // 毛刺：裂纹两边一路上细小的斜向碎纹，前沿经过时跟着冒出来
    const hackles = (path: CrackPath, density: number) => {
      let sAt = rnd(0.01, 0.03);
      while (sAt < path.length - 0.012) {
        const { point, heading } = at(path, sAt);
        const side = rand() < 0.5 ? 1 : -1;
        const len = rnd(0.003, 0.011) * unit;
        add(walk(point, heading + side * rnd(0.6, 1.4), len, len * 0.55, 0.7, 0, rand), {
          event: path.event,
          delay: timeAt(path, sAt) + rnd(2, 24),
          duration: rnd(14, 36),
          width: 0.32 * w,
          open: 0,
          taper: 1,
          zone: 0,
        });
        sAt += rnd(0.018, 0.05) / density;
      }
    };

    // 分叉：从母裂纹上一点往前斜着劈出去（锐角，玻璃的分叉总是往前开）。
    // event 为 null：跟着母裂纹的前沿一起分出去；否则在之后那一下单独崩出来
    const forksOn = (parent: CrackPath, count: number, gen: 1 | 2 | 3, event: number | null, range: [number, number]) => {
      const out: CrackPath[] = [];
      for (let index = 0; index < count; index += 1) {
        const sAt = parent.length * rnd(0.18, 0.86);
        const side = (index % 2 === 0 ? 1 : -1) * (rand() < 0.2 ? -1 : 1);
        const { point, heading } = at(parent, sAt);
        const pts = roughen(walk(point, heading + side * rnd(0.26, 0.66), rnd(range[0], range[1]) * s, step * 0.75, 0.26, -side * rnd(0, 0.5), rand), rough * 0.8, rand);
        const child = add(pts, {
          event: event ?? parent.event,
          delay: event === null ? timeAt(parent, sAt) + rnd(3, 12) : rnd(0, 120),
          speed: 3.1 - gen * 0.4,
          width: [0.78, 0.58, 0.44][gen - 1] * w,
          // 分叉几乎不张开：碎块主要沿放射纹和环纹分开，分叉张开了就像树根
          open: [0.9, 0.4, 0][gen - 1],
          taper: 0.85,
          zone: [0.55, 0.4, 0.22][gen - 1],
        });
        if (gen < 3) hackles(child, gen === 1 ? 0.6 : 0.35);
        out.push(child);
      }
      return out;
    };

    // 放射裂纹：人字三笔 + 几道短的
    const legL = add(roughen(walkTo(c.J, c.feet[0], step, 0.3, rand), rough, rand), {
      event: c.legs.event,
      delay: c.legs.delay ?? 0,
      speed: 4,
      width: 1.15 * w,
      open: 4.5,
      taper: 0.5,
      zone: 1,
    });
    const legR = add(roughen(walkTo(c.J, c.feet[1], step, 0.3, rand), rough, rand), {
      event: c.legs.event,
      delay: (c.legs.delay ?? 0) + rnd(10, 30),
      speed: 4,
      width: 1.15 * w,
      open: 4.5,
      taper: 0.5,
      zone: 1,
    });
    const stem = add(roughen(walkTo(c.J, c.top, step, 0.3, rand), rough, rand), {
      event: c.stem.event,
      delay: c.stem.delay ?? 0,
      speed: 3.6,
      width: 1.05 * w,
      open: 3.6,
      taper: 0.62,
      zone: 0.95,
    });
    const radials = [legL, legR, stem];
    c.spokes.forEach(([deg, len]) => {
      const angle = (deg * Math.PI) / 180 + (rand() - 0.5) * 0.15;
      radials.push(
        add(roughen(walk(c.J, angle, len * s, step * 0.8, 0.32, 0, rand), rough, rand), {
          event: c.spokesAt.event,
          delay: (c.spokesAt.delay ?? 0) + rnd(0, 70),
          speed: 3,
          width: 0.85 * w,
          open: 2.4,
          taper: 0.8,
          zone: 0.7,
        }),
      );
    });
    radials.forEach((path) => hackles(path, path.zone > 0.9 ? 1 : 0.7));

    // 撞击点上的一小撮碎纹
    for (let index = 0; index < 10; index += 1) {
      const angle = rand() * Math.PI * 2;
      const r0 = rnd(0, 0.006) * unit;
      const from: Point = [c.J[0] + Math.cos(angle) * r0, c.J[1] + Math.sin(angle) * r0];
      add(roughen(walk(from, angle + (rand() - 0.5) * 0.8, rnd(0.008, 0.026) * unit, 0.008 * unit, 0.6, 0, rand), rough * 0.5, rand), {
        event: c.crush.event,
        delay: (c.crush.delay ?? 0) + rnd(0, 35),
        duration: rnd(18, 45),
        width: 0.45 * w,
        open: 0.5,
        taper: 0.9,
        zone: 0.3,
      });
    }

    // 环纹：在相邻两道放射纹之间，绕着撞击点折出一段段的弧；端点落在放射纹上
    const arcs = c.rings.map((ring) => {
      const r = ring.r * s;
      const around = radials
        .map((path, index) => ({ path, index }))
        .filter(({ path }) => path.length > r * 1.1)
        .map((item) => {
          const hit = at(item.path, r * rnd(0.94, 1.06));
          return { ...item, point: hit.point, angle: Math.atan2(hit.point[1] - c.J[1], hit.point[0] - c.J[0]) };
        })
        .sort((a, b) => a.angle - b.angle);
      const found = new Map<string, Point[]>();
      if (around.length < 2) return found;
      let order = 0;
      around.forEach((A, index) => {
        const B = around[(index + 1) % around.length];
        let gap = B.angle - A.angle;
        if (gap <= 0) gap += Math.PI * 2;
        if (gap > 2.4 || rand() > ring.chance) return;
        const n = 2 + Math.ceil(gap / 0.45);
        const pts: Point[] = [A.point];
        for (let k = 1; k < n; k += 1) {
          const angle = A.angle + (gap * k) / n;
          const rr = r * rnd(0.9, 1.1);
          pts.push([c.J[0] + Math.cos(angle) * rr, c.J[1] + Math.sin(angle) * rr]);
        }
        pts.push(B.point);
        found.set(`${A.index}-${B.index}`, pts);
        add(roughen(rand() < 0.5 ? pts : [...pts].reverse(), rough * 0.7, rand), {
          event: ring.event,
          delay: ring.delay + order * rnd(12, 30),
          speed: 1.9,
          width: 0.62 * w,
          open: 1.5,
          taper: 0.25,
          zone: 0.4,
        });
        order += 1;
      });
      return found;
    });

    // 碎块：两腿和底边围住的一大块；相邻两圈环纹和放射纹围住的小块，各自错开不同的量
    model.shards.push({
      polygon: [...legL.points, ...[...legR.points].reverse()],
      b: 0.85 * w,
      event: c.legsShard,
      delay: 0,
      layer: 0,
    });
    for (let ringIndex = 0; ringIndex < arcs.length - 1; ringIndex += 1) {
      const outerRing = c.rings[ringIndex + 1];
      arcs[ringIndex].forEach((inner, key) => {
        const outer = arcs[ringIndex + 1].get(key);
        if (!outer) return;
        model.shards.push({
          polygon: [...inner, ...[...outer].reverse()],
          b: rnd(0.18, 0.6),
          event: outerRing.event,
          delay: outerRing.delay + 200,
          layer: 1,
        });
      });
    }

    // 分叉：腿上有边跑边分的，也有之后才崩出来的；再往下是第二代、往外延的、细的
    const legGen1 = [
      ...forksOn(legL, 1, 1, null, [0.12, 0.24]),
      ...forksOn(legR, 1, 1, null, [0.12, 0.24]),
      ...forksOn(legL, 1, 1, c.legForks, [0.1, 0.22]),
      ...forksOn(legR, 1, 1, c.legForks, [0.1, 0.22]),
    ];
    const stemGen1 = forksOn(stem, 2, 1, c.stemForks, [0.08, 0.18]);
    const gen2 = [...legGen1, ...stemGen1].flatMap((path) => (rand() < 0.4 ? forksOn(path, 1, 2, c.gen2, [0.04, 0.1]) : []));
    legGen1.forEach((path) => {
      if (rand() > 0.4) return;
      const { heading } = at(path, path.length);
      const end = path.points[path.points.length - 1];
      const ext = add(roughen(walk(end, heading + (rand() - 0.5) * 0.4, rnd(0.08, 0.2) * s, step * 0.8, 0.3, 0, rand), rough, rand), {
        event: c.extend,
        delay: rnd(0, 140),
        speed: 3,
        width: 0.6 * w,
        open: 0.5,
        taper: 0.9,
        zone: 0.45,
      });
      hackles(ext, 0.4);
    });
    [...legGen1, ...gen2].forEach((path) => {
      if (rand() < 0.25) forksOn(path, 1, 3, c.gen3, [0.015, 0.05]);
    });

    // 最后几道发丝纹：随便从哪条裂纹上斜着冒出一小截
    const pool = model.paths.slice(first).filter((path) => path.zone >= 0.2);
    for (let index = 0; index < c.hair.count; index += 1) {
      const parent = pool[Math.floor(rand() * pool.length)];
      const { point, heading } = at(parent, parent.length * rnd(0.1, 0.95));
      add(roughen(walk(point, heading + (rand() < 0.5 ? -1 : 1) * rnd(0.4, 1.3), rnd(0.008, 0.03) * unit, 0.01 * unit, 0.5, 0, rand), rough * 0.5, rand), {
        event: c.hair.event,
        delay: rnd(0, 180),
        duration: rnd(25, 60),
        width: 0.34 * w,
        open: 0,
        taper: 1,
        zone: 0,
      });
    }
  };

  // 主撞击点：人字的交叉处
  impact({
    J: [0.02 + rnd(-0.02, 0.02), 0.47 + rnd(-0.01, 0.02)],
    scale: 1,
    weight: 1,
    feet: [
      [-0.46 + rnd(-0.03, 0.02), -0.03],
      [0.43 + rnd(-0.02, 0.03), -0.03],
    ],
    top: [-0.09 + rnd(-0.03, 0.03), 0.95],
    spokes: [
      [160, 0.2],
      [268, 0.12],
      [352, 0.15],
      [38, 0.18],
    ],
    rings: [
      { r: 0.045, chance: 1, event: 3, delay: 70 },
      { r: 0.1, chance: 0.85, event: 4, delay: 0 },
      { r: 0.17, chance: 0.5, event: 4, delay: 110 },
    ],
    crush: { event: 0 },
    legs: { event: 1 },
    stem: { event: 2 },
    spokesAt: { event: 3 },
    legForks: 3,
    stemForks: 6,
    gen2: 6,
    extend: 8,
    gen3: 10,
    hair: { event: 11, count: 18 },
    legsShard: 8,
  });

  // 左边的小撞击点：一下子全崩出来
  impact({
    J: [-0.69, 0.19],
    scale: 0.4,
    weight: 0.85,
    feet: [
      [-0.88, -0.03],
      [-0.53, -0.03],
    ],
    top: [-0.73, 0.39],
    spokes: [
      [165, 0.42],
      [28, 0.36],
      [262, 0.26],
    ],
    rings: [
      { r: 0.05, chance: 1, event: 5, delay: 150 },
      { r: 0.12, chance: 0.6, event: 9, delay: 0 },
    ],
    crush: { event: 5 },
    legs: { event: 5 },
    stem: { event: 5, delay: 45 },
    spokesAt: { event: 5, delay: 30 },
    legForks: 9,
    stemForks: 9,
    gen2: 10,
    extend: 10,
    gen3: 11,
    hair: { event: 11, count: 6 },
    legsShard: 9,
  });

  // 右边的小撞击点
  impact({
    J: [0.69, 0.16],
    scale: 0.34,
    weight: 0.8,
    feet: [
      [0.54, -0.03],
      [0.84, -0.03],
    ],
    top: [0.66, 0.33],
    spokes: [
      [150, 0.4],
      [20, 0.38],
      [272, 0.24],
    ],
    rings: [
      { r: 0.05, chance: 1, event: 7, delay: 140 },
      { r: 0.12, chance: 0.6, event: 9, delay: 60 },
    ],
    crush: { event: 7 },
    legs: { event: 7 },
    stem: { event: 7, delay: 40 },
    spokesAt: { event: 7, delay: 30 },
    legForks: 9,
    stemForks: 10,
    gen2: 10,
    extend: 11,
    gen3: 11,
    hair: { event: 11, count: 5 },
    legsShard: 9,
  });

  model.paths.forEach((path) => {
    const event = model.events[path.event];
    event.length = Math.max(event.length, path.delay + path.duration + FRESH_MS);
  });
  model.shards.forEach((shard) => {
    const event = model.events[shard.event];
    event.length = Math.max(event.length, shard.delay + SHARD_POP_MS);
  });
  model.shards.sort((a, b) => a.layer - b.layer);
  return model;
}

export function createCrackState(model: CrackModel): CrackState {
  return {
    ages: new Float32Array(model.events.length),
    front: new Float32Array(model.paths.length),
    fresh: new Float32Array(model.paths.length),
  };
}

/**
 * 推进一帧。crack：滚动给出的进度 0..1；instant：直接跳到该在的样子（减少动效、或者舞台要停下了）。
 * 返回这一帧有没有变化（要不要重画）和新崩开的力度（0 = 这一帧没有崩）。
 */
export function stepCracks(model: CrackModel, state: CrackState, crack: number, dtMs: number, instant: boolean) {
  let changed = false;
  let snap = 0;
  model.events.forEach((event, index) => {
    const age = state.ages[index];
    const on = crack >= event.at;
    const next = instant
      ? on
        ? event.length
        : 0
      : on
        ? Math.min(event.length, age + dtMs)
        : Math.max(0, age - dtMs * RETRACT);
    if (on && age === 0 && next > 0 && !instant) snap = Math.max(snap, event.strength);
    if (next !== age) {
      state.ages[index] = next;
      changed = true;
    }
  });
  if (changed) {
    model.paths.forEach((path, index) => {
      const t = state.ages[path.event] - path.delay;
      if (t <= 0) {
        state.front[index] = 0;
        state.fresh[index] = 0;
        return;
      }
      state.front[index] = path.length * ease(Math.min(1, t / path.duration));
      state.fresh[index] = 1 - clamp01((t - path.duration) / FRESH_MS);
    });
  }
  return { changed, snap };
}

// 画的时候用的临时数组（屏幕坐标、弧长、原始点序号），避免每帧分配
const SX = new Float64Array(1024);
const SY = new Float64Array(1024);
const SS = new Float64Array(1024);
const SI = new Int32Array(1024);

/** 把一条裂纹从起点到前沿 s 的点换成屏幕坐标放进临时数组，返回点数 */
function collect(path: CrackPath, s: number, toX: (x: number) => number, toY: (y: number) => number) {
  const { points, cum } = path;
  let m = 0;
  for (let index = 0; index < points.length && m < SX.length; index += 1) {
    if (index === 0 || cum[index] < s) {
      SX[m] = toX(points[index][0]);
      SY[m] = toY(points[index][1]);
      SS[m] = cum[index];
      SI[m] = index;
      m += 1;
      continue;
    }
    const a = points[index - 1];
    const b = points[index];
    const k = clamp01((s - cum[index - 1]) / (cum[index] - cum[index - 1] || 1e-6));
    SX[m] = toX(a[0] + (b[0] - a[0]) * k);
    SY[m] = toY(a[1] + (b[1] - a[1]) * k);
    SS[m] = s;
    SI[m] = index;
    m += 1;
    break;
  }
  return m;
}

function trace(ctx: CanvasRenderingContext2D, m: number, stride: number) {
  ctx.moveTo(SX[0], SY[0]);
  for (let k = stride; k < m - 1; k += stride) ctx.lineTo(SX[k], SY[k]);
  ctx.lineTo(SX[m - 1], SY[m - 1]);
}

/** 裂缝芯画成一条填充的细带：宽度沿途收窄，前沿 / 末端收成针尖，张开时两边各自参差 */
function ribbon(ctx: CanvasRenderingContext2D, path: CrackPath, s: number, m: number, px: number, open: number) {
  const tip = Math.min(TIP, path.length * 0.6);
  const baseW = path.width * px;
  const openW = path.open * open * px;
  ctx.beginPath();
  for (let side = 0; side < 2; side += 1) {
    const sign = side === 0 ? 1 : -1;
    for (let k = 0; k < m; k += 1) {
      const i = side === 0 ? k : m - 1 - k;
      const prev = Math.max(0, i - 1);
      const next = Math.min(m - 1, i + 1);
      let tx = SX[next] - SX[prev];
      let ty = SY[next] - SY[prev];
      const len = Math.hypot(tx, ty) || 1;
      tx /= len;
      ty /= len;
      const along = SS[i] / path.length;
      const needle = Math.min(1, (s - SS[i]) / tip);
      const hw = (baseW * (1 - path.taper * along) + openW * (1 - 0.55 * along) * path.jag[SI[i] * 2 + side]) * needle;
      const x = SX[i] - ty * hw * sign;
      const y = SY[i] + tx * hw * sign;
      if (side === 0 && k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fill();
}

const ZONE_LAYERS: [number, number][] = [
  [0.12, 30],
  [0.065, 46],
  [0.03, 70],
];

/** 把裂纹画到画布上。crack：滚动进度（故障范围跟着变宽）；open：裂缝张开的程度 0..1 */
export function drawCracks(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  model: CrackModel,
  state: CrackState,
  crack: number,
  open: number,
) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  if (!state.ages.some((age) => age > 0)) return;

  const base = Math.min(height, width * 1.15);
  // 线宽按 CSS 像素给，屏幕大一点稍微粗一点
  const px = Math.min(Math.max(base / 900, 0.8), 1.6);
  const toX = (x: number) => width / 2 + x * base;
  const toY = (y: number) => height - y * base;

  // ① 碎块错位：B 通道（后画的小碎块盖住大碎块）
  model.shards.forEach((shard) => {
    const t = state.ages[shard.event] - shard.delay;
    if (t <= 0) return;
    ctx.globalAlpha = clamp01(t / SHARD_POP_MS);
    ctx.fillStyle = `rgb(0, 0, ${Math.round(255 * shard.b)})`;
    ctx.beginPath();
    shard.polygon.forEach(([x, y], index) => {
      if (index === 0) ctx.moveTo(toX(x), toY(y));
      else ctx.lineTo(toX(x), toY(y));
    });
    ctx.closePath();
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // ② 故障范围：G 通道，三层宽笔画叠出柔和的衰减；刚崩出来的再叠一层，那一下周围特别乱
  const grow = 0.35 + 1.1 * crack;
  ZONE_LAYERS.forEach(([size, value]) => {
    ctx.strokeStyle = `rgb(0, ${value}, 0)`;
    model.paths.forEach((path, index) => {
      const s = state.front[index];
      if (path.zone <= 0 || s <= 0) return;
      const m = collect(path, s, toX, toY);
      if (m < 2) return;
      ctx.lineWidth = Math.max(2, base * size * path.zone * grow * 0.5);
      ctx.beginPath();
      trace(ctx, m, 1);
      ctx.stroke();
    });
  });
  model.paths.forEach((path, index) => {
    const s = state.front[index];
    const fresh = state.fresh[index];
    if (path.zone <= 0 || s <= 0 || fresh <= 0.01) return;
    const m = collect(path, s, toX, toY);
    if (m < 2) return;
    ctx.strokeStyle = `rgb(0, ${Math.round(130 * fresh)}, 0)`;
    ctx.lineWidth = Math.max(3, base * 0.03 * Math.max(path.zone, 0.4));
    ctx.beginPath();
    trace(ctx, m, 1);
    ctx.stroke();
  });

  // ③ 裂缝芯：R 通道
  ctx.fillStyle = 'rgb(255, 0, 0)';
  model.paths.forEach((path, index) => {
    const s = state.front[index];
    if (s <= 0) return;
    const m = collect(path, s, toX, toY);
    if (m >= 2) ribbon(ctx, path, s, m, px, open);
  });
}

/**
 * 像素扩散遮罩：把已经崩出来的主要裂纹一圈圈“膨胀”出去。
 * 一层层越来越窄的笔画叠加，所以越靠近裂缝（越早被吞掉）数值越大，着色器用它决定像素块的大小。
 */
export function drawSpread(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  model: CrackModel,
  state: CrackState,
  spread: number,
) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  if (spread <= 0.001) return;

  const base = Math.min(height, width * 1.15);
  const toX = (x: number) => width / 2 + x * base;
  const toY = (y: number) => height - y * base;
  const radius = spread * Math.hypot(width, height) * 0.62;
  const layers = 5;

  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgb(${Math.floor(255 / layers)}, 0, 0)`;
  for (let layer = 0; layer < layers; layer += 1) {
    ctx.lineWidth = 2 + 2 * radius * (1 - layer / layers);
    // 同一层的所有裂纹合成一笔：遮罩本来就是糊的，点也抽稀一半
    ctx.beginPath();
    model.paths.forEach((path, index) => {
      const s = state.front[index];
      if (path.zone < 0.5 || s <= 0) return;
      const m = collect(path, s, toX, toY);
      if (m >= 2) trace(ctx, m, 2);
    });
    ctx.stroke();
  }
}
