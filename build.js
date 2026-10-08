import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KNOWN_LANGUAGES = ['en', 'tr', 'de', 'fr', 'es', 'it', 'la', 'grc', 'ru', 'ja', 'zh'];

marked.setOptions({
  gfm: true,
  breaks: true
});

function sanitizeSlug(term) {
  return encodeURIComponent(term.trim().replace(/\s+/g, '-'));
}

function normalizeTerm(str) {
  if (!str) return '';
  return str.trim().toLowerCase().replace(/^[_-]+|[_-]+$/g, '');
}

function parseMarkdown(rawContent, fallbackTitle) {
  let content = rawContent.replace(/\r\n/g, '\n');
  let frontmatter = {};

  if (content.startsWith('---')) {
    const endIdx = content.indexOf('\n---', 3);
    if (endIdx !== -1) {
      const yamlChunk = content.slice(3, endIdx).trim();
      content = content.slice(endIdx + 4).trimStart();
      for (const line of yamlChunk.split('\n')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          frontmatter[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim().replace(/^['"](.*)['"]$/, '$1');
        }
      }
    }
  }

  // Split multiple analyses by `---`
  const rawSections = content.split(/\n[ \t]*---[ \t]*(?:\n|$)/);
  const sections = [];
  let extractedTitle = frontmatter.title || null;

  for (const rawSec of rawSections) {
    let text = rawSec.trim();
    if (!text) continue;

    let sectionTitle = null;
    const headingMatch = text.match(/^(#{1,3})\s+(.+)$/m);
    if (headingMatch) {
      const headingText = headingMatch[2].trim();
      if (!extractedTitle && headingMatch[1] === '#') {
        extractedTitle = headingText;
        text = text.replace(/^(#{1})\s+(.+)$/m, '').trim();
      } else {
        sectionTitle = headingText;
        text = text.replace(/^(#{1,3})\s+(.+)$/m, '').trim();
      }
    }

    if (text.length > 0) {
      sections.push({
        title: sectionTitle,
        rawText: text,
        html: ''
      });
    }
  }

  return {
    title: extractedTitle || fallbackTitle,
    frontmatter,
    sections: sections.length > 0 ? sections : [{ title: null, rawText: content, html: '' }]
  };
}

function scanDictionary(rootDir) {
  const entries = [];
  const entriesByRef = new Map();
  const languagesSet = new Set();

  const dirs = fs.readdirSync(rootDir, { withFileTypes: true });

  for (const dirent of dirs) {
    if (!dirent.isDirectory()) continue;
    const lang = dirent.name.toLowerCase();
    if (!KNOWN_LANGUAGES.includes(lang) && !/^[a-z]{2,3}$/.test(lang)) continue;

    languagesSet.add(lang);
    const langDir = path.join(rootDir, dirent.name);

    for (const f of fs.readdirSync(langDir, { withFileTypes: true })) {
      if (f.isFile() && f.name.endsWith('.md')) {
        const term = f.name.replace(/\.md$/, '');
        const parsed = parseMarkdown(fs.readFileSync(path.join(langDir, f.name), 'utf-8'), term);

        const entry = {
          id: `${lang}:${term}`,
          lang,
          type: 'word',
          term,
          url: `/${lang}/${sanitizeSlug(term)}/`,
          title: parsed.title,
          sections: parsed.sections,
          outboundRefs: new Set(),
          inboundRefs: []
        };
        entries.push(entry);
        registerLookup(entriesByRef, entry);
      } else if (f.isDirectory()) {
        const subfolder = f.name.toLowerCase();
        let type = 'word';
        if (subfolder.startsWith('pattern')) type = 'pattern';
        else if (subfolder.startsWith('coinage')) type = 'coinage';
        else type = subfolder;

        const subDir = path.join(langDir, f.name);
        for (const sf of fs.readdirSync(subDir, { withFileTypes: true })) {
          if (sf.isFile() && sf.name.endsWith('.md')) {
            const term = sf.name.replace(/\.md$/, '');
            const parsed = parseMarkdown(fs.readFileSync(path.join(subDir, sf.name), 'utf-8'), term);

            const entry = {
              id: `${lang}.${type}:${term}`,
              lang,
              type,
              term,
              url: `/${lang}/${subfolder}/${sanitizeSlug(term)}/`,
              title: parsed.title,
              sections: parsed.sections,
              outboundRefs: new Set(),
              inboundRefs: []
            };
            entries.push(entry);
            registerLookup(entriesByRef, entry);
          }
        }
      }
    }
  }

  const languages = Array.from(languagesSet).sort();
  return { entries, entriesByRef, languages };
}

function registerLookup(map, entry) {
  const { lang, type, term } = entry;
  const norm = normalizeTerm(term);
  const lower = term.toLowerCase();

  map.set(`${lang}:${lower}`, entry);
  map.set(`${lang}:${norm}`, entry);
  map.set(`${lang}.${type}:${lower}`, entry);
  map.set(`${lang}.${type}:${norm}`, entry);

  if (type === 'pattern') {
    map.set(`${lang}.patterns:${lower}`, entry);
    map.set(`${lang}.patterns:${norm}`, entry);
  }
  if (type === 'coinage') {
    map.set(`${lang}.coinages:${lower}`, entry);
    map.set(`${lang}.coinages:${norm}`, entry);
  }
}

const REF_REGEX = /@([a-z]{2,3})(?:\.([a-z_-]+))?\(([^)]+)\)/g;

function processReferences(text, currentEntry, entriesByRef) {
  return text.replace(REF_REGEX, (match, lang, subType, inner) => {
    let target = inner.trim();
    let label = target;
    if (inner.includes('|')) {
      const parts = inner.split('|');
      target = parts[0].trim();
      label = parts.slice(1).join('|').trim();
    }

    const norm = normalizeTerm(target);
    const low = target.toLowerCase();
    const sub = subType ? subType.toLowerCase() : null;

    const candidates = [];
    if (sub) {
      candidates.push(`${lang}.${sub}:${low}`, `${lang}.${sub}:${norm}`);
      if (sub === 'pattern') candidates.push(`${lang}.patterns:${low}`);
      if (sub === 'patterns') candidates.push(`${lang}.pattern:${low}`);
    }
    candidates.push(`${lang}:${low}`, `${lang}:${norm}`);

    let found = null;
    for (const c of candidates) {
      if (entriesByRef.has(c)) {
        found = entriesByRef.get(c);
        break;
      }
    }

    if (found) {
      currentEntry.outboundRefs.add(found.id);
      found.inboundRefs.push({ from: currentEntry, label: currentEntry.title });
      const snippet = extractSnippet(found.sections[0]?.rawText || '', 180);
      const meta = `${found.lang}${found.type !== 'word' ? ' · ' + found.type : ''}`;
      return `<a href="${found.url}" class="ref-tag" data-preview-title="${escapeHtml(found.title)}" data-preview-meta="${escapeHtml(meta)}" data-preview-snippet="${escapeHtml(snippet)}"><span class="ref-tag-lang">${found.lang}</span><span class="ref-tag-label">${escapeHtml(label)}</span></a>`;
    } else {
      return `<span class="ref-tag ref-stub" title="not yet documented: @${lang}${sub ? '.' + sub : ''}(${target})"><span class="ref-tag-lang">${lang}</span><span class="ref-tag-label">${escapeHtml(label)}</span></span>`;
    }
  });
}

function extractSnippet(text, max = 120) {
  const plain = text
    .replace(REF_REGEX, '$3')
    .replace(/[#*_`~[\]()>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > max ? plain.slice(0, max).trim() + '...' : plain;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderLayout({ title, content, activeNav = '', languages = [] }) {
  const navLinks = languages.map(l =>
    `<a href="/${l}/" class="${activeNav === l ? 'active' : ''}">${l}</a>`
  ).join('\n        ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/assets/style.css">
</head>
<body>
  <header class="site-header">
    <div class="header-top">
      <a href="/" class="brand">hmm</a>
      <nav class="site-nav">
        ${navLinks}
      </nav>
    </div>
    <div class="search-wrapper">
      <input type="search" id="search-input" class="search-input" placeholder="search entries... (/)" autocomplete="off">
      <div id="search-dropdown" class="search-dropdown"></div>
    </div>
  </header>

  <main>
    ${content}
  </main>

  <footer class="site-footer">
    <span>hmm</span>
    <nav class="footer-nav">
      ${navLinks}
    </nav>
  </footer>

  <div id="preview-tooltip" class="preview-tooltip" aria-hidden="true"></div>
  <script src="/assets/app.js"></script>
</body>
</html>`;
}

function renderEntryPage(entry, languages) {
  const sectionsHtml = entry.sections.map((s) => {
    return `
      <section class="analysis-block">
        ${s.title ? `<h3>${escapeHtml(s.title)}</h3>` : ''}
        ${s.html}
      </section>
    `;
  }).join('\n<hr class="analysis-divider">\n');

  // Backlinks
  const uniqueBacklinks = [];
  const seen = new Set();
  for (const b of entry.inboundRefs) {
    if (!seen.has(b.from.id)) {
      seen.add(b.from.id);
      uniqueBacklinks.push(b);
    }
  }

  const backlinksHtml = uniqueBacklinks.length > 0 ? `
    <div class="backlinks-section">
      <h4>Referenced in</h4>
      <ul class="backlinks-list">
        ${uniqueBacklinks.map(b => `
          <li><a href="${b.from.url}">${escapeHtml(b.from.title)} (${b.from.lang})</a></li>
        `).join('')}
      </ul>
    </div>
  ` : '';

  return renderLayout({
    title: `${entry.title} (${entry.lang})`,
    activeNav: entry.lang,
    languages,
    content: `
      <article>
        <header class="entry-header">
          <h1 class="entry-title">${escapeHtml(entry.title)} <span class="entry-tag">${entry.lang}${entry.type !== 'word' ? ' &middot; ' + entry.type : ''}</span></h1>
        </header>
        ${sectionsHtml}
        ${backlinksHtml}
      </article>
    `
  });
}

function renderIndexGroup(title, entries, activeNav, languages) {
  const sorted = [...entries].sort((a, b) => a.title.localeCompare(b.title));

  return renderLayout({
    title,
    activeNav,
    languages,
    content: `
      <div class="index-section">
        <h2>${escapeHtml(title)}</h2>
        <ul class="entry-list">
          ${sorted.map(item => `
            <li>
              <div>
                <a href="${item.url}">${escapeHtml(item.title)}</a>
                <span class="snippet">${escapeHtml(extractSnippet(item.sections[0]?.rawText || ''))}</span>
              </div>
              <span class="meta">${item.lang}${item.type !== 'word' ? ' &middot; ' + item.type : ''}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `
  });
}

function renderHomePage(languages) {
  const langPills = languages.map(l =>
    `<a href="/${l}/" class="home-lang-link">${l}</a>`
  ).join(' &middot; ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>hmm</title>
  <link rel="stylesheet" href="/assets/style.css">
</head>
<body class="home-body">
  <main class="home-main">
    <h1 class="home-title">hmm</h1>

    <div class="search-wrapper home-search-wrapper">
      <input type="search" id="search-input" class="search-input home-search-input" placeholder="search entries..." autocomplete="off" autofocus>
      <div id="search-dropdown" class="search-dropdown"></div>
    </div>

    <nav class="home-languages">
      ${langPills}
    </nav>
  </main>

  <div id="preview-tooltip" class="preview-tooltip" aria-hidden="true"></div>
  <script src="/assets/app.js"></script>
</body>
</html>`;
}

export async function buildSite() {
  const rootDir = __dirname;
  const distDir = path.join(rootDir, 'dist');

  const { entries, entriesByRef, languages } = scanDictionary(rootDir);

  for (const entry of entries) {
    for (const section of entry.sections) {
      const processed = processReferences(section.rawText, entry, entriesByRef);
      section.html = marked.parse(processed);
    }
  }

  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  // Entry pages
  for (const entry of entries) {
    const targetDir = path.join(distDir, entry.url.replace(/^\//, ''));
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, 'index.html'), renderEntryPage(entry, languages), 'utf-8');
  }

  // Language indexes
  const entriesByLang = {};
  for (const entry of entries) {
    if (!entriesByLang[entry.lang]) entriesByLang[entry.lang] = [];
    entriesByLang[entry.lang].push(entry);
  }

  for (const [lang, list] of Object.entries(entriesByLang)) {
    const langDir = path.join(distDir, lang);
    fs.mkdirSync(langDir, { recursive: true });
    fs.writeFileSync(path.join(langDir, 'index.html'), renderIndexGroup(lang, list, lang, languages), 'utf-8');
  }

  // Homepage: centered search bar
  fs.writeFileSync(path.join(distDir, 'index.html'), renderHomePage(languages), 'utf-8');

  // Static Search index
  const searchIndex = entries.map(e => ({
    url: e.url,
    title: e.title,
    term: e.term,
    lang: e.lang,
    type: e.type,
    summary: extractSnippet(e.sections[0]?.rawText || '', 100),
    content: e.sections.map(s => s.rawText).join(' ')
  }));
  fs.writeFileSync(path.join(distDir, 'search-index.json'), JSON.stringify(searchIndex), 'utf-8');

  // Static assets
  const assetsSrc = path.join(rootDir, 'assets');
  const assetsDist = path.join(distDir, 'assets');
  if (fs.existsSync(assetsSrc)) {
    fs.cpSync(assetsSrc, assetsDist, { recursive: true });
  }

  console.log(`Generated ${entries.length} pages in ./dist with languages: ${languages.join(', ')}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildSite().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
