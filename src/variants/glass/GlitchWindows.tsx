import './glitch-windows.css';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { CircleAlert, CircleHelp, CircleX, Hourglass, Magnet, Radio, X } from 'lucide-react';
import { channels } from './content';

/**
 * 电视退到一边以后，往下滑就从电视屏幕里一个接一个地冒出故障弹窗，越滑越多、越冒越快，最后整屏都是，连电视也盖住。
 * 前面十一个是有内容的（四个梦境频道、进度条、没反应的提示……），后面是几串层层叠叠的报错窗口和满屏乱飞的小弹窗。
 * 弹窗里不放任何插画、不复用素材：四个频道窗口各是一种不同的测试图案，坏掉的文件是一屏十六进制，
 * 九十多个弹窗的字没有两个是一样的。
 * 弹窗可以拖、可以关；往回滑就按相反的顺序收回去。
 */

type Kind = 'log' | 'channel' | 'noise' | 'copying' | 'waiting' | 'jar' | 'hex' | 'degauss' | 'error' | 'question' | 'mini';

type Spot = { x: number; y: number };

type WindowDef = {
  id: string;
  title: string;
  kind: Kind;
  /** 宽度（px）和估计高度（用来把弹窗留在视口里） */
  w: number;
  h: number;
  /** 宽屏（电视在左边）、窄屏（电视在上面）时的位置，占舞台宽高的比例 */
  side: Spot;
  up: Spot;
  /** 一串报错窗口里的第几个：每个往右下错开一点，排成一溜 */
  step?: number;
  /** 满屏乱飞的那些：位置不夹在视口里，可以半截出界 */
  free?: boolean;
  channel?: number;
  text?: string;
  bar?: string;
};

// 每个弹窗的字都不一样：报错、提问、小进度条各有一池，用一句划掉一句，不重复
const ERROR_LINES = [
  'dream.exe is not responding.',
  'Too many dreams are open.',
  'A toy fell out of the jar.',
  'Out of hugs. Please insert more.',
  'The glass is still broken.',
  'Signal lost. Wiggle the antenna?',
  'Not enough sleep to continue.',
  'Sticker count does not match.',
  'Bunny not found. Last seen: sticker box.',
  'Cannot open dream_05. It does not exist yet.',
  'The jar is full of feelings.',
  'Pillow overflow at line 3.',
  'Too much pink. Rendering anyway.',
  'Stars could not be counted.',
  'Rainbow driver missing.',
  'The cat refused the fish snacks.',
  'Low battery: 2% of cuteness left.',
  'This window opened another window.',
  'This window has no purpose.',
  'Antenna points the wrong way.',
  'Daydream took too long to load.',
  'Glitter leaked into the keyboard.',
  'Memory full of small moments.',
  'A ribbon came untied.',
  'The moon is not responding.',
  'Too many tabs, not enough naps.',
  'Heart rate: too fluffy.',
  'snack.exe ended unexpectedly.',
  'Lost connection to the clouds.',
  'Error reading blanket.dat.',
  'Pastel overflow. Some colours were too soft.',
  'The jar lid is stuck.',
  'Gravity failed in one toy.',
  'Sleepy pixel detected.',
  'Could not save the sunset.',
  'Your wish is still in the queue.',
  'A sticker is peeling off.',
  'Dream cache is warm. Please wait.',
  'Too many sparkles per second.',
  'The TV is feeling shy.',
  'Channel 7 is only static.',
  'Nap scheduled. Ignoring input.',
  'Secret found. Please forget it.',
  'The bow is crooked.',
  'Hug buffer underrun.',
  'The lullaby skipped a beat.',
  'Not enough marshmallows.',
  'Soft reset requested by a cloud.',
  'Window limit reached. Opening more anyway.',
  'Something cute happened. Details unknown.',
  'The glass would like to be left alone.',
  'Too many crumbs in this dream.',
  'Time zone: somewhere sleepy.',
  'Cannot find the end of the rainbow.',
  'One toy is hiding behind the jar.',
  'Scrolling will not fix this.',
  'The static is getting louder.',
  'The blanket fort has collapsed.',
  'Everything is pink and nothing is fine.',
  'The remote is under a pillow.',
  'Ran out of soft things.',
  'Dream 04 is counting stickers.',
];

