import { useEffect, useRef, useState, type RefObject } from 'react';

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 元素是否在视口附近，用来暂停看不见的动画循环 */
export function useInView<T extends Element>(ref: RefObject<T | null>, rootMargin = '120px 0px') {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!('IntersectionObserver' in window)) {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, rootMargin]);

  return inView;
}

/** 返回一个会自增的 id 生成器，给一次性粒子用 */
export function useIdCounter() {
  const next = useRef(0);
  return () => {
    next.current += 1;
    return next.current;
  };
}

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
