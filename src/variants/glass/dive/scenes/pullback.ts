// 从「你」一路拉远到宇宙网：地球 → 月球 → 太阳和行星（按真实比例）→ 最近的恒星 → 银河系 → 本星系群（仙女座）→ 宇宙网。
// 镜头一直对着你；读数又翻回 SCALE，这回越来越大。到了宇宙网，暴胀那张坐标纸又出现，越拉越快：暗能量。
// 最后一眼的宇宙网，就是普朗克尺度那片泡沫的样子。

import { G } from '../charset';
import { hash1, hash3, plot, smooth, type Grid } from '../grid';
import { callout, legend, status, type Rgb } from '../notes';
import { reachAt } from '../timeline';
import { drawWebAt, homeSpot, wallAt } from './cosmos';
import { drawSpiral, sunOffset } from './galaxies';
import { PINK, drawSpread, glow, ringAt } from './shapes';
import { drawGlobe, youOnGlobe } from './sun';

const AU = 1.496e11;
/** 太阳、月球、最近那颗星在地球的哪个方向（屏幕上） */
const SUN_DIR: [number, number] = [-0.94, 0.34];
const MOON_DIR: [number, number] = [0.8, 0.6];
const PROXIMA: [number, number] = [0.87, 0.49];
/** 行星的轨道半径（天文单位）和颜色；地球那条正好穿过屏幕中间 */
const ORBITS: [number, Rgb][] = [
  [0.387, [175, 168, 160]],
  [0.723, [240, 214, 160]],
  [1, [100, 170, 255]],
  [1.524, [235, 115, 75]],
  [5.2, [232, 196, 150]],
  [9.54, [240, 220, 160]],
  [19.2, [160, 232, 240]],
  [30.1, [110, 150, 255]],
];
const STAR_TONES: Rgb[] = [
  [255, 250, 240],
  [255, 225, 170],
  [255, 180, 140],
  [190, 210, 255],
];
const GALAXY: Rgb = [165, 180, 255];

/** 太阳周围的恒星：一层层的星，越拉越密的时候换更稀的一层接上（典型的星间距几光年） */
function drawStarfield(g: Grid, fov: number, show: number) {
  const base = 2.6e16;
  const lo = Math.ceil(Math.log2((0.03 * fov) / base));
  for (let level = lo; level <= lo + 3; level += 1) {
    const s = (base * 2 ** level) / fov;
    const w = smooth(0.03, 0.06, s) * (1 - smooth(0.25, 0.4, s)) * show;
    if (w < 0.03) continue;
    const nx = Math.ceil(g.aspect / 2 / (s * 1.1)) + 1;
    const ny = Math.ceil(g.half / s) + 1;
    for (let j = -ny; j <= ny; j += 1) {
      for (let i = -nx; i <= nx; i += 1) {
        if (i === 0 && j === 0) continue;
        const x = (i + (hash3(i, j, level) - 0.5) * 0.9) * s * 1.1;
        const y = (j + (hash3(j, i, level + 50) - 0.5) * 0.9) * s;
        const b = hash3(i + 3, j, level);
        const v = w * (0.35 + 0.65 * b * b);
        const tone = STAR_TONES[(hash3(i, j + 9, level) * 4) | 0];
        plot(g, x, y, b > 0.92 ? G.star : G.dot, tone[0] * v, tone[1] * v, tone[2] * v);
      }
    }
  }
}

