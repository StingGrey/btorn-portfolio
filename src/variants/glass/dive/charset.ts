// 字形表：画布网格和页脚掉下去的字共用一套序号（0 = 空格）。
// ASCII 用 VT323 画；方块、框线、圆点这些自己画：VT323 的 latin 子集里没有它们，
// 而且自己画才能刚好铺满格子、相邻的格子前后连得上（电路走线全靠这个）。

export const FONT_CHARS = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~·°µ×";
export const SHAPE_CHARS = '█▓▒░▀▄▌▐─│┌┐└┘├┤┬┴┼═║╬●○■□◆★';

const LIST = [...FONT_CHARS, ...SHAPE_CHARS];
const INDEX = new Map(LIST.map((ch, index) => [ch, index]));

export const GLYPH_COUNT = LIST.length;
export const FONT_COUNT = [...FONT_CHARS].length;
export const glyphChar = (index: number) => LIST[index] ?? '?';
/** 字符 → 序号（没有的字一律当成问号） */
export const gi = (ch: string) => INDEX.get(ch) ?? (INDEX.get('?') as number);

/** 由疏到密的一串字：亮度、浓度都按它挑 */
export const RAMP = [...' .:-=+*#%@'].map(gi);
/** 方块由淡到实 */
export const BLOCKS = [gi(' '), gi('░'), gi('▒'), gi('▓'), gi('█')];

export const G = {
  space: 0,
  dot: gi('.'),
  mid: gi('·'),
  colon: gi(':'),
  dash: gi('-'),
  pipe: gi('|'),
  slash: gi('/'),
  back: gi('\\'),
  under: gi('_'),
  plus: gi('+'),
  star: gi('*'),
  hash: gi('#'),
  at: gi('@'),
  o: gi('o'),
  O: gi('O'),
  x: gi('x'),
  tilde: gi('~'),
  eq: gi('='),
  quote: gi("'"),
  comma: gi(','),
  full: gi('█'),
  dark: gi('▓'),
  medium: gi('▒'),
  light: gi('░'),
  top: gi('▀'),
  bottom: gi('▄'),
  left: gi('▌'),
  right: gi('▐'),
  h: gi('─'),
  v: gi('│'),
  cross: gi('┼'),
  hh: gi('═'),
  vv: gi('║'),
  disc: gi('●'),
  ring: gi('○'),
  square: gi('■'),
  box: gi('□'),
  diamond: gi('◆'),
  starShape: gi('★'),
};

/** 按方向挑一个线条字：dx、dy 是以「格子」为单位的方向（y 朝上） */
export function lineGlyph(dx: number, dy: number) {
  let angle = Math.atan2(dy, dx);
  if (angle < 0) angle += Math.PI;
  if (angle < Math.PI / 8 || angle >= (Math.PI * 7) / 8) return G.dash;
  if (angle < (Math.PI * 3) / 8) return G.slash;
  if (angle < (Math.PI * 5) / 8) return G.pipe;
  return G.back;
}
