// 芯片里面：裸片 → 金属互连层 → 标准单元（逻辑门） → 一个晶体管（剖面） → 硅晶格。
// 每个场景按读数（timeline 的 SCALE_KEYS）定视野，镜头对准一个固定的点放大。

import { G, RAMP } from '../charset';
import { fbm2, hash1, hash2, hash3, noise2, put, smooth, threshold, tint, walk, type Grid } from '../grid';
import { INK, callout, legend, note, status } from '../notes';
import { interpolate, logScaleAt } from '../timeline';

/** 视野高度换成场景自己的单位（unit = 一个单位多少米） */
const fovIn = (zz: number, unit: number) => 10 ** logScaleAt(zz) / unit;

/* ====================== 裸片 ====================== */

type Block = { name: string; kind: 'core' | 'sram' | 'gpu' | 'dream' | 'io'; x0: number; y0: number; x1: number; y1: number };
/** 整块裸片的平面图（毫米，中心为原点，边长 10）：四个核心、三级缓存、GPU、I/O，四周一圈焊盘 */
const DIE: Block[] = [
  { name: 'CORE 0', kind: 'core', x0: -4.3, y0: 2.3, x1: -2.25, y1: 4.3 },
  { name: 'CORE 1', kind: 'core', x0: -2.15, y0: 2.3, x1: -0.1, y1: 4.3 },
  { name: 'CORE 2', kind: 'core', x0: -4.3, y0: 0.2, x1: -2.25, y1: 2.2 },
  { name: 'CORE 3', kind: 'core', x0: -2.15, y0: 0.2, x1: -0.1, y1: 2.2 },
  { name: 'L3 CACHE', kind: 'sram', x0: 0.1, y0: 1.6, x1: 4.3, y1: 4.3 },
  { name: 'GPU', kind: 'gpu', x0: -4.3, y0: -4.3, x1: 1.4, y1: 0 },
  { name: 'DREAM ENGINE', kind: 'dream', x0: 1.6, y0: -1.6, x1: 4.3, y1: 1.4 },
  { name: 'I/O', kind: 'io', x0: 1.6, y0: -4.3, x1: 4.3, y1: -1.8 },
];
/** 镜头最后钻进去的地方：1 号核心里的一片逻辑电路 */
const DIE_T = { x: -0.8, y: 3.25 };
/** 先让整块裸片在屏幕上多待一会儿（只慢慢推近一点），再一路放大进去 */
const DIE_KEYS: [number, number][] = [
  [380, Math.log10(12)],
  [392, Math.log10(9)],
  [440, Math.log10(0.05)],
];

/** SRAM：一格一格的子阵列，中间夹着译码器、灵敏放大器；够近了能看见一个个存储单元 */
function sramCell(g: Grid, i: number, wx: number, wy: number, fp: number, film: number) {
  const fx = wx / 0.12 - Math.floor(wx / 0.12);
  const fy = wy / 0.08 - Math.floor(wy / 0.08);
  if (fp < 0.03 && (fx < 0.06 || fy < 0.08)) {
    put(g, i, G.eq, 190 * film, 170 * film, 110 * film);
    tint(g, i, 60, 52, 30);
  } else if (fp < 0.0005) {
    const bx = wx / 0.0006 - Math.floor(wx / 0.0006);
    const by = wy / 0.0003 - Math.floor(wy / 0.0003);
    put(g, i, bx < 0.3 || by < 0.35 ? G.plus : G.dot, 170 * film, 140 * film, 255 * film);
    tint(g, i, 46, 36, 90);
  } else {
    put(g, i, G.medium, 140 * film, 112 * film, 230 * film);
    tint(g, i, 40, 32, 80);
  }
}

