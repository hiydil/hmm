import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Languages configuration
const KNOWN_LANGUAGES = {
  en: { name: 'English', flag: '🇬🇧', dir: 'en' },
  tr: { name: 'Türkçe', flag: '🇹🇷', dir: 'tr' },
  de: { name: 'Deutsch', flag: '🇩🇪', dir: 'de' },
  fr: { name: 'Français', flag: '🇫🇷', dir: 'fr' },
  es: { name: 'Español', flag: '🇪🇸', dir: 'es' },
  it: { name: 'Italiano', flag: '🇮🇹', dir: 'it' },
  la: { name: 'Latina', flag: '🏛️', dir: 'la' },
  grc: { name: 'Ancient Greek', flag: '🏛️', dir: 'grc' },
  ar: { name: 'العربية', flag: '🇸🇦', dir: 'ar' },
  fa: { name: 'فارسی', flag: '🇮🇷', dir: 'fa' },
  ru: { name: 'Русский', flag: '🇷🇺', dir: 'ru' },
  ja: { name: '日本語', flag: '🇯🇵', dir: 'ja' },
  zh: { name: '中文', flag: '🇨🇳', dir: 'zh' }
};

const TYPE_CONFIG = {
  word: { label: 'Word', plural: 'Words', badgeClass: 'type-word', folder: '' },
  pattern: { label: 'Pattern', plural: 'Patterns', badgeClass: 'type-pattern', folder: 'patterns' },
  coinage: { label: 'Coinage', plural: 'Coinages', badgeClass: 'type-coinage', folder: 'coinage' }
};

// Configure marked options
marked.setOptions({
  gfm: true,
  breaks: true
});

/**
 * Utility to slugify/sanitize term for URLs and clean file mapping
 */
function sanitizeSlug(term) {
  // Replace characters that might be invalid in URLs while preserving Unicode words and hyphens/underscores
  return encodeURIComponent(term.trim().replace(/\s+/g, '-'));
}

function normalizeTermLookup(str) {
  if (!str) return '';
  return str.trim().toLowerCase()
    .replace(/^[_-]+/, '') // strip leading dashes/underscores for loose matching
    .replace(/[_-]+$/, '');
}

/**
 * Parse Markdown file into frontmatter, title, and multiple analyses (separated by ---)
 */
