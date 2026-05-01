import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
  type MouseEventHandler,
  type PointerEventHandler,
  type PropsWithChildren,
  type ReactNode,
} from 'react';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

type ClickSparkProps = {
  sparkColor?: string;
  sparkSize?: number;
  sparkRadius?: number;
  sparkCount?: number;
  duration?: number;
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  extraScale?: number;
  fixed?: boolean;
  className?: string;
  children?: ReactNode;
};

type Spark = {
  x: number;
  y: number;
  angle: number;
  startTime: number;
};

export function ClickSpark({
  sparkColor = '#f8f5f7',
  sparkSize = 10,
  sparkRadius = 15,
  sparkCount = 8,
  duration = 400,
  easing = 'ease-out',
  extraScale = 1,
  fixed = false,
  className = '',
  children,
}: ClickSparkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparksRef = useRef<Spark[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const parent = canvas.parentElement;
    if (!parent) {
      return;
    }

    let resizeTimeout = 0;
    const resizeCanvas = () => {
      const rect = parent.getBoundingClientRect();
      const width = fixed ? window.innerWidth : rect.width;
      const height = fixed ? window.innerHeight : rect.height;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const nextWidth = Math.max(1, Math.round(width * pixelRatio));
      const nextHeight = Math.max(1, Math.round(height * pixelRatio));

      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
    };

    const handleResize = () => {
      window.clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(resizeCanvas, 100);
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(parent);
    window.addEventListener('resize', handleResize);
    resizeCanvas();

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      window.clearTimeout(resizeTimeout);
    };
  }, [fixed]);

  const easeFunc = useCallback(
    (t: number) => {
      switch (easing) {
        case 'linear':
          return t;
        case 'ease-in':
          return t * t;
        case 'ease-in-out':
          return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        default:
          return t * (2 - t);
      }
    },
    [easing],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return undefined;
    }

    let animationId = 0;
    const draw = (timestamp: number) => {
      const pixelRatio = canvas.width / Math.max(canvas.getBoundingClientRect().width, 1);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, canvas.width / pixelRatio, canvas.height / pixelRatio);

      sparksRef.current = sparksRef.current.filter((spark) => {
        const elapsed = timestamp - spark.startTime;
        if (elapsed >= duration) {
          return false;
        }

        const progress = elapsed / duration;
        const eased = easeFunc(progress);
        const distance = eased * sparkRadius * extraScale;
        const lineLength = sparkSize * (1 - eased);
        const x1 = spark.x + distance * Math.cos(spark.angle);
        const y1 = spark.y + distance * Math.sin(spark.angle);
        const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle);
        const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle);

        context.strokeStyle = sparkColor;
        context.lineWidth = 2;
        context.lineCap = 'round';
        context.beginPath();
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
        context.stroke();
        return true;
      });

      animationId = requestAnimationFrame(draw);
    };

    animationId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationId);
  }, [duration, easeFunc, extraScale, sparkColor, sparkRadius, sparkSize]);

  const handleClick: MouseEventHandler<HTMLDivElement> = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = fixed ? event.clientX : event.clientX - rect.left;
    const y = fixed ? event.clientY : event.clientY - rect.top;
    const now = performance.now();
    const newSparks = Array.from({ length: sparkCount }, (_, index) => ({
      x,
      y,
      angle: (Math.PI * 2 * index) / sparkCount,
      startTime: now,
    }));

    sparksRef.current.push(...newSparks);
  };

  return (
    <div className={`react-bits-click-spark ${fixed ? 'is-fixed' : ''} ${className}`} onClick={handleClick}>
      <canvas ref={canvasRef} className="react-bits-click-canvas" aria-hidden="true" />
      {children}
    </div>
  );
}

type MagnetProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  padding?: number;
  disabled?: boolean;
  magnetStrength?: number;
  activeTransition?: string;
  inactiveTransition?: string;
  wrapperClassName?: string;
  innerClassName?: string;
};

export function Magnet({
  children,
  padding = 100,
  disabled = false,
  magnetStrength = 2,
  activeTransition = 'transform 0.3s ease-out',
  inactiveTransition = 'transform 0.5s ease-in-out',
  wrapperClassName = '',
  innerClassName = '',
  style,
  ...props
}: MagnetProps) {
  const [isActive, setIsActive] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const magnetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disabled) {
      setPosition({ x: 0, y: 0 });
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!magnetRef.current) {
        return;
      }

      const { left, top, width, height } = magnetRef.current.getBoundingClientRect();
      const centerX = left + width / 2;
      const centerY = top + height / 2;
      const distX = Math.abs(centerX - event.clientX);
      const distY = Math.abs(centerY - event.clientY);

      if (distX < width / 2 + padding && distY < height / 2 + padding) {
        setIsActive(true);
        setPosition({
          x: (event.clientX - centerX) / magnetStrength,
          y: (event.clientY - centerY) / magnetStrength,
        });
      } else {
        setIsActive(false);
        setPosition({ x: 0, y: 0 });
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [disabled, magnetStrength, padding]);

  const transition = isActive ? activeTransition : inactiveTransition;

  return (
    <div ref={magnetRef} className={wrapperClassName} style={{ position: 'relative', display: 'inline-block', ...style }} {...props}>
      <div
        className={innerClassName}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          transition,
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  );
}