/** 随机逻辑：斑斑驳驳；放大以后能看出一截截走线 */
function logicCell(g: Grid, i: number, wx: number, wy: number, fp: number, film: number, r: number, gr: number, b: number) {
  if (fp < 0.002) {
    const row = Math.floor(wy / 0.0012);
    const along = wx / 0.0009 + hash1(row) * 7;
    const seg = Math.floor(along);
    const fy = wy / 0.0012 - row;
    if (hash3(row, seg, 5) < 0.55 && fy > 0.35 && fy < 0.65) {
      put(g, i, G.h, 225, 150, 90);
      tint(g, i, 50, 34, 20);
      return;
    }
    if (hash3(seg, row, 9) < 0.18 && Math.abs(along - seg - 0.5) < 0.12) {
      put(g, i, G.v, 200, 130, 80);
      return;
    }
  }
  const v = 0.35 + fbm2(wx * 60, wy * 60, 3) * 0.7;
  put(g, i, RAMP[Math.min(9, Math.floor(v * 7) + 1)], r * film * v, gr * film * v, b * film * v);
  tint(g, i, r * 0.2 * film, gr * 0.2 * film, b * 0.2 * film);
}

export function drawDie(g: Grid, zz: number) {
  const fov = 10 ** interpolate(DIE_KEYS, zz);
  const fp = g.ch * fov;
  // 先看整块裸片，再朝 1 号核心里推过去
  const aim = smooth(391, 408, zz);
  const cx = DIE_T.x * aim;
  const cy = DIE_T.y * aim;
  // 顶层的电源网格：够近才看得见；再近到它比好几格还宽，就当镜头已经钻到它下面去了
  const grid = smooth(0.05, 0.02, fp) * (1 - smooth(2.5, 7, 0.006 / fp));
  for (let y = 0; y < g.rows; y += 1) {
    const wy = cy + g.oy[y] * fov;
    for (let x = 0; x < g.cols; x += 1) {
      const wx = cx + g.ox[x] * fov;
      const i = y * g.cols + x;
      const ax = Math.abs(wx);
      const ay = Math.abs(wy);
      if (ax > 5 || ay > 5) {
        // 裸片外面：封装里的底填料，暗暗的
        if (hash2(Math.floor(wx * 3), Math.floor(wy * 3)) < 0.1) put(g, i, G.dot, 46, 44, 60);
        continue;
      }
      const film = 0.82 + 0.32 * noise2(wx * 2.6 + 3, wy * 2.6);
      if (ax > 4.6 || ay > 4.6) {
        // 四周一圈焊盘
        const along = (ax > 4.6 ? wy : wx) / 0.42;
        const pad = Math.abs(along - Math.round(along)) < 0.3 && Math.max(ax, ay) < 4.92 && Math.min(ax, ay) < 4.6;
        if (pad) {
          put(g, i, G.full, 236, 200, 110);
          tint(g, i, 90, 70, 30);
        } else tint(g, i, 26, 22, 38);
        continue;
      }
      if (grid > 0.02) {
        const px = Math.abs(wx / 0.1 - Math.round(wx / 0.1)) * 0.1;
        const py = Math.abs(wy / 0.1 - Math.round(wy / 0.1)) * 0.1;
        if ((px < 0.003 + fp * 0.3 || py < 0.003 + fp * 0.3) && threshold(x, y) < grid) {
          put(g, i, px < py ? G.v : G.h, 236, 196, 104);
          tint(g, i, 70, 56, 24);
          continue;
        }
      }
      let block: Block | null = null;
      for (const candidate of DIE) {
        if (wx >= candidate.x0 && wx < candidate.x1 && wy >= candidate.y0 && wy < candidate.y1) {
          block = candidate;
          break;
        }
      }
      if (!block) {
        // 区块之间的走线通道
        if (hash2(Math.floor(wx * 900), Math.floor(wy * 900)) < 0.2) put(g, i, G.dot, 70, 60, 90);
        tint(g, i, 20, 16, 30);
        continue;
      }
      const u = (wx - block.x0) / (block.x1 - block.x0);
      const v = (wy - block.y0) / (block.y1 - block.y0);
      if (block.kind === 'sram') sramCell(g, i, wx, wy, fp, film);
      else if (block.kind === 'core') {
        // 一个核心：左边一条一、二级缓存，底下一条数据通路，其余是逻辑
        if (u < 0.3) sramCell(g, i, wx, wy, fp, film);
        else if (v < 0.22) {
          const stripe = Math.floor(wy / 0.01);
          const k = stripe % 2 === 0 ? 1 : 0.7;
          put(g, i, Math.abs(wx / 0.05 - Math.round(wx / 0.05)) < 0.04 ? G.v : stripe % 2 === 0 ? G.dash : G.eq, 70 * film * k, 190 * film * k, 190 * film * k);
          tint(g, i, 16, 46, 48);
        } else logicCell(g, i, wx, wy, fp, film, 150, 175, 90);
      } else if (block.kind === 'gpu') {
        // GPU：一大片一模一样的小单元
        const tx = wx / 0.45 - Math.floor(wx / 0.45);
        const ty = wy / 0.45 - Math.floor(wy / 0.45);
        if (tx < 0.08 || ty < 0.08) tint(g, i, 30, 20, 14);
        else logicCell(g, i, wx, wy, fp, film, 240, 160, 80);
      } else if (block.kind === 'dream') logicCell(g, i, wx, wy, fp, film, 250, 130, 180);
      else {
        // I/O：粗粗的几块模拟电路
        const tx = wx / 0.6 - Math.floor(wx / 0.6);
        const ty = wy / 0.5 - Math.floor(wy / 0.5);
        const body = tx > 0.12 && tx < 0.88 && ty > 0.15 && ty < 0.85;
        put(g, i, body ? G.hash : G.dot, 130 * film, 150 * film, 205 * film);
        tint(g, i, body ? 30 : 16, body ? 36 : 18, body ? 60 : 32);
      }
    }
  }
  // 每一块写上名字（放得下才写）
  const names = 1 - smooth(1.2, 0.5, fov);
  if (names > 0.02) {
    DIE.forEach((block) => {
      const wide = (block.x1 - block.x0) / (fp * (g.cw / g.ch));
      const tall = (block.y1 - block.y0) / fp;
      if (wide < block.name.length + 2 || tall < 3) return;
      note(g, ((block.x0 + block.x1) / 2 - cx) / fov, ((block.y0 + block.y1) / 2 - cy) / fov, block.name, INK, 0.5, names);
    });
  }
}

