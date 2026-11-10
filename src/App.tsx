import { lazy, Suspense } from 'react';

// 主页就是毛玻璃方案。另外三个方案（痛包、视觉小说、孔版印刷）和旧组件都留在 archive/full-site 分支上。
// 页面本体按需加载，首屏的 three.js / Rapier 大块在 GlassHome 里再拆一次
const GlassHome = lazy(() => import('./variants/glass/GlassHome'));

export default function App() {
  return (
    <Suspense fallback={<div className="variant-loading" aria-hidden="true" />}>
      <GlassHome />
    </Suspense>
  );
}
