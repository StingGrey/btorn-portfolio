// 太阳和地球：银河系边上一团气体和尘埃塌缩、越转越快，中间点亮成太阳，周围留下一圈尘埃盘；
// 盘里的尘埃先聚成一圈圈的环、再聚成一颗颗行星，第三颗是地球。镜头跟着地球一直放大到整颗星球（那时候还是一团岩浆），
// 时间一跳四十五亿年：今天的地球，上面有一个粉色的点是「你」。地球的画法 drawGlobe 在最后拉远时也用。

import { G, RAMP } from '../charset';
import { BG, clamp01, clock, colOf, hash1, hash2, lerp, noise2, noise3, plot, put, rowOf, smooth, tint, walk, type Grid } from '../grid';
import { callout, status, type Rgb } from '../notes';
import { PINK, ball, bump, glow, ringAt } from './shapes';

/** 今天那颗地球在屏幕上的半径：拉远那一段从这里接着往外拉（地球直径 12,742 km，屏幕高 22,400 km） */
export const EARTH_R = 6.371e6 / 10 ** 7.35;
/** 地球转到哪个经度朝着我们（固定，「你在这」那个粉点才待得住） */
export const EARTH_SPIN = 2.1;

/* ====================== 地球 ====================== */

const OCEAN: Rgb = [30, 84, 196];
const LAND: Rgb = [70, 150, 82];
const DESERT: Rgb = [196, 164, 104];
const ICE: Rgb = [232, 240, 255];
const CRUST: Rgb = [70, 32, 28];
const LAVA: Rgb = [255, 118, 40];
const OUT: Rgb = [0, 0, 0];

/** 球面上一点 (x, y, z)（转过 spin 以后）是什么颜色：modern 0 = 刚形成时一团岩浆，1 = 今天 */
function surface(x: number, y: number, z: number, modern: number, light: number) {
  const n = noise3(x * 2.1 + 4, y * 2.1 + 1, z * 2.1 - 3);
  // 今天：海、陆地（绿的、黄的）、两极的冰、一点云
  let r: number;
  let gr: number;
  let b: number;
  if (Math.abs(y) > 0.84) {
    r = ICE[0];
    gr = ICE[1];
    b = ICE[2];
  } else if (n > 0.56) {
    const dry = smooth(0.45, 0.62, noise3(x * 4 + 9, y * 4, z * 4 - 5));
    r = lerp(LAND[0], DESERT[0], dry);
    gr = lerp(LAND[1], DESERT[1], dry);
    b = lerp(LAND[2], DESERT[2], dry);
  } else {
    r = OCEAN[0];
    gr = OCEAN[1];
    b = OCEAN[2];
  }
  const cloud = smooth(0.6, 0.7, noise3(x * 3.4 - 2, y * 3.4 + 9, z * 3.4 + 1));
  r = lerp(r, 255, cloud * 0.85);
  gr = lerp(gr, 255, cloud * 0.85);
  b = lerp(b, 255, cloud * 0.85);
  r *= light;
  gr *= light;
  b *= light;
  if (modern < 1) {
    // 那时候：暗红的壳上裂着发光的岩浆（自己发光，不管哪边朝着太阳）
    const crack = (1 - Math.abs(2 * n - 1)) ** 6;
    const yr = CRUST[0] * light + LAVA[0] * crack;
    const yg = CRUST[1] * light + LAVA[1] * crack;
    const yb = CRUST[2] * light + LAVA[2] * crack;
    r = lerp(yr, r, modern);
    gr = lerp(yg, gr, modern);
    b = lerp(yb, b, modern);
  }
  OUT[0] = r;
  OUT[1] = gr;
  OUT[2] = b;
  return OUT;
}

