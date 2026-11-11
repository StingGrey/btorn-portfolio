// 方案 D 的滚轮滚动：不再和滚轮一比一，每一格滚得更短、而且是缓出来的；
// 几段动画特别密的地方（玻璃碎落、控制台交接、死机、开机自检）再额外放慢。
// 手机上的触摸滚动保持原生；系统设置了减少动效时整个不启用。

import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

/** 滚轮滚一格，页面走原来的多少 */
const WHEEL_SPEED = 0.55;
/** 每帧追上目标位置的比例：越小越“滑” */
const LERP = 0.085;

let instance: Lenis | null = null;

/**
 * speedAt：当前位置的额外倍率（1 = 不额外放慢）。由页面自己根据滚动进度给出。
 */
export function startSmoothScroll(speedAt: () => number) {
  if (instance) return instance;
  instance = new Lenis({
    autoRaf: true,
    lerp: LERP,
    smoothWheel: true,
    syncTouch: false,
    wheelMultiplier: WHEEL_SPEED,
    anchors: true,
    virtualScroll: (data) => {
      if (data.event.type === 'wheel') {
        data.deltaY *= speedAt();
        data.deltaX *= speedAt();
      }
      return true;
    },
  });
  return instance;
}

export function stopSmoothScroll() {
  instance?.destroy();
  instance = null;
}

/** 回到顶上（Heal it）：有平滑滚动就让它带着慢慢回去，没有就用原生的 */
export function scrollToTop(reducedMotion: boolean) {
  if (instance && !reducedMotion) instance.scrollTo(0, { duration: 2.6 });
  else window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
}
