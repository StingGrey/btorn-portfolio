import '@fontsource/zcool-kuaile';
import '@fontsource/mochiy-pop-one/latin-400.css';
import './itabag.css';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Hand, Heart, Sparkles } from 'lucide-react';
import { DreamConsole } from '../../components/DreamConsole';
import { Logo } from '../../components/Logo';
import { BlurText, ScrambledText, SplitText } from '../../components/text-effects';
import { assets } from '../../content/assets';
import { clamp, prefersReducedMotion, useIdCounter, useInView } from '../shared';

type BadgeFace =
  | { kind: 'logo' }
  | { kind: 'image'; src: string; pos: string; zoom: number }
  | { kind: 'heart' }
  | { kind: 'star' }
  | { kind: 'scramble'; text: string }
  | { kind: 'words'; text: string };

type BadgeDef = {
  id: string;
  label: string;
  face: BadgeFace;
  size: 'big' | 'small';
  x: number;
  y: number;
  tint: string;
  effect: string;
  note: string;
};

const badges: BadgeDef[] = [
  { id: 'logo', label: 'BTORN', face: { kind: 'logo' }, size: 'big', x: 10, y: 22, tint: '#fff4f9', effect: '流光', note: '光沿着字母扫过去' },
  { id: 'face', label: '看板娘', face: { kind: 'image', src: assets.characterCutout, pos: '62% 29%', zoom: 330 }, size: 'big', x: 90, y: 22, tint: '#c9e9ff', effect: '镭射', note: '换个角度，彩虹跟着跑' },
  { id: 'candy', label: 'CANDY HEART', face: { kind: 'image', src: assets.worksCandyHeart, pos: '36% 44%', zoom: 300 }, size: 'small', x: 25, y: 37, tint: '#ffd6e8', effect: '镭射', note: '糖心绘卷的一角' },
  { id: 'heart', label: '心心', face: { kind: 'heart' }, size: 'small', x: 75, y: 37, tint: '#ffe36e', effect: '心跳', note: '点一下，心心会飞出来' },
  { id: 'dreamy', label: 'DREAMY FRAMES', face: { kind: 'image', src: assets.worksDreamyFrames, pos: '54% 26%', zoom: 330 }, size: 'big', x: 10, y: 60, tint: '#ffd6e8', effect: '镭射', note: '一格一格的梦' },
  { id: 'star', label: '星星', face: { kind: 'star' }, size: 'big', x: 90, y: 60, tint: '#c9b6ff', effect: '闪闪', note: '星星一直在转圈圈' },
  { id: 'scramble', label: 'CANDY HEART 字样', face: { kind: 'scramble', text: 'CANDY HEART' }, size: 'small', x: 25, y: 78, tint: '#9de8d4', effect: '乱码', note: '指针放上去，字会乱跳' },
  { id: 'night', label: 'TREASURE BOX', face: { kind: 'image', src: assets.worksTreasureBox, pos: '50% 30%', zoom: 290 }, size: 'small', x: 75, y: 78, tint: '#ffd6e8', effect: '镭射', note: '我的小宝物' },
  { id: 'words', label: '可爱即正义', face: { kind: 'words', text: '可爱即正义' }, size: 'small', x: 31, y: 92, tint: '#ffb3cf', effect: '逐字升起', note: '翻回来会再升一次' },
  { id: 'team', label: 'TINY EVENT', face: { kind: 'image', src: assets.worksTinyEvent, pos: '43% 22%', zoom: 420 }, size: 'small', x: 69, y: 92, tint: '#ffd6e8', effect: '镭射', note: '小心心活动' },
];

const standLines = [
  '欢迎来到 BTORN 的痛包～',
  '徽章都能翻过来哦，背面写着它会什么。',
  '拉链拉开，内袋里还藏着梦境分类！',
  '再戳我……我就要害羞了啦。',
];

type Burst = { id: number; x: number; y: number };