/* ====================== 金属互连层 ====================== */

const METAL = [6, 3, 1.4, 0.7, 0.32, 0.16];

export function drawMetal(g: Grid, zz: number) {
  const fov = fovIn(zz, 1e-6);
  const fp = g.ch * fov;
  const alphas = METAL.map((pitch) => smooth(1.4, 3, pitch / fp) * (1 - smooth(0.22, 0.55, pitch / fov)));
  for (let y = 0; y < g.rows; y += 1) {
    const wy = g.oy[y] * fov + 0.37;
    for (let x = 0; x < g.cols; x += 1) {
      const wx = g.ox[x] * fov - 0.21;
      const i = y * g.cols + x;
      const th = threshold(x, y);
      let done = false;
      for (let k = 0; k < METAL.length; k += 1) {
        const alpha = alphas[k];
        if (alpha <= th) continue;
        const pitch = METAL[k];
        const horizontal = k % 2 === 0;
        const across = (horizontal ? wy : wx) / pitch;
        const along = (horizontal ? wx : wy) / pitch;
        const track = Math.floor(across);
        const f = across - track;
        if (Math.abs(f - 0.5) > 0.23) continue;
        const length = 3 + 9 * hash2(k * 31 + track, 7);
        const s = along / length + hash2(track, k);
        const seg = Math.floor(s);
        const sf = s - seg;
        if (hash3(k, track, seg) > 0.74 || sf < 0.02 || sf > 0.98) continue;
        const shade = 1 - k * 0.12;
        const wide = (pitch * 0.46) / fp;
        // 线段两头：上下两层之间的通孔
        const via = (sf < 0.05 || sf > 0.95) && Math.abs(f - 0.5) < 0.12;
        if (via) {
          put(g, i, wide > 2 ? G.full : G.square, 255, 228, 160);
        } else if (wide >= 2) {
          const edge = Math.abs(f - 0.5) > 0.17;
          put(g, i, edge ? G.dark : G.full, 228 * shade, 152 * shade, 92 * shade);
        } else {
          put(g, i, horizontal ? G.h : G.v, 232 * shade, 158 * shade, 96 * shade);
        }
        tint(g, i, 60 * shade, 36 * shade, 22 * shade);
        done = true;
        break;
      }
      if (!done) {
        // 层与层之间的介电层：深紫，零星几个点
        tint(g, i, 16, 12, 28);
        if (hash2(Math.floor(wx / fp), Math.floor(wy / fp)) < 0.04) put(g, i, G.dot, 60, 50, 100);
      }
    }
  }
  // 最上面那两层够粗的线上写上是第几层金属（M8 在最上面，越往下线越细）
  let named = 0;
  for (let k = 0; k < METAL.length && named < 2; k += 1) {
    const pitch = METAL[k];
    if (alphas[k] < 0.6 || (pitch * 0.46) / fp < 2.4) continue;
    named += 1;
    const horizontal = k % 2 === 0;
    const offset = horizontal ? 0.37 : -0.21;
    const reach = (horizontal ? g.half : g.aspect / 2) * fov;
    for (let track = Math.floor((offset - reach) / pitch); track <= Math.ceil((offset + reach) / pitch); track += 1) {
      const across = ((track + 0.5) * pitch - offset) / fov;
      const along = (hash2(track, k + 40) - 0.5) * (horizontal ? g.aspect : g.half * 2) * 0.7;
      const sx = horizontal ? along : across;
      const sy = horizontal ? across : along;
      const col = Math.floor((sx + g.aspect / 2) / g.cw);
      const row = Math.floor((g.half - sy) / g.ch);
      if (col < 1 || row < 1 || col >= g.cols - 3 || row >= g.rows - 1) continue;
      const glyph = g.fg[(row * g.cols + col) * 4 + 3];
      if (glyph === G.full || glyph === G.dark) note(g, sx, sy, `M${8 - k}`, [255, 226, 170], 0);
    }
  }
  legend(g, [
    [G.full, [228, 152, 92], 'copper wire'],
    [G.square, [255, 228, 160], 'via: links two layers'],
  ]);
}

