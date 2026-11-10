import '@fontsource/dela-gothic-one/latin-400.css';
import '@fontsource/zcool-qingke-huangyou';
import './riso.css';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { DreamConsole } from '../../components/DreamConsole';
import { SplitText } from '../../components/text-effects';
import { assets } from '../../content/assets';
import { clamp, prefersReducedMotion } from '../shared';
import {
  INKS,
  SCREEN_NAMES,
  composite,
  loadSource,
  paperSize,
  randomParams,
  renderPlates,
  type Ink,
  type Plate,
  type PrintParams,
  type Screen,
  type Source,
} from './engine';

const PRINT_SCALE = 2;
const MAX_PRINTS = 4;

type InkSet = { id: string; label: string; inks: Ink[]; fountain: boolean };

const inkSets: InkSet[] = [
  { id: 'three', label: '三色', inks: ['pink', 'blue', 'yellow'], fountain: false },
  { id: 'pinkblue', label: '粉蓝', inks: ['pink', 'blue'], fountain: false },
  { id: 'blueyellow', label: '蓝黄', inks: ['blue', 'yellow'], fountain: false },
  { id: 'fountain', label: '渐变', inks: ['blue'], fountain: true },
];

type PrintRecord = {
  id: number;
  no: number;
  params: PrintParams;
  canvas: HTMLCanvasElement;
  plates: Plate[] | null;
};

const slots = [
  { x: 47, scale: 1, tilt: 0 },
  { x: 24, scale: 0.6, tilt: -3 },
  { x: 8, scale: 0.44, tilt: 2.5 },
  { x: -10, scale: 0.36, tilt: -2 },
];

/** 晾衣绳是一条二次贝塞尔曲线（和下面 SVG 的 path 一致）：左端 18%，中间往下坠，右端 14% */
const ropeY = (t: number) => (1 - t) ** 2 * 18 + 2 * t * (1 - t) * 40 + t ** 2 * 14;

function describe(params: PrintParams) {
  const inks = params.fountain
    ? ['粉→黄渐变', ...params.inks.map((ink) => INKS[ink].name)]
    : params.inks.map((ink) => INKS[ink].name);
  return `${SCREEN_NAMES[params.screen]} · ${inks.join(' ')}`;
}

function inkSetFor(params: PrintParams) {
  return inkSets.find((set) => set.fountain === params.fountain && set.inks.join() === params.inks.join()) ?? inkSets[0];
}

function CanvasHost({ canvas, className }: { canvas: HTMLCanvasElement | null; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const host = ref.current;
    if (host && canvas && host.firstChild !== canvas) host.replaceChildren(canvas);
  }, [canvas]);
  return <div className={className} ref={ref} />;
}

function Lever({ disabled, onPull }: { disabled: boolean; onPull: () => void }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);
  const drag = useRef({ active: false, startY: 0, moved: 0 });
  const frame = useRef(0);

  const springBack = useCallback(() => {
    cancelAnimationFrame(frame.current);
    if (prefersReducedMotion()) {
      setProgress(0);
      return;
    }
    const step = () => {
      setProgress((value) => {
        const next = value * 0.8;
        if (next > 0.005) frame.current = requestAnimationFrame(step);
        return next > 0.005 ? next : 0;
      });
    };
    frame.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const pull = () => {
    if (disabled) return;
    setProgress(1);
    onPull();
    window.setTimeout(springBack, 180);
  };

  return (
    <div className="rs-lever" ref={trackRef} style={{ '--p': progress.toFixed(3) } as CSSProperties}>
      <span className="rs-lever-slot" aria-hidden="true" />
      <button
        type="button"
        className="rs-lever-knob"
        disabled={disabled}
        aria-label="拉下拉杆，印一张"
        onPointerDown={(event) => {
          if (disabled) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          cancelAnimationFrame(frame.current);
          drag.current = { active: true, startY: event.clientY, moved: 0 };
        }}
        onPointerMove={(event) => {
          if (!drag.current.active || !trackRef.current) return;
          const dy = event.clientY - drag.current.startY;
          drag.current.moved = Math.max(drag.current.moved, Math.abs(dy));
          setProgress(clamp(dy / (trackRef.current.clientHeight - 56), 0, 1));
        }}
        onPointerUp={() => {
          if (!drag.current.active) return;
          drag.current.active = false;
          if (drag.current.moved < 6) {
            pull();
            return;
          }
          setProgress((value) => {
            if (value > 0.7) window.setTimeout(pull, 0);
            else window.setTimeout(springBack, 0);
            return value;
          });
        }}
        onPointerCancel={() => {
          drag.current.active = false;
          springBack();
        }}
        onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            pull();
          }
        }}
      />
    </div>
  );
}