function HeartShape({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 30" aria-hidden="true">
      <path d="M16 28.5C9.3 23.6 2 17.8 2 10.4 2 5.8 5.5 2.2 9.9 2.2c2.7 0 4.9 1.3 6.1 3.4 1.2-2.1 3.4-3.4 6.1-3.4 4.4 0 7.9 3.6 7.9 8.2 0 7.4-7.3 13.2-14 18.1Z" />
    </svg>
  );
}

function StarShape({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 2.6c1.1 0 2 .7 2.4 1.7l3.7 8.5 9.2.9c2.3.2 3.2 3.1 1.5 4.6l-7 6.1 2.1 9c.5 2.2-1.9 3.9-3.8 2.7L20 31.4l-8.1 4.7c-1.9 1.2-4.3-.5-3.8-2.7l2.1-9-7-6.1c-1.7-1.5-.8-4.4 1.5-4.6l9.2-.9 3.7-8.5c.4-1 1.3-1.7 2.4-1.7Z" />
    </svg>
  );
}

function BadgeFront({ face, flipCount }: { face: BadgeFace; flipCount: number }) {
  switch (face.kind) {
    case 'logo':
      return (
        <span className="ib-face-logo">
          BT<span>O</span>RN
        </span>
      );
    case 'image':
      return (
        <span
          className="ib-face-image"
          style={{ backgroundImage: `url(${face.src})`, backgroundPosition: face.pos, backgroundSize: `${face.zoom}% auto` }}
        />
      );
    case 'heart':
      return <HeartShape className="ib-face-heart" />;
    case 'star':
      return (
        <span className="ib-face-star">
          <StarShape className="ib-star-main" />
          <StarShape className="ib-star-mini mini-a" />
          <StarShape className="ib-star-mini mini-b" />
        </span>
      );
    case 'scramble':
      return <ScrambledText text={face.text} className="ib-face-scramble" speed={52} intensity={0.5} />;
    case 'words':
      return <SplitText key={flipCount} text={face.text} className="ib-face-words" delay={70} />;
    default:
      return null;
  }
}

function Badge({ def, onBurst }: { def: BadgeDef; onBurst: (x: number, y: number) => void }) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [flipCount, setFlipCount] = useState(0);

  const setTilt = (px: number, py: number) => {
    const node = ref.current;
    if (!node) return;
    node.style.setProperty('--px', px.toFixed(3));
    node.style.setProperty('--py', py.toFixed(3));
    node.style.setProperty('--rx', `${((0.5 - py) * 26).toFixed(2)}deg`);
    node.style.setProperty('--ry', `${((px - 0.5) * 26).toFixed(2)}deg`);
  };

  const handleMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTilt((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
  };

  const handleClick = () => {
    setFlipped((value) => !value);
    setFlipCount((value) => value + 1);
    if (def.face.kind === 'heart' && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      onBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
  };

  return (
    <button
      ref={ref}
      type="button"
      className={`ib-badge is-${def.size} is-${def.face.kind}`}
      data-flipped={flipped}
      style={{ '--x': `${def.x}%`, '--y': `${def.y}%`, '--tint': def.tint } as CSSProperties}
      onPointerMove={handleMove}
      onPointerLeave={() => setTilt(0.5, 0.5)}
      onClick={handleClick}
      aria-pressed={flipped}
      aria-label={`${def.label}徽章，效果：${def.effect}。${flipped ? '现在是背面' : '点一下翻到背面'}`}
    >
      <span className="ib-badge-tilt">
        <span className="ib-badge-card">
          <span className="ib-badge-front">
            <BadgeFront face={def.face} flipCount={flipCount} />
            <i className="ib-badge-foil" />
            <i className="ib-badge-dome" />
          </span>
          <span className="ib-badge-back">
            <i className="ib-badge-pin" />
            <b>{def.effect}</b>
            <small>{def.note}</small>
          </span>
        </span>
      </span>
    </button>
  );
}

function AcrylicStand({ onBurst }: { onBurst: (x: number, y: number) => void }) {
  const [line, setLine] = useState(0);
  const [hop, setHop] = useState(0);

  const handleClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    setLine((value) => (value + 1) % standLines.length);
    setHop((value) => value + 1);
    const rect = event.currentTarget.getBoundingClientRect();
    onBurst(rect.left + rect.width * 0.55, rect.top + rect.height * 0.22);
  };

  return (
    <div className="ib-stand-wrap">
      <p className="ib-bubble" aria-live="polite">
        <BlurText key={line} text={standLines[line]} as="span" by="char" delay={26} />
      </p>
      <button type="button" className="ib-stand" onClick={handleClick} aria-label="戳一下看板娘立牌">
        <span className="ib-stand-figure" key={hop} data-hop={hop > 0}>
          <img className="ib-stand-img" src={assets.characterCutout} alt="" draggable={false} />
          <i className="ib-stand-sheen" style={{ '--cutout': `url(${assets.characterCutout})` } as CSSProperties} />
        </span>
        <span className="ib-stand-base">
          <Logo href="#" />
        </span>
      </button>
    </div>
  );
}

