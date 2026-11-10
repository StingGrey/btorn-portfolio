import '@fontsource/zcool-xiaowei';
import '@fontsource/m-plus-rounded-1c/latin-500.css';
import '@fontsource/m-plus-rounded-1c/latin-800.css';
import './galge.css';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { Lock, X } from 'lucide-react';
import { DreamConsole } from '../../components/DreamConsole';
import { BlurText, ShinyText } from '../../components/text-effects';
import { assets } from '../../content/assets';
import { clamp, prefersReducedMotion, useInView } from '../shared';

/* ---------------- 剧本 ---------------- */

type Face = 'idle' | 'happy' | 'surprise' | 'shy';
type Emote = 'heart' | 'note' | 'sweat' | 'surprise';
type Fx = 'petals' | 'shake' | 'flash' | 'wipe';
type Choice = { label: string; next: string };
type ScriptNode = {
  who?: string;
  text: string;
  face?: Face;
  emote?: Emote;
  fx?: Fx[];
  next?: string;
  choices?: Choice[];
  goTo?: 'cg' | 'route';
  setTime?: 'day' | 'sunset';
};

const HEROINE = '看板娘';

const script: Record<string, ScriptNode> = {
  intro1: { who: HEROINE, text: '啊，你来啦！欢迎来到 BTORN 的小窝～', face: 'happy', emote: 'heart', next: 'intro2' },
  intro2: { who: HEROINE, text: '这里的东西都会动哦。不信的话，再点一下屏幕？', face: 'idle', next: 'intro3' },
  intro3: { who: HEROINE, text: '看——花瓣下起来了！这是今天的第一个小魔法。', face: 'happy', emote: 'note', fx: ['petals'], next: 'hub' },
  hub: {
    who: HEROINE,
    text: '接下来想看什么呢？',
    face: 'idle',
    choices: [
      { label: '晃一晃屏幕！', next: 'shake1' },
      { label: '换个时间看看', next: 'wipe' },
      { label: '去 CG 鉴赏', next: 'cg1' },
      { label: '进入梦境 ROUTE', next: 'route1' },
    ],
  },
  shake1: { who: HEROINE, text: '呜哇！？……别、别突然晃我啦！', face: 'surprise', emote: 'surprise', fx: ['shake', 'flash'], next: 'shake2' },
  shake2: { who: HEROINE, text: '这个叫屏幕震动，吓人专用。心脏还在扑通扑通跳……', face: 'shy', emote: 'sweat', next: 'hub' },
  wipeSunset: { text: '——画面一转，到了傍晚——', fx: ['wipe'], setTime: 'sunset', next: 'wipeSunset2' },
  wipeSunset2: { who: HEROINE, text: '这就是规则转场：用一张图决定画面从哪里先消失。很老派，但我很喜欢。', face: 'happy', emote: 'note', next: 'hub' },
  wipeDay: { text: '——一眨眼，又回到了白天——', fx: ['wipe'], setTime: 'day', next: 'wipeDay2' },
  wipeDay2: { who: HEROINE, text: '天又亮啦。云是一直在飘的，你发现了吗？', face: 'happy', next: 'hub' },
  cg1: { who: HEROINE, text: 'CG 都收在下面啦。没解锁的那几张，点一下就会亮起来。', face: 'happy', emote: 'heart', goTo: 'cg', next: 'hub' },
  route1: { who: HEROINE, text: '梦境 ROUTE 在更下面。往下滑，四个梦境会一格一格换台哦。', face: 'shy', emote: 'heart', goTo: 'route', next: 'hub' },
};

type LogEntry = { id: number; who?: string; text: string };

/* ---------------- 天空 ---------------- */

type Rgb = [number, number, number];
const skyPalettes: Record<'day' | 'sunset', { top: Rgb; bottom: Rgb; glow: Rgb }> = {
  day: { top: [96, 186, 255], bottom: [214, 240, 255], glow: [255, 255, 240] },
  sunset: { top: [255, 140, 186], bottom: [255, 214, 160], glow: [255, 236, 190] },
};

