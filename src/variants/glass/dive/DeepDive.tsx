import './dive.css';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { AsciiEnd } from '../AsciiEnd';
import type { Portrait } from '../portrait';
import { addWheelSpeed } from '../smoothScroll';
import type { Grids } from './director';
import { screenUnit, twin } from './grid';
import type { DiveRenderer } from './renderer';
import { STATIONS, TRACK, formatScale, wheelSpeed } from './timeline';

/**
 * ASCII 页脚，以及页脚后面「一直往下滑」的那一段：页脚的字一列列掉光、裂开、炸掉，剩一颗粉色的 O，
 * 然后镜头一路放大到普朗克尺度。页脚钉在屏幕上（sticky），这一段的画面盖在它上面的一块画布里。
 * 画布和场景代码都等页脚快露出来了才加载；往回滑一切照原样倒回去，滑到页脚就把真的页脚换回来。
 */

type Props = { reducedMotion: boolean; forceWebGL: boolean };

const RULER = 36;

export function DeepDive({ reducedMotion, forceWebGL }: Props) {
  const trackRef = useRef<HTMLElement | null>(null);
  const pinRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
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

  // 滚轮在几段热闹的地方放慢
  useEffect(() => addWheelSpeed(() => wheelSpeed(zRef.current)), []);

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
    if (!track || !pin || !stage || !host) return;
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
      return ((Math.min(0, window.innerHeight - height) - rect.top) / travel) * TRACK;
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

    const showHud = (show: boolean, index: number, log: number) => {
      if (show !== lastHud) {
        lastHud = show;
        setHud(show);
      }
      if (!show) return;
      if (index !== lastStation) {
        lastStation = index;
        setStation(index);
      }
      const scale = formatScale(log);
      if (scale !== lastScale && scaleRef.current) {
        lastScale = scale;
        scaleRef.current.textContent = scale;
      }
      const at = Math.min(RULER - 1, Math.max(0, Math.floor(-log)));
      const ruler = `${'='.repeat(at)}>${'.'.repeat(RULER - 1 - at)}`;
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
        }
        showHud(false, 0, 0);
        return;
      }
      if (stale) recapture();
      if (pin.dataset.diving !== 'true') pin.dataset.diving = 'true';
      const g = grids.main;
      g.time = now / 1000;
      g.reduced = reducedMotion;
      const out = director.drawFrame(grids, Math.min(z, TRACK), origin);
      renderer.upload();
      renderer.setFall(out.fall, out.gather, gatherAt[0], gatherAt[1], reducedMotion);
      renderer.render(out.glyphs);
      showHud(out.hud.show, out.hud.station, out.hud.log);
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
      pin.dataset.diving = 'false';
    };
  }, [forceWebGL, reducedMotion]);

  const current = STATIONS[station];
  return (
    <section
      className="gd-track"
      ref={trackRef}
      style={failed ? undefined : ({ height: `calc(${pinHeight}px + ${TRACK}svh)` } as CSSProperties)}
    >
      <div className="gd-pin" ref={pinRef} data-diving="false">
        <AsciiEnd reducedMotion={reducedMotion} loose={loose} />
        <div className="gd-stage" ref={stageRef} aria-hidden="true">
          <div className="gd-host" ref={hostRef} />
          <div className="gd-hud" data-show={hud}>
            <p className="gd-read">
              <span>SCALE </span>
              <span className="gd-scale" ref={scaleRef} />
              <b> » {current.label}</b>
            </p>
            <p className="gd-ruler">
              1 m [<span ref={rulerRef} />] 10^-35
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
          <h2>Keep scrolling: from the last pink pixel down to the Planck length</h2>
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
