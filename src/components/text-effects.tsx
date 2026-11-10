// 从旧版 react-bits/index.tsx 原样抽出的文字动效，只保留「梦境分类」区块用到的 5 个。
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ElementType, type HTMLAttributes } from 'react';

type ShinyTextProps = HTMLAttributes<HTMLSpanElement> & {
  text: string;
  disabled?: boolean;
  speed?: number;
  color?: string;
  shineColor?: string;
};

export function ShinyText({
  text,
  className = '',
  disabled = false,
  speed = 3,
  color = 'rgba(248, 245, 247, 0.62)',
  shineColor = 'rgba(255, 255, 255, 0.96)',
  style,
  ...props
}: ShinyTextProps) {
  return (
    <span
      className={`react-bits-shiny-text ${disabled ? 'is-disabled' : ''} ${className}`}
      style={
        {
          '--shine-speed': `${speed}s`,
          '--shine-color': shineColor,
          color,
          ...style,
        } as CSSProperties
      }
      {...props}
    >
      {text}
    </span>
  );
}

type TextAnimationProps = HTMLAttributes<HTMLElement> & {
  text: string;
  as?: ElementType;
  by?: 'word' | 'char';
  delay?: number;
};

export function BlurText({ text, as, by = 'word', delay = 60, className = '', ...props }: TextAnimationProps) {
  const Component = (as || 'p') as any;
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement | null>(null);
  const parts = useMemo(() => (by === 'word' ? text.split(/(\s+)/) : Array.from(text)), [by, text]);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.22 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Component ref={ref} className={`react-bits-blur-text ${visible ? 'is-visible' : ''} ${className}`} {...props}>
      {parts.map((part, index) => (
        <span
          className={part.trim() ? 'react-bits-blur-part' : 'react-bits-space-part'}
          style={{ '--part-delay': `${index * delay}ms` } as CSSProperties}
          key={`${part}-${index}`}
        >
          {part}
        </span>
      ))}
    </Component>
  );
}

export function SplitText({ text, as, delay = 34, className = '', ...props }: Omit<TextAnimationProps, 'by'>) {
  const Component = (as || 'span') as any;
  const characters = useMemo(() => Array.from(text), [text]);

  return (
    <Component className={`react-bits-split-text ${className}`} {...props}>
      {characters.map((char, index) => (
        <span
          className={char.trim() ? 'react-bits-split-char' : 'react-bits-split-space'}
          style={{ '--char-delay': `${index * delay}ms` } as CSSProperties}
          key={`${char}-${index}`}
        >
          {char}
        </span>
      ))}
    </Component>
  );
}


type ScrollRevealProps = TextAnimationProps & {
  direction?: 'up' | 'down' | 'left' | 'right';
  threshold?: number;
};

export function ScrollReveal({
  text,
  as,
  by = 'word',
  delay = 46,
  direction = 'up',
  threshold = 0.2,
  className = '',
  ...props
}: ScrollRevealProps) {
  const Component = (as || 'p') as any;
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement | null>(null);
  const parts = useMemo(() => (by === 'word' ? text.split(/(\s+)/) : Array.from(text)), [by, text]);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <Component ref={ref} className={`react-bits-scroll-reveal ${visible ? 'is-visible' : ''} from-${direction} ${className}`} {...props}>
      {parts.map((part, index) => (
        <span
          className={part.trim() ? 'react-bits-scroll-reveal-part' : 'react-bits-space-part'}
          style={{ '--reveal-delay': `${index * delay}ms` } as CSSProperties}
          key={`${part}-${index}`}
        >
          {part}
        </span>
      ))}
    </Component>
  );
}

type ScrambledTextProps = TextAnimationProps & {
  speed?: number;
  intensity?: number;
  characters?: string;
};

export function ScrambledText({
  text,
  as,
  speed = 58,
  intensity = 0.32,
  characters = 'アイウエオカキクケコサシスセソ0123456789',
  className = '',
  ...props
}: ScrambledTextProps) {
  const Component = (as || 'span') as any;
  const [active, setActive] = useState(false);
  const [displayText, setDisplayText] = useState(text);
  const chars = useMemo(() => Array.from(characters), [characters]);

  useEffect(() => {
    if (!active) {
      setDisplayText(text);
      return undefined;
    }

    const timer = window.setInterval(() => {
      setDisplayText(
        Array.from(text)
          .map((char) => {
            if (!char.trim() || Math.random() > intensity) {
              return char;
            }
            return chars[Math.floor(Math.random() * chars.length)] ?? char;
          })
          .join(''),
      );
    }, speed);

    return () => window.clearInterval(timer);
  }, [active, chars, intensity, speed, text]);

  return (
    <Component
      className={`react-bits-scrambled-text ${active ? 'is-active' : ''} ${className}`}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => setActive(false)}
      {...props}
    >
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{displayText}</span>
    </Component>
  );
}


type MotionTokenProps = {
  text: string;
  variant?: number;
  className?: string;
};

/** 按 variant 轮换文字动效：0 乱码闪烁 / 1 流光 / 2 逐字升起 / 3 模糊浮现 */
export function MotionToken({ text, variant = 0, className = '' }: MotionTokenProps) {
  const motionClassName = `inline-motion ${className}`.trim();

  switch (variant % 4) {
    case 0:
      return <ScrambledText text={text} className={motionClassName} speed={46} intensity={0.22} />;
    case 1:
      return <ShinyText text={text} className={motionClassName} speed={2.4} />;
    case 2:
      return <SplitText text={text} className={motionClassName} delay={9} />;
    default:
      return <BlurText text={text} as="span" by="char" delay={8} className={motionClassName} />;
  }
}