type SpotlightCardProps = PropsWithChildren<
  HTMLAttributes<HTMLDivElement> & {
    spotlightColor?: string;
  }
>;

export function SpotlightCard({ children, className = '', spotlightColor = 'rgba(248, 245, 247, 0.24)', ...props }: SpotlightCardProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove: React.MouseEventHandler<HTMLDivElement> = (event) => {
    if (!divRef.current || isFocused) {
      return;
    }

    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  };

  const handleFocus = () => {
    setIsFocused(true);
    setOpacity(0.62);
  };

  const handleBlur = () => {
    setIsFocused(false);
    setOpacity(0);
  };

  return (
    <div
      ref={divRef}
      tabIndex={0}
      className={`react-bits-spotlight-card ${className}`}
      onMouseMove={handleMouseMove}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseEnter={() => setOpacity(0.62)}
      onMouseLeave={() => setOpacity(0)}
      {...props}
    >
      <span
        className="react-bits-spotlight"
        style={{
          opacity,
          background: `radial-gradient(circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 72%)`,
        }}
        aria-hidden="true"
      />
      {children}
    </div>
  );
}

type StarBorderProps<T extends ElementType> = ComponentPropsWithoutRef<T> & {
  as?: T;
  color?: string;
  speed?: string;
  thickness?: number;
  children?: ReactNode;
};

export function StarBorder<T extends ElementType = 'div'>({
  as,
  className = '',
  color = 'rgba(248, 245, 247, 0.94)',
  speed = '6s',
  thickness = 1,
  children,
  style,
  ...rest
}: StarBorderProps<T>) {
  const Component = (as || 'div') as any;
  const sharedGradient = `radial-gradient(circle, ${color}, transparent 10%)`;

  return (
    <Component
      className={`react-bits-star-border ${className}`}
      style={{ padding: `${thickness}px`, ...(style as CSSProperties) }}
      {...(rest as Record<string, unknown>)}
    >
      <span
        className="react-bits-star-gradient react-bits-star-gradient-bottom"
        style={{ background: sharedGradient, animationDuration: speed }}
        aria-hidden="true"
      />
      <span
        className="react-bits-star-gradient react-bits-star-gradient-top"
        style={{ background: sharedGradient, animationDuration: speed }}
        aria-hidden="true"
      />
      <span className="react-bits-star-inner">{children}</span>
    </Component>
  );
}

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

type ScrollFloatProps = HTMLAttributes<HTMLDivElement> & {
  text: string;
  repeat?: number;
  speed?: number;
  reverse?: boolean;
};

export function ScrollFloat({ text, repeat = 4, speed = 18, reverse = false, className = '', ...props }: ScrollFloatProps) {
  const items = useMemo(() => Array.from({ length: repeat }, (_, index) => index), [repeat]);

  return (
    <div
      className={`react-bits-scroll-float ${reverse ? 'is-reverse' : ''} ${className}`}
      style={{ '--float-speed': `${speed}s` } as CSSProperties}
      {...props}
    >
      <div className="react-bits-scroll-float-track">
        {items.map((index) => (
          <span key={index}>{text}</span>
        ))}
      </div>
    </div>
  );
}

type CountUpProps = HTMLAttributes<HTMLSpanElement> & {
  from?: number;
  to: number;
  duration?: number;
  delay?: number;
  decimals?: number;
  separator?: string;
  prefix?: string;
  suffix?: string;
};

export function CountUp({
  from = 0,
  to,
  duration = 1800,
  delay = 0,
  decimals = 0,
  separator = '',
  prefix = '',
  suffix = '',
  className = '',
  ...props
}: CountUpProps) {
  const [value, setValue] = useState(from);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return undefined;
    }

    let frame = 0;
    let timeout = 0;
    const startCounter = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const progress = clamp((now - start) / duration, 0, 1);
        const eased = 1 - Math.pow(1 - progress, 4);
        setValue(from + (to - from) * eased);
        if (progress < 1) {
          frame = requestAnimationFrame(tick);
        }
      };
      frame = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          return;
        }
        timeout = window.setTimeout(startCounter, delay);
        observer.disconnect();
      },
      { threshold: 0.32 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      window.clearTimeout(timeout);
      cancelAnimationFrame(frame);
    };
  }, [delay, duration, from, to]);

  const formatted = useMemo(() => {
    const fixed = value.toFixed(decimals);
    const [integer, fraction] = fixed.split('.');
    const withSeparator = separator ? integer.replace(/\B(?=(\d{3})+(?!\d))/g, separator) : integer;
    return `${prefix}${fraction ? `${withSeparator}.${fraction}` : withSeparator}${suffix}`;
  }, [decimals, prefix, separator, suffix, value]);

  return (
    <span ref={ref} className={`react-bits-count-up ${className}`} {...props}>
      {formatted}
    </span>
  );
}