/* ====================== 标准单元 ====================== */

const CPP = 48;
const ROW = 240;
const CELLS: [string, number][] = [
  ['INV', 3],
  ['NAND2', 4],
  ['NOR2', 4],
  ['AOI21', 6],
  ['BUF', 4],
  ['XOR2', 8],
  ['DFF', 19],
  ['NAND3', 5],
  ['FILL', 1],
];
type Placed = { name: string; x0: number; width: number };
const rowCache = new Map<number, Placed[]>();

function rowCells(row: number) {
  let cells = rowCache.get(row);
  if (cells) return cells;
  cells = [];
  let x = -120 * CPP + Math.floor(hash1(row * 13) * 6) * CPP;
  let n = 0;
  while (x < 120 * CPP) {
    const [name, width] = CELLS[Math.floor(hash2(row, n) * CELLS.length)];
    cells.push({ name, x0: x, width: width * CPP });
    x += width * CPP;
    n += 1;
  }
  rowCache.set(row, cells);
  return cells;
}

function cellAt(cells: Placed[], x: number) {
  let lo = 0;
  let hi = cells.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cells[mid].x0 <= x) lo = mid;
    else hi = mid - 1;
  }
  return cells[lo];
}

/** 镜头最后对准：0 行里第一个 NAND2 的第一根栅极，压在 NMOS 有源区上的地方 */
const CELL_T = (() => {
  const nand = rowCells(0).find((cell) => cell.name === 'NAND2' && cell.x0 > -600) ?? rowCells(0)[0];
  return { x: nand.x0 + CPP * 1.5, y: 67 };
})();

