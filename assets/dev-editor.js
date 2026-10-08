/**
 * hmm - In-Browser Markdown Editor for Local Development
 * With Reference Suggestion Autocomplete (@word, @en.pattern, etc.)
 */
(function () {
  'use strict';

  let searchIndex = null;

  async function loadSearchIndex() {
    if (searchIndex) return;
    try {
      const res = await fetch('/search-index.json');
      if (res.ok) searchIndex = await res.json();
    } catch (e) {
      console.warn('Could not load search index for editor suggestions', e);
    }
  }

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
        <!-- Suggestion Autocomplete Popup -->
        <div class="dev-suggest-popup" id="dev-suggest-popup"></div>
      </div>
      <div class="dev-editor-footer">
        <span>Type <code>@</code> to search & insert references &middot; <code>---</code> for multiple analyses</span>
        <span id="dev-word-count"></span>
      </div>
    </div>
  `;
  document.body.appendChild(editorOverlay);

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
  const suggestPopup = document.getElementById('dev-suggest-popup');
  const bodyWrapper = document.getElementById('dev-body-wrapper');

  let activeFilepath = null;
  let activeSuggestions = [];
  let selectedSuggestIndex = 0;
  let triggerStartPos = -1;

  async function openEditor(filepath) {
    activeFilepath = filepath;
    filepathLabel.textContent = filepath;
    statusMsg.textContent = 'Loading...';
    editorOverlay.classList.add('open');
    loadSearchIndex();

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

  function checkReferenceTrigger() {
    if (!searchIndex) return;

    const caretPos = textarea.selectionStart;
    const textBeforeCaret = textarea.value.slice(0, caretPos);

    // Look for an unclosed '@' before caret on the current line
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
      const aSyntax = getRefSyntax(a).toLowerCase();
      const bSyntax = getRefSyntax(b).toLowerCase();
      const aTerm = a.term.toLowerCase();
      const bTerm = b.term.toLowerCase();

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
    // Position suggestion popup relative to the caret inside textarea
    const caretCoordinates = getCaretCoordinates(textarea, triggerStartPos);
    const wrapperRect = bodyWrapper.getBoundingClientRect();

    let top = caretCoordinates.top - textarea.scrollTop + 28;
    let left = caretCoordinates.left - textarea.scrollLeft;

    // Boundary clamps
    const popupWidth = 380;
    const popupHeight = 260;

    if (left + popupWidth > wrapperRect.width - 20) {
      left = Math.max(20, wrapperRect.width - popupWidth - 20);
    }
    if (left < 20) left = 20;

    if (top + popupHeight > wrapperRect.height - 10) {
      top = Math.max(10, top - popupHeight - 34);
    }

    suggestPopup.style.top = `${top}px`;
    suggestPopup.style.left = `${left}px`;
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

    const properties = [
      'boxSizing', 'width', 'height', 'overflowX', 'overflowY',
      'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize',
      'fontSizeAdjust', 'lineHeight', 'fontFamily', 'textAlign', 'textTransform',
      'textIndent', 'textDecoration', 'letterSpacing', 'wordSpacing', 'tabSize'
    ];

    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';

    properties.forEach(prop => {
      div.style[prop] = styles[prop];
    });

    const text = element.value.substring(0, position);
    div.textContent = text;

    const span = document.createElement('span');
    span.textContent = element.value.substring(position) || '.';
    div.appendChild(span);

    document.body.appendChild(div);
    const coordinates = {
      top: span.offsetTop + parseInt(styles.borderTopWidth, 10),
      left: span.offsetLeft + parseInt(styles.borderLeftWidth, 10)
    };
    document.body.removeChild(div);

    return coordinates;
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