/** 一颗地球：中心在屏幕 (cx, cy)，半径 R；太阳从左上照过来，外面一圈淡淡的大气 */
export function drawGlobe(g: Grid, cx: number, cy: number, R: number, modern: number, show: number) {
  if (show < 0.03) return;
  if (R < g.ch * 1.2) {
    const tone = modern > 0.5 ? [110, 175, 255] : [255, 130, 70];
    plot(g, cx, cy, G.disc, tone[0] * show, tone[1] * show, tone[2] * show);
    return;
  }
  const c0 = Math.max(0, colOf(g, cx - R * 1.15));
  const c1 = Math.min(g.cols - 1, colOf(g, cx + R * 1.15));
  const r0 = Math.max(0, rowOf(g, cy + R * 1.06));
  const r1 = Math.min(g.rows - 1, rowOf(g, cy - R * 1.06));
  const cs = Math.cos(EARTH_SPIN);
  const ss = Math.sin(EARTH_SPIN);
  for (let row = r0; row <= r1; row += 1) {
    const dy = (g.oy[row] - cy) / R;
    for (let col = c0; col <= c1; col += 1) {
      const dx = (g.ox[col] - cx) / (R * 1.1);
      const d2 = dx * dx + dy * dy;
      const i = row * g.cols + col;
      if (d2 > 1) {
        // 大气：边上一圈蓝
        if (d2 < 1.1 && modern > 0) {
          const a = (1 - (d2 - 1) / 0.1) * modern * show;
          glow(g, i, 30 * a, 70 * a, 160 * a);
        }
        continue;
      }
      const dz = Math.sqrt(1 - d2);
      const light = 0.1 + 0.9 * clamp01(-0.55 * dx + 0.45 * dy + 0.7 * dz);
      const x = dx * cs + dz * ss;
      const z = -dx * ss + dz * cs;
      const c = surface(x, dy, z, modern, light);
      const k = show;
      put(g, i, G.full, c[0] * k, c[1] * k, c[2] * k);
      tint(g, i, c[0] * k, c[1] * k, c[2] * k);
    }
  }
}

/** 今天的地球上「你」在哪（单位球面上朝着我们的那一面，一块陆地上） */
let you: [number, number] | null = null;
export function youOnGlobe(): [number, number] {
  if (you) return you;
  const cs = Math.cos(EARTH_SPIN);
  const ss = Math.sin(EARTH_SPIN);
  let best = Infinity;
  you = [-0.2, 0.2];
  for (let j = -6; j <= 6; j += 1) {
    for (let i = -6; i <= 6; i += 1) {
      const dx = i * 0.1;
      const dy = j * 0.1;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0.5) continue;
      const dz = Math.sqrt(1 - d2);
      const x = dx * cs + dz * ss;
      const z = -dx * ss + dz * cs;
      const land = noise3(x * 2.1 + 4, dy * 2.1 + 1, z * 2.1 - 3);
      const cloud = noise3(x * 3.4 - 2, dy * 3.4 + 9, z * 3.4 + 1);
      if (land < 0.6 || cloud > 0.6 || Math.abs(dy) > 0.7) continue;
      const score = Math.hypot(dx + 0.2, dy - 0.15);
      if (score < best) {
        best = score;
        you = [dx, dy];
      }
    }
  }
  return you;
}

/* ====================== 太阳、尘埃盘、行星 ====================== */

type Planet = { name: string; r: number; color: Rgb; big: boolean; phase: number };
const PLANETS: Planet[] = [
  { name: 'Mercury', r: 0.07, color: [175, 168, 160], big: false, phase: 0.4 },
  { name: 'Venus', r: 0.1, color: [240, 214, 160], big: false, phase: 2.2 },
  { name: 'Earth', r: 0.135, color: [100, 170, 255], big: false, phase: 3.9 },
  { name: 'Mars', r: 0.172, color: [235, 115, 75], big: false, phase: 5.1 },
  { name: 'Jupiter', r: 0.245, color: [232, 196, 150], big: true, phase: 1.2 },
  { name: 'Saturn', r: 0.315, color: [240, 220, 160], big: true, phase: 4.4 },
  { name: 'Uranus', r: 0.385, color: [160, 232, 240], big: false, phase: 0.1 },
  { name: 'Neptune', r: 0.44, color: [110, 150, 255], big: false, phase: 2.9 },
];
/** 盘和轨道是斜着看的：上下压扁 */
const TILT = 0.32;
/** 示意图里地球的真实半径（轨道半径不按比例）：放大到最后正好是 EARTH_R */
const ZOOM_MAX = 15.6;
const EARTH_TRUE = EARTH_R / 2 ** ZOOM_MAX;

