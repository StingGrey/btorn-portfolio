// 小电视（不用 3D 的版本）：机身、屏幕框、旋钮、按键、天线都是 DOM + CSS，
// 屏幕里的节目是一张 2D 画布（consoleCanvas）。没有 WebGPU 渲染循环：
// 外壳是静止的图层，屏幕那张小画布每帧重画；镜头拉远、退到一边都是一次 CSS 变换。
// 电视不跟着鼠标转，也不能拖着歪头。

import './tv.css';
import { channels, consoleCopy } from '../content';
import { createConsoleRenderer } from '../three/consoleCanvas';

export type TvState = { channel: number; power: boolean; playing: boolean; seconds: number };

export type TvSet = {
  setChannel: (index: number, quiet?: boolean) => void;
  next: () => void;
  prev: () => void;
  togglePower: () => void;
  togglePlay: () => void;
  degauss: () => void;
  /** 一小阵雪花，天线跟着晃一下（弹窗从电视里冒出来的时候） */
  kick: () => void;
  /** 控制台还在台上时悄悄对齐：开着机、停在同一个分类，缩进电视的那一下画面才接得上 */
  sync: (index: number) => void;
  /**
   * zoom 0 = 屏幕铺满视口，1 = 看到整台电视；aside 0..1 = 电视退到一边（宽屏退到左边，窄屏退到上面），给弹窗腾地方；
   * snow 0..1 是和控制台交接时盖在画面上的雪花，由滚动位置决定
   */
  setSequence: (zoom: number, aside: number, snow?: number) => void;
  setInteractive: (interactive: boolean) => void;
  setActive: (active: boolean) => void;
  /** 屏幕在视口里的位置：弹窗从这里飞出来 */
  screenRect: () => DOMRect;
  dispose: () => void;
};

type Options = {
  reducedMotion: boolean;
  onChange: (state: TvState) => void;
};

/* 设计稿坐标（px）：原点在机身左上角 */
const TV_W = 530;
const TV_H = 360;
/** 天线尖高出机身多少、脚垫低出多少 */
const ABOVE = 196;
const BELOW = 24;
const SCREEN = { cx: 210, cy: 175, w: 296, h: 221 };
const DIAL = { cx: 446, cy: 86 };
const AUTO_SECONDS = 7;
const TAU = Math.PI * 2;
const QUARTER = Math.PI / 2;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const KEY_COLORS = [
  ['#ff9cc2', '#e27aa5'],
  ['#9fd2ff', '#78b1e4'],
  ['#8fe3bf', '#69c29c'],
  ['#ffe27a', '#e3c152'],
];

/** 宽屏上电视退到左边；窄屏、接近方形的屏幕上退到上面 */
export const tvGoesUp = (width: number, height: number) => width < 900 || width / height < 1.1;