type ZipperProps = {
  open: boolean;
  onChange: (open: boolean) => void;
  onProgress: (progress: number) => void;
};

function Zipper({ open, onChange, onProgress }: ZipperProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef(0);
  const frameRef = useRef(0);
  const dragRef = useRef({ active: false, moved: 0, startX: 0, startP: 0 });
  const [progress, setProgressState] = useState(0);
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  const setProgress = (value: number) => {
    progressRef.current = value;
    setProgressState(value);
    onProgressRef.current(value);
  };

  const animateTo = useCallback((target: number, done?: () => void) => {
    cancelAnimationFrame(frameRef.current);
    if (prefersReducedMotion()) {
      setProgress(target);
      done?.();
      return;
    }
    const from = progressRef.current;
    const start = performance.now();
    const duration = 420 + Math.abs(target - from) * 380;
    const step = (now: number) => {
      const t = clamp((now - start) / duration, 0, 1);
      const eased = 1 - (1 - t) ** 4;
      setProgress(from + (target - from) * eased);
      if (t < 1) frameRef.current = requestAnimationFrame(step);
      else done?.();
    };
    frameRef.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  useEffect(() => {
    if (open && progressRef.current < 0.99) animateTo(1);
  }, [animateTo, open]);

  const settle = () => {
    if (progressRef.current > 0.62) animateTo(1, () => onChange(true));
    else animateTo(0, () => onChange(false));
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    cancelAnimationFrame(frameRef.current);
    dragRef.current = { active: true, moved: 0, startX: event.clientX, startP: progressRef.current };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    const track = trackRef.current;
    if (!drag.active || !track) return;
    const dx = event.clientX - drag.startX;
    drag.moved = Math.max(drag.moved, Math.abs(dx));
    setProgress(clamp(drag.startP + dx / (track.clientWidth - 64), 0, 1));
  };

  const handlePointerUp = () => {
    const drag = dragRef.current;
    if (!drag.active) return;
    drag.active = false;
    if (drag.moved < 6) {
      const target = progressRef.current > 0.5 ? 0 : 1;
      animateTo(target, () => onChange(target === 1));
      return;
    }
    settle();
  };

  const handleKey = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const next = clamp(progressRef.current + (event.key === 'ArrowRight' ? 0.12 : -0.12), 0, 1);
      setProgress(next);
      if (next >= 1) onChange(true);
      if (next <= 0) onChange(false);
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const target = progressRef.current > 0.5 ? 0 : 1;
      animateTo(target, () => onChange(target === 1));
    }
  };

  return (
    <div className="ib-zipper" ref={trackRef} style={{ '--p': progress.toFixed(4) } as CSSProperties}>
      <span className="ib-zip-teeth" aria-hidden="true" />
      <span className="ib-zip-gap" aria-hidden="true">
        <i className="ib-zip-gap-top" />
        <i className="ib-zip-gap-bottom" />
      </span>
      <button
        type="button"
        className="ib-zip-pull"
        role="slider"
        aria-label="拉链：拉开就能看到内袋"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-valuetext={progress > 0.98 ? '已经拉开' : progress < 0.02 ? '还关着' : `拉开了 ${Math.round(progress * 100)}%`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKey}
      >
        <span className="ib-zip-slider" />
        <HeartShape className="ib-zip-heart" />
      </button>
    </div>
  );
}

