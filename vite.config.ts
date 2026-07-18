import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/btorn-portfolio/',
  plugins: [react()],
  assetsInclude: ['**/*.glb'],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          webglUi: ['@react-three/fiber', '@react-three/drei', '@react-three/rapier', 'meshline'],
          animation: ['gsap'],
          react: ['react', 'react-dom'],
          icons: ['lucide-react'],
        },
      },
    },
  },
});
