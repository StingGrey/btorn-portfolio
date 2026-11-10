// 重启以后的 ASCII 世界：量字宽、ASCII 边框。字符画 Logo 在 logo.ts（离线生成）。

/** 量一下等宽字体每个字的宽度（相对字号） */
export function monoAdvance(family: string) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0.5;
  ctx.font = `100px ${family}`;
  return ctx.measureText('MMMMMMMMMM').width / 1000;
}

/* ---------- ASCII 边框 ---------- */

/** 按列宽折行（不拆单词） */
export function wrap(text: string, width: number) {
  const lines: string[] = [];
  let line = '';
  text.split(' ').forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  });
  if (line) lines.push(line);
  return lines;
}

export const pad = (text: string, width: number) => text + ' '.repeat(Math.max(0, width - text.length));