function template() {
  const ticks = Array.from({ length: 12 }, (_, index) => {
    const angle = (index * Math.PI) / 6;
    const x = (DIAL.cx + Math.sin(angle) * 53).toFixed(1);
    const y = (DIAL.cy - Math.cos(angle) * 53).toFixed(1);
    return `<i class="tv-tick" data-major="${index % 3 === 0}" style="left:${x}px;top:${y}px"></i>`;
  }).join('');
  const keys = KEY_COLORS.map(([face, side], index) => {
    const x = 446 + (index % 2 ? 27 : -27);
    const y = 170 + Math.floor(index / 2) * 41;
    return `<span class="tv-well" style="left:${x}px;top:${y}px"><button type="button" class="tv-key" data-key="${index}" aria-label="Channel ${index + 1}" aria-pressed="false" style="--key:${face};--key-side:${side}">${index + 1}</button></span>`;
  }).join('');
  const rod = (side: 'l' | 'r') =>
    // 三节伸缩杆：细的那节最长、垫在最下面，粗的两节依次盖住它的下半截
    `<span class="tv-rod tv-rod-${side}"><i class="tv-rod-c"></i><i class="tv-rod-b"></i><i class="tv-rod-a"></i><b></b></span>`;
  return `
    <div class="tv-rig">
      <div class="tv-floor"></div>
      <div class="tv-antenna">${rod('l')}${rod('r')}<span class="tv-antenna-base"></span></div>
      <div class="tv-feet"><i></i><i></i></div>
      <div class="tv-shell">
        <div class="tv-face">
          <span class="tv-badge" aria-hidden="true">BT<b>O</b>RN</span>
          <div class="tv-grille" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        </div>
      </div>
      <span class="tv-tape" aria-hidden="true">dream ch.</span>
      <svg class="tv-sticker" viewBox="0 0 40 40" aria-hidden="true">
        <path d="M20 3.5l4.6 10 10.9 1.2-8.1 7.4 2.3 10.7L20 27.4l-9.7 5.4 2.3-10.7-8.1-7.4 10.9-1.2z" fill="#ffe27a" stroke="#fff" stroke-width="3.2" stroke-linejoin="round" paint-order="stroke"/>
      </svg>
      ${ticks}
      <div class="tv-bezel">
        <div class="tv-mask">
          <button type="button" class="tv-screen" aria-label="Pause or play the screen">
            <span class="tv-tube"></span>
            <span class="tv-osd" aria-hidden="true"></span>
            <span class="tv-scan" aria-hidden="true"></span>
            <span class="tv-vignette" aria-hidden="true"></span>
            <span class="tv-glare" aria-hidden="true"></span>
          </button>
        </div>
      </div>
      <button type="button" class="tv-dial" aria-label="Channel dial: drag to turn, or use the arrow keys">
        <span class="tv-dial-knob"><span class="tv-dial-top"><i></i></span></span>
      </button>
      ${keys}
      <span class="tv-led" aria-hidden="true"><i></i></span>
      <span class="tv-power-well">
        <button type="button" class="tv-power" aria-label="Power" aria-pressed="true">
          <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M12 3.5v8M7.2 6.6a7.2 7.2 0 1 0 9.6 0" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>
        </button>
      </span>
    </div>`;
}

