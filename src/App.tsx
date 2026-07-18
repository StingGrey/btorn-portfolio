import { lazy, Suspense, type ComponentType, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useSiteContent } from './editor/SiteEditor';
import type { SiteSectionId } from './content/site-copy';
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
  { dateKey: 'notes.item.1.date', textKey: 'notes.item.1.text' },
  { dateKey: 'notes.item.2.date', textKey: 'notes.item.2.text' },
  { dateKey: 'notes.item.3.date', textKey: 'notes.item.3.text' },
  { dateKey: 'notes.item.4.date', textKey: 'notes.item.4.text' },
];

const gallery = [
  { src: assets.gallerySky, titleKey: 'gallery.item.1.title', tagKey: 'gallery.item.1.tag' },
  { src: assets.galleryFreshReader, titleKey: 'gallery.item.2.title', tagKey: 'gallery.item.2.tag' },
  { src: assets.galleryFreshBlue, titleKey: 'gallery.item.3.title', tagKey: 'gallery.item.3.tag' },
  { src: assets.galleryFreshPoster, titleKey: 'gallery.item.4.title', tagKey: 'gallery.item.4.tag' },
  { src: assets.galleryStudy, titleKey: 'gallery.item.5.title', tagKey: 'gallery.item.5.tag' },
  { src: assets.galleryExtra, titleKey: 'gallery.item.6.title', tagKey: 'gallery.item.6.tag' },
];

type MotionTokenProps = {
  text: string;
  variant?: number;
  className?: string;
  fieldKey?: string;
};

function MotionToken({ text, variant = 0, className = '', fieldKey }: MotionTokenProps) {
  const motionClassName = `inline-motion ${className}`.trim();
  const editorProps = fieldKey ? { 'data-editor-field': fieldKey } : {};

  switch (variant % 6) {
    case 0:
      return <ScrambledText text={text} className={motionClassName} speed={46} intensity={0.22} {...editorProps} />;
    case 1:
      return <ShinyText text={text} className={motionClassName} speed={2.4} {...editorProps} />;
    case 2:
      return <SplitText text={text} className={motionClassName} delay={9} {...editorProps} />;
    case 3:
      return <BlurText text={text} as="span" by="char" delay={8} className={motionClassName} {...editorProps} />;
    case 4:
      return <DecryptedText text={text} className={motionClassName} animateOn="view" sequential speed={30} {...editorProps} />;
    default:
      return <TextPressure text={text} as="span" className={motionClassName} {...editorProps} />;
  }
}

const contactLinks = [
  { hrefKey: 'contact.link.1.href', labelKey: 'contact.link.1.label', icon: Github, external: true },
  { hrefKey: 'contact.link.2.href', labelKey: 'contact.link.2.label', icon: ExternalLink, external: true },
  { hrefKey: 'contact.link.3.href', labelKey: 'contact.link.3.label', icon: Send, external: true },
  { hrefKey: 'contact.link.4.href', labelKey: 'contact.link.4.label', icon: Mail, external: false },
];

const workCategories = [
  {
    id: '01',
    file: 'dream_01',
    labelKey: 'works.item.1.label',
    titleKey: 'works.item.1.title',
    descKey: 'works.item.1.desc',
    ctaKey: 'works.item.1.cta',
    src: assets.galleryPinkArrow,
  },
  {
    id: '02',
    file: 'dream_02',
    labelKey: 'works.item.2.label',
    titleKey: 'works.item.2.title',
    descKey: 'works.item.2.desc',
    ctaKey: 'works.item.2.cta',
    src: assets.characterTech,
  },
  {
    id: '03',
    file: 'dream_03',
    labelKey: 'works.item.3.label',
    titleKey: 'works.item.3.title',
    descKey: 'works.item.3.desc',
    ctaKey: 'works.item.3.cta',
    src: assets.galleryTeam,
  },
  {
    id: '04',
    file: 'dream_04',
    labelKey: 'works.item.4.label',
    titleKey: 'works.item.4.title',
    descKey: 'works.item.4.desc',
    ctaKey: 'works.item.4.cta',
    src: assets.galleryNight,
  },
];

