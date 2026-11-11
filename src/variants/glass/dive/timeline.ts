// 结尾这一段的时间轴。位置都按「这一段滚过的距离」写，单位是 svh（一屏高）。
// 开场：页脚的字一列列掉光 → 黑屏上冒出三处裂纹 → 三道裂纹爬向粉色的 O → O 往里一收、炸开 → 只剩一颗粉色的 O。
// 然后是放大（zz 从 ZOOM_START 算起）：每一站在 STATIONS 里，读数（视野有多高）按 SCALE_KEYS 走。
// 放大到普朗克尺度以后再小下去没有意义了，读数从 CLOCK_FROM 那一站起翻成「宇宙多少岁」（TIME_KEYS），
// 从大爆炸一路走到太阳和地球、走到今天；从 REACH_FROM 那一站起镜头从你身上往外拉，读数又翻回尺度，
// 这回越来越大（PULL_KEYS），一直拉到宇宙网。


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
export const ZOOM_LEN = 1880;
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
  // 读数翻成时间：再小下去没有意义了，但还能更早；四种力一股股分家
  [2475, Z + 1000],
  [2550, Z + 1030],
  [2650, Z + 1058],
  // 暴胀，然后整屏同时烧起来
  [2760, Z + 1100],
  [2830, Z + 1120],
  // 希格斯场 → 夸克汤 → 物质赢过反物质 → 质子 → 中微子 → 氢和氦
  [2920, Z + 1148],
  [3000, Z + 1174],
  [3100, Z + 1200],
  [3180, Z + 1228],
  [3260, Z + 1256],
  [3340, Z + 1284],
  // 雾散开，微波背景多停一会儿
  [3420, Z + 1324],
  [3510, Z + 1374],
  // 黑暗时代 → 暗物质 → 第一批恒星 → 再电离
  [3580, Z + 1404],
  [3670, Z + 1442],
  [3770, Z + 1480],
  [3860, Z + 1518],
  // 星系 → 相撞 → 银河系
  [3940, Z + 1556],
  [4060, Z + 1606],
  [4160, Z + 1646],
  // 太阳 → 地球 → 今天
  [4260, Z + 1680],
  [4350, Z + 1712],
  [4420, Z + 1724],
  // 一路拉远，最后停在宇宙网
  [4640, Z + 1798],
  [4740, Z + 1830],
  [4900, TRACK],
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
  { key: 'foam', from: 960, to: 1062 },
  { key: 'inflation', from: 1062, to: 1120 },
  { key: 'soup', from: 1120, to: 1282 },
  { key: 'fog', from: 1282, to: 1377 },
  { key: 'dark', from: 1377, to: 1520 },
  { key: 'web', from: 1520, to: 1556 },
  { key: 'merger', from: 1556, to: 1606 },
  { key: 'milkyway', from: 1606, to: 1646 },
  { key: 'sun', from: 1646, to: 1724 },
  { key: 'pullback', from: 1724, to: ZOOM_LEN },
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
  // 从这一站起，读数是宇宙的年龄
  { z: 1000, label: 'THE FIRST INSTANT', caption: "You can't go smaller. You can go earlier. Everything you can see was once tinier than a proton." },
  { z: 1030, label: 'ONE FORCE', caption: 'Gravity, the strong force, the weak force and electromagnetism may once have been one force. They split off one by one.' },
  { z: 1064, label: 'INFLATION', caption: 'Space itself stretches, everywhere at once: 100 trillion trillion times, in a blink. No center.' },
  { z: 1104, label: 'THE HOT BIG BANG', caption: "Inflation stops and its energy turns into heat, everywhere at the same time. That's the bang." },
  { z: 1126, label: 'THE HIGGS FIELD', caption: 'The Higgs field switches on, everywhere at once. Particles that zipped at light speed suddenly have mass.' },
  { z: 1152, label: 'QUARK SOUP', caption: 'Trillions of degrees. Quarks, antiquarks and gluons in one hot soup, too hot to stick together.' },
  { z: 1178, label: 'MATTER WINS', caption: "Matter and antimatter wipe each other out in flashes of light. A tiny bit of matter is left over. That's us." },
  { z: 1204, label: 'PROTONS', caption: 'It cools. Quarks huddle in threes: protons and neutrons, like the one we flew through.' },
  { z: 1232, label: 'NEUTRINOS', caption: 'One second in: neutrinos stop bumping into things and fly off. They are still flying today.' },
  { z: 1260, label: 'FIRST NUCLEI', caption: 'Three minutes in: hydrogen and helium. Almost everything else in you gets made later, in stars.' },
  { z: 1287, label: 'THE FOG', caption: 'For 380,000 years, a glowing fog. Light keeps bumping into free electrons and gets nowhere.' },
  { z: 1327, label: 'FIRST LIGHT', caption: 'Atoms form and the fog clears. That light still fills the sky: the cosmic microwave background.' },
  { z: 1377, label: 'DARK AGES', caption: 'Then darkness. No stars yet, just cooling gas.' },
  { z: 1408, label: 'DARK MATTER', caption: 'Most matter is dark: it gives off no light, but its gravity pulls first. The gas falls into its web.' },
  { z: 1446, label: 'FIRST STARS', caption: 'The first stars switch on: huge, hot and blue. The biggest explode within a few million years.' },
  { z: 1484, label: 'REIONIZATION', caption: 'Starlight blows bubbles in the leftover gas. They grow and merge until the last of the fog is gone.' },
  { z: 1522, label: 'GALAXIES', caption: 'Stars gather into galaxies. Galaxies gather along the threads.' },
  { z: 1558, label: 'GALAXY COLLISION', caption: 'Galaxies grow by colliding. Their stars almost never hit each other, but gravity flings out long tails of them.' },
  { z: 1608, label: 'THE MILKY WAY', caption: 'Ours settles into a barred spiral: the Milky Way, a few hundred billion stars.' },
  { z: 1648, label: 'THE SUN', caption: '4.6 billion years ago, a cloud of gas and dust collapses. Its middle gets hot enough to fuse hydrogen: the Sun.' },
  { z: 1680, label: 'EARTH', caption: 'Dust in the disk around it clumps into planets. The third one from the Sun is ours.' },
  { z: 1716, label: 'TODAY', caption: '4.5 billion years later: today. Somewhere down there, you are reading this.' },
  // 从这一站起，读数又是尺度：从你身上往外拉
  { z: 1726, label: 'ZOOMING OUT', caption: 'Now the other way: from you, out to as far as anyone can see.' },
  { z: 1802, label: 'DARK ENERGY', caption: "Everything out here is drifting apart, faster and faster. That's dark energy. Nobody knows what it is yet." },
  { z: 1834, label: 'THE COSMIC WEB', caption: '13.8 billion years after the first instant: the cosmic web. The biggest thing there is looks a lot like the smallest.' },
];

