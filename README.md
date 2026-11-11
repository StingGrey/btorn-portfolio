# BTORN

BTORN 的个人小站：把 3D 玻璃小玩具扔进磨砂玻璃瓶；往下滑玻璃会故障、裂开、被彩色点阵入侵，碎掉后露出「梦境分类」控制台，再缩进一台小电视；电视冒出满屏故障弹窗，蓝屏死机，转圈重启，最后是 ASCII 的世界。在 ASCII 页脚接着往下滑，页面自己崩掉，镜头从最后一颗粉色像素一路放大到普朗克尺度。

线上地址：https://stinggrey.github.io/btorn-portfolio/ ，本地开发时是 `http://localhost:5173/btorn-portfolio/`。

## 分支

| 分支 | 内容 |
| --- | --- |
| `main` | 现在的主页（毛玻璃方案），推送后自动部署到 GitHub Pages |
| `archive/full-site` | 整理前的完整快照：四个主页方案（痛包 `?style=itabag`、视觉小说 `?style=galge`、孔版印刷 `?style=riso`、毛玻璃）、旧的挂绳卡片、站点编辑器、WebGPU 版小电视（`archive/tv-3d/`）、抠图脚本和全部原始图片。能单独构建运行，不再更新 |

## 结构

整页是一段 2080svh 的滚动序列（位置都写在 `GlassHome.tsx` 的 `SEQ` 里，单位是舞台滚过的 svh），舞台 sticky 在视口里，三层从下到上叠着：电视（DOM）、控制台（DOM）、首屏画布（WebGPU）。同一时间最多只有首屏这一块在做 3D 渲染。

| 滚动进度 | 发生什么 |
| --- | --- |
| 0 – 500 | 首屏：先是闪屏故障（整屏跳帧、闪一下、反相、红青错位、错开的数据条）→ 撞击点上“咔、咔”地一下下崩出人字形玻璃裂纹（放射纹、环纹、分叉、毛刺；每一下都有一震，被裂纹围住的碎块啪地错开）→ 隔一段，像素才从裂缝里慢慢长出来（马赛克 → 黑底上的半调圆点 → 裂缝附近的点开始发光）→ 裂缝芯变透明，透出后面的控制台 → 玻璃一条条错开着撕走 |
| 500 – 720 | 「梦境分类」控制台铺满全屏（英文文案），每滚一段切一个分类；切换、转场和平时都会错位抽动，还有一层常驻的滚动亮带和撕裂细线 |
| 720 – 940 | 控制台化进雪花、雪花散开露出电视画面（跟着滚动走，往回滑原样倒放），镜头拉远露出整台电视，最后出现遥控条 |
| 990 – 1420 | 电视退到一边（宽屏去左边、窄屏去上面），从屏幕里一个个蹦出故障弹窗，越往后越密，九十多个，连电视也盖住；弹窗能拖、能关，频道窗口能换台 |
| 1390 – 1930 | 整层乱跳 → 蓝屏（完成度跟着滚动涨）→ 转圈重启 → 黑一下 → ASCII 开机自检一行行打出来 |
| 页脚 | ASCII：字符画 BTORN、ASCII 边框的小窗口（Heal it 是真按钮）、彩色字符画肖像；停在这里两秒多，边框底边会松掉两个字 |
| 页脚之后（2545svh） | 页脚先原样钉着，多滑一段才开始：它的字一列列掉光 → 黑屏上三处裂纹爬向粉色的 O → O 往里一收，大爆炸（整屏一闪、翻滚的火球、三圈冲击波、劈到屏幕边的裂纹、带拖尾的碎屑，画面跟着震）→ 只剩一颗粉色的 O → 镜头钻进去一路放大：像素 → 子像素 → 彩色滤光片、液晶、TFT 背板、背光 → 屏幕背后的主板 → 芯片顶盖上刻着的小女孩（通电变彩色，之后一直在蹦）→ 钻进她的黄星星（镜头跟着星星走）→ 整块裸片的平面图 → 互连层 → 逻辑门 → 晶体管 → 硅晶格 → 硅原子 → 原子里的空旷 → 原子核 → 质子 → 夸克 → 一圈圈十倍十倍缩小的刻度 → 弦 → 普朗克尺度的时空泡沫（结尾还没定，先停在这）。每个场景里有英文标注和图例（哪条是栅极线、哪个是质子……），左下角是比例尺读数和每一站一句说明；往回滑原样倒放 |

