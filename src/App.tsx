import { useEffect, useState, type ComponentType } from 'react';
import { isVariantId, type VariantId } from './variants/registry';

// 方案切换条已经去掉：默认显示 D（毛玻璃），其它方案用 ?style=itabag / galge / riso 打开
const loaders: Record<VariantId, () => Promise<{ default: ComponentType }>> = {
  itabag: () => import('./variants/itabag/ItabagHome'),
  galge: () => import('./variants/galge/GalgeHome'),
  riso: () => import('./variants/riso/RisoHome'),
  glass: () => import('./variants/glass/GlassHome'),
};

function readVariant(): VariantId {
  const value = new URLSearchParams(window.location.search).get('style');
  return isVariantId(value) ? value : 'glass';
}

export default function App() {
  const [variant, setVariant] = useState<VariantId>(readVariant);
  const [Page, setPage] = useState<ComponentType | null>(null);

  useEffect(() => {
    document.documentElement.dataset.variant = variant;
    let cancelled = false;
    loaders[variant]().then((module) => {
      if (!cancelled) setPage(() => module.default);
    });
    return () => {
      cancelled = true;
    };
  }, [variant]);

  useEffect(() => {
    const onPop = () => setVariant(readVariant());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return Page ? <Page key={variant} /> : <div className="variant-loading" aria-hidden="true" />;
}
