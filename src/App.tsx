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
  { name: '草莓星屑', text: '她最喜欢踩月光走路，因为踩着踩着就会冒出一小颗一小颗星星。', bit: '今晚 03:14' },
  { name: '牛奶引力', text: '靠近她的时候要把脚步放轻哦，她的耳朵尖尖的，会偷偷竖起来。', bit: '阳台风口' },
  { name: '月光柔焦', text: '今晚的月亮把她的脸照得太亮，她只好假装在数远处的云。', bit: '满月 -1°' },
  { name: '亮晶晶外框', text: '她偷偷给最重要的几件事都套上了一圈星河，怕它们半夜走丢。', bit: '抽屉第三格' },
  { name: '云端小宇宙', text: '她的小宇宙里只住着她自己，还有一只会发光的猫猫。', bit: '宇宙北角' },
  { name: '时间软糖', text: '时间在这里走得慢一点，是因为糖罐里的糖实在太香了。', bit: '糖罐底层' },
];

const notes = [
  ['梦境 01', '今天梦见自己变成了一颗会发光的糖，被偷偷藏在最喜欢的人口袋里。'],
  ['梦境 02', '梦里下了一场糖果雨，她伸出舌头接到一颗草莓味的小星星。'],
  ['梦境 03', '和一只猫坐在云上看日落，云软软的，日落甜甜的，她什么都没说。'],
  ['梦境 04', '醒来时枕头上躺着一颗发亮的小石头，她悄悄把它收进糖罐里了。'],
];

const gallery = [
  { src: assets.gallerySky, title: '粉粉的箭头', tag: '一见钟情' },
  { src: assets.galleryFreshReader, title: '翻到一半的书', tag: '新拣到的' },
  { src: assets.galleryFreshBlue, title: '蓝色小窗', tag: '新拣到的' },
  { src: assets.galleryFreshPoster, title: '撕下的海报', tag: '新拣到的' },
  { src: assets.galleryStudy, title: '学习小角落', tag: '偶尔用功' },
  { src: assets.galleryExtra, title: '藏起来的宝物', tag: '偷偷藏好' },
];

const bitMetrics = [
  { label: '今天偷藏的糖', value: 28, suffix: '+' },
  { label: '想你想到的次数', value: 12, suffix: '次' },
  { label: '心跳浓度', value: 96, suffix: '%' },
];

const streamItems = [
  '闪闪糖',
  '漂浮云',
  '无限糖',
  '亮晶晶',
  '触触字',
  '打字机',
  '解谜糖',
  '心跳焦点',
  '揭开纸',
  '风速糖',
  '弯弯糖',
  '跳跳字',
  '圆圆字',
  '极光糖',
  '丝绸云',
  '旋转木马',
  '流光菜单',
  '引力糖',
  '聚光糖',
  '星框糖',
  '点点星',
  '像素糖',
  '倾斜糖',
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
    file: 'dream_01',
    label: 'CANDY HEART',
    title: '糖心绘卷',
    desc: '粉粉的箭头是她最喜欢的方向，每次画到这里她都会偷偷脸红，假装是因为今天阳光太亮。',
    cta: '翻翻心动册',
    src: assets.galleryPinkArrow,
  },
  {
    id: '02',
    file: 'dream_02',
    label: 'DREAMY FRAMES',
    title: '一格一格的梦',
    desc: '梦里有一格一格的小窗，每打开一扇都会飘出不一样的甜味。她说最想推开的那扇还没找到。',
    cta: '看看梦境',
    src: assets.characterTech,
  },
  {
    id: '03',
    file: 'dream_03',
    label: 'TINY EVENT',
    title: '小心心活动',
    desc: '今天的小活动是去给路边的猫猫挠下巴，记得带一点小鱼干，还要带上心情最好的那一份。',
    cta: '看看日程',
    src: assets.galleryTeam,
  },
  {
    id: '04',
    file: 'dream_04',
    label: 'TREASURE BOX',
    title: '我的小宝物',
    desc: '贴纸盒里住着星星、彩虹、还有一只迷路的小兔子。她每天都会数一遍，怕谁悄悄跑掉。',
    cta: '看看宝物',
    src: assets.galleryNight,
  },
];