type CharmDef = { id: string; length: number; kind: 'mini' | 'heart' | 'tag' };

const charms: CharmDef[] = [
  { id: 'tag', length: 34, kind: 'tag' },
  { id: 'mini', length: 104, kind: 'mini' },
  { id: 'heart', length: 190, kind: 'heart' },
];

function Charms() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const nodes = useRef<(HTMLElement | null)[]>([]);
  const state = useRef(charms.map((_, index) => ({ angle: 0.22 * (index - 1), velocity: 0 })));
  const drag = useRef<{ index: number; lastAngle: number; lastTime: number } | null>(null);
  const visible = useInView(rootRef, '200px 0px');

  useEffect(() => {
    if (!visible || prefersReducedMotion()) return;
    let frame = 0;
    let last = performance.now();
    let lastScroll = window.scrollY;
    let wind = 0;

    const onScroll = () => {
      const delta = window.scrollY - lastScroll;
      lastScroll = window.scrollY;
      state.current.forEach((item, index) => {
        item.velocity += clamp(delta, -80, 80) * 0.012 * (index % 2 ? -1 : 1);
      });
    };

    const onPointerMove = (event: PointerEvent) => {
      wind = clamp(event.movementX ?? 0, -40, 40) * 0.04;
    };

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.032);
      last = now;
      state.current.forEach((item, index) => {
        if (drag.current?.index !== index) {
          const accel = -14 * Math.sin(item.angle) - 1.6 * item.velocity + wind * (1 + index * 0.4);
          item.velocity += accel * dt;
          item.angle += item.velocity * dt;
        }
        const node = nodes.current[index];
        if (node) node.style.transform = `rotate(${item.angle.toFixed(4)}rad)`;
      });
      wind *= 0.9;
      frame = requestAnimationFrame(tick);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, [visible]);

  const angleFromPointer = (index: number, event: ReactPointerEvent) => {
    const node = nodes.current[index];
    if (!node) return 0;
    const rect = node.parentElement!.getBoundingClientRect();
    const pivotX = rect.left + rect.width / 2;
    const pivotY = rect.top;
    return clamp(Math.atan2(pivotX - event.clientX, event.clientY - pivotY), -1.3, 1.3);
  };

  return (
    <div className="ib-charms" ref={rootRef}>
      <span className="ib-dring" aria-hidden="true" />
      {charms.map((charm, index) => (
        <div className="ib-charm-slot" key={charm.id} style={{ '--i': index } as CSSProperties}>
          <div
            className={`ib-charm is-${charm.kind}`}
            ref={(node) => {
              nodes.current[index] = node;
            }}
            style={{ '--len': `${charm.length}px` } as CSSProperties}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = { index, lastAngle: state.current[index].angle, lastTime: performance.now() };
            }}
            onPointerMove={(event) => {
              if (drag.current?.index !== index) return;
              const angle = angleFromPointer(index, event);
              const now = performance.now();
              const dt = Math.max((now - drag.current.lastTime) / 1000, 0.008);
              state.current[index].velocity = (angle - drag.current.lastAngle) / dt;
              state.current[index].angle = angle;
              if (prefersReducedMotion()) {
                const node = nodes.current[index];
                if (node) node.style.transform = `rotate(${angle.toFixed(4)}rad)`;
              }
              drag.current.lastAngle = angle;
              drag.current.lastTime = now;
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            <span className="ib-chain" aria-hidden="true" />
            {charm.kind === 'mini' && (
              <span className="ib-charm-body">
                <img src={assets.characterCutout} alt="" draggable={false} />
              </span>
            )}
            {charm.kind === 'heart' && (
              <span className="ib-charm-body">
                <HeartShape className="ib-charm-heart" />
                <b>O</b>
              </span>
            )}
            {charm.kind === 'tag' && (
              <span className="ib-charm-body ib-tag">
                <span>摸摸徽章</span>
                <span>戳戳立牌</span>
                <span>晃晃挂件</span>
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ItabagHome() {
  const bagRef = useRef<HTMLElement | null>(null);
  const pocketRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const nextId = useIdCounter();

  useEffect(() => {
    const bag = bagRef.current;
    if (!bag || prefersReducedMotion()) return;
    let frame = 0;
    let x = 0.5;
    let y = 0.5;
    const flush = () => {
      frame = 0;
      bag.style.setProperty('--mx', x.toFixed(3));
      bag.style.setProperty('--my', y.toFixed(3));
    };
    const onMove = (event: PointerEvent) => {
      x = event.clientX / window.innerWidth;
      y = event.clientY / window.innerHeight;
      if (!frame) frame = requestAnimationFrame(flush);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  const burst = useCallback((x: number, y: number) => {
    const items = Array.from({ length: 9 }, () => ({ id: nextId(), x, y }));
    setBursts((list) => [...list, ...items]);
    window.setTimeout(() => {
      setBursts((list) => list.filter((item) => !items.includes(item)));
    }, 1100);
  }, [nextId]);

  const handleZip = (next: boolean) => {
    setOpen(next);
    if (next) {
      window.setTimeout(() => {
        pocketRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      }, 260);
    }
  };

  return (
    <div className="ib-root">
      <main>
        <section className="ib-bag" ref={bagRef} data-open={open} aria-label="BTORN 的痛包">
          <Zipper
            open={open}
            onChange={handleZip}
            onProgress={(value) => bagRef.current?.style.setProperty('--zip', value.toFixed(3))}
          />
          <p className="ib-zip-hint">拉开拉链，内袋里有梦境分类</p>

          <div className="ib-label">
            <h1>
              <Logo href="#" />
            </h1>
            <span>收集闪光的小宇宙</span>
          </div>

          <div className="ib-window">
            <div className="ib-felt">
              <div className="ib-shrine">
                <AcrylicStand onBurst={burst} />
                {badges.map((badge) => (
                  <Badge def={badge} key={badge.id} onBurst={burst} />
                ))}
              </div>
              <i className="ib-vinyl" aria-hidden="true" />
            </div>
          </div>

          <Charms />
        </section>

        <section className="ib-pocket" id="pocket" ref={pocketRef} aria-labelledby="ib-pocket-title">
          <span className="ib-pocket-teeth" aria-hidden="true" />
          <div className="ib-pocket-head">
            <h2 id="ib-pocket-title">
              <BlurText text="内袋里的小控制台" as="span" by="char" delay={45} />
            </h2>
            <p>随身带着的梦境分类。往下滑，四个分类会一格一格换台；点画面可以暂停。</p>
          </div>
          <div className="ib-pocket-device">
            <DreamConsole />
          </div>
        </section>
      </main>

      <footer className="ib-care">
        <div className="ib-care-label">
          <span className="ib-care-loop" aria-hidden="true" />
          <h2>BTORN 痛包</h2>
          <ul>
            <li>
              <Sparkles size={18} strokeWidth={1.8} aria-hidden="true" />
              内含 10 枚动效徽章、1 个亚克力立牌、3 个挂件
            </li>
            <li>
              <Hand size={18} strokeWidth={1.8} aria-hidden="true" />
              洗涤说明：请勿机洗，摸摸就好
            </li>
            <li>
              <Heart size={18} strokeWidth={1.8} aria-hidden="true" />
              插画有原创也有收藏，版权归各自作者
            </li>
          </ul>
        </div>
      </footer>

      <div className="ib-bursts" aria-hidden="true">
        {bursts.map((item) => (
          <span
            key={item.id}
            className={`ib-burst tone-${item.id % 3}`}
            style={
              {
                left: item.x,
                top: item.y,
                '--dx': `${Math.cos(item.id * 2.4) * (50 + (item.id % 4) * 18)}px`,
                '--dy': `${-50 - ((item.id * 37) % 90)}px`,
                '--rot': `${((item.id * 53) % 80) - 40}deg`,
              } as CSSProperties
            }
          >
            <HeartShape className="ib-burst-heart" />
          </span>
        ))}
      </div>
    </div>
  );
}
