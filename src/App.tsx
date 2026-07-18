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
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Aurora,
  BlurText,
  Carousel,
  ClickSpark,
  DecryptedText,
  Dock,
  FlowingMenu,
  Magnet,
  ScrambledText,
  ScrollReveal,
  PixelTransition,
  ShinyText,
  Silk,
  SplitText,
  SpotlightCard,
  StarBorder,
  TextType,
  TextPressure,
  TiltedCard,
} from './components/react-bits';

gsap.registerPlugin(ScrollTrigger);

const WebglBackdrop = lazy(() => import('./components/webgl-backdrop/WebglBackdrop'));

const assets = {
  characterTech: 'assets/character-tech.webp',
  characterCutout: 'assets/character-orbit-cutout.png',
  gallerySky: 'assets/gallery-sky.webp',
  galleryTeam: 'assets/gallery-team.webp',
  galleryPinkArrow: 'assets/gallery-pink-arrow.webp',
  galleryNight: 'assets/gallery-night.webp',
  galleryStudy: 'assets/gallery-study.webp',
  galleryExtra: 'assets/gallery-extra.webp',
  galleryFreshReader: 'assets/gallery-fresh-reader.jpg',
  galleryFreshBlue: 'assets/gallery-fresh-blue.jpg',
  galleryFreshPoster: 'assets/gallery-fresh-poster.jpg',
  cutoutLilacDriver: 'assets/cutout-lilac-driver.png',
  cutoutFlora: 'assets/cutout-flora.png',
  sceneGarden: 'assets/scene-garden.webp',
  sceneMoon: 'assets/scene-moon.webp',
  sceneSteps: 'assets/scene-steps.webp',
  sceneCandySky: 'assets/scene-candy-sky.webp',
  sceneCloseup: 'assets/scene-closeup.webp',
  materialGlassRoom: 'assets/material-glass-room.jpg',
  materialLongPink: 'assets/material-long-pink.jpg',
  materialWideLilac: 'assets/material-wide-lilac.jpg',
  materialSkyPanorama: 'assets/material-sky-panorama.jpg',
  bitsCandyBath: 'assets/bits-candy-bath.jpg',
  bitsSchoolAngel: 'assets/bits-school-angel.jpg',
  bitsOrangePortrait: 'assets/bits-orange-portrait.jpg',
  signalFreshFlower: 'assets/signal-fresh-flower.jpg',
};

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

const materialCarouselItems = materialScenes.map((scene) => ({
  id: scene.id,
  title: scene.title,
  tag: scene.tag,
  src: scene.src,
  accent: scene.accent,
  description: scene.copy,
}));

const bitsDockItems = [
  { href: '#top', label: '回家', icon: <Orbit size={20} /> },
  { href: '#works', label: '小剧场', icon: <ScanLine size={20} /> },
  { href: '#bits', label: '糖罐', icon: <Sparkles size={20} /> },
  { href: '#materials', label: '收藏柜', icon: <Layers3 size={20} /> },
  { href: '#contact', label: '聊聊', icon: <Mail size={20} /> },
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
  const [isVisible, setIsVisible] = useState(false);
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

  useEffect(() => {
    if (!isPlaying || !isVisible) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsed((value) => value + 80);
    }, 80);

    return () => window.clearInterval(timer);
  }, [isPlaying, isVisible]);

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
    if (!isVisible) {
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
  }, [isVisible]);

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

function GardenStage() {
  return (
    <section className="section garden-section" id="garden">
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

function BitsShowroom() {
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
          <Dock items={bitsDockItems} className="bits-dock" />
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

function MaterialConsole() {
  return (
    <section className="section material-section" id="materials">
      <Aurora className="material-aurora" colorStops={['#ff5f8f', '#54f4ff', '#8d6cff']} speed={14} amplitude={1.2} blend={0.72} />
      <Silk className="material-silk" color="#ff5f8f" speed={9} scale={1.15} noiseIntensity={0.7} rotation={-10} />

      <div className="material-copy" data-fade>
        <p className="section-index">07 / 闪光宝物柜</p>
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
          items={materialCarouselItems}
          autoplay
          autoplayDelay={5200}
          loop
        />

        <FlowingMenu items={materialMenuItems} className="material-flowing-menu" />
      </div>
    </section>
  );
}

function NotesTimeline() {
  return (
    <section className="section timeline-section" id="notes">
      <div className="section-heading" data-fade>
        <p className="section-index">08 / 创作日记</p>
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
        <p className="section-index">09 / 心动小档案</p>
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
        <p className="section-index">10 / 设计的小心思</p>
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
        <p className="section-index">11 / 悄悄话</p>
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

    let pendingX = 0;
    let pendingY = 0;
    let cursorFrame = 0;
    let cleanupResize: (() => void) | null = null;
    const flushCursor = () => {
      cursorFrame = 0;
      const x = pendingX;
      const y = pendingY;
      root.style.setProperty('--cursor-x', `${x}px`);
      root.style.setProperty('--cursor-y', `${y}px`);
      root.style.setProperty('--mouse-x', `${((x / window.innerWidth) - 0.5).toFixed(4)}`);
      root.style.setProperty('--mouse-y', `${((y / window.innerHeight) - 0.5).toFixed(4)}`);
      root.style.setProperty('--tilt-x', `${((y / window.innerHeight) - 0.5) * -8}deg`);
      root.style.setProperty('--tilt-y', `${((x / window.innerWidth) - 0.5) * 10}deg`);
    };
    const moveCursor = (event: PointerEvent) => {
      pendingX = event.clientX;
      pendingY = event.clientY;
      if (cursorFrame) return;
      cursorFrame = requestAnimationFrame(flushCursor);
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

      let resizeFrame = 0;
      const onResize = () => {
        if (resizeFrame) return;
        resizeFrame = window.setTimeout(() => {
          resizeFrame = 0;
          ScrollTrigger.refresh();
        }, 180);
      };
      window.addEventListener('resize', onResize);
      cleanupResize = () => {
        window.removeEventListener('resize', onResize);
        if (resizeFrame) {
          window.clearTimeout(resizeFrame);
        }
      };
    }

    return () => {
      window.removeEventListener('pointermove', moveCursor);
      if (cursorFrame) {
        cancelAnimationFrame(cursorFrame);
      }
      cleanupResize?.();
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
        <GardenStage />
        <MoonArchive />
        <BitsShowroom />
        <MaterialConsole />
        <NotesTimeline />
        <Gallery />
        <Philosophy />
        <ContactFooter />
      </main>
    </ClickSpark>
  );
}