const mix = (a: Rgb, b: Rgb, t: number): string =>
  `rgb(${a.map((value, index) => Math.round(value + (b[index] - value) * t)).join(',')})`;

function makeCloud(seed: number) {
  const canvas = document.createElement('canvas');
  const width = 540;
  const height = 270;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const puffs = 7 + Math.floor(rand() * 4);
  for (let layer = 0; layer < 2; layer += 1) {
    for (let index = 0; index < puffs; index += 1) {
      const x = 120 + rand() * (width - 240);
      const y = 116 + rand() * 46 - (layer ? 12 : 0);
      const r = 34 + rand() * 46;
      const gradient = ctx.createRadialGradient(x, y - r * 0.3, r * 0.1, x, y, r);
      if (layer === 0) {
        gradient.addColorStop(0, 'rgba(206, 224, 246, 0.9)');
        gradient.addColorStop(1, 'rgba(206, 224, 246, 0)');
      } else {
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.88)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      }
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y + (layer ? 0 : 10), r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return canvas;
}

function SkyCanvas({ time }: { time: 'day' | 'sunset' }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetRef = useRef(time === 'sunset' ? 1 : 0);
  const kickRef = useRef<(() => void) | null>(null);
  const visible = useInView(canvasRef, '0px');
  targetRef.current = time === 'sunset' ? 1 : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !visible) return;
    const ctx = canvas.getContext('2d')!;
    const reduce = prefersReducedMotion();
    const clouds = Array.from({ length: 9 }, (_, index) => ({
      image: makeCloud(index * 7919 + 13),
      x: Math.random(),
      y: 0.04 + (index % 5) * 0.11 + Math.random() * 0.05,
      depth: 0.45 + (index % 3) * 0.28,
    }));
    let phase = targetRef.current;
    let frame = 0;
    let last = performance.now();
    const kick = () => {
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(draw);
    };
    kickRef.current = kick;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      phase += (targetRef.current - phase) * Math.min(dt * 2.4, 1);
      const { width, height } = canvas;
      const day = skyPalettes.day;
      const sunset = skyPalettes.sunset;
      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, mix(day.top, sunset.top, phase));
      sky.addColorStop(1, mix(day.bottom, sunset.bottom, phase));
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);

      const glow = ctx.createRadialGradient(width * 0.18, height * 0.9, 0, width * 0.18, height * 0.9, height * 0.9);
      glow.addColorStop(0, `${mix(day.glow, sunset.glow, phase).replace('rgb', 'rgba').replace(')', ', 0.75)')}`);
      glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      clouds.forEach((cloud) => {
        if (!reduce) cloud.x += dt * 0.008 * cloud.depth;
        if (cloud.x > 1.25) cloud.x = -0.35;
        const scale = (height / 900) * (0.7 + cloud.depth * 0.9);
        const cw = cloud.image.width * scale;
        const ch = cloud.image.height * scale;
        ctx.globalAlpha = 0.55 + cloud.depth * 0.4;
        ctx.drawImage(cloud.image, cloud.x * (width + cw) - cw, cloud.y * height, cw, ch);
      });
      ctx.globalAlpha = 1;

      if (phase > 0.01) {
        ctx.globalCompositeOperation = 'soft-light';
        ctx.fillStyle = `rgba(255, 150, 120, ${(phase * 0.35).toFixed(3)})`;
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'source-over';
      }
      frame = !reduce || Math.abs(targetRef.current - phase) > 0.002 ? requestAnimationFrame(draw) : 0;
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      kickRef.current = null;
      window.removeEventListener('resize', resize);
    };
  }, [visible]);

  useEffect(() => {
    kickRef.current?.();
  }, [time]);

  return <canvas className="gg-sky" ref={canvasRef} aria-hidden="true" />;
}

/* ---------------- 花瓣 ---------------- */

type PetalHandle = { burst: () => void };

type Petal = { x: number; y: number; vx: number; vy: number; rot: number; vrot: number; flip: number; vflip: number; size: number };

