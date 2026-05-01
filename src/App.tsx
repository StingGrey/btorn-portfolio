import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ExternalLink,
  Github,
  Layers3,
  Mail,
  Orbit,
  Pause,
  Play,
  ScanLine,
  Send,
  Sparkles,
  Zap,
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Aurora,
  BlurText,
  Carousel,
  ClickSpark,
  CircularText,
  CountUp,
  DecryptedText,
  Dock,
  FlowingMenu,
  GlareHover,
  InfiniteScroll,
  Magnet,
  ScrambledText,
  ScrollReveal,
  PixelTransition,
  ScrollFloat,
  ScrollVelocity,
  ShinyText,
  Silk,
  SplitText,
  SpotlightCard,
  StarBorder,
  TextType,
  TextPressure,
  TiltedCard,
  TrueFocus,
} from './components/react-bits';

gsap.registerPlugin(ScrollTrigger);

const WebglBackdrop = lazy(() => import('./components/webgl-backdrop/WebglBackdrop'));
const Lanyard = lazy(() => import('./components/lanyard/Lanyard'));
const SplashCursor = lazy(() => import('./components/splash-cursor/SplashCursor'));

const assets = {
  characterTech: '/assets/character-tech.webp',
  characterCutout: '/assets/character-orbit-cutout.png',
  gallerySky: '/assets/gallery-sky.webp',
  galleryTeam: '/assets/gallery-team.webp',
  galleryPinkArrow: '/assets/gallery-pink-arrow.webp',
  galleryNight: '/assets/gallery-night.webp',
  galleryStudy: '/assets/gallery-study.webp',
  galleryExtra: '/assets/gallery-extra.webp',
  galleryFreshReader: '/assets/gallery-fresh-reader.jpg',
  galleryFreshBlue: '/assets/gallery-fresh-blue.jpg',
  galleryFreshPoster: '/assets/gallery-fresh-poster.jpg',
  cutoutLilacDriver: '/assets/cutout-lilac-driver.png',
  cutoutFlora: '/assets/cutout-flora.png',
  characterTechHuman: '/assets/character-tech-cutout-human.png',
  sceneGarden: '/assets/scene-garden.webp',
  sceneMoon: '/assets/scene-moon.webp',
  sceneSteps: '/assets/scene-steps.webp',
  sceneCandySky: '/assets/scene-candy-sky.webp',
  sceneCloseup: '/assets/scene-closeup.webp',
  materialGlassRoom: '/assets/material-glass-room.jpg',
  materialLongPink: '/assets/material-long-pink.jpg',
  materialWideLilac: '/assets/material-wide-lilac.jpg',
  materialSkyPanorama: '/assets/material-sky-panorama.jpg',
  bitsCandyBath: '/assets/bits-candy-bath.jpg',
  bitsSchoolAngel: '/assets/bits-school-angel.jpg',
  bitsOrangePortrait: '/assets/bits-orange-portrait.jpg',
  signalFreshFlower: '/assets/signal-fresh-flower.jpg',
};

const stacks = [
  { name: 'ClickSpark', text: '整页点击会炸出一点短促火花，像信号被手指点亮。', bit: 'React Bits / feedback' },
  { name: 'Magnet', text: '链接和图册靠近鼠标会轻轻跟手，互动更像有磁场。', bit: 'React Bits / pointer' },
  { name: 'SpotlightCard', text: '技术矩阵用聚光扫过，信息密但不会变成普通说明卡。', bit: 'React Bits / surface' },
  { name: 'StarBorder', text: '首屏代码片和留言框外圈有星光流动，收住亮点但不抢主视觉。', bit: 'React Bits / accent' },
  { name: 'WebGL', text: '首屏继续保留硬核轨道，做这个站的第一眼记忆点。', bit: 'Three.js / core' },
  { name: 'GSAP', text: '滚动还是靠时间轴推进，React Bits 只补手感，不抢主叙事。', bit: 'Motion / glue' },
];

const notes = [
  ['phase 01', '首屏保留 BTORN 的轨道启动感，像系统正在加载一个二次元小宇宙。'],
  ['phase 02', '下滑进入抠图切片，角色从画框里冲出来，别再只是普通图片卡片。'],
  ['phase 03', '作品区改成大图预览和轨道列表，鼠标经过会有光线和位移反馈。'],
  ['phase 04', '图册区改成横向胶片，把素材变成浏览节奏，而不是平铺图库。'],
];

const gallery = [
  { src: assets.gallerySky, title: '粉色箭头', tag: '第一眼' },
  { src: assets.galleryFreshReader, title: '书页边缘', tag: '新素材' },
  { src: assets.galleryFreshBlue, title: '蓝调小窗', tag: '新素材' },
  { src: assets.galleryFreshPoster, title: '海报切片', tag: '新素材' },
  { src: assets.galleryStudy, title: '学习角落', tag: '认真一下' },
  { src: assets.galleryExtra, title: '备用宝物', tag: '再藏一点' },
];

const bitMetrics = [
  { label: '组件接入', value: 28, suffix: '+' },
  { label: '文本效果', value: 12, suffix: '种' },
  { label: '互动密度', value: 96, suffix: '%' },
];

const streamItems = [
  'ShinyText',
  'ScrollFloat',
  'InfiniteScroll',
  'GlareHover',
  'TextPressure',
  'TextType',
  'DecryptedText',
  'TrueFocus',
  'ScrollReveal',
  'ScrollVelocity',
  'CurvedLoop',
  'ScrambledText',
  'CircularText',
  'Aurora',
  'Silk',
  'Carousel',
  'FlowingMenu',
  'Magnet',
  'SpotlightCard',
  'StarBorder',
  'ClickSpark',
  'PixelTransition',
  'TiltedCard',
];

type MotionTokenProps = {
  text: string;
  variant?: number;
  className?: string;
};

