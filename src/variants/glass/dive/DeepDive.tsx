import './dive.css';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { AsciiEnd } from '../AsciiEnd';
import type { Portrait } from '../portrait';
import type { FrameOut, Grids } from './director';
import { hash1, screenUnit, twin } from './grid';
import type { DiveRenderer } from './renderer';
import { REACH_MAX, SCROLL, STATIONS, TIME_FIRST, TIME_NOW, formatReach, formatScale, formatTime, readoutOf, storyAt, type Readout } from './timeline';

/**
 * ASCII 页脚，以及页脚后面「一直往下滑」的那一段：页脚的字一列列掉光、裂开、炸掉，剩一颗粉色的 O，
 * 然后镜头一路放大到普朗克尺度；再小下去没有意义了，读数翻成时间，从大爆炸一路走到太阳、地球和今天的你，
 * 最后读数翻回尺度，从你身上一路拉远到宇宙网。
 * 页脚钉在屏幕上（sticky），这一段的画面盖在它上面的一块画布里。
 * 画布和场景代码都等页脚快露出来了才加载；往回滑一切照原样倒回去，滑到页脚就把真的页脚换回来。
 */

type Props = { reducedMotion: boolean; forceWebGL: boolean };

const RULER = 36;
/** 读数换样子（尺度 → 时间 → 尺度）的那一下：字乱跳多久（毫秒） */
const FLIP_MS = 420;
const NOISE = '#%&@$?!<>/\\|=+*01';

/** 翻面时把读数的字随机换掉一大半（空格和括号留着，看得出是同一行） */
function scramble(text: string, now: number) {
  const beat = Math.floor(now / 45);
  let out = '';
  for (let k = 0; k < text.length; k += 1) {
    const ch = text[k];
    out += ch === ' ' || ch === '[' || ch === ']' || hash1(beat * 131 + k) < 0.35 ? ch : NOISE[Math.floor(hash1(beat * 977 + k * 7) * NOISE.length)];
  }
  return out;
}