/** 从这一站起，左下角的读数不再是「视野多高」，而是「宇宙多少岁」 */
export const CLOCK_FROM = 1000;
/** 从这一站起，读数又是视野多高（这回是往外拉，越来越大） */
export const REACH_FROM = 1726;
/** 左下角读数的三种样子：往里钻的尺度、宇宙的年龄、往外拉的尺度 */
export type Readout = 'zoom' | 'clock' | 'reach';
export const readoutOf = (station: Station): Readout => (station.z >= REACH_FROM ? 'reach' : station.z >= CLOCK_FROM ? 'clock' : 'zoom');

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

const YEAR = 3.156e7;
/** 普朗克时间（5.4e-44 s）和今天（138 亿年），取 log10 秒：时间那把尺子的两头 */
export const TIME_FIRST = Math.log10(5.39e-44);
export const TIME_NOW = Math.log10(13.8e9 * YEAR);

/** 宇宙多少岁（log10 秒）随 zz 怎么走；中间按直线插 */
export const TIME_KEYS: [number, number][] = [
  [CLOCK_FROM, TIME_FIRST],
  // 四种力分家：引力在普朗克时间前后，强力在 10^-36 s
  [1030, TIME_FIRST],
  [1040, -42.6],
  [1050, -36.5],
  [1056, -36],
  // 暴胀：10^-36 s 到 10^-32 s
  [1064, -36],
  [1098, -32],
  [1114, -31.6],
  // 希格斯场：10^-12 s
  [1126, -13],
  [1140, -11.6],
  // 夸克汤 → 物质赢过反物质：百万分之一秒
  [1152, -10],
  [1176, -6.2],
  [1196, -5],
  // 质子和中子 → 中微子飞走：一秒
  [1204, -4.6],
  [1222, -1],
  [1232, 0],
  [1256, 1],
  // 氢和氦：头二十分钟
  [1260, Math.log10(180)],
  [1276, Math.log10(1200)],
  // 雾：五万年 → 三十八万年（雾散开），之后停在这一刻多看一会儿
  [1287, Math.log10(5e4 * YEAR)],
  [1327, Math.log10(3.8e5 * YEAR)],
  [1359, Math.log10(3.8e5 * YEAR)],
  // 黑暗时代 → 暗物质 → 第一批恒星（一两亿年）→ 再电离（十亿年）
  [1377, Math.log10(1e7 * YEAR)],
  [1408, Math.log10(6e7 * YEAR)],
  [1446, Math.log10(1.8e8 * YEAR)],
  [1484, Math.log10(5e8 * YEAR)],
  [1514, Math.log10(1e9 * YEAR)],
  // 星系 → 相撞 → 银河系
  [1522, Math.log10(1.2e9 * YEAR)],
  [1556, Math.log10(2.5e9 * YEAR)],
  [1558, Math.log10(3e9 * YEAR)],
  [1602, Math.log10(5e9 * YEAR)],
  [1608, Math.log10(6e9 * YEAR)],
  [1640, Math.log10(9e9 * YEAR)],
  // 太阳（46 亿年前）→ 地球 → 一跳四十五亿年：今天
  [1648, Math.log10(9.15e9 * YEAR)],
  [1680, Math.log10(9.25e9 * YEAR)],
  [1712, Math.log10(9.3e9 * YEAR)],
  [1720, TIME_NOW],
];