const sceneCards = [
  { src: assets.sceneMoon, titleKey: 'moon.card.1.title', tagKey: 'moon.card.1.tag' },
  { src: assets.sceneSteps, titleKey: 'moon.card.2.title', tagKey: 'moon.card.2.tag' },
  { src: assets.sceneCandySky, titleKey: 'moon.card.3.title', tagKey: 'moon.card.3.tag' },
  { src: assets.sceneCloseup, titleKey: 'moon.card.4.title', tagKey: 'moon.card.4.tag' },
];

const materialScenes = [
  {
    id: 'glass-room',
    src: assets.materialGlassRoom,
    titleKey: 'materials.item.1.title',
    tagKey: 'materials.item.1.tag',
    accent: '#8be5ff',
    copyKey: 'materials.item.1.copy',
  },
  {
    id: 'long-pink',
    src: assets.materialLongPink,
    titleKey: 'materials.item.2.title',
    tagKey: 'materials.item.2.tag',
    accent: '#ff7fa8',
    copyKey: 'materials.item.2.copy',
  },
  {
    id: 'wide-lilac',
    src: assets.materialWideLilac,
    titleKey: 'materials.item.3.title',
    tagKey: 'materials.item.3.tag',
    accent: '#b68dff',
    copyKey: 'materials.item.3.copy',
  },
  {
    id: 'sky-panorama',
    src: assets.materialSkyPanorama,
    titleKey: 'materials.item.4.title',
    tagKey: 'materials.item.4.tag',
    accent: '#7fd7ff',
    copyKey: 'materials.item.4.copy',
  },
];

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
  const { text, isHidden } = useSiteContent();
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
    <section className="hero" id="top" data-editor-section="hero" data-site-hidden={isHidden('hero') ? 'true' : undefined}>
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
                text={text('hero.code')}
                data-editor-field="hero.code"
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
                  <DecryptedText text={text('hero.core')} animateOn="view" sequential speed={38} data-editor-field="hero.core" />
                </span>
                <small>
                  <MotionToken text={text('hero.tagline')} variant={1} fieldKey="hero.tagline" />
                </small>
              </div>
            </div>
          </h1>
        </div>
        <div className="hero-meta">
          <span>
            <MotionToken text={text('hero.meta.tech')} variant={0} fieldKey="hero.meta.tech" />
          </span>
          <span>
            <MotionToken text={text('hero.meta.interface')} variant={1} fieldKey="hero.meta.interface" />
          </span>
          <span>
            <MotionToken text={text('hero.meta.version')} variant={2} fieldKey="hero.meta.version" />
          </span>
        </div>
      </div>

      <a className="scroll-cue" href="#profile">
        <ShinyText text={text('hero.scroll')} speed={2.2} data-editor-field="hero.scroll" />
        <ArrowRight size={18} aria-hidden="true" />
      </a>
    </section>
  );
}

function SplitReveal() {
  const { text, isHidden } = useSiteContent();
  return (
    <section className="cutout-section" id="profile" data-editor-section="profile" data-site-hidden={isHidden('profile') ? 'true' : undefined}>
      <div className="cutout-sticky">
        <div className="cutout-copy reveal-item">
          <p className="section-index" data-editor-field="profile.index">{text('profile.index')}</p>
          <h2>
            <BlurText text={text('profile.title')} as="span" by="char" delay={16} data-editor-field="profile.title" />
          </h2>
          <ScrollReveal
            text={text('profile.body')}
            data-editor-field="profile.body"
            as="p"
            direction="right"
            delay={28}
          />
          <div className="signal-strip">
            <span>
              <MotionToken text={text('profile.signal.1')} variant={2} fieldKey="profile.signal.1" />
            </span>
            <span>
              <MotionToken text={text('profile.signal.2')} variant={1} fieldKey="profile.signal.2" />
            </span>
            <span>
              <MotionToken text={text('profile.signal.3')} variant={0} fieldKey="profile.signal.3" />
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
          <div className="cutout-chip chip-a" data-editor-field="profile.chip.1">
            <ScanLine size={16} />
            {text('profile.chip.1')}
          </div>
          <div className="cutout-chip chip-b" data-editor-field="profile.chip.2">
            <Sparkles size={16} />
            {text('profile.chip.2')}
          </div>
        </div>
      </div>
    </section>
  );
}

