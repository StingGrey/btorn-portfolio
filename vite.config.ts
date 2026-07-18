import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const siteContentPath = resolve(process.cwd(), 'src', 'content', 'site-content.json');
const knownSections = new Set([
  'hero',
  'profile',
  'works',
  'garden',
  'moon',
  'bits',
  'materials',
  'notes',
  'gallery',
  'about',
  'contact',
]);

function localSiteEditor(): Plugin {
  return {
    name: 'local-site-editor',
    configureServer(server) {
      server.middlewares.use('/__site-editor/save', (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405;
          response.end('Method not allowed');
          return;
        }

        const remoteAddress = request.socket.remoteAddress ?? '';
        const isLoopback = remoteAddress === '::1'
          || remoteAddress === '127.0.0.1'
          || remoteAddress === '::ffff:127.0.0.1';
        if (!isLoopback) {
          response.statusCode = 403;
          response.end('The site editor only accepts requests from this computer.');
          return;
        }

        let body = '';
        request.setEncoding('utf8');
        request.on('data', (chunk) => {
          body += chunk;
          if (body.length > 512_000) request.destroy();
        });
        request.on('end', async () => {
          try {
            const payload = JSON.parse(body) as {
              text?: Record<string, unknown>;
              sections?: { order?: unknown[]; hidden?: unknown[] };
            };
            const text = Object.fromEntries(
              Object.entries(payload.text ?? {})
                .filter(([key, value]) => key.length <= 120 && typeof value === 'string' && value.length <= 10_000),
            );
            const order = (payload.sections?.order ?? []).filter(
              (id): id is string => typeof id === 'string' && knownSections.has(id),
            );
            knownSections.forEach((id) => {
              if (!order.includes(id)) order.push(id);
            });
            const hidden = (payload.sections?.hidden ?? []).filter(
              (id): id is string => typeof id === 'string' && knownSections.has(id),
            );
            const normalized = { text, sections: { order, hidden } };
            await writeFile(siteContentPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
            response.setHeader('Content-Type', 'application/json; charset=utf-8');
            response.end(JSON.stringify({ ok: true }));
          } catch (error) {
            response.statusCode = 400;
            response.end(error instanceof Error ? error.message : 'Invalid editor payload');
          }
        });
      });
    },
    handleHotUpdate(context) {
      if (resolve(context.file) === siteContentPath) return [];
    },
  };
}

export default defineConfig({
  base: '/btorn-portfolio/',
  plugins: [react(), localSiteEditor()],
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
