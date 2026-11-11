import './ascii-end.css';
import { memo, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { monoAdvance, pad, wrap } from './ascii';
import { AsciiPortrait } from './AsciiPortrait';
import { tagline } from './content';
import { LOGO_LINES, LOGO_TONES } from './logo';
import { scrollToTop } from './smoothScroll';
import type { Portrait } from './portrait';

/**
 * 重启以后的页脚：整块都是 ASCII。左边是一幅彩色字符画（离线转好、烘焙成文字，不加载图片），
 * 右边是字符画 Logo 和一个 ASCII 边框的小窗口，里面的「Heal it」是真按钮。
 */

const FONT = '"VT323", ui-monospace, monospace';
const LOGO_COLS = LOGO_LINES[0].length;

/** 把一行字按 tones 切成几段：粉色的 O 和其余的 */
function logoSegments(text: string, tones: string) {
  const parts: { text: string; pink: boolean }[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const pink = tones[i] === 'o';
    const last = parts[parts.length - 1];
    if (last && last.pink === pink) last.text += text[i];
    else parts.push({ text: text[i], pink });
  }
  return parts;
}
const LOGO = LOGO_LINES.map((text, index) => logoSegments(text, LOGO_TONES[index]));

type Layout = { logoSize: number; boxCols: number };

/** 底边上两个「-」各包一层，CSS 让它们一前一后掉下去，原地留个空 */
function looseBorder(border: string) {
  const first = Math.floor(border.length * 0.58);
  const second = first + 3;
  return (
    <>
      {border.slice(0, first)}
      <span className="ga-loose">{border[first]}</span>
      {border.slice(first + 1, second)}
      <span className="ga-loose" style={{ '--d': '0.9s' } as CSSProperties}>
        {border[second]}
      </span>
      {border.slice(second + 1)}
    </>
  );
}

/** loose：边框底边松掉两个字（掉下去），暗示页面还没完 */
type Props = { reducedMotion: boolean; loose?: boolean };

// 页面每秒都会因为电视的时间码重渲染一次：页脚的属性没变就别跟着重新对比那一大块字
export const AsciiEnd = memo(function AsciiEnd({ reducedMotion, loose = false }: Props) {
  const footerRef = useRef<HTMLElement | null>(null);
  const sideRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [portrait, setPortrait] = useState<Portrait | null>(null);
  // 页脚露出来一大半以后，Logo、标语、边框一行一行打出来
  const [shown, setShown] = useState(reducedMotion);

  // 量字宽、看右栏多宽，决定 Logo 的字号和边框的列数
  useEffect(() => {
    const side = sideRef.current;
    if (!side) return;
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    document.fonts
      .load(`20px ${FONT}`)
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return;
        const advance = monoAdvance(FONT);
        const update = () => {
          const width = side.clientWidth;
          const next = {
            // 留 4% 的余量，别顶着栏的右边
            logoSize: Math.min(16, Math.max(4, (width * 0.96) / (LOGO_COLS * advance))),
            boxCols: Math.min(48, Math.max(24, Math.floor(width / (20 * advance)))),
          };
          setLayout((current) =>
            current && Math.abs(current.logoSize - next.logoSize) < 0.05 && current.boxCols === next.boxCols ? current : next,
          );
        };
        update();
        observer = new ResizeObserver(update);
        observer.observe(side);
      });
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, []);

  // 字符画的数据有几十 KB：页脚快露出来了再去拿
  useEffect(() => {
    const footer = footerRef.current;
    if (!footer) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        import('./portrait').then(({ PORTRAIT }) => setPortrait(PORTRAIT));
      },
      { rootMargin: '150% 0px' },
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const footer = footerRef.current;
    if (!footer || shown) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        setShown(true);
      },
      { threshold: 0.35 },
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, [shown]);

  const cols = layout?.boxCols ?? 40;
  const inner = cols - 4;
  const border = `+${'-'.repeat(cols - 2)}+`;
  const blank = `| ${pad('', inner)} |`;
  const row = (text: string) => `| ${pad(text, inner)} |`;
  const body = wrap("It's okay. Scroll back up and it heals itself, crack by crack. The toys stay in the jar.", inner);
  const heal = '[ Heal it ]';

  // 每一行带一个序号，CSS 按序号错开一点点时间亮起来（一行 40ms，整块不到一秒）
  let line = 0;
  const ln = (content: ReactNode, key: string) => (
    <span key={key} className="ga-ln" style={{ '--i': line++ } as CSSProperties}>
      {content}
      {'\n'}
    </span>
  );

  const logoLines = LOGO.map((parts, index) =>
    ln(
      parts.map((part, i) => (
        <span key={i} data-tone={part.pink ? 'pink' : undefined}>
          {part.text}
        </span>
      )),
      `logo${index}`,
    ),
  );
  const tagIndex = line++;
  const boxLines = [
    ln(<span aria-hidden="true">{border}</span>, 'top'),
    ln(<span aria-hidden="true">{blank}</span>, 'b1'),
    ln(
      <>
        <span aria-hidden="true">{'| '}</span>
        <span className="ga-title">
          <span className="sr-only">You broke the glass.</span>
          <span aria-hidden="true">{pad('You broke the glass.', inner)}</span>
        </span>
        <span aria-hidden="true">{' |'}</span>
      </>,
      'title',
    ),
    ln(<span aria-hidden="true">{blank}</span>, 'b2'),
    ...body.map((text, index) =>
      ln(
        <>
          {index === 0 && <span className="sr-only">{body.join(' ')}</span>}
          <span aria-hidden="true">{row(text)}</span>
        </>,
        `body${index}`,
      ),
    ),
    ln(<span aria-hidden="true">{blank}</span>, 'b3'),
    ln(
      <>
        <span aria-hidden="true">{'| '}</span>
        <button
          type="button"
          className="ga-heal"
          onClick={() => scrollToTop(reducedMotion)}
        >
          {heal}
        </button>
        <span aria-hidden="true">{`${' '.repeat(Math.max(0, inner - heal.length))} |`}</span>
      </>,
      'heal',
    ),
    ln(<span aria-hidden="true">{blank}</span>, 'b4'),
    ln(<span aria-hidden="true">{loose ? looseBorder(border) : border}</span>, 'bottom'),
  ];
  const fineIndex = line++;

  return (
    <footer className="ga-end" id="hi" ref={footerRef} data-shown={shown}>
      <div className="ga-inner" data-portrait={portrait ? 'yes' : 'no'}>
        {portrait && (
          <div className="ga-portrait">
            <AsciiPortrait
              portrait={portrait}
              reducedMotion={reducedMotion}
              label="An ASCII drawing of a grumpy little girl with grey-green hair and hair clips."
            />
          </div>
        )}

        <div className="ga-side" ref={sideRef}>
          <pre className="ga-logo" role="img" aria-label="BTORN" style={layout ? { fontSize: `${layout.logoSize}px` } : undefined}>
            {logoLines}
          </pre>
          <p className="ga-tag ga-ln" style={{ '--i': tagIndex } as CSSProperties}>
            {tagline}
            <i className="ga-cursor" aria-hidden="true" />
          </p>

          <div className="ga-box">
            <pre>{boxLines}</pre>
          </div>

          <p className="ga-fine ga-ln" style={{ '--i': fineIndex } as CSSProperties}>
            Illustrations are a mix of original and collected works. All rights belong to their artists.
          </p>
        </div>
      </div>
    </footer>
  );
});