const sceneCards = [
  { src: assets.sceneMoon, title: '月亮小剧场', tag: '月亮' },
  { src: assets.sceneSteps, title: '小天台风声', tag: '台阶' },
  { src: assets.sceneCandySky, title: '糖果天空', tag: '糖糖' },
  { src: assets.sceneCloseup, title: '近距离心跳', tag: '靠近' },
];

const materialScenes = [
  {
    id: 'glass-room',
    src: assets.materialGlassRoom,
    title: '玻璃糖屋',
    tag: '小窝 01',
    accent: '#8be5ff',
    copy: '这是她最喜欢的发呆角落，玻璃外面的世界都被柔成了糖渍味。',
  },
  {
    id: 'long-pink',
    src: assets.materialLongPink,
    title: '粉粉长廊',
    tag: '小窝 02',
    accent: '#ff7fa8',
    copy: '走到长廊尽头就能拐进她的心里，但她不会告诉你密码是什么。',
  },
  {
    id: 'wide-lilac',
    src: assets.materialWideLilac,
    title: '紫色梦境',
    tag: '小窝 03',
    accent: '#b68dff',
    copy: '紫色的傍晚最适合躺平，她说她偷偷想把每天都过成这样。',
  },
  {
    id: 'sky-panorama',
    src: assets.materialSkyPanorama,
    title: '远空天幕',
    tag: '小窝 04',
    accent: '#7fd7ff',
    copy: '远远的天空里有一颗只属于她的小星星，她说它叫「秘密」。',
  },
];

const materialMenuItems = materialScenes.map((scene) => ({
  label: scene.title,
  text: scene.copy,
  meta: scene.tag,
}));

const typePanels = [
  ['拆糖', '今天的糖剥到一半舍不得吃了，她想留到傍晚再说。'],
  ['触触', '她说被偷偷碰了一下耳朵，脸到现在还有点烫。'],
  ['圆圆', '糖果的形状最好是圆圆的，咬下去才不会划到舌尖。'],
  ['亮亮', '她偷偷许的愿望都很小，比如今天的甜筒不要化太快。'],
  ['解谜', '她说她最近的小心事像一道谜，连自己也不太想解开。'],
  ['打字', '今天写了三个字就停下来了，因为忽然听见窗外有风。'],
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
    quote: '把灯关小一点，让她自己慢慢醒过来。',
    whisper: '柔光 · 花瓣 · 风',
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
    quote: '把白天悄悄合上，月亮就会自己亮起来啦。',
    whisper: '呼吸 · 月相 · 收藏',
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
          <p className="section-index">02 / 看板娘登场</p>
          <h2>
            <BlurText text="她从光里飘出来的那一瞬，连星星都屏住了呼吸。" as="span" by="char" delay={16} />
          </h2>
          <ScrollReveal
            text="她不喜欢正面打招呼，总是先从光里探出半边头。耳朵会跟着风动一下，影子也跟着晃。靠近一点，就能听见她在偷偷哼今天最喜欢的歌。"
            as="p"
            direction="right"
            delay={28}
          />
          <div className="signal-strip">
            <span>
              <MotionToken text="今日心动" variant={2} />
            </span>
            <span>
              <MotionToken text="甜甜的风" variant={1} />
            </span>
            <span>
              <MotionToken text="悄悄上线" variant={0} />
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
          <img className="cutout-character" src={assets.characterCutout} alt="看板娘剪影" />
          <div className="cutout-panel panel-left" aria-hidden="true" />
          <div className="cutout-panel panel-right" aria-hidden="true" />
          <div className="cutout-chip chip-a">
            <ScanLine size={16} />
            心动 ON
          </div>
          <div className="cutout-chip chip-b">
            <Sparkles size={16} />
            闪光 92%
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
              <SplitText text="梦境分类" delay={20} />
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
            <span className="works-status-play">播放中</span>
            <span className="works-status-pause">暂停啦</span>
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
        <p className="section-index">04 / 花园午后</p>
        <h2>
          <TextPressure text="下午三点，花瓣轻得像一句没说出口的喜欢。" />
        </h2>
        <BlurText text="风把花瓣吹到她的睫毛上，她也没舍得拨开。她说这种小事不要紧，反正今天的猫已经睡饱了。" as="p" by="char" delay={10} />
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
        <img className="garden-cutout cutout-lilac" src={assets.cutoutLilacDriver} alt="粉发小天使" />
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
        <p className="section-index">05 / 月亮档案</p>
        <h2>
          <SplitText text="月亮今晚有点害羞，只敢露半张脸。" delay={28} />
        </h2>
        <ScrollReveal text="她说没关系，她也是。所以两个人就这样隔着窗户看了好久，谁也没先说一句晚安。" as="p" direction="right" delay={26} />
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
      <img className="moon-cutout cutout-flora" src={assets.cutoutFlora} alt="花丛里的小天使" data-fade />
    </section>
  );
}