function parseDictionaryMarkdown(rawContent, fallbackTitle) {
  let content = rawContent.replace(/\r\n/g, '\n');
  let frontmatter = {};

  // Check for YAML frontmatter at start of file
  if (content.startsWith('---')) {
    const endIdx = content.indexOf('\n---', 3);
    if (endIdx !== -1) {
      const yamlChunk = content.slice(3, endIdx).trim();
      content = content.slice(endIdx + 4).trimStart();
      // Simple YAML line parser
      for (const line of yamlChunk.split('\n')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const key = line.slice(0, colonIdx).trim();
          const val = line.slice(colonIdx + 1).trim().replace(/^['"](.*)['"]$/, '$1');
          frontmatter[key] = val;
        }
      }
    }
  }

  // Split content by divider lines: `---` on its own line
  const rawSections = content.split(/\n[ \t]*---[ \t]*(?:\n|$)/);
  const sections = [];

  let extractedTitle = frontmatter.title || null;

  for (let i = 0; i < rawSections.length; i++) {
    let sectionText = rawSections[i].trim();
    if (!sectionText) continue;

    let sectionTitle = null;

    // Check if the section starts with a heading (# or ## or ###)
    const headingMatch = sectionText.match(/^(#{1,3})\s+(.+)$/m);
    if (headingMatch) {
      const headingText = headingMatch[2].trim();
      if (!extractedTitle && headingMatch[1] === '#') {
        extractedTitle = headingText;
        // Remove primary H1 heading from first section to avoid duplicate page title
        sectionText = sectionText.replace(/^(#{1})\s+(.+)$/m, '').trim();
      } else {
        sectionTitle = headingText;
        // Strip the heading from the section text so it only appears in the card header
        sectionText = sectionText.replace(/^(#{1,3})\s+(.+)$/m, '').trim();
      }
    }

    if (sectionText.length > 0) {
      sections.push({
        index: sections.length + 1,
        title: sectionTitle,
        rawText: sectionText,
        html: '' // will be populated after reference resolution
      });
    }
  }

  const finalTitle = extractedTitle || fallbackTitle;

  return {
    title: finalTitle,
    frontmatter,
    sections: sections.length > 0 ? sections : [{ index: 1, title: null, rawText: content, html: '' }]
  };
}

/**
 * Scanner for the dictionary repository
 */
function scanDictionary(rootDir) {
  const entries = [];
  const entriesByRef = new Map(); // key: "en:word", "en.pattern:-ism", "de.coinage:halbmund"

  const dirs = fs.readdirSync(rootDir, { withFileTypes: true });

  for (const dirent of dirs) {
    if (!dirent.isDirectory()) continue;
    const langCode = dirent.name.toLowerCase();

    // Check if directory matches a language pattern (2-3 chars or defined in KNOWN_LANGUAGES)
    if (!/^[a-z]{2,3}$/.test(langCode) && !KNOWN_LANGUAGES[langCode]) {
      continue;
    }

    const langDir = path.join(rootDir, dirent.name);
    const langInfo = KNOWN_LANGUAGES[langCode] || {
      name: langCode.toUpperCase(),
      flag: '🌐',
      dir: langCode
    };

    // 1. Scan root files in langDir (regular words)
    const langFiles = fs.readdirSync(langDir, { withFileTypes: true });
    for (const f of langFiles) {
      if (f.isFile() && f.name.endsWith('.md')) {
        const term = f.name.replace(/\.md$/, '');
        const filePath = path.join(langDir, f.name);
        const rawContent = fs.readFileSync(filePath, 'utf-8');
        const parsed = parseDictionaryMarkdown(rawContent, term);

        const entry = {
          id: `${langCode}:${term}`,
          lang: langCode,
          langInfo,
          type: 'word',
          typeInfo: TYPE_CONFIG.word,
          term,
          filename: f.name,
          filePath,
          url: `/${langCode}/${sanitizeSlug(term)}/`,
          title: parsed.title,
          frontmatter: parsed.frontmatter,
          sections: parsed.sections,
          outboundRefs: new Set(),
          inboundRefs: [] // backlinks
        };

        entries.push(entry);
        registerEntryLookup(entriesByRef, entry);
      } else if (f.isDirectory()) {
        // Subfolders: e.g. patterns, coinage, or others
        const subfolder = f.name.toLowerCase();
        let typeKey = 'word';
        if (subfolder === 'patterns' || subfolder === 'pattern') typeKey = 'pattern';
        else if (subfolder === 'coinage' || subfolder === 'coinages') typeKey = 'coinage';
        else typeKey = subfolder;

        const subfolderDir = path.join(langDir, f.name);
        const subFiles = fs.readdirSync(subfolderDir, { withFileTypes: true });

        for (const sf of subFiles) {
          if (sf.isFile() && sf.name.endsWith('.md')) {
            const rawTerm = sf.name.replace(/\.md$/, '');
            // Clean display term (e.g. `_ism` can be displayed as `-ism` or `_ism`)
            const term = rawTerm;
            const sfPath = path.join(subfolderDir, sf.name);
            const rawContent = fs.readFileSync(sfPath, 'utf-8');
            const parsed = parseDictionaryMarkdown(rawContent, term);

            const typeConfig = TYPE_CONFIG[typeKey] || {
              label: typeKey.charAt(0).toUpperCase() + typeKey.slice(1),
              plural: typeKey + 's',
              badgeClass: `type-${typeKey}`,
              folder: subfolder
            };

            const entry = {
              id: `${langCode}.${typeKey}:${term}`,
              lang: langCode,
              langInfo,
              type: typeKey,
              typeInfo: typeConfig,
              term,
              filename: sf.name,
              filePath: sfPath,
              url: `/${langCode}/${subfolder}/${sanitizeSlug(term)}/`,
              title: parsed.title,
              frontmatter: parsed.frontmatter,
              sections: parsed.sections,
              outboundRefs: new Set(),
              inboundRefs: []
            };

            entries.push(entry);
            registerEntryLookup(entriesByRef, entry);
          }
        }
      }
    }
  }

  return { entries, entriesByRef };
}

/**
 * Register multiple lookup keys for an entry to handle variations:
 * e.g., @en.pattern(-ism) -> can find _ism.md, -ism.md, ism.md
 */
function registerEntryLookup(map, entry) {
  const { lang, type, term } = entry;
  const normalized = normalizeTermLookup(term);

  // Exact keys
  map.set(`${lang}:${term.toLowerCase()}`, entry);
  map.set(`${lang}:${normalized}`, entry);

  // With type (pattern, coinage, etc.)
  map.set(`${lang}.${type}:${term.toLowerCase()}`, entry);
  map.set(`${lang}.${type}:${normalized}`, entry);

  // Plural / singular synonyms for type
  if (type === 'pattern') {
    map.set(`${lang}.patterns:${term.toLowerCase()}`, entry);
    map.set(`${lang}.patterns:${normalized}`, entry);
  }
  if (type === 'coinage') {
    map.set(`${lang}.coinages:${term.toLowerCase()}`, entry);
    map.set(`${lang}.coinages:${normalized}`, entry);
  }

  // Also if someone writes @en(-ism) while it's in patterns or coinage, register loose fallback if not occupied
  if (!map.has(`${lang}:${term.toLowerCase()}`)) {
    map.set(`${lang}:${term.toLowerCase()}`, entry);
  }
}

/**
 * Resolve a reference like:
 * @en(word)
 * @en.pattern(-ism)
 * @de.coinage(Halbmund)
 */
function resolveReference(refMatch, entriesByRef) {
  // refMatch examples:
  // @en(word)
  // @en.pattern(-ism)
  // @en.pattern(-ism|the suffix)
  const fullTag = refMatch[0];
  const lang = refMatch[1].toLowerCase();
  const subType = refMatch[2] ? refMatch[2].toLowerCase() : null;
  const innerArg = refMatch[3].trim();

  let targetTerm = innerArg;
  let customLabel = null;

  if (innerArg.includes('|')) {
    const parts = innerArg.split('|');
    targetTerm = parts[0].trim();
    customLabel = parts.slice(1).join('|').trim();
  }

  const normalized = normalizeTermLookup(targetTerm);

  // Lookup candidates
  const lookupKeys = [];
  if (subType) {
    lookupKeys.push(`${lang}.${subType}:${targetTerm.toLowerCase()}`);
    lookupKeys.push(`${lang}.${subType}:${normalized}`);
    // Handle pattern <-> patterns, coinage <-> coinages
    if (subType === 'pattern') lookupKeys.push(`${lang}.patterns:${targetTerm.toLowerCase()}`);
    if (subType === 'patterns') lookupKeys.push(`${lang}.pattern:${targetTerm.toLowerCase()}`);
  }
  lookupKeys.push(`${lang}:${targetTerm.toLowerCase()}`);
  lookupKeys.push(`${lang}:${normalized}`);

  let foundEntry = null;
  for (const k of lookupKeys) {
    if (entriesByRef.has(k)) {
      foundEntry = entriesByRef.get(k);
      break;
    }
  }

  return {
    raw: fullTag,
    lang,
    subType: subType || 'word',
    targetTerm,
    displayLabel: customLabel || targetTerm,
    targetEntry: foundEntry
  };
}

/**
 * Replace all `@lang(...)` and `@lang.type(...)` references in raw text
 */
const REF_REGEX = /@([a-z]{2,3})(?:\.([a-z_-]+))?\(([^)]+)\)/g;

function processReferencesInText(text, currentEntry, entriesByRef) {
  return text.replace(REF_REGEX, (match, p1, p2, p3) => {
    const resolved = resolveReference([match, p1, p2, p3], entriesByRef);
    if (resolved.targetEntry) {
      // Record cross-reference relationship
      currentEntry.outboundRefs.add(resolved.targetEntry.id);
      resolved.targetEntry.inboundRefs.push({
        from: currentEntry,
        label: currentEntry.title || currentEntry.term
      });

      const badgeType = resolved.targetEntry.type !== 'word' ? `<span class="ref-type-tag">${resolved.targetEntry.type}</span>` : '';
      const tooltipSnippet = extractSnippet(resolved.targetEntry.sections[0]?.rawText || '');

      return `<a href="${resolved.targetEntry.url}" class="dict-ref-link dict-ref-${resolved.targetEntry.type}" data-tippy-title="${escapeHtml(resolved.targetEntry.title)}" data-tippy-snippet="${escapeHtml(tooltipSnippet)}"><span class="ref-lang-tag">${resolved.targetEntry.lang}</span>${badgeType}<span class="ref-text">${escapeHtml(resolved.displayLabel)}</span></a>`;
    } else {
      // Unresolved reference (stub / missing entry)
      const typeText = resolved.subType !== 'word' ? `.${resolved.subType}` : '';
      return `<span class="dict-ref-stub" title="Unwritten entry: @${resolved.lang}${typeText}(${resolved.targetTerm})"><span class="ref-lang-tag">${resolved.lang}</span><span class="ref-text">${escapeHtml(resolved.displayLabel)}</span><span class="ref-missing-icon" aria-label="Not yet documented">?</span></span>`;
    }
  });
}

function extractSnippet(rawText, maxLen = 160) {
  const plain = rawText
    .replace(/@([a-z]{2,3})(?:\.([a-z_-]+))?\(([^)]+)\)/g, '$3')
    .replace(/[#*_`~[\]()>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= maxLen) return plain;
  return plain.slice(0, maxLen).trim() + '...';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * HTML Layout Templates
 */
function renderLayout({ title, description, content, activeNav = '', breadcrumbs = [], searchData = null }) {
  const breadcrumbHtml = breadcrumbs.length > 0 ? `
    <nav class="breadcrumb-trail" aria-label="Breadcrumb">
      <ol>
        <li><a href="/">Home</a></li>
        ${breadcrumbs.map((b, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          return isLast
            ? `<li aria-current="page">${escapeHtml(b.label)}</li>`
            : `<li><a href="${b.url}">${escapeHtml(b.label)}</a></li>`;
        }).join('')}
      </ol>
    </nav>
  ` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | Intuitive Dictionary</title>
  <meta name="description" content="${escapeHtml(description || 'An intuitive personal dictionary documenting words, patterns, and coinages to make language concrete.')}">
  <link rel="stylesheet" href="/assets/style.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Inter:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
</head>
<body>
  <div class="site-wrapper">
    <header class="site-header">
      <div class="header-inner container">
        <div class="site-branding">
          <a href="/" class="logo-link">
            <span class="logo-mark">🪶</span>
            <div class="logo-text">
              <span class="logo-title">Lexicon</span>
              <span class="logo-subtitle">Intuitive Dictionary</span>
            </div>
          </a>
        </div>

        <div class="header-search">
          <button type="button" class="search-trigger-btn" id="searchTriggerBtn" aria-label="Open search (Press /)">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <span class="search-btn-text">Search words, patterns, coinages...</span>
            <kbd class="search-kbd">/</kbd>
          </button>
        </div>

        <nav class="site-nav">
          <a href="/en/" class="nav-item ${activeNav === 'en' ? 'active' : ''}">
            <span class="nav-flag">🇬🇧</span> English
          </a>
          <a href="/tr/" class="nav-item ${activeNav === 'tr' ? 'active' : ''}">
            <span class="nav-flag">🇹🇷</span> Türkçe
          </a>
          <a href="/de/" class="nav-item ${activeNav === 'de' ? 'active' : ''}">
            <span class="nav-flag">🇩🇪</span> Deutsch
          </a>
          <div class="nav-divider"></div>
          <a href="/patterns/" class="nav-item ${activeNav === 'patterns' ? 'active' : ''}">Patterns</a>
          <a href="/coinage/" class="nav-item ${activeNav === 'coinage' ? 'active' : ''}">Coinage</a>
          <button type="button" class="theme-toggle-btn" id="themeToggleBtn" aria-label="Toggle dark/light theme" title="Toggle dark/light mode">
            <span class="theme-icon light-icon">☀️</span>
            <span class="theme-icon dark-icon">🌙</span>
          </button>
        </nav>
      </div>
    </header>

    <main class="main-content container">
      ${breadcrumbHtml}
      ${content}
    </main>

    <footer class="site-footer">
      <div class="container footer-inner">
        <div class="footer-left">
          <p class="footer-note">A living, intuitive lexicon designed to ground abstract language into imagination.</p>
        </div>
        <div class="footer-right">
          <a href="/search/">Full Search</a> &bull;
          <a href="/patterns/">All Patterns</a> &bull;
          <a href="/coinage/">All Coinages</a> &bull;
          <button type="button" id="randomEntryBtn" class="footer-random-btn">🎲 Surprise Entry</button>
        </div>
      </div>
    </footer>
  </div>

  <!-- Interactive Search Modal -->
  <div class="search-modal-backdrop" id="searchModal" aria-hidden="true">
    <div class="search-modal-dialog">
      <div class="search-modal-header">
        <svg class="search-input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input type="search" id="searchInput" class="search-modal-input" placeholder="Type a word, suffix, concept, or language..." autocomplete="off" spellcheck="false">
        <kbd class="modal-close-kbd" id="searchCloseBtn">ESC</kbd>
      </div>
      <div class="search-filter-bar">
        <button class="filter-pill active" data-filter="all">All</button>
        <button class="filter-pill" data-filter="en">🇬🇧 English</button>
        <button class="filter-pill" data-filter="tr">🇹🇷 Türkçe</button>
        <button class="filter-pill" data-filter="de">🇩🇪 Deutsch</button>
        <div class="filter-sep"></div>
        <button class="filter-pill" data-filter-type="word">Words</button>
        <button class="filter-pill" data-filter-type="pattern">Patterns</button>
        <button class="filter-pill" data-filter-type="coinage">Coinages</button>
      </div>
      <div class="search-modal-body" id="searchResultsContainer">
        <div class="search-empty-state">
          <p>Start typing to search dictionary entries across all languages...</p>
          <div class="search-shortcuts-hint">
            <span>Use <kbd>↑</kbd> <kbd>↓</kbd> to navigate</span>
            <span><kbd>Enter</kbd> to select</span>
            <span><kbd>ESC</kbd> to close</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div id="hoverTooltip" class="dict-hover-tooltip" aria-hidden="true"></div>

  <script src="/assets/app.js"></script>
</body>
</html>`;
}

/**
 * Entry Page Renderer (supports multiple analyses separated by ---)
 */
function renderEntryPage(entry) {
  const { langInfo, typeInfo } = entry;

  // Deduplicate inbound backlinks
  const uniqueBacklinks = [];
  const seenBacklinks = new Set();
  for (const b of entry.inboundRefs) {
    if (!seenBacklinks.has(b.from.id)) {
      seenBacklinks.add(b.from.id);
      uniqueBacklinks.push(b);
    }
  }

  const sectionsHtml = entry.sections.map((section, idx) => {
    const isSingleSection = entry.sections.length === 1;
    const sectionHeading = section.title
      ? `<h3 class="analysis-heading">${escapeHtml(section.title)}</h3>`
      : (!isSingleSection ? `<h3 class="analysis-heading">Analysis ${idx + 1}</h3>` : '');

    return `
      <section class="analysis-card ${!isSingleSection ? 'multi-analysis' : ''}">
        ${sectionHeading}
        <div class="analysis-prose">
          ${section.html}
        </div>
      </section>
    `;
  }).join('\n');

  const backlinksHtml = uniqueBacklinks.length > 0 ? `
    <div class="entry-backlinks-panel">
      <h3 class="backlinks-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
        Referenced In (${uniqueBacklinks.length})
      </h3>
      <ul class="backlinks-list">
        ${uniqueBacklinks.map(b => `
          <li>
            <a href="${b.from.url}" class="backlink-chip">
              <span class="ref-lang-tag">${b.from.lang}</span>
              ${b.from.type !== 'word' ? `<span class="ref-type-tag">${b.from.type}</span>` : ''}
              <span class="backlink-name">${escapeHtml(b.from.title || b.from.term)}</span>
            </a>
          </li>
        `).join('')}
      </ul>
    </div>
  ` : '';

  const metaHtml = `
    <div class="entry-header">
      <div class="entry-meta-badges">
        <a href="/${entry.lang}/" class="meta-badge badge-lang" title="${entry.langInfo.name}">
          <span class="badge-flag">${entry.langInfo.flag}</span> ${entry.langInfo.name}
        </a>
        <a href="/${entry.lang}/${entry.typeInfo.folder ? entry.typeInfo.folder + '/' : ''}" class="meta-badge ${entry.typeInfo.badgeClass}">
          ${entry.typeInfo.label}
        </a>
        ${entry.sections.length > 1 ? `<span class="meta-badge badge-analyses">${entry.sections.length} Analyses</span>` : ''}
      </div>
      <h1 class="entry-word-title">${escapeHtml(entry.title || entry.term)}</h1>
      ${entry.title !== entry.term ? `<div class="entry-word-subtitle">Term: <code>${escapeHtml(entry.term)}</code></div>` : ''}
    </div>
  `;

  const copyRefBtn = `
    <div class="entry-actions-bar">
      <button type="button" class="copy-ref-btn" data-ref="@${entry.lang}${entry.type !== 'word' ? '.' + entry.type : ''}(${entry.term})" title="Copy reference syntax">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        <span>Copy reference: <code>@${entry.lang}${entry.type !== 'word' ? '.' + entry.type : ''}(${entry.term})</code></span>
      </button>
    </div>
  `;

  return renderLayout({
    title: `${entry.title || entry.term} (${entry.langInfo.name})`,
    description: extractSnippet(entry.sections[0]?.rawText || ''),
    activeNav: entry.lang,
    breadcrumbs: [
      { label: entry.langInfo.name, url: `/${entry.lang}/` },
      ...(entry.type !== 'word' ? [{ label: entry.typeInfo.plural, url: `/${entry.lang}/${entry.typeInfo.folder}/` }] : []),
      { label: entry.title || entry.term, url: entry.url }
    ],
    content: `
      <article class="entry-article">
        ${metaHtml}
        ${copyRefBtn}
        <div class="entry-sections-container">
          ${sectionsHtml}
        </div>
        ${backlinksHtml}
      </article>
    `
  });
}

/**
 * Language Index Page Renderer
 */
function renderLanguageIndex(langCode, langEntries, allEntries) {
  const langInfo = KNOWN_LANGUAGES[langCode] || { name: langCode.toUpperCase(), flag: '🌐' };

  const words = langEntries.filter(e => e.type === 'word').sort((a, b) => a.term.localeCompare(b.term));
  const patterns = langEntries.filter(e => e.type === 'pattern').sort((a, b) => a.term.localeCompare(b.term));
  const coinages = langEntries.filter(e => e.type === 'coinage').sort((a, b) => a.term.localeCompare(b.term));

  function renderGroupCards(items, emptyMsg) {
    if (items.length === 0) {
      return `<p class="empty-group-text">${emptyMsg}</p>`;
    }
    return `
      <div class="lexicon-grid">
        ${items.map(item => `
          <a href="${item.url}" class="lexicon-card">
            <div class="card-header">
              <span class="card-title">${escapeHtml(item.title || item.term)}</span>
              <span class="card-type-badge ${item.typeInfo.badgeClass}">${item.typeInfo.label}</span>
            </div>
            <p class="card-snippet">${escapeHtml(extractSnippet(item.sections[0]?.rawText || '', 120))}</p>
            <div class="card-footer">
              ${item.sections.length > 1 ? `<span class="card-pill">${item.sections.length} analyses</span>` : ''}
              ${item.inboundRefs.length > 0 ? `<span class="card-pill">${item.inboundRefs.length} references</span>` : ''}
            </div>
          </a>
        `).join('')}
      </div>
    `;
  }

  return renderLayout({
    title: `${langInfo.name} Dictionary`,
    description: `Browse words, grammatical patterns, and original coinages in ${langInfo.name}.`,
    activeNav: langCode,
    breadcrumbs: [
      { label: langInfo.name, url: `/${langCode}/` }
    ],
    content: `
      <div class="lang-overview-header">
        <div class="lang-title-row">
          <span class="huge-flag">${langInfo.flag}</span>
          <div>
            <h1 class="page-title">${langInfo.name} Lexicon</h1>
            <p class="page-lead">Documenting intuitive explanations, structural patterns, and personal coinages in ${langInfo.name}.</p>
          </div>
        </div>
        <div class="stats-pills">
          <span class="stat-badge"><strong>${words.length}</strong> Words</span>
          <span class="stat-badge"><strong>${patterns.length}</strong> Patterns</span>
          <span class="stat-badge"><strong>${coinages.length}</strong> Coinages</span>
        </div>
      </div>

      <div class="section-block">
        <div class="section-title-bar">
          <h2>Standard Words (${words.length})</h2>
        </div>
        ${renderGroupCards(words, `No standard words documented yet in ${langInfo.name}. Add markdown files to <code>${langCode}/word.md</code>.`)}
      </div>

      <div class="section-block">
        <div class="section-title-bar">
          <h2>Patterns & Affixes (${patterns.length})</h2>
          ${patterns.length > 0 ? `<a href="/${langCode}/patterns/" class="section-link">View all patterns &rarr;</a>` : ''}
        </div>
        ${renderGroupCards(patterns, `No language patterns documented yet. Add markdown files to <code>${langCode}/patterns/</code>.`)}
      </div>

      <div class="section-block">
        <div class="section-title-bar">
          <h2>Original Coinage (${coinages.length})</h2>
          ${coinages.length > 0 ? `<a href="/${langCode}/coinage/" class="section-link">View all coinages &rarr;</a>` : ''}
        </div>
        ${renderGroupCards(coinages, `No coined words yet. Add your created words to <code>${langCode}/coinage/</code>.`)}
      </div>
    `
  });
}

/**
 * Category Archive Renderer (e.g. /patterns/ or /coinage/)
 */
function renderCategoryArchive({ categoryKey, title, description, items, activeNav }) {
  const sorted = [...items].sort((a, b) => a.term.localeCompare(b.term));

  return renderLayout({
    title,
    description,
    activeNav,
    breadcrumbs: [
      { label: title, url: `/${categoryKey}/` }
    ],
    content: `
      <div class="page-header">
        <h1 class="page-title">${escapeHtml(title)}</h1>
        <p class="page-lead">${escapeHtml(description)}</p>
      </div>

      <div class="lexicon-grid">
        ${sorted.map(item => `
          <a href="${item.url}" class="lexicon-card">
            <div class="card-header">
              <span class="card-title">${escapeHtml(item.title || item.term)}</span>
              <span class="card-lang-badge">${item.langInfo.flag} ${item.lang.toUpperCase()}</span>
            </div>
            <p class="card-snippet">${escapeHtml(extractSnippet(item.sections[0]?.rawText || '', 130))}</p>
            <div class="card-footer">
              <span class="card-pill">${item.typeInfo.label}</span>
              ${item.inboundRefs.length > 0 ? `<span class="card-pill">${item.inboundRefs.length} mentions</span>` : ''}
            </div>
          </a>
        `).join('')}
      </div>
    `
  });
}

/**
 * Home Page Renderer
 */
function renderHomePage(entries) {
  const words = entries.filter(e => e.type === 'word');
  const patterns = entries.filter(e => e.type === 'pattern');
  const coinages = entries.filter(e => e.type === 'coinage');

  // Group by language
  const byLang = {};
  for (const e of entries) {
    if (!byLang[e.lang]) byLang[e.lang] = [];
    byLang[e.lang].push(e);
  }

  return renderLayout({
    title: 'Intuitive Lexicon & Personal Dictionary',
    description: 'A personal markdown-driven dictionary documenting words, recurring patterns, and coinages to make language concrete.',
    activeNav: 'home',
    content: `
      <section class="hero-section">
        <h1 class="hero-title">Language Made Concrete.</h1>
        <p class="hero-lead">
          A living, personal lexicon exploring the intuitive mechanics of thought. Grounding abstract words into sensory imagination, dissecting morphological patterns, and archiving original coinages.
        </p>

        <div class="hero-search-wrapper">
          <div class="hero-search-box" onclick="document.getElementById('searchTriggerBtn').click()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <span class="hero-search-placeholder">Search across all languages, patterns, and coinages...</span>
            <kbd>/</kbd>
          </div>
        </div>

        <div class="hero-stats">
          <div class="stat-card">
            <span class="stat-number">${words.length}</span>
            <span class="stat-label">Words</span>
          </div>
          <div class="stat-card">
            <span class="stat-number">${patterns.length}</span>
            <span class="stat-label">Patterns</span>
          </div>
          <div class="stat-card">
            <span class="stat-number">${coinages.length}</span>
            <span class="stat-label">Coinages</span>
          </div>
          <div class="stat-card">
            <span class="stat-number">${Object.keys(byLang).length}</span>
            <span class="stat-label">Languages</span>
          </div>
        </div>
      </section>

      <section class="languages-section">
        <h2 class="section-heading">Browse by Language</h2>
        <div class="language-cards-grid">
          ${Object.keys(byLang).map(langKey => {
            const langInfo = KNOWN_LANGUAGES[langKey] || { name: langKey.toUpperCase(), flag: '🌐' };
            const langItems = byLang[langKey];
            const wCount = langItems.filter(i => i.type === 'word').length;
            const pCount = langItems.filter(i => i.type === 'pattern').length;
            const cCount = langItems.filter(i => i.type === 'coinage').length;

            return `
              <a href="/${langKey}/" class="language-card">
                <div class="lang-card-top">
                  <span class="lang-card-flag">${langInfo.flag}</span>
                  <h3 class="lang-card-name">${langInfo.name}</h3>
                </div>
                <div class="lang-card-counts">
                  <span>${wCount} words</span> &bull;
                  <span>${pCount} patterns</span> &bull;
                  <span>${cCount} coinages</span>
                </div>
              </a>
            `;
          }).join('')}
        </div>
      </section>

      <section class="recent-entries-section">
        <div class="section-title-bar">
          <h2 class="section-heading">Recently Documented Entries</h2>
          <a href="/search/" class="section-link">Explore all entries &rarr;</a>
        </div>
        <div class="lexicon-grid">
          ${entries.slice(0, 9).map(item => `
            <a href="${item.url}" class="lexicon-card">
              <div class="card-header">
                <span class="card-title">${escapeHtml(item.title || item.term)}</span>
                <span class="card-lang-badge">${item.langInfo.flag} ${item.lang.toUpperCase()}</span>
              </div>
              <p class="card-snippet">${escapeHtml(extractSnippet(item.sections[0]?.rawText || '', 130))}</p>
              <div class="card-footer">
                <span class="card-type-badge ${item.typeInfo.badgeClass}">${item.typeInfo.label}</span>
                ${item.sections.length > 1 ? `<span class="card-pill">${item.sections.length} analyses</span>` : ''}
              </div>
            </a>
          `).join('')}
        </div>
      </section>
    `
  });
}

/**
 * Dedicated Full Search Page Renderer
 */
function renderSearchPage() {
  return renderLayout({
    title: 'Search & Explore Lexicon',
    description: 'Instant full-text static search across all words, patterns, and coinages.',
    activeNav: 'search',
    breadcrumbs: [
      { label: 'Search', url: '/search/' }
    ],
    content: `
      <div class="search-page-container">
        <h1 class="page-title">Search Lexicon</h1>
        <p class="page-lead">Type any word, morpheme, language pattern, or concept.</p>

        <div class="search-page-box">
          <input type="search" id="pageSearchInput" class="search-page-input" placeholder="Search entries, suffixes, coinages, or ideas..." autofocus>
        </div>

        <div class="search-filter-bar in-page-filters">
          <button class="filter-pill active" data-filter="all">All</button>
          <button class="filter-pill" data-filter="en">🇬🇧 English</button>
          <button class="filter-pill" data-filter="tr">🇹🇷 Türkçe</button>
          <button class="filter-pill" data-filter="de">🇩🇪 Deutsch</button>
          <div class="filter-sep"></div>
          <button class="filter-pill" data-filter-type="word">Words</button>
          <button class="filter-pill" data-filter-type="pattern">Patterns</button>
          <button class="filter-pill" data-filter-type="coinage">Coinages</button>
        </div>

        <div id="pageSearchResults" class="search-page-results-grid">
          <!-- Populated by JavaScript -->
        </div>
      </div>
    `
  });
}

/**
 * Build Execution
 */
export async function buildSite() {
  const rootDir = __dirname;
  const distDir = path.join(rootDir, 'dist');

  console.log('📖 Scanning dictionary structure...');
  const { entries, entriesByRef } = scanDictionary(rootDir);
  console.log(`✨ Found ${entries.length} entries across languages.`);

  // 1. Process cross-references in every entry's sections
  for (const entry of entries) {
    for (const section of entry.sections) {
      // First resolve references in raw text
      const processedText = processReferencesInText(section.rawText, entry, entriesByRef);
      // Then render markdown to HTML
      section.html = marked.parse(processedText);
    }
  }

  // 2. Prepare dist directory
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  // 3. Write individual entry pages
  for (const entry of entries) {
    const pageHtml = renderEntryPage(entry);
    const targetDir = path.join(distDir, entry.url.replace(/^\//, ''));
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, 'index.html'), pageHtml, 'utf-8');
  }

  // 4. Group entries by language
  const entriesByLang = {};
  for (const entry of entries) {
    if (!entriesByLang[entry.lang]) entriesByLang[entry.lang] = [];
    entriesByLang[entry.lang].push(entry);
  }

  // 5. Generate Language Index pages: /en/, /tr/, /de/, etc.
  for (const [langCode, langEntries] of Object.entries(entriesByLang)) {
    const langPageHtml = renderLanguageIndex(langCode, langEntries, entries);
    const langDir = path.join(distDir, langCode);
    fs.mkdirSync(langDir, { recursive: true });
    fs.writeFileSync(path.join(langDir, 'index.html'), langPageHtml, 'utf-8');

    // Language sub-archives: /en/patterns/, /en/coinage/
    const langPatterns = langEntries.filter(e => e.type === 'pattern');
    if (langPatterns.length > 0) {
      const pDir = path.join(langDir, 'patterns');
      fs.mkdirSync(pDir, { recursive: true });
      fs.writeFileSync(path.join(pDir, 'index.html'), renderCategoryArchive({
        categoryKey: `${langCode}/patterns`,
        title: `${KNOWN_LANGUAGES[langCode]?.name || langCode} Patterns`,
        description: `Language patterns, affixes, and recurring morphological structures in ${KNOWN_LANGUAGES[langCode]?.name || langCode}.`,
        items: langPatterns,
        activeNav: langCode
      }), 'utf-8');
    }

    const langCoinages = langEntries.filter(e => e.type === 'coinage');
    if (langCoinages.length > 0) {
      const cDir = path.join(langDir, 'coinage');
      fs.mkdirSync(cDir, { recursive: true });
      fs.writeFileSync(path.join(cDir, 'index.html'), renderCategoryArchive({
        categoryKey: `${langCode}/coinage`,
        title: `${KNOWN_LANGUAGES[langCode]?.name || langCode} Coinages`,
        description: `Personal coinages and original terms created in ${KNOWN_LANGUAGES[langCode]?.name || langCode}.`,
        items: langCoinages,
        activeNav: langCode
      }), 'utf-8');
    }
  }

  // 6. Global Category archives: /patterns/ and /coinage/
  const allPatterns = entries.filter(e => e.type === 'pattern');
  const allCoinages = entries.filter(e => e.type === 'coinage');

  const globalPatternsDir = path.join(distDir, 'patterns');
  fs.mkdirSync(globalPatternsDir, { recursive: true });
  fs.writeFileSync(path.join(globalPatternsDir, 'index.html'), renderCategoryArchive({
    categoryKey: 'patterns',
    title: 'All Language Patterns & Morphemes',
    description: 'Documented grammatical affixes, morphological rules, and observed language phenomena across all languages.',
    items: allPatterns,
    activeNav: 'patterns'
  }), 'utf-8');

  const globalCoinageDir = path.join(distDir, 'coinage');
  fs.mkdirSync(globalCoinageDir, { recursive: true });
  fs.writeFileSync(path.join(globalCoinageDir, 'index.html'), renderCategoryArchive({
    categoryKey: 'coinage',
    title: 'All Original Coinages',
    description: 'Personal neologisms and coined words across all languages.',
    items: allCoinages,
    activeNav: 'coinage'
  }), 'utf-8');

  // 7. Homepage
  const homeHtml = renderHomePage(entries);
  fs.writeFileSync(path.join(distDir, 'index.html'), homeHtml, 'utf-8');

  // 8. Search Page
  const searchDir = path.join(distDir, 'search');
  fs.mkdirSync(searchDir, { recursive: true });
  fs.writeFileSync(path.join(searchDir, 'index.html'), renderSearchPage(), 'utf-8');

  // 9. Static Search Index (JSON)
  const searchIndex = entries.map(e => ({
    id: e.id,
    url: e.url,
    title: e.title || e.term,
    term: e.term,
    lang: e.lang,
    langName: e.langInfo.name,
    flag: e.langInfo.flag,
    type: e.type,
    typeLabel: e.typeInfo.label,
    sectionsCount: e.sections.length,
    summary: extractSnippet(e.sections[0]?.rawText || '', 160),
    content: e.sections.map(s => s.rawText).join(' ')
  }));

  fs.writeFileSync(path.join(distDir, 'search-index.json'), JSON.stringify(searchIndex), 'utf-8');

  // 10. Copy static assets (CSS, JS)
  const assetsSrc = path.join(rootDir, 'assets');
  const assetsDist = path.join(distDir, 'assets');
  if (fs.existsSync(assetsSrc)) {
    fs.cpSync(assetsSrc, assetsDist, { recursive: true });
  }

  // 11. Netlify _redirects or 404
  fs.writeFileSync(path.join(distDir, '_redirects'), `
# Netlify redirects file
/* /404.html 404
`.trim(), 'utf-8');

  console.log(`✅ Build successful! Generated ${entries.length} pages and static search index in ./dist`);
}

// Auto-run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildSite().catch(err => {
    console.error('Build error:', err);
    process.exit(1);
  });
}
