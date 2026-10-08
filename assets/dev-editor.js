/**
 * hmm - In-Browser Markdown Editor for Local Development
 * Only active when running locally via `npm run dev`
 */
(function () {
  'use strict';

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
      <textarea class="dev-editor-textarea" id="dev-textarea" spellcheck="false" placeholder="Write entry in Markdown... Multiple analyses separated by ---"></textarea>
      <div class="dev-editor-footer">
        <span>Use <code>---</code> for multiple analyses &middot; <code>@lang(term)</code> for cross-references</span>
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

  let activeFilepath = null;

  async function openEditor(filepath) {
    activeFilepath = filepath;
    filepathLabel.textContent = filepath;
    statusMsg.textContent = 'Loading...';
    editorOverlay.classList.add('open');

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

  textarea.addEventListener('input', updateWordCount);
  btnSave.addEventListener('click', saveEntry);
  btnCancel.addEventListener('click', closeEditor);

  // New Entry Modal controls
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
    // Save shortcut: Cmd+S / Ctrl+S inside editor
    if (editorOverlay.classList.contains('open')) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveEntry();
      } else if (e.key === 'Escape') {
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

    // When viewing an entry, press 'e' to edit
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
})();
