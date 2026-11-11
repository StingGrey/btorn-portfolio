// 结尾这一段的时间轴。位置都按「这一段滚过的距离」写，单位是 svh（一屏高）。
// 开场：页脚的字一列列掉光 → 黑屏上冒出三处裂纹 → 三道裂纹爬向粉色的 O → O 往里一收、炸开 → 只剩一颗粉色的 O。
// 然后是放大（zz 从 ZOOM_START 算起）：每一站在 STATIONS 里，读数（视野有多高）按 SCALE_KEYS 走。


export const FALL_END = 72;
/** 三处裂纹各自长出来的那一段 */
export const IMPACTS: [number, number][] = [
  [74, 88],
  [86, 100],
  [98, 112],
];
/** 三道裂纹从各自的落点爬向 O（一道比一道晚一点） */
export const CONVERGE: [number, number] = [104, 134];
export const GATHER: [number, number] = [128, 146];
export const BOOM: [number, number] = [140, 174];
export const ZOOM_START = 182;
export const ZOOM_LEN = 1060;
export const TRACK = ZOOM_START + ZOOM_LEN;

/**
 * 上面这些（以及场景里写死的位置）都是「故事位置」。真正要滑多远由这张表决定：
 * [滚动距离 svh, 故事位置]，中间按直线插。一段的斜率越小，就要滑得越久——
 * 页脚先原样钉一会儿再开始掉；每一站最有看头的地方都多给了一些滚动距离。
 */
const Z = ZOOM_START;
export const PACE: [number, number][] = [
  [0, 0],
  // 页脚先原样待着，多滑一段才开始掉
  [80, 0],
  [220, FALL_END],
  [350, 134],
  // 收拢、爆炸、烟散开
  [500, 176],
  [530, Z],
  [620, Z + 64],
  [680, Z + 100],
  [730, Z + 122],
  [785, Z + 152],
  [835, Z + 182],
  [885, Z + 212],
  [955, Z + 252],
  [1005, Z + 282],
  // 她通电
  [1060, Z + 300],
  // 她蹦着，镜头慢慢靠近
  [1180, Z + 330],
  [1270, Z + 380],
  // 整块裸片的全貌
  [1335, Z + 392],
  [1400, Z + 440],
  [1490, Z + 490],
  [1585, Z + 535],
  [1695, Z + 590],
  [1785, Z + 635],
  [1895, Z + 690],
  [1955, Z + 730],
  [2055, Z + 775],
  [2170, Z + 830],
  [2230, Z + 865],
  [2295, Z + 905],
  [2405, Z + 960],
  [2545, TRACK],
];
/** 这一段一共要滑多远（svh） */
export const SCROLL = PACE[PACE.length - 1][0];

/** 画面的分段（zz）：相邻两段在交界处溶解过去 */
export const SHOTS = [
  { key: 'pixels', from: 0, to: 100 },
  { key: 'stack', from: 100, to: 380 },
  { key: 'die', from: 380, to: 440 },
  { key: 'metal', from: 440, to: 490 },
  { key: 'cells', from: 490, to: 535 },
  { key: 'transistor', from: 535, to: 590 },
  { key: 'lattice', from: 590, to: 635 },
  { key: 'atom', from: 635, to: 730 },
  { key: 'nucleus', from: 730, to: 775 },
  { key: 'proton', from: 775, to: 830 },
  { key: 'quark', from: 830, to: 905 },
  { key: 'string', from: 905, to: 960 },
  { key: 'foam', from: 960, to: ZOOM_LEN },
] as const;
export type ShotKey = (typeof SHOTS)[number]['key'];
/** 交界处溶解的半宽 */
export const OVERLAP = 9;

export type Station = { z: number; label: string; caption: string };

