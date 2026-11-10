import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Pause, Play } from 'lucide-react';
import { workCategories, worksHeading, type WorkCategory } from '../content/works';
import { BlurText, MotionToken, ScrollReveal, ShinyText, SplitText } from './text-effects';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export type ConsoleCopy = {
  heading: string;
  items: WorkCategory[];
  playing: string;
  paused: string;
};

type DreamConsoleProps = {
  /** 嵌入模式：不再自己占 500svh 滚动，分类和扫描线都由外部控制 */
  embedded?: boolean;
  activeIndex?: number;
  /** 0..1，绿色扫描线的位置。每帧都在变的话别走这个属性（会整个重渲染），直接改区块上的 --works-line-y */
  lineProgress?: number;
  copy?: ConsoleCopy;
  onSelect?: (index: number) => void;
  /** 嵌入时外部告诉它现在是不是轮到它上场；false 时时间码和扫描线循环都停，省得在幕后白跑 */
  active?: boolean;
};

/**
 * 播放中的时间码。每 80ms 跳一次，所以单独成一个组件：
 * 跳的时候只重渲染这一个 <time>，不用把整个控制台（几百个逐字动效的 span）跟着重新对比一遍
 */
const Timecode = memo(function Timecode({ running }: { running: boolean }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) {
      return;
    }
    const timer = window.setInterval(() => {
      setElapsed((value) => value + 80);
    }, 80);
    return () => window.clearInterval(timer);
  }, [running]);

  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);
  const frames = Math.floor((elapsed % 1000) / 10);
  return (
    <time className="works-time">
      {`00.${String(minutes).padStart(2, '0')}.${String(seconds).padStart(2, '0')}.${String(frames).padStart(2, '0')}`}
    </time>
  );
});

/**
 * 「梦境分类」CRT 控制台：左侧分类索引、中间带红蓝错位的大图、
 * 跟随滚动的绿色扫描线、右下角弹窗卡片和播放/暂停时间码。
 * 默认模式下区块高 500svh，内部 sticky，每滚过一屏切换一个分类。
 */