function MotionToken({ text, variant = 0, className = '' }: MotionTokenProps) {
  const motionClassName = `inline-motion ${className}`.trim();

  switch (variant % 6) {
    case 0:
      return <ScrambledText text={text} className={motionClassName} speed={46} intensity={0.22} />;
    case 1:
      return <ShinyText text={text} className={motionClassName} speed={2.4} />;
    case 2:
      return <SplitText text={text} className={motionClassName} delay={9} />;
    case 3:
      return <BlurText text={text} as="span" by="char" delay={8} className={motionClassName} />;
    case 4:
      return <DecryptedText text={text} className={motionClassName} animateOn="view" sequential speed={30} />;
    default:
      return <TextPressure text={text} as="span" className={motionClassName} />;
  }
}

const contactLinks = [
  { href: 'https://github.com/', label: 'GitHub', icon: Github, external: true },
  { href: 'https://x.com/', label: 'X / Twitter', icon: ExternalLink, external: true },
  { href: 'https://telegram.org/', label: 'Telegram', icon: Send, external: true },
  { href: 'mailto:hello@btorn.dev', label: 'Mail', icon: Mail, external: false },
];

const workCategories = [
  {
    id: '01',
    file: 'category_01',
    label: 'ILLUSTRATION',
    title: '强色线稿',
    desc: '把图放到整屏里，边缘做 RGB 分离和扫描线，第一眼就要像信号突然接上。',
    cta: '插画一覧',
    src: assets.galleryPinkArrow,
  },
  {
    id: '02',
    file: 'category_02',
    label: 'MV ILLUSTRATION',
    title: '动态分镜',
    desc: '不靠普通卡片排版，靠滚动、遮罩和画面抖动，让静态图也有 MV 截帧感。',
    cta: 'MV一覧',
    src: assets.characterTech,
  },
  {
    id: '03',
    file: 'category_03',
    label: 'EVENT',
    title: '活动情报',
    desc: '文字层压低，画面层放大，像一张正在播放的展会告知屏，信息藏在窗口里。',
    cta: '日程を見る',
    src: assets.galleryTeam,
  },
  {
    id: '04',
    file: 'category_04',
    label: 'GOODS',
    title: '周边陈列',
    desc: '把小物、贴纸和角色影子叠成一段低保真播放画面，鼠标点一下就暂停。',
    cta: 'グッズ一覧',
    src: assets.galleryNight,
  },
];

const sceneCards = [
  { src: assets.sceneMoon, title: '月亮小剧场', tag: 'moon' },
  { src: assets.sceneSteps, title: '天台风声', tag: 'stairs' },
  { src: assets.sceneCandySky, title: '糖色天空', tag: 'drift' },
  { src: assets.sceneCloseup, title: '近距离心跳', tag: 'close' },
];

const materialScenes = [
  {
    id: 'glass-room',
    src: assets.materialGlassRoom,
    title: '玻璃房间',
    tag: 'fresh 01',
    accent: '#8be5ff',
    copy: '透明反光和室内景深很适合轮播层，不跟月相胶片的室外楼梯撞图。',
  },
  {
    id: 'long-pink',
    src: assets.materialLongPink,
    title: '粉色长镜',
    tag: 'fresh 02',
    accent: '#ff7fa8',
    copy: '纵向构图拿来做 Carousel 的压缩透视，和图册区不共用来源。',
  },
  {
    id: 'wide-lilac',
    src: assets.materialWideLilac,
    title: '浅紫横幅',
    tag: 'fresh 03',
    accent: '#b68dff',
    copy: '横幅图负责轻盈的中景，不复用 Moon、Bits 或 Gallery 的任何画面。',
  },
  {
    id: 'sky-panorama',
    src: assets.materialSkyPanorama,
    title: '远景天幕',
    tag: 'fresh 04',
    accent: '#7fd7ff',
    copy: '大远景只在素材台出现，用来托住 Aurora 和 FlowingMenu 的空间感。',
  },
];

const materialMenuItems = materialScenes.map((scene) => ({
  label: scene.title,
  text: scene.copy,
  meta: scene.tag,
}));

const typePanels = [
  ['split', '标题拆开进场，像画面被逐帧点亮。'],
  ['pressure', '鼠标靠近，字重会起伏，信息层开始有触感。'],
  ['circle', '环形文字给角色旁边补一个轻量仪表。'],
  ['shine', '重点词扫过一点光，但不做俗气渐变字。'],
  ['decrypt', '乱码解开后再定格，让标题有一点系统启动感。'],
  ['typing', '逐字输入适合做节奏，不会一整块文案砸下来。'],
];

type ChapterKind = 'garden' | 'moon';
type ChapterTransitionData = {
  id: string;
  kind: ChapterKind;
  fromColor: string;
  midColor: string;
  toColor: string;
  accent: string;
  glow: string;
  quote: string;
  whisper: string;
  orbFrom: { x: number; y: number };
  orbTo: { x: number; y: number };
};

const chapterTransitions: ChapterTransitionData[] = [
  {
    id: 'garden',
    kind: 'garden',
    fromColor: '#010204',
    midColor: '#2a1424',
    toColor: '#fff7fb',
    accent: '#ff5f8f',
    glow: 'rgba(255, 188, 210, 0.55)',
    quote: '灯关下来一点，让她自己醒。',
    whisper: 'fade · bloom · drift',
    orbFrom: { x: 78, y: 86 },
    orbTo: { x: 18, y: 16 },
  },
  {
    id: 'moon',
    kind: 'moon',
    fromColor: '#fff7fb',
    midColor: '#3a2a44',
    toColor: '#06070a',
    accent: '#54f4ff',
    glow: 'rgba(168, 220, 255, 0.5)',
    quote: '把白天合上，月相会自己亮起来。',
    whisper: 'breathe · phase · archive',
    orbFrom: { x: 22, y: 18 },
    orbTo: { x: 80, y: 84 },
  },
];

function useViewportGate<T extends HTMLElement>(preloadMargin = '900px 0px', activeMargin = '260px 0px') {
  const ref = useRef<T | null>(null);
  const [shouldRender, setShouldRender] = useState(() => typeof window === 'undefined');
  const [isActive, setIsActive] = useState(() => typeof window === 'undefined');

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    if (!('IntersectionObserver' in window)) {
      setShouldRender(true);
      setIsActive(true);
      return;
    }

    const preloadObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldRender(true);
          preloadObserver.disconnect();
        }
      },
      { rootMargin: preloadMargin, threshold: 0 },
    );

    const activeObserver = new IntersectionObserver(([entry]) => setIsActive(entry.isIntersecting), {
      rootMargin: activeMargin,
      threshold: 0,
    });

    preloadObserver.observe(node);
    activeObserver.observe(node);

    return () => {
      preloadObserver.disconnect();
      activeObserver.disconnect();
    };
  }, [activeMargin, preloadMargin]);

  return { ref, shouldRender, isActive };
}