function WorksLab() {
  const { text, isHidden } = useSiteContent();
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
    <section
      ref={worksRef}
      className="works-console-section"
      id="works"
      data-status={isPlaying ? 'playing' : 'paused'}
      data-editor-section="works"
      data-site-hidden={isHidden('works') ? 'true' : undefined}
    >
      <div className="works-console-sticky">
        <div className="works-console-frame">
          <div className="works-crt-noise" aria-hidden="true" />
          <div className="works-scanline" aria-hidden="true" />

          <div className="works-index">
            <h2>
              <span />
              <SplitText text={text('works.heading')} delay={20} data-editor-field="works.heading" />
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
                  <MotionToken text={text(item.labelKey)} variant={index} fieldKey={item.labelKey} />
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
            <span className="works-vertical-title" aria-hidden="true" data-editor-field={current.labelKey}>
              {text(current.labelKey)}
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
                <img className="works-media-main" src={current.src} alt={`${text(current.labelKey)} visual`} />
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
                  <BlurText text={text(current.titleKey)} as="span" by="char" delay={12} data-editor-field={current.titleKey} />
                </h3>
                <ScrollReveal text={text(current.descKey)} as="p" direction="left" delay={24} data-editor-field={current.descKey} />
                <a href="#gallery">
                  <ShinyText text={`${text(current.ctaKey)} →`} speed={2.4} color="rgba(248, 245, 247, 0.9)" data-editor-field={current.ctaKey} />
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
  const { text, isHidden } = useSiteContent();
  return (
    <section className="section garden-section" id="garden" data-editor-section="garden" data-site-hidden={isHidden('garden') ? 'true' : undefined}>
      <div className="garden-copy" data-fade>
        <p className="section-index" data-editor-field="garden.index">{text('garden.index')}</p>
        <h2>
          <TextPressure text={text('garden.title')} data-editor-field="garden.title" />
        </h2>
        <BlurText text={text('garden.body')} as="p" by="char" delay={10} data-editor-field="garden.body" />
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
  const { text, isHidden } = useSiteContent();
  return (
    <section className="section moon-section" id="moon" data-editor-section="moon" data-site-hidden={isHidden('moon') ? 'true' : undefined}>
      <div className="moon-copy" data-fade>
        <p className="section-index" data-editor-field="moon.index">{text('moon.index')}</p>
        <h2>
          <SplitText text={text('moon.title')} delay={28} data-editor-field="moon.title" />
        </h2>
        <ScrollReveal text={text('moon.body')} as="p" direction="right" delay={26} data-editor-field="moon.body" />
      </div>
      <div className="moon-orbit" aria-hidden="true">
        <span />
        <span />
      </div>
      <div className="moon-rail" data-fade>
        {sceneCards.map((card, index) => (
          <figure className="moon-card" key={card.src} style={{ '--i': index } as React.CSSProperties}>
            <img src={card.src} alt={`${text(card.titleKey)}场景`} />
            <figcaption>
              <span>
                <MotionToken text={text(card.tagKey)} variant={index + 1} fieldKey={card.tagKey} />
              </span>
              <strong>
                {index % 2
                  ? <ShinyText text={text(card.titleKey)} speed={2.1} data-editor-field={card.titleKey} />
                  : <DecryptedText text={text(card.titleKey)} animateOn="hover" sequential speed={32} data-editor-field={card.titleKey} />}
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
  const { text, isHidden } = useSiteContent();
  return (
    <section className="section bits-showroom-section" id="bits" data-editor-section="bits" data-site-hidden={isHidden('bits') ? 'true' : undefined}>
      <div className="bits-showroom-head" data-fade>
        <p className="section-index" data-editor-field="bits.index">{text('bits.index')}</p>
        <h2 data-editor-field="bits.title.1">
          <TextType
            text={[text('bits.title.1'), text('bits.title.2')]}
            typingSpeed={48}
            deletingSpeed={24}
            pauseDuration={1500}
            startOnVisible
          />
        </h2>
        <ScrollReveal
          text={text('bits.body')}
          data-editor-field="bits.body"
          as="p"
          direction="left"
          delay={30}
        />
      </div>

      <div className="bits-showroom-grid">
        <div className="bits-command-panel" data-fade>
          <ShinyText text={text('bits.kicker')} className="bits-kicker" speed={2.1} data-editor-field="bits.kicker" />
          <Dock items={bitsDockItems} className="bits-dock" />
          <div className="bits-command-copy">
            <h3>
              <SplitText text={text('bits.command.title')} delay={24} data-editor-field="bits.command.title" />
            </h3>
            <BlurText text={text('bits.command.body')} as="p" by="char" delay={8} data-editor-field="bits.command.body" />
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
              <MotionToken text={text('bits.pixel.tag')} variant={4} fieldKey="bits.pixel.tag" />
            </span>
            <strong>
              <SplitText text={text('bits.pixel.title')} delay={18} data-editor-field="bits.pixel.title" />
            </strong>
          </div>
        </PixelTransition>

        <TiltedCard
          className="bits-tilted-feature"
          imageSrc={assets.bitsOrangePortrait}
          altText="orange portrait illustration"
          captionText={text('bits.tilt.caption')}
          rotateAmplitude={16}
          scaleOnHover={1.04}
          overlayContent={<ShinyText text={text('bits.tilt.overlay')} speed={1.8} data-editor-field="bits.tilt.overlay" />}
          data-fade
        />
      </div>
    </section>
  );
}

function MaterialConsole() {
  const { text, isHidden } = useSiteContent();
  const materialMenuItems = useMemo(() => materialScenes.map((scene) => ({
    label: text(scene.titleKey),
    text: text(scene.copyKey),
    meta: text(scene.tagKey),
  })), [text]);
  const materialCarouselItems = useMemo(() => materialScenes.map((scene) => ({
    id: scene.id,
    title: text(scene.titleKey),
    tag: text(scene.tagKey),
    src: scene.src,
    accent: scene.accent,
    description: text(scene.copyKey),
  })), [text]);

  return (
    <section className="section material-section" id="materials" data-editor-section="materials" data-site-hidden={isHidden('materials') ? 'true' : undefined}>
      <Aurora className="material-aurora" colorStops={['#ff5f8f', '#54f4ff', '#8d6cff']} speed={14} amplitude={1.2} blend={0.72} />
      <Silk className="material-silk" color="#ff5f8f" speed={9} scale={1.15} noiseIntensity={0.7} rotation={-10} />

      <div className="material-copy" data-fade>
        <p className="section-index" data-editor-field="materials.index">{text('materials.index')}</p>
        <h2>
          <TextPressure text={text('materials.title')} data-editor-field="materials.title" />
        </h2>
        <BlurText
          text={text('materials.body')}
          data-editor-field="materials.body"
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
  const { text, isHidden } = useSiteContent();
  return (
    <section className="section timeline-section" id="notes" data-editor-section="notes" data-site-hidden={isHidden('notes') ? 'true' : undefined}>
      <div className="section-heading" data-fade>
        <p className="section-index" data-editor-field="notes.index">{text('notes.index')}</p>
        <h2>
          <TextType text={text('notes.title')} loop={false} typingSpeed={42} startOnVisible data-editor-field="notes.title" />
        </h2>
        <BlurText text={text('notes.body')} as="p" by="char" delay={10} data-editor-field="notes.body" />
      </div>
      <div className="timeline">
        {notes.map((item, index) => (
          <article className="timeline-item" key={item.dateKey} data-fade>
            <time>
              <MotionToken text={text(item.dateKey)} variant={index + 1} fieldKey={item.dateKey} />
            </time>
            <ScrollReveal text={text(item.textKey)} as="p" direction={index % 2 ? 'left' : 'right'} delay={20} data-editor-field={item.textKey} />
          </article>
        ))}
      </div>
    </section>
  );
}

function Gallery() {
  const { text, isHidden } = useSiteContent();
  return (
    <section className="section gallery-section" id="gallery" data-editor-section="gallery" data-site-hidden={isHidden('gallery') ? 'true' : undefined}>
      <div className="section-heading" data-fade>
        <p className="section-index" data-editor-field="gallery.index">{text('gallery.index')}</p>
        <h2>
          <SplitText text={text('gallery.title')} delay={24} data-editor-field="gallery.title" />
        </h2>
        <BlurText text={text('gallery.body')} as="p" by="char" delay={9} data-editor-field="gallery.body" />
      </div>
      <div className="gallery-track" aria-label="Selected anime mood crops">
        {gallery.map((item, index) => (
          <Magnet
            wrapperClassName="gallery-magnet"
            innerClassName="gallery-magnet-inner"
            padding={54}
            magnetStrength={18}
            key={item.titleKey}
          >
            <figure className="gallery-card" data-fade>
              <img src={item.src} alt={`${text(item.titleKey)} mood crop`} />
              <figcaption>
                <span>
                  <MotionToken text={text(item.tagKey)} variant={index} fieldKey={item.tagKey} />
                </span>
                <strong>
                  {index % 2
                    ? <ShinyText text={text(item.titleKey)} speed={2.2} data-editor-field={item.titleKey} />
                    : <DecryptedText text={text(item.titleKey)} animateOn="hover" sequential speed={32} data-editor-field={item.titleKey} />}
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
  const { text, isHidden } = useSiteContent();
  return (
    <section className="section signal-section" id="about" data-editor-section="about" data-site-hidden={isHidden('about') ? 'true' : undefined}>
      <img className="signal-image" src={assets.signalFreshFlower} alt="花花的小心情" data-fade />
      <div className="signal-panel" data-fade>
        <Layers3 size={32} />
        <p className="section-index" data-editor-field="about.index">{text('about.index')}</p>
        <h2>
          <TextPressure text={text('about.title')} data-editor-field="about.title" />
        </h2>
        <ScrollReveal
          text={text('about.body')}
          data-editor-field="about.body"
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
  const { text, isHidden } = useSiteContent();
  return (
    <footer className="contact-footer" id="contact" data-editor-section="contact" data-site-hidden={isHidden('contact') ? 'true' : undefined}>
      <div>
        <p className="section-index" data-editor-field="contact.index">{text('contact.index')}</p>
        <h2>
          <TextPressure text={text('contact.title')} data-editor-field="contact.title" />
        </h2>
        <BlurText text={text('contact.body')} as="p" by="char" delay={12} data-editor-field="contact.body" />
      </div>
      <div className="contact-links" aria-label="Contact links">
        {contactLinks.map(({ hrefKey, labelKey, icon: Icon, external }) => (
          <Magnet wrapperClassName="contact-magnet" innerClassName="contact-magnet-inner" padding={42} magnetStrength={14} key={labelKey}>
            <a href={text(hrefKey)} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined} data-editor-field={labelKey}>
              <Icon size={18} />
              {text(labelKey)}
            </a>
          </Magnet>
        ))}
      </div>
      <StarBorder className="terminal-star" color="rgba(84, 244, 255, 0.9)" speed="8s" thickness={1}>
        <pre className="terminal-block" data-editor-field="contact.terminal">{text('contact.terminal')}</pre>
      </StarBorder>
    </footer>
  );
}

const siteSectionComponents: Record<SiteSectionId, ComponentType> = {
  hero: OrbitHero,
  profile: SplitReveal,
  works: WorksLab,
  garden: GardenStage,
  moon: MoonArchive,
  bits: BitsShowroom,
  materials: MaterialConsole,
  notes: NotesTimeline,
  gallery: Gallery,
  about: Philosophy,
  contact: ContactFooter,
};

export default function App() {
  const { sectionOrder } = useSiteContent();
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
        {sectionOrder.map((id) => {
          const Section = siteSectionComponents[id];
          return <Section key={id} />;
        })}
      </main>
    </ClickSpark>
  );
}
