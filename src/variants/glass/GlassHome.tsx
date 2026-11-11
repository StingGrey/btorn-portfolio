import '@fontsource/fredoka/latin-400.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/vt323/latin-400.css';
import './glass.css';
import { memo, useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { ChevronLeft, ChevronRight, Magnet, Pause, Play, Power } from 'lucide-react';
import { DreamConsole } from '../../components/DreamConsole';
import { Logo } from '../../components/Logo';
import { assets } from '../../content/assets';
import { prefersReducedMotion } from '../shared';
import { AsciiEnd } from './AsciiEnd';
import { ConsoleGlitch } from './ConsoleGlitch';
import { channels, consoleCopy, tagline } from './content';
import { CrashScreen, type CrashHandle } from './CrashScreen';
import { Glass } from './Glass';
import { startSmoothScroll, stopSmoothScroll } from './smoothScroll';
import { GlitchWindows, TOTAL_POPUPS } from './GlitchWindows';
import type { HeroStage } from './three/heroStage';
import { tvGoesUp, type TvSet, type TvState } from './tv/tvSet';

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * 整段滚动序列：
 * 首屏玻璃碎掉 → 「梦境分类」控制台铺满全屏（滚动切四个分类）→ 画面缩进一台电视 →
 * 电视退到一边，从里面冒出越来越多的故障弹窗 → 蓝屏死机 → 转圈重启 → ASCII 开机自检 → ASCII 页脚。
 * 控制台和电视都会提前垫在下面，裂缝里、淡出时才能直接看到它们。
 * 位置都按「舞台滚过的距离」写，单位是 svh（一屏高），TRAVEL 是舞台一共要滚多远。
 */
const TRAVEL = 1980;
const at = (svh: number) => svh / TRAVEL;
const SEQ = {
  heroEnd: at(500),
  consoleShow: at(310),
  // 控制台 ⇄ 电视的交接，全程由滚动位置决定，往回滑就是原样倒放：
  // tearStart → dissolveStart 控制台越撕越碎；dissolveStart → consoleEnd 控制台化进雪花里；
  // consoleEnd → snowEnd 雪花散开，露出电视里的同一幅画面
  tearStart: at(686),
  dissolveStart: at(704),
  consoleEnd: at(720),
  snowEnd: at(748),
  tvShow: at(640),
  zoomStart: at(740),
  zoomEnd: at(920),
  interactive: at(940),
  // 电视退到一边，弹窗一个接一个冒出来，越往后越密
  asideStart: at(990),
  asideEnd: at(1070),
  popStart: at(1040),
  popEnd: at(1420),
  // 撑不住了：整层乱跳 → 蓝屏（完成度跟着滚动涨）→ 转圈重启 → 黑一下 → 打开机自检
  crashStart: at(1390),
  bsodIn: at(1450),
  percentEnd: at(1630),
  restartEnd: at(1740),
  bootStart: at(1765),
  bootEnd: at(1930),
  // 控制台铺满全屏、以及电视画面还占着大半个视口的时候，导航先收起来
  navHide: at(430),
  navShow: at(840),
};

/** 滚轮在这几段额外放慢（factor 是倍率），两头各有一小段过渡，不会突然一顿 */
const SLOW_ZONES = [
  { from: at(380), to: at(540), factor: 0.6 }, // 裂开、像素长出来、玻璃撕走
  { from: at(680), to: at(760), factor: 0.55 }, // 控制台撕碎 → 雪花 → 电视
  { from: at(1380), to: at(1470), factor: 0.55 }, // 弹窗撑不住 → 蓝屏
  { from: at(1760), to: at(1940), factor: 0.7 }, // 开机自检一行行打出来
];
const RAMP = at(24);
function wheelSpeedAt(p: number) {
  let speed = 1;
  for (const zone of SLOW_ZONES) {
    const inside = smooth(zone.from - RAMP, zone.from, p) * (1 - smooth(zone.to, zone.to + RAMP, p));
    speed = Math.min(speed, 1 - (1 - zone.factor) * inside);
  }
  return speed;
}
const TOTAL_TOYS = 7;

// 滚动时首页每帧都会更新完整度，控制台的属性没变就别跟着重渲染
const ConsoleView = memo(DreamConsole);

type Status = 'loading' | 'ready' | 'failed';
type Phase = 'hero' | 'console' | 'tv';

/**
 * 每次挂载都建一个新的舞台元素：StrictMode 下两个渲染器共用画布时，先销毁的那个会把画布上下文一起关掉。
 * 首屏是一块 WebGPU 画布；电视不用 3D，是一个装着 DOM 的 div。
 */
function useStage<E extends HTMLElement, T extends { dispose: () => void }>(
  hostRef: RefObject<HTMLDivElement | null>,
  tag: 'canvas' | 'div',
  create: (element: E) => Promise<T>,
  label?: string,
  enabled = true,
) {
  const stageRef = useRef<T | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [stage, setStage] = useState<T | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !enabled) return;
    const element = document.createElement(tag) as unknown as E;
    if (label) {
      // 画布是一整张图；div 里面是真的按钮，当成一组控件
      element.setAttribute('role', tag === 'canvas' ? 'img' : 'group');
      element.setAttribute('aria-label', label);
    } else {
      element.setAttribute('aria-hidden', 'true');
    }
    host.appendChild(element);
    let disposed = false;
    let mounted: T | null = null;
    create(element)
      .then((created) => {
        if (disposed) {
          created.dispose();
          return;
        }
        mounted = created;
        stageRef.current = created;
        setStage(created);
        setStatus('ready');
        // 性能面板和控制台里能直接看到两块画布各自什么时候就绪
        performance.mark(label ? 'gl-tv-ready' : 'gl-hero-ready');
      })
      .catch((error: unknown) => {
        console.error(error);
        if (!disposed) setStatus('failed');
      });
    return () => {
      disposed = true;
      mounted?.dispose();
      stageRef.current = null;
      setStage(null);
      element.remove();
    };
  }, [create, enabled, hostRef, label, tag]);

  return { stageRef, stage, status };
}