const ERROR_TITLES = [
  'dream.exe', 'glass.sys', 'toybox.dll', 'antenna.cfg', 'jar.sys', 'pillow.dll', 'sticker.db', 'rainbow.drv',
  'moon.exe', 'blanket.dat', 'nap.sys', 'sparkle.dll', 'cloud.cfg', 'bunny.exe', 'ribbon.ini', 'cocoa.sys',
  'starmap.db', 'lullaby.wav', 'cat.exe', 'heart.dll', 'wish.queue', 'crumbs.tmp', 'fort.sys', 'remote.exe',
  'static.log', 'sunset.png', 'marshmallow.dll', 'window.exe', 'pastel.icc', 'secret.txt', 'snack.exe', 'gravity.sys',
  'glitter.bin', 'daydream.tmp', 'moments.db', 'tabs.cache', 'fluff.cfg', 'clouds.net', 'colours.icc', 'lid.sys',
  'pixel.drv', 'queue.dat', 'cache.warm', 'sparkles.fps', 'shy.tv', 'ch07.sig', 'nap.cron', 'forget.me',
  'bow.ini', 'hugbuf.sys', 'beat.mid', 'reset.cloud', 'limit.cfg', 'cute.evt', 'alone.sys', 'zone.tz',
  'rainbow.end', 'hide.toy', 'bunny.hole', 'pinky.swear', 'nightlight.sys', 'teacup.dll',
];

const QUESTIONS = [
  'Are you still dreaming?',
  'Close all the windows?',
  'Is the bunny still lost?',
  'Turn it off and on again?',
  'Keep the broken glass?',
  'Open one more window?',
  'Would you like a hug?',
  'Is it naptime yet?',
  'Save this dream before closing?',
  'Let the cat in?',
  'Count the stars again?',
  'Wake up now?',
  'Tidy up later?',
  'Did you leave the TV on?',
];

const MINI = [
  'loading_hug.exe', 'counting_stars.exe', 'defrag_dreams.exe', 'warming_up.exe', 'tidying_jar.exe',
  'fluffing_pillow.exe', 'untangling_ribbon.exe', 'charging_wings.exe', 'finding_bunny.exe', 'sorting_stickers.exe',
  'brewing_cocoa.exe',
];

/** 固定的伪随机：每次打开页面弹窗都落在同样的地方 */
function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

const DESIGNED: WindowDef[] = [
  { id: 'log', title: 'signal.log', kind: 'log', w: 270, h: 150, side: { x: 0.3, y: 0.08 }, up: { x: 0.04, y: 0.4 } },
  { id: 'ch0', title: 'dream_01', kind: 'channel', channel: 0, w: 280, h: 290, side: { x: 0.58, y: 0.05 }, up: { x: 0.42, y: 0.3 } },
  { id: 'noise', title: 'no_signal.png', kind: 'noise', w: 210, h: 170, side: { x: 0.82, y: 0.1 }, up: { x: 0.6, y: 0.5 } },
  { id: 'copy', title: 'copying.exe', kind: 'copying', w: 320, h: 140, side: { x: 0.16, y: 0.55 }, up: { x: 0.06, y: 0.55 } },
  { id: 'ch1', title: 'dream_02', kind: 'channel', channel: 1, w: 270, h: 290, side: { x: 0.74, y: 0.32 }, up: { x: 0.46, y: 0.6 } },
  { id: 'wait', title: 'Treasure Box', kind: 'waiting', w: 300, h: 170, side: { x: 0.45, y: 0.4 }, up: { x: 0.03, y: 0.68 } },
  { id: 'jar', title: 'jar.txt', kind: 'jar', w: 220, h: 130, side: { x: 0.05, y: 0.12 }, up: { x: 0.6, y: 0.12 } },
  { id: 'ch2', title: 'dream_03', kind: 'channel', channel: 2, w: 270, h: 290, side: { x: 0.33, y: 0.6 }, up: { x: 0.3, y: 0.46 } },
  { id: 'hex', title: 'corrupt.bin', kind: 'hex', w: 250, h: 190, side: { x: 0.66, y: 0.16 }, up: { x: 0.7, y: 0.22 } },
  { id: 'degauss', title: 'degauss.exe', kind: 'degauss', w: 250, h: 130, side: { x: 0.52, y: 0.78 }, up: { x: 0.12, y: 0.84 } },
  { id: 'ch3', title: 'dream_04', kind: 'channel', channel: 3, w: 280, h: 290, side: { x: 0.78, y: 0.62 }, up: { x: 0.4, y: 0.8 } },
];

