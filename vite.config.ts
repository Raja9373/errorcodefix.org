import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

const rootDir = import.meta.dirname;

export default defineConfig(() => {
  return {
    optimizeDeps: {
      entries: [],
      noDiscovery: true,
    },
    plugins: [
      {
        name: 'serve-large-static-index-directly',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const rawUrl = req.url || '/';
            const urlPath = rawUrl.split('?')[0];

            // Let Vite internal endpoints & source assets pass through untouched
            if (
              urlPath.startsWith('/@') ||
              urlPath.startsWith('/__') ||
              urlPath.startsWith('/node_modules/') ||
              urlPath.startsWith('/src/')
            ) {
              return next();
            }

            // Serve XML sitemaps and robots.txt directly from root with proper headers
            if (/^\/(sitemap|sitemap-index|sitemap-\d+)\.xml$/.test(urlPath)) {
              const xmlFile = path.join(rootDir, urlPath.slice(1));
              if (fs.existsSync(xmlFile)) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/xml; charset=utf-8');
                fs.createReadStream(xmlFile).pipe(res);
                return;
              }
            }

            if (urlPath === '/robots.txt') {
              const robotsFile = path.join(rootDir, 'robots.txt');
              if (fs.existsSync(robotsFile)) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                fs.createReadStream(robotsFile).pipe(res);
                return;
              }
            }

            // Let static files with extensions (favicon, png, ico, svg, css, js, etc.) fall through to Vite static server
            if (/\.[a-z0-9]+$/i.test(urlPath) && urlPath !== '/index.html') {
              return next();
            }

            // Stream the standalone 28MB index.html directly so Vite dev pre-warming never OOMs parsing it
            const indexPath = path.join(rootDir, 'index.html');
            if (fs.existsSync(indexPath)) {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              fs.createReadStream(indexPath).pipe(res);
              return;
            }
            next();
          });
        },
      },
      react(),
      tailwindcss(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(rootDir, 'dist');
          const srcAssets = path.resolve(rootDir, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