/** 放大到 zz 时，宇宙多少岁（log10 秒） */
export const timeAt = (zz: number) => interpolate(TIME_KEYS, zz);

/** 往外拉的时候屏幕有多高（log10 米）：地球 → 月球 → 太阳 → 太阳系 → 最近的恒星 → 银河系 → 本星系群 → 宇宙网 */
export const PULL_KEYS: [number, number][] = [
  // 先停在今天那颗地球上，等上一段溶解完再开始拉
  [1726, 7.35],
  [1734, 7.35],
  [1740, 9.3],
  [1749, 11.7],
  [1758, 13.4],
  [1768, 16.9],
  [1779, 20.4],
  [1788, 22.6],
  [1798, 25],
];
/** 往外拉到 zz 时，屏幕有多高（log10 米） */
export const reachAt = (zz: number) => interpolate(PULL_KEYS, zz);
/** 往外拉那把尺子的右端：10^26 m（看得见的宇宙差不多这么大） */
export const REACH_MAX = 26;

const AU = 1.496e11;
const LIGHT_YEAR = 9.461e15;

/** 很大的距离写成读数：公里、天文单位、光年，再大就是百万光年、十亿光年 */
export function formatReach(log: number) {
  const meters = 10 ** log;
  const round = (v: number) => Number(v.toPrecision(3)).toLocaleString('en-US');
  if (meters < 1e3) return `${round(meters)} m`;
  if (meters < 1e10) return `${round(meters / 1e3)} km`;
  if (meters < 0.05 * LIGHT_YEAR) return `${round(meters / AU)} AU`;
  const years = meters / LIGHT_YEAR;
  if (years < 1e6) return `${round(years)} ly`;
  if (years < 1e9) return `${(years / 1e6).toFixed(years < 1e7 ? 1 : 0)} Mly`;
  return `${(years / 1e9).toFixed(1)} Gly`;
}

export function stationAt(zz: number) {
  let index = 0;
  for (let k = 0; k < STATIONS.length; k += 1) if (zz >= STATIONS[k].z) index = k;
  return index;
}

/** 科学计数：1.6e-35；尾数四舍五入到 10.0 时进一位（不写成 10.0e-35） */
function scientific(log: number) {
  let exponent = Math.floor(log);
  let mantissa = 10 ** (log - exponent);
  if (mantissa >= 9.95) {
    mantissa /= 10;
    exponent += 1;
  }
  return `${mantissa.toFixed(1)}e${exponent}`;
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
  return `${scientific(log)} m`;
}

const TIME_PREFIXES: [number, string][] = [
  [-3, 'ms'],
  [-6, 'µs'],
  [-9, 'ns'],
  [-12, 'ps'],
  [-15, 'fs'],
  [-18, 'as'],
  [-21, 'zs'],
  [-24, 'ys'],
];

/** 把 log10 秒写成读数：很短就用 SI 前缀或科学计数（5.4e-44 s），长了换成分钟、年、百万年、十亿年 */
export function formatTime(log: number) {
  if (log < 0) {
    for (const [exponent, unit] of TIME_PREFIXES) {
      if (log >= exponent) {
        const value = 10 ** (log - exponent);
        return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
      }
    }
    return `${scientific(log)} s`;
  }
  const seconds = 10 ** log;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(seconds < 600 ? 1 : 0)} min`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} h`;
  const years = seconds / YEAR;
  if (years < 1) return `${Math.round(seconds / 86400)} days`;
  if (years < 1e6) return `${Number(years.toPrecision(3)).toLocaleString('en-US')} yr`;
  if (years < 1e9) return `${(years / 1e6).toFixed(years < 1e7 ? 1 : 0)} Myr`;
  return `${(years / 1e9).toFixed(1)} Gyr`;
}

/** 滑了 scroll（svh）以后，故事走到哪了 */
export const storyAt = (scroll: number) => interpolate(PACE, scroll);