/** 四串报错窗口，每串往右下一级一级地爬；有两串直接从电视上面爬过去 */
const TRAILS: { side: Spot; up: Spot; bar: string }[] = [
  { side: { x: 0.4, y: 0.03 }, up: { x: 0.02, y: 0.05 }, bar: '#ffc1d4' },
  { side: { x: 0.03, y: 0.18 }, up: { x: 0.3, y: 0.3 }, bar: '#cde6ff' },
  { side: { x: 0.6, y: 0.4 }, up: { x: 0.05, y: 0.55 }, bar: '#ffe3a3' },
  { side: { x: 0.18, y: 0.62 }, up: { x: 0.35, y: 0.62 }, bar: '#d2f6e4' },
];
const PER_TRAIL = 10;

let errorCursor = 0;
const nextError = () => {
  const index = errorCursor;
  errorCursor += 1;
  return { text: ERROR_LINES[index % ERROR_LINES.length], title: ERROR_TITLES[index % ERROR_TITLES.length] };
};

const TRAIL_WINDOWS: WindowDef[] = Array.from({ length: TRAILS.length * PER_TRAIL }, (_, index) => {
  const trail = index % TRAILS.length;
  const step = Math.floor(index / TRAILS.length);
  const { text, title } = nextError();
  return {
    id: `err${index}`,
    title,
    kind: 'error' as const,
    w: 236,
    h: 118,
    side: TRAILS[trail].side,
    up: TRAILS[trail].up,
    step,
    text,
    bar: TRAILS[trail].bar,
  };
});

/** 满屏乱飞的小弹窗：位置、大小随机，可以半截出界，也会压在电视上；种类按固定的顺序轮着来，内容一个不重 */
const BARS = ['#ffc1d4', '#cde6ff', '#ffe3a3', '#d2f6e4', '#e4dbff', '#ffd9c4'];
const SCATTER_KINDS: Kind[] = ['error', 'question', 'error', 'mini', 'error', 'question', 'mini', 'error'];
const SCATTER_COUNT = 22 + QUESTIONS.length + MINI.length - 3;
const random = seeded(20261110);
let questionCursor = 0;
let miniCursor = 0;
const SCATTER: WindowDef[] = Array.from({ length: SCATTER_COUNT }, (_, index) => {
  let kind = SCATTER_KINDS[index % SCATTER_KINDS.length];
  if (kind === 'question' && questionCursor >= QUESTIONS.length) kind = 'error';
  if (kind === 'mini' && miniCursor >= MINI.length) kind = 'error';
  const w = Math.round(kind === 'mini' ? 190 + random() * 70 : 210 + random() * 70);
  const spot = () => ({ x: -0.06 + random() * 0.98, y: -0.04 + random() * 0.94 });
  const base = { id: `sc${index}`, kind, w, h: kind === 'mini' ? 74 : 118, side: spot(), up: spot(), free: true, bar: BARS[Math.floor(random() * BARS.length)] };
  if (kind === 'question') {
    const text = QUESTIONS[questionCursor];
    questionCursor += 1;
    return { ...base, title: ['are_you_sure?', 'question.exe', 'help.txt', 'hmm.exe', 'ask.dll', 'maybe.sys', 'um.exe'][index % 7], text };
  }
  if (kind === 'mini') {
    const title = MINI[miniCursor];
    miniCursor += 1;
    return { ...base, title };
  }
  return { ...base, ...nextError() };
});

/** 后面的报错串和乱飞的小弹窗穿插着出来 */
function interleave(a: WindowDef[], b: WindowDef[]) {
  const out: WindowDef[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length) out.push(a[i++]);
    if (j < b.length) out.push(b[j++]);
    if (j < b.length && j % 3 === 0) out.push(b[j++]);
  }
  return out;
}

export const POPUPS: WindowDef[] = [...DESIGNED, ...interleave(TRAIL_WINDOWS, SCATTER)];
export const TOTAL_POPUPS = POPUPS.length;

/** closing = 点叉关掉（原地收成一条线）；retract = 往回滑收回去（飞回电视屏幕里） */
type Status = 'hidden' | 'open' | 'closing' | 'retract';
/** 往回滑一次最多几个窗口播收回动画；再多就直接消失，免得几十个一起闪成一团 */
const MAX_RETRACT = 8;