export function DeepDive({ reducedMotion, forceWebGL }: Props) {
  const trackRef = useRef<HTMLElement | null>(null);
  const pinRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const notesRef = useRef<HTMLDivElement | null>(null);
  const scaleRef = useRef<HTMLSpanElement | null>(null);
  const rulerRef = useRef<HTMLSpanElement | null>(null);
  const zRef = useRef(-1);
  const [pinHeight, setPinHeight] = useState(0);
  const [station, setStation] = useState(0);
  const [hud, setHud] = useState(false);
  const [loose, setLoose] = useState(false);
  const [failed, setFailed] = useState(false);

  // 页脚有多高：比一屏高（手机上）就让它底边贴着屏幕底边钉住
  useLayoutEffect(() => {
    const pin = pinRef.current;
    const footer = pin?.querySelector('footer');
    if (!pin || !footer) return;
    const update = () => {
      const height = footer.offsetHeight;
      setPinHeight(height);
      pin.style.setProperty('--gd-pin-top', `${Math.min(0, window.innerHeight - height)}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(footer);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  // 页脚完整地停在屏幕上两秒多，边框底下松掉两个字，暗示下面还有东西
  useEffect(() => {
    if (loose || reducedMotion) return;
    let timer = 0;
    const check = () => {
      window.clearTimeout(timer);
      const footer = pinRef.current?.querySelector('footer');
      if (!footer) return;
      const rect = footer.getBoundingClientRect();
      if (rect.bottom <= window.innerHeight + 4 && rect.bottom > window.innerHeight * 0.5 && zRef.current <= 0.05) {
        timer = window.setTimeout(() => setLoose(true), 2400);
      }
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', check);
    };
  }, [loose, reducedMotion]);

  useEffect(() => {
    const track = trackRef.current;
    const pin = pinRef.current;
    const stage = stageRef.current;
    const host = hostRef.current;
    const noteLayer = notesRef.current;
    if (!track || !pin || !stage || !host || !noteLayer) return;
    let disposed = false;
    let renderer: DiveRenderer | null = null;
    let grids: Grids | null = null;
    let director: typeof import('./director') | null = null;
    let capture: typeof import('./footerGlyphs') | null = null;
    let portrait: Portrait | null = null;
    let stale = true;
    let origin = { x: 0, y: 0 };
    let gatherAt: [number, number] = [0, 0];
    let frame = 0;
    let lastStation = -1;
    let lastHud = false;
    let lastScale = '';
    let lastRuler = '';
    let lastMode: Readout = 'zoom';
    let flipUntil = 0;
    let shaking = false;
    // 标注：一批复用的小标签和引线，每帧只改位置、文字和透明度
    const noteEls: HTMLSpanElement[] = [];
    const lineEls: HTMLElement[] = [];
    const noteText: string[] = [];
    const noteWidth: number[] = [];
    let notesShown = 0;
    const css = (c: number[]) => `rgb(${c[0] | 0} ${c[1] | 0} ${c[2] | 0})`;
    const syncNotes = (notes: FrameOut['notes'] | null) => {
      const count = notes?.count ?? 0;
      if (notes && count > 0) {
        const width = stage.clientWidth;
        const height = stage.clientHeight;
        const unit = screenUnit(width, height);
        const hudBox = stage.querySelector<HTMLElement>('.gd-hud');
        for (let k = 0; k < count; k += 1) {
          const label = notes.labels[k];
          let el = noteEls[k];
          if (!el) {
            el = document.createElement('span');
            el.className = 'gd-note';
            const line = document.createElement('i');
            line.className = 'gd-line';
            noteLayer.append(line, el);
            noteEls[k] = el;
            lineEls[k] = line;
            noteText[k] = '';
          }
          el.style.display = '';
          if (noteText[k] !== label.text) {
            el.textContent = label.text;
            noteText[k] = label.text;
            noteWidth[k] = el.offsetWidth;
          }
          const w = noteWidth[k];
          const line = lineEls[k];
          let left = 0;
          let top = 0;
          if (label.row >= 0) {
            el.dataset.legend = 'true';
            el.style.setProperty('--sw', css(label.swatch));
            left = 16;
            top = 78 + label.row * 22;
          } else {
            if (el.dataset.legend) delete el.dataset.legend;
            if (label.row === -2) {
              // 状态说明：宽屏放右下角，窄屏放在读数框正上方
              const wide = width >= 760;
              left = wide ? width - w - 20 : (width - w) / 2;
              top = wide ? height - 46 : height - (hudBox?.offsetHeight ?? 120) - 52;
            } else {
              left = width / 2 + label.x * unit - label.align * w;
              top = height / 2 - label.y * unit - 10;
            }
            // 别让字跑出屏幕
            left = Math.min(Math.max(left, 6), Math.max(6, width - w - 6));
          }
          el.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`;
          el.style.color = css(label.color);
          el.style.opacity = label.opacity.toFixed(2);
          if (label.line) {
            const x0 = width / 2 + label.fx * unit;
            const y0 = height / 2 - label.fy * unit;
            const x1 = label.align > 0.5 ? left + w : left;
            const y1 = top + 10;
            line.style.display = '';
            line.style.width = `${Math.hypot(x1 - x0, y1 - y0).toFixed(1)}px`;
            line.style.transform = `translate(${x0.toFixed(1)}px, ${y0.toFixed(1)}px) rotate(${Math.atan2(y1 - y0, x1 - x0).toFixed(4)}rad)`;
            line.style.background = css(label.color);
            line.style.opacity = (label.opacity * 0.75).toFixed(2);
          } else line.style.display = 'none';
        }
      }
      for (let k = count; k < notesShown; k += 1) {
        noteEls[k].style.display = 'none';
        lineEls[k].style.display = 'none';
      }
      notesShown = count;
    };

    // 每次挂载都用一块新画布（StrictMode 下先销毁的那个渲染器会把画布上下文一起关掉）
    const canvas = document.createElement('canvas');
    canvas.className = 'gd-canvas';
    host.appendChild(canvas);

    const footerOf = () => pin.querySelector('footer');
    const zNow = () => {
      const rect = track.getBoundingClientRect();
      const height = footerOf()?.offsetHeight ?? window.innerHeight;
      const travel = rect.height - height;
      if (travel <= 1) return -1;
      // 滚动距离先换成「故事位置」：哪里该多滑一会儿都在 timeline 的 PACE 里
      return storyAt(((Math.min(0, window.innerHeight - height) - rect.top) / travel) * SCROLL);
    };

    const layout = () => {
      if (!renderer) return;
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      if (width <= 0 || height <= 0) return;
      const main = renderer.resize(width, height, Math.min(window.devicePixelRatio || 1, 3));
      if (!grids || grids.main !== main) grids = { main, next: twin(main), temp: twin(main), still: twin(main) };
      stale = true;
    };

    const recapture = () => {
      const footer = footerOf();
      if (!renderer || !capture || !footer) return;
      const result = capture.captureFooter(footer, stage, portrait, renderer.metrics);
      renderer.setGlyphs(result.glyphs);
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      const unit = screenUnit(width, height);
      // 粉色的 O 在屏幕外（手机上 Logo 被顶到了上面）也收到屏幕里来炸，别炸掉一半
      const [px, py] = result.pink ?? [width / 2, height / 2];
      const x = Math.min(Math.max(px, width * 0.12), width * 0.88);
      const y = Math.min(Math.max(py, height * 0.16), height * 0.84);
      gatherAt = [x, y];
      origin = { x: (x - width / 2) / unit, y: (height / 2 - y) / unit };
      stale = false;
    };

    const showHud = (show: boolean, index: number, log: number, mode: Readout, now: number) => {
      if (show !== lastHud) {
        lastHud = show;
        setHud(show);
      }
      if (!show) return;
      if (index !== lastStation) {
        lastStation = index;
        setStation(index);
      }
      // 尺度翻成时间、时间又翻回尺度（或者往回滑翻回来）：读数和尺子先乱跳一下
      if (mode !== lastMode) {
        lastMode = mode;
        flipUntil = reducedMotion ? 0 : now + FLIP_MS;
      }
      const flipping = now < flipUntil;
      const value = mode === 'clock' ? formatTime(log) : mode === 'reach' ? formatReach(log) : formatScale(log);
      const scale = flipping ? scramble(value, now) : value;
      if (scale !== lastScale && scaleRef.current) {
        lastScale = scale;
        scaleRef.current.textContent = scale;
      }
      // 比例尺：一格一个数量级（1 m → 10^-35 m）；时间尺：从普朗克时间到今天；往外拉：1 m → 10^26 m
      const at =
        mode === 'clock'
          ? Math.round(((log - TIME_FIRST) / (TIME_NOW - TIME_FIRST)) * (RULER - 1))
          : mode === 'reach'
            ? Math.round((log / REACH_MAX) * (RULER - 1))
            : Math.floor(-log);
      const clamped = Math.min(RULER - 1, Math.max(0, at));
      const bar = `${'='.repeat(clamped)}>${'.'.repeat(RULER - 1 - clamped)}`;
      const ruler = flipping ? scramble(bar, now + 200) : bar;
      if (ruler !== lastRuler && rulerRef.current) {
        lastRuler = ruler;
        rulerRef.current.textContent = ruler;
      }
    };

    const tick = (now: number) => {
      frame = 0;
      if (disposed || !renderer || !grids || !director) return;
      const z = zNow();
      zRef.current = z;
      const rect = track.getBoundingClientRect();
      const diving = rect.bottom > 0 && rect.top < window.innerHeight && z > 0.05;
      if (!diving) {
        if (pin.dataset.diving !== 'false') {
          pin.dataset.diving = 'false';
          // 页脚回来以后可能又变了（比如边框松掉的那两个字）：下次再掉重新量一遍
          stale = true;
          host.style.transform = '';
          shaking = false;
          syncNotes(null);
        }
        showHud(false, 0, 0, lastMode, now);
        return;
      }
      if (stale) recapture();
      if (pin.dataset.diving !== 'true') pin.dataset.diving = 'true';
      const g = grids.main;
      g.time = now / 1000;
      g.reduced = reducedMotion;
      const out = director.drawFrame(grids, z, origin);
      renderer.upload();
      renderer.setFall(out.fall, out.gather, gatherAt[0], gatherAt[1], reducedMotion);
      renderer.render(out.glyphs);
      // 爆炸那一下整块画面跟着震：每 36ms 换一个方向，越往后越轻
      if (out.shake > 0.01) {
        const beat = Math.floor(now / 36);
        const reach = out.shake * 20;
        host.style.transform = `translate(${((hash1(beat) - 0.5) * 2 * reach).toFixed(1)}px, ${((hash1(beat + 977) - 0.5) * 2 * reach).toFixed(1)}px)`;
        shaking = true;
      } else if (shaking) {
        host.style.transform = '';
        shaking = false;
      }
      syncNotes(out.notes);
      showHud(out.hud.show, out.hud.station, out.hud.log, out.hud.mode, now);
      // 在这一段里一直画（大多数场景自己会动）；滑出去就停
      frame = requestAnimationFrame(tick);
    };
    const request = () => {
      if (!frame && renderer) frame = requestAnimationFrame(tick);
    };

    const start = async () => {
      try {
        const [{ createDiveRenderer }, dir, cap, port] = await Promise.all([
          import('./renderer'),
          import('./director'),
          import('./footerGlyphs'),
          import('../portrait'),
        ]);
        if (disposed) return;
        const created = await createDiveRenderer(canvas, { forceWebGL });
        if (disposed) {
          created.dispose();
          return;
        }
        renderer = created;
        director = dir;
        capture = cap;
        portrait = port.PORTRAIT;
        // 芯片顶盖上那个女孩的帧数据提前拿好，滑得快也不会到了顶盖她才冒出来
        dir.prefetch();
        layout();
        request();
      } catch (error) {
        console.error(error);
        if (!disposed) setFailed(true);
      }
    };

    const near = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        near.disconnect();
        start();
      },
      { rootMargin: '150% 0px' },
    );
    near.observe(track);
    const onScroll = () => request();
    window.addEventListener('scroll', onScroll, { passive: true });
    const resize = new ResizeObserver(() => {
      layout();
      request();
    });
    resize.observe(stage);
    const footer = footerOf();
    if (footer) resize.observe(footer);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      near.disconnect();
      resize.disconnect();
      window.removeEventListener('scroll', onScroll);
      renderer?.dispose();
      canvas.remove();
      noteLayer.replaceChildren();
      pin.dataset.diving = 'false';
    };
  }, [forceWebGL, reducedMotion]);

  const current = STATIONS[station];
  const mode = readoutOf(current);
  return (
    <section
      className="gd-track"
      ref={trackRef}
      style={failed ? undefined : ({ height: `calc(${pinHeight}px + ${SCROLL}svh)` } as CSSProperties)}
    >
      <div className="gd-pin" ref={pinRef} data-diving="false">
        <AsciiEnd reducedMotion={reducedMotion} loose={loose} />
        <div className="gd-stage" ref={stageRef} aria-hidden="true">
          <div className="gd-host" ref={hostRef} />
          <div className="gd-notes" ref={notesRef} />
          <div className="gd-hud" data-show={hud} data-mode={mode}>
            <p className="gd-read">
              <span>{mode === 'clock' ? 'TIME ' : 'SCALE '}</span>
              <span className="gd-scale" ref={scaleRef} />
              <b> » {current.label}</b>
            </p>
            <p className="gd-ruler">
              {mode === 'clock' ? '0 s' : '1 m'} [<span ref={rulerRef} />] {mode === 'clock' ? '13.8 Gyr' : mode === 'reach' ? '10^26 m' : '10^-35'}
            </p>
            <p className="gd-cap" key={station}>
              {[...current.caption].map((ch, index) => (
                <span key={index} style={{ '--i': index } as CSSProperties}>
                  {ch}
                </span>
              ))}
            </p>
          </div>
        </div>
      </div>
      {!failed && (
        <div className="sr-only">
          <h2>Keep scrolling: from the last pink pixel down to the Planck length, then from the Big Bang to you, and out to the cosmic web</h2>
          <ol>
            {STATIONS.map((item) => (
              <li key={item.z}>
                {item.label}: {item.caption}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