export function drawCells(g: Grid, zz: number) {
  const fov = fovIn(zz, 1e-9);
  const fp = g.ch * fov;
  for (let y = 0; y < g.rows; y += 1) {
    const wy = CELL_T.y + g.oy[y] * fov;
    const row = Math.floor(wy / ROW);
    const cells = rowCells(row);
    let v = wy - row * ROW;
    if (row % 2 !== 0) v = ROW - v;
    for (let x = 0; x < g.cols; x += 1) {
      const wx = CELL_T.x + g.ox[x] * fov;
      const i = y * g.cols + x;
      const cell = cellAt(cells, wx);
      const u = wx - cell.x0;
      const slot = u / CPP;
      const near = Math.abs(slot - Math.round(slot)) * CPP;
      // 上下的电源轨（M1，蓝）
      if (v < 16 || v > ROW - 16) {
        put(g, i, fp > 12 ? G.full : G.hh, 96, 128, 245);
        tint(g, i, 24, 30, 70);
        continue;
      }
      // 单元边界：一圈虚线
      if (u < fp * 0.8 && Math.floor(wy / Math.max(fp * 2, 6)) % 2 === 0) {
        put(g, i, G.mid, 110, 96, 160);
        continue;
      }
      const gate = cell.name !== 'FILL' && Math.abs(slot - Math.floor(slot) - 0.5) * CPP < 8 && v > 26 && v < ROW - 26;
      const pmos = v > 138 && v < 205;
      const nmos = v > 35 && v < 102;
      if (gate) {
        put(g, i, fp > 6 ? G.full : G.v, 236, 78, 78);
        tint(g, i, 70, 20, 20);
        continue;
      }
      // 源漏上的接触孔（栅极之间）
      if ((pmos || nmos) && near < 9 && Math.abs(v - (pmos ? 171 : 68)) < 9 && cell.name !== 'FILL') {
        put(g, i, G.square, 230, 232, 240);
        tint(g, i, 50, 60, 70);
        continue;
      }
      // M1 局部连线：输出那一竖
      if (cell.width >= CPP * 3 && Math.abs(u - (cell.width - CPP)) < 7 && v > 60 && v < 180) {
        put(g, i, fp > 6 ? G.full : G.v, 120, 170, 255);
        continue;
      }
      if (pmos || nmos) {
        put(g, i, G.medium, 70, 200, 110);
        tint(g, i, 16, 48, 28);
        continue;
      }
      if (hash2(Math.floor(wx / 6), Math.floor(wy / 6)) < 0.05) put(g, i, G.dot, 70, 60, 110);
    }
  }
  // 单元名字：放得下才写
  const rowsTall = ROW / fp;
  if (rowsTall > 6) {
    const top = CELL_T.y + fov * (g.half + 0.05);
    const bottom = CELL_T.y - fov * (g.half + 0.05);
    for (let row = Math.floor(bottom / ROW); row <= Math.floor(top / ROW); row += 1) {
      rowCells(row).forEach((cell) => {
        if (cell.name === 'FILL' || cell.width / fp / (g.cw / g.ch) < cell.name.length + 3) return;
        const sx = (cell.x0 + cell.width / 2 - CELL_T.x) / fov;
        if (Math.abs(sx) > g.aspect / 2 + 0.2) return;
        const sy = (row * ROW + ROW / 2 - CELL_T.y) / fov;
        note(g, sx, sy, cell.name, [240, 236, 255]);
      });
    }
    // 电源轨：一条接电源、一条接地，交替着来
    for (let rail = Math.floor(bottom / ROW); rail <= Math.ceil(top / ROW); rail += 1) {
      note(g, -g.aspect / 2 + 0.16, (rail * ROW - CELL_T.y) / fov, rail % 2 === 0 ? 'GND' : 'VDD', [190, 205, 255], 0);
    }
  }
  legend(g, [
    [G.full, [236, 78, 78], 'gate (polysilicon)'],
    [G.medium, [70, 200, 110], 'silicon the current flows through'],
    [G.hh, [96, 128, 245], 'metal: power and wiring'],
    [G.square, [230, 232, 240], 'contact'],
  ]);
}

/* ====================== 一个晶体管（GAA 纳米片，剖面） ====================== */

const SHEETS = [-24, -8, 8];

