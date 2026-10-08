/**
 * hmm - In-Browser Studio Markdown Editor for Local Development
 * - Split-Pane Live Rendered Markdown Preview
 * - Transliteration Writing Modes: Arabic, Farsi, Greek
 * - Interactive Complete Letter Cheat Sheet & Guide Drawer
 * - Reference Suggestion Autocomplete (@word, @en.pattern, etc.)
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

  loadSearchIndex();

  // =========================================================================
  // Transliteration Character Tables & Letter Guides
  // =========================================================================

  const ARABIC_GUIDE = [
    { char: 'ا', name: 'Alif', key: 'a', desc: 'Long vowel a / alif' },
    { char: 'آ', name: 'Alif Madda', key: 'aa / A', desc: 'Alif with madda' },
    { char: 'ء', name: 'Hamza', key: "' / 2", desc: 'Glottal stop' },
    { char: 'أ', name: 'Alif Hamza', key: "a' / 2a", desc: 'Alif with hamza above' },
    { char: 'إ', name: 'Alif Hamza Below', key: "i' / I", desc: 'Alif with hamza below' },
    { char: 'ب', name: 'Baa', key: 'b', desc: 'Voiced bilabial stop' },
    { char: 'ت', name: 'Taa', key: 't', desc: 'Voiceless dental stop' },
    { char: 'ة', name: 'Taa Marbuta', key: 'ta / ah', desc: 'Feminine ending marker' },
    { char: 'ث', name: 'Thaa', key: 'th', desc: 'Voiceless interdental (as in "think")' },
    { char: 'ج', name: 'Jeem', key: 'j', desc: 'Voiced postalveolar affricate' },
    { char: 'ح', name: 'Haa (pharyngeal)', key: 'H / 7 / hh', desc: 'Voiceless pharyngeal fricative' },
    { char: 'خ', name: 'Khaa', key: 'kh / 5 / x', desc: 'Voiceless velar fricative (as in "loch")' },
    { char: 'د', name: 'Daal', key: 'd', desc: 'Voiced dental stop' },
    { char: 'ذ', name: 'Dhaal', key: 'dh', desc: 'Voiced interdental (as in "this")' },
    { char: 'ر', name: 'Raa', key: 'r', desc: 'Alveolar trill / tap' },
    { char: 'ز', name: 'Zayn', key: 'z', desc: 'Voiced alveolar fricative' },
    { char: 'س', name: 'Seen', key: 's', desc: 'Voiceless alveolar fricative' },
    { char: 'ش', name: 'Sheen', key: 'sh', desc: 'Voiceless postalveolar (as in "ship")' },
    { char: 'ص', name: 'Saad (emphatic)', key: 'S / 9 / ss', desc: 'Emphatic voiceless alveolar' },
    { char: 'ض', name: 'Daad (emphatic)', key: 'D / dd', desc: 'Emphatic voiced dental stop' },
    { char: 'ط', name: 'Taa (emphatic)', key: 'T / 6 / tt', desc: 'Emphatic voiceless dental stop' },
    { char: 'ظ', name: 'Zaa (emphatic)', key: 'Z / zz', desc: 'Emphatic voiced interdental' },
    { char: 'ع', name: 'Ayn', key: "3 / c / '", desc: 'Voiced pharyngeal fricative' },
    { char: 'غ', name: 'Ghayn', key: 'gh', desc: 'Voiced velar fricative (French r)' },
    { char: 'ف', name: 'Faa', key: 'f', desc: 'Voiceless labiodental fricative' },
    { char: 'ق', name: 'Qaaf', key: 'q / 8', desc: 'Voiceless uvular stop' },
    { char: 'ك', name: 'Kaaf', key: 'k', desc: 'Voiceless velar stop' },
    { char: 'ل', name: 'Laam', key: 'l', desc: 'Alveolar lateral approximant' },
    { char: 'م', name: 'Meem', key: 'm', desc: 'Bilabial nasal' },
    { char: 'ن', name: 'Noon', key: 'n', desc: 'Dental nasal' },
    { char: 'ه', name: 'Haa', key: 'h', desc: 'Voiceless glottal fricative' },
    { char: 'و', name: 'Waaw', key: 'w / u / oo', desc: 'Semivowel w / long u' },
    { char: 'ي', name: 'Yaa', key: 'y / i / ee', desc: 'Semivowel y / long i' },
    { char: 'ى', name: 'Alif Maqsura', key: 'Y / aa', desc: 'Dagger alif ending' }
  ];

  const FARSI_GUIDE = [
    { char: 'ا', name: 'Alef', key: 'a', desc: 'Vowel a / alef' },
    { char: 'آ', name: 'Alef ba Kolah', key: 'aa / A', desc: 'Long a (ā)' },
    { char: 'ب', name: 'Be', key: 'b', desc: 'Standard b sound' },
    { char: 'پ', name: 'Pe (Persian)', key: 'p', desc: 'Persian specific: p sound' },
    { char: 'ت', name: 'Te', key: 't', desc: 'Standard t sound' },
    { char: 'ث', name: 'Se', key: 's / th', desc: 's sound' },
    { char: 'ج', name: 'Jim', key: 'j', desc: 'j sound' },
    { char: 'چ', name: 'Che (Persian)', key: 'ch / c', desc: 'Persian specific: ch sound' },
    { char: 'ح', name: 'He', key: 'h / H / 7', desc: 'h sound' },
    { char: 'خ', name: 'Khe', key: 'kh / x / 5', desc: 'Guttural kh sound' },
    { char: 'د', name: 'Dal', key: 'd', desc: 'd sound' },
    { char: 'ذ', name: 'Zal', key: 'z / dh', desc: 'z sound' },
    { char: 'ر', name: 'Re', key: 'r', desc: 'r sound' },
    { char: 'ز', name: 'Ze', key: 'z', desc: 'z sound' },
    { char: 'ژ', name: 'Zhe (Persian)', key: 'zh', desc: 'Persian specific: zh (like measure)' },
    { char: 'س', name: 'Sin', key: 's', desc: 's sound' },
    { char: 'ش', name: 'Shin', key: 'sh', desc: 'sh sound' },
    { char: 'ص', name: 'Sad', key: 'S / s', desc: 's sound' },
    { char: 'ض', name: 'Zad', key: 'Z / z', desc: 'z sound' },
    { char: 'ط', name: 'Ta', key: 'T / t', desc: 't sound' },
    { char: 'ظ', name: 'Za', key: 'Z / z', desc: 'z sound' },
    { char: 'ع', name: 'Ayn', key: "' / 3", desc: 'Glottal stop in Persian' },
    { char: 'غ', name: 'Ghayn', key: 'gh', desc: 'Guttural gh sound' },
    { char: 'ف', name: 'Fe', key: 'f', desc: 'f sound' },
    { char: 'ق', name: 'Qaf', key: 'q / gh / 8', desc: 'q sound' },
    { char: 'ک', name: 'Ke (Persian)', key: 'k', desc: 'Persian specific Kaf' },
    { char: 'گ', name: 'Gaf (Persian)', key: 'g', desc: 'Persian specific: hard g sound' },
    { char: 'ل', name: 'Lam', key: 'l', desc: 'l sound' },
    { char: 'م', name: 'Mim', key: 'm', desc: 'm sound' },
    { char: 'ن', name: 'Nun', key: 'n', desc: 'n sound' },
    { char: 'و', name: 'Vav', key: 'v / w / u', desc: 'v or u sound' },
    { char: 'ه', name: 'He', key: 'h / e', desc: 'h or soft e sound' },
    { char: 'ی', name: 'Ye (Persian)', key: 'y / i', desc: 'Persian specific Ye (without dots)' }
  ];

  const GREEK_GUIDE = [
    { char: 'α', name: 'Alpha', key: 'a (A=Α)', desc: 'Short / long a' },
    { char: 'β', name: 'Beta', key: 'b (B=Β)', desc: 'v / b sound' },
    { char: 'γ', name: 'Gamma', key: 'g (G=Γ)', desc: 'g / gh sound' },
    { char: 'δ', name: 'Delta', key: 'd (D=Δ)', desc: 'th (as in "then") / d' },
    { char: 'ε', name: 'Epsilon', key: 'e (E=Ε)', desc: 'Short e sound' },
    { char: 'ζ', name: 'Zeta', key: 'z (Z=Ζ)', desc: 'z sound' },
    { char: 'η', name: 'Eta', key: 'h (H=Η)', desc: 'Long e / ee sound' },
    { char: 'θ', name: 'Theta', key: 'th / q (Q=Θ)', desc: 'th (as in "think")' },
    { char: 'ι', name: 'Iota', key: 'i (I=Ι)', desc: 'i / ee sound' },
    { char: 'κ', name: 'Kappa', key: 'k / c (K=Κ)', desc: 'k sound' },
    { char: 'λ', name: 'Lambda', key: 'l (L=Λ)', desc: 'l sound' },
    { char: 'μ', name: 'Mu', key: 'm (M=Μ)', desc: 'm sound' },
    { char: 'ν', name: 'Nu', key: 'n (N=Ν)', desc: 'n sound' },
    { char: 'ξ', name: 'Xi', key: 'x (X=Ξ)', desc: 'x / ks sound' },
    { char: 'ο', name: 'Omicron', key: 'o (O=Ο)', desc: 'Short o sound' },
    { char: 'π', name: 'Pi', key: 'p (P=Π)', desc: 'p sound' },
    { char: 'ρ', name: 'Rho', key: 'r (R=Ρ)', desc: 'r sound' },
    { char: 'σ / ς', name: 'Sigma', key: 's (S=Σ)', desc: 's sound (auto-turns into ς at word end)' },
    { char: 'τ', name: 'Tau', key: 't (T=Τ)', desc: 't sound' },
    { char: 'υ', name: 'Upsilon', key: 'u / y (U=Υ)', desc: 'u / i sound' },
    { char: 'φ', name: 'Phi', key: 'f / ph (F=Φ)', desc: 'f / ph sound' },
    { char: 'χ', name: 'Chi', key: 'ch (CH=Χ)', desc: 'kh / ch sound' },
    { char: 'ψ', name: 'Psi', key: 'ps (PS=Ψ)', desc: 'ps sound' },
    { char: 'ω', name: 'Omega', key: 'w (W=Ω)', desc: 'Long o sound' },
    { char: 'ά', name: 'Accented Alpha', key: "a'", desc: 'Tonos / accent' },
    { char: 'έ', name: 'Accented Epsilon', key: "e'", desc: 'Tonos / accent' },
    { char: 'ή', name: 'Accented Eta', key: "h'", desc: 'Tonos / accent' },
    { char: 'ί', name: 'Accented Iota', key: "i'", desc: 'Tonos / accent' },
    { char: 'ό', name: 'Accented Omicron', key: "o'", desc: 'Tonos / accent' },
    { char: 'ύ', name: 'Accented Upsilon', key: "u' / y'", desc: 'Tonos / accent' },
    { char: 'ώ', name: 'Accented Omega', key: "w'", desc: 'Tonos / accent' }
  ];

  // Build the Enhanced Studio Editor Modal DOM
  const editorOverlay = document.createElement('div');
  editorOverlay.className = 'dev-editor-overlay';
  editorOverlay.id = 'dev-editor-overlay';
  editorOverlay.innerHTML = `
    <div class="dev-editor-modal">
      <div class="dev-editor-topbar">
        <div class="dev-topbar-left">
          <span class="dev-editor-filepath" id="dev-filepath-label"></span>
        </div>

        <div class="dev-topbar-center">
          <!-- Writing Mode Selector -->
          <label style="font-size: 0.8rem; color: var(--muted); display: flex; align-items: center; gap: 0.35rem;">
            <span>Mode:</span>
            <select class="dev-tool-select" id="dev-writing-mode-select">
              <option value="standard">Standard (Latin)</option>
              <option value="arabic">Arabic (العربية)</option>
              <option value="farsi">Farsi (فارسی)</option>
              <option value="greek">Greek (Ελληνικά)</option>
            </select>
          </label>

          <!-- View Mode (Split, Edit, Preview) -->
          <select class="dev-view-select" id="dev-view-mode-select" title="Switch layout">
            <option value="split">Split View</option>
            <option value="edit">Editor Only</option>
            <option value="preview">Preview Only</option>
          </select>

          <!-- Toggle Guide Drawer Button -->
          <button type="button" class="dev-guide-btn" id="dev-guide-toggle-btn" title="Toggle letter phonetic guide">
            <span>📖 Guide</span>
          </button>
        </div>

        <div class="dev-editor-controls">
          <span class="dev-status-msg" id="dev-status-msg"></span>
          <button type="button" class="dev-btn-cancel" id="dev-btn-cancel">Cancel</button>
          <button type="button" class="dev-btn-save" id="dev-btn-save">Save (Cmd+S)</button>
        </div>
      </div>

      <!-- Main Studio Workspace with Split View & Guide Drawer -->
      <div class="dev-studio-workspace" id="dev-studio-workspace">
        <!-- Left: Editor Pane -->
        <div class="dev-editor-pane">
          <textarea class="dev-editor-textarea" id="dev-textarea" spellcheck="false" placeholder="Write entry in Markdown... Multiple analyses separated by ---"></textarea>
        </div>

        <!-- Right: Live Rendered Preview Pane -->
        <div class="dev-preview-pane" id="dev-preview-pane">
          <div class="dev-preview-header">Live Preview</div>
          <div class="dev-preview-content" id="dev-preview-content"></div>
        </div>

        <!-- Slide-out Letter Guide Drawer -->
        <aside class="dev-guide-drawer collapsed" id="dev-guide-drawer">
          <div class="dev-guide-top">
            <span class="dev-guide-title" id="dev-guide-title">Letter Guide</span>
            <button type="button" class="dev-btn-cancel" style="padding: 0.15rem 0.4rem; font-size: 0.75rem;" id="dev-guide-close-btn">✕</button>
          </div>
          <div class="dev-guide-search">
            <input type="search" id="dev-guide-search-input" placeholder="Search letter or key..." autocomplete="off">
          </div>
          <div class="dev-guide-instruction" id="dev-guide-instruction">
            Type Latin keys to approximate characters. Click any letter to insert.
          </div>
          <div class="dev-guide-list" id="dev-guide-list"></div>
        </aside>
      </div>

      <!-- Footer Bar -->
      <div class="dev-editor-footer">
        <span>Type <code>@</code> for references &middot; <code>---</code> for multiple analyses</span>
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
          <input type="text" id="dev-input-lang" value="en" placeholder="en, tr, de, ar, fa, el...">
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
  const studioWorkspace = document.getElementById('dev-studio-workspace');
  const previewContent = document.getElementById('dev-preview-content');
  const writingModeSelect = document.getElementById('dev-writing-mode-select');
  const viewModeSelect = document.getElementById('dev-view-mode-select');
  const guideToggleBtn = document.getElementById('dev-guide-toggle-btn');
  const guideDrawer = document.getElementById('dev-guide-drawer');
  const guideCloseBtn = document.getElementById('dev-guide-close-btn');
  const guideTitle = document.getElementById('dev-guide-title');
  const guideInstruction = document.getElementById('dev-guide-instruction');
  const guideList = document.getElementById('dev-guide-list');
  const guideSearchInput = document.getElementById('dev-guide-search-input');

  let activeFilepath = null;
  let activeSuggestions = [];
  let selectedSuggestIndex = 0;
  let triggerStartPos = -1;
  let currentWritingMode = 'standard';

  // =========================================================================
  // Transliteration Engine (Greek, Arabic, Farsi)
  // =========================================================================

  function handleTransliteration(e) {
    if (currentWritingMode === 'standard') return;

    // Ignore special keys (Cmd/Ctrl shortcuts, Enter, Tab, Escape, Arrow keys, etc.)
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key.length !== 1) return; // Only process single printable characters

    const key = e.key;
    const caretPos = textarea.selectionStart;
    const text = textarea.value;
    const prevChar = caretPos > 0 ? text[caretPos - 1] : '';

    let replaced = null;

    if (currentWritingMode === 'greek') {
      replaced = transliterateGreek(key, prevChar);
    } else if (currentWritingMode === 'arabic') {
      replaced = transliterateArabic(key, prevChar);
    } else if (currentWritingMode === 'farsi') {
      replaced = transliterateFarsi(key, prevChar);
    }

    if (replaced !== null) {
      e.preventDefault();
      if (replaced.combinesWithPrev) {
        // Replace previous character + insert new combined character
        textarea.setSelectionRange(caretPos - 1, caretPos);
        document.execCommand('insertText', false, replaced.char);
      } else {
        document.execCommand('insertText', false, replaced.char);
      }
      updateLivePreview();
      updateWordCount();
      checkReferenceTrigger();
    }
  }

  function transliterateGreek(key, prevChar) {
    // Multi-key combinations
    if (prevChar === 'τ' && key === 'h') return { char: 'θ', combinesWithPrev: true };
    if (prevChar === 'Τ' && key.toLowerCase() === 'h') return { char: 'Θ', combinesWithPrev: true };
    if (prevChar === 'π' && key === 's') return { char: 'ψ', combinesWithPrev: true };
    if (prevChar === 'Π' && key.toLowerCase() === 's') return { char: 'Ψ', combinesWithPrev: true };
    if (prevChar === 'π' && key === 'h') return { char: 'φ', combinesWithPrev: true };
    if (prevChar === 'Π' && key.toLowerCase() === 'h') return { char: 'Φ', combinesWithPrev: true };
    if (prevChar === 'κ' && key === 'h') return { char: 'χ', combinesWithPrev: true };
    if (prevChar === 'Κ' && key.toLowerCase() === 'h') return { char: 'Χ', combinesWithPrev: true };

    // Accented vowels (typing ' after vowel)
    if (key === "'") {
      const accents = { 'α': 'ά', 'ε': 'έ', 'η': 'ή', 'ι': 'ί', 'ο': 'ό', 'υ': 'ύ', 'ω': 'ώ', 'Α': 'Ά', 'Ε': 'Έ', 'Η': 'Ή', 'Ι': 'Ί', 'Ο': 'Ό', 'Υ': 'Ύ', 'Ω': 'Ώ' };
      if (accents[prevChar]) return { char: accents[prevChar], combinesWithPrev: true };
    }

    // Word-final sigma: if previous was 'σ' and user types space or punctuation
    if (prevChar === 'σ' && /[\s.,;:!?)\]}]/.test(key)) {
      return null; // will naturally convert if desired, handled below
    }

    // Single character map
    const map = {
      'a': 'α', 'b': 'β', 'g': 'γ', 'd': 'δ', 'e': 'ε', 'z': 'ζ',
      'h': 'η', 'q': 'θ', 'i': 'ι', 'k': 'κ', 'c': 'κ', 'l': 'λ',
      'm': 'μ', 'n': 'ν', 'x': 'ξ', 'o': 'ο', 'p': 'π', 'r': 'ρ',
      's': 'σ', 't': 'τ', 'u': 'υ', 'y': 'υ', 'f': 'φ', 'w': 'ω',
      'A': 'Α', 'B': 'Β', 'G': 'Γ', 'D': 'Δ', 'E': 'Ε', 'Z': 'Ζ',
      'H': 'Η', 'Q': 'Θ', 'I': 'Ι', 'K': 'Κ', 'C': 'Κ', 'L': 'Λ',
      'M': 'Μ', 'N': 'Ν', 'X': 'Ξ', 'O': 'Ο', 'P': 'Π', 'R': 'Ρ',
      'S': 'Σ', 'T': 'Τ', 'U': 'Υ', 'Y': 'Υ', 'F': 'Φ', 'W': 'Ω'
    };

    if (map[key]) return { char: map[key], combinesWithPrev: false };
    return null;
  }

  function transliterateArabic(key, prevChar) {
    // Multi-key combinations
    if (prevChar === 'س' && key === 'h') return { char: 'ش', combinesWithPrev: true };
    if (prevChar === 'ك' && key === 'h') return { char: 'خ', combinesWithPrev: true };
    if (prevChar === 'ت' && key === 'h') return { char: 'ث', combinesWithPrev: true };
    if (prevChar === 'د' && key === 'h') return { char: 'ذ', combinesWithPrev: true };
    if (prevChar === 'ج' && key === 'h') return { char: 'غ', combinesWithPrev: true };
    if (prevChar === 'ا' && key === 'a') return { char: 'آ', combinesWithPrev: true };
    if (prevChar === 'ت' && key === 'a') return { char: 'ة', combinesWithPrev: true };

    const map = {
      'a': 'ا', 'b': 'ب', 't': 'ت', 'j': 'ج', 'H': 'ح', '7': 'ح',
      'x': 'خ', '5': 'خ', 'd': 'د', 'r': 'ر', 'z': 'ز', 's': 'س',
      'S': 'ص', '9': 'ص', 'D': 'ض', 'T': 'ط', '6': 'ط', 'Z': 'ظ',
      '3': 'ع', 'c': 'ع', 'f': 'ف', 'q': 'ق', '8': 'ق', 'k': 'ك',
      'l': 'ل', 'm': 'م', 'n': 'ن', 'h': 'ه', 'w': 'و', 'u': 'و',
      'y': 'ي', 'i': 'ي', "'": 'ء', '2': 'ء', 'A': 'آ', 'Y': 'ى'
    };

    if (map[key]) return { char: map[key], combinesWithPrev: false };
    return null;
  }

  function transliterateFarsi(key, prevChar) {
    // Multi-key combinations
    if ((prevChar === 'س' || prevChar === 's') && key === 'h') return { char: 'ش', combinesWithPrev: true };
    if ((prevChar === 'ك' || prevChar === 'ک') && key === 'h') return { char: 'خ', combinesWithPrev: true };
    if ((prevChar === 'c' || prevChar === 'ج') && key === 'h') return { char: 'چ', combinesWithPrev: true };
    if ((prevChar === 'z' || prevChar === 'ز') && key === 'h') return { char: 'ژ', combinesWithPrev: true };
    if (prevChar === 'ا' && key === 'a') return { char: 'آ', combinesWithPrev: true };

    // Persian specific + standard
    const map = {
      'a': 'ا', 'b': 'ب', 'p': 'پ', 't': 'ت', 'j': 'ج', 'c': 'چ',
      'h': 'ه', 'H': 'ح', '7': 'ح', 'x': 'خ', '5': 'خ', 'd': 'د',
      'r': 'ر', 'z': 'ز', 's': 'س', 'S': 'ص', 'Z': 'ض', 'T': 'ط',
      'f': 'ف', 'q': 'ق', 'k': 'ک', 'g': 'گ', 'l': 'ل', 'm': 'م',
      'n': 'ن', 'v': 'و', 'w': 'و', 'u': 'و', 'y': 'ی', 'i': 'ی',
      "'": 'ء', 'A': 'آ'
    };

    if (map[key]) return { char: map[key], combinesWithPrev: false };
    return null;
  }

  textarea.addEventListener('keydown', handleTransliteration);

  // =========================================================================
  // Live Markdown Preview
  // =========================================================================

  function updateLivePreview() {
    if (!previewContent) return;
    const raw = textarea.value;

    let html = '';
    if (window.marked && typeof window.marked.parse === 'function') {
      // Process cross-references in preview
      const processed = raw.replace(/@([a-z]{2,3})(?:\.([a-z_-]+))?\(([^)]+)\)/g, (match, lang, subType, inner) => {
        const label = inner.includes('|') ? inner.split('|')[1].trim() : inner.trim();
        return `<span class="ref-tag" style="pointer-events: none;"><span class="ref-tag-lang">${lang}</span><span class="ref-tag-label">${escapeHtml(label)}</span></span>`;
      });
      html = window.marked.parse(processed);
    } else {
      html = `<pre style="white-space: pre-wrap; font-family: var(--font-body);">${escapeHtml(raw)}</pre>`;
    }

    previewContent.innerHTML = html;
  }

  // =========================================================================
  // Writing Mode & View Mode Switching
  // =========================================================================

  function setWritingMode(mode) {
    currentWritingMode = mode;
    const isRtl = mode === 'arabic' || mode === 'farsi';

    if (isRtl) {
      textarea.classList.add('rtl-mode');
      previewContent.classList.add('rtl-mode');
    } else {
      textarea.classList.remove('rtl-mode');
      previewContent.classList.remove('rtl-mode');
    }

    if (mode === 'standard') {
      guideDrawer.classList.add('collapsed');
      guideToggleBtn.classList.remove('active');
    } else {
      renderGuide(mode);
      guideDrawer.classList.remove('collapsed');
      guideToggleBtn.classList.add('active');
    }
  }

  writingModeSelect.addEventListener('change', (e) => {
    setWritingMode(e.target.value);
    textarea.focus();
  });

  viewModeSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    studioWorkspace.classList.remove('view-edit-only', 'view-preview-only');
    if (val === 'edit') studioWorkspace.classList.add('view-edit-only');
    else if (val === 'preview') studioWorkspace.classList.add('view-preview-only');
  });

  guideToggleBtn.addEventListener('click', () => {
    const isCollapsed = guideDrawer.classList.contains('collapsed');
    if (isCollapsed) {
      const mode = currentWritingMode === 'standard' ? 'arabic' : currentWritingMode;
      renderGuide(mode);
      guideDrawer.classList.remove('collapsed');
      guideToggleBtn.classList.add('active');
    } else {
      guideDrawer.classList.add('collapsed');
      guideToggleBtn.classList.remove('active');
    }
  });

  guideCloseBtn.addEventListener('click', () => {
    guideDrawer.classList.add('collapsed');
    guideToggleBtn.classList.remove('active');
  });

  // =========================================================================
  // Letter Guide Drawer Rendering
  // =========================================================================

  function renderGuide(mode, filterQuery = '') {
    let guideData = [];
    let title = '';
    let instruction = '';

    if (mode === 'arabic') {
      guideData = ARABIC_GUIDE;
      title = 'Arabic Letters (العربية)';
      instruction = 'Type Latin phonetic keys to produce Arabic letters. Click any letter to insert directly.';
    } else if (mode === 'farsi') {
      guideData = FARSI_GUIDE;
      title = 'Farsi Alphabet (فارسی)';
      instruction = 'Includes Persian specific letters (پ, چ, ژ, گ). Type Latin keys or click to insert.';
    } else if (mode === 'greek') {
      guideData = GREEK_GUIDE;
      title = 'Greek Alphabet (Ελληνικά)';
      instruction = "Type 'th' for θ, 'ps' for ψ, 'ch' for χ, 'w' for ω, and ' after vowel for accents (ά, έ). Click to insert.";
    }

    guideTitle.textContent = title;
    guideInstruction.textContent = instruction;

    const q = filterQuery.trim().toLowerCase();
    const filtered = guideData.filter(item => {
      if (!q) return true;
      return item.char.includes(q) || item.name.toLowerCase().includes(q) || item.key.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q);
    });

    guideList.innerHTML = filtered.map(item => `
      <div class="dev-guide-row" data-insert-char="${escapeHtml(item.char)}" title="${escapeHtml(item.desc)}">
        <div class="dev-guide-char-box">
          <span class="dev-guide-char">${item.char}</span>
          <span class="dev-guide-name">${escapeHtml(item.name)}</span>
        </div>
        <span class="dev-guide-key">${escapeHtml(item.key)}</span>
      </div>
    `).join('');
  }

  guideSearchInput.addEventListener('input', (e) => {
    renderGuide(currentWritingMode, e.target.value);
  });

  guideList.addEventListener('click', (e) => {
    const row = e.target.closest('[data-insert-char]');
    if (!row) return;
    const char = row.getAttribute('data-insert-char');
    if (!char) return;

    textarea.focus();
    document.execCommand('insertText', false, char);
    updateLivePreview();
    updateWordCount();
  });

  // =========================================================================
  // Open / Save Editor Workflows
  // =========================================================================

  async function openEditor(filepath) {
    activeFilepath = filepath;
    filepathLabel.textContent = filepath;
    statusMsg.textContent = 'Loading...';
    editorOverlay.classList.add('open');
    await loadSearchIndex();

    // Auto-detect writing mode from language folder (e.g. ar -> arabic, fa -> farsi, grc/el -> greek)
    if (filepath.startsWith('ar/')) {
      writingModeSelect.value = 'arabic';
      setWritingMode('arabic');
    } else if (filepath.startsWith('fa/')) {
      writingModeSelect.value = 'farsi';
      setWritingMode('farsi');
    } else if (filepath.startsWith('grc/') || filepath.startsWith('el/')) {
      writingModeSelect.value = 'greek';
      setWritingMode('greek');
    } else {
      writingModeSelect.value = 'standard';
      setWritingMode('standard');
    }

    try {
      const res = await fetch(`/api/raw?filepath=${encodeURIComponent(filepath)}`);
      if (res.ok) {
        const text = await res.text();
        textarea.value = text;
        statusMsg.textContent = '';
        updateWordCount();
        updateLivePreview();
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
    updateLivePreview();
    checkReferenceTrigger();
  });

  textarea.addEventListener('click', () => {
    checkReferenceTrigger();
  });

  textarea.addEventListener('keyup', (e) => {
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

    const match = textBeforeCaret.match(/@([a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF.-]*)$/);
    if (!match) {
      closeSuggestions();
      return;
    }

    const query = match[1].toLowerCase();
    triggerStartPos = caretPos - match[0].length;

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

    if (screenTop < textareaRect.top - 10 || screenTop > textareaRect.bottom + 10) {
      screenTop = textareaRect.top + 40;
    }
    if (screenLeft < textareaRect.left - 10 || screenLeft > textareaRect.right + 10) {
      screenLeft = textareaRect.left + 24;
    }

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
    updateLivePreview();
  }

  function closeSuggestions() {
    suggestPopup.classList.remove('open');
    activeSuggestions = [];
    selectedSuggestIndex = 0;
    triggerStartPos = -1;
  }

  suggestPopup.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const itemEl = e.target.closest('.dev-suggest-item');
    if (!itemEl) return;
    const idx = parseInt(itemEl.getAttribute('data-idx'), 10);
    if (!isNaN(idx) && activeSuggestions[idx]) {
      insertSuggestion(activeSuggestions[idx]);
    }
  });

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