type PixelTransitionProps = PropsWithChildren<
  HTMLAttributes<HTMLDivElement> & {
    firstContent: ReactNode;
    secondContent: ReactNode;
    gridSize?: number;
  }
>;

export function PixelTransition({ firstContent, secondContent, gridSize = 7, className = '', children, style, ...props }: PixelTransitionProps) {
  const cells = useMemo(() => Array.from({ length: gridSize * gridSize }, (_, index) => index), [gridSize]);

  return (
    <div className={`react-bits-pixel-transition ${className}`} style={{ '--pixel-grid': gridSize, ...style } as CSSProperties} {...props}>
      <div className="react-bits-pixel-layer react-bits-pixel-front">{firstContent}</div>
      <div className="react-bits-pixel-layer react-bits-pixel-back">{secondContent}</div>
      <div className="react-bits-pixel-grid" aria-hidden="true">
        {cells.map((index) => (
          <span style={{ '--pixel-index': index } as CSSProperties} key={index} />
        ))}
      </div>
      {children}
    </div>
  );
}

type TiltedCardProps = HTMLAttributes<HTMLDivElement> & {
  imageSrc: string;
  altText: string;
  captionText?: string;
  overlayContent?: ReactNode;
  rotateAmplitude?: number;
  scaleOnHover?: number;
};