const PetalLayer = forwardRef<PetalHandle>(function PetalLayer(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const petals = useRef<Petal[]>([]);
  const visible = useInView(canvasRef, '0px');

  const spawn = (fromTop: boolean): Petal => ({
    x: Math.random(),
    y: fromTop ? -0.05 - Math.random() * 0.4 : Math.random(),
    vx: 0.02 + Math.random() * 0.04,
    vy: 0.05 + Math.random() * 0.06,
    rot: Math.random() * Math.PI * 2,
    vrot: (Math.random() - 0.5) * 2,
    flip: Math.random() * Math.PI * 2,
    vflip: 1.5 + Math.random() * 2.5,
    size: 7 + Math.random() * 7,
  });

  useImperativeHandle(ref, () => ({
    burst: () => {
      if (prefersReducedMotion()) return;
      petals.current.push(...Array.from({ length: 70 }, () => spawn(true)));
    },
  }));

  useEffect(() => {
    if (petals.current.length === 0) petals.current = Array.from({ length: 14 }, () => spawn(false));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !visible || prefersReducedMotion()) return;
    const ctx = canvas.getContext('2d')!;
    let frame = 0;
    let last = performance.now();
    let wind = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
    };
    resize();
    window.addEventListener('resize', resize);
    const onMove = (event: PointerEvent) => {
      wind = clamp(wind + (event.movementX ?? 0) * 0.0006, -0.25, 0.25);
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    const drawPetal = (p: Petal, w: number, h: number, scale: number) => {
      ctx.save();
      ctx.translate(p.x * w, p.y * h);
      ctx.rotate(p.rot);
      ctx.scale(Math.cos(p.flip) * scale, scale);
      const r = p.size;
      ctx.beginPath();
      ctx.moveTo(0, r);
      ctx.bezierCurveTo(r * 0.9, r * 0.55, r * 0.85, -r * 0.6, r * 0.22, -r);
      ctx.lineTo(0, -r * 0.72);
      ctx.lineTo(-r * 0.22, -r);
      ctx.bezierCurveTo(-r * 0.85, -r * 0.6, -r * 0.9, r * 0.55, 0, r);
      const gradient = ctx.createLinearGradient(0, -r, 0, r);
      gradient.addColorStop(0, '#ffe3ee');
      gradient.addColorStop(1, '#ff9cc2');
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.restore();
    };

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const { width, height } = canvas;
      const scale = Math.min(width, height) / 700;
      ctx.clearRect(0, 0, width, height);
      wind *= 0.98;
      petals.current = petals.current.filter((p) => p.y < 1.1 && p.x < 1.15 && p.x > -0.15);
      while (petals.current.length < 14) petals.current.push(spawn(true));
      petals.current.forEach((p) => {
        p.x += (p.vx + wind + Math.sin(now / 900 + p.rot) * 0.015) * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
        p.flip += p.vflip * dt;
        drawPetal(p, width, height, scale);
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
    };
  }, [visible]);

  return <canvas className="gg-petals" ref={canvasRef} aria-hidden="true" />;
});

/* ---------------- 表情气泡 ---------------- */

function EmoteBubble({ emote }: { emote: Emote }) {
  return (
    <span className={`gg-emote is-${emote}`} aria-hidden="true">
      <svg viewBox="0 0 64 56">
        <path className="gg-emote-bg" d="M32 3C16 3 4 12.5 4 25s9.4 19.6 21 21.6L22 54l13-7.3C49.6 45.4 60 37 60 25 60 12.5 48 3 32 3Z" />
        {emote === 'heart' && (
          <path className="gg-emote-ink is-pink" d="M32 37c-5.6-4.1-10-7.8-10-12.2 0-2.8 2.2-5 4.9-5 2.3 0 4.2 1.3 5.1 3.2.9-1.9 2.8-3.2 5.1-3.2 2.7 0 4.9 2.2 4.9 5 0 4.4-4.4 8.1-10 12.2Z" />
        )}
        {emote === 'note' && (
          <path className="gg-emote-ink" d="M27 35.5a4.5 3.6 0 1 1-2-3V15.8l16-3.8v18.5a4.5 3.6 0 1 1-2-3V17.6l-12 2.8Z" />
        )}
        {emote === 'sweat' && <path className="gg-emote-ink is-blue" d="M32 12c4.8 7 9 12 9 16.6a9 9 0 0 1-18 0C23 24 27.2 19 32 12Z" />}
        {emote === 'surprise' && (
          <g className="gg-emote-ink">
            <rect x="20" y="11" width="6" height="18" rx="3" />
            <circle cx="23" cy="35" r="3.4" />
            <path d="M33 17.5c0-4 3-6.5 7.2-6.5s7 2.6 7 6.1c0 5-6.2 5.5-6.2 10.4h-5c0-6.6 5.8-7.3 5.8-10.2 0-1.2-.8-2-1.9-2-1.3 0-2 .9-2 2.2Z" />
            <circle cx="39.4" cy="35" r="3.4" />
          </g>
        )}
      </svg>
    </span>
  );
}