export default function RisoHome() {
  const shopRef = useRef<HTMLElement | null>(null);
  const sourceRef = useRef<Source | null>(null);
  const nextId = useRef(0);
  const shift = useRef<[number, number]>([0, 0]);
  const shiftTarget = useRef<[number, number]>([0, 0]);
  const shiftFrame = useRef(0);

  const [ready, setReady] = useState(false);
  const [prints, setPrints] = useState<PrintRecord[]>([]);
  const [count, setCount] = useState(0);
  const [freshId, setFreshId] = useState<number | null>(null);
  const [pulling, setPulling] = useState(false);
  const [inkSetId, setInkSetId] = useState('three');

  const [trial, setTrial] = useState<PrintParams | null>(null);
  const [focus, setFocus] = useState<[number, number]>([186, 150]);
  const loupeRef = useRef<HTMLCanvasElement | null>(null);
  const loupeDrag = useRef<{ x: number; y: number; focus: [number, number] } | null>(null);

  const makePrint = useCallback((params: PrintParams, no: number): PrintRecord | null => {
    const source = sourceRef.current;
    if (!source) return null;
    const plates = renderPlates(source, params, PRINT_SCALE);
    const canvas = document.createElement('canvas');
    const size = paperSize(source, PRINT_SCALE);
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `第 ${no} 张印刷品：${describe(params)}`);
    composite(canvas, plates, PRINT_SCALE);
    nextId.current += 1;
    return { id: nextId.current, no, params, canvas, plates };
  }, []);

  /* 载入看板娘，先印三张挂上去 */
  useEffect(() => {
    let cancelled = false;
    loadSource(assets.characterCutout).then((source) => {
      if (cancelled) return;
      sourceRef.current = source;
      const presets: PrintParams[] = [
        { ...randomParams(['blue'], true, 41), screen: 'grain', cell: 2.6 },
        { ...randomParams(['pink', 'blue'], false, 7), screen: 'line', cell: 3.2 },
        {
          ...randomParams(['pink', 'blue', 'yellow'], false, 3),
          screen: 'dot',
          cell: 2.6,
          offsets: { pink: [2.2, 1.4], blue: [0, 0], yellow: [-1.6, 2.4] },
        },
      ];
      const records = presets
        .map((params, index) => makePrint(params, index + 1))
        .filter((item): item is PrintRecord => Boolean(item))
        .reverse();
      records.slice(1).forEach((record) => {
        record.plates = null;
      });
      setPrints(records);
      setCount(presets.length);
      setTrial(records[0]?.params ?? null);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [makePrint]);

  /* 标题错版跟随指针 */
  useEffect(() => {
    const shop = shopRef.current;
    if (!shop || prefersReducedMotion()) return;
    let frame = 0;
    let x = 0.5;
    let y = 0.5;
    const flush = () => {
      frame = 0;
      shop.style.setProperty('--mx', x.toFixed(3));
      shop.style.setProperty('--my', y.toFixed(3));
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

  const pull = useCallback(
    (params?: PrintParams) => {
      if (!sourceRef.current || pulling) return;
      const set = inkSets.find((item) => item.id === inkSetId) ?? inkSets[0];
      const nextParams = params ?? randomParams(set.inks, set.fountain, Math.floor(Math.random() * 1e9));
      const no = count + 1;
      setPulling(true);
      window.setTimeout(() => {
        const record = makePrint(nextParams, no);
        if (!record) {
          setPulling(false);
          return;
        }
        setPrints((list) => {
          list.forEach((item) => {
            item.plates = null;
          });
          return [record, ...list].slice(0, MAX_PRINTS);
        });
        setFreshId(record.id);
        setCount(no);
        window.setTimeout(() => setPulling(false), prefersReducedMotion() ? 0 : 900);
      }, 30);
    },
    [count, inkSetId, makePrint, pulling],
  );

  /* 最新一张：指针拖出额外的错版 */

  const runShift = useCallback(() => {
    if (shiftFrame.current) return;
    const step = () => {
      const record = prints[0];
      const [tx, ty] = shiftTarget.current;
      const [sx, sy] = shift.current;
      const nx = sx + (tx - sx) * 0.22;
      const ny = sy + (ty - sy) * 0.22;
      shift.current = [nx, ny];
      if (record?.plates) composite(record.canvas, record.plates, PRINT_SCALE, shift.current);
      if (Math.abs(tx - nx) + Math.abs(ty - ny) > 0.02) {
        shiftFrame.current = requestAnimationFrame(step);
      } else {
        shiftFrame.current = 0;
      }
    };
    shiftFrame.current = requestAnimationFrame(step);
  }, [prints]);

  useEffect(() => () => cancelAnimationFrame(shiftFrame.current), []);

  const onSheetMove = (event: ReactPointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    shiftTarget.current = [px * 12, py * 10];
    runShift();
  };

  const onSheetLeave = () => {
    shiftTarget.current = [0, 0];
    runShift();
  };

  /* 放大镜 */
  useEffect(() => {
    const canvas = loupeRef.current;
    const source = sourceRef.current;
    if (!canvas || !source || !trial) return;
    const size = 64;
    const scale = canvas.width / size;
    const region = { x: focus[0] - size / 2, y: focus[1] - size / 2, w: size, h: size };
    const frame = requestAnimationFrame(() => {
      const plates = renderPlates(source, trial, scale, region);
      composite(canvas, plates, scale);
    });
    return () => cancelAnimationFrame(frame);
  }, [focus, trial, ready]);

  const updateTrial = (patch: Partial<PrintParams>) => setTrial((value) => (value ? { ...value, ...patch } : value));
  const misregister = trial ? Math.round(Math.hypot(...trial.offsets.pink) * 10) / 10 : 0;
  const setMisregister = (distance: number) =>
    updateTrial({
      offsets: { pink: [distance * 0.85, distance * 0.5], blue: [0, 0], yellow: [-distance * 0.6, distance * 0.8] },
    });
  const trialSet = trial ? inkSetFor(trial) : inkSets[0];

  return (
    <div className="rs-root">
      <main>
        <section className="rs-shop" ref={shopRef} aria-label="BTORN 印刷所">
          <h1 className="rs-title" aria-label="BTORN">
            <span className="rs-title-layer is-paper" aria-hidden="true">
              BTORN
            </span>
            <span className="rs-title-layer is-blue" aria-hidden="true">
              BTORN
            </span>
          </h1>

          <svg className="rs-rope" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 18 Q50 40 100 14" />
          </svg>

          <div className="rs-line">
            {prints.map((record, index) => {
              const slot = slots[Math.min(index, slots.length - 1)];
              const isCurrent = index === 0;
              return (
                <figure
                  key={record.id}
                  className="rs-sheet"
                  data-current={isCurrent}
                  data-index={index}
                  data-fresh={record.id === freshId}
                  style={
                    {
                      '--x': `${slot.x}%`,
                      '--y': `${ropeY(clamp(slot.x / 100, 0, 1))}%`,
                      '--s': slot.scale,
                      '--tilt': `${slot.tilt}deg`,
                      zIndex: 10 - index,
                    } as CSSProperties
                  }
                  onPointerMove={isCurrent ? onSheetMove : undefined}
                  onPointerLeave={isCurrent ? onSheetLeave : undefined}
                >
                  <span className="rs-peg" aria-hidden="true" />
                  <div className="rs-paper">
                    <CanvasHost canvas={record.canvas} className="rs-canvas" />
                    <i className="rs-drum" aria-hidden="true" />
                    <figcaption>
                      <b>No.{String(record.no).padStart(3, '0')}</b>
                      <span>{describe(record.params)}</span>
                    </figcaption>
                  </div>
                </figure>
              );
            })}
            {!ready && <p className="rs-loading">正在给滚筒上墨……</p>}
          </div>

          <aside className="rs-press" aria-label="印刷机">
            <div className="rs-drums" role="radiogroup" aria-label="油墨组合">
              {inkSets.map((set) => (
                <button
                  type="button"
                  role="radio"
                  key={set.id}
                  aria-checked={inkSetId === set.id}
                  className="rs-drum-button"
                  onClick={() => setInkSetId(set.id)}
                >
                  <span className={`rs-swatch ${set.fountain ? 'is-fountain' : ''}`} aria-hidden="true">
                    {(set.fountain ? ['blue'] : set.inks).map((ink) => (
                      <i key={ink} style={{ background: INKS[ink as Ink].css }} />
                    ))}
                  </span>
                  {set.label}
                </button>
              ))}
            </div>
            <Lever disabled={!ready || pulling} onPull={() => pull()} />
            <p className="rs-lever-hint">往下拉，印一张</p>
          </aside>

          <div className="rs-caption">
            <p className="rs-tagline">
              <SplitText text="孔版印刷所" delay={50} />
            </p>
            <p className="rs-tagline-sub">同一个看板娘，每一张都印得不一样。指针放在最新那张上，三块版会错开。</p>
          </div>

          <div className="rs-stamp" key={count} aria-live="polite">
            <span>BTORN 印刷所</span>
            <b>第 {String(count).padStart(3, '0')} 张</b>
          </div>
        </section>

        <section className="rs-loupe" aria-labelledby="rs-loupe-title">
          <div className="rs-loupe-controls">
            <h2 id="rs-loupe-title">网点放大镜</h2>
            <p>把看板娘的脸放大八倍，就能看到油墨其实是一颗一颗的点。拖动镜片换个地方看，调好了再印一张。</p>

            <fieldset className="rs-segment">
              <legend>排版方式</legend>
              {(Object.keys(SCREEN_NAMES) as Screen[]).map((screen) => (
                <label key={screen}>
                  <input
                    type="radio"
                    name="rs-screen"
                    checked={trial?.screen === screen}
                    onChange={() => updateTrial({ screen })}
                  />
                  <span>{SCREEN_NAMES[screen]}</span>
                </label>
              ))}
            </fieldset>

            <fieldset className="rs-segment">
              <legend>油墨</legend>
              {inkSets.map((set) => (
                <label key={set.id}>
                  <input
                    type="radio"
                    name="rs-inks"
                    checked={trialSet.id === set.id}
                    onChange={() => updateTrial({ inks: set.inks, fountain: set.fountain })}
                  />
                  <span>{set.label}</span>
                </label>
              ))}
            </fieldset>

            <label className="rs-slider">
              <span>网点大小</span>
              <input
                type="range"
                min={1.6}
                max={6}
                step={0.1}
                value={trial?.cell ?? 2.6}
                onChange={(event) => updateTrial({ cell: Number(event.target.value) })}
              />
              <output>{(trial?.cell ?? 2.6).toFixed(1)}</output>
            </label>

            <label className="rs-slider">
              <span>错版距离</span>
              <input
                type="range"
                min={0}
                max={6}
                step={0.1}
                value={misregister}
                onChange={(event) => setMisregister(Number(event.target.value))}
              />
              <output>{misregister.toFixed(1)}</output>
            </label>

            <button
              type="button"
              className="rs-print-trial"
              disabled={!trial || pulling}
              onClick={() => {
                if (!trial) return;
                pull({ ...trial, seed: Math.floor(Math.random() * 1e9) });
                shopRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
              }}
            >
              按这个参数印一张
            </button>
          </div>

          <div className="rs-lens-wrap">
            <div
              className="rs-lens"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                loupeDrag.current = { x: event.clientX, y: event.clientY, focus };
              }}
              onPointerMove={(event) => {
                const drag = loupeDrag.current;
                const source = sourceRef.current;
                if (!drag || !source) return;
                const rect = event.currentTarget.getBoundingClientRect();
                const perPx = 64 / rect.width;
                setFocus([
                  clamp(drag.focus[0] - (event.clientX - drag.x) * perPx, 0, source.width),
                  clamp(drag.focus[1] - (event.clientY - drag.y) * perPx, 0, source.height),
                ]);
              }}
              onPointerUp={() => {
                loupeDrag.current = null;
              }}
              onPointerCancel={() => {
                loupeDrag.current = null;
              }}
            >
              <canvas ref={loupeRef} width={640} height={640} role="img" aria-label="放大八倍的网点" />
            </div>
            <span className="rs-lens-handle" aria-hidden="true" />
          </div>
        </section>

        <section className="rs-special" aria-labelledby="rs-special-title">
          <header>
            <h2 id="rs-special-title">特印：梦境分类</h2>
            <p>这一份不用油墨，用电视信号印。往下滑换台，点画面暂停。</p>
          </header>
          <DreamConsole />
        </section>
      </main>

      <footer className="rs-colophon">
        <div className="rs-colophon-card">
          <h2>奥付</h2>
          <dl>
            <div>
              <dt>书名</dt>
              <dd>BTORN 印刷所</dd>
            </div>
            <div>
              <dt>印刷</dt>
              <dd>孔版印刷（荧光粉 · 中蓝 · 黄）</dd>
            </div>
            <div>
              <dt>本次印数</dt>
              <dd>{count} 张</dd>
            </div>
            <div>
              <dt>插画</dt>
              <dd>有原创也有收藏，版权归各自作者</dd>
            </div>
            <div>
              <dt>发行</dt>
              <dd>BTORN</dd>
            </div>
          </dl>
          <span className="rs-hanko" aria-hidden="true">
            BT
            <br />印
          </span>
        </div>
      </footer>
    </div>
  );
}