function OrbitHero() {
  const letters = useMemo(
    () => [
      ['B', -116],
      ['T', -46],
      ['O', 22],
      ['R', 100],
      ['N', 166],
    ],
    [],
  );

  return (
    <section className="hero" id="top">
      <Suspense fallback={null}>
        <WebglBackdrop />
      </Suspense>
      <div className="noise" aria-hidden="true" />
      <header className="site-nav">
        <a href="#top" className="brand" aria-label="BTORN home">
          BT<span>O</span>RN
        </a>
        <nav>
          <a href="#works">Works</a>
          <a href="#garden">Garden</a>
          <a href="#moon">Moon</a>
          <a href="#bits">Bits</a>
          <a href="#materials">Assets</a>
          <a href="#contact">Contact</a>
        </nav>
      </header>

      <div className="hero-frame">
        <div className="hud rail-left">
          <span>01</span>
          <i />
          <span>FPS 60</span>
        </div>
        <div className="hero-copy">
          <StarBorder className="hero-bits-shell" color="rgba(84, 244, 255, 0.9)" speed="7s" thickness={1}>
            <p className="code-chip">
              <TextType
                text="const BTORN = composeBits('anime', 'webgl')"
                loop={false}
                typingSpeed={28}
                initialDelay={260}
                showCursor
              />
            </p>
          </StarBorder>
          <h1 aria-label="BTORN orbit logo">
            <span className="sr-only">BTORN</span>
            <div className="orbit-stage" aria-hidden="true">
              <div className="orbit-lines" />
              <div className="letter-orbit">
                {letters.map(([letter, angle]) => (
                  <span
                    className="orbit-letter"
                    style={{ '--angle': `${angle}deg`, '--drift': `${Math.abs(Number(angle)) / 18}s` } as React.CSSProperties}
                    key={letter}
                  >
                    <b>{letter}</b>
                  </span>
                ))}
              </div>
              <div className="orbit-core">
                <span>
                  <DecryptedText text="BTORN.init()" animateOn="view" sequential speed={38} />
                </span>
                <small>
                  <MotionToken text="curiosity builds worlds" variant={1} />
                </small>
              </div>
            </div>
          </h1>
        </div>
        <div className="hero-meta">
          <span>
            <MotionToken text="THREE.JS / GSAP" variant={0} />
          </span>
          <span>
            <MotionToken text="ANIME INTERFACE" variant={1} />
          </span>
          <span>
            <MotionToken text="VERSION 04.30" variant={2} />
          </span>
        </div>
      </div>

      <a className="scroll-cue" href="#profile">
        <ShinyText text="Scroll to reveal" speed={2.2} />
        <ArrowRight size={18} aria-hidden="true" />
      </a>
    </section>
  );
}

function SplitReveal() {
  return (
    <section className="cutout-section" id="profile">
      <div className="cutout-sticky">
        <div className="cutout-copy reveal-item">
          <p className="section-index">02 / Cutout Reveal</p>
          <h2>
            <BlurText text="这次换个新看板娘，从光里飘出来。" as="span" by="char" delay={16} />
          </h2>
          <ScrollReveal
            text="首屏继续保留硬核轨道感，往下就进入更像互动 PV 的段落。图片不再乖乖待在卡片里，而是被切片、遮罩、光线和滚动节奏一点点推到你面前。"
            as="p"
            direction="right"
            delay={28}
          />
          <div className="signal-strip">
            <span>
              <MotionToken text="clip-path mask" variant={2} />
            </span>
            <span>
              <MotionToken text="scroll driven" variant={1} />
            </span>
            <span>
              <MotionToken text="anime cutout" variant={0} />
            </span>
          </div>
        </div>

        <div className="cutout-stage" data-fade>
          <div className="cutout-grid" aria-hidden="true" />
          <div className="cutout-orbit" aria-hidden="true">
            <span />
            <span />
          </div>
          <div className="cutout-plate" aria-hidden="true" />
          <div className="cutout-shadow" aria-hidden="true" />
          <div className="cutout-light light-a" aria-hidden="true" />
          <div className="cutout-light light-b" aria-hidden="true" />
          <img className="cutout-character" src={assets.characterCutout} alt="BTORN anime character cutout" />
          <div className="cutout-panel panel-left" aria-hidden="true" />
          <div className="cutout-panel panel-right" aria-hidden="true" />
          <div className="cutout-chip chip-a">
            <ScanLine size={16} />
            MASK ACTIVE
          </div>
          <div className="cutout-chip chip-b">
            <Sparkles size={16} />
            CUTOUT 92%
          </div>
        </div>
      </div>
    </section>
  );
}