- `src/variants/glass/GlassHome.tsx`：滚动序列、三层的显隐和指针、左上角 logo 和右上角 GitHub 链接、遥控条。
- `src/variants/glass/three/heroStage.ts`：首屏。WebGPU 渲染（不支持时自动退回 WebGL2）。Rapier 刚体物理：玩具可以拖、甩、戳，扔进玻璃瓶会真的掉进去堆起来，点瓶子会摇一摇。瓶身在绘制前拷一份画面做磨砂模糊、折射和色散，所以瓶里的玩具隔着磨砂也看得见。TSL 后处理负责错位故障和点阵入侵：点阵一格 5px（窄屏 4.5px），点后面是纯黑，白、浅的格子很少出点（彩色和深色的格子照常），碎掉的地方输出透明；每帧都画，按屏幕原生的刷新率和像素比，不设上限；玩具的物理固定 60 步/秒，渲染时在两步之间插值；故障的节拍是每秒 5.5 下。
- `src/variants/glass/ConsoleGlitch.tsx`：控制台那一层的 SVG 错位滤镜（横向撕裂 + 红青通道错开），转场、切换分类和平时的小抽动都由它负责。
- `src/variants/glass/three/crack.ts`：玻璃裂纹的形状和崩裂节奏。裂纹按「事件」崩开：滚动只决定崩到第几下，每一下按时间自己跑完，往回滑时 3 倍速收回。
- `src/variants/glass/three/crackMasks.ts`：把裂纹画成给着色器用的遮罩（裂缝芯、故障范围、碎块错位）和点阵扩散遮罩。直接在 GPU 上画：每段裂纹是一个实例化的小四边形，每帧只更新每条裂纹跑到了哪；以前在 2D 画布上重画，Safari 里每帧要吃掉 14ms 主线程。
- `src/variants/glass/GlitchWindows.tsx` / `glitch-windows.css`：电视里冒出来的故障弹窗。前 11 个有内容（四个频道各一种测试图案、进度条、十六进制……），后面是四串层层叠叠的报错和满屏乱飞的小弹窗；不放任何插画。
- `src/variants/glass/CrashScreen.tsx` / `crash.css`：蓝屏、转圈重启、ASCII 开机自检，由滚动位置直接驱动（不走 React 重渲染）。
- `src/variants/glass/AsciiEnd.tsx` / `AsciiPortrait.tsx` / `ascii.ts` / `portrait.ts` / `logo.ts`：ASCII 页脚，进视口时一行一行打出来。肖像是离线抠掉背景、转好、烘焙在 `portrait.ts` 里的文字和逐字颜色（参考图是根目录的 `65c9fd500f5aba079658320c5b732f35.jpeg`，只在生成时用，不会打包），画在一块画布上，页面不加载图片；`portrait.ts` 是 `null` 时页脚只放 Logo 和小窗口。`logo.ts` 是用 Fredoka 600 的字形逐格挑形状最像的字符拼出来的 BTORN。
- `src/variants/glass/dive/`：页脚之后那一段。`DeepDive.tsx` 把页脚钉住（比一屏高时底边贴着屏幕底边），上面盖一块画布；画布和场景代码等页脚快露出来才加载。画面是一张很细的字符网格（一屏约 128 行，一格 6–9 CSS 像素高，和页脚那幅字符画差不多细）：`scenes/` 里的场景函数在 CPU 上算每一格的字、字色、底色（大多 1–5ms 一帧），`renderer.ts` 用 WebGPU（退回 WebGL2）把两张很小的数据纹理按格子贴上字形图集；开场掉下去的页脚文字是另一批实例化的小四边形，往下掉、乱换字都在顶点着色器里。时间轴、每一站的读数和说明在 `timeline.ts`：场景里写的位置都是「故事位置」，真正要滑多远由里面的 `PACE` 表决定（哪里想多停一会儿，改这张表就行）。场景里的标注、引线、图例在 `notes.ts`（格子太细，字不写在格子里，由 `DeepDive.tsx` 用 DOM 文字和细线叠在画布上），交界处的溶解和减少动效时一站一张静止画面在 `director.ts`。
- `tools/bake-chip-girl.mjs`：把 `tools/chip-girl.gif`（芯片顶盖上那个小女孩）烘焙成 `dive/chip-girl.bin`（32 帧 160×160 的调色板序号，zlib）和 `dive/chipGirl.ts`（调色板、每一帧里黄星星的位置）。换图后跑 `node tools/bake-chip-girl.mjs`；不依赖第三方包，原 GIF 不会打包。
- 顶上只有两颗毛玻璃胶囊：左上角 logo、右上角 GitHub 仓库链接。它们一起自动隐藏：往下滚收起、往上滚或者指针移到页面顶部时探出来；重启以后换成终端样式。
- `src/variants/glass/smoothScroll.ts`：滚轮滚动不和滚轮一比一（Lenis，一格只走原来的 0.55，缓着走）；`GlassHome.tsx` 的 `SLOW_ZONES` 里那几段（玻璃碎落、控制台交接、死机、开机自检）再额外放慢。触摸滚动保持原生，系统设置了减少动效时不启用。
- `src/variants/glass/three/consoleCanvas.ts`：把控制台按 4:3 重画在一张 2D 画布上，就是电视屏幕里播的画面（换台和交接时的雪花也画在这里）。
- `src/variants/glass/tv/tvSet.ts` / `tv.css`：小电视。不用 3D：机身、屏幕框、带齿纹的旋钮、键帽、天线都是 DOM + CSS，屏幕里是上面那张画布；镜头从“屏幕铺满视口”拉远到整台电视是 `.tv-rig` 上的一次 CSS 变换。外壳是静止的图层，屏幕画布（2 倍分辨率）每帧重画，不设帧率上限。按键是真的 `<button>`，旋钮可以绕着拧、每过一格换一个台，也能用方向键。之前的 WebGPU 版模型在 `archive/full-site` 分支的 `archive/tv-3d/` 里。
- `src/variants/glass/Glass.tsx`：DOM 里的物理毛玻璃（Chromium 下用 SVG 位移做边缘折射和色散，其它浏览器退回普通磨砂）。
- 调试：地址加 `?webgl` 可以强制走 WebGL2 后端。