let wx0 = 0;
let wy0 = 0;
/** 第 k 颗行星在 tau 时刻的位置（离太阳越近转得越快） */
function planetAt(k: number, tau: number) {
  const p = PLANETS[k];
  const a = p.phase + tau * 0.9 * (0.135 / p.r) ** 1.5;
  wx0 = p.r * 1.1 * Math.cos(a);
  wy0 = p.r * TILT * Math.sin(a);
}

const orbit = clock();
const swirl = clock();

export function drawSunScene(g: Grid, zz: number) {
  const time = g.reduced ? 0 : g.time;
  const collapse = smooth(1648, 1664, zz);
  const cloudShow = 1 - smooth(1664, 1680, zz);
  const ignite = smooth(1662, 1665, zz);
  const flash = bump(zz, 1662, 1665, 1673);
  const diskShow = smooth(1658, 1670, zz) * (1 - smooth(1690, 1702, zz));
  const rings = smooth(1676, 1686, zz);
  const form = smooth(1682, 1694, zz);
  // 行星转着；镜头要钻向地球之前慢慢停住，免得目标跑掉
  const tau = orbit(g, 1 - smooth(1696, 1702, zz));
  const spin = swirl(g, 1);
  // 镜头：先对准地球，再一路放大
  const aim = smooth(1700, 1708, zz);
  const zoom = smooth(1702, 1714, zz);
  const m = 2 ** (ZOOM_MAX * zoom ** 1.3);
  planetAt(2, tau);
  const camX = wx0 * aim;
  const camY = wy0 * aim;
  const toX = (x: number) => (x - camX) * m;
  const toY = (y: number) => (y - camY) * m;
  const sunX = toX(0);
  const sunY = toY(0);

  // 远处的星：一直在，不动
  for (let k = 0; k < 120; k += 1) {
    const x = (hash1(k * 3 + 1) - 0.5) * g.aspect;
    const y = (hash1(k * 3 + 2) - 0.5) * g.half * 2;
    const v = 0.3 + 0.4 * hash1(k * 3 + 3);
    plot(g, x, y, G.dot, 200 * v, 205 * v, 230 * v);
  }

  // 一团塌缩的气体和尘埃：越往里收转得越快，中间越来越热
  if (cloudShow > 0.02 && m < 1.5) {
    const inner = 0.05 + 0.25 * (1 - collapse);
    for (let y = 0; y < g.rows; y += 1) {
      for (let x = 0; x < g.cols; x += 2) {
        const ax = (g.ox[x] - sunX) / 1.1;
        const ay = g.oy[y] - sunY;
        const r = Math.sqrt(ax * ax + ay * ay);
        const R = r * (1 + 2.2 * collapse);
        if (R > 1.4) continue;
        const theta = Math.atan2(ay, ax) + (1.6 * collapse) / (R + 0.12) + spin * 0.05;
        const X = R * Math.cos(theta);
        const Y = R * Math.sin(theta);
        const d = 0.6 * noise2(X * 4.2 + 11, Y * 4.2 - 3) + 0.4 * noise2(X * 9 - 7, Y * 9 + 5);
        const env = Math.exp(-((R / 0.85) ** 2));
        const dens = clamp01((d - 0.42) * 2.2) * env;
        const heat = Math.exp(-((r / inner) ** 2)) * collapse;
        const v = (dens * (0.5 + 0.8 * heat) + 0.12 * env) * cloudShow;
        if (v < 0.05) continue;
        const red = lerp(120, 255, heat);
        const green = lerp(66, 150, heat);
        const blue = lerp(130, 70, heat);
        for (let c = x; c < Math.min(x + 2, g.cols); c += 1) {
          const i = y * g.cols + c;
          put(g, i, RAMP[Math.min(9, 1 + Math.floor(v * 9))], red * (0.45 + 0.55 * v), green * (0.45 + 0.55 * v), blue * (0.45 + 0.55 * v));
          tint(g, i, BG[0] + red * v * 0.22, BG[1] + green * v * 0.22, BG[2] + blue * v * 0.22);
        }
      }
    }
  }

  // 尘埃盘：斜着看是一个扁扁的椭圆，里面转得快、外面转得慢，所以一条条拉成细纹；后来聚成一圈圈环、再聚成行星
  if (diskShow > 0.02 && m < 1.5) {
    const c0 = Math.max(0, colOf(g, sunX - 0.52 * 1.1));
    const c1 = Math.min(g.cols - 1, colOf(g, sunX + 0.52 * 1.1));
    const r0 = Math.max(0, rowOf(g, sunY + 0.52 * TILT));
    const r1 = Math.min(g.rows - 1, rowOf(g, sunY - 0.52 * TILT));
    for (let row = r0; row <= r1; row += 1) {
      for (let col = c0; col <= c1; col += 1) {
        const dx = (g.ox[col] - sunX) / 1.1;
        const dy = (g.oy[row] - sunY) / TILT;
        const rho = Math.sqrt(dx * dx + dy * dy);
        if (rho < 0.035 || rho > 0.5) continue;
        const phi = Math.atan2(dy, dx) - (spin * 0.35) / rho ** 1.5;
        let v = smooth(0.035, 0.07, rho) * (1 - smooth(0.4, 0.5, rho)) * (0.45 + 0.7 * noise2(rho * 18, Math.cos(phi) * 2.5 + Math.sin(phi) * 1.7));
        if (rings > 0) {
          let ring = 0;
          for (let k = 0; k < PLANETS.length; k += 1) ring = Math.max(ring, Math.exp(-(((rho - PLANETS[k].r) / 0.013) ** 2)));
          v *= 1 - rings + rings * ring * 1.4 * (1 - form * 0.9);
        }
        v *= diskShow;
        if (v < 0.06) continue;
        // 太阳后面那一半被太阳挡住一点
        const behind = dy > 0 && rho < 0.06 ? 0.3 : 1;
        const hot = 1 - smooth(0.05, 0.3, rho);
        const k = v * behind;
        const i = row * g.cols + col;
        put(g, i, k > 0.6 ? G.eq : k > 0.3 ? G.dash : G.dot, lerp(170, 255, hot) * (0.5 + 0.5 * k), lerp(110, 200, hot) * (0.5 + 0.5 * k), lerp(90, 130, hot) * (0.5 + 0.5 * k));
      }
    }
  }

  // 太阳：先是中间一团越来越亮的热气，点着的那一下整屏亮一下
  if (m < 40) {
    const core = clamp01(collapse * 1.4) * (0.4 + 0.6 * ignite);
    const r = (0.012 + 0.012 * ignite) * m;
    if (core > 0.05) {
      const c0 = Math.max(0, colOf(g, sunX - r * 4 * 1.1));
      const c1 = Math.min(g.cols - 1, colOf(g, sunX + r * 4 * 1.1));
      const r0 = Math.max(0, rowOf(g, sunY + r * 4));
      const r1 = Math.min(g.rows - 1, rowOf(g, sunY - r * 4));
      for (let row = r0; row <= r1; row += 1) {
        for (let col = c0; col <= c1; col += 1) {
          const d = Math.hypot((g.ox[col] - sunX) / 1.1, g.oy[row] - sunY) / r;
          const i = row * g.cols + col;
          if (d < 1) {
            put(g, i, G.full, 255 * core, (225 + 25 * ignite) * core, (150 + 60 * ignite) * core);
            tint(g, i, 255 * core, 230 * core, 170 * core);
          } else if (d < 4) glow(g, i, 70 * core * (1 - d / 4), 50 * core * (1 - d / 4), 20 * core * (1 - d / 4));
        }
      }
    }
    if (flash > 0.02) {
      for (let o = 0; o < g.bg.length; o += 4) {
        g.bg[o] = Math.min(255, g.bg[o] + 90 * flash);
        g.bg[o + 1] = Math.min(255, g.bg[o + 1] + 80 * flash);
        g.bg[o + 2] = Math.min(255, g.bg[o + 2] + 50 * flash);
      }
    }
    // 刚点着时上下各喷出一道细细的气流
    const jets = smooth(1660, 1664, zz) * (1 - smooth(1668, 1675, zz));
    if (jets > 0.03) {
      const reach = 0.03 + 0.3 * smooth(1660, 1667, zz);
      const frame = g.reduced ? 0 : Math.floor(time * 10);
      for (const side of [-1, 1]) {
        walk(g, sunX, sunY + side * 0.03, sunX, sunY + side * reach, (i, s) => {
          const v = jets * (1 - s * 0.7) * (0.7 + 0.3 * hash2(i, frame));
          put(g, i, G.pipe, 190 * v, 220 * v, 255 * v);
        });
      }
    }
  }

  // 轨道和行星
  if (form > 0.02) {
    const orbitShow = form * 0.35 * (1 - zoom);
    if (orbitShow > 0.03) PLANETS.forEach((p) => ringAt(g, sunX, sunY, p.r * m, [120 * orbitShow, 130 * orbitShow, 170 * orbitShow], TILT, 2));
    PLANETS.forEach((p, k) => {
      planetAt(k, tau);
      const x = toX(wx0);
      const y = toY(wy0);
      if (k === 2) return;
      if (Math.abs(x) > g.aspect || Math.abs(y) > g.half * 1.5) return;
      const v = form;
      if (p.big) {
        ball(g, x, y, p.color[0] * v, p.color[1] * v, p.color[2] * v);
        if (p.name === 'Saturn') {
          plot(g, x - g.cw * 2.5, y, G.dash, p.color[0] * v, p.color[1] * v, p.color[2] * v);
          plot(g, x + g.cw * 2.5, y, G.dash, p.color[0] * v, p.color[1] * v, p.color[2] * v);
        }
      } else plot(g, x, y, G.disc, p.color[0] * v, p.color[1] * v, p.color[2] * v);
    });
  }

  // 地球：放大到够大了就画成一整颗球（刚形成时是岩浆，时间一跳就成了今天的样子）
  const modern = smooth(1712, 1720, zz);
  planetAt(2, tau);
  const ex = toX(wx0);
  const ey = toY(wy0);
  const R = EARTH_TRUE * m;
  if (form > 0.02 || zz > 1700) {
    if (R < g.ch * 1.2) {
      const v = Math.max(form, smooth(1700, 1702, zz));
      plot(g, ex, ey, G.disc, PLANETS[2].color[0] * v, PLANETS[2].color[1] * v, PLANETS[2].color[2] * v);
    } else drawGlobe(g, ex, ey, R, modern, 1);
  }

  // 标注
  callout(g, -0.3, 0.12, -0.46, 0.26, 'a cloud of gas and dust, light-years across', [200, 160, 220], smooth(1648, 1652, zz) * (1 - smooth(1656, 1660, zz)));
  status(g, 'it collapses, and spins faster as it shrinks', [220, 190, 240], smooth(1654, 1658, zz) * (1 - smooth(1662, 1665, zz)));
  callout(g, sunX, sunY, sunX + 0.18, sunY + 0.16, 'its middle gets hot enough to fuse hydrogen: the Sun', [255, 230, 170], smooth(1665, 1668, zz) * (1 - smooth(1676, 1680, zz)));
  status(g, 'the hydrogen it burns was made in the first three minutes', [255, 230, 170], smooth(1667, 1671, zz) * (1 - smooth(1680, 1684, zz)));
  if (form > 0.5) {
    callout(g, ex, ey, ex - 0.14, ey - 0.16, 'Earth: the third planet out', PLANETS[2].color, smooth(1688, 1692, zz) * (1 - smooth(1700, 1704, zz)));
    planetAt(4, tau);
    callout(g, toX(wx0), toY(wy0), toX(wx0) + 0.14, toY(wy0) + 0.15, 'Jupiter, the biggest', PLANETS[4].color, smooth(1690, 1694, zz) * (1 - smooth(1700, 1704, zz)));
  }
  status(g, 'the iron in your blood was made in stars that blew up before the Sun was born', [255, 200, 190], smooth(1686, 1690, zz) * (1 - smooth(1702, 1706, zz)));
  if (R > 0.1) {
    callout(g, ex + R * 0.7 * 1.1, ey + R * 0.5, ex + R * 1.1 + 0.08, ey + R * 0.7, 'young Earth: a ball of molten rock', LAVA, smooth(1710, 1712, zz) * (1 - smooth(1714, 1717, zz)));
    const [ux, uy] = youOnGlobe();
    const here = smooth(1716, 1720, zz);
    if (here > 0.03) {
      const px = ex + ux * R * 1.1;
      const py = ey + uy * R;
      plot(g, px, py, G.ring, PINK[0] * here, PINK[1] * here, PINK[2] * here);
      callout(g, px, py, px - 0.2, py + 0.16, 'you are here', PINK, here);
    }
  }
}