function WorksLab() {
  const worksRef = useRef<HTMLElement | null>(null);
  const activeWorkRef = useRef(0);
  const [activeWork, setActiveWork] = useState(0);
  const [previousWork, setPreviousWork] = useState(workCategories[0]);
  const [transitionId, setTransitionId] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const current = workCategories[activeWork];

  const activateWork = useCallback((index: number) => {
    if (index === activeWorkRef.current) {
      return;
    }

    setPreviousWork(workCategories[activeWorkRef.current]);
    activeWorkRef.current = index;
    setActiveWork(index);
    setTransitionId((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsed((value) => value + 80);
    }, 80);

    return () => window.clearInterval(timer);
  }, [isPlaying]);

  useEffect(() => {
    const markers = Array.from(document.querySelectorAll<HTMLElement>('.works-scroll-marker'));
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
  }, [activateWork]);

  useEffect(() => {
    const section = worksRef.current;
    if (!section) {
      return;
    }

    let target = 0.12;
    let line = 0.12;
    let kick = 0;
    let frame = 0;

    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
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
      readProgress();
      kick *= 0.82;
      const driven = clamp(0.1 + target * 0.8 + kick, 0.08, 0.92);
      line += (driven - line) * 0.22;
      section.style.setProperty('--works-line-y', `${(line * 100).toFixed(2)}%`);
      section.style.setProperty('--works-line-speed', clamp(Math.abs(kick) * 6, 0, 1).toFixed(3));
      frame = requestAnimationFrame(tick);
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('wheel', onWheel);
    };
  }, []);

  const timecode = useMemo(() => {
    const total = Math.max(0, elapsed);
    const minutes = Math.floor(total / 60000);
    const seconds = Math.floor((total % 60000) / 1000);
    const frames = Math.floor((total % 1000) / 10);
    return `00.${String(minutes).padStart(2, '0')}.${String(seconds).padStart(2, '0')}.${String(frames).padStart(2, '0')}`;
  }, [elapsed]);

  return (
    <section ref={worksRef} className="works-console-section" id="works" data-status={isPlaying ? 'playing' : 'paused'}>
      <div className="works-console-sticky">
        <div className="works-console-frame">
          <div className="works-crt-noise" aria-hidden="true" />
          <div className="works-scanline" aria-hidden="true" />

          <div className="works-index">
            <h2>
              <span />
              <SplitText text="Works Category" delay={20} />
            </h2>
            <div className="works-index-list" role="tablist" aria-label="Works categories">
              {workCategories.map((item, index) => (
                <button
                  type="button"
                  key={item.id}
                  className="works-index-button"
                  data-active={activeWork === index}
                  onClick={() => activateWork(index)}
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
            <article className="works-dialog" style={{ '--stack': 2 } as React.CSSProperties}>
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
                <a href="#gallery">
                  <ShinyText text={`${current.cta} →`} speed={2.4} color="rgba(248, 245, 247, 0.9)" />
                </a>
                <div className="works-barcode" aria-hidden="true">
                  {current.file}
                </div>
              </div>
            </article>
          </div>

          <div className="works-status" data-state={isPlaying ? 'playing' : 'paused'}>
            <span className="works-status-play">PLAY</span>
            <span className="works-status-pause">PAUSE</span>
          </div>
          <time className="works-time">{timecode}</time>
        </div>
      </div>
      <div className="works-scroll-rail" aria-hidden="true">
        {workCategories.map((item, index) => (
          <span className="works-scroll-marker" data-index={index} key={item.id} />
        ))}
      </div>
    </section>
  );
}

function ChapterCard({ data }: { data: ChapterTransitionData }) {
  const dustSeeds = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        i,
        x: (i * 53) % 100,
        y: (i * 37) % 100,
        size: 1 + ((i * 7) % 3),
        depth: 0.4 + ((i * 11) % 10) * 0.06,
      })),
    [],
  );

  return (
    <section
      className={`interlude interlude-${data.id}`}
      data-kind={data.kind}
      style={
        {
          '--in-from': data.fromColor,
          '--in-mid': data.midColor,
          '--in-to': data.toColor,
          '--in-accent': data.accent,
          '--in-glow': data.glow,
          '--orb-from-x': `${data.orbFrom.x}%`,
          '--orb-from-y': `${data.orbFrom.y}%`,
          '--orb-to-x': `${data.orbTo.x}%`,
          '--orb-to-y': `${data.orbTo.y}%`,
        } as React.CSSProperties
      }
      aria-hidden="true"
    >
      <div className="interlude-veil interlude-veil-from" />
      <div className="interlude-veil interlude-veil-mid" />
      <div className="interlude-veil interlude-veil-to" />
      <SplashCursorLayer className="interlude-splash-layer" />
      <div className="interlude-grain" />

      <div className="interlude-orb">
        <span className="interlude-orb-core" />
        <span className="interlude-orb-halo" />
      </div>

      <div className="interlude-hairline">
        <span />
      </div>

      <div className="interlude-dust">
        {dustSeeds.map((d) => (
          <span
            key={d.i}
            style={
              {
                '--d-x': `${d.x}%`,
                '--d-y': `${d.y}%`,
                '--d-size': `${d.size}px`,
                '--d-depth': d.depth,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <p className="interlude-quote">{data.quote}</p>
      <p className="interlude-whisper">{data.whisper}</p>
    </section>
  );
}

function SplashCursorLayer({ className = '' }: { className?: string }) {
  const { ref, isActive } = useViewportGate<HTMLDivElement>('520px 0px', '180px 0px');

  return (
    <div ref={ref} className={['splash-section-layer', className].filter(Boolean).join(' ')} aria-hidden="true">
      {isActive && (
        <div className="splash-section-frame">
          <Suspense fallback={null}>
            <SplashCursor
              SIM_RESOLUTION={128}
              DYE_RESOLUTION={1440}
              DENSITY_DISSIPATION={3.5}
              VELOCITY_DISSIPATION={2}
              PRESSURE={0.1}
              CURL={3}
              SPLAT_RADIUS={0.2}
              SPLAT_FORCE={6000}
              COLOR_UPDATE_SPEED={10}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}

function GardenStage() {
  return (
    <section className="section garden-section" id="garden">
      <SplashCursorLayer className="garden-splash-layer" />
      <div className="garden-copy" data-fade>
        <p className="section-index">04 / Garden Drift</p>
        <h2>
          <TextPressure text="花瓣别贴死，让她像被风悄悄托起来。" />
        </h2>
        <BlurText text="像把一小段夏天藏进旧电视里，信号偶尔晃一下，她就从花影前面轻轻浮出来。" as="p" by="char" delay={10} />
      </div>
      <div className="garden-stage" data-fade>
        <div className="garden-tv" aria-hidden="true">
          <span className="garden-tv-antenna" />
          <div className="garden-tv-body">
            <div className="garden-tv-screen">
              <img src={assets.sceneGarden} alt="" />
            </div>
            <div className="garden-tv-controls">
              <span />
              <span />
              <span />
            </div>
          </div>
          <span className="garden-tv-base" />
        </div>
        <div className="garden-portal" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <img className="garden-cutout cutout-lilac" src={assets.cutoutLilacDriver} alt="粉发角色抠图" />
        <div className="petal-field" aria-hidden="true">
          {Array.from({ length: 18 }, (_, index) => (
            <span
              key={index}
              style={
                {
                  '--i': index,
                  '--petal-size': `${7 + (index % 5) * 2}px`,
                  '--petal-left': `${(index * 43) % 100}%`,
                  '--petal-top': `${10 + ((index * 29) % 70)}%`,
                  '--petal-rot': `${index * 23}deg`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function MoonArchive() {
  return (
    <section className="section moon-section" id="moon">
      <div className="moon-copy" data-fade>
        <p className="section-index">05 / Moon Archive</p>
        <h2>
          <SplitText text="把新图做成会呼吸的月相胶片。" delay={28} />
        </h2>
        <ScrollReveal text="卡片不是平铺，前后景会错开。靠近时画面会亮一点，像你从一排小窗前走过去。" as="p" direction="right" delay={26} />
      </div>
      <div className="moon-orbit" aria-hidden="true">
        <span />
        <span />
      </div>
      <div className="moon-rail" data-fade>
        {sceneCards.map((card, index) => (
          <figure className="moon-card" key={card.src} style={{ '--i': index } as React.CSSProperties}>
            <img src={card.src} alt={`${card.title}场景`} />
            <figcaption>
              <span>
                <MotionToken text={card.tag} variant={index + 1} />
              </span>
              <strong>
                {index % 2 ? <ShinyText text={card.title} speed={2.1} /> : <DecryptedText text={card.title} animateOn="hover" sequential speed={32} />}
              </strong>
            </figcaption>
          </figure>
        ))}
      </div>
      <img className="moon-cutout cutout-flora" src={assets.cutoutFlora} alt="花丛角色抠图" data-fade />
    </section>
  );
}

function LanyardInterlude() {
  const { ref, shouldRender, isActive } = useViewportGate<HTMLDivElement>('1100px 0px', '260px 0px');

  return (
    <section className="lanyard-section" id="lanyard" aria-label="Lanyard transition">
      <div className="lanyard-copy" data-fade>
        <p className="section-index">05.5 / Lanyard Pass</p>
        <h2>
          <TextPressure text="这次换成真的 3D 吊牌。" />
        </h2>
        <BlurText
          text="哥哥说的是 React Bits 官网那个 Lanyard：能拖拽、有物理摆动，绳子会跟着惯性甩起来。"
          as="p"
          by="char"
          delay={9}
        />
      </div>

      <div ref={ref} className="lanyard-physics-stage" data-fade>
        {shouldRender ? (
          <Suspense fallback={<div className="lanyard-standby" aria-hidden="true" />}>
            <Lanyard position={[0, 0, 20]} gravity={[0, -40, 0]} active={isActive} />
          </Suspense>
        ) : (
          <div className="lanyard-standby" aria-hidden="true" />
        )}
      </div>
    </section>
  );
}

function BitsShowroom() {
  const dockItems = [
    { href: '#top', label: 'Top', icon: <Orbit size={20} /> },
    { href: '#works', label: 'Works', icon: <ScanLine size={20} /> },
    { href: '#bits', label: 'Bits', icon: <Sparkles size={20} /> },
    { href: '#stream', label: 'Stream', icon: <Zap size={20} /> },
    { href: '#materials', label: 'Assets', icon: <Layers3 size={20} /> },
    { href: '#type', label: 'Type', icon: <ArrowRight size={20} /> },
    { href: '#contact', label: 'Talk', icon: <Mail size={20} /> },
  ];

  return (
    <section className="section bits-showroom-section" id="bits">
      <div className="bits-showroom-head" data-fade>
        <p className="section-index">06 / React Bits Showroom</p>
        <h2>
          <TextType
            text={['这次是真的全铺开。', '这些字也会自己醒过来。']}
            typingSpeed={48}
            deletingSpeed={24}
            pauseDuration={1500}
            startOnVisible
          />
        </h2>
        <ScrollReveal
          text="从文字、图片、数据、导航到横向信息流都接进来了。不是组件清单，是把它们塞进页面节奏里。"
          as="p"
          direction="left"
          delay={30}
        />
      </div>

      <div className="bits-showroom-grid">
        <div className="bits-command-panel" data-fade>
          <ShinyText text="React Bits control dock" className="bits-kicker" speed={2.1} />
          <Dock items={dockItems} className="bits-dock" />
          <div className="bits-command-copy">
            <h3>
              <SplitText text="Dock 不只是装饰，它能直接跳段落。" delay={24} />
            </h3>
            <BlurText text="鼠标靠过去会放大，像一个给这个站专门做的小启动器，宝宝你往下看就会发现它不是孤零零的组件。" as="p" by="char" delay={8} />
          </div>
        </div>

        <PixelTransition
          className="bits-pixel-card"
          firstContent={<img src={assets.bitsCandyBath} alt="candy bath illustration" />}
          secondContent={<img src={assets.bitsSchoolAngel} alt="school angel illustration" />}
          gridSize={8}
          data-fade
        >
          <div className="bits-pixel-caption">
            <span>
              <MotionToken text="PixelTransition" variant={4} />
            </span>
            <strong>
              <SplitText text="hover 换画面" delay={18} />
            </strong>
          </div>
        </PixelTransition>

        <TiltedCard
          className="bits-tilted-feature"
          imageSrc={assets.bitsOrangePortrait}
          altText="orange portrait illustration"
          captionText="TiltedCard / pointer depth"
          rotateAmplitude={16}
          scaleOnHover={1.04}
          overlayContent={<ShinyText text="hover me" speed={1.8} />}
          data-fade
        />
      </div>
    </section>
  );
}

function BitsStream() {
  const streamNodes = streamItems.map((item, index) => (
    <span className="stream-pill" data-tone={index % 3} key={item}>
      <MotionToken text={item} variant={index} />
    </span>
  ));

  return (
    <section className="section bit-stream-section" id="stream">
      <ScrollFloat text="BTORN / REACT BITS / MOTION LAYER" repeat={5} speed={24} />
      <ScrollVelocity
        className="bit-stream-velocity"
        texts={[
          <span>BlurText / SplitText / ShinyText / TextPressure</span>,
          <span>TextType / DecryptedText / TrueFocus / CurvedLoop</span>,
        ]}
        velocity={28}
        numCopies={4}
      />
      <div className="bit-stream-inner">
        <div className="bit-stream-copy" data-fade>
          <p className="section-index">07 / Moving Bits Layer</p>
          <h2>
            <BlurText text="让组件自己开始流动。" as="span" by="char" delay={18} />
          </h2>
          <ScrollReveal
            text="这一段专门给 Bits 当舞台：上面浮字，下面无限滚动，中间用计数器告诉你这次真的加量了。"
            as="p"
            direction="right"
            delay={32}
          />
        </div>

        <StarBorder className="bit-metric-shell" color="rgba(255, 95, 143, 0.9)" speed="9s" thickness={1} data-fade>
          <div className="bit-metric-grid">
            {bitMetrics.map((metric) => (
              <div className="bit-metric" key={metric.label}>
                <strong>
                  <CountUp to={metric.value} suffix={metric.suffix} duration={1700} />
                </strong>
                <span>
                  <MotionToken text={metric.label} variant={metric.value} />
                </span>
              </div>
            ))}
          </div>
        </StarBorder>
      </div>

      <div className="stream-marquee-stack" data-fade>
        <InfiniteScroll items={streamNodes} speed={20} />
        <InfiniteScroll items={streamNodes.slice().reverse()} speed={26} reverse />
      </div>
    </section>
  );
}

function MaterialConsole() {
  return (
    <section className="section material-section" id="materials">
      <Aurora className="material-aurora" colorStops={['#ff5f8f', '#54f4ff', '#8d6cff']} speed={14} amplitude={1.2} blend={0.72} />
      <Silk className="material-silk" color="#ff5f8f" speed={9} scale={1.15} noiseIntensity={0.7} rotation={-10} />

      <div className="material-copy" data-fade>
        <p className="section-index">08 / Fresh Asset Console</p>
        <h2>
          <TextPressure text="素材要被编排，不是重复贴。" />
        </h2>
        <BlurText
          text="我把哥哥新塞进来的图拆成独立职责：这一页只负责新素材调度，靠 Aurora、Silk、Carousel 和 FlowingMenu 做页面级互动，不再让鼠标拖出小图。"
          as="p"
          by="char"
          delay={8}
        />
      </div>

      <div className="material-stage" data-fade>
        <Carousel
          className="material-carousel"
          items={materialScenes.map((scene) => ({
            id: scene.id,
            title: scene.title,
            tag: scene.tag,
            src: scene.src,
            accent: scene.accent,
            description: scene.copy,
          }))}
          autoplay
          autoplayDelay={5200}
          loop
        />

        <FlowingMenu items={materialMenuItems} className="material-flowing-menu" />
      </div>
    </section>
  );
}

function TypeReactor() {
  return (
    <section className="section type-section" id="type">
      <div className="type-orbit" aria-hidden="true">
        <CircularText text="BTORN · TYPE · REACT BITS · " radius={86} spinDuration={22} />
      </div>

      <div className="type-copy" data-fade>
        <p className="section-index">09 / Typography Reactor</p>
        <h2>
          <TextPressure text="文字也要能被摸到。" />
        </h2>
        <ScrollReveal
          text="普通说明文字我收了一半，剩下的用字重、分裂、解码、输入、环形路径和光扫来讲。这样页面会更像互动视觉稿，不像素材说明书。"
          as="p"
          direction="left"
          delay={30}
        />
      </div>

      <div className="type-grid">
        <StarBorder className="type-circular-card" color="rgba(84, 244, 255, 0.88)" speed="10s" thickness={1} data-fade>
          <CircularText text="CUTOUT · LAYER · MOTION · " radius={78} spinDuration={18} reverse />
          <img src={assets.characterTechHuman} alt="tech character cutout" />
          <span className="type-cutout-label">transparent cutout layer</span>
        </StarBorder>

        <GlareHover className="type-statement" glareColor="rgba(255, 95, 143, 0.34)" data-fade>
          <ShinyText text="not a caption, a control surface" speed={2.3} />
          <h3>
            <SplitText text="把文案做成会呼吸的界面零件。" />
          </h3>
          <BlurText text="这里的文字不再只是解释效果，而是跟图片同级：它会进场、会扫光、会被指针压一下。" as="p" by="char" delay={9} />
          <TrueFocus
            sentence="soft sharp alive signal"
            manualMode
            blurAmount={4}
            borderColor="#ff5f8f"
            glowColor="rgba(255, 95, 143, 0.42)"
          />
        </GlareHover>

        <div className="type-panel-list" data-fade>
          {typePanels.map(([label, text], index) => (
            <SpotlightCard
              className="type-panel"
              spotlightColor={index % 2 ? 'rgba(255, 95, 143, 0.22)' : 'rgba(84, 244, 255, 0.2)'}
              key={label}
          >
            <span>
                <MotionToken text={label} variant={index + 2} />
            </span>
              <ScrollReveal text={text} as="p" direction={index % 2 ? 'right' : 'up'} delay={18} />
          </SpotlightCard>
        ))}
      </div>
      </div>
    </section>
  );
}

function MoodShelf() {
  return (
    <section className="section stack-section" id="stack">
      <div className="section-heading compact" data-fade>
        <p className="section-index">10 / Technique Matrix</p>
        <h2>
          <BlurText text="技术力藏在细节里，不靠一堆说明文字撑场。" as="span" by="char" delay={14} />
        </h2>
      </div>
      <div className="stack-console" data-fade>
        {stacks.map(({ name, text, bit }, index) => (
          <SpotlightCard
            className="stack-module"
            spotlightColor={index % 2 ? 'rgba(255, 95, 143, 0.24)' : 'rgba(84, 244, 255, 0.2)'}
            key={name}
          >
            <div className="module-head">
              <span>{String(index + 1).padStart(2, '0')}</span>
              {index % 2 ? <Zap size={16} /> : <Orbit size={16} />}
            </div>
            <small className="module-bit">
              <MotionToken text={bit} variant={index} />
            </small>
            <h3>
              <MotionToken text={name} variant={index + 2} />
            </h3>
            <ScrollReveal text={text} as="p" direction={index % 2 ? 'left' : 'right'} delay={18} />
            <i aria-hidden="true" />
          </SpotlightCard>
        ))}
      </div>
    </section>
  );
}

function NotesTimeline() {
  return (
    <section className="section timeline-section" id="notes">
      <div className="section-heading" data-fade>
        <p className="section-index">11 / Motion Script</p>
        <h2>
          <TextType text="页面应该像分镜，不是从上到下摆资料。" loop={false} typingSpeed={42} startOnVisible />
        </h2>
        <BlurText text="每一段都有自己的进入方式：先切开，再推进，再横向拖出一组画面。" as="p" by="char" delay={10} />
      </div>
      <div className="timeline">
        {notes.map(([date, text], index) => (
          <article className="timeline-item" key={date} data-fade>
            <time>
              <MotionToken text={date} variant={index + 1} />
            </time>
            <ScrollReveal text={text} as="p" direction={index % 2 ? 'left' : 'right'} delay={20} />
          </article>
        ))}
      </div>
    </section>
  );
}

function Gallery() {
  return (
    <section className="section gallery-section" id="gallery">
      <div className="section-heading" data-fade>
        <p className="section-index">12 / Pinned Gallery</p>
        <h2>
          <SplitText text="图册改成横向胶片，滚动时一张张推出来。" delay={24} />
        </h2>
        <BlurText text="图片本身很好看，就别把它们塞进普通网格里。让它们像一段可拖动的片尾。" as="p" by="char" delay={9} />
      </div>
      <div className="gallery-track" aria-label="Selected anime mood crops">
        {gallery.map((item, index) => (
          <Magnet
            wrapperClassName="gallery-magnet"
            innerClassName="gallery-magnet-inner"
            padding={54}
            magnetStrength={18}
            key={item.title}
          >
            <figure className="gallery-card" data-fade>
              <img src={item.src} alt={`${item.title} mood crop`} />
              <figcaption>
                <span>
                  <MotionToken text={item.tag} variant={index} />
                </span>
                <strong>
                  {index % 2 ? <ShinyText text={item.title} speed={2.2} /> : <DecryptedText text={item.title} animateOn="hover" sequential speed={32} />}
                </strong>
              </figcaption>
            </figure>
          </Magnet>
        ))}
      </div>
    </section>
  );
}

function Philosophy() {
  return (
    <section className="section signal-section" id="about">
      <img className="signal-image" src={assets.signalFreshFlower} alt="Flower anime atmosphere" data-fade />
      <div className="signal-panel" data-fade>
        <Layers3 size={32} />
        <p className="section-index">13 / Design Attitude</p>
        <h2>
          <TextPressure text="可爱可以很软，但页面不能软趴趴。" />
        </h2>
        <ScrollReveal
          text="这一版把“二次元可爱”和“高级互动”放在一起：图片要有景深，滚动要有分镜，每个区域都要有自己的出场方式。这样才像真的做过设计，而不是把素材贴上去。"
          as="p"
          direction="down"
          delay={26}
        />
        <div className="signal-meter" aria-hidden="true">
          <span style={{ '--value': '86%' } as React.CSSProperties} />
          <span style={{ '--value': '68%' } as React.CSSProperties} />
          <span style={{ '--value': '94%' } as React.CSSProperties} />
        </div>
      </div>
    </section>
  );
}

function ContactFooter() {
  return (
    <footer className="contact-footer" id="contact">
      <div>
        <p className="section-index">14 / 联系</p>
        <h2>
          <TextPressure text="BTORN" />
        </h2>
        <BlurText text="如果你也刚好喜欢这里，就悄悄打个招呼吧。" as="p" by="char" delay={12} />
      </div>
      <div className="contact-links" aria-label="Contact links">
        {contactLinks.map(({ href, label, icon: Icon, external }) => (
          <Magnet wrapperClassName="contact-magnet" innerClassName="contact-magnet-inner" padding={42} magnetStrength={14} key={label}>
            <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
              <Icon size={18} />
              {label}
            </a>
          </Magnet>
        ))}
      </div>
      <StarBorder className="terminal-star" color="rgba(84, 244, 255, 0.9)" speed="8s" thickness={1}>
        <pre className="terminal-block">{`今日留言
要是你刚好喜欢粉色、夜风和一点点闪光，
那就把这里当成一扇小窗吧。`}</pre>
      </StarBorder>
    </footer>
  );
}

export default function App() {
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const root = document.documentElement;

    const moveCursor = (event: PointerEvent) => {
      const x = event.clientX;
      const y = event.clientY;
      root.style.setProperty('--cursor-x', `${x}px`);
      root.style.setProperty('--cursor-y', `${y}px`);
      root.style.setProperty('--mouse-x', `${((x / window.innerWidth) - 0.5).toFixed(4)}`);
      root.style.setProperty('--mouse-y', `${((y / window.innerHeight) - 0.5).toFixed(4)}`);
      root.style.setProperty('--tilt-x', `${((y / window.innerHeight) - 0.5) * -8}deg`);
      root.style.setProperty('--tilt-y', `${((x / window.innerWidth) - 0.5) * 10}deg`);
    };

    window.addEventListener('pointermove', moveCursor);

    if (!reduceMotion) {
      gsap.to('.orbit-stage', {
        yPercent: -18,
        scale: 0.78,
        autoAlpha: 0.22,
        ease: 'none',
        scrollTrigger: {
          trigger: '.hero',
          start: '48% top',
          end: 'bottom top',
          scrub: 0.8,
        },
      });

      gsap.to('.panel-left', {
        xPercent: -118,
        rotate: -8,
        ease: 'none',
        scrollTrigger: {
          trigger: '.cutout-section',
          start: 'top 72%',
          end: 'bottom 38%',
          scrub: 0.7,
        },
      });

      gsap.to('.panel-right', {
        xPercent: 118,
        rotate: 8,
        ease: 'none',
        scrollTrigger: {
          trigger: '.cutout-section',
          start: 'top 72%',
          end: 'bottom 38%',
          scrub: 0.7,
        },
      });

      gsap.fromTo(
        '.cutout-character',
        {
          y: 80,
          scale: 0.92,
        },
        {
          y: -24,
          scale: 1.05,
          ease: 'none',
          scrollTrigger: {
            trigger: '.cutout-section',
            start: 'top 72%',
            end: 'bottom 28%',
            scrub: 0.7,
          },
        },
      );

      gsap.to('.cutout-orbit', {
        rotate: 160,
        scale: 1.08,
        ease: 'none',
        scrollTrigger: {
          trigger: '.cutout-section',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1,
        },
      });

      gsap.to('.garden-section', {
        '--garden-scroll': 1,
        ease: 'none',
        scrollTrigger: {
          trigger: '.garden-section',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1,
        },
      });

      chapterTransitions.forEach((data) => {
        const sel = `.interlude-${data.id}`;
        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: sel,
            start: 'top top',
            end: '+=320%',
            pin: true,
            scrub: 1.4,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });

        tl.fromTo(
          `${sel} .interlude-veil-mid`,
          { opacity: 0 },
          { opacity: 1, duration: 0.5, ease: 'sine.inOut' },
          0.18,
        )
          .to(
            `${sel} .interlude-veil-mid`,
            { opacity: 0, duration: 0.4, ease: 'sine.inOut' },
            0.62,
          )
          .fromTo(
            `${sel} .interlude-veil-to`,
            { opacity: 0 },
            { opacity: 1, duration: 0.55, ease: 'sine.inOut' },
            0.46,
          )
          .fromTo(
            `${sel} .interlude-orb`,
            { '--orb-progress': 0, scale: 0.4, opacity: 0, filter: 'blur(40px)' },
            {
              '--orb-progress': 1,
              scale: 1,
              opacity: 1,
              filter: 'blur(0px)',
              duration: 0.9,
              ease: 'power1.inOut',
            },
            0.05,
          )
          .to(
            `${sel} .interlude-orb`,
            { scale: 1.18, opacity: 0, filter: 'blur(60px)', duration: 0.25, ease: 'power2.in' },
            0.78,
          )
          .fromTo(
            `${sel} .interlude-hairline span`,
            { scaleX: 0, opacity: 0 },
            { scaleX: 1, opacity: 1, duration: 0.42, ease: 'power2.out' },
            0.22,
          )
          .to(
            `${sel} .interlude-hairline span`,
            { scaleX: 0, opacity: 0, transformOrigin: 'right center', duration: 0.25, ease: 'power2.in' },
            0.78,
          )
          .fromTo(
            `${sel} .interlude-quote`,
            { opacity: 0, letterSpacing: '0.6em', y: 14, filter: 'blur(8px)' },
            {
              opacity: 1,
              letterSpacing: '0.04em',
              y: 0,
              filter: 'blur(0px)',
              duration: 0.5,
              ease: 'power2.out',
            },
            0.32,
          )
          .to(
            `${sel} .interlude-quote`,
            {
              opacity: 0,
              letterSpacing: '0.18em',
              y: -10,
              filter: 'blur(6px)',
              duration: 0.22,
              ease: 'power2.in',
            },
            0.82,
          )
          .fromTo(
            `${sel} .interlude-whisper`,
            { opacity: 0, y: 8 },
            { opacity: 0.6, y: 0, duration: 0.4, ease: 'power2.out' },
            0.4,
          )
          .to(
            `${sel} .interlude-whisper`,
            { opacity: 0, y: -8, duration: 0.2, ease: 'power2.in' },
            0.84,
          )
          .fromTo(
            `${sel} .interlude-dust span`,
            { opacity: 0, scale: 0 },
            {
              opacity: (i: number) => 0.3 + ((i * 7) % 5) * 0.12,
              scale: 1,
              stagger: 0.018,
              duration: 0.55,
              ease: 'power2.out',
            },
            0.34,
          )
          .to(
            `${sel} .interlude-dust span`,
            {
              opacity: 0,
              y: -22,
              stagger: 0.012,
              duration: 0.3,
              ease: 'power2.in',
            },
            0.8,
          )
          .fromTo(
            `${sel} .interlude-grain`,
            { opacity: 0.32 },
            { opacity: 0.32, duration: 0.62, ease: 'none' },
            0.18,
          )
          .to(
            `${sel} .interlude-grain`,
            { opacity: 0, duration: 0.16, ease: 'power2.in' },
            0.84,
          );
      });

      gsap.to('.moon-section', {
        '--moon-scroll': 1,
        ease: 'none',
        scrollTrigger: {
          trigger: '.moon-section',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1,
        },
      });

      const galleryTrack = document.querySelector<HTMLElement>('.gallery-track');
      if (galleryTrack && window.innerWidth > 900) {
        const getDistance = () => Math.max(0, galleryTrack.scrollWidth - window.innerWidth + 96);
        gsap.to(galleryTrack, {
          x: () => -getDistance(),
          ease: 'none',
          scrollTrigger: {
            trigger: '.gallery-section',
            start: 'top top',
            end: () => `+=${getDistance() + window.innerHeight * 0.6}`,
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true,
          },
        });
      }

      gsap.utils.toArray<HTMLElement>('[data-fade], .reveal-item').forEach((item) => {
        gsap.fromTo(
          item,
          { autoAlpha: 0, y: 42 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.9,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: item,
              start: 'top 84%',
            },
          },
        );
      });
    }

    return () => {
      window.removeEventListener('pointermove', moveCursor);
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, []);

  return (
    <ClickSpark
      className="page-spark"
      fixed
      sparkColor="#54f4ff"
      sparkCount={10}
      sparkRadius={24}
      sparkSize={8}
      duration={540}
      extraScale={1.35}
    >
      <main>
        <div className="cursor-spotlight" aria-hidden="true" />
        <OrbitHero />
        <SplitReveal />
        <WorksLab />
        <ChapterCard data={chapterTransitions[0]} />
        <GardenStage />
        <ChapterCard data={chapterTransitions[1]} />
        <MoonArchive />
        <LanyardInterlude />
        <BitsShowroom />
        <BitsStream />
        <MaterialConsole />
        <TypeReactor />
        <MoodShelf />
        <NotesTimeline />
        <Gallery />
        <Philosophy />
        <ContactFooter />
      </main>
    </ClickSpark>
  );
}