export function TiltedCard({
  imageSrc,
  altText,
  captionText,
  overlayContent,
  rotateAmplitude = 12,
  scaleOnHover = 1.05,
  className = '',
  ...props
}: TiltedCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState('rotateX(0deg) rotateY(0deg) scale(1)');

  const handleMouseMove: MouseEventHandler<HTMLDivElement> = (event) => {
    const node = ref.current;
    if (!node) {
      return;
    }

    const rect = node.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    setTransform(`rotateX(${(-py * rotateAmplitude).toFixed(2)}deg) rotateY(${(px * rotateAmplitude).toFixed(2)}deg) scale(${scaleOnHover})`);
  };

  return (
    <div
      ref={ref}
      className={`react-bits-tilted-card ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setTransform('rotateX(0deg) rotateY(0deg) scale(1)')}
      {...props}
    >
      <div className="react-bits-tilted-card-inner" style={{ transform }}>
        <img src={imageSrc} alt={altText} />
        {(captionText || overlayContent) && (
          <div className="react-bits-tilted-card-overlay">
            {overlayContent}
            {captionText && <span>{captionText}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

type DockItem = {
  icon: ReactNode;
  label: string;
  href: string;
};

type DockProps = HTMLAttributes<HTMLElement> & {
  items: DockItem[];
};

export function Dock({ items, className = '', ...props }: DockProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <nav className={`react-bits-dock ${className}`} aria-label="React Bits quick navigation" {...props}>
      {items.map((item, index) => {
        const distance = activeIndex === null ? 4 : Math.abs(activeIndex - index);
        const scale = activeIndex === null ? 1 : Math.max(1, 1.72 - distance * 0.22);
        return (
          <a
            href={item.href}
            className="react-bits-dock-item"
            style={{ '--dock-scale': scale } as CSSProperties}
            onMouseEnter={() => setActiveIndex(index)}
            onFocus={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
            onBlur={() => setActiveIndex(null)}
            key={item.label}
          >
            {item.icon}
            <span>{item.label}</span>
          </a>
        );
      })}
    </nav>
  );
}

type InfiniteScrollProps = HTMLAttributes<HTMLDivElement> & {
  items: ReactNode[];
  speed?: number;
  reverse?: boolean;
};

export function InfiniteScroll({ items, speed = 22, reverse = false, className = '', ...props }: InfiniteScrollProps) {
  return (
    <div
      className={`react-bits-infinite-scroll ${reverse ? 'is-reverse' : ''} ${className}`}
      style={{ '--infinite-speed': `${speed}s` } as CSSProperties}
      {...props}
    >
      <div className="react-bits-infinite-track">
        {[...items, ...items].map((item, index) => (
          <div className="react-bits-infinite-item" key={index}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

type GlareHoverProps = PropsWithChildren<
  HTMLAttributes<HTMLDivElement> & {
    glareColor?: string;
    glareOpacity?: number;
  }
>;

export function GlareHover({
  children,
  className = '',
  glareColor = 'rgba(248, 245, 247, 0.42)',
  glareOpacity = 0.78,
  style,
  onPointerMove,
  onPointerLeave,
  ...props
}: GlareHoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 50 });

  const handlePointerMove: PointerEventHandler<HTMLDivElement> = (event) => {
    const node = ref.current;
    if (!node) {
      onPointerMove?.(event);
      return;
    }

    const rect = node.getBoundingClientRect();
    setActive(true);
    setPosition({
      x: ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 100,
      y: ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 100,
    });
    onPointerMove?.(event);
  };

  const handlePointerLeave: PointerEventHandler<HTMLDivElement> = (event) => {
    setActive(false);
    onPointerLeave?.(event);
  };

  return (
    <div
      ref={ref}
      className={`react-bits-glare-hover ${active ? 'is-active' : ''} ${className}`}
      style={
        {
          '--glare-x': `${position.x}%`,
          '--glare-y': `${position.y}%`,
          '--glare-color': glareColor,
          '--glare-opacity': glareOpacity,
          ...style,
        } as CSSProperties
      }
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      {...props}
    >
      {children}
    </div>
  );
}

type CircularTextProps = HTMLAttributes<HTMLDivElement> & {
  text: string;
  radius?: number;
  spinDuration?: number;
  reverse?: boolean;
};

export function CircularText({
  text,
  radius = 72,
  spinDuration = 18,
  reverse = false,
  className = '',
  style,
  ...props
}: CircularTextProps) {
  const characters = useMemo(() => Array.from(text), [text]);
  const step = 360 / Math.max(characters.length, 1);

  return (
    <div
      className={`react-bits-circular-text ${reverse ? 'is-reverse' : ''} ${className}`}
      style={{ '--circle-radius': `${radius}px`, '--circle-spin': `${spinDuration}s`, ...style } as CSSProperties}
      aria-label={text}
      {...props}
    >
      {characters.map((char, index) => (
        <span
          aria-hidden="true"
          style={{ '--char-angle': `${index * step}deg` } as CSSProperties}
          key={`${char}-${index}`}
        >
          {char}
        </span>
      ))}
    </div>
  );
}

type TextPressureProps = HTMLAttributes<HTMLElement> & {
  text: string;
  as?: ElementType;
};

export function TextPressure({ text, as, className = '', ...props }: TextPressureProps) {
  const Component = (as || 'span') as any;
  const characters = useMemo(() => Array.from(text), [text]);
  const [pointer, setPointer] = useState({ x: 0.5, active: false });

  const handlePointerMove: PointerEventHandler<HTMLElement> = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPointer({
      x: clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1),
      active: true,
    });
  };

  return (
    <Component
      className={`react-bits-text-pressure ${className}`}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setPointer((value) => ({ ...value, active: false }))}
      {...props}
    >
      {characters.map((char, index) => {
        const denominator = Math.max(characters.length - 1, 1);
        const center = index / denominator;
        const pressure = pointer.active ? Math.max(0, 1 - Math.abs(center - pointer.x) * 4.4) : 0;
        return (
          <span
            style={
              {
                '--pressure': pressure.toFixed(3),
                '--char-delay': `${index * 18}ms`,
              } as CSSProperties
            }
            key={`${char}-${index}`}
          >
            {char.trim() ? char : '\u00a0'}
          </span>
        );
      })}
    </Component>
  );
}

type TextTypeProps = HTMLAttributes<HTMLElement> & {
  text: string | string[];
  as?: ElementType;
  typingSpeed?: number;
  initialDelay?: number;
  pauseDuration?: number;
  deletingSpeed?: number;
  loop?: boolean;
  showCursor?: boolean;
  hideCursorWhileTyping?: boolean;
  cursorCharacter?: ReactNode;
  cursorClassName?: string;
  textColors?: string[];
  variableSpeed?: { min: number; max: number };
  startOnVisible?: boolean;
  reverseMode?: boolean;
};

export function TextType({
  text,
  as,
  typingSpeed = 48,
  initialDelay = 0,
  pauseDuration = 1800,
  deletingSpeed = 26,
  loop = true,
  showCursor = true,
  hideCursorWhileTyping = false,
  cursorCharacter = '|',
  cursorClassName = '',
  textColors = [],
  variableSpeed,
  startOnVisible = false,
  reverseMode = false,
  className = '',
  style,
  ...props
}: TextTypeProps) {
  const Component = (as || 'span') as any;
  const textArray = useMemo(() => (Array.isArray(text) ? text : [text]), [text]);
  const [displayedText, setDisplayedText] = useState('');
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isVisible, setIsVisible] = useState(!startOnVisible);
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!startOnVisible || !containerRef.current) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.16 },
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [startOnVisible]);

  useEffect(() => {
    if (!isVisible || textArray.length === 0) {
      return undefined;
    }

    let timeout = 0;
    const sourceText = textArray[currentTextIndex] ?? '';
    const processedText = reverseMode ? Array.from(sourceText).reverse().join('') : sourceText;
    const randomSpeed = () => {
      if (!variableSpeed) {
        return typingSpeed;
      }
      return variableSpeed.min + Math.random() * (variableSpeed.max - variableSpeed.min);
    };

    if (currentCharIndex === 0 && !isDeleting && displayedText === '') {
      timeout = window.setTimeout(() => setCurrentCharIndex(1), initialDelay);
      return () => window.clearTimeout(timeout);
    }

    if (isDeleting) {
      if (displayedText.length === 0) {
        setIsDeleting(false);
        setCurrentCharIndex(0);
        setCurrentTextIndex((index) => (index + 1 >= textArray.length ? 0 : index + 1));
        return undefined;
      }

      timeout = window.setTimeout(() => {
        setDisplayedText((value) => value.slice(0, -1));
      }, deletingSpeed);
      return () => window.clearTimeout(timeout);
    }

    if (currentCharIndex <= processedText.length) {
      timeout = window.setTimeout(() => {
        setDisplayedText(processedText.slice(0, currentCharIndex));
        setCurrentCharIndex((index) => index + 1);
      }, randomSpeed());
      return () => window.clearTimeout(timeout);
    }

    if (!loop && currentTextIndex === textArray.length - 1) {
      return undefined;
    }

    timeout = window.setTimeout(() => {
      setIsDeleting(true);
    }, pauseDuration);
    return () => window.clearTimeout(timeout);
  }, [
    currentCharIndex,
    currentTextIndex,
    deletingSpeed,
    displayedText,
    initialDelay,
    isDeleting,
    isVisible,
    loop,
    pauseDuration,
    reverseMode,
    textArray,
    typingSpeed,
    variableSpeed,
  ]);

  const currentColor = textColors.length ? textColors[currentTextIndex % textColors.length] : undefined;
  const cursorHidden = hideCursorWhileTyping && (isDeleting || currentCharIndex <= (textArray[currentTextIndex] ?? '').length);

  return (
    <Component
      ref={containerRef}
      className={`react-bits-text-type ${className}`}
      style={{ color: currentColor, ...style }}
      {...props}
    >
      <span>{displayedText}</span>
      {showCursor && (
        <span className={`react-bits-text-type-cursor ${cursorHidden ? 'is-hidden' : ''} ${cursorClassName}`} aria-hidden="true">
          {cursorCharacter}
        </span>
      )}
    </Component>
  );
}

type DecryptedTextProps = HTMLAttributes<HTMLSpanElement> & {
  text: string;
  speed?: number;
  maxIterations?: number;
  sequential?: boolean;
  revealDirection?: 'start' | 'end' | 'center';
  useOriginalCharsOnly?: boolean;
  characters?: string;
  encryptedClassName?: string;
  animateOn?: 'view' | 'hover' | 'click';
  clickMode?: 'once' | 'toggle';
};

export function DecryptedText({
  text,
  speed = 42,
  maxIterations = 12,
  sequential = false,
  revealDirection = 'start',
  useOriginalCharsOnly = false,
  characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*',
  encryptedClassName = '',
  animateOn = 'hover',
  clickMode = 'once',
  className = '',
  ...props
}: DecryptedTextProps) {
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const [displayText, setDisplayText] = useState(text);
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(() => new Set(Array.from(text, (_, index) => index)));
  const [isAnimating, setIsAnimating] = useState(false);
  const [isDecrypted, setIsDecrypted] = useState(animateOn !== 'click' && animateOn !== 'view');
  const hasAnimatedRef = useRef(false);
  const intervalRef = useRef(0);

  const availableChars = useMemo(() => {
    if (useOriginalCharsOnly) {
      const sourceChars = Array.from(new Set(Array.from(text).filter((char) => char.trim())));
      return sourceChars.length ? sourceChars : ['*'];
    }
    return Array.from(characters);
  }, [characters, text, useOriginalCharsOnly]);

  const getScrambledText = useCallback(
    (visible: Set<number>) =>
      Array.from(text)
        .map((char, index) => {
          if (!char.trim() || visible.has(index)) {
            return char;
          }
          return availableChars[Math.floor(Math.random() * availableChars.length)] ?? char;
        })
        .join(''),
    [availableChars, text],
  );

  const getRevealOrder = useCallback(() => {
    const indexes = Array.from(text, (_, index) => index);
    if (revealDirection === 'end') {
      return indexes.reverse();
    }
    if (revealDirection === 'center') {
      const center = (indexes.length - 1) / 2;
      return indexes.sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
    }
    return indexes;
  }, [revealDirection, text]);

  const stopAnimation = useCallback(() => {
    window.clearInterval(intervalRef.current);
    setIsAnimating(false);
  }, []);

  const startDecrypt = useCallback(() => {
    stopAnimation();
    const visible = new Set<number>();
    const order = getRevealOrder();
    let iteration = 0;
    setIsAnimating(true);
    setIsDecrypted(false);
    setRevealedIndices(new Set());
    setDisplayText(getScrambledText(visible));

    intervalRef.current = window.setInterval(() => {
      if (sequential) {
        const nextIndex = order[iteration];
        if (nextIndex !== undefined) {
          visible.add(nextIndex);
        }
        setRevealedIndices(new Set(visible));
        setDisplayText(getScrambledText(visible));
        iteration += 1;

        if (visible.size >= text.length) {
          stopAnimation();
          setDisplayText(text);
          setRevealedIndices(new Set(order));
          setIsDecrypted(true);
        }
        return;
      }

      iteration += 1;
      setDisplayText(iteration >= maxIterations ? text : getScrambledText(visible));
      if (iteration >= maxIterations) {
        stopAnimation();
        setRevealedIndices(new Set(order));
        setIsDecrypted(true);
      }
    }, speed);
  }, [getRevealOrder, getScrambledText, maxIterations, sequential, speed, stopAnimation, text]);

  const resetPlain = useCallback(() => {
    stopAnimation();
    setDisplayText(text);
    setRevealedIndices(new Set(Array.from(text, (_, index) => index)));
    setIsDecrypted(true);
  }, [stopAnimation, text]);

  const encryptInstantly = useCallback(() => {
    stopAnimation();
    setDisplayText(getScrambledText(new Set()));
    setRevealedIndices(new Set());
    setIsDecrypted(false);
  }, [getScrambledText, stopAnimation]);

  useEffect(() => {
    return () => window.clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    if (animateOn === 'click') {
      encryptInstantly();
    } else if (animateOn === 'view') {
      setDisplayText(getScrambledText(new Set()));
      setRevealedIndices(new Set());
      setIsDecrypted(false);
    } else {
      resetPlain();
    }
  }, [animateOn, encryptInstantly, getScrambledText, resetPlain, text]);

  useEffect(() => {
    if (animateOn !== 'view' || !containerRef.current) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimatedRef.current) {
          hasAnimatedRef.current = true;
          startDecrypt();
          observer.disconnect();
        }
      },
      { threshold: 0.18 },
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [animateOn, startDecrypt]);

  const handlePointerEnter = () => {
    if (animateOn === 'hover') {
      startDecrypt();
    }
  };

  const handlePointerLeave = () => {
    if (animateOn === 'hover') {
      resetPlain();
    }
  };

  const handleClick = () => {
    if (animateOn !== 'click') {
      return;
    }
    if (clickMode === 'once' && isDecrypted) {
      return;
    }
    if (clickMode === 'toggle' && isDecrypted) {
      encryptInstantly();
      return;
    }
    startDecrypt();
  };

  return (
    <span
      ref={containerRef}
      className={`react-bits-decrypted-text ${isAnimating ? 'is-animating' : ''} ${className}`}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
      {...props}
    >
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {Array.from(displayText).map((char, index) => (
          <span
            className={revealedIndices.has(index) || isDecrypted ? 'is-revealed' : `is-encrypted ${encryptedClassName}`}
            key={`${char}-${index}`}
          >
            {char.trim() ? char : '\u00a0'}
          </span>
        ))}
      </span>
    </span>
  );
}

type TrueFocusProps = HTMLAttributes<HTMLDivElement> & {
  sentence: string;
  separator?: string;
  manualMode?: boolean;
  blurAmount?: number;
  borderColor?: string;
  glowColor?: string;
  animationDuration?: number;
  pauseBetweenAnimations?: number;
};

export function TrueFocus({
  sentence,
  separator = ' ',
  manualMode = false,
  blurAmount = 5,
  borderColor = '#54f4ff',
  glowColor = 'rgba(84, 244, 255, 0.42)',
  animationDuration = 460,
  pauseBetweenAnimations = 1200,
  className = '',
  style,
  ...props
}: TrueFocusProps) {
  const words = useMemo(() => sentence.split(separator).filter(Boolean), [sentence, separator]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [focusRect, setFocusRect] = useState({ x: 0, y: 0, width: 0, height: 0, ready: false });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    if (manualMode || words.length < 2) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setCurrentIndex((index) => (index + 1) % words.length);
    }, animationDuration + pauseBetweenAnimations);

    return () => window.clearInterval(timer);
  }, [animationDuration, manualMode, pauseBetweenAnimations, words.length]);

  useEffect(() => {
    const updateRect = () => {
      const container = containerRef.current;
      const active = wordRefs.current[currentIndex];
      if (!container || !active) {
        return;
      }
      const parentRect = container.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      setFocusRect({
        x: activeRect.left - parentRect.left,
        y: activeRect.top - parentRect.top,
        width: activeRect.width,
        height: activeRect.height,
        ready: true,
      });
    };

    updateRect();
    window.addEventListener('resize', updateRect);
    return () => window.removeEventListener('resize', updateRect);
  }, [currentIndex, words]);

  return (
    <div
      ref={containerRef}
      className={`react-bits-true-focus ${className}`}
      style={
        {
          '--focus-blur': `${blurAmount}px`,
          '--focus-border': borderColor,
          '--focus-glow': glowColor,
          '--focus-duration': `${animationDuration}ms`,
          ...style,
        } as CSSProperties
      }
      {...props}
    >
      {words.map((word, index) => (
        <span
          ref={(node) => {
            wordRefs.current[index] = node;
          }}
          className={`react-bits-focus-word ${index === currentIndex ? 'is-active' : ''}`}
          onPointerEnter={() => manualMode && setCurrentIndex(index)}
          key={`${word}-${index}`}
        >
          {word}
        </span>
      ))}
      <span
        className="react-bits-focus-frame"
        style={{
          opacity: focusRect.ready ? 1 : 0,
          transform: `translate3d(${focusRect.x}px, ${focusRect.y}px, 0)`,
          width: focusRect.width,
          height: focusRect.height,
        }}
        aria-hidden="true"
      >
        <i />
        <i />
        <i />
        <i />
      </span>
    </div>
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

type ScrollVelocityProps = HTMLAttributes<HTMLDivElement> & {
  texts: ReactNode[];
  velocity?: number;
  numCopies?: number;
  reverse?: boolean;
};

export function ScrollVelocity({ texts, velocity = 28, numCopies = 4, reverse = false, className = '', style, ...props }: ScrollVelocityProps) {
  const [boost, setBoost] = useState(0);
  const boostRef = useRef(0);
  const lastScrollRef = useRef({ y: 0, time: 0 });

  useEffect(() => {
    lastScrollRef.current = { y: window.scrollY, time: performance.now() };

    const handleScroll = () => {
      const now = performance.now();
      const deltaY = window.scrollY - lastScrollRef.current.y;
      const deltaTime = Math.max(now - lastScrollRef.current.time, 16);
      const nextBoost = clamp(Math.abs(deltaY / deltaTime) * 6, 0, 18);
      boostRef.current = nextBoost;
      setBoost(nextBoost);
      lastScrollRef.current = { y: window.scrollY, time: now };
    };

    const decay = window.setInterval(() => {
      if (boostRef.current <= 0.05) {
        return;
      }
      boostRef.current *= 0.74;
      setBoost(boostRef.current);
    }, 120);

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.clearInterval(decay);
    };
  }, []);

  const copies = useMemo(() => Array.from({ length: Math.max(numCopies, 2) }, (_, index) => index), [numCopies]);
  const duration = Math.max(7, velocity - boost).toFixed(2);

  return (
    <div
      className={`react-bits-scroll-velocity ${reverse ? 'is-reverse' : ''} ${className}`}
      style={
        {
          '--velocity-duration': `${duration}s`,
          '--velocity-skew': `${Math.min(boost * 0.42, 8).toFixed(2)}deg`,
          ...style,
        } as CSSProperties
      }
      {...props}
    >
      {texts.map((textItem, rowIndex) => (
        <div className="react-bits-velocity-row" data-row={rowIndex % 2} key={rowIndex}>
          <div className="react-bits-velocity-track">
            {copies.map((copy) => (
              <span key={copy}>{textItem}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

type CurvedLoopProps = HTMLAttributes<HTMLDivElement> & {
  text: string;
  speed?: number;
  reverse?: boolean;
};

export function CurvedLoop({ text, speed = 18, reverse = false, className = '', style, ...props }: CurvedLoopProps) {
  const pathId = useMemo(() => `react-bits-curve-${Math.random().toString(36).slice(2)}`, []);

  return (
    <div
      className={`react-bits-curved-loop ${reverse ? 'is-reverse' : ''} ${className}`}
      style={{ '--curve-speed': `${speed}s`, ...style } as CSSProperties}
      {...props}
    >
      <svg viewBox="0 0 1000 220" role="img" aria-label={text}>
        <defs>
          <path id={pathId} d="M -120 128 C 130 18, 318 18, 500 116 S 874 214, 1120 96" />
        </defs>
        <text>
          <textPath href={`#${pathId}`} startOffset="0%">
            {`${text}   ${text}   ${text}   `}
          </textPath>
        </text>
        <text>
          <textPath href={`#${pathId}`} startOffset="50%">
            {`${text}   ${text}   ${text}   `}
          </textPath>
        </text>
      </svg>
    </div>
  );
}

type AuroraProps = HTMLAttributes<HTMLDivElement> & {
  colorStops?: [string, string, string];
  speed?: number;
  amplitude?: number;
  blend?: number;
};

export function Aurora({
  colorStops = ['#ff5f8f', '#54f4ff', '#fff16d'],
  speed = 10,
  amplitude = 1,
  blend = 0.62,
  className = '',
  style,
  ...props
}: AuroraProps) {
  return (
    <div
      className={`react-bits-aurora ${className}`}
      style={
        {
          '--aurora-a': colorStops[0],
          '--aurora-b': colorStops[1],
          '--aurora-c': colorStops[2],
          '--aurora-speed': `${speed}s`,
          '--aurora-amplitude': amplitude,
          '--aurora-blend': blend,
          ...style,
        } as CSSProperties
      }
      aria-hidden="true"
      {...props}
    >
      <span />
      <span />
      <span />
    </div>
  );
}

type SilkProps = HTMLAttributes<HTMLDivElement> & {
  color?: string;
  speed?: number;
  scale?: number;
  noiseIntensity?: number;
  rotation?: number;
};

export function Silk({
  color = '#ff5f8f',
  speed = 8,
  scale = 1,
  noiseIntensity = 0.7,
  rotation = -8,
  className = '',
  style,
  ...props
}: SilkProps) {
  return (
    <div
      className={`react-bits-silk ${className}`}
      style={
        {
          '--silk-color': color,
          '--silk-speed': `${speed}s`,
          '--silk-scale': scale,
          '--silk-noise': noiseIntensity,
          '--silk-rotation': `${rotation}deg`,
          ...style,
        } as CSSProperties
      }
      aria-hidden="true"
      {...props}
    >
      <span />
      <span />
    </div>
  );
}

type CarouselItem = {
  id?: string;
  title: string;
  description?: string;
  tag?: string;
  src?: string;
  accent?: string;
  icon?: ReactNode;
};

type CarouselProps = HTMLAttributes<HTMLDivElement> & {
  items: CarouselItem[];
  autoplay?: boolean;
  autoplayDelay?: number;
  loop?: boolean;
};

export function Carousel({ items, autoplay = false, autoplayDelay = 4200, loop = true, className = '', ...props }: CarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeItem = items[activeIndex] ?? items[0];

  useEffect(() => {
    if (!autoplay || items.length < 2) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1 >= items.length ? (loop ? 0 : index) : index + 1));
    }, autoplayDelay);

    return () => window.clearInterval(timer);
  }, [autoplay, autoplayDelay, items.length, loop]);

  const goTo = (index: number) => {
    if (items.length === 0) {
      return;
    }
    const next = loop ? (index + items.length) % items.length : clamp(index, 0, items.length - 1);
    setActiveIndex(next);
  };

  return (
    <div
      className={`react-bits-carousel ${className}`}
      style={{ '--carousel-accent': activeItem?.accent ?? '#54f4ff' } as CSSProperties}
      {...props}
    >
      <div className="react-bits-carousel-stage">
        {items.map((item, index) => {
          const rawOffset = index - activeIndex;
          const offset =
            loop && Math.abs(rawOffset) > items.length / 2
              ? rawOffset - Math.sign(rawOffset) * items.length
              : rawOffset;
          const absOffset = Math.min(Math.abs(offset), 1);

          return (
            <article
              className="react-bits-carousel-slide"
              data-active={index === activeIndex}
              style={
                {
                  '--carousel-offset': offset,
                  '--carousel-opacity': 1 - absOffset * 0.68,
                  '--carousel-scale': 1 - absOffset * 0.07,
                  '--carousel-item-accent': item.accent ?? '#54f4ff',
                } as CSSProperties
              }
              key={item.id ?? item.title}
            >
              {item.src && <img src={item.src} alt={item.title} />}
              <div>
                {item.tag && <span>{item.tag}</span>}
                <h3>{item.title}</h3>
                {item.description && <p>{item.description}</p>}
              </div>
            </article>
          );
        })}
      </div>

      <div className="react-bits-carousel-controls">
        <button type="button" onClick={() => goTo(activeIndex - 1)} aria-label="Previous carousel item">
          ←
        </button>
        <div>
          {items.map((item, index) => (
            <button
              type="button"
              data-active={index === activeIndex}
              onClick={() => goTo(index)}
              aria-label={`Show ${item.title}`}
              key={item.id ?? item.title}
            />
          ))}
        </div>
        <button type="button" onClick={() => goTo(activeIndex + 1)} aria-label="Next carousel item">
          →
        </button>
      </div>
    </div>
  );
}

type FlowingMenuItem = {
  label: string;
  text: string;
  meta?: string;
  href?: string;
};

type FlowingMenuProps = HTMLAttributes<HTMLElement> & {
  items: FlowingMenuItem[];
};

export function FlowingMenu({ items, className = '', ...props }: FlowingMenuProps) {
  return (
    <nav className={`react-bits-flowing-menu ${className}`} aria-label="Flowing menu" {...props}>
      {items.map((item, index) => {
        const content = (
          <>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{item.label}</strong>
            <p>{item.text}</p>
            {item.meta && <small>{item.meta}</small>}
          </>
        );

        return item.href ? (
          <a href={item.href} key={item.label}>
            {content}
          </a>
        ) : (
          <div key={item.label}>{content}</div>
        );
      })}
    </nav>
  );
}