/* ---------------- 主体 ---------------- */

type Overlay = 'log' | 'config' | null;

const cgItems = [
  { id: 'candy', title: 'CANDY HEART', src: assets.worksCandyHeart, pos: '38% 45%' },
  { id: 'dreamy', title: 'DREAMY FRAMES', src: assets.worksDreamyFrames, pos: '50% 25%' },
  { id: 'tiny', title: 'TINY EVENT', src: assets.worksTinyEvent, pos: '50% 40%' },
  { id: 'treasure', title: 'TREASURE BOX', src: assets.worksTreasureBox, pos: '50% 28%' },
  { id: 'heroine', title: '看板娘', src: assets.characterCutout, pos: '55% 22%' },
];

const titleMenu = [
  { id: 'start', label: 'START', sub: '开始' },
  { id: 'cg', label: 'CG', sub: '鉴赏' },
  { id: 'route', label: 'ROUTE', sub: '梦境' },
  { id: 'config', label: 'CONFIG', sub: '设置' },
] as const;

export default function GalgeHome() {
  const petalsRef = useRef<PetalHandle | null>(null);
  const cgRef = useRef<HTMLElement | null>(null);
  const routeRef = useRef<HTMLElement | null>(null);
  const screenRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const logId = useRef(0);

  const [mode, setMode] = useState<'title' | 'play'>('title');
  const [nodeId, setNodeId] = useState('intro1');
  const [shown, setShown] = useState(0);
  const [time, setTime] = useState<'day' | 'sunset'>('day');
  const [auto, setAuto] = useState(false);
  const [skip, setSkip] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [speed, setSpeed] = useState(34);
  const [autoDelay, setAutoDelay] = useState(1500);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [fxKeys, setFxKeys] = useState({ flash: 0, wipe: 0 });
  const [menuIndex, setMenuIndex] = useState(0);
  const [unlocked, setUnlocked] = useState<Set<string>>(() => new Set(['candy']));
  const [viewer, setViewer] = useState<string | null>(null);

  const node = script[nodeId];
  const chars = useMemo(() => Array.from(node.text), [node.text]);
  const typing = shown < chars.length;

  const scrollTo = (target: 'cg' | 'route') => {
    const element = target === 'cg' ? cgRef.current : routeRef.current;
    element?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  };

  /* 进入新的一句：特效 + 记录 + 打字 */
  useEffect(() => {
    if (mode !== 'play') return;
    setShown(0);
    logId.current += 1;
    setLog((items) => [...items.slice(-40), { id: logId.current, who: node.who, text: node.text }]);
    node.fx?.forEach((fx) => {
      if (fx === 'petals') petalsRef.current?.burst();
      if (fx === 'shake' && !prefersReducedMotion()) {
        stageRef.current?.animate(
          [
            { transform: 'translate(0, 0)' },
            { transform: 'translate(-14px, 6px) rotate(-0.6deg)' },
            { transform: 'translate(12px, -8px) rotate(0.5deg)' },
            { transform: 'translate(-9px, -4px)' },
            { transform: 'translate(7px, 5px)' },
            { transform: 'translate(-3px, 2px)' },
            { transform: 'translate(0, 0)' },
          ],
          { duration: 520, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
        );
      }
      if (fx === 'flash' || fx === 'wipe') {
        setFxKeys((keys) => ({ ...keys, [fx]: keys[fx] + 1 }));
      }
    });
    if (node.setTime) {
      const next = node.setTime;
      window.setTimeout(() => setTime(next), prefersReducedMotion() ? 0 : 420);
    }
  }, [mode, nodeId, node]);

  /* 打字机 */
  useEffect(() => {
    if (mode !== 'play' || !typing || overlay) return;
    if (skip || prefersReducedMotion()) {
      setShown(chars.length);
      return;
    }
    const timer = window.setInterval(() => {
      setShown((value) => Math.min(value + 1, chars.length));
    }, 1000 / speed);
    return () => window.clearInterval(timer);
  }, [chars.length, mode, overlay, skip, speed, typing]);

  const goNext = useCallback(() => {
    if (node.next) setNodeId(node.next);
  }, [node.next]);

  /* 打完字后的跳转 / 自动 / 快进 */
  useEffect(() => {
    if (mode !== 'play' || typing || overlay) return;
    if (node.goTo) {
      const target = node.goTo;
      const timer = window.setTimeout(() => scrollTo(target), 700);
      return () => window.clearTimeout(timer);
    }
    if (node.choices) {
      setSkip(false);
      return;
    }
    if (skip || auto) {
      const timer = window.setTimeout(goNext, skip ? 140 : autoDelay);
      return () => window.clearTimeout(timer);
    }
  }, [auto, autoDelay, goNext, mode, node.choices, node.goTo, overlay, skip, typing]);

  const advance = () => {
    if (overlay) return;
    if (typing) {
      setShown(chars.length);
      return;
    }
    if (!node.choices) goNext();
  };

  const choose = (choice: Choice) => {
    const next = choice.next === 'wipe' ? (time === 'day' ? 'wipeSunset' : 'wipeDay') : choice.next;
    setNodeId(next);
  };

  const start = () => {
    setMode('play');
    setNodeId('intro1');
    setAuto(false);
    setSkip(false);
    window.setTimeout(() => screenRef.current?.focus({ preventScroll: true }), 0);
  };

  const backToTitle = () => {
    setMode('title');
    setOverlay(null);
    setAuto(false);
    setSkip(false);
  };

  const runMenu = (id: (typeof titleMenu)[number]['id']) => {
    if (id === 'start') start();
    if (id === 'cg') scrollTo('cg');
    if (id === 'route') scrollTo('route');
    if (id === 'config') setOverlay('config');
  };

  const onScreenKey = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (mode === 'play' && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      advance();
    }
  };

  useEffect(() => {
    if (!overlay && !viewer) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOverlay(null);
        setViewer(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlay, viewer]);

  const face = mode === 'title' ? 'idle' : node.face ?? 'idle';
  const viewerItem = cgItems.find((item) => item.id === viewer);

  return (
    <div className="gg-root" data-time={time}>
      <main>
        <section
          ref={screenRef}
          className="gg-screen"
          data-mode={mode}
          tabIndex={-1}
          aria-label="BTORN 视觉小说"
          onKeyDown={onScreenKey}
          onClick={(event) => {
            if (mode !== 'play') return;
            if ((event.target as HTMLElement).closest('button, a, input, .gg-panel')) return;
            advance();
          }}
        >
          <div className="gg-stage" ref={stageRef}>
            <SkyCanvas time={time} />
            <div className="gg-sprite" data-face={face} key={`${nodeId}-${mode}`}>
              <img src={assets.characterCutout} alt="看板娘立绘" draggable={false} />
              {mode === 'play' && node.emote && <EmoteBubble emote={node.emote} />}
            </div>
            <PetalLayer ref={petalsRef} />
          </div>

          {fxKeys.flash > 0 && <i className="gg-flash" key={`flash-${fxKeys.flash}`} aria-hidden="true" />}
          {fxKeys.wipe > 0 && <i className="gg-wipe" key={`wipe-${fxKeys.wipe}`} aria-hidden="true" />}

          {mode === 'title' && (
            <div className="gg-title">
              <h1 className="gg-logo">
                <span className="sr-only">BTORN</span>
                <span aria-hidden="true">
                  BT<span>O</span>RN
                </span>
              </h1>
              <p className="gg-subtitle">
                <BlurText text="～ 星屑收藏家的小窝 ～" as="span" by="char" delay={40} />
              </p>
              <nav className="gg-menu" aria-label="标题菜单" style={{ '--idx': menuIndex } as CSSProperties}>
                <svg className="gg-menu-cursor" viewBox="0 0 40 40" aria-hidden="true">
                  <path d="M20 3l4.6 10.4L36 15l-8.6 7.6L30 34l-10-6-10 6 2.6-11.4L4 15l11.4-1.6Z" />
                </svg>
                {titleMenu.map((item, index) => (
                  <button
                    type="button"
                    key={item.id}
                    onMouseEnter={() => setMenuIndex(index)}
                    onFocus={() => setMenuIndex(index)}
                    onClick={() => runMenu(item.id)}
                  >
                    <b>{item.label}</b>
                    <small>{item.sub}</small>
                  </button>
                ))}
              </nav>
            </div>
          )}

          {mode === 'play' && node.choices && !typing && (
            <div className="gg-choices" role="group" aria-label="选项">
              {node.choices.map((choice, index) => (
                <button type="button" key={choice.label} style={{ '--i': index } as CSSProperties} onClick={() => choose(choice)}>
                  {choice.label}
                </button>
              ))}
            </div>
          )}

          {mode === 'play' && (
            <div className="gg-box" data-narration={!node.who}>
              {node.who && <span className="gg-name">{node.who}</span>}
              <div className="gg-quick" role="toolbar" aria-label="快捷菜单">
                <button type="button" aria-pressed={auto} onClick={() => setAuto((value) => !value)}>
                  AUTO
                </button>
                <button type="button" aria-pressed={skip} onClick={() => setSkip((value) => !value)}>
                  SKIP
                </button>
                <button type="button" onClick={() => setOverlay('log')}>
                  LOG
                </button>
                <button type="button" onClick={() => setOverlay('config')}>
                  CONFIG
                </button>
                <button type="button" onClick={backToTitle}>
                  TITLE
                </button>
              </div>
              <p className="gg-line" aria-live="polite">
                <span className="sr-only">{node.text}</span>
                <span aria-hidden="true">
                  {chars.slice(0, shown).join('')}
                  <span className="gg-ghost">{chars.slice(shown).join('')}</span>
                </span>
              </p>
              {!typing && !node.choices && <i className="gg-next" aria-hidden="true" />}
              <span className="sr-only">点击画面或按回车继续</span>
            </div>
          )}

          {overlay === 'log' && (
            <div className="gg-panel" role="dialog" aria-modal="true" aria-label="对话记录">
              <header>
                <h2>LOG</h2>
                <button type="button" className="gg-close" onClick={() => setOverlay(null)} aria-label="关闭对话记录" autoFocus>
                  <X size={20} />
                </button>
              </header>
              <ol className="gg-log">
                {log.length === 0 && <li className="gg-log-empty">还没有对话哦，先按 START 开始吧。</li>}
                {log.map((entry) => (
                  <li key={entry.id}>
                    <b>{entry.who ?? '旁白'}</b>
                    <p>{entry.text}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {overlay === 'config' && (
            <div className="gg-panel" role="dialog" aria-modal="true" aria-label="设置">
              <header>
                <h2>CONFIG</h2>
                <button type="button" className="gg-close" onClick={() => setOverlay(null)} aria-label="关闭设置" autoFocus>
                  <X size={20} />
                </button>
              </header>
              <label className="gg-range">
                <span>文字速度</span>
                <input type="range" min={10} max={80} value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
                <output>{speed} 字/秒</output>
              </label>
              <label className="gg-range">
                <span>自动播放间隔</span>
                <input
                  type="range"
                  min={600}
                  max={3000}
                  step={100}
                  value={autoDelay}
                  onChange={(event) => setAutoDelay(Number(event.target.value))}
                />
                <output>{(autoDelay / 1000).toFixed(1)} 秒</output>
              </label>
              <p className="gg-preview" key={speed}>
                <TypePreview speed={speed} />
              </p>
            </div>
          )}
        </section>

        <section className="gg-cg" id="cg" ref={cgRef} aria-labelledby="gg-cg-title">
          <header className="gg-section-head">
            <h2 id="gg-cg-title">
              <BlurText text="CG 鉴赏" as="span" by="char" delay={70} />
            </h2>
            <p>
              已解锁 <b>{unlocked.size}</b> / {cgItems.length + 1}
            </p>
          </header>
          <ul className="gg-cg-grid">
            {cgItems.map((item, index) => {
              const isOpen = unlocked.has(item.id);
              return (
                <li key={item.id} style={{ '--i': index } as CSSProperties}>
                  <button
                    type="button"
                    className="gg-cg-card"
                    data-unlocked={isOpen}
                    data-cutout={item.id === 'heroine'}
                    onClick={() => {
                      if (isOpen) setViewer(item.id);
                      else setUnlocked((set) => new Set(set).add(item.id));
                    }}
                    aria-label={isOpen ? `查看 ${item.title}` : `解锁 ${item.title}`}
                  >
                    <img src={item.src} alt="" style={{ objectPosition: item.pos }} loading="lazy" />
                    {!isOpen && (
                      <span className="gg-cg-lock">
                        <Lock size={22} strokeWidth={2.2} aria-hidden="true" />
                        点一下解锁
                      </span>
                    )}
                    <span className="gg-cg-caption">{isOpen ? item.title : '？？？'}</span>
                  </button>
                </li>
              );
            })}
            <li style={{ '--i': cgItems.length } as CSSProperties}>
              <div className="gg-cg-card is-empty">
                <span className="gg-cg-lock">
                  <Lock size={22} strokeWidth={2.2} aria-hidden="true" />
                  还没收集到
                </span>
                <span className="gg-cg-caption">？？？</span>
              </div>
            </li>
          </ul>
        </section>

        <section className="gg-route" id="route" ref={routeRef} aria-labelledby="gg-route-title">
          <header className="gg-chapter">
            <h2 id="gg-route-title">
              <ShinyText text="梦境 ROUTE" speed={2.6} color="#173a5e" shineColor="rgba(255,255,255,0.95)" />
            </h2>
            <p>四个梦境，一格一格换台。点画面可以暂停。</p>
          </header>
          <DreamConsole />
        </section>
      </main>

      <footer className="gg-end">
        <h2 className="gg-end-mark">END</h2>
        <p className="gg-end-thanks">感谢游玩</p>
        <p>插画有原创也有收藏，版权归各自作者。</p>
        <button
          type="button"
          onClick={() => {
            backToTitle();
            window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
          }}
        >
          回到标题
        </button>
      </footer>

      {viewerItem && (
        <div className="gg-viewer" role="dialog" aria-modal="true" aria-label={viewerItem.title} onClick={() => setViewer(null)}>
          <img src={viewerItem.src} alt={viewerItem.title} data-cutout={viewerItem.id === 'heroine'} />
          <button type="button" className="gg-close" onClick={() => setViewer(null)} aria-label="关闭 CG" autoFocus>
            <X size={22} />
          </button>
        </div>
      )}
    </div>
  );
}

function TypePreview({ speed }: { speed: number }) {
  const text = '这是现在的文字速度，一个字一个字地出来～';
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setCount(text.length);
      return;
    }
    setCount(0);
    const timer = window.setInterval(() => setCount((value) => (value >= text.length ? 0 : value + 1)), 1000 / speed);
    return () => window.clearInterval(timer);
  }, [speed]);
  return (
    <>
      {text.slice(0, count)}
      <span className="gg-ghost">{text.slice(count)}</span>
    </>
  );
}
