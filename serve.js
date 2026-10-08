import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSite } from './build.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

async function startServer() {
  // Initial build
  await buildSite();

  const server = http.createServer((req, res) => {
    let reqPath = decodeURIComponent(req.url.split('?')[0]);
    if (reqPath.endsWith('/')) {
      reqPath += 'index.html';
    }

    let filePath = path.join(DIST_DIR, reqPath);

    // If it's a directory without trailing slash, redirect with trailing slash
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      res.writeHead(301, { Location: req.url + '/' });
      res.end();
      return;
    }

    // Try filePath or filePath.html
    if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
      filePath += '.html';
    }

    // Fallback to 404
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 Not Found</h1><p><a href="/">Return to Dictionary</a></p>');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading file');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });

  server.listen(PORT, () => {
    console.log(`\n🚀 Dictionary site running at: http://localhost:${PORT}`);
    console.log(`Watching for changes in markdown and asset files...\n`);
  });

  // Watch for changes in workspace
  let rebuildTimeout = null;
  function triggerRebuild() {
    clearTimeout(rebuildTimeout);
    rebuildTimeout = setTimeout(async () => {
      console.log('🔄 Change detected. Rebuilding dictionary...');
      try {
        await buildSite();
        console.log('✨ Rebuild complete.');
      } catch (err) {
        console.error('Rebuild failed:', err);
      }
    }, 200);
  }

  // Watch directories
  const watchDirs = ['en', 'tr', 'de', 'assets'];
  for (const dir of watchDirs) {
    const fullPath = path.join(__dirname, dir);
    if (fs.existsSync(fullPath)) {
      fs.watch(fullPath, { recursive: true }, (event, filename) => {
        if (filename && !filename.startsWith('.')) {
          triggerRebuild();
        }
      });
    }
  }
}

startServer().catch(err => {
  console.error('Server error:', err);
  process.exit(1);
});
