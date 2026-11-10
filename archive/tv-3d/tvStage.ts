import * as THREE from 'three/webgpu';
import {
  Fn,
  clamp,
  color,
  dot,
  float,
  floor,
  fract,
  hue,
  length,
  mix,
  mrt,
  normalView,
  output,
  pass,
  positionViewDirection,
  reflect,
  screenUV,
  sin,
  smoothstep,
  step,
  texture,
  time,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import fredokaBold from '@fontsource/fredoka/files/fredoka-latin-600-normal.woff?url';
import { channels, consoleCopy } from '../content';
import { createConsoleRenderer } from './consoleCanvas';
import { loadFont } from './fontGeometry';
import { SCREEN_H, SCREEN_W, buildTvModel, curvedScreenGeometry, disposeObject, partOf } from './tvModel';

export type TvState = { channel: number; power: boolean; playing: boolean; seconds: number };

export type TvStage = {
  backend: 'WebGPU' | 'WebGL2';
  setChannel: (index: number, quiet?: boolean) => void;
  next: () => void;
  prev: () => void;
  togglePower: () => void;
  togglePlay: () => void;
  degauss: () => void;
  /** 控制台还在台上时悄悄对齐：开着机、停在同一个分类，缩进电视的那一下画面才接得上 */
  sync: (index: number) => void;
  /**
   * zoom 0 = 屏幕铺满视口，1 = 看到整台电视；settle 让电视最后转成 3/4 侧面；
   * snow 0..1 是和控制台交接时盖在画面上的雪花，由滚动位置决定
   */
  setSequence: (zoom: number, settle: number, snow?: number) => void;
  setInteractive: (interactive: boolean) => void;
  setActive: (active: boolean) => void;
  dispose: () => void;
};

type Options = {
  reducedMotion: boolean;
  forceWebGL?: boolean;
  onChange: (state: TvState) => void;
};

const AUTO_SECONDS = 7;
/** 电视里的画面每秒重画多少次。显像管节目 30 帧足够，不用跟着 120Hz 的屏幕每帧重画、重传一整张纹理 */
const SCREEN_FPS = 30;

// TSL 节点类型很复杂，这里的小工具只做数学，参数放宽成 any
/* eslint-disable @typescript-eslint/no-explicit-any */
const hash2 = (p: any) => fract(sin(dot(p, vec2(12.9898, 78.233))).mul(43758.5453));

const smoothstepJs = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

export async function createTvStage(canvas: HTMLCanvasElement, options: Options): Promise<TvStage> {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, forceWebGL: options.forceWebGL });
  await renderer.init();
  const backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'WebGPU' : 'WebGL2';
  renderer.toneMapping = THREE.NeutralToneMapping;

  const loader = new THREE.TextureLoader();
  const [font, ...loaded] = await Promise.all([
    loadFont(fredokaBold),
    ...channels.map((channel) => loader.loadAsync(channel.src)),
    document.fonts.load('56px "VT323"').catch(() => undefined),
    document.fonts.load('600 31px "Fredoka"').catch(() => undefined),
  ]);
  const channelTextures = loaded.slice(0, channels.length) as THREE.Texture[];
  const images = channelTextures.map((item) => item.image as HTMLImageElement);
  const consoleRenderer = createConsoleRenderer(images, consoleCopy, channels.map((channel) => channel.focusY));
  const consoleTexture = new THREE.CanvasTexture(consoleRenderer.canvas);
  consoleTexture.colorSpace = THREE.SRGBColorSpace;
  consoleTexture.anisotropy = 8;

  const scene = new THREE.Scene();
  // 背景：中间一团很浅的粉，往四周过渡到淡紫粉，右下角带一点天蓝。
  // 整个画面最后要过一遍 Neutral 色调映射，亮色会被压暗一截，所以这里先乘一个增益把它顶回去
  const backdrop = Fn(() => {
    const p = screenUV;
    const d = length(p.sub(vec2(0.5, 0.46)).mul(vec2(1, 1.12)));
    const base = mix(color('#fff3f8'), color('#f1dcf2'), smoothstep(0.12, 0.8, d)).toVar();
    const sky = float(1).sub(smoothstep(0, 0.6, length(p.sub(vec2(0.95, 0.92)))));
    base.assign(mix(base, color('#dcebff'), sky.mul(0.55)));
    return base.mul(1.9);
  });
  scene.backgroundNode = backdrop();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.8;
  const key = new THREE.DirectionalLight('#ffffff', 2.2);
  key.position.set(-5, 7, 8);
  scene.add(key);
  const fill = new THREE.DirectionalLight('#d8ecff', 0.9);
  fill.position.set(6, 2, 5);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 80);

  /* ---------- CRT 着色器：播放控制台画布 ---------- */
  const uStatic = uniform(0);
  const uRoll = uniform(0);
  const uPower = uniform(1);
  const uDegauss = uniform(0);
  const uFlash = uniform(0);
  const uCurve = uniform(0);
  const consoleSampler = texture(consoleTexture);

  const osdCanvas = document.createElement('canvas');
  osdCanvas.width = 640;
  osdCanvas.height = 480;
  const osdCtx = osdCanvas.getContext('2d')!;
  const osdTexture = new THREE.CanvasTexture(osdCanvas);
  osdTexture.colorSpace = THREE.SRGBColorSpace;
  const osd = texture(osdTexture);

  const crt = Fn(() => {
    const c = uv().sub(0.5).mul(2);
    const bend = c.yx.abs().div(vec2(5.5, 4.5)).mul(uCurve);
    const curved = c.add(c.mul(bend.mul(bend))).mul(0.5).add(0.5);
    const inside = step(0, curved.x).mul(step(curved.x, 1)).mul(step(0, curved.y)).mul(step(curved.y, 1));

    // 开关机：先横向收成一条线，再收成一个点
    const sy = smoothstep(0.42, 1, uPower).max(0.006);
    const sx = smoothstep(0, 0.42, uPower).max(0.004);
    const q = curved.sub(0.5).div(vec2(sx, sy)).add(0.5);
    const lit = step(0, q.x).mul(step(q.x, 1)).mul(step(0, q.y)).mul(step(q.y, 1));

    const line = floor(q.y.mul(240));
    const jitter = hash2(vec2(line, floor(time.mul(30)))).sub(0.5).mul(0.003).mul(float(1).add(uStatic.mul(8)));
    const wobble = sin(q.y.mul(18).add(time.mul(14))).mul(0.016).mul(uDegauss);
    const q2 = vec2(q.x.add(jitter).add(wobble), fract(q.y.add(uRoll)));

    const shift = float(0.0016).add(uStatic.mul(0.01)).add(uDegauss.mul(0.014));
    const img = vec3(
      consoleSampler.sample(q2.add(vec2(shift, 0))).r,
      consoleSampler.sample(q2).g,
      consoleSampler.sample(q2.sub(vec2(shift, 0))).b,
    ).toVar();

    img.assign(hue(img, sin(q2.y.mul(6).add(time.mul(9))).mul(uDegauss).mul(2.4)));
    const snow = hash2(floor(q2.mul(vec2(320, 240))).add(floor(time.mul(50))));
    img.assign(mix(img, vec3(snow), uStatic));

    const scan = mix(float(1), float(0.82).add(sin(q2.y.mul(240 * Math.PI * 2)).mul(0.18)), uCurve.mul(0.5).add(0.5));
    const triad = fract(q2.x.mul(213));
    const mask = vec3(step(triad, 0.333), step(0.333, triad).mul(step(triad, 0.666)), step(0.666, triad));
    img.mulAssign(scan);
    img.mulAssign(mix(vec3(1), mask, uCurve.mul(0.2)));
    const vignette = float(1).sub(smoothstep(0.55, 1.45, length(c.mul(vec2(0.92, 1)))).mul(uCurve));
    img.mulAssign(vignette.mul(0.9).add(0.1));

    const overlay = osd.sample(curved);
    img.assign(mix(img, overlay.rgb, overlay.a));
    // 关机后收成的那个亮点过一会儿要熄掉，不能一直亮在屏幕中间
    const glow = float(1).add(float(1).sub(sy).mul(2.4)).add(uFlash.mul(0.35)).mul(smoothstep(0, 0.05, uPower));
    return img.mul(glow).mul(lit).mul(inside).add(vec3(0.018, 0.014, 0.03).mul(inside));
  });

  const screenMaterial = new THREE.MeshBasicNodeMaterial();
  screenMaterial.colorNode = crt();
  screenMaterial.mrtNode = mrt({ bloomIntensity: float(1) });

  /* ---------- 电视本体 ---------- */
  const model = buildTvModel(font, curvedScreenGeometry(), screenMaterial);
  model.ledMaterial.mrtNode = mrt({ bloomIntensity: float(1) });
  model.ledMaterial.color.set('#5dffa4');
  scene.add(model.root);
  // 屏幕玻璃上的反光。之前用的是物理透射玻璃：正对镜头时会把整间「摄影棚」的大灯映成一大团白，
  // 把画面糊掉一半。现在自己算：一扇放在左上方的柔光窗 + 侧着看时边缘的一点菲涅耳亮边，
  // 只做加法、亮度封顶；屏幕铺满视口时（uCurve = 0）完全不出现
  const glare = Fn(() => {
    const view = positionViewDirection;
    const bounce = reflect(view.negate(), normalView);
    const band = (value: any, from: number, to: number, soft: number) =>
      smoothstep(from - soft, from, value).mul(float(1).sub(smoothstep(to, to + soft, value)));
    // 窗口的位置是按电视最后停下的那个 3/4 侧面调的：两格窗影落在屏幕左上角，转动电视时会跟着滑走
    const pane = band(bounce.x, 0.08, 0.24, 0.05).add(band(bounce.x, 0.3, 0.335, 0.03).mul(0.6));
    const softbox = pane.mul(band(bounce.y, -0.06, 0.22, 0.07));
    const rim = clamp(float(1).sub(dot(normalView, view)), 0, 1);
    return softbox.mul(0.17).add(rim.mul(rim).mul(0.45)).mul(uCurve);
  });
  const glassMaterial = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  glassMaterial.colorNode = vec3(1, 0.985, 1);
  glassMaterial.opacityNode = glare();
  const screenGlass = new THREE.Mesh(model.screen.geometry, glassMaterial);
  screenGlass.position.copy(model.screen.position);
  screenGlass.position.z += 0.012;
  // 玻璃不参与点选，点到的算屏幕
  screenGlass.raycast = () => undefined;
  model.tv.add(screenGlass);
  const { tv, screen, dial, buttons, powerCap, ledMaterial, rods } = model;

  /* ---------- 后处理：只让屏幕和指示灯泛光 ---------- */
  const scenePass = pass(scene, camera, { samples: 4 });
  scenePass.setMRT(mrt({ output, bloomIntensity: float(0) }));
  const sceneColor = scenePass.getTextureNode('output');
  const bloomMask = scenePass.getTextureNode('bloomIntensity');
  const glowPass = bloom(sceneColor.mul(bloomMask), 0.45, 0.35, 0.05);
  const pipeline = new THREE.RenderPipeline(renderer);
  pipeline.outputNode = sceneColor.add(glowPass);

  /* ---------- 状态 ---------- */
  const state: TvState = { channel: 0, power: true, playing: true, seconds: 0 };
  let previous = 0;
  let powerTarget = 1;
  let powerValue = 1;
  let switchT = 1;
  let degaussT = 0;
  let flashT = 0;
  let burstT = 0;
  let autoT = 0;
  let lastSecond = -1;
  let interactive = false;
  let active = false;
  let zoom = 0;
  let settle = 0;
  let handoffSnow = 0;
  const emit = () => options.onChange({ ...state });

  // 台标只在换台后的一秒多里出现，其余时间画布是空的：内容没变就不重画、也不重新上传纹理
  let osdKey = 'unset';
  const drawOsd = () => {
    const visible = powerValue > 0.6 && flashT > 0;
    const key = visible ? `${state.channel}:${Math.min(1, flashT * 1.4).toFixed(2)}` : '';
    if (key === osdKey) return;
    osdKey = key;
    osdCtx.clearRect(0, 0, 640, 480);
    if (visible) {
      const text = `CH ${channels[state.channel].number}`;
      osdCtx.font = '150px "VT323", monospace';
      osdCtx.textAlign = 'center';
      osdCtx.textBaseline = 'alphabetic';
      osdCtx.globalAlpha = Math.min(1, flashT * 1.4);
      osdCtx.fillStyle = 'rgba(8, 18, 12, 0.75)';
      osdCtx.fillText(text, 323, 273);
      osdCtx.fillStyle = '#86ffb4';
      osdCtx.shadowColor = 'rgba(60, 255, 150, 0.65)';
      osdCtx.shadowBlur = 12;
      osdCtx.fillText(text, 320, 270);
      osdCtx.shadowBlur = 0;
      osdCtx.globalAlpha = 1;
    }
    osdTexture.needsUpdate = true;
  };

  const setChannel = (index: number, quiet = false, instant = false) => {
    const nextIndex = ((index % channels.length) + channels.length) % channels.length;
    if (nextIndex === state.channel) {
      if (!quiet) flashT = 1.2;
      return;
    }
    previous = state.channel;
    state.channel = nextIndex;
    // instant：直接切过去，不播换台的雪花过场（对齐控制台时画面正被交接的雪花盖着，或者电视根本没露面）
    switchT = instant ? 1 : 0;
    if (!quiet) flashT = 1.3;
    autoT = 0;
    emit();
  };

  const togglePower = () => {
    state.power = !state.power;
    powerTarget = state.power ? 1 : 0;
    ledMaterial.color.set(state.power ? '#5dffa4' : '#ff5f7a');
    if (state.power) {
      flashT = 1.3;
      burstT = 0.4;
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

  const degauss = () => {
    if (!state.power) return;
    degaussT = 1.7;
    rods.forEach((rod, index) => {
      rod.vel += index ? -3 : 3;
    });
  };

  /* ---------- 交互（只在运镜结束后开放） ---------- */
  const TAU = Math.PI * 2;
  const QUARTER = Math.PI / 2;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  // pointer 是指针的位置，look 是跟在它后面慢慢追的那个值：电视跟着 look 微微转头
  const pointer = new THREE.Vector2(0, 0);
  const look = new THREE.Vector2(0, 0);
  const tilt = { yaw: 0, pitch: 0, yawVel: 0, pitchVel: 0 };
  const powerKey = { depth: 0, vel: 0 };
  const dialCenter = new THREE.Vector3();
  let dialAngle = 0;
  let dialVel = 0;
  type Drag = { kind: 'tv' | 'dial'; x: number; y: number; moved: number; pointerId: number; angle: number | null };
  let drag: Drag | null = null;

  const setNdc = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    if (interactive) pointer.copy(ndc);
  };
  const pick = () => {
    raycaster.setFromCamera(ndc, camera);
    return partOf(raycaster.intersectObject(tv, true)[0]?.object ?? null);
  };
  /** 指针绕旋钮中心的角度（屏幕上逆时针为正）；离中心太近时方向不可靠，返回 null */
  const angleAroundDial = (event: PointerEvent) => {
    dial.getWorldPosition(dialCenter).project(camera);
    const rect = canvas.getBoundingClientRect();
    const dx = event.clientX - (rect.left + (dialCenter.x * 0.5 + 0.5) * rect.width);
    const dy = event.clientY - (rect.top + (-dialCenter.y * 0.5 + 0.5) * rect.height);
    return Math.hypot(dx, dy) < 7 ? null : Math.atan2(-dy, dx);
  };
  const channelAt = (angle: number) => (((Math.round(-angle / QUARTER) % 4) + 4) % 4);
  const endDrag = () => {
    if (!drag) return;
    if (canvas.hasPointerCapture(drag.pointerId)) canvas.releasePointerCapture(drag.pointerId);
    canvas.style.cursor = '';
    drag = null;
  };

  const onPointerDown = (event: PointerEvent) => {
    if (!interactive || drag) return;
    setNdc(event);
    const hit = pick();
    if (!hit) return;
    if (hit.part === 'button') {
      buttons[hit.button].vel -= 3;
      powerOn();
      setChannel(hit.button);
      return;
    }
    if (hit.part === 'power') {
      powerKey.vel -= 1.6;
      togglePower();
      return;
    }
    if (hit.part === 'screen') {
      togglePlay();
      return;
    }
    canvas.setPointerCapture(event.pointerId);
    const kind = hit.part === 'dial' ? 'dial' : 'tv';
    drag = { kind, x: event.clientX, y: event.clientY, moved: 0, pointerId: event.pointerId, angle: kind === 'dial' ? angleAroundDial(event) : null };
    canvas.style.cursor = 'grabbing';
  };

  const onPointerMove = (event: PointerEvent) => {
    setNdc(event);
    if (!interactive) return;
    if (drag) {
      if (drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      drag.moved += Math.hypot(dx, dy);
      drag.x = event.clientX;
      drag.y = event.clientY;
      if (drag.kind === 'tv') {
        tilt.yawVel += dx * 0.02;
        tilt.pitchVel += dy * 0.012;
        rods.forEach((rod) => {
          rod.vel += dx * 0.02;
        });
        return;
      }
      // 旋钮：手指绕着它转多少，它就转多少；每拧过一格就真的换一个台
      const angle = angleAroundDial(event);
      if (angle !== null) {
        if (drag.angle !== null) {
          let delta = angle - drag.angle;
          if (delta > Math.PI) delta -= TAU;
          if (delta < -Math.PI) delta += TAU;
          dialAngle += delta;
        }
        drag.angle = angle;
      }
      if (drag.moved >= 6 && channelAt(dialAngle) !== state.channel) {
        powerOn();
        setChannel(channelAt(dialAngle));
      }
      return;
    }
    const hit = pick();
    canvas.style.cursor = !hit ? '' : hit.part === 'body' ? 'grab' : 'pointer';
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    // 没怎么拖就松手 = 点了一下旋钮：换到下一个台
    if (drag.kind === 'dial' && drag.moved < 6 && event.type === 'pointerup') {
      powerOn();
      setChannel(state.channel + 1);
    }
    endDrag();
  };

  const onPointerLeave = () => {
    pointer.set(0, 0);
    if (!drag) canvas.style.cursor = '';
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);

  /* ---------- 运镜：屏幕铺满视口 → 看到整台电视 ---------- */
  const screenWorld = new THREE.Vector3();
  const screenForward = new THREE.Vector3();
  const cameraFrom = new THREE.Vector3();
  const cameraTo = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const lookTo = new THREE.Vector3(0, 0.38, 0);
  const halfTan = Math.tan(THREE.MathUtils.degToRad(15));
  let viewWidth = 1;
  let viewHeight = 1;

  const placeCamera = () => {
    const aspect = viewWidth / viewHeight;
    camera.aspect = aspect;
    const z = zoom * zoom * (3 - 2 * zoom);
    tv.updateMatrixWorld(true);
    screenWorld.copy(screen.position);
    tv.localToWorld(screenWorld);
    screenForward.set(0, 0, 1).applyQuaternion(tv.quaternion);
    // 起点：盖住视口（屏幕比视口略大一点，四周不露边）
    const visibleH0 = Math.min(SCREEN_H, SCREEN_W / aspect) * 0.94;
    cameraFrom.copy(screenWorld).addScaledVector(screenForward, visibleH0 / 2 / halfTan);
    // 整台电视连天线、再给底下的遥控条留出位置。
    // 视口接近方形时，左上角的导航会伸到天线底下：这时上面多留一截，让天线尖落在导航下面
    const crowded = 1 - smoothstepJs(1.15, 1.45, aspect);
    const needH = 7.3 + 0.7 * crowded;
    const needW = 6.9;
    const d1 = Math.max(needH / 2 / halfTan, needW / 2 / halfTan / aspect);
    cameraTo.set(0.15, 0.95 + 0.17 * crowded, d1);
    lookTo.y = 0.38 + 0.17 * crowded;
    camera.position.lerpVectors(cameraFrom, cameraTo, z);
    lookAt.lerpVectors(screenWorld, lookTo, z);
    camera.lookAt(lookAt);
    camera.updateProjectionMatrix();
    uCurve.value = z;
    // 屏幕铺满视口时泛光收着点，不然整屏都被冲白；拉远以后才像真的显像管那样发光
    glowPass.strength.value = 0.1 + 0.35 * z;
  };

  // 像素比上限 1.5；帧时间一直偏长时自动往下降（和首屏一样），最低到 1
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  const fit = (width: number, height: number) => {
    viewWidth = width;
    viewHeight = height;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    placeCamera();
  };
  const host = canvas.parentElement ?? canvas;
  fit(host.clientWidth || window.innerWidth, host.clientHeight || window.innerHeight);
  const resizeObserver = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    if (width > 0 && height > 0) fit(width, height);
  });
  resizeObserver.observe(host);

  /* ---------- 每帧 ---------- */
  let elapsed = 0;
  let screenClock = 0;
  let last = performance.now();
  const update = (dt: number) => {
    elapsed += dt;
    const reduce = options.reducedMotion;

    powerValue += (powerTarget - powerValue) * Math.min(1, dt * (powerTarget > powerValue ? 3.2 : 4.5));
    uPower.value = powerValue;

    if (switchT < 1) switchT = Math.min(1, switchT + dt / (reduce ? 0.2 : 0.6));
    burstT = Math.max(0, burstT - dt);
    const switching = 1 - switchT;
    uStatic.value = Math.min(0.95, switching * 0.7 + burstT * 1.6 + handoffSnow * 0.95) + (state.power ? 0.015 : 0);
    uRoll.value = reduce || switchT >= 1 ? 0 : (1 - (1 - switchT) ** 3) % 1;

    degaussT = Math.max(0, degaussT - dt);
    const d = degaussT / 1.7;
    uDegauss.value = reduce ? 0 : d * d * (0.65 + 0.35 * Math.sin(elapsed * 32));
    flashT = Math.max(0, flashT - dt);
    uFlash.value = Math.min(1, flashT);

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
    // 画面限频重画；关机以后屏幕是黑的，干脆不画。
    // dt 为 0 的那一下（刚被叫醒、补第一帧）一定画，免得露出旧画面
    screenClock += dt;
    if ((screenClock >= 1 / SCREEN_FPS || dt === 0) && powerValue > 0.004) {
      screenClock %= 1 / SCREEN_FPS;
      consoleRenderer.draw({
        index: state.channel,
        previous,
        switchT: smoothstepJs(0, 1, switchT),
        time: elapsed,
        playing: state.playing,
        seconds: state.seconds,
      });
      consoleTexture.needsUpdate = true;
    }
    drawOsd();

    buttons.forEach((button, index) => {
      const target = state.power && index === state.channel ? -0.07 : 0;
      button.vel += ((target - button.depth) * 160 - button.vel * 14) * dt;
      button.depth += button.vel * dt;
      button.mesh.position.z = button.baseZ + button.depth;
    });

    powerKey.vel += (-powerKey.depth * 220 - powerKey.vel * 16) * dt;
    powerKey.depth += powerKey.vel * dt;
    powerCap.position.z = Math.min(0, powerKey.depth);

    if (!drag || drag.kind !== 'dial') {
      // 弹回当前台位：走最近的那一圈（4 台跳回 1 台是往前拧一格，不是倒着拧三格）
      const base = -state.channel * QUARTER;
      const targetAngle = base + Math.round((dialAngle - base) / TAU) * TAU;
      dialVel += ((targetAngle - dialAngle) * 90 - dialVel * 12) * dt;
      dialAngle += dialVel * dt;
    } else {
      dialVel = 0;
    }
    dial.rotation.z = dialAngle;

    tilt.yawVel += (-tilt.yaw * 26 - tilt.yawVel * 5.5) * dt;
    tilt.pitchVel += (-tilt.pitch * 26 - tilt.pitchVel * 5.5) * dt;
    tilt.yaw = THREE.MathUtils.clamp(tilt.yaw + tilt.yawVel * dt, -0.6, 0.6);
    tilt.pitch = THREE.MathUtils.clamp(tilt.pitch + tilt.pitchVel * dt, -0.25, 0.25);
    const s = settle * settle * (3 - 2 * settle);
    const idle = reduce ? 0 : Math.sin(elapsed * 0.9) * 0.03 * s;
    const shake = degaussT > 0 && !reduce ? Math.sin(elapsed * 60) * 0.02 * d : 0;
    look.lerp(pointer, 1 - Math.exp(-dt * 7));
    tv.rotation.y = 0.24 * s + tilt.yaw + look.x * 0.1 * s + idle;
    tv.rotation.x = 0.03 * s + tilt.pitch - look.y * 0.05 * s;
    tv.position.y = (reduce ? 0 : Math.sin(elapsed * 1.2) * 0.05 * s) + shake;
    tv.position.x = shake;

    rods.forEach((rod) => {
      rod.vel += (-rod.angle * 40 - rod.vel * 3.2) * dt;
      rod.angle += rod.vel * dt;
      rod.pivot.rotation.z = rod.rest + rod.angle * 0.35;
    });
    placeCamera();
  };

  let frameAverage = 16;
  let lastRatioChange = performance.now();
  const loop = () => {
    const now = performance.now();
    const gap = now - last;
    const dt = Math.min(gap / 1000, 1 / 30);
    last = now;
    // 一直掉帧（平均超过 26ms）就把像素比降一档
    if (gap < 250) {
      frameAverage = frameAverage * 0.94 + gap * 0.06;
      if (frameAverage > 26 && pixelRatio > 1 && now - lastRatioChange > 1500) {
        pixelRatio = Math.max(1, pixelRatio - 0.25);
        fit(viewWidth, viewHeight);
        lastRatioChange = now;
        frameAverage = 16;
      }
    }
    update(dt);
    pipeline.render();
  };
  update(0);
  pipeline.render();
  emit();

  return {
    backend,
    setChannel: (index, quiet = false) => {
      if (!state.power && !quiet) togglePower();
      setChannel(index, quiet);
    },
    next: () => {
      if (!state.power) togglePower();
      setChannel(state.channel + 1);
    },
    prev: () => {
      if (!state.power) togglePower();
      setChannel(state.channel - 1);
    },
    togglePower,
    togglePlay,
    degauss,
    setSequence: (nextZoom, nextSettle, nextSnow = 0) => {
      // 只记下镜头位置：电视没在跑的时候它被藏着，不用渲染；setActive(true) 之后下一帧就会用上
      zoom = Math.min(Math.max(nextZoom, 0), 1);
      settle = Math.min(Math.max(nextSettle, 0), 1);
      handoffSnow = Math.min(Math.max(nextSnow, 0), 1);
    },
    sync: (index) => {
      if (!state.power) {
        // 不走开机动画：这时候画面要么没露面、要么正被交接的雪花盖着
        state.power = true;
        powerTarget = 1;
        powerValue = 1;
        ledMaterial.color.set('#5dffa4');
        emit();
      }
      setChannel(index, true, true);
    },
    setInteractive: (value) => {
      if (value === interactive) return;
      interactive = value;
      if (!value) {
        pointer.set(0, 0);
        endDrag();
      }
    },
    setActive: (value) => {
      if (value === active) return;
      active = value;
      last = performance.now();
      if (value) {
        // 先按当前镜头补一帧，免得露出来的第一帧是旧画面
        update(0);
        pipeline.render();
      }
      renderer.setAnimationLoop(value ? loop : null);
    },
    dispose: () => {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      disposeObject(scene);
      channelTextures.forEach((item) => item.dispose());
      consoleTexture.dispose();
      osdTexture.dispose();
      environment.dispose();
      pmrem.dispose();
      pipeline.dispose();
      renderer.dispose();
    },
  };
}

