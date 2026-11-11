// 场景里的标注：一行字、带引线的说明、左上角的图例。光看画面就能认出每样东西是什么。
// 字符格子很细（一格只有六七个像素高），标注不写在格子里：这里只把这一帧要显示哪些字、引线从哪拉到哪记下来，
// 由 DeepDive 用清晰的 DOM 文字和细线叠在画布上。

import type { Grid } from './grid';

export type Rgb = [number, number, number];

export const INK: Rgb = [236, 230, 250];
export const DIM: Rgb = [176, 166, 204];

export type Label = {
  /** 屏幕坐标（高 = 1，正中为原点，y 朝上）；图例行不用 */
  x: number;
  y: number;
  text: string;
  color: Rgb;
  /** 0 左对齐、0.5 居中、1 右对齐 */
  align: number;
  opacity: number;
  /** 图例里的第几行；普通标注是 -1；-2 是那句「状态说明」（位置由页面定，避开读数框） */
  row: number;
  swatch: Rgb;
  /** 有引线的话，线从 (fx, fy) 拉到 (x, y) */
  line: boolean;
  fx: number;
  fy: number;
};

const MAX = 120;
const labels: Label[] = [];
let count = 0;
let weight = 1;

/** 每帧开始前清空 */
export function beginNotes() {
  count = 0;
  weight = 1;
}

/** 两个场景溶解的时候，各自的标注按比例淡入淡出 */
export function setNoteWeight(value: number) {
  weight = value;
}

export const takeNotes = () => ({ labels, count });

function push(x: number, y: number, text: string, color: Rgb, align: number, opacity: number, row: number, swatch: Rgb, line = false, fx = 0, fy = 0) {
  const o = opacity * weight;
  if (o <= 0.03 || !text || count >= MAX) return;
  let label = labels[count];
  if (!label) {
    label = { x, y, text, color, align, opacity: o, row, swatch, line, fx, fy };
    labels[count] = label;
  }
  label.x = x;
  label.y = y;
  label.text = text;
  label.color = color;
  label.align = align;
  label.opacity = o > 1 ? 1 : o;
  label.row = row;
  label.swatch = swatch;
  label.line = line;
  label.fx = fx;
  label.fy = fy;
  count += 1;
}

/** 在屏幕坐标 (x, y) 写一行字；align：0 左对齐、0.5 居中、1 右对齐 */
export function note(g: Grid, x: number, y: number, text: string, color: Rgb = INK, align = 0.5, show = 1) {
  if (Math.abs(x) > g.aspect / 2 + 0.05 || Math.abs(y) > g.half + 0.02) return;
  push(x, y, text, color, align, show, -1, color);
}

/** 从要指的东西 (fx, fy) 拉一条细线到 (tx, ty)，说明写在线尾（朝外的那一侧） */
export function callout(_g: Grid, fx: number, fy: number, tx: number, ty: number, text: string, color: Rgb = INK, show = 1) {
  const right = tx >= fx;
  push(tx, ty, text, color, right ? 0 : 1, show, -1, color, true, fx, fy);
}

/** 图例：左上角一列，每行一个小色块加说明 */
export function legend(_g: Grid, items: [glyph: number, color: Rgb, text: string][], show = 1) {
  items.forEach(([, color, text], k) => push(0, 0, text, DIM, 0, show, k, color));
}

/** 一句状态说明（比如「栅极开了：电子在流」）：放在不挡读数框的角落 */
export function status(_g: Grid, text: string, color: Rgb = INK, show = 1) {
  push(0, 0, text, color, 0.5, show, -2, color);
}
