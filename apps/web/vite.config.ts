import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
};

/** Dev only: serve the locally built media folder (MEDIA_DIR) under /media with range support. */
function devMedia(dir: string | undefined): Plugin {
  return {
    name: 'motivado-dev-media',
    configureServer(server) {
      if (!dir) return;
      server.middlewares.use('/media', (req, res, next) => {
        const rel = normalize(decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/')).replace(/^([/\\])+/, '');
        if (rel.startsWith('..')) return next();
        const file = join(dir, rel);
        let size: number;
        try {
          const s = statSync(file);
          if (!s.isFile()) return next();
          size = s.size;
        } catch {
          return next();
        }
        const type = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
        const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
        if (range) {
          const start = range[1] ? Number(range[1]) : 0;
          const end = range[2] ? Number(range[2]) : size - 1;
          res.writeHead(206, {
            'Content-Type': type,
            'Accept-Ranges': 'bytes',
            'Content-Range': `bytes ${start}-${end}/${size}`,
            'Content-Length': end - start + 1,
          });
          createReadStream(file, { start, end }).pipe(res);
        } else {
          res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': size });
          createReadStream(file).pipe(res);
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), devMedia(env.MEDIA_DIR)],
    build: { target: 'es2022' },
  };
});