export function drawPullback(g: Grid, zz: number) {
  const L = reachAt(zz);
  const per = 1 / 10 ** L;
  const [hx, hy] = homeSpot(g);

  // 宇宙网垫在最底下：z = 0 是最后那一眼；离得越近放得越大
  const webShow = smooth(22.8, 23.8, L);
  if (webShow > 0.02) drawWebAt(g, Math.max(0, (25 - L) * Math.log2(10)), hx, hy, webShow, smooth(24.4, 25, L), 0);

  // 银河系（太阳在屏幕正中，星系中心在旁边）和本星系群
  const mwSize = 4.7e20 * per;
  const rot = 0.9;
  const tilt = 0.9;
  const [sx, sy] = sunOffset(mwSize, rot, tilt);
  const mwX = -sx;
  const mwY = -sy;
  const group = smooth(21.4, 22, L) * (1 - smooth(23.2, 23.8, L));
  const ax = mwX + 0.78 * 2.4e22 * per * 1.1;
  const ay = mwY + 0.62 * 2.4e22 * per;
  if (group > 0.02) {
    drawSpiral(g, ax, ay, 1.0e21 * per, 0.6, 0.33, group, 0);
    drawSpiral(g, ax + 0.35 * 0.75e22 * per * 1.1, ay - 0.6 * 0.75e22 * per, 2.8e20 * per, 2.0, 0.7, group * 0.8, 0);
    for (let k = 0; k < 16; k += 1) {
      const around = k % 2 === 0;
      const a = hash1(k * 5 + 1) * Math.PI * 2;
      const r = (0.6 + 2.4 * hash1(k * 5 + 2)) * 1e21 * per;
      plot(g, (around ? mwX : ax) + Math.cos(a) * r * 1.1, (around ? mwY : ay) + Math.sin(a) * r, G.dot, 190 * group, 190 * group, 220 * group);
    }
  }
  const mwShow = smooth(19.2, 20, L) * (1 - smooth(22.8, 23.6, L));
  if (mwShow > 0.02) drawSpiral(g, mwX, mwY, mwSize, rot, tilt, mwShow, 0.6);

  // 还在太阳系里的时候，远处的星就是一张不动的背景（离得太远，拉这么一点看不出它们在动）
  const backdrop = 0.45 * (1 - smooth(14, 15, L));
  if (backdrop > 0.02) {
    for (let k = 0; k < 160; k += 1) {
      const x = (hash1(k * 3 + 11) - 0.5) * g.aspect;
      const y = (hash1(k * 3 + 12) - 0.5) * g.half * 2;
      const v = backdrop * (0.4 + 0.6 * hash1(k * 3 + 13));
      const tone = STAR_TONES[k % 4];
      plot(g, x, y, G.dot, tone[0] * v, tone[1] * v, tone[2] * v);
    }
  }
  // 太阳周围的恒星
  const stars = smooth(14, 15, L) * (1 - smooth(19.6, 20.4, L));
  if (stars > 0.02) drawStarfield(g, 10 ** L, stars);
  const px = PROXIMA[0] * 4.0e16 * per * 1.1;
  const py = PROXIMA[1] * 4.0e16 * per;
  const near = smooth(15.6, 16.2, L) * (1 - smooth(18, 18.6, L));
  if (near > 0.02) plot(g, px, py, G.star, 255 * near, 190 * near, 150 * near);

  // 太阳和行星（按真实比例：地球那条轨道正好穿过屏幕中间）
  const solar = smooth(10.6, 11.4, L) * (1 - smooth(15.4, 16.2, L));
  const sunX = SUN_DIR[0] * AU * per * 1.1;
  const sunY = SUN_DIR[1] * AU * per;
  if (solar > 0.02) {
    ORBITS.forEach(([a, tone], k) => {
      const r = a * AU * per;
      if (r < 0.008 || r > 2) return;
      const v = solar * 0.4 * (1 - smooth(0.6, 2, r));
      ringAt(g, sunX, sunY, r, [tone[0] * v, tone[1] * v, tone[2] * v], 1, 2);
      if (k === 2) return;
      const angle = hash1(k * 7 + 2) * Math.PI * 2;
      plot(g, sunX + Math.cos(angle) * r * 1.1, sunY + Math.sin(angle) * r, G.disc, tone[0] * solar, tone[1] * solar, tone[2] * solar);
    });
    plot(g, sunX, sunY, G.at, 255 * solar, 236 * solar, 170 * solar);
  }

  // 月球
  const moon = smooth(8.0, 8.6, L) * (1 - smooth(9.8, 10.4, L));
  const mx = MOON_DIR[0] * 3.844e8 * per * 1.1;
  const my = MOON_DIR[1] * 3.844e8 * per;
  if (moon > 0.02) {
    ringAt(g, 0, 0, 3.844e8 * per, [90 * moon, 90 * moon, 110 * moon], 1, 3);
    plot(g, mx, my, G.disc, 210 * moon, 210 * moon, 215 * moon);
  }

  // 地球，和地球上的你
  const R = 6.371e6 * per;
  const earth = 1 - smooth(8.8, 9.4, L);
  if (earth > 0.02) drawGlobe(g, 0, 0, R, 1, earth);
  const [ux, uy] = youOnGlobe();
  if (R > 0.03) plot(g, ux * R * 1.1, uy * R, G.ring, PINK[0], PINK[1], PINK[2]);
  else {
    plot(g, 0, 0, G.ring, PINK[0], PINK[1], PINK[2]);
    glow(g, Math.floor(g.rows / 2) * g.cols + Math.floor(g.cols / 2), 40, 10, 24);
  }

  // 一路上的标注
  callout(g, R * 1.1, R * 0.3, R * 1.1 + 0.14, R * 0.3 + 0.14, 'Earth: 12,742 km across', [140, 190, 255], smooth(1726, 1729, zz) * (1 - smooth(7.9, 8.3, L)));
  callout(g, mx, my, mx + 0.14, my + 0.12, 'the Moon: 1.3 light-seconds away', [215, 215, 225], smooth(8.7, 8.9, L) * (1 - smooth(9.5, 9.8, L)));
  callout(g, sunX, sunY, sunX - 0.1, sunY + 0.16, 'the Sun: 8 light-minutes away', [255, 236, 170], smooth(11.2, 11.5, L) * (1 - smooth(12.2, 12.5, L)));
  const nep = 30.1 * AU * per;
  const nepA = hash1(7 * 7 + 2) * Math.PI * 2;
  callout(g, sunX + Math.cos(nepA) * nep * 1.1, sunY + Math.sin(nepA) * nep, sunX + Math.cos(nepA) * nep * 1.1 + 0.12, sunY + Math.sin(nepA) * nep + 0.14, 'Neptune, the last planet: 4 light-hours out', ORBITS[7][1], smooth(12.9, 13.2, L) * (1 - smooth(13.7, 14, L)));
  callout(g, px, py, px + 0.12, py + 0.13, 'the nearest star: 4.2 light-years away', [255, 200, 170], smooth(16.4, 16.7, L) * (1 - smooth(17.4, 17.7, L)));
  callout(g, mwX, mwY, mwX + 0.16, mwY - 0.16, 'the Milky Way: 100,000 light-years across', [255, 226, 175], smooth(20.4, 20.7, L) * (1 - smooth(21.5, 21.8, L)));
  callout(g, ax, ay, ax - 0.16, ay + 0.14, 'Andromeda: 2.5 million light-years away, heading our way', [200, 210, 255], smooth(22.1, 22.4, L) * (1 - smooth(23.0, 23.3, L)));

  // 暗能量：暴胀那张坐标纸又出现了，这次拉得很慢，但越拉越快
  const stretch = Math.max(0, zz - 1802);
  const grid = smooth(1802, 1808, zz) * (1 - smooth(1826, 1834, zz));
  drawSpread(g, 0.06 * stretch + 0.0035 * stretch * stretch, grid);
  status(g, 'it took over about 4 billion years ago', [200, 210, 255], smooth(1806, 1810, zz) * (1 - smooth(1826, 1832, zz)));

  // 最后一眼
  const end = smooth(1834, 1842, zz);
  if (end < 0.03) return;
  legend(g, [[G.mid, GALAXY, 'each dot: a galaxy']], end);
  callout(g, 0, 0, 0.16, -0.16, 'you are here (roughly)', PINK, end);
  // 左边找一条最亮的墙，右边找一块最空的地方
  const reach = Math.min(0.42 * g.aspect, 0.75);
  let thread: [number, number] | null = null;
  let empty: [number, number] | null = null;
  let best = -1;
  let low = 2;
  for (let j = -4; j <= 4; j += 1) {
    for (let n = -9; n <= 9; n += 1) {
      const x = (n / 9) * reach;
      const y = (j / 4) * 0.3;
      const v = wallAt(g, x, y);
      if (x < -reach * 0.35 && Math.abs(y) < 0.16 && v > best) {
        best = v;
        thread = [x, y];
      }
      if (x > reach * 0.35 && Math.abs(y) < 0.2 && v < low) {
        low = v;
        empty = [x, y];
      }
    }
  }
  if (thread) callout(g, thread[0], thread[1], thread[0] + 0.08, thread[1] + 0.2, 'a filament: galaxies strung along it', GALAXY, end);
  if (empty) callout(g, empty[0], empty[1], empty[0] - 0.06, empty[1] + 0.2, 'a void: almost empty', [200, 190, 240], end);
  status(g, 'look familiar?', [255, 190, 215], smooth(1846, 1854, zz));
}