export function drawTransistor(g: Grid, zz: number) {
  const fov = fovIn(zz, 1e-9);
  const fp = g.ch * fov;
  const t = g.reduced ? 0.5 : g.time;
  const on = g.reduced || t % 2.4 < 1.4;
  const cx = 0;
  const cy = -8;
  for (let y = 0; y < g.rows; y += 1) {
    const wy = cy + g.oy[y] * fov;
    for (let x = 0; x < g.cols; x += 1) {
      const wx = cx + g.ox[x] * fov;
      const i = y * g.cols + x;
      const ax = Math.abs(wx);
      // 离最近那片硅的表面有多远（负的 = 在硅里面）
      let surface = 1e9;
      for (let s = 0; s < 3; s += 1) surface = Math.min(surface, Math.abs(wy - SHEETS[s]) - 3);
      const grain = 0.9 + 0.2 * noise2(wx * 0.9, wy * 0.9);
      if (surface < 0 && ax < 24) {
        // 硅片：一格一格的晶格纹理；栅极底下那一段是沟道，通电时泛青
        const channel = ax < 9 && on;
        const dotted = fp < 0.6 && ((Math.floor(wx / 0.7) + Math.floor(wy / 0.7)) & 1) === 0;
        const rim = surface > -0.7;
        const k = grain * (rim ? 1.12 : 1);
        put(g, i, dotted ? G.dark : G.full, (channel ? 120 : 150) * k, (channel ? 226 : 176) * k, (channel ? 250 : 218) * k);
        tint(g, i, channel ? 30 : 50, channel ? 80 : 60, channel ? 96 : 80);
        continue;
      }
      if (ax < 9 && wy > -34 && wy < 20) {
        // 栅极：紧贴硅片一层高 k 绝缘层，外面一层功函数金属，中间才是填进去的金属
        if (surface < 1.5) {
          put(g, i, G.colon, 196, 126, 244);
          tint(g, i, 54, 28, 76);
        } else if (surface < 3 || ax > 7.6 || wy < -32.4) {
          const k = on ? 1.1 : 0.85;
          put(g, i, G.dark, 190 * k, 138 * k, 66 * k);
          tint(g, i, 60 * k, 40 * k, 16 * k);
        } else {
          const k = (on ? 1.1 : 0.8) * (0.92 + 0.08 * Math.sin(wx * 2.2));
          put(g, i, G.full, 240 * k, 198 * k, 96 * k);
          tint(g, i, 84 * k, 64 * k, 24 * k);
        }
        continue;
      }
      if ((ax < 12 && wy > -34 && wy < 14) || (ax < 13 && wy >= 14 && wy < 30)) {
        // 侧墙：把栅极和源漏隔开
        put(g, i, G.medium, 146, 146, 164);
        tint(g, i, 40, 40, 50);
        continue;
      }
      if (ax < 9 && wy >= 20 && wy < 30) {
        put(g, i, G.light, 96, 96, 120);
        continue;
      }
      if (ax < 5.5 && wy >= 30 && wy < 54) {
        // 栅极的接触孔：一圈暗的衬层，里面是银白的金属
        const liner = ax > 4.2 || wy < 31.4;
        put(g, i, liner ? G.dark : G.full, liner ? 96 : 186, liner ? 96 : 188, liner ? 120 : 208);
        continue;
      }
      // 源 / 漏：外延长出来的，顶上是斜面，一道一道的晶面
      if (ax >= 12 && ax < 46 && wy > -34 && wy < 16 - 0.4 * Math.abs(ax - 29)) {
        const facet = 0.86 + 0.14 * Math.sin((ax + wy) * 0.55);
        const depth = 0.78 + 0.22 * smooth(-34, 10, wy);
        const k = grain * facet * depth;
        put(g, i, fp > 1.2 ? G.full : G.dark, 92 * k, 216 * k, 136 * k);
        tint(g, i, 18, 56, 32);
        continue;
      }
      if (ax >= 20 && ax < 37 && wy >= 8 && wy < 54) {
        const liner = ax < 21.3 || ax > 35.7 || wy < 9.4;
        const k = 0.88 + 0.12 * smooth(8, 54, wy);
        put(g, i, liner ? G.dark : G.full, liner ? 96 : 184 * k, liner ? 96 : 186 * k, liner ? 120 : 208 * k);
        continue;
      }
      if (wy <= -34) {
        if (ax < 26 && wy > -46) {
          // 硅片底下的硅基座
          put(g, i, G.dark, 120 * grain, 140 * grain, 180 * grain);
          tint(g, i, 36, 42, 60);
        } else if (wy > -52) {
          // 两边的隔离氧化层
          put(g, i, G.light, 80, 96, 136);
          tint(g, i, 20, 24, 40);
        } else {
          put(g, i, hash2(Math.floor(wx), Math.floor(wy)) < 0.4 ? G.light : G.dot, 96, 106, 140);
          tint(g, i, 24, 26, 40);
        }
        continue;
      }
      if (hash2(Math.floor(wx / 2), Math.floor(wy / 2)) < 0.03) put(g, i, G.dot, 60, 50, 90);
    }
  }
  // 电子：开的时候从源穿过三片硅流到漏
  if (on) {
    for (let s = 0; s < 3; s += 1) {
      for (let p = 0; p < 11; p += 1) {
        const ex = -30 + ((t * 26 + p * 5.5 + s * 2.3) % 60);
        const ey = SHEETS[s] + (hash1(p * 7 + s) - 0.5) * 3.4;
        const sx = (ex - cx) / fov;
        const sy = (ey - cy) / fov;
        walk(g, sx, sy, sx + g.cw, sy, (i) => put(g, i, fp < 0.5 ? G.disc : G.o, 170, 252, 255));
      }
    }
  }
  if (fov > 60) {
    const top = Math.min(g.half - 0.08, (56 - cy) / fov);
    note(g, (-28 - cx) / fov, top, 'SOURCE', [220, 214, 240]);
    note(g, (0 - cx) / fov, top, 'GATE', [255, 210, 120]);
    note(g, (28 - cx) / fov, top, 'DRAIN', [220, 214, 240]);
  }
  if (fov > 34) callout(g, (17 - cx) / fov, (SHEETS[2] - cy) / fov, 0.5, (SHEETS[2] - cy) / fov + 0.2, 'silicon nanosheet', [190, 210, 245]);
  legend(g, [
    [G.full, [240, 198, 96], 'gate: wraps all three sheets'],
    [G.dark, [150, 176, 218], 'silicon sheet (the channel)'],
    [G.full, [92, 216, 136], 'source / drain'],
    [G.colon, [196, 126, 244], 'insulator'],
    [G.o, [170, 252, 255], 'electrons'],
  ]);
  status(g, on ? 'GATE ON: electrons flow from source to drain' : 'GATE OFF: nothing gets through', on ? [150, 248, 255] : [176, 166, 204]);
}