export function DreamConsole({ embedded = false, activeIndex, lineProgress, copy, onSelect, active = true }: DreamConsoleProps) {
  const items = copy?.items ?? workCategories;
  const heading = copy?.heading ?? worksHeading;
  const worksRef = useRef<HTMLElement | null>(null);
  const activeWorkRef = useRef(0);
  const [activeWork, setActiveWork] = useState(0);
  const [previousWork, setPreviousWork] = useState(items[0]);
  const [transitionId, setTransitionId] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const current = items[activeWork];

  const activateWork = useCallback(
    (index: number) => {
      if (index === activeWorkRef.current) {
        return;
      }

      setPreviousWork(items[activeWorkRef.current]);
      activeWorkRef.current = index;
      setActiveWork(index);
      setTransitionId((value) => value + 1);
    },
    [items],
  );

  // 嵌入模式：跟着外部给的分类走
  useEffect(() => {
    if (embedded && typeof activeIndex === 'number') activateWork(clamp(activeIndex, 0, items.length - 1));
  }, [activateWork, activeIndex, embedded, items.length]);

  // 只在区块进入视口附近时才跑计时器和动画循环
  useEffect(() => {
    const node = worksRef.current;
    if (!node) {
      return;
    }
    if (!('IntersectionObserver' in window)) {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { rootMargin: '200px 0px', threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // 滚到第 N 屏就切到第 N 个分类（嵌入模式不用）
  useEffect(() => {
    if (embedded) return;
    const section = worksRef.current;
    if (!section) {
      return;
    }
    const markers = Array.from(section.querySelectorAll<HTMLElement>('.works-scroll-marker'));
    if (markers.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          const index = Number((entry.target as HTMLElement).dataset.index ?? 0);
          activateWork(index);
        });
      },
      { root: null, rootMargin: '-42% 0px -42% 0px', threshold: 0.01 },
    );

    markers.forEach((marker) => observer.observe(marker));
    return () => observer.disconnect();
  }, [activateWork, embedded]);

  // 嵌入模式：扫描线位置由外部进度决定
  useEffect(() => {
    if (!embedded) return;
    const section = worksRef.current;
    if (!section || typeof lineProgress !== 'number') return;
    section.style.setProperty('--works-line-y', `${((0.1 + clamp(lineProgress, 0, 1) * 0.8) * 100).toFixed(2)}%`);
  }, [embedded, lineProgress]);

  // 绿色扫描线：跟随滚动进度，滚轮越快越粗
  useEffect(() => {
    if (!isVisible || !active) {
      return;
    }
    const section = worksRef.current;
    if (!section) {
      return;
    }

    let target = 0.12;
    let line = 0.12;
    let kick = 0;
    let frame = 0;
    // 只在值真的变了才写 CSS 变量：每帧都写会让整个控制台反复重算样式
    let lastLine = '';
    let lastSpeed = '';

    const readProgress = () => {
      const rect = section.getBoundingClientRect();
      const travel = Math.max(rect.height - window.innerHeight, 1);
      target = clamp(-rect.top / travel, 0, 1);
    };

    const onWheel = (event: WheelEvent) => {
      const rect = section.getBoundingClientRect();
      const insideWorks = rect.top < window.innerHeight && rect.bottom > 0;
      if (!insideWorks) {
        return;
      }

      kick += clamp(event.deltaY / 1800, -0.18, 0.18);
    };

    const tick = () => {
      kick *= 0.82;
      if (!embedded) {
        readProgress();
        const driven = clamp(0.1 + target * 0.8 + kick, 0.08, 0.92);
        line += (driven - line) * 0.22;
        const nextLine = `${(line * 100).toFixed(2)}%`;
        if (nextLine !== lastLine) {
          section.style.setProperty('--works-line-y', nextLine);
          lastLine = nextLine;
        }
      }
      const nextSpeed = clamp(Math.abs(kick) * 6, 0, 1).toFixed(2);
      if (nextSpeed !== lastSpeed) {
        section.style.setProperty('--works-line-speed', nextSpeed);
        lastSpeed = nextSpeed;
      }
      frame = requestAnimationFrame(tick);
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('wheel', onWheel);
    };
  }, [active, embedded, isVisible]);

  // 大图跟着鼠标轻微反向漂移（原版挂在全局 :root 上，这里收进区块自己）。
  // 嵌入模式下控制台在幕后（active = false）时不跟：每动一下鼠标都要把整个控制台的样式重算一遍
  useEffect(() => {
    if (!isVisible || !active) {
      return;
    }
    const section = worksRef.current;
    if (!section) {
      return;
    }

    let pendingX = 0;
    let pendingY = 0;
    let frame = 0;

    const flush = () => {
      frame = 0;
      section.style.setProperty('--mouse-x', ((pendingX / window.innerWidth) - 0.5).toFixed(4));
      section.style.setProperty('--mouse-y', ((pendingY / window.innerHeight) - 0.5).toFixed(4));
    };

    const onPointerMove = (event: PointerEvent) => {
      pendingX = event.clientX;
      pendingY = event.clientY;
      if (!frame) {
        frame = requestAnimationFrame(flush);
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      cancelAnimationFrame(frame);
    };
  }, [active, isVisible]);

  return (
    <section
      ref={worksRef}
      className={`works-console-section ${embedded ? 'is-embedded' : ''}`.trim()}
      id={embedded ? undefined : 'works'}
      data-status={isPlaying ? 'playing' : 'paused'}
    >
      <div className="works-console-sticky">
        <div className="works-console-frame">
          <div className="works-crt-noise" aria-hidden="true" />
          <div className="works-scanline" aria-hidden="true" />

          <div className="works-index">
            <h2>
              <span />
              <SplitText text={heading} delay={20} />
            </h2>
            <div className="works-index-list" role="tablist" aria-label="Works categories">
              {items.map((item, index) => (
                <button
                  type="button"
                  key={item.id}
                  className="works-index-button"
                  data-active={activeWork === index}
                  onClick={() => {
                    activateWork(index);
                    onSelect?.(index);
                  }}
                  role="tab"
                  aria-selected={activeWork === index}
                >
                  <span>{item.id}:</span>
                  <MotionToken text={item.label} variant={index} />
                  <i aria-hidden="true">←</i>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="works-stage-button"
            onClick={() => setIsPlaying((value) => !value)}
            aria-label={isPlaying ? 'Pause works playback' : 'Play works playback'}
          >
            <span className="works-vertical-title" aria-hidden="true">
              {current.label}
            </span>
            <div className="works-media-stack" aria-live="polite">
              {transitionId > 0 && (
                <div className="works-media works-media-out" key={`out-${transitionId}-${previousWork.id}`} aria-hidden="true">
                  <img className="works-media-layer layer-red" src={previousWork.src} alt="" />
                  <img className="works-media-layer layer-blue" src={previousWork.src} alt="" />
                  <img className="works-media-main" src={previousWork.src} alt="" />
                </div>
              )}
              <div className="works-media works-media-in" key={`in-${transitionId}-${current.id}`}>
                <img className="works-media-layer layer-red" src={current.src} alt="" />
                <img className="works-media-layer layer-blue" src={current.src} alt="" />
                <img className="works-media-main" src={current.src} alt={`${current.label} visual`} />
              </div>
            </div>
            <span className="works-green-line" aria-hidden="true" />
            <span className="works-play-icon" aria-hidden="true">
              {isPlaying ? <Pause size={54} strokeWidth={1.6} /> : <Play size={54} strokeWidth={1.6} />}
            </span>
          </button>

          <div className="works-dialog-stack" key={current.file}>
            <article className="works-dialog" style={{ '--stack': 2 } as CSSProperties}>
              <div className="works-dialog-title">
                <span>
                  <MotionToken text={current.file} variant={3} />
                </span>
                <i>×</i>
              </div>
              <div className="works-dialog-body">
                <h3>
                  <BlurText text={current.title} as="span" by="char" delay={12} />
                </h3>
                <ScrollReveal text={current.desc} as="p" direction="left" delay={24} />
                <a href={current.href}>
                  <ShinyText text={`${current.cta} →`} speed={2.4} color="rgba(248, 245, 247, 0.9)" />
                </a>
                <div className="works-barcode" aria-hidden="true">
                  {current.file}
                </div>
              </div>
            </article>
          </div>

          <div className="works-status" data-state={isPlaying ? 'playing' : 'paused'}>
            <span className="works-status-play">{copy?.playing ?? '播放中'}</span>
            <span className="works-status-pause">{copy?.paused ?? '暂停啦'}</span>
          </div>
          <Timecode running={isPlaying && isVisible && active} />
        </div>
      </div>
      {!embedded && (
        <div className="works-scroll-rail" aria-hidden="true">
          {items.map((item, index) => (
            <span className="works-scroll-marker" data-index={index} key={item.id} />
          ))}
        </div>
      )}
    </section>
  );
}