export async function createTvSet(root: HTMLDivElement, options: Options): Promise<TvSet> {
  const images = await Promise.all(
    channels.map(
      (channel) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error(`TV image failed: ${channel.src}`));
          image.src = channel.src;
        }),
    ),
  );
  await Promise.all([
    document.fonts.load('62px "VT323"').catch(() => undefined),
    document.fonts.load('600 31px "Fredoka"').catch(() => undefined),
  ]);

  const picture = createConsoleRenderer(images, consoleCopy, channels.map((channel) => channel.focusY));
  picture.canvas.className = 'tv-picture';

  root.classList.add('tv-root');
  root.innerHTML = template();
  const $ = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const rig = $('.tv-rig');
  const tube = $('.tv-tube');
  const osd = $('.tv-osd');
  const screenButton = $<HTMLButtonElement>('.tv-screen');
  const dial = $<HTMLButtonElement>('.tv-dial');
  const dialKnob = $('.tv-dial-knob');
  const powerButton = $<HTMLButtonElement>('.tv-power');
  const keyButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('.tv-key'));
  const rodEls = [$('.tv-rod-l'), $('.tv-rod-r')];
  tube.appendChild(picture.canvas);
  root.dataset.power = 'on';
  root.dataset.motion = options.reducedMotion ? 'reduced' : 'full';
  root.inert = true;

  /* ---------- 状态 ---------- */
  const state: TvState = { channel: 0, power: true, playing: true, seconds: 0 };
  let previous = 0;
  let switchT = 1;
  let burstT = 0;
  let flashT = 0;
  let autoT = 0;
  let lastSecond = -1;
  let interactive = false;
  let active = false;
  let zoom = 0;
  let aside = 0;
  let handoffSnow = 0;
  let disposed = false;
  const emit = () => options.onChange({ ...state });

  /* ---------- 天线：两根小弹簧，换台、消磁、冒弹窗的时候晃一晃 ---------- */
  const rods = [
    { rest: -26, angle: 0, vel: 0 },
    { rest: 24, angle: 0, vel: 0 },
  ];
  const wobble = (amount: number) => {
    if (options.reducedMotion) return;
    rods.forEach((rod, index) => {
      rod.vel += (index ? -1 : 1) * amount * (0.8 + Math.random() * 0.4);
    });
  };

  const showOsd = () => {
    osd.textContent = `CH ${channels[state.channel].number}`;
    flashT = 1.3;
    osd.dataset.on = 'true';
  };
  const markKeys = () => {
    keyButtons.forEach((button, index) => {
      button.setAttribute('aria-pressed', String(state.power && index === state.channel));
    });
  };

  const setChannel = (index: number, quiet = false, instant = false) => {
    const nextIndex = ((index % channels.length) + channels.length) % channels.length;
    if (nextIndex === state.channel) {
      if (!quiet) showOsd();
      return;
    }
    previous = state.channel;
    state.channel = nextIndex;
    // instant：直接切过去，不播换台的雪花过场（对齐控制台时画面正被交接的雪花盖着，或者电视根本没露面）
    switchT = instant ? 1 : 0;
    if (!quiet) {
      showOsd();
      wobble(70);
    }
    autoT = 0;
    markKeys();
    emit();
  };

  const applyPower = (animate: boolean) => {
    root.dataset.power = state.power ? 'on' : 'off';
    root.dataset.powerAnim = animate ? 'true' : 'false';
    powerButton.setAttribute('aria-pressed', String(state.power));
    markKeys();
  };
  const togglePower = () => {
    state.power = !state.power;
    applyPower(true);
    if (state.power) {
      showOsd();
      burstT = 0.4;
    } else {
      flashT = 0;
      osd.dataset.on = 'false';
    }
    emit();
  };
  const powerOn = () => {
    if (!state.power) togglePower();
  };
  const togglePlay = () => {
    state.playing = !state.playing;
    autoT = 0;
    emit();
  };

  let degaussUntil = 0;
  const degauss = () => {
    if (!state.power) return;
    degaussUntil = performance.now() + 1700;
    root.dataset.degauss = 'false';
    // 重新触发一遍 CSS 动画
    void root.offsetWidth;
    root.dataset.degauss = 'true';
    wobble(160);
  };

  /* ---------- 运镜：屏幕铺满视口 → 看到整台电视 → 退到一边（都是一次 CSS 变换） ---------- */
  let viewW = 1;
  let viewH = 1;
  const place = () => {
    const narrow = viewW <= 560;
    const padTop = clamp(viewH * 0.1, 62, 96);
    const padBottom = narrow ? 150 : 110;
    const fullH = TV_H + ABOVE + BELOW;
    // ① 起点：屏幕盖住视口（比视口略大一点，四周不露边）
    const s0 = Math.max(viewW / (SCREEN.w * 0.94), viewH / (SCREEN.h * 0.94));
    const x0 = viewW / 2 - s0 * SCREEN.cx;
    const y0 = viewH / 2 - s0 * SCREEN.cy;
    // ② 整台电视放在视口正中，上面让开导航、下面让开遥控条
    const padX = Math.max(16, viewW * 0.06);
    const roomH = Math.max(160, viewH - padTop - padBottom);
    const s1 = Math.min((viewW - padX * 2) / TV_W, roomH / fullH, 1.7);
    const x1 = (viewW - s1 * TV_W) / 2;
    const y1 = padTop + (roomH - s1 * fullH) / 2 + s1 * ABOVE;
    // ③ 退到一边：宽屏占左边四成，窄屏占上面三成多
    let s2: number;
    let x2: number;
    let y2: number;
    if (tvGoesUp(viewW, viewH)) {
      const bandH = Math.max(150, viewH * 0.38 - padTop + 18);
      s2 = Math.min((viewW - 32) / TV_W, bandH / fullH);
      x2 = (viewW - s2 * TV_W) / 2;
      y2 = padTop - 6 + (bandH - s2 * fullH) / 2 + s2 * ABOVE;
    } else {
      const bandW = viewW * 0.4;
      const bandH = viewH - padTop - 40;
      s2 = Math.min((bandW - padX) / TV_W, bandH / fullH, 1.25);
      x2 = padX + (bandW - padX - s2 * TV_W) / 2;
      y2 = padTop + (bandH - s2 * fullH) / 2 + s2 * ABOVE;
    }

    const z = smooth(zoom);
    // 拉远：缩放按倍数匀速变化；位置跟着缩放线性走，相当于绕着一个固定点在缩，画面不会走弧线
    let scale = Math.exp(lerp(Math.log(s0), Math.log(s1), z));
    const k = Math.abs(s1 - s0) < 1e-6 ? z : (scale - s0) / (s1 - s0);
    let x = lerp(x0, x1, k);
    let y = lerp(y0, y1, k);
    if (aside > 0) {
      const a = smooth(aside);
      scale = lerp(scale, s2, a);
      x = lerp(x, x2, a);
      y = lerp(y, y2, a);
    }
    const size = scale.toFixed(4);
    rig.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${size})`;
    root.style.setProperty('--tv-zoom', z.toFixed(3));
    // 扫描线在屏幕上保持差不多的粗细：电视缩得再小也不会挤成一片发灰的摩尔纹
    root.style.setProperty('--tv-line', `${(3.4 / scale).toFixed(3)}px`);
  };

  const resizeObserver = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    if (width > 0 && height > 0) {
      viewW = width;
      viewH = height;
      place();
    }
  });
  resizeObserver.observe(root);
  viewW = root.clientWidth || window.innerWidth;
  viewH = root.clientHeight || window.innerHeight;
  place();

  /* ---------- 交互（只在运镜结束后开放） ---------- */
  let dialAngle = 0;
  let dialVel = 0;
  type DialDrag = { x: number; y: number; moved: number; pointerId: number; angle: number | null };
  let drag: DialDrag | null = null;

  const channelAt = (angle: number) => (((Math.round(angle / QUARTER) % 4) + 4) % 4);
  /** 指针绕旋钮中心的角度（顺时针为正）；离中心太近时方向不可靠，返回 null */
  const angleAroundDial = (event: PointerEvent) => {
    const rect = dial.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    return Math.hypot(dx, dy) < 7 ? null : Math.atan2(dy, dx);
  };
  const endDrag = () => {
    if (!drag) return;
    if (dial.hasPointerCapture(drag.pointerId)) dial.releasePointerCapture(drag.pointerId);
    root.dataset.dragging = 'false';
    drag = null;
  };

  const onKeyClick = (event: Event) => {
    const index = Number((event.currentTarget as HTMLElement).dataset.key);
    powerOn();
    setChannel(index);
  };
  keyButtons.forEach((button) => button.addEventListener('click', onKeyClick));
  powerButton.addEventListener('click', togglePower);
  screenButton.addEventListener('click', togglePlay);

  // 旋钮：按住以后手指绕着它转多少，它就转多少；每拧过一格就真的换一个台。没怎么拖就松手 = 换到下一个台
  const onDialDown = (event: PointerEvent) => {
    if (!interactive || drag) return;
    dial.setPointerCapture(event.pointerId);
    drag = { x: event.clientX, y: event.clientY, moved: 0, pointerId: event.pointerId, angle: angleAroundDial(event) };
    root.dataset.dragging = 'true';
  };
  const onDialMove = (event: PointerEvent) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.moved += Math.hypot(event.clientX - drag.x, event.clientY - drag.y);
    drag.x = event.clientX;
    drag.y = event.clientY;
    const angle = angleAroundDial(event);
    if (angle !== null) {
      if (drag.angle !== null) {
        let delta = angle - drag.angle;
        if (delta > Math.PI) delta -= TAU;
        if (delta < -Math.PI) delta += TAU;
        dialAngle += delta;
      }
      drag.angle = angle;
      written.dial = `rotate(${dialAngle.toFixed(3)}rad)`;
      dialKnob.style.transform = written.dial;
    }
    if (drag.moved >= 6 && channelAt(dialAngle) !== state.channel) {
      powerOn();
      setChannel(channelAt(dialAngle));
    }
  };
  const onDialUp = (event: PointerEvent) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved < 6 && event.type === 'pointerup') {
      powerOn();
      setChannel(state.channel + 1);
    }
    endDrag();
  };
  const onDialKey = (event: KeyboardEvent) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      powerOn();
      setChannel(state.channel + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      powerOn();
      setChannel(state.channel - 1);
    }
  };
  dial.addEventListener('pointerdown', onDialDown);
  dial.addEventListener('pointermove', onDialMove);
  dial.addEventListener('pointerup', onDialUp);
  dial.addEventListener('pointercancel', onDialUp);
  dial.addEventListener('keydown', onDialKey);

  /* ---------- 每帧 ---------- */
  let elapsed = 0;
  let frame = 0;
  let last = performance.now();
  const written = { dial: '', rods: ['', ''] };
  const reduce = options.reducedMotion;

  const update = (dt: number) => {
    elapsed += dt;
    if (switchT < 1) switchT = Math.min(1, switchT + dt / (reduce ? 0.2 : 0.6));
    burstT = Math.max(0, burstT - dt);
    if (flashT > 0) {
      flashT = Math.max(0, flashT - dt);
      if (flashT === 0) osd.dataset.on = 'false';
    }

    if (state.power && state.playing) {
      state.seconds += dt;
      if (interactive && !reduce) {
        autoT += dt;
        if (autoT > AUTO_SECONDS) setChannel(state.channel + 1);
      }
    }
    const second = Math.floor(state.seconds);
    if (second !== lastSecond) {
      lastSecond = second;
      emit();
    }

    // 屏幕里的画面每帧重画；关机以后屏幕是黑的，不用画
    if (state.power) {
      const snow = Math.min(0.95, (1 - switchT) * 0.7 + burstT * 1.6 + handoffSnow * 0.95);
      picture.draw({
        index: state.channel,
        previous,
        switchT: smooth(switchT),
        time: elapsed,
        playing: state.playing,
        seconds: state.seconds,
        snow: snow > 0.02 ? snow : 0,
      });
    }

    // 旋钮弹回当前台位：走最近的那一圈（4 台跳回 1 台是往前拧一格，不是倒着拧三格）
    if (!drag) {
      const base = state.channel * QUARTER;
      const target = base + Math.round((dialAngle - base) / TAU) * TAU;
      dialVel += ((target - dialAngle) * 90 - dialVel * 12) * dt;
      dialAngle += dialVel * dt;
    } else {
      dialVel = 0;
    }
    const dialText = `rotate(${dialAngle.toFixed(3)}rad)`;
    if (dialText !== written.dial) {
      written.dial = dialText;
      dialKnob.style.transform = dialText;
    }

    rods.forEach((rod, index) => {
      rod.vel += (-rod.angle * 40 - rod.vel * 3.2) * dt;
      rod.angle += rod.vel * dt;
      const text = `rotate(${(rod.rest + rod.angle * 0.35).toFixed(2)}deg)`;
      if (text !== written.rods[index]) {
        written.rods[index] = text;
        rodEls[index].style.transform = text;
      }
    });

    if (degaussUntil && performance.now() > degaussUntil) {
      degaussUntil = 0;
      root.dataset.degauss = 'false';
    }
  };

  // 跟着屏幕的刷新率走，不设上限
  const loop = () => {
    frame = requestAnimationFrame(loop);
    const now = performance.now();
    const gap = now - last;
    last = now;
    update(Math.min(gap / 1000, 1 / 30));
  };

  update(0);
  markKeys();
  emit();

  return {
    setChannel: (index, quiet = false) => {
      if (!state.power && !quiet) togglePower();
      setChannel(index, quiet);
    },
    next: () => {
      powerOn();
      setChannel(state.channel + 1);
    },
    prev: () => {
      powerOn();
      setChannel(state.channel - 1);
    },
    togglePower,
    togglePlay,
    degauss,
    kick: () => {
      if (state.power) burstT = Math.max(burstT, 0.22);
      wobble(55);
    },
    sync: (index) => {
      if (!state.power) {
        // 不走开机动画：这时候画面要么没露面、要么正被交接的雪花盖着
        state.power = true;
        applyPower(false);
        emit();
      }
      setChannel(index, true, true);
    },
    setSequence: (nextZoom, nextAside, nextSnow = 0) => {
      const z = clamp(nextZoom, 0, 1);
      const a = clamp(nextAside, 0, 1);
      handoffSnow = clamp(nextSnow, 0, 1);
      if (z === zoom && a === aside) return;
      zoom = z;
      aside = a;
      place();
    },
    setInteractive: (value) => {
      if (value === interactive) return;
      interactive = value;
      root.inert = !value;
      root.dataset.interactive = String(value);
      if (!value) endDrag();
    },
    setActive: (value) => {
      if (value === active || disposed) return;
      active = value;
      root.dataset.active = String(value);
      cancelAnimationFrame(frame);
      if (value) {
        last = performance.now();
        // 先按当前状态补一帧，免得露出来的第一帧是旧画面
        update(0);
        frame = requestAnimationFrame(loop);
      }
    },
    screenRect: () => screenButton.getBoundingClientRect(),
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      root.innerHTML = '';
    },
  };
}