## 保留下来的素材

| 素材 | 位置 |
| --- | --- |
| BTORN 文字 logo（粉色 O） | `src/components/Logo.tsx`，样式在 `src/styles.css` 的 `.brand` |
| 看板娘抠图（粉发天使，透明底） | `public/assets/character-orbit-cutout.webp`（近无损，1148×1800），路径常量 `assets.characterCutout`；PNG 原稿在 `archive/full-site` 分支 |
| 「梦境分类」CRT 控制台 | `src/components/DreamConsole.tsx`，中文文案在 `src/content/works.ts`；主页用它的嵌入模式和 `src/variants/glass/content.ts` 里的英文文案 |
| 四张分类插画 | `public/assets/`，路径常量在 `src/content/assets.ts` |

## 技术栈

React 19.3、Vite 8、TypeScript 7、three.js r187（WebGPU + TSL）、Rapier 0.21（WASM 刚体物理）、opentype.js 2（把字体轮廓挤出成 3D 字母）、Lenis 1.3（滚轮平滑滚动）。

## 本地运行

```bash
npm install
npm run dev
```

## 打包

```bash
npm run build
npm run preview
```

推送到 `main` 后，`.github/workflows/deploy-pages.yml` 会自动部署到 GitHub Pages（`vite.config.ts` 里的 `base` 是 `/btorn-portfolio/`）。
