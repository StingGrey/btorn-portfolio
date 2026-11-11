// 每一帧画什么：按滚动位置挑场景、在交界处溶解；减少动效时换成一站一站的静止画面。
// 左下角的读数前半段是「视野多高」，过了普朗克尺度翻成「宇宙多少岁」，最后从你身上往外拉时又翻回「视野多高」。

import { girlFrames } from './girl';
import { clamp01, clearGrid, dissolve, smooth, type Grid } from './grid';
import { beginNotes, setNoteWeight, takeNotes, type Label } from './notes';
import { drawIntro } from './scenes/intro';
import { drawPixels, drawStack } from './scenes/screen';
import { drawCells, drawDie, drawLattice, drawMetal, drawTransistor } from './scenes/silicon';
import { drawAtom, drawNucleus, drawProton, drawQuark, drawString } from './scenes/atom';
import { drawDark, drawFog, drawFoam, drawInflation, drawSoup, drawWeb } from './scenes/cosmos';
import { drawMerger, drawMilkyWay, prepareMerger, startMerger } from './scenes/galaxies';
import { drawPullback } from './scenes/pullback';
import { drawSunScene } from './scenes/sun';
import { FALL_END, GATHER, OVERLAP, SHOTS, STATIONS, ZOOM_START, logScaleAt, reachAt, readoutOf, stationAt, timeAt, type Readout, type ShotKey } from './timeline';

export type Grids = { main: Grid; next: Grid; temp: Grid; still: Grid };

/** 提前去拿芯片顶盖上那个女孩的帧数据，顺便在后台把星系相撞那一段算好 */
export const prefetch = () => {
  girlFrames();
  startMerger();
};

export type FrameOut = {
  fall: number;
  gather: number;
  /** 页脚掉下去的字还要不要画 */
  glyphs: boolean;
  /** 整屏该抖多厉害（0..1），爆炸那一下用 */
  shake: number;
  /** log：视野多高（log10 米）；mode 是 clock 时换成宇宙多少岁（log10 秒） */
  hud: { show: boolean; station: number; log: number; mode: Readout };
  /** 这一帧要叠在画布上的标注（数组是复用的，只有前 count 个有效） */
  notes: { labels: Label[]; count: number };
};

/** 开场最后那颗粉色 O 的位置（屏幕坐标：高 = 1，正中为原点，y 朝上） */
export type Origin = { x: number; y: number };

function drawShot(key: ShotKey, g: Grid, temp: Grid, zz: number, origin: Origin) {
  switch (key) {
    case 'pixels':
      drawPixels(g, zz, origin.x, origin.y);
      break;
    case 'stack':
      drawStack(g, temp, zz);
      break;
    case 'die':
      drawDie(g, zz);
      break;
    case 'metal':
      drawMetal(g, zz);
      break;
    case 'cells':
      drawCells(g, zz);
      break;
    case 'transistor':
      drawTransistor(g, zz);
      break;
    case 'lattice':
      drawLattice(g, zz);
      break;
    case 'atom':
      drawAtom(g, zz);
      break;
    case 'nucleus':
      drawNucleus(g, zz);
      break;
    case 'proton':
      drawProton(g, zz);
      break;
    case 'quark':
      drawQuark(g, zz);
      break;
    case 'string':
      drawString(g, zz);
      break;
    case 'foam':
      drawFoam(g, zz);
      break;
    case 'inflation':
      drawInflation(g, zz);
      break;
    case 'soup':
      drawSoup(g, zz);
      break;
    case 'fog':
      drawFog(g, zz);
      break;
    case 'dark':
      drawDark(g, zz);
      break;
    case 'web':
      drawWeb(g, zz);
      break;
    case 'merger':
      drawMerger(g, zz);
      break;
    case 'milkyway':
      drawMilkyWay(g, zz);
      break;
    case 'sun':
      drawSunScene(g, zz);
      break;
    case 'pullback':
      drawPullback(g, zz);
      break;
  }
}

