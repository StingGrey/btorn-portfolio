import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
} from 'react';

// 只有 Chromium 支持把 SVG 滤镜放进 backdrop-filter，其它浏览器退回普通磨砂
const svgBackdrop =
  typeof navigator !== 'undefined' &&
  /Chrome|Chromium|Edg\//.test(navigator.userAgent) &&
  typeof CSS !== 'undefined' &&
  CSS.supports('backdrop-filter', 'url(#a)');

/** 圆角矩形边缘的位移图：R/G 存往里折的方向，越靠边折得越厉害 */
function displacementMap(width: number, height: number, radius: number, bezel: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const image = ctx.createImageData(width, height);
  const r = Math.min(radius, width / 2, height / 2);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const px = x + 0.5 - width / 2;
      const py = y + 0.5 - height / 2;
      const qx = Math.abs(px) - (width / 2 - r);
      const qy = Math.abs(py) - (height / 2 - r);
      const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
      const inside = Math.min(Math.max(qx, qy), 0);
      const depth = r - (outside + inside);
      let dx = 0;
      let dy = 0;
      if (depth > 0 && depth < bezel) {
        let nx = 0;
        let ny = 0;
        if (qx > 0 && qy > 0) {
          const len = Math.hypot(qx, qy) || 1;
          nx = qx / len;
          ny = qy / len;
        } else if (qx > qy) nx = 1;
        else ny = 1;
        nx *= Math.sign(px) || 1;
        ny *= Math.sign(py) || 1;
        const k = (1 - depth / bezel) ** 2;
        dx = -nx * k;
        dy = -ny * k;
      }
      const offset = (y * width + x) * 4;
      image.data[offset] = 128 + dx * 127;
      image.data[offset + 1] = 128 + dy * 127;
      image.data[offset + 2] = 128;
      image.data[offset + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

type GlassProps = HTMLAttributes<HTMLDivElement> & {
  radius?: number;
  bezel?: number;
  refraction?: number;
  blur?: number;
};

/** 物理毛玻璃：边缘折射 + RGB 分离的色散 + 磨砂 + 跟着指针走的高光 */
export function Glass({ radius = 24, bezel = 18, refraction = 36, blur = 14, className = '', style, children, ...props }: GlassProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const id = `glass-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  useEffect(() => {
    const node = ref.current;
    if (!node || !svgBackdrop) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width);
      const height = Math.round(entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height);
      setSize((value) => (value.width === width && value.height === height ? value : { width, height }));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const map = useMemo(
    () => (svgBackdrop && size.width > 0 && size.height > 0 ? displacementMap(size.width, size.height, radius, bezel) : ''),
    [bezel, radius, size.height, size.width],
  );

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--gx', `${(((event.clientX - rect.left) / rect.width) * 100).toFixed(1)}%`);
    event.currentTarget.style.setProperty('--gy', `${(((event.clientY - rect.top) / rect.height) * 100).toFixed(1)}%`);
  };

  const filter = map ? `url(#${id}) blur(${blur}px) saturate(1.7) brightness(1.04)` : undefined;

  return (
    <div
      ref={ref}
      className={`glass ${className}`.trim()}
      data-refract={map ? 'on' : 'off'}
      style={{ '--glass-r': `${radius}px`, '--glass-blur': `${blur}px`, backdropFilter: filter, ...style } as CSSProperties}
      onPointerMove={onPointerMove}
      {...props}
    >
      {map && (
        <svg className="glass-defs" width="0" height="0" aria-hidden="true" focusable="false">
          <filter id={id} x="0" y="0" width={size.width} height={size.height} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feImage href={map} x="0" y="0" width={size.width} height={size.height} preserveAspectRatio="none" result="map" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale={refraction} xChannelSelector="R" yChannelSelector="G" result="red" />
            <feColorMatrix in="red" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale={refraction * 1.07} xChannelSelector="R" yChannelSelector="G" result="green" />
            <feColorMatrix in="green" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale={refraction * 1.14} xChannelSelector="R" yChannelSelector="G" result="blue" />
            <feColorMatrix in="blue" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
            <feComposite in="r" in2="g" operator="arithmetic" k2="1" k3="1" result="rg" />
            <feComposite in="rg" in2="b" operator="arithmetic" k2="1" k3="1" />
          </filter>
        </svg>
      )}
      {children}
    </div>
  );
}
