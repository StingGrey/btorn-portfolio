import './crash.css';
import { memo, useImperativeHandle, useMemo, useRef, type Ref } from 'react';

/**
 * 弹窗多到撑不住以后：蓝屏 → 转圈重启 → 黑屏 → 用 ASCII 打出开机自检。
 * 每一步都跟着滚动位置走（往回滑就倒回去），由父组件每帧直接调 set()，不走 React 重渲染。
 */

export type CrashScreenKind = 'off' | 'bsod' | 'restart' | 'black' | 'boot';

export type CrashHandle = {
  /** percent：蓝屏上的完成度；typed：开机日志打出来的比例 0..1 */
  set: (screen: CrashScreenKind, percent: number, typed: number) => void;
};

type Line = { text: string; tone?: 'ok' | 'warn' | 'dim' | 'pink' }[];

function bootLines(jarCount: number, totalToys: number, popups: number): Line[] {
  const dots = (label: string, width = 38) => '.'.repeat(Math.max(3, width - label.length));
  const row = (label: string, result: string, tone: 'ok' | 'warn' | 'pink') => [
    { text: `${label} ${dots(label)} ` },
    { text: result, tone },
  ];
  return [
    [{ text: 'BTORN BIOS v0.2', tone: 'pink' }, { text: '  a tiny universe of soft things', tone: 'dim' }],
    [{ text: 'Copyright (c) the sleepy pixels', tone: 'dim' }],
    [{ text: '' }],
    row('CPU    : one heart, 72 bpm', 'OK', 'ok'),
    row('Memory : 4 dreams', 'OK', 'ok'),
    row('Glass  : 1 sheet', "BROKEN (that's fine)", 'warn'),
    row(`Toys   : ${jarCount} of ${totalToys} in the jar`, jarCount > 0 ? 'SAFE' : 'EMPTY', jarCount > 0 ? 'ok' : 'warn'),
    row(`Popups : ${popups} left open`, 'CLOSED', 'ok'),
    row('TV     : antenna wiggled', 'OK', 'ok'),
    [{ text: '' }],
    [{ text: 'Booting BTORN in ascii mode', tone: 'pink' }, { text: ' ...' }],
    [{ text: 'Scroll down to say hi', tone: 'dim' }],
  ];
}

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 一张假的二维码：只是一块方格图案，什么也不编码 */
function fakeQr() {
  const size = 21;
  const cells: string[] = [];
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const finder = (x: number, y: number) =>
    [[0, 0], [size - 7, 0], [0, size - 7]].some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7);
  const finderOn = (x: number, y: number) => {
    const [fx, fy] = [[0, 0], [size - 7, 0], [0, size - 7]].find(([ax, ay]) => x >= ax && x < ax + 7 && y >= ay && y < ay + 7)!;
    const dx = x - fx;
    const dy = y - fy;
    const ring = Math.min(dx, dy, 6 - dx, 6 - dy);
    return ring === 0 || ring >= 2;
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const on = finder(x, y) ? finderOn(x, y) : random() > 0.52;
      if (on) cells.push(`M${x} ${y}h1v1h-1z`);
    }
  }
  return cells.join('');
}

type Props = {
  ref?: Ref<CrashHandle>;
  jarCount: number;
  totalToys: number;
  popups: number;
};

export const CrashScreen = memo(function CrashScreen({ ref, jarCount, totalToys, popups }: Props) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const percentRef = useRef<HTMLSpanElement | null>(null);
  const bootRef = useRef<HTMLPreElement | null>(null);
  const state = useRef({ screen: 'off' as CrashScreenKind, percent: -1, chars: -1 });
  const qr = useMemo(fakeQr, []);
  const lines = useMemo(() => bootLines(jarCount, totalToys, popups), [jarCount, popups, totalToys]);
  const totalChars = useMemo(() => lines.reduce((sum, line) => sum + line.reduce((s, part) => s + part.text.length, 0) + 1, 0), [lines]);

  // 开机日志：只把前 n 个字打出来，状态词各自上色
  const renderBoot = (chars: number) => {
    const node = bootRef.current;
    if (!node) return;
    let left = chars;
    let html = '';
    for (const line of lines) {
      if (left <= 0) break;
      for (const part of line) {
        if (left <= 0) break;
        const shown = part.text.slice(0, left);
        left -= shown.length;
        html += part.tone ? `<span data-tone="${part.tone}">${escapeHtml(shown)}</span>` : escapeHtml(shown);
      }
      if (left > 0) {
        html += '\n';
        left -= 1;
      }
    }
    node.innerHTML = `${html}<i class="gc-cursor"></i>`;
  };

  useImperativeHandle(
    ref,
    () => ({
      set: (screen, percent, typed) => {
        const current = state.current;
        if (screen !== current.screen) {
          const layer = layerRef.current;
          if (layer) {
            // 只有从「没死机」直接进蓝屏才撕一下
            layer.dataset.hit = String(screen === 'bsod' && current.screen === 'off');
            layer.dataset.screen = screen;
          }
          current.screen = screen;
        }
        const pct = Math.round(Math.min(Math.max(percent, 0), 1) * 100);
        if (pct !== current.percent && percentRef.current) {
          current.percent = pct;
          percentRef.current.textContent = String(pct);
        }
        const chars = Math.round(Math.min(Math.max(typed, 0), 1) * totalChars);
        if (chars !== current.chars) {
          current.chars = chars;
          renderBoot(chars);
        }
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, totalChars],
  );

  return (
    <div className="gl-layer gl-crash" ref={layerRef} data-screen="off" aria-hidden="true">
      <div className="gc-bsod">
        <div className="gc-bsod-inner">
          <p className="gc-face">:(</p>
          <p className="gc-lead">
            Your dream ran into a problem and needs a little nap. We&rsquo;re tucking the toys back into the jar, and then
            we&rsquo;ll restart for you.
          </p>
          <p className="gc-percent">
            <span ref={percentRef}>0</span>% complete
          </p>
          <div className="gc-info">
            <svg className="gc-qr" viewBox="-1 -1 23 23" aria-hidden="true">
              <rect x="-1" y="-1" width="23" height="23" fill="#fff" />
              <path d={qr} fill="#1253c7" />
            </svg>
            <div>
              <p>If you tell a grown-up about this, give them this info:</p>
              <p>Stop code: TOO_MANY_DREAMS</p>
              <p>What failed: glass.sys</p>
            </div>
          </div>
        </div>
      </div>

      <div className="gc-restart">
        <span className="gc-spinner">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        <p>Restarting</p>
      </div>

      <div className="gc-boot">
        <pre ref={bootRef} />
      </div>
    </div>
  );
});