function LanyardInterlude() {
  const { ref, shouldRender, isActive } = useViewportGate<HTMLDivElement>('1100px 0px', '260px 0px');

  return (
    <section className="lanyard-section" id="lanyard" aria-label="Lanyard transition">
      <div className="lanyard-copy" data-fade>
        <p className="section-index">05.5 / 摇晃的小挂件</p>
        <h2>
          <TextPressure text="脖子上的小挂牌，一直摇呀摇。" />
        </h2>
        <BlurText
          text="像有人在悄悄给它讲笑话，所以它今天比平常多甩了几下。她假装没看见，但嘴角偷偷翘了起来。"
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
    { href: '#top', label: '回家', icon: <Orbit size={20} /> },
    { href: '#works', label: '小剧场', icon: <ScanLine size={20} /> },
    { href: '#bits', label: '糖罐', icon: <Sparkles size={20} /> },
    { href: '#stream', label: '流光', icon: <Zap size={20} /> },
    { href: '#materials', label: '收藏柜', icon: <Layers3 size={20} /> },
    { href: '#type', label: '会动的字', icon: <ArrowRight size={20} /> },
    { href: '#contact', label: '聊聊', icon: <Mail size={20} /> },
  ];

  return (
    <section className="section bits-showroom-section" id="bits">
      <div className="bits-showroom-head" data-fade>
        <p className="section-index">06 / 小玩具陈列室</p>
        <h2>
          <TextType
            text={['今天的糖糖们都拿出来啦~', '它们也会偷偷醒过来哦。']}
            typingSpeed={48}
            deletingSpeed={24}
            pauseDuration={1500}
            startOnVisible
          />
        </h2>
        <ScrollReveal
          text="今天捡到的小宝物：半颗星星、一朵会眨眼的云、还有一阵忘了名字的甜甜的风。她说没关系，反正没记住的就当做明天再认识一次。"
          as="p"
          direction="left"
          delay={30}
        />
      </div>

      <div className="bits-showroom-grid">
        <div className="bits-command-panel" data-fade>
          <ShinyText text="小窝の七颗心情" className="bits-kicker" speed={2.1} />
          <Dock items={dockItems} className="bits-dock" />
          <div className="bits-command-copy">
            <h3>
              <SplitText text="糖盒里住着七颗小心情，每天醒来都会自己排好队。" delay={24} />
            </h3>
            <BlurText text="她说她每天都要数一遍这些糖糖，怕漏掉哪一颗会委屈地哭出来，那样今晚就睡不着啦。" as="p" by="char" delay={8} />
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
              <MotionToken text="不要看啦" variant={4} />
            </span>
            <strong>
              <SplitText text="她现在不太好看（其实超好看）" delay={18} />
            </strong>
          </div>
        </PixelTransition>

        <TiltedCard
          className="bits-tilted-feature"
          imageSrc={assets.bitsOrangePortrait}
          altText="orange portrait illustration"
          captionText="今天也想被你偷偷喜欢"
          rotateAmplitude={16}
          scaleOnHover={1.04}
          overlayContent={<ShinyText text="摸摸我嘛" speed={1.8} />}
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
      <ScrollFloat text="BTORN · 心动 · 流光糖屋" repeat={5} speed={24} />
      <ScrollVelocity
        className="bit-stream-velocity"
        texts={[
          <span>柔糖 / 拆糖 / 闪糖 / 触触糖</span>,
          <span>打字糖 / 解谜糖 / 焦点糖 / 弯弯糖</span>,
        ]}
        velocity={28}
        numCopies={4}
      />
      <div className="bit-stream-inner">
        <div className="bit-stream-copy" data-fade>
          <p className="section-index">07 / 会跑的心跳层</p>
          <h2>
            <BlurText text="心跳今天跑得有点快。" as="span" by="char" delay={18} />
          </h2>
          <ScrollReveal
            text="她跑得很快，因为想第一个跑到傍晚，看晚霞把屋顶染成草莓味。她说一个人去也行，但其实今天偷偷想到了你哦。"
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
        <p className="section-index">08 / 闪光宝物柜</p>
        <h2>
          <TextPressure text="宝物柜的钥匙藏在第三层。" />
        </h2>
        <BlurText
          text="旁边躺着一片去年的樱花瓣，一颗忘了名字的小石头，还有一封她想了很久但没寄出去的信。她说不寄了，反正风也会替她送过去。"
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
        <CircularText text="BTORN · 字 · 跳舞屋 · " radius={86} spinDuration={22} />
      </div>

      <div className="type-copy" data-fade>
        <p className="section-index">09 / 会呼吸的字</p>
        <h2>
          <TextPressure text="她的字写得软软的。" />
        </h2>
        <ScrollReveal
          text="每个标点都像在撒娇，每个句号都不舍得停下来。她说被晚风吹过的字会做梦，特别是那些藏着小秘密的。"
          as="p"
          direction="left"
          delay={30}
        />
      </div>

      <div className="type-grid">
        <StarBorder className="type-circular-card" color="rgba(84, 244, 255, 0.88)" speed="10s" thickness={1} data-fade>
          <CircularText text="今天 · 也想 · 喜欢你 · " radius={78} spinDuration={18} reverse />
          <img src={assets.characterTechHuman} alt="小天使剪影" />
          <span className="type-cutout-label">悄悄说一声哦</span>
        </StarBorder>

        <GlareHover className="type-statement" glareColor="rgba(255, 95, 143, 0.34)" data-fade>
          <ShinyText text="每个字里都藏着一颗心跳" speed={2.3} />
          <h3>
            <SplitText text="把每一个字都偷偷放进糖罐里。" />
          </h3>
          <BlurText text="她最喜欢的字是「软」，因为念出来嘴角就会自己翘起来。第二喜欢的是「甜」，但是说出来太害羞了。" as="p" by="char" delay={9} />
          <TrueFocus
            sentence="软 甜 暖 心动"
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
        <p className="section-index">10 / 小心思收藏</p>
        <h2>
          <BlurText text="口袋里装的不是糖纸，是她每天偷偷攒下来的小心思。" as="span" by="char" delay={14} />
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
        <p className="section-index">11 / 创作日记</p>
        <h2>
          <TextType text="她有一本小日记，里面记满了今天又喜欢了谁。" loop={false} typingSpeed={42} startOnVisible />
        </h2>
        <BlurText text="每一页都被偷偷折了角，那是她准备明天再看一遍的暗号。她说没人知道也没关系，反正记住的人是自己。" as="p" by="char" delay={10} />
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
        <p className="section-index">12 / 心动小档案</p>
        <h2>
          <SplitText text="今天又收集到一些让人心跳加速的瞬间。" delay={24} />
        </h2>
        <BlurText text="看完之后请记得把心跳借她一下，就一下下哦。她说她会还的，可能会忘记还，但一定会还。" as="p" by="char" delay={9} />
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
      <img className="signal-image" src={assets.signalFreshFlower} alt="花花的小心情" data-fade />
      <div className="signal-panel" data-fade>
        <Layers3 size={32} />
        <p className="section-index">13 / 设计的小心思</p>
        <h2>
          <TextPressure text="可爱不是装出来的。" />
        </h2>
        <ScrollReveal
          text="她说她不擅长正经事，但很擅长把每一天都过得像糖纸一样亮亮的。早上醒来先发会儿呆，傍晚等晚霞，深夜数星星。这样的日子也挺好的呀。"
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
        <p className="section-index">14 / 悄悄话</p>
        <h2>
          <TextPressure text="BTORN" />
        </h2>
        <BlurText text="如果你也喜欢这里，那我们一定会成为朋友的呀。" as="p" by="char" delay={12} />
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
        <pre className="terminal-block">{`今日の小心情
风轻轻的，月亮淡淡的，
口袋里有半颗化掉的糖。
今天也想悄悄喜欢你哦 ✦`}</pre>
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
