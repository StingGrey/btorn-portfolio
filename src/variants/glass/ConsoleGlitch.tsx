import { useEffect, useId, useRef, type RefObject } from 'react';

type ConsoleGlitchProps = {
  /** 套滤镜的元素（控制台那一层） */
  target: RefObject<HTMLElement | null>;
  /** 控制台在屏幕上时才跑 */
  active: boolean;
  /** 0..1：首屏碎掉、切进控制台的那段转场 */
  entry: number;
  /** 值一变就来一阵爆发（切换分类时） */
  burstKey: number;
  reducedMotion: boolean;
};

/**
 * 控制台的「错位」故障：横向撕裂条 + 红、青两路通道左右错开。
 * 用 SVG 滤镜套在整层 DOM 上，一拍一拍地跳；不在故障的时候把滤镜摘掉，不白白耗性能。
 */
export function ConsoleGlitch({ target, active, entry, burstKey, reducedMotion }: ConsoleGlitchProps) {
  const id = `gl-shift-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const turbulenceRef = useRef<SVGFETurbulenceElement | null>(null);
  const displaceRef = useRef<SVGFEDisplacementMapElement | null>(null);
  const redRef = useRef<SVGFEOffsetElement | null>(null);
  const cyanRef = useRef<SVGFEOffsetElement | null>(null);
  const entryRef = useRef(0);
  const burstRef = useRef(0);
  const lastKey = useRef(burstKey);

  useEffect(() => {
    entryRef.current = reducedMotion ? Math.min(entry, 0.2) : entry;
  }, [entry, reducedMotion]);

  useEffect(() => {
    if (burstKey === lastKey.current) return;
    lastKey.current = burstKey;
    if (!reducedMotion) burstRef.current = 1;
  }, [burstKey, reducedMotion]);

  useEffect(() => {
    const node = target.current;
    const turbulence = turbulenceRef.current;
    const displace = displaceRef.current;
    const red = redRef.current;
    const cyan = cyanRef.current;
    if (!active || !node || !turbulence || !displace || !red || !cyan) return;

    let frame = 0;
    let last = performance.now();
    let lastTick = 0;
    let nextAmbient = last + 1400 + Math.random() * 2400;
    let applied = false;

    const loop = (now: number) => {
      const gap = now - last;
      const dt = Math.min(gap / 1000, 0.1);
      last = now;
      burstRef.current = Math.max(0, burstRef.current - dt * 2.4);
      // 标签页切回来之类的长停顿之后不要马上抽
      if (gap > 400) nextAmbient = Math.max(nextAmbient, now + 900 + Math.random() * 1600);
      // 平时也会时不时抽一下，有时连着抽两下
      if (!reducedMotion && now > nextAmbient) {
        burstRef.current = Math.max(burstRef.current, 0.3 + Math.random() * 0.3);
        nextAmbient = Math.random() < 0.35 ? now + 140 + Math.random() * 120 : now + 1000 + Math.random() * 1800;
      }
      const amount = Math.min(1, Math.max(entryRef.current, burstRef.current));
      if (amount < 0.02) {
        if (applied) {
          node.style.filter = '';
          applied = false;
        }
      } else {
        if (!applied) {
          node.style.filter = `url(#${id})`;
          applied = true;
        }
        // 故障是一拍一拍跳的，不是连续变化
        if (now - lastTick > 66) {
          lastTick = now;
          const kick = 0.55 + Math.random() * 0.9;
          turbulence.setAttribute('seed', String(Math.floor(Math.random() * 997)));
          turbulence.setAttribute('baseFrequency', `0.00001 ${(0.012 + Math.random() * 0.05).toFixed(4)}`);
          // 小抽动只错开几像素，大爆发（转场、切换分类）才撕得很开
          displace.setAttribute('scale', (Math.pow(amount, 1.5) * 120 * kick).toFixed(1));
          const split = (2 + amount * 16 * kick).toFixed(1);
          red.setAttribute('dx', `-${split}`);
          cyan.setAttribute('dx', split);
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      node.style.filter = '';
    };
  }, [active, id, reducedMotion, target]);

  return (
    <svg className="gl-filter-defs" aria-hidden="true" focusable="false" width="0" height="0">
      <filter id={id} x="-8%" y="0%" width="116%" height="100%" colorInterpolationFilters="sRGB">
        {/* 只沿竖直方向变化的噪声 = 一条条横带 */}
        <feTurbulence ref={turbulenceRef} type="fractalNoise" baseFrequency="0.00001 0.03" numOctaves={1} seed={3} result="noise" />
        {/* 量化成条：大部分条是 0.5（不动），少数几条往左或往右错开 */}
        <feComponentTransfer in="noise" result="bands">
          <feFuncR type="discrete" tableValues="0.5 0.5 0.5 0.1 0.5 0.35 0.5 0.5 0.5 0.7 0.5 0.95 0.5 0.5 0.5" />
          <feFuncG type="discrete" tableValues="0.5" />
          <feFuncA type="discrete" tableValues="1" />
        </feComponentTransfer>
        <feDisplacementMap
          ref={displaceRef}
          in="SourceGraphic"
          in2="bands"
          scale="0"
          xChannelSelector="R"
          yChannelSelector="G"
          result="torn"
        />
        {/* 红一路、青一路，左右拉开再叠回去 */}
        <feColorMatrix in="torn" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red" />
        <feOffset ref={redRef} in="red" dx="0" dy="0" result="redShift" />
        <feColorMatrix in="torn" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="cyan" />
        <feOffset ref={cyanRef} in="cyan" dx="0" dy="0" result="cyanShift" />
        <feBlend in="redShift" in2="cyanShift" mode="screen" />
      </filter>
    </svg>
  );
}