type Props = {
  layerRef: RefObject<HTMLDivElement | null>;
  /** 滚动决定现在应该开着几个 */
  count: number;
  /** 'side'：电视在左边；'up'：电视在上面 */
  layout: 'side' | 'up';
  crash: 'off' | 'soft' | 'hard';
  channel: number;
  power: boolean;
  jarCount: number;
  totalToys: number;
  reducedMotion: boolean;
  onTune: (index: number) => void;
  onDegauss: () => void;
  /** 有新弹窗冒出来了（电视跟着抖一下） */
  onPop: () => void;
  screenRect: () => DOMRect | null;
};

type BodyContext = Pick<Props, 'channel' | 'power' | 'jarCount' | 'totalToys' | 'onTune' | 'onDegauss'> & { close: () => void };

function Body({ def, ctx }: { def: WindowDef; ctx: BodyContext }) {
  switch (def.kind) {
    case 'log':
      return (
        <pre className="gw-log">
          {'> tv: signal unstable\n> dreams leaking: 4\n> glass: broken\n> everything is fine :)'}
          <i className="gw-caret" />
        </pre>
      );
    case 'channel': {
      const item = channels[def.channel ?? 0];
      const live = ctx.power && ctx.channel === def.channel;
      return (
        <div className="gw-channel">
          <div className="gw-thumb gw-pattern" data-channel={def.channel} aria-hidden="true">
            <span className="gw-ch">CH {item.number}</span>
            <span className="gw-osd-name">{item.osd}</span>
          </div>
          <h3>{item.title}</h3>
          <p>{item.desc}</p>
          <button type="button" className="gw-btn" data-live={live} aria-pressed={live} onClick={() => ctx.onTune(def.channel ?? 0)}>
            {live ? (
              <>
                <i className="gw-live-dot" aria-hidden="true" />
                On air
              </>
            ) : (
              <>
                <Radio size={15} strokeWidth={2.2} aria-hidden="true" />
                Tune in
              </>
            )}
          </button>
        </div>
      );
    }
    case 'noise':
      return (
        <div className="gw-noise" aria-label="No signal" role="img">
          <span>NO SIGNAL</span>
        </div>
      );
    case 'copying':
      return (
        <div className="gw-copying">
          <p>Copying dreams to your heart…</p>
          <div className="gw-bar-track" aria-hidden="true">
            <i />
          </div>
          <p className="gw-small">
            <span className="gw-pct" /> · about forever remaining
          </p>
        </div>
      );
    case 'waiting':
      return (
        <div className="gw-message">
          <Hourglass className="gw-icon" size={28} strokeWidth={2} aria-hidden="true" />
          <p>Treasure Box is not responding. She is counting her stickers again.</p>
          <div className="gw-actions">
            <button type="button" className="gw-btn gw-btn-soft" onClick={ctx.close}>
              Wait
            </button>
            <button type="button" className="gw-btn" onClick={ctx.close}>
              Wait
            </button>
          </div>
        </div>
      );
    case 'jar':
      return (
        <pre className="gw-log gw-light">
          {ctx.jarCount > 0
            ? `toys in the jar: ${ctx.jarCount}/${ctx.totalToys}\nthey are safe in here.`
            : 'the jar is empty.\nscroll back up and\ntoss one in?'}
        </pre>
      );
    case 'hex':
      return (
        <pre className="gw-log gw-hex" aria-label="A corrupted file full of hex">
          {'0000  42 54 4F 52 4E 00 FF 7A\n0008  '}
          <b>3C 33 3C 33</b>
          {' 00 00 1F\n0010  64 72 65 61 '}
          <b>?? ?? ??</b>
          {'\n0018  6D 73 00 00 00 FF FF 00\n0020  '}
          <b>DE AD BE EF</b>
          {' 2E 2E\n0028  73 6F 66 74 00 00 00 00'}
        </pre>
      );
    case 'question':
      return (
        <div className="gw-message">
          <CircleHelp className="gw-icon gw-ask" size={26} strokeWidth={2} aria-hidden="true" />
          <p>{def.text}</p>
          <div className="gw-actions">
            <button type="button" className="gw-btn gw-btn-small gw-btn-soft" onClick={ctx.close}>
              No
            </button>
            <button type="button" className="gw-btn gw-btn-small" onClick={ctx.close}>
              Yes
            </button>
          </div>
        </div>
      );
    case 'mini':
      return (
        <div className="gw-mini" aria-hidden="true">
          <div className="gw-bar-track">
            {/* 每个卡在不同的地方，永远到不了头 */}
            <i style={{ width: `${18 + ((def.w * 37) % 70)}%` }} />
          </div>
        </div>
      );
    case 'degauss':
      return (
        <div className="gw-message">
          <Magnet className="gw-icon" size={26} strokeWidth={2} aria-hidden="true" />
          <p>Wobbly colours? Give the TV a little shake.</p>
          <div className="gw-actions">
            <button type="button" className="gw-btn" onClick={ctx.onDegauss}>
              Degauss
            </button>
          </div>
        </div>
      );
    case 'error':
    default:
      return (
        <div className="gw-message">
          {def.text?.startsWith('Signal') ? (
            <CircleAlert className="gw-icon gw-warn" size={26} strokeWidth={2} aria-hidden="true" />
          ) : (
            <CircleX className="gw-icon gw-err" size={26} strokeWidth={2} aria-hidden="true" />
          )}
          <p>{def.text}</p>
          <div className="gw-actions">
            <button type="button" className="gw-btn gw-btn-small" onClick={ctx.close}>
              OK
            </button>
          </div>
        </div>
      );
  }
}

