import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
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
            const acceptEnc = String(req.headers['accept-encoding'] || '');
            const supportsGzip = acceptEnc.includes('gzip');

            // Let Vite internal endpoints & source assets pass through untouched
            if (
              urlPath.startsWith('/@') ||
              urlPath.startsWith('/__') ||
              urlPath.startsWith('/node_modules/') ||
              urlPath.startsWith('/src/')
            ) {
              return next();
            }

            // Serve lazy-loaded /assets/* bundles with 7-day cache & gzip compression
            if (urlPath.startsWith('/assets/')) {
              const relPath = urlPath.replace(/^\/+/, '');
              const targetFile = path.join(rootDir, relPath);
              if (fs.existsSync(targetFile) && fs.statSync(targetFile).isFile()) {
                const ext = path.extname(targetFile).toLowerCase();
                const contentType =
                  ext === '.js'
                    ? 'application/javascript; charset=utf-8'
                    : ext === '.css'
                      ? 'text/css; charset=utf-8'
                      : 'application/octet-stream';
                res.statusCode = 200;
                res.setHeader('Content-Type', contentType);
                res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=604800, immutable');
                res.setHeader('Vary', 'Accept-Encoding');
                const gzFile = targetFile + '.gz';
                if (supportsGzip && fs.existsSync(gzFile)) {
                  res.setHeader('Content-Encoding', 'gzip');
                  fs.createReadStream(gzFile).pipe(res);
                  return;
                }
                if (supportsGzip) {
                  res.setHeader('Content-Encoding', 'gzip');
                  fs.createReadStream(targetFile).pipe(zlib.createGzip()).pipe(res);
                  return;
                }
                fs.createReadStream(targetFile).pipe(res);
                return;
              }
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

            // Stream the fast minified index.html with 7-day caching + gzip compression
            const indexPath = path.join(rootDir, 'index.html');
            if (fs.existsSync(indexPath)) {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400');
              res.setHeader('Vary', 'Accept-Encoding');
              if (supportsGzip) {
                res.setHeader('Content-Encoding', 'gzip');
                fs.createReadStream(indexPath).pipe(zlib.createGzip()).pipe(res);
                return;
              }
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
