import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/btorn-portfolio/',
  plugins: [react()],
  build: {
    // 方案 D 按需加载两个大块：three.js 的 WebGPU 构建约 1.1 MB（gzip 约 300 KB）；
    // 首屏块里有 Rapier 物理（compat 版把 wasm 以 base64 内联），约 4.6 MB（gzip 约 1.7 MB）
    chunkSizeWarningLimit: 4800,
  },
});