type WindowProps = {
  def: WindowDef;
  index: number;
  status: Status;
  layout: 'side' | 'up';
  ctx: BodyContext;
  onClose: (index: number) => void;
  onClosed: (index: number) => void;
  onRaise: (element: HTMLElement) => void;
};

const Popup = memo(function Popup({ def, index, status, layout, ctx, onClose, onClosed, onRaise }: WindowProps) {
  const ref = useRef<HTMLElement | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; ox: number; oy: number } | null>(null);
  const offset = useRef({ x: 0, y: 0 });
  const spot = layout === 'side' ? def.side : def.up;
  const step = def.step ?? 0;
  const close = () => onClose(index);

  // 关掉或者收回去以后再弹出来，回到原来的位置
  useEffect(() => {
    if (status === 'hidden') offset.current = { x: 0, y: 0 };
  }, [status]);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    const node = ref.current;
    if (!node) return;
    onRaise(node);
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, ox: offset.current.x, oy: offset.current.y };
    node.dataset.dragging = 'true';
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const current = drag.current;
    const node = ref.current;
    if (!current || !node || current.id !== event.pointerId) return;
    offset.current = { x: current.ox + event.clientX - current.x, y: current.oy + event.clientY - current.y };
    node.style.translate = `${offset.current.x}px ${offset.current.y}px`;
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag.current || drag.current.id !== event.pointerId) return;
    drag.current = null;
    if (ref.current) ref.current.dataset.dragging = 'false';
  };

  if (status === 'hidden') return null;
  const titleId = `gw-title-${def.id}`;
  return (
    <section
      ref={ref}
      className="gw"
      data-kind={def.kind}
      data-state={status}
      data-free={def.free ? 'true' : undefined}
      aria-labelledby={titleId}
      style={
        {
          '--x': spot.x,
          '--y': spot.y,
          '--dx': `${step * 18}px`,
          '--dy': `${step * 15}px`,
          '--w0': `${def.w}px`,
          '--h': `${def.h}px`,
          '--bar': def.bar,
          zIndex: 10 + index,
        } as CSSProperties
      }
      onPointerDownCapture={() => ref.current && onRaise(ref.current)}
    >
      <div
        className="gw-frame"
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget && (status === 'closing' || status === 'retract')) onClosed(index);
        }}
      >
        <header
          className="gw-titlebar"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="gw-title" id={titleId}>
            {def.title}
          </span>
          <button type="button" className="gw-close" aria-label={`Close ${def.title}`} onClick={close}>
            <X size={14} strokeWidth={2.6} aria-hidden="true" />
          </button>
        </header>
        <div className="gw-body">
          <Body def={def} ctx={{ ...ctx, close }} />
        </div>
      </div>
    </section>
  );
});