/** 画放大那一段的某个位置（交界处两段溶解） */
function drawZoom(g: Grid, next: Grid, temp: Grid, zz: number, origin: Origin, base = 1) {
  let k = SHOTS.length - 1;
  for (let s = 0; s < SHOTS.length; s += 1) {
    if (zz < SHOTS[s].to) {
      k = s;
      break;
    }
  }
  const shot = SHOTS[k];
  if (k < SHOTS.length - 1 && zz > shot.to - OVERLAP) {
    const w = smooth(shot.to - OVERLAP, shot.to + OVERLAP, zz);
    setNoteWeight(base * (1 - w));
    drawShot(shot.key, g, temp, zz, origin);
    clearGrid(next);
    copyClock(next, g);
    setNoteWeight(base * w);
    drawShot(SHOTS[k + 1].key, next, temp, zz, origin);
    dissolve(g, next, w);
    return;
  }
  if (k > 0 && zz < shot.from + OVERLAP) {
    const w = smooth(shot.from - OVERLAP, shot.from + OVERLAP, zz);
    setNoteWeight(base * (1 - w));
    drawShot(SHOTS[k - 1].key, g, temp, zz, origin);
    clearGrid(next);
    copyClock(next, g);
    setNoteWeight(base * w);
    drawShot(shot.key, next, temp, zz, origin);
    dissolve(g, next, w);
    return;
  }
  setNoteWeight(base);
  drawShot(shot.key, g, temp, zz, origin);
}

const copyClock = (to: Grid, from: Grid) => {
  to.time = from.time;
  to.reduced = from.reduced;
};

/** 减少动效：每一站只给一张静止的画面（取这一站中间那个位置），站与站之间溶解 */
const stillAt = (s: number) => {
  const z = STATIONS[s].z;
  const next = STATIONS[s + 1]?.z ?? z + 80;
  return (z + next) / 2;
};

/** 第 s 站、放大到 zz 时左下角该显示什么 */
function readout(s: number, zz: number) {
  const mode = readoutOf(STATIONS[s]);
  return { show: true, station: s, log: mode === 'clock' ? timeAt(zz) : mode === 'reach' ? reachAt(zz) : logScaleAt(zz), mode };
}

export function drawFrame(grids: Grids, z: number, origin: Origin): FrameOut {
  const { main, next, temp, still } = grids;
  clearGrid(main);
  beginNotes();
  const notes = takeNotes();
  // 开头掉得慢一点：先是零星几列，然后才成片地掉
  const fall = clamp01(z / FALL_END) ** 1.35;
  const gather = clamp01((z - GATHER[0]) / (GATHER[1] - GATHER[0]));
  const glyphs = z < GATHER[1] + 2;
  if (z < ZOOM_START) {
    const shake = z > FALL_END * 0.85 ? drawIntro(main, z, origin.x, origin.y) : 0;
    return { fall, gather, glyphs, shake, notes: takeNotes(), hud: { show: false, station: 0, log: logScaleAt(0), mode: 'zoom' as Readout } };
  }
  const zz = z - ZOOM_START;
  // 星系相撞那一段要提前算好：后台的定时器被浏览器节流时，路过前面几站也顺手算一点
  if (zz > 1380 && zz < 1556) prepareMerger(1.5);
  if (!main.reduced) {
    drawZoom(main, next, temp, zz, origin);
    return { fall, gather, glyphs: false, shake: 0, notes: takeNotes(), hud: readout(stationAt(zz), zz) };
  }

  const s = stationAt(zz);
  const band = 10;
  const upcoming = STATIONS[s + 1];
  if (upcoming && zz > upcoming.z - band) {
    const w = smooth(upcoming.z - band, upcoming.z + band, zz);
    drawZoom(main, next, temp, stillAt(s), origin, 1 - w);
    clearGrid(still);
    copyClock(still, main);
    drawZoom(still, next, temp, stillAt(s + 1), origin, w);
    dissolve(main, still, w);
  } else if (s > 0 && zz < STATIONS[s].z + band) {
    const w = 1 - smooth(STATIONS[s].z - band, STATIONS[s].z + band, zz);
    drawZoom(main, next, temp, stillAt(s), origin, 1 - w);
    clearGrid(still);
    copyClock(still, main);
    drawZoom(still, next, temp, stillAt(s - 1), origin, w);
    dissolve(main, still, w);
  } else drawZoom(main, next, temp, stillAt(s), origin);
  return { fall, gather, glyphs: false, shake: 0, notes, hud: readout(s, stillAt(s)) };
}
