/**
 * Intuitive Lexicon - Client-Side Interactive Engine
 * Handles theme toggling, client-side search, hover previews, and keyboard shortcuts.
 */

(function () {
  'use strict';

  // --- Theme Management ---
  const THEME_KEY = 'lexicon-theme';
  const themeToggleBtn = document.getElementById('themeToggleBtn');

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
    } else {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
  }
  initTheme();

  // --- Search Index & State ---
  let searchIndex = null;
  let isLoadingIndex = false;
  let activeLangFilter = 'all';
  let activeTypeFilter = null;
  let selectedResultIndex = -1;

  async function loadSearchIndex() {
    if (searchIndex || isLoadingIndex) return;
    isLoadingIndex = true;
    try {
      const res = await fetch('/search-index.json');
      if (res.ok) {
        searchIndex = await res.json();
      }
    } catch (e) {
      console.warn('Could not load search-index.json', e);
    } finally {
      isLoadingIndex = false;
    }
  }

  // Preload search index in background
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => loadSearchIndex());
  } else {
    setTimeout(loadSearchIndex, 1000);
  }

  // --- Search Logic ---
  function executeSearch(query) {
    if (!searchIndex || !query) return [];
    const q = query.trim().toLowerCase();
    if (!q) return [];

    let results = searchIndex.filter(item => {
      // Apply filters
      if (activeLangFilter !== 'all' && item.lang !== activeLangFilter) return false;
      if (activeTypeFilter && item.type !== activeTypeFilter) return false;

      const titleMatch = item.title.toLowerCase().includes(q);
      const termMatch = item.term.toLowerCase().includes(q);
      const contentMatch = item.content.toLowerCase().includes(q);

      return titleMatch || termMatch || contentMatch;
    });

    // Score & sort results
    results.sort((a, b) => {
      const aTerm = a.term.toLowerCase();
      const bTerm = b.term.toLowerCase();
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();

      // Exact match
      if (aTerm === q || aTitle === q) return -1;
      if (bTerm === q || bTitle === q) return 1;

      // Starts with query
      if (aTerm.startsWith(q) || aTitle.startsWith(q)) return -1;
      if (bTerm.startsWith(q) || bTitle.startsWith(q)) return 1;

      // In title
      const aInTitle = aTitle.includes(q);
      const bInTitle = bTitle.includes(q);
      if (aInTitle && !bInTitle) return -1;
      if (!aInTitle && bInTitle) return 1;

      return a.title.localeCompare(b.title);
    });

    return results.slice(0, 20);
  }

  function highlightMatches(text, query) {
    if (!query) return escapeHtml(text);
    const escaped = escapeRegex(query.trim());
    const regex = new RegExp(`(${escaped})`, 'gi');
    return escapeHtml(text).replace(regex, '<span class="highlight-match">$1</span>');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // --- Search Modal Controls ---
  const searchModal = document.getElementById('searchModal');
  const searchTriggerBtn = document.getElementById('searchTriggerBtn');
  const searchInput = document.getElementById('searchInput');
  const searchCloseBtn = document.getElementById('searchCloseBtn');
  const searchResultsContainer = document.getElementById('searchResultsContainer');

  function openSearchModal() {
    if (!searchModal) return;
    loadSearchIndex();
    searchModal.classList.add('open');
    searchModal.setAttribute('aria-hidden', 'false');
    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
    }
    renderModalResults('');
  }

  function closeSearchModal() {
    if (!searchModal) return;
    searchModal.classList.remove('open');
    searchModal.setAttribute('aria-hidden', 'true');
  }

  if (searchTriggerBtn) {
    searchTriggerBtn.addEventListener('click', openSearchModal);
  }

  if (searchCloseBtn) {
    searchCloseBtn.addEventListener('click', closeSearchModal);
  }

  if (searchModal) {
    searchModal.addEventListener('click', (e) => {
      if (e.target === searchModal) {
        closeSearchModal();
      }
    });
  }

  // Keyboard shortcut listener (/ or Cmd+K / Ctrl+K)
  document.addEventListener('keydown', (e) => {
    // If not typing in an input
    const tag = e.target.tagName.toLowerCase();
    const isEditing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;

    if (!isEditing && e.key === '/') {
      e.preventDefault();
      openSearchModal();
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (searchModal && searchModal.classList.contains('open')) {
        closeSearchModal();
      } else {
        openSearchModal();
      }
    } else if (e.key === 'Escape') {
      closeSearchModal();
    }
  });

  function renderModalResults(query) {
    if (!searchResultsContainer) return;
    selectedResultIndex = -1;

    if (!query) {
      searchResultsContainer.innerHTML = `
        <div class="search-empty-state">
          <p>Start typing to search dictionary entries across all languages...</p>
          <div class="search-shortcuts-hint">
            <span>Use <kbd>↑</kbd> <kbd>↓</kbd> to navigate</span>
            <span><kbd>Enter</kbd> to select</span>
            <span><kbd>ESC</kbd> to close</span>
          </div>
        </div>
      `;
      return;
    }

    const matches = executeSearch(query);

    if (matches.length === 0) {
      searchResultsContainer.innerHTML = `
        <div class="search-empty-state">
          <p>No entries found matching "<strong>${escapeHtml(query)}</strong>"</p>
          <p style="font-size: 0.85rem; color: var(--text-faint); margin-top: 0.5rem;">
            Tip: You can create a new entry at <code>${activeLangFilter !== 'all' ? activeLangFilter : 'en'}/${escapeHtml(query)}.md</code>
          </p>
        </div>
      `;
      return;
    }

    searchResultsContainer.innerHTML = matches.map((item, idx) => `
      <a href="${item.url}" class="search-result-item" data-idx="${idx}">
        <div class="result-item-top">
          <span class="result-title">${highlightMatches(item.title, query)}</span>
          <div style="display: flex; gap: 0.35rem; align-items: center;">
            <span class="card-lang-badge">${item.flag} ${item.lang.toUpperCase()}</span>
            <span class="card-type-badge type-${item.type}">${item.typeLabel}</span>
          </div>
        </div>
        <div class="result-snippet">${highlightMatches(item.summary, query)}</div>
      </a>
    `).join('');
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderModalResults(e.target.value);
    });

    searchInput.addEventListener('keydown', (e) => {
      const items = searchResultsContainer.querySelectorAll('.search-result-item');
      if (items.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedResultIndex = (selectedResultIndex + 1) % items.length;
        updateSelectedResult(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedResultIndex = (selectedResultIndex - 1 + items.length) % items.length;
        updateSelectedResult(items);
      } else if (e.key === 'Enter') {
        if (selectedResultIndex >= 0 && items[selectedResultIndex]) {
          e.preventDefault();
          items[selectedResultIndex].click();
        }
      }
    });
  }

  function updateSelectedResult(items) {
    items.forEach((item, idx) => {
      if (idx === selectedResultIndex) {
        item.classList.add('selected');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('selected');
      }
    });
  }

  // Search Filter Pills
  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const parent = btn.parentElement;
      const lang = btn.getAttribute('data-filter');
      const type = btn.getAttribute('data-filter-type');

      if (lang) {
        parent.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeLangFilter = lang;
      } else if (type) {
        if (btn.classList.contains('active')) {
          btn.classList.remove('active');
          activeTypeFilter = null;
        } else {
          parent.querySelectorAll('[data-filter-type]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          activeTypeFilter = type;
        }
      }

      if (searchInput && searchModal.classList.contains('open')) {
        renderModalResults(searchInput.value);
      } else if (pageSearchInput) {
        renderPageSearch(pageSearchInput.value);
      }
    });
  });

  // --- Dedicated Search Page Logic (/search/) ---
  const pageSearchInput = document.getElementById('pageSearchInput');
  const pageSearchResults = document.getElementById('pageSearchResults');

  function renderPageSearch(query) {
    if (!pageSearchResults) return;
    if (!query) {
      if (searchIndex) {
        // Show all entries sorted by title
        let all = [...searchIndex];
        if (activeLangFilter !== 'all') all = all.filter(i => i.lang === activeLangFilter);
        if (activeTypeFilter) all = all.filter(i => i.type === activeTypeFilter);
        all.sort((a, b) => a.title.localeCompare(b.title));
        pageSearchResults.innerHTML = `
          <div class="lexicon-grid">
            ${all.map(item => `
              <a href="${item.url}" class="lexicon-card">
                <div class="card-header">
                  <span class="card-title">${escapeHtml(item.title)}</span>
                  <span class="card-lang-badge">${item.flag} ${item.lang.toUpperCase()}</span>
                </div>
                <p class="card-snippet">${escapeHtml(item.summary)}</p>
                <div class="card-footer">
                  <span class="card-type-badge type-${item.type}">${item.typeLabel}</span>
                  ${item.sectionsCount > 1 ? `<span class="card-pill">${item.sectionsCount} analyses</span>` : ''}
                </div>
              </a>
            `).join('')}
          </div>
        `;
      }
      return;
    }

    const matches = executeSearch(query);
    if (matches.length === 0) {
      pageSearchResults.innerHTML = `<p class="empty-group-text" style="padding: 2rem 0;">No entries found matching "${escapeHtml(query)}".</p>`;
      return;
    }

    pageSearchResults.innerHTML = `
      <div class="lexicon-grid">
        ${matches.map(item => `
          <a href="${item.url}" class="lexicon-card">
            <div class="card-header">
              <span class="card-title">${highlightMatches(item.title, query)}</span>
              <span class="card-lang-badge">${item.flag} ${item.lang.toUpperCase()}</span>
            </div>
            <p class="card-snippet">${highlightMatches(item.summary, query)}</p>
            <div class="card-footer">
              <span class="card-type-badge type-${item.type}">${item.typeLabel}</span>
            </div>
          </a>
        `).join('')}
      </div>
    `;
  }

  if (pageSearchInput) {
    loadSearchIndex().then(() => renderPageSearch(''));
    pageSearchInput.addEventListener('input', (e) => {
      renderPageSearch(e.target.value);
    });
  }

  // --- Hover Preview Tooltip for Dictionary References ---
  const tooltip = document.getElementById('hoverTooltip');
  if (tooltip) {
    document.addEventListener('mouseover', (e) => {
      const link = e.target.closest('.dict-ref-link');
      if (!link) return;

      const title = link.getAttribute('data-tippy-title');
      const snippet = link.getAttribute('data-tippy-snippet');
      if (!title || !snippet) return;

      tooltip.innerHTML = `
        <div class="tooltip-title">${escapeHtml(title)}</div>
        <div class="tooltip-snippet">${escapeHtml(snippet)}</div>
      `;

      const rect = link.getBoundingClientRect();
      const top = rect.bottom + 8;
      const left = Math.max(10, Math.min(window.innerWidth - 330, rect.left));

      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${left}px`;
      tooltip.classList.add('visible');
      tooltip.setAttribute('aria-hidden', 'false');
    });

    document.addEventListener('mouseout', (e) => {
      const link = e.target.closest('.dict-ref-link');
      if (link) {
        tooltip.classList.remove('visible');
        tooltip.setAttribute('aria-hidden', 'true');
      }
    });
  }

  // --- Copy Reference Action ---
  document.querySelectorAll('.copy-ref-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ref = btn.getAttribute('data-ref');
      if (!ref) return;
      try {
        await navigator.clipboard.writeText(ref);
        const originalHtml = btn.innerHTML;
        btn.innerHTML = `<span style="color: var(--accent-gold);">✓ Copied <code>${escapeHtml(ref)}</code></span>`;
        setTimeout(() => {
          btn.innerHTML = originalHtml;
        }, 1800);
      } catch (err) {
        console.warn('Clipboard write failed:', err);
      }
    });
  });

  // --- Random Entry ("Surprise Me") ---
  const randomEntryBtn = document.getElementById('randomEntryBtn');
  if (randomEntryBtn) {
    randomEntryBtn.addEventListener('click', async () => {
      await loadSearchIndex();
      if (!searchIndex || searchIndex.length === 0) return;
      const randomItem = searchIndex[Math.floor(Math.random() * searchIndex.length)];
      if (randomItem && randomItem.url) {
        window.location.href = randomItem.url;
      }
    });
  }
})();
