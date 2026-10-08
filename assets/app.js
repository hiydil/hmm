/**
 * Minimal Search Engine
 */
(function () {
  'use strict';

  let searchIndex = null;
  const input = document.getElementById('search-input');
  const dropdown = document.getElementById('search-dropdown');

  async function loadIndex() {
    if (searchIndex) return;
    try {
      const res = await fetch('/search-index.json');
      if (res.ok) searchIndex = await res.json();
    } catch (e) {
      console.warn('Could not load search index', e);
    }
  }

  function search(query) {
    if (!searchIndex || !query) return [];
    const q = query.trim().toLowerCase();
    if (!q) return [];

    return searchIndex.filter(item => {
      return item.title.toLowerCase().includes(q) ||
             item.term.toLowerCase().includes(q) ||
             item.content.toLowerCase().includes(q);
    }).slice(0, 8);
  }

  function renderResults(results) {
    if (!dropdown) return;
    if (results.length === 0) {
      dropdown.innerHTML = '<div style="padding: 0.75rem; color: var(--muted); font-size: 0.85rem;">No entries found.</div>';
      dropdown.classList.add('open');
      return;
    }

    dropdown.innerHTML = results.map(item => `
      <a href="${item.url}" class="search-item">
        <div>
          <span class="search-item-title">${escapeHtml(item.title)}</span>
          <span class="search-item-meta">${item.lang}${item.type !== 'word' ? ' · ' + item.type : ''}</span>
        </div>
        <div class="search-item-snippet">${escapeHtml(item.summary)}</div>
      </a>
    `).join('');
    dropdown.classList.add('open');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  if (input) {
    input.addEventListener('focus', loadIndex);
    input.addEventListener('input', async (e) => {
      await loadIndex();
      const val = e.target.value.trim();
      if (!val) {
        dropdown.classList.remove('open');
        return;
      }
      renderResults(search(val));
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        dropdown.classList.remove('open');
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-wrapper')) {
        dropdown.classList.remove('open');
      }
    });
  }

  // Quick keyboard shortcut: press / to focus search
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== input) {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag !== 'input' && tag !== 'textarea') {
        e.preventDefault();
        input?.focus();
      }
    }
  });
})();