/* ====================== 硅晶格（[110] 方向看过去的「哑铃」） ====================== */

const A = 0.543;
const AX = A / Math.SQRT2;
const DUMB = 0.068;
const ATOM_R = 0.058;

/** 原子热振动：64 组偏移，每帧算一次，按原子编号取 */
const JIGGLE_X = new Float32Array(64);
const JIGGLE_Y = new Float32Array(64);
/** 化学键：相对哑铃中心的三根（哑铃里上下那根、上面那个原子往斜上方两根） */
const BONDS = [
  [0, -DUMB, 0, DUMB],
  [0, DUMB, -AX / 2, A / 2 - DUMB],
  [0, DUMB, AX / 2, A / 2 - DUMB],
];

export function drawLattice(g: Grid, zz: number) {
  const fov = fovIn(zz, 1e-9);
  const fp = g.ch * fov;
  const t = g.reduced ? 0 : g.time;
  const detail = smooth(2, 4.5, AX / fp);
  const cx = 0;
  const cy = DUMB;
  for (let n = 0; n < 64; n += 1) {
    JIGGLE_X[n] = 0.008 * Math.sin(t * 9 + n);
    JIGGLE_Y[n] = 0.008 * Math.cos(t * 7.3 + n * 1.7);
  }
  const reach = 0.012 + fp * 0.4;
  for (let y = 0; y < g.rows; y += 1) {
    const wy = cy + g.oy[y] * fov;
    for (let x = 0; x < g.cols; x += 1) {
      const wx = cx + g.ox[x] * fov;
      const i = y * g.cols + x;
      if (detail < threshold(x, y)) {
        // 太远了，原子挤成一片：只是一层带一点纹理的硅
        const v = 0.55 + 0.25 * Math.sin(wx * 16) * Math.sin(wy * 11);
        put(g, i, v > 0.6 ? G.dark : G.medium, 150 * v + 40, 176 * v + 40, 218 * v + 30);
        tint(g, i, 40, 46, 64);
        continue;
      }
      // 两套子格子里离这一格最近的 2×2 个哑铃：它们的原子和化学键
      let best = 1e9;
      let bx = 0;
      let by = 0;
      let bond = 1e9;
      let bondDx = 0;
      let bondDy = 0;
      for (let sub = 0; sub < 2; sub += 1) {
        const ox = sub * AX * 0.5;
        const oy = sub * A * 0.5;
        const i0 = Math.floor((wx - ox) / AX);
        const j0 = Math.floor((wy - oy) / A);
        for (let j = j0; j <= j0 + 1; j += 1) {
          for (let k = i0; k <= i0 + 1; k += 1) {
            const dx0 = k * AX + ox;
            const dy0 = j * A + oy;
            for (let s = -1; s <= 1; s += 2) {
              const seed = ((k * 7 + j * 13 + sub * 5) * 2 + s) & 63;
              const ex = wx - dx0 - JIGGLE_X[seed];
              const ey = wy - dy0 - s * DUMB - JIGGLE_Y[seed];
              const d = ex * ex + ey * ey;
              if (d < best) {
                best = d;
                bx = wx - ex;
                by = wy - ey;
              }
            }
            for (let b = 0; b < 3; b += 1) {
              const x0 = dx0 + BONDS[b][0];
              const y0 = dy0 + BONDS[b][1];
              const ex = BONDS[b][2] - BONDS[b][0];
              const ey = BONDS[b][3] - BONDS[b][1];
              const h = Math.max(0, Math.min(1, ((wx - x0) * ex + (wy - y0) * ey) / (ex * ex + ey * ey)));
              const qx = wx - x0 - ex * h;
              const qy = wy - y0 - ey * h;
              const d = qx * qx + qy * qy;
              if (d < bond) {
                bond = d;
                bondDx = ex;
                bondDy = ey;
              }
            }
          }
        }
      }
      best = Math.sqrt(best);
      bond = Math.sqrt(bond);
      if (best < ATOM_R) {
        // 小球：按法线打光，左上亮
        const nz = Math.sqrt(1 - (best / ATOM_R) ** 2);
        const light = Math.max(0, ((bx - wx) * 0.6 + (wy - by) * 0.6) / ATOM_R + nz * 0.8);
        const v = 0.25 + 0.75 * Math.min(1, light);
        put(g, i, RAMP[Math.min(9, 2 + Math.floor(v * 8))], 150 + 105 * v * v, 176 + 79 * v * v, 220 + 35 * v);
        tint(g, i, 60 * v, 70 * v, 100 * v);
        continue;
      }
      if (bond < reach) {
        const dx = bondDx / g.cw;
        const dy = bondDy / g.ch;
        const glyph = Math.abs(dx) < Math.abs(dy) * 0.4 ? G.pipe : dx * dy > 0 ? G.slash : G.back;
        put(g, i, glyph, 110, 124, 176);
      }
    }
  }
  if (detail > 0.5) {
    legend(g, [
      [G.at, [220, 232, 255], 'silicon atom'],
      [G.slash, [110, 124, 176], 'bond: two shared electrons'],
    ], detail);
    // 晶格常数：上下两个「同一位置」的原子之间正好 0.543 nm
    const x = (-AX * 0.5 - cx) / fov;
    const y0 = (A * 0.5 + DUMB - cy) / fov;
    const y1 = (-A * 0.5 + DUMB - cy) / fov;
    if (y0 < g.half - 0.05 && y1 > -g.half + 0.05) {
      // 两条线从上下两个原子拉到同一处，像一个括号
      callout(g, x, y0, x - 0.09, (y0 + y1) / 2, '0.543 nm', [255, 143, 189], detail);
      callout(g, x, y1, x - 0.09, (y0 + y1) / 2, '0.543 nm', [255, 143, 189], detail);
    }
  }
}