const timecode = (seconds: number) => {
  const total = Math.floor(seconds);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

const REPO_URL = 'https://github.com/StingGrey/btorn-portfolio';

/** GitHub 的猫爪标志（lucide 已经不带品牌图标了，直接内联官方的 mark-github） */
function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
  );
}

export default function GlassHome() {
  const [reducedMotion] = useState(prefersReducedMotion);
  const [forceWebGL] = useState(() => new URLSearchParams(window.location.search).has('webgl'));
  const seqRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLElement | null>(null);
  const heroHostRef = useRef<HTMLDivElement | null>(null);
  const tvHostRef = useRef<HTMLDivElement | null>(null);
  const consoleLayerRef = useRef<HTMLDivElement | null>(null);

  const [jarCount, setJarCount] = useState(0);
  const [tvState, setTvState] = useState<TvState>({ channel: 0, power: true, playing: true, seconds: 0 });
  const [phase, setPhase] = useState<Phase>('hero');
  const [consoleMounted, setConsoleMounted] = useState(false);
  const [consoleVisible, setConsoleVisible] = useState(false);
  const [tvVisible, setTvVisible] = useState(false);
  const [remote, setRemote] = useState(false);
  const [selected, setSelected] = useState(0);
  const [entryGlitch, setEntryGlitch] = useState(0);
  const [navHidden, setNavHidden] = useState(false);
  // 左上角 logo 和右上角 GitHub 一起自动隐藏：往下滚就收起来，往上滚、或者指针移到页面顶部就探出来；在页面最顶上一直在
  const [navAway, setNavAway] = useState(false);
  const [navPeek, setNavPeek] = useState(false);
  const [asciiWorld, setAsciiWorld] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const [popCount, setPopCount] = useState(0);
  const [crash, setCrash] = useState<'off' | 'soft' | 'hard'>('off');
  const [popLayout, setPopLayout] = useState<'side' | 'up'>(() => (tvGoesUp(window.innerWidth, window.innerHeight) ? 'up' : 'side'));
  const popupsRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef(0);
  const crashRef = useRef<CrashHandle | null>(null);
  // 滚动回调里要读到最新的分类（可能是滚出来的，也可能是在控制台里点出来的）
  const selectedRef = useRef(0);
  selectedRef.current = selected;

  const createHero = useCallback(
    (canvas: HTMLCanvasElement) =>
      import('./three/heroStage').then(({ createHeroStage }) =>
        createHeroStage(canvas, { reducedMotion, forceWebGL, onJarCount: setJarCount }),
      ),
    [forceWebGL, reducedMotion],
  );
  const createTv = useCallback(
    (root: HTMLDivElement) => import('./tv/tvSet').then(({ createTvSet }) => createTvSet(root, { reducedMotion, onChange: setTvState })),
    [reducedMotion],
  );
  const hero = useStage<HTMLCanvasElement, HeroStage>(heroHostRef, 'canvas', createHero);
  // 电视要滚过大半个页面才露面：等首屏就绪、浏览器闲下来再建，不和首屏抢下载（它那四张插画）和主线程。
  // 打开页面时已经滚在后半段（比如刷新、带锚点进来）就不等了
  const [tvWanted, setTvWanted] = useState(false);
  const tv = useStage<HTMLDivElement, TvSet>(tvHostRef, 'div', createTv, 'A small retro TV playing the Dream Index', tvWanted);
  useEffect(() => {
    if (tvWanted || hero.status === 'loading') return;
    const start = () => setTvWanted(true);
    if (!window.requestIdleCallback) {
      const timer = window.setTimeout(start, 300);
      return () => window.clearTimeout(timer);
    }
    const idle = window.requestIdleCallback(start, { timeout: 1200 });
    return () => window.cancelIdleCallback(idle);
  }, [hero.status, tvWanted]);
  const heroStage = hero.stageRef;
  const tvStage = tv.stageRef;

  // 滚动进度驱动整段序列
  useEffect(() => {
    const seq = seqRef.current;
    const stage = stageRef.current;
    if (!seq || !stage) return;
    let frame = 0;
    let lastIndex = -1;
    let lastLineY = -1;
    let lastY = window.scrollY;
    let travelled = 0;
    // 每帧都会算一遍这些状态：只有值真的变了才交给 React，免得滚一帧就把整页（页脚一大块字、九十多个弹窗）重新对比一遍
    const last = new Map<string, unknown>();
    const put = <T,>(key: string, value: T, set: (next: T) => void) => {
      if (last.has(key) && last.get(key) === value) return;
      last.set(key, value);
      set(value);
    };
    const update = () => {
      frame = 0;
      const rect = seq.getBoundingClientRect();
      const travel = Math.max(rect.height - stage.offsetHeight, 1);
      const p = clamp01(-rect.top / travel);
      const onScreen = rect.bottom > 0 && rect.top < window.innerHeight;
      const heroP = clamp01(p / SEQ.heroEnd);
      progressRef.current = p;

      const heroApi = heroStage.current;
      heroApi?.setProgress(heroP);
      heroApi?.setActive(onScreen && p < SEQ.heroEnd + at(20));

      // 控制台：碎完以后每滚一段换一个分类
      const span = SEQ.consoleEnd - SEQ.heroEnd;
      const index = p < SEQ.heroEnd ? 0 : Math.min(3, Math.floor(((p - SEQ.heroEnd) / span) * 4));
      if (p <= SEQ.consoleEnd && index !== lastIndex) {
        lastIndex = index;
        selectedRef.current = index;
        setSelected(index);
      }
      // 绿色扫描线跟着滚动走：直接写 CSS 变量。走 React 属性的话每滚一帧整个控制台都要重渲染一遍
      const lineY = (0.1 + clamp01((p - SEQ.heroEnd) / span) * 0.8) * 100;
      const consoleSection = consoleLayerRef.current?.firstElementChild as HTMLElement | null;
      if (consoleSection && Math.abs(lineY - lastLineY) > 0.05) {
        lastLineY = lineY;
        consoleSection.style.setProperty('--works-line-y', `${lineY.toFixed(2)}%`);
      }
      if (p > at(300)) put('tvWanted', true, setTvWanted);
      // 玻璃开始一条条撕走 → 碎完：控制台这一路在错位，碎完以后慢慢稳住
      // （之前从裂缝刚透出来就开滤镜，可那时控制台几乎全被玻璃挡着，白白耗性能）
      const entry = smooth(at(420), at(460), p) * (1 - smooth(at(490), at(535), p));
      // 要缩进电视前越撕越碎，撕到头再化进电视的雪花里
      const exit = smooth(SEQ.tearStart, SEQ.dissolveStart, p);
      put('entry', Math.round(Math.max(entry, exit) * 50) / 50, setEntryGlitch);
      const dissolve = smooth(SEQ.dissolveStart, SEQ.consoleEnd, p);
      consoleLayerRef.current?.style.setProperty('--gl-dissolve', dissolve.toFixed(3));
      put('handoff', p > SEQ.dissolveStart - at(10), setHandoff);

      const tvApi = tvStage.current;
      if (tvApi) {
        tvApi.setSequence(
          smooth(SEQ.zoomStart, SEQ.zoomEnd, p),
          smooth(SEQ.asideStart, SEQ.asideEnd, p),
          1 - smooth(SEQ.consoleEnd + at(3), SEQ.snowEnd, p),
        );
        // 蓝屏盖住以后电视就不用跑了
        tvApi.setActive(onScreen && p > SEQ.tvShow && p < SEQ.bsodIn);
        tvApi.setInteractive(p > SEQ.interactive);
        // 雪花还盖满屏幕的这一段，电视悄悄对齐成开机、和控制台同一个分类。
        // 不然在电视那儿换过台或者关了机再滚回来，雪花散开时两边的画面就对不上了
        if (p < SEQ.consoleEnd + at(3)) tvApi.sync(selectedRef.current);
      }

      put('phase', p < SEQ.heroEnd - at(70) ? 'hero' : p < SEQ.consoleEnd ? 'console' : 'tv', setPhase);
      put('consoleVisible', p >= SEQ.consoleShow && p < SEQ.consoleEnd, setConsoleVisible);
      put('tvVisible', p > SEQ.tvShow, setTvVisible);
      // 遥控条只在电视停在正中间的那一段出现；退到一边、开始冒弹窗就收起来
      put('remote', p > SEQ.interactive && p < SEQ.asideStart, setRemote);
      put('navHidden', (p >= SEQ.navHide && p < SEQ.navShow) || (p >= SEQ.crashStart && p < SEQ.bootEnd), setNavHidden);
      // 滚动方向：同一个方向累计滚过 10px 才算数，免得触控板的小抖动让导航一闪一闪
      const y = window.scrollY;
      const delta = y - lastY;
      lastY = y;
      travelled = Math.sign(delta) === Math.sign(travelled) ? travelled + delta : delta;
      if (y < 40) put('navAway', false, setNavAway);
      else if (travelled > 10) put('navAway', true, setNavAway);
      else if (travelled < -10) put('navAway', false, setNavAway);
      put('ascii', p >= SEQ.bootStart, setAsciiWorld);

      // 弹窗：越往后越密（数量按进度的 1.6 次方涨）
      const popT = clamp01((p - SEQ.popStart) / (SEQ.popEnd - SEQ.popStart));
      put('popCount', p <= SEQ.popStart ? 0 : Math.min(TOTAL_POPUPS, 1 + Math.floor((TOTAL_POPUPS - 1) * popT ** 1.6)), setPopCount);
      const layer = popupsRef.current;
      // 进度条的长度和百分比：直接写 CSS 变量，而且只在弹窗那一段、值变了才写
      if (layer && p > SEQ.popStart - at(10) && p < SEQ.bsodIn) {
        const progress = popT.toFixed(3);
        if (last.get('gwProgress') !== progress) {
          last.set('gwProgress', progress);
          layer.style.setProperty('--gw-progress', progress);
          layer.style.setProperty('--gw-pct', String(Math.round(popT * 100)));
        }
      }
      const shake = smooth(SEQ.crashStart, SEQ.bsodIn, p);
      put('crash', p >= SEQ.bsodIn || shake < 0.04 ? 'off' : shake < 0.55 ? 'soft' : 'hard', setCrash);

      // 蓝屏 → 转圈重启 → 黑屏 → 开机自检
      const screen =
        p < SEQ.bsodIn ? 'off' : p < SEQ.percentEnd ? 'bsod' : p < SEQ.restartEnd ? 'restart' : p < SEQ.bootStart ? 'black' : 'boot';
      crashRef.current?.set(
        screen,
        (p - SEQ.bsodIn) / (SEQ.percentEnd - SEQ.bsodIn),
        (p - SEQ.bootStart) / (SEQ.bootEnd - SEQ.bootStart),
      );
      // 蓝屏、重启、开机这几屏是整屏盖住的：把下面的电视、弹窗、首屏都藏起来，舞台底色换成这一屏的颜色。
      // 不然快速往回滑时，浏览器先挪图层、后补画，没来得及画的那一帧会透出下面早就画好的电视
      if (stage.dataset.screen !== screen) stage.dataset.screen = screen;
      put('popLayout', tvGoesUp(window.innerWidth, window.innerHeight) ? 'up' : 'side', setPopLayout);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [hero.status, tv.status, heroStage, tvStage]);

  // 控制台第一次露出来时要一口气解码图片、绘制和栅格化一整屏带滤镜的 DOM，会卡住一下。
  // 所以首屏一就绪就趁浏览器空闲把它挂好、把四张图解码好，再让它在完全透明的状态下先画一遍。
  const [warming, setWarming] = useState(false);
  useEffect(() => {
    if (hero.status === 'loading') return;
    let cancelled = false;
    let warmTimer = 0;
    const decoded: HTMLImageElement[] = [];
    const prepare = () => {
      if (cancelled) return;
      consoleCopy.items.forEach((item) => {
        const image = new Image();
        image.src = item.src;
        image.decode().catch(() => undefined);
        decoded.push(image);
      });
      setConsoleMounted(true);
      setWarming(true);
      warmTimer = window.setTimeout(() => setWarming(false), 600);
    };
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(prepare, { timeout: 2500 })
      : window.setTimeout(prepare, 1200);
    return () => {
      cancelled = true;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      window.clearTimeout(warmTimer);
      decoded.length = 0;
    };
  }, [hero.status]);

  // 电视跟着控制台当前的分类走，缩进去的时候画面是同一张（在控制台里直接点分类、没有滚动时靠这里对齐）
  useEffect(() => {
    if (tv.status === 'ready' && phase !== 'tv') tvStage.current?.sync(selected);
  }, [phase, selected, tv.status, tvStage]);

  // 滚轮滚动：不和滚轮一比一，缓着走，密的几段再慢一点
  useEffect(() => {
    if (reducedMotion) return;
    startSmoothScroll(() => wheelSpeedAt(progressRef.current));
    return () => stopSmoothScroll();
  }, [reducedMotion]);

  // 指针移到页面顶部，两个角上的胶囊就探出来（手机上没有指针，靠往上滚）
  useEffect(() => {
    let frame = 0;
    let y = 0;
    const check = () => {
      frame = 0;
      setNavPeek(y < 96);
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      y = event.clientY;
      if (!frame) frame = requestAnimationFrame(check);
    };
    const onLeave = () => setNavPeek(false);
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  const channel = channels[tvState.channel];
  const tvApi = () => tvStage.current;
  const tune = useCallback((index: number) => tvStage.current?.setChannel(index), [tvStage]);
  const degaussTv = useCallback(() => tvStage.current?.degauss(), [tvStage]);
  const kickTv = useCallback(() => tvStage.current?.kick(), [tvStage]);
  const screenRect = useCallback(() => tvStage.current?.screenRect() ?? null, [tvStage]);
  const tvReady = tv.status === 'ready';
  const inHero = phase === 'hero';

  return (
    <div
      className="gl-root"
      data-phase={phase}
      data-nav={navHidden ? 'off' : navAway && !navPeek ? 'away' : 'on'}
      data-world={asciiWorld ? 'ascii' : 'glass'}
      data-crash={reducedMotion ? 'off' : crash}
    >
      <Glass className="gl-nav" radius={999} bezel={14} refraction={28} blur={12}>
        <Logo href="#top" />
      </Glass>
      <Glass className="gl-nav gl-nav-repo" radius={999} bezel={14} refraction={28} blur={12}>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" aria-label="Source code on GitHub">
          <GitHubMark />
          <span>GitHub</span>
        </a>
      </Glass>

      <main>
        <div className="gl-seq" ref={seqRef} id="top" style={{ height: `${TRAVEL + 100}svh` }}>
          <span className="gl-anchor" id="dreams" style={{ top: `calc((100% - 100svh) * ${SEQ.heroEnd + at(20)})` }} />
          <span className="gl-anchor" id="signal" style={{ top: `calc((100% - 100svh) * ${at(960)})` }} />

          <section className="gl-stage" ref={stageRef} aria-labelledby="gl-hero-title" data-phase={phase}>
            <h1 id="gl-hero-title" className="sr-only">
              BTORN
            </h1>
            <p className="sr-only">
              {tagline}. Six frosted glass toys and the pink O of the logo float next to a glass jar; drag and toss them into
              the jar, then scroll to break the glass and find the Dream Index behind it. Further down the Dream Index
              shrinks into a little TV that leaks glitchy popup windows until the page crashes and reboots in ASCII.
            </p>

            <div className="gl-layer gl-layer-tv" data-visible={tvVisible} data-interactive={remote}>
              <div className="gl-canvas-host" ref={tvHostRef} data-status={tv.status} />
              {tv.status === 'failed' && <img className="gl-tv-fallback" src={channel.src} alt={`${channel.title} illustration`} />}
            </div>

            <div
              className="gl-layer gl-layer-console"
              ref={consoleLayerRef}
              data-visible={consoleVisible}
              data-handoff={handoff}
              data-warming={warming && !consoleVisible}
              inert={phase !== 'console'}
            >
              {consoleMounted && (
                <ConsoleView
                  embedded
                  active={phase === 'console'}
                  activeIndex={selected}
                  copy={consoleCopy}
                  onSelect={setSelected}
                />
              )}
              {consoleMounted && (
                <div className="gl-console-fx" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
              )}
            </div>

            <div className="gl-layer gl-layer-hero" data-interactive={inHero}>
              <div className="gl-canvas-host" ref={heroHostRef} data-status={hero.status} />
              {hero.status === 'failed' && (
                <div className="gl-fallback">
                  <img src={assets.characterCutout} alt="The BTORN mascot, a pink-haired angel" />
                  <p className="gl-fallback-logo">
                    BT<span>O</span>RN
                  </p>
                  <p>{tagline}</p>
                </div>
              )}
            </div>

            {tvReady && (
              <GlitchWindows
                layerRef={popupsRef}
                count={popCount}
                layout={popLayout}
                channel={tvState.channel}
                power={tvState.power}
                jarCount={jarCount}
                totalToys={TOTAL_TOYS}
                reducedMotion={reducedMotion}
                onTune={tune}
                onDegauss={degaussTv}
                onPop={kickTv}
                screenRect={screenRect}
              />
            )}

            <CrashScreen ref={crashRef} jarCount={jarCount} totalToys={TOTAL_TOYS} popups={TOTAL_POPUPS} />

            <Glass className="gl-remote" radius={30} bezel={16} refraction={30} blur={12} data-hidden={!remote || !tvReady}>
              <p className="gl-remote-now" aria-live="polite">
                <span>CH {channel.number}</span>
                <b>{channel.title}</b>
              </p>
              <div className="gl-controls" role="group" aria-label="TV controls">
                <button type="button" onClick={() => tvApi()?.prev()} aria-label="Previous channel" disabled={!remote}>
                  <ChevronLeft size={20} strokeWidth={2.2} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => tvApi()?.togglePlay()} aria-label={tvState.playing ? 'Pause' : 'Play'} disabled={!remote}>
                  {tvState.playing ? <Pause size={18} strokeWidth={2.2} aria-hidden="true" /> : <Play size={18} strokeWidth={2.2} aria-hidden="true" />}
                </button>
                <button type="button" onClick={() => tvApi()?.next()} aria-label="Next channel" disabled={!remote}>
                  <ChevronRight size={20} strokeWidth={2.2} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => tvApi()?.togglePower()} aria-label="Power" aria-pressed={tvState.power} disabled={!remote}>
                  <Power size={18} strokeWidth={2.2} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="gl-degauss"
                  onClick={() => tvApi()?.degauss()}
                  aria-label="Degauss"
                  disabled={!remote || !tvState.power}
                >
                  <Magnet size={17} strokeWidth={2.2} aria-hidden="true" />
                  <span>Degauss</span>
                </button>
              </div>
              <p className="gl-time">
                <span>{tvState.power ? (tvState.playing ? 'ON AIR' : 'PAUSED') : 'STANDBY'}</span>
                <time>{timecode(tvState.seconds)}</time>
              </p>
            </Glass>
          </section>
        </div>
      </main>

      <ConsoleGlitch
        target={consoleLayerRef}
        active={phase === 'console'}
        entry={entryGlitch}
        burstKey={selected}
        reducedMotion={reducedMotion}
      />

      <AsciiEnd reducedMotion={reducedMotion} />
    </div>
  );
}
