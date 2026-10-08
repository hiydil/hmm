/**
 * hmm - In-Browser Markdown Editor for Local Development
 * With Reference Suggestion Autocomplete (@word, @en.pattern, etc.)
 */
(function () {
  'use strict';

  let searchIndex = null;
  let isIndexLoading = false;

  async function loadSearchIndex() {
    if (searchIndex || isIndexLoading) return;
    isIndexLoading = true;
    try {
      const res = await fetch('/search-index.json');
      if (res.ok) {
        searchIndex = await res.json();
      }
    } catch (e) {
      console.warn('Could not load search index for editor suggestions', e);
    } finally {
      isIndexLoading = false;
    }
  }

  // Preload search index immediately
  loadSearchIndex();

  // Build the Editor Modal DOM
  const editorOverlay = document.createElement('div');
  editorOverlay.className = 'dev-editor-overlay';
  editorOverlay.id = 'dev-editor-overlay';
  editorOverlay.innerHTML = `
    <div class="dev-editor-modal">
      <div class="dev-editor-topbar">
        <span class="dev-editor-filepath" id="dev-filepath-label"></span>
        <div class="dev-editor-controls">
          <span class="dev-status-msg" id="dev-status-msg"></span>
          <button type="button" class="dev-btn-cancel" id="dev-btn-cancel">Cancel</button>
          <button type="button" class="dev-btn-save" id="dev-btn-save">Save (Cmd+S)</button>
        </div>
      </div>
      <div class="dev-editor-body-wrapper" id="dev-body-wrapper">
        <textarea class="dev-editor-textarea" id="dev-textarea" spellcheck="false" placeholder="Write entry in Markdown... Multiple analyses separated by ---"></textarea>
      </div>
      <div class="dev-editor-footer">
        <span>Type <code>@</code> to search & insert references &middot; <code>---</code> for multiple analyses</span>
        <span id="dev-word-count"></span>
      </div>
    </div>
  `;
  document.body.appendChild(editorOverlay);

  // Floating Suggestion Autocomplete Popup (appended directly to body for unconstrained fixed positioning)
  const suggestPopup = document.createElement('div');
  suggestPopup.className = 'dev-suggest-popup';
  suggestPopup.id = 'dev-suggest-popup';
  document.body.appendChild(suggestPopup);

  // Build the New Entry Modal DOM
  const newOverlay = document.createElement('div');
  newOverlay.className = 'dev-editor-overlay';
  newOverlay.id = 'dev-new-overlay';
  newOverlay.innerHTML = `
    <div class="dev-editor-modal dev-new-modal">
      <div class="dev-editor-topbar">
        <span class="dev-editor-filepath">Create New Entry</span>
        <div class="dev-editor-controls">
          <button type="button" class="dev-btn-cancel" id="dev-new-cancel">Cancel</button>
          <button type="button" class="dev-btn-save" id="dev-new-submit">Create</button>
        </div>
      </div>
      <div class="dev-form-group">
        <div class="dev-field">
          <label for="dev-input-lang">Language</label>
          <input type="text" id="dev-input-lang" value="en" placeholder="en, tr, de...">
        </div>
        <div class="dev-field">
          <label for="dev-select-type">Category</label>
          <select id="dev-select-type">
            <option value="word">Standard Word</option>
            <option value="pattern">Pattern (affix/structure)</option>
            <option value="coinage">Coinage (neologism)</option>
          </select>
        </div>
        <div class="dev-field">
          <label for="dev-input-term">Word / Term Name</label>
          <input type="text" id="dev-input-term" placeholder="e.g. serenity, -ness, halbmund" autocomplete="off">
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(newOverlay);

  const textarea = document.getElementById('dev-textarea');
  const filepathLabel = document.getElementById('dev-filepath-label');
  const statusMsg = document.getElementById('dev-status-msg');
  const btnSave = document.getElementById('dev-btn-save');
  const btnCancel = document.getElementById('dev-btn-cancel');
  const wordCount = document.getElementById('dev-word-count');

  let activeFilepath = null;
  let activeSuggestions = [];
  let selectedSuggestIndex = 0;
  let triggerStartPos = -1;

  async function openEditor(filepath) {
    activeFilepath = filepath;
    filepathLabel.textContent = filepath;
    statusMsg.textContent = 'Loading...';
    editorOverlay.classList.add('open');
    await loadSearchIndex();

    try {
      const res = await fetch(`/api/raw?filepath=${encodeURIComponent(filepath)}`);
      if (res.ok) {
        const text = await res.text();
        textarea.value = text;
        statusMsg.textContent = '';
        updateWordCount();
        textarea.focus();
      } else {
        statusMsg.textContent = 'Failed to load file.';
      }
    } catch (e) {
      statusMsg.textContent = 'Error connecting to local server.';
    }
  }

  function closeEditor() {
    editorOverlay.classList.remove('open');
    closeSuggestions();
    statusMsg.textContent = '';
  }

  async function saveEntry() {
    if (!activeFilepath) return;
    statusMsg.textContent = 'Saving...';
    btnSave.disabled = true;

    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filepath: activeFilepath,
          content: textarea.value
        })
      });

      if (res.ok) {
        statusMsg.textContent = 'Saved ✓';
        setTimeout(() => {
          window.location.reload();
        }, 350);
      } else {
        const err = await res.text();
        statusMsg.textContent = `Save failed: ${err}`;
        btnSave.disabled = false;
      }
    } catch (e) {
      statusMsg.textContent = 'Network error while saving.';
      btnSave.disabled = false;
    }
  }

  function updateWordCount() {
    const text = textarea.value.trim();
    const count = text ? text.split(/\s+/).length : 0;
    wordCount.textContent = `${count} words`;
  }

  textarea.addEventListener('input', () => {
    updateWordCount();
    checkReferenceTrigger();
  });

  textarea.addEventListener('click', () => {
    checkReferenceTrigger();
  });

  textarea.addEventListener('keyup', (e) => {
    // Check on cursor moves if suggestions aren't active
    if (!['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
      checkReferenceTrigger();
    }
  });

  btnSave.addEventListener('click', saveEntry);
  btnCancel.addEventListener('click', closeEditor);

  // =========================================================================
  // Reference Autocomplete Suggestions Engine
  // =========================================================================

  function getRefSyntax(item) {
    if (item.type === 'word') {
      return `@${item.lang}(${item.term})`;
    } else if (item.type === 'pattern') {
      return `@${item.lang}.pattern(${item.term})`;
    } else if (item.type === 'coinage') {
      return `@${item.lang}.coinage(${item.term})`;
    }
    return `@${item.lang}.${item.type}(${item.term})`;
  }

  async function checkReferenceTrigger() {
    if (!searchIndex) {
      await loadSearchIndex();
      if (!searchIndex) return;
    }

    const caretPos = textarea.selectionStart;
    const textBeforeCaret = textarea.value.slice(0, caretPos);

    // Look for an unclosed '@' before caret on the current line
    // e.g. matches "@", "@en", "@Halb", "@-ism"
    const match = textBeforeCaret.match(/@([a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF.-]*)$/);
    if (!match) {
      closeSuggestions();
      return;
    }

    const query = match[1].toLowerCase();
    triggerStartPos = caretPos - match[0].length;

    // Filter index
    let matches = searchIndex.filter(item => {
      if (!query) return true;
      const termLower = item.term.toLowerCase();
      const titleLower = item.title.toLowerCase();
      const langLower = item.lang.toLowerCase();
      const typeLower = item.type.toLowerCase();
      const refPreview = getRefSyntax(item).toLowerCase();

      return termLower.includes(query) ||
             titleLower.includes(query) ||
             langLower.startsWith(query) ||
             typeLower.startsWith(query) ||
             refPreview.includes(query);
    });

    // Score & sort: exact matches and prefix matches first
    matches.sort((a, b) => {
      const aTerm = a.term.toLowerCase();
      const bTerm = b.term.toLowerCase();
      const aSyntax = getRefSyntax(a).toLowerCase();
      const bSyntax = getRefSyntax(b).toLowerCase();

      if (aTerm.startsWith(query) && !bTerm.startsWith(query)) return -1;
      if (!aTerm.startsWith(query) && bTerm.startsWith(query)) return 1;
      if (aSyntax.startsWith('@' + query) && !bSyntax.startsWith('@' + query)) return -1;
      if (!aSyntax.startsWith('@' + query) && bSyntax.startsWith('@' + query)) return 1;

      return a.title.localeCompare(b.title);
    });

    activeSuggestions = matches.slice(0, 10);

    if (activeSuggestions.length === 0) {
      closeSuggestions();
      return;
    }

    selectedSuggestIndex = 0;
    renderSuggestions();
    positionSuggestions();
  }

  function renderSuggestions() {
    suggestPopup.innerHTML = `
      <div class="dev-suggest-header">
        <span>Insert reference</span>
        <span><kbd>↑↓</kbd> navigate &middot; <kbd>Enter</kbd> insert</span>
      </div>
      ${activeSuggestions.map((item, idx) => {
        const syntax = getRefSyntax(item);
        const isSelected = idx === selectedSuggestIndex;
        return `
          <div class="dev-suggest-item ${isSelected ? 'selected' : ''}" data-idx="${idx}">
            <div class="dev-suggest-item-top">
              <span class="dev-suggest-term">${escapeHtml(item.title)}</span>
              <span class="dev-suggest-syntax">${escapeHtml(syntax)}</span>
            </div>
            <div class="dev-suggest-snippet">${escapeHtml(item.summary)}</div>
          </div>
        `;
      }).join('')}
    `;
    suggestPopup.classList.add('open');
  }

  function positionSuggestions() {
    const textareaRect = textarea.getBoundingClientRect();
    const { relTop, relLeft } = getCaretCoordinates(textarea, triggerStartPos);

    let screenTop = textareaRect.top + relTop - textarea.scrollTop + 28;
    let screenLeft = textareaRect.left + relLeft - textarea.scrollLeft;

    const popupWidth = Math.min(380, window.innerWidth - 32);
    const popupHeight = 260;

    // Safety checks: if caret calculation is out of visible textarea bounds, fallback to visible spot
    if (screenTop < textareaRect.top - 10 || screenTop > textareaRect.bottom + 10) {
      screenTop = textareaRect.top + 40;
    }
    if (screenLeft < textareaRect.left - 10 || screenLeft > textareaRect.right + 10) {
      screenLeft = textareaRect.left + 24;
    }

    // Viewport boundary clamps
    if (screenLeft + popupWidth > window.innerWidth - 16) {
      screenLeft = window.innerWidth - popupWidth - 16;
    }
    if (screenLeft < 16) screenLeft = 16;

    if (screenTop + popupHeight > window.innerHeight - 16) {
      screenTop = Math.max(16, screenTop - popupHeight - 34);
    }
    if (screenTop < 16) screenTop = 16;

    suggestPopup.style.top = `${Math.round(screenTop)}px`;
    suggestPopup.style.left = `${Math.round(screenLeft)}px`;
    suggestPopup.style.width = `${popupWidth}px`;
  }

  function insertSuggestion(item) {
    if (!item || triggerStartPos < 0) return;

    const syntax = getRefSyntax(item);
    const text = textarea.value;
    const caretPos = textarea.selectionStart;

    const before = text.slice(0, triggerStartPos);
    const after = text.slice(caretPos);

    textarea.value = before + syntax + ' ' + after;
    const newPos = before.length + syntax.length + 1;
    textarea.selectionStart = textarea.selectionEnd = newPos;

    closeSuggestions();
    textarea.focus();
    updateWordCount();
  }

  function closeSuggestions() {
    suggestPopup.classList.remove('open');
    activeSuggestions = [];
    selectedSuggestIndex = 0;
    triggerStartPos = -1;
  }

  // Handle clicking a suggestion item
  suggestPopup.addEventListener('mousedown', (e) => {
    e.preventDefault(); // prevent textarea losing focus
    const itemEl = e.target.closest('.dev-suggest-item');
    if (!itemEl) return;
    const idx = parseInt(itemEl.getAttribute('data-idx'), 10);
    if (!isNaN(idx) && activeSuggestions[idx]) {
      insertSuggestion(activeSuggestions[idx]);
    }
  });

  // Keyboard navigation for suggestions
  textarea.addEventListener('keydown', (e) => {
    if (!suggestPopup.classList.contains('open')) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedSuggestIndex = (selectedSuggestIndex + 1) % activeSuggestions.length;
      updateSelectedSuggestItem();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedSuggestIndex = (selectedSuggestIndex - 1 + activeSuggestions.length) % activeSuggestions.length;
      updateSelectedSuggestItem();
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (activeSuggestions.length > 0) {
        e.preventDefault();
        insertSuggestion(activeSuggestions[selectedSuggestIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeSuggestions();
    }
  });

  function updateSelectedSuggestItem() {
    const items = suggestPopup.querySelectorAll('.dev-suggest-item');
    items.forEach((el, idx) => {
      if (idx === selectedSuggestIndex) {
        el.classList.add('selected');
        el.scrollIntoView({ block: 'nearest' });
      } else {
        el.classList.remove('selected');
      }
    });
  }

  // Caret coordinate calculation helper using mirror div
  function getCaretCoordinates(element, position) {
    const div = document.createElement('div');
    const styles = window.getComputedStyle(element);

    div.style.position = 'fixed';
    div.style.top = '0px';
    div.style.left = '-9999px';
    div.style.visibility = 'hidden';
    div.style.pointerEvents = 'none';
    div.style.width = element.clientWidth + 'px';
    div.style.padding = styles.padding;
    div.style.border = styles.border;
    div.style.fontFamily = styles.fontFamily;
    div.style.fontSize = styles.fontSize;
    div.style.fontWeight = styles.fontWeight;
    div.style.lineHeight = styles.lineHeight;
    div.style.letterSpacing = styles.letterSpacing;
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    div.style.boxSizing = 'border-box';

    div.textContent = element.value.substring(0, position);

    const marker = document.createElement('span');
    marker.textContent = '@';
    div.appendChild(marker);

    document.body.appendChild(div);

    const divRect = div.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();

    const relTop = markerRect.top - divRect.top;
    const relLeft = markerRect.left - divRect.left;

    document.body.removeChild(div);

    return { relTop, relLeft };
  }

  // =========================================================================
  // New Entry Modal controls
  // =========================================================================

  const newLang = document.getElementById('dev-input-lang');
  const newType = document.getElementById('dev-select-type');
  const newTerm = document.getElementById('dev-input-term');
  const newSubmit = document.getElementById('dev-new-submit');
  const newCancel = document.getElementById('dev-new-cancel');

  function openNewModal() {
    newOverlay.classList.add('open');
    newTerm.value = '';
    newTerm.focus();
  }

  function closeNewModal() {
    newOverlay.classList.remove('open');
  }

  async function submitNewEntry() {
    const lang = newLang.value.trim().toLowerCase();
    const type = newType.value;
    const term = newTerm.value.trim();

    if (!lang || !term) {
      alert('Please provide language and term name.');
      return;
    }

    try {
      const res = await fetch('/api/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang, type, term })
      });

      if (res.ok) {
        const data = await res.json();
        closeNewModal();
        window.location.href = data.url;
      } else {
        alert('Failed to create entry.');
      }
    } catch (e) {
      alert('Network error.');
    }
  }

  newSubmit.addEventListener('click', submitNewEntry);
  newCancel.addEventListener('click', closeNewModal);

  // Wire up page Edit & New buttons
  document.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-dev-edit]');
    if (editBtn) {
      const filepath = editBtn.getAttribute('data-dev-edit');
      if (filepath) openEditor(filepath);
    }

    const newBtn = e.target.closest('[data-dev-new]');
    if (newBtn) {
      openNewModal();
    }
  });

  // Global Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    // Inside editor modal
    if (editorOverlay.classList.contains('open')) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveEntry();
      } else if (e.key === 'Escape' && !suggestPopup.classList.contains('open')) {
        closeEditor();
      }
      return;
    }

    if (newOverlay.classList.contains('open')) {
      if (e.key === 'Escape') {
        closeNewModal();
      } else if (e.key === 'Enter') {
        submitNewEntry();
      }
      return;
    }

    // When viewing an entry, press 'e' to edit, 'n' to create
    const isEditing = ['input', 'textarea'].includes(document.activeElement?.tagName?.toLowerCase());
    if (!isEditing) {
      if (e.key === 'e') {
        const editTarget = document.querySelector('[data-dev-edit]');
        if (editTarget) {
          e.preventDefault();
          const filepath = editTarget.getAttribute('data-dev-edit');
          if (filepath) openEditor(filepath);
        }
      } else if (e.key === 'n') {
        e.preventDefault();
        openNewModal();
      }
    }
  });

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
