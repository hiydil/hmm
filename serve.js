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
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sanitizeRelativePath(userPath) {
  if (!userPath) return null;
  const normalized = path.normalize(userPath).replace(/^(\.\.[\/\\])+/, '');
  const full = path.join(__dirname, normalized);
  // Ensure path doesn't escape project root
  if (!full.startsWith(__dirname)) return null;
  return normalized;
}

async function startServer() {
  // Build with local dev mode enabled
  console.log('🛠️ Building dictionary in local development mode...');
  await buildSite({ isDev: true });

  const server = http.createServer(async (req, res) => {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const pathname = decodeURIComponent(urlObj.pathname);

    // --- Dev API: Read Raw File ---
    if (pathname === '/api/raw' && req.method === 'GET') {
      const relPath = sanitizeRelativePath(urlObj.searchParams.get('filepath'));
      if (!relPath) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        return res.end('Invalid filepath');
      }

      const fullPath = path.join(__dirname, relPath);
      if (!fs.existsSync(fullPath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('File not found');
      }

      const content = fs.readFileSync(fullPath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(content);
    }

    // --- Dev API: Save File ---
    if (pathname === '/api/save' && req.method === 'POST') {
      try {
        const data = await readRequestBody(req);
        const relPath = sanitizeRelativePath(data.filepath);
        if (!relPath || typeof data.content !== 'string') {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          return res.end('Invalid save payload');
        }

        const fullPath = path.join(__dirname, relPath);
        fs.writeFileSync(fullPath, data.content, 'utf-8');
        console.log(`💾 Saved ${relPath} from in-browser editor.`);

        // Rebuild site immediately
        await buildSite({ isDev: true });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error('Error saving file:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('Server error saving file');
      }
    }

    // --- Dev API: Create New Entry ---
    if (pathname === '/api/create' && req.method === 'POST') {
      try {
        const data = await readRequestBody(req);
        const lang = (data.lang || '').trim().toLowerCase();
        const type = (data.type || 'word').trim().toLowerCase();
        const term = (data.term || '').trim();

        if (!lang || !term) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          return res.end('Language and term required');
        }

        let targetDir = path.join(__dirname, lang);
        let subUrl = '';
        if (type === 'pattern') {
          targetDir = path.join(targetDir, 'patterns');
          subUrl = 'patterns/';
        } else if (type === 'coinage') {
          targetDir = path.join(targetDir, 'coinage');
          subUrl = 'coinage/';
        }

        fs.mkdirSync(targetDir, { recursive: true });

        const safeFilename = `${term}.md`;
        const fullPath = path.join(targetDir, safeFilename);

        if (!fs.existsSync(fullPath)) {
          const initialContent = `# ${term}

Write your intuitive explanation here...

---

### Additional Perspective
Explore connections to other words or patterns...
`;
          fs.writeFileSync(fullPath, initialContent, 'utf-8');
          console.log(`✨ Created new entry at ${lang}/${subUrl}${safeFilename}`);
        }

        await buildSite({ isDev: true });

        const newUrl = `/${lang}/${subUrl}${encodeURIComponent(term)}/`;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, url: newUrl }));
      } catch (err) {
        console.error('Error creating entry:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('Server error creating entry');
      }
    }

    // --- Static File Server ---
    let reqPath = pathname;
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

    if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
      filePath += '.html';
    }

    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 Not Found</h1><p><a href="/">Return to hmm</a></p>');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, fileData) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading file');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(fileData);
    });
  });

  server.listen(PORT, () => {
    console.log(`\n🍂 hmm running locally with in-browser editor at: http://localhost:${PORT}`);
    console.log(`✨ Press 'e' on any entry page to edit directly in your browser!`);
    console.log(`✨ Press 'n' to create a new entry.\n`);
  });

  // Watch for external file changes in markdown directories
  let rebuildTimeout = null;
  function triggerRebuild() {
    clearTimeout(rebuildTimeout);
    rebuildTimeout = setTimeout(async () => {
      console.log('🔄 File change detected. Rebuilding dictionary...');
      try {
        await buildSite({ isDev: true });
        console.log('✨ Rebuild complete.');
      } catch (err) {
        console.error('Rebuild failed:', err);
      }
    }, 250);
  }

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