export const GlitchWindows = memo(function GlitchWindows({
  layerRef,
  count,
  layout,
  crash,
  channel,
  power,
  jarCount,
  totalToys,
  reducedMotion,
  onTune,
  onDegauss,
  onPop,
  screenRect,
}: Props) {
  const [statuses, setStatuses] = useState<Status[]>(() => POPUPS.map(() => 'hidden'));
  const userClosed = useRef(new Set<number>());
  const previous = useRef<Status[]>(statuses);
  const topZ = useRef(10 + TOTAL_POPUPS);
  const onPopRef = useRef(onPop);
  onPopRef.current = onPop;

  // 滚动决定开几个：没被手动关掉的就开着；滚回去了就收起来，手动关过的也一并忘掉
  useEffect(() => {
    POPUPS.forEach((_, index) => {
      if (index >= count) userClosed.current.delete(index);
    });
    setStatuses((current) => {
      let changed = false;
      let animated = 0;
      const next = [...current];
      // 从最新的往回数：越晚弹出来的越先收回去
      for (let index = current.length - 1; index >= 0; index -= 1) {
        const status = current[index];
        const want = index < count && !userClosed.current.has(index);
        if (want && status !== 'open') {
          changed = true;
          next[index] = 'open';
        } else if (!want && status === 'open') {
          changed = true;
          next[index] = animated < MAX_RETRACT ? 'retract' : 'hidden';
          animated += 1;
        }
      }
      return changed ? next : current;
    });
  }, [count]);

  // 刚弹出来的窗口：算好从电视屏幕中心飞过来的距离（画出来之前写进 CSS 变量）
  useLayoutEffect(() => {
    const layer = layerRef.current;
    const from = screenRect();
    const popped = statuses.filter((status, index) => status === 'open' && previous.current[index] !== 'open').length;
    if (layer && from && popped > 0) {
      const cx = from.left + from.width / 2;
      const cy = from.top + from.height / 2;
      layer.querySelectorAll<HTMLElement>('.gw[data-state="open"]:not([data-flown])').forEach((node) => {
        const rect = node.getBoundingClientRect();
        node.style.setProperty('--fx', `${(cx - (rect.left + rect.width / 2)).toFixed(0)}px`);
        node.style.setProperty('--fy', `${(cy - (rect.top + rect.height / 2)).toFixed(0)}px`);
        node.dataset.flown = 'true';
      });
    }
    if (popped > 0) onPopRef.current();
    previous.current = statuses;
  }, [layerRef, screenRect, statuses]);

  // 平时也会时不时有一个窗口抽一下
  useEffect(() => {
    if (reducedMotion) return;
    const timer = window.setInterval(() => {
      const layer = layerRef.current;
      if (!layer) return;
      const open = layer.querySelectorAll<HTMLElement>('.gw[data-state="open"]');
      if (open.length === 0) return;
      const node = open[Math.floor(Math.random() * open.length)];
      node.dataset.twitch = 'true';
      window.setTimeout(() => {
        node.dataset.twitch = 'false';
      }, 300);
    }, 1700);
    return () => window.clearInterval(timer);
  }, [layerRef, reducedMotion]);

  const onClose = useRef((index: number) => {
    userClosed.current.add(index);
    setStatuses((current) => current.map((status, i) => (i === index && status === 'open' ? 'closing' : status)));
  }).current;
  const onClosed = useRef((index: number) => {
    setStatuses((current) =>
      current.map((status, i) => (i === index && (status === 'closing' || status === 'retract') ? 'hidden' : status)),
    );
  }).current;
  const onRaise = useRef((element: HTMLElement) => {
    topZ.current += 1;
    element.style.zIndex = String(topZ.current);
  }).current;

  // 父组件每秒都会因为电视的时间码重渲染一次：内容没变的话，几十个弹窗都别跟着重渲染
  const ctx = useMemo(
    () => ({ channel, power, jarCount, totalToys, onTune, onDegauss, close: () => undefined }),
    [channel, jarCount, onDegauss, onTune, power, totalToys],
  );

  return (
    <div className="gl-layer gl-layer-popups" ref={layerRef} data-crash={crash} data-motion={reducedMotion ? 'reduced' : 'full'}>
      {POPUPS.map((def, index) => (
        <Popup
          key={def.id}
          def={def}
          index={index}
          status={statuses[index]}
          layout={layout}
          ctx={ctx}
          onClose={onClose}
          onClosed={onClosed}
          onRaise={onRaise}
        />
      ))}
    </div>
  );
});