export const STATIONS: Station[] = [
  { z: 0, label: 'THE PINK O', caption: "The pink O made it. Everything else fell. Let's go in." },
  { z: 26, label: 'PIXELS', caption: 'Your screen is a grid of tiny squares. This O is made of them.' },
  { z: 64, label: 'SUBPIXELS', caption: 'Every pixel is three little lights: red, green and blue. Pink is mostly red.' },
  { z: 100, label: 'COLOR FILTER', caption: 'Behind the glass: color filters, one stripe per subpixel.' },
  { z: 122, label: 'LIQUID CRYSTAL', caption: 'Liquid crystal molecules twist to let the light through. Or not.' },
  { z: 152, label: 'TFT BACKPLANE', caption: 'Every subpixel has its own transistor. Yes, millions of them.' },
  { z: 182, label: 'BACKLIGHT', caption: 'All the light starts here: LEDs and a sheet printed with tiny dots.' },
  { z: 212, label: 'LOGIC BOARD', caption: 'Behind the screen: copper roads on a green board.' },
  { z: 252, label: 'THE CHIP', caption: 'The chip that drew your pixel. Someone etched a girl on the lid.' },
  { z: 380, label: 'SILICON DIE', caption: 'Under the lid: a slab of silicon. Cores, caches, billions of switches.' },
  { z: 440, label: 'INTERCONNECT', caption: 'A dozen layers of copper wiring, stacked like highways.' },
  { z: 490, label: 'LOGIC GATES', caption: 'Logic gates in neat rows. NAND, NOR, flip-flops.' },
  { z: 535, label: 'TRANSISTOR', caption: 'One transistor. The gate wraps around stacked silicon sheets. On. Off. On.' },
  { z: 590, label: 'SILICON LATTICE', caption: 'Silicon atoms in a diamond pattern, 0.543 nm apart.' },
  { z: 635, label: 'SILICON ATOM', caption: '14 electrons in a fuzzy cloud. Not orbits, just odds.' },
  { z: 690, label: 'EMPTY SPACE', caption: 'An atom is almost entirely empty. The nucleus is 30,000 times smaller.' },
  { z: 730, label: 'NUCLEUS', caption: '14 protons and 14 neutrons, packed tight.' },
  { z: 775, label: 'PROTON', caption: 'Three quarks, glued together. They are never seen alone.' },
  { z: 830, label: 'QUARK', caption: 'As far as anyone can measure, a quark has no size at all.' },
  { z: 865, label: '???', caption: 'Zooming past everything anyone has ever measured.' },
  { z: 905, label: 'STRING?', caption: "String theory says it's all tiny vibrating strings. Nobody has seen one. Yet." },
  { z: 960, label: 'PLANCK LENGTH', caption: "1.6 × 10^-35 m. Below this, 'smaller' may stop meaning anything." },
];

/** 视野有多高（log10 米）随 zz 怎么走；中间按直线插 */
export const SCALE_KEYS: [number, number][] = [
  [0, -0.7],
  [26, -2.4],
  [64, -3.25],
  [100, -4.0],
  [122, -4.3],
  [152, -4.7],
  [182, -3.6],
  [212, -1.6],
  [252, -1.92],
  [330, -2.1],
  // 钻过黄星星（0.75 mm）落到裸片上：先看到整块裸片（12 mm），再往里放大
  [379.9, -3.12],
  [380, -1.92],
  [392, -2.05],
  [440, -4.3],
  [490, -5.7],
  [535, -6.7],
  [590, -7.7],
  [635, -8.9],
  [690, -9.6],
  [730, -13.7],
  [775, -14.5],
  [830, -15.3],
  [865, -18],
  [905, -33.8],
  [960, -34.4],
  [ZOOM_LEN, -34.8],
];

export function interpolate(keys: [number, number][], x: number) {
  if (x <= keys[0][0]) return keys[0][1];
  for (let k = 1; k < keys.length; k += 1) {
    if (x <= keys[k][0]) {
      const [x0, y0] = keys[k - 1];
      const [x1, y1] = keys[k];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return keys[keys.length - 1][1];
}

/** 放大到 zz 时，视野高多少米（取 log10） */
export const logScaleAt = (zz: number) => interpolate(SCALE_KEYS, zz);

export function stationAt(zz: number) {
  let index = 0;
  for (let k = 0; k < STATIONS.length; k += 1) if (zz >= STATIONS[k].z) index = k;
  return index;
}

const PREFIXES: [number, string][] = [
  [-2, 'cm'],
  [-3, 'mm'],
  [-6, 'µm'],
  [-9, 'nm'],
  [-12, 'pm'],
  [-15, 'fm'],
  [-18, 'am'],
  [-21, 'zm'],
  [-24, 'ym'],
];

/** 把 log10 米写成读数：能用 SI 前缀就用（3.2 µm），太小了就写科学计数（1.6e-35 m） */
export function formatScale(log: number) {
  if (log >= 0) return `${(10 ** log).toFixed(1)} m`;
  for (const [exponent, unit] of PREFIXES) {
    if (log >= exponent) {
      const value = 10 ** (log - exponent);
      return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
    }
  }
  const exponent = Math.floor(log);
  const mantissa = 10 ** (log - exponent);
  return `${mantissa.toFixed(1)}e${exponent} m`;
}

/** 滑了 scroll（svh）以后，故事走到哪了 */
export const storyAt = (scroll: number) => interpolate(PACE, scroll);
