# BTORN Portfolio

一个 React + Vite 做的二次元视觉作品站，主打大图叙事、React Bits 互动、GSAP 滚动动画和 Three.js/WebGL 视觉层。

## 技术栈

- React 19 + TypeScript
- Vite 6
- Three.js / React Three Fiber / Drei / Rapier
- GSAP ScrollTrigger
- lucide-react

## 本地运行

```bash
npm install
npm run dev
```

默认开发服务会监听所有网卡地址，方便在局域网设备上预览。

## 构建

```bash
npm run build
npm run preview
```

## 项目结构

```text
src/
  App.tsx                       页面主体与交互逻辑
  styles.css                    全站视觉样式
  components/
    lanyard/                    3D lanyard 物理组件
    react-bits/                 本地整理的 React Bits 组件
    splash-cursor/              鼠标水波反馈
    webgl-backdrop/             首屏 WebGL 背景
public/
  assets/                       页面实际引用的图片素材
tools/
  make_anime_cutout.py          可选的本地抠图辅助脚本
```

## 素材说明

仓库只提交页面运行需要的精选素材。本地迭代时产生的原始大图、截图、日志、Playwright 缓存和中间抠图结果已通过 `.gitignore` 排除，避免 GitHub 仓库变得太重。

`tools/make_anime_cutout.py` 会在运行时按需下载 ONNX 模型到用户目录的 `.u2net` 缓存中，模型文件不会进入仓库。
