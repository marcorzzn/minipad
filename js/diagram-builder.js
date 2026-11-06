/**
 * MiniPad v1.5.4.1 — Diagram Builder
 * Modale centrale per creare diagrammi Mermaid da zero.
 * - Tab per tipo (Flowchart, Sequence, Class, State, Pie, Mindmap, Git)
 * - Template predefiniti con icone
 * - Editor codice con preview live (debounce 250ms)
 * - Inserimento al cursore dell'editor (EasyMDE/CodeMirror)
 */
window.MiniPadDiagramBuilder = (function () {
  let _overlay = null;
  let _codeArea = null;
  let _preview = null;
  let _insertBtn = null;
  let _tabsEl = null;
  let _tplListEl = null;
  let _previewTimer = null;
  let _renderCounter = 0;
  let _currentType = 'flowchart';
  let _lastFocused = null;

  const TEMPLATES = {
    flowchart: {
      label: 'Flowchart',
      icon: '<svg viewBox="0 0 22 22"><rect x="2" y="2" width="8" height="6" stroke-width="1.5"/><rect x="12" y="14" width="8" height="6" stroke-width="1.5"/><path d="M6 8v3a2 2 0 0 0 2 2h4a2 2 0 0 1 2 2v-1" stroke-width="1.5" fill="none"/></svg>',
      templates: {
        'TD (base)': 'graph TD\n    A[Start] --> B{Decisione}\n    B -->|Sì| C[Azione 1]\n    B -->|No| D[Azione 2]\n    C --> E[Fine]\n    D --> E',
        'LR (orizzontale)': 'graph LR\n    A[Input] --> B[Processo]\n    B --> C[Output]',
        'Con sotto-processi': 'graph TD\n    A[Start] --> B{Check}\n    B -->|OK| C[Sub1]\n    B -->|KO| D[Sub2]\n    subgraph C[Sub1]\n        C1[Task A] --> C2[Task B]\n    end\n    C --> E[End]'
      }
    },
    sequence: {
      label: 'Sequence',
      icon: '<svg viewBox="0 0 22 22"><rect x="2" y="2" width="4" height="18" stroke-width="1.5"/><rect x="9" y="2" width="4" height="18" stroke-width="1.5"/><rect x="16" y="2" width="4" height="18" stroke-width="1.5"/><path d="M4 8h5M11 12h5" stroke-width="1.5"/></svg>',
      templates: {
        'Base': 'sequenceDiagram\n    participant A as Alice\n    participant B as Bob\n    A->>B: Ciao Bob\n    B-->>A: Ciao Alice',
        'Con attivazione': 'sequenceDiagram\n    participant U as Utente\n    participant S as Server\n    U->>+S: Richiesta\n    S-->>-U: Risposta',
        'Errori': 'sequenceDiagram\n    participant C as Client\n    participant S as Server\n    C->>S: GET /api\n    alt 200 OK\n        S-->>C: { data }\n    else 404\n        S-->>C: Not Found\n    end'
      }
    },
    class: {
      label: 'Class',
      icon: '<svg viewBox="0 0 22 22"><rect x="2" y="2" width="18" height="18" stroke-width="1.5"/><path d="M2 8h18M2 14h18" stroke-width="1"/></svg>',
      templates: {
        'Base': 'classDiagram\n    class Animale {\n        +String nome\n        +mangia()\n    }\n    class Cane {\n        +abbaia()\n    }\n    Animale <|-- Cane',
        'Interfacce': 'classDiagram\n    class Forma {\n        <<interface>>\n        +area()\n    }\n    class Cerchio {\n        +float raggio\n        +area()\n    }\n    Forma <|.. Cerchio'
      }
    },
    state: {
      label: 'State',
      icon: '<svg viewBox="0 0 22 22"><circle cx="4" cy="11" r="2" stroke-width="1.5"/><rect x="8" y="7" width="8" height="8" stroke-width="1.5"/><circle cx="19" cy="11" r="1.5" fill="currentColor"/><path d="M6 11h2M16 11h1.5" stroke-width="1.5"/></svg>',
      templates: {
        'Base': 'stateDiagram-v2\n    [*] --> Idle\n    Idle --> Loading : fetch()\n    Loading --> Success : 200\n    Loading --> Error : 4xx/5xx\n    Success --> [*]\n    Error --> Idle',
        'Con scelte': 'stateDiagram-v2\n    state "Verifica" as V\n    [*] --> V\n    V --> OK : valido\n    V --> KO : invalido\n    OK --> [*]\n    KO --> V'
      }
    },
    pie: {
      label: 'Pie',
      icon: '<svg viewBox="0 0 22 22"><path d="M11 2a9 9 0 1 0 0 18A9 9 0 0 0 11 2zm0 9V2l7 5z" stroke-width="1.5" fill="none"/></svg>',
      templates: {
        'Base': 'pie title Distribuzione\n    "JavaScript" : 60\n    "Python" : 25\n    "Rust" : 15',
        'Con percentuali': 'pie showData\n    title Traffic\n    "Desktop" : 45\n    "Mobile" : 40\n    "Tablet" : 15'
      }
    },
    mindmap: {
      label: 'Mindmap',
      icon: '<svg viewBox="0 0 22 22"><circle cx="11" cy="11" r="3" stroke-width="1.5"/><circle cx="3" cy="4" r="2" stroke-width="1.5"/><circle cx="19" cy="4" r="2" stroke-width="1.5"/><circle cx="3" cy="18" r="2" stroke-width="1.5"/><circle cx="19" cy="18" r="2" stroke-width="1.5"/><path d="M8.5 9.5L4.5 5.5M13.5 9.5l4-4M8.5 12.5l-4 4M13.5 12.5l4 4" stroke-width="1.5"/></svg>',
      templates: {
        'Base': 'mindmap\n  root((Centro))\n    Ramo 1\n      Foglia 1\n    Ramo 2\n      Foglia 2\n    Ramo 3',
        'Progetto': 'mindmap\n  root((Progetto))\n    Ideazione\n      Ricerca\n      Brainstorming\n    Sviluppo\n      Design\n      Coding\n    Test\n      QA\n      Deploy'
      }
    },
    git: {
      label: 'Git',
      icon: '<svg viewBox="0 0 22 22"><circle cx="5" cy="5" r="2" stroke-width="1.5"/><circle cx="5" cy="17" r="2" stroke-width="1.5"/><circle cx="17" cy="11" r="2" stroke-width="1.5"/><path d="M5 7v8M7 5h5a5 5 0 0 1 5 5v0" stroke-width="1.5" fill="none"/></svg>',
      templates: {
        'Feature branch': 'gitGraph\n    commit\n    branch feature\n    checkout feature\n    commit\n    commit\n    checkout main\n    merge feature\n    commit'
      }
    }
  };

  /* ===== Helpers ===== */
  function getEditorInstance() {
    if (typeof easyMDE !== 'undefined' && easyMDE && easyMDE.codemirror) return easyMDE;
    if (window.easyMDE && window.easyMDE.codemirror) return window.easyMDE;
    if (window.easyMDEInstance && window.easyMDEInstance.codemirror) return window.easyMDEInstance;
    if (window.editor && typeof window.editor.replaceSelection === 'function') return window.editor;
    const el = document.querySelector('.EasyMDEContainer .CodeMirror');
    if (el && el.CodeMirror) return el.CodeMirror;
    return null;
  }

  function insertAtCursor(text) {
    if (typeof insertDiagramAtCursor === 'function') {
      insertDiagramAtCursor(text);
      return true;
    }
    const cm = getEditorInstance();
    if (cm && typeof cm.replaceSelection === 'function') {
      cm.replaceSelection(text);
      if (typeof cm.focus === 'function') cm.focus();
      return true;
    }
    if (cm && cm.codemirror && typeof cm.codemirror.replaceSelection === 'function') {
      cm.codemirror.replaceSelection(text);
      cm.codemirror.focus();
      return true;
    }
    const ta = document.querySelector('#editor textarea, textarea#editor, #preview-content');
    if (ta && typeof ta.value === 'string') {
      const start = ta.selectionStart || 0;
      const end = ta.selectionEnd || 0;
      ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
      ta.selectionStart = ta.selectionEnd = start + text.length;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.focus();
      return true;
    }
    return false;
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ===== Preview ===== */
  function renderPreview() {
    if (!_preview || !_codeArea) return;
    const code = _codeArea.value.trim();

    if (!code) {
      _preview.innerHTML = '<div class="mp-preview-empty">La preview apparirà qui</div>';
      if (_insertBtn) _insertBtn.disabled = true;
      return;
    }

    if (typeof mermaid === 'undefined') {
      _preview.innerHTML = '<div class="mp-preview-error">Mermaid non è caricato.</div>';
      return;
    }

    const id = 'mp-diag-' + (++_renderCounter) + '-' + Date.now().toString(36);

    try {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        htmlLabels: false,
        theme: document.body.classList.contains('force-dark') ||
               document.body.classList.contains('dark-mode') ||
               (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
               ? 'dark' : 'default'
      });
      const result = mermaid.render(id, code);
      const handle = (svg) => {
        _preview.innerHTML = svg;
        if (_insertBtn) _insertBtn.disabled = false;
      };
      if (result && typeof result.then === 'function') {
        result.then((r) => handle(r.svg || r)).catch((err) => showError(err));
      } else if (result && result.svg) {
        handle(result.svg);
      } else {
        showError(new Error('Output Mermaid non riconosciuto'));
      }
    } catch (err) {
      showError(err);
    }
  }

  function showError(err) {
    const msg = (err && (err.str || err.message)) || 'Errore di sintassi Mermaid';
    _preview.innerHTML = '<div class="mp-preview-error">' + escapeHtml(msg) + '</div>';
    if (_insertBtn) _insertBtn.disabled = false; // permette comunque inserimento
    // Rimuove eventuale SVG orfano da mermaid.render fallito
    const orphan = document.querySelector('#' + (err && err.id || 'mp-diag-') + ' svg');
    if (orphan && orphan.parentNode) orphan.parentNode.removeChild(orphan);
  }

  function schedulePreview() {
    if (_previewTimer) clearTimeout(_previewTimer);
    _previewTimer = setTimeout(renderPreview, 250);
  }

  /* ===== Tabs & Templates ===== */
  function buildTabs() {
    _tabsEl.innerHTML = '';
    Object.keys(TEMPLATES).forEach((key) => {
      const btn = document.createElement('button');
      btn.className = 'mp-modal-tab' + (key === _currentType ? ' is-active' : '');
      btn.dataset.type = key;
      btn.textContent = TEMPLATES[key].label;
      btn.onclick = () => selectType(key);
      _tabsEl.appendChild(btn);
    });
  }

  function selectType(key) {
    _currentType = key;
    Array.from(_tabsEl.children).forEach((b) => {
      b.classList.toggle('is-active', b.dataset.type === key);
    });
    buildTemplateList();
    const tpls = TEMPLATES[key].templates;
    const firstKey = Object.keys(tpls)[0];
    _codeArea.value = tpls[firstKey];
    schedulePreview();
  }

  function buildTemplateList() {
    _tplListEl.innerHTML = '';
    const tpls = TEMPLATES[_currentType].templates;
    Object.keys(tpls).forEach((name) => {
      const btn = document.createElement('button');
      btn.className = 'mp-tpl-btn';
      btn.innerHTML = TEMPLATES[_currentType].icon + '<span>' + escapeHtml(name) + '</span>';
      btn.onclick = () => {
        _codeArea.value = tpls[name];
        Array.from(_tplListEl.children).forEach((b) => b.classList.remove('is-selected'));
        btn.classList.add('is-selected');
        schedulePreview();
      };
      _tplListEl.appendChild(btn);
    });
  }

  /* ===== Open / Close ===== */
  function open() {
    if (!_overlay) return;
    _lastFocused = document.activeElement;
    _overlay.classList.add('is-open');
    document.body.classList.add('mp-modal-open');

    buildTabs();
    selectType(_currentType);

    setTimeout(() => {
      if (_codeArea) {
        _codeArea.focus();
        _codeArea.setSelectionRange(0, 0);
      }
    }, 50);
  }

  function close() {
    if (!_overlay) return;
    _overlay.classList.remove('is-open');
    document.body.classList.remove('mp-modal-open');
    if (_lastFocused && typeof _lastFocused.focus === 'function') {
      _lastFocused.focus();
      _lastFocused = null;
    }
  }

  function handleInsert() {
    if (!_codeArea) return;
    const code = _codeArea.value.trim();
    if (!code) return;
    const wrapped = '\n```mermaid\n' + code + '\n```\n';
    const ok = insertAtCursor(wrapped);
    if (ok) {
      close();
      if (typeof window.updatePreview === 'function') {
        try { window.updatePreview(); } catch (e) { /* noop */ }
      }
    } else {
      alert('Impossibile inserire: nessun editor attivo trovato.');
    }
  }

  /* ===== Setup ===== */
  function buildDOM() {
    _overlay = document.createElement('div');
    _overlay.className = 'mp-modal-overlay';
    _overlay.innerHTML = `
      <div class="mp-modal" role="dialog" aria-modal="true" aria-labelledby="mp-diag-title">
        <div class="mp-modal-header">
          <h2 id="mp-diag-title">Inserisci diagramma</h2>
          <button class="mp-modal-close" type="button" aria-label="Chiudi">
            <svg class="mp-i"><use href="#i-close"/></svg>
          </button>
        </div>
        <div class="mp-modal-tabs" role="tablist"></div>
        <div class="mp-modal-body">
          <div class="mp-modal-col">
            <h3 class="mp-modal-section-title">Template</h3>
            <div class="mp-tpl-list"></div>
            <h3 class="mp-modal-section-title">Codice Mermaid</h3>
            <textarea class="mp-code-editor" spellcheck="false" autocapitalize="off" autocorrect="off"></textarea>
          </div>
          <div class="mp-modal-col">
            <h3 class="mp-modal-section-title">Anteprima live</h3>
            <div class="mp-preview-wrap"></div>
          </div>
        </div>
        <div class="mp-modal-footer">
          <button class="mp-modal-btn" type="button" data-action="cancel">Annulla</button>
          <button class="mp-modal-btn is-primary" type="button" data-action="insert">Inserisci nell'editor</button>
        </div>
      </div>
    `;
    document.body.appendChild(_overlay);

    _tabsEl = _overlay.querySelector('.mp-modal-tabs');
    _tplListEl = _overlay.querySelector('.mp-tpl-list');
    _codeArea = _overlay.querySelector('.mp-code-editor');
    _preview = _overlay.querySelector('.mp-preview-wrap');
    _insertBtn = _overlay.querySelector('[data-action="insert"]');

    _codeArea.addEventListener('input', schedulePreview);
    _codeArea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = _codeArea.selectionStart;
        const end = _codeArea.selectionEnd;
        _codeArea.value = _codeArea.value.slice(0, start) + '  ' + _codeArea.value.slice(end);
        _codeArea.selectionStart = _codeArea.selectionEnd = start + 2;
        schedulePreview();
      }
    });

    _overlay.querySelector('.mp-modal-close').addEventListener('click', close);
    _overlay.querySelector('[data-action="cancel"]').addEventListener('click', close);
    _insertBtn.addEventListener('click', handleInsert);

    _overlay.addEventListener('mousedown', (e) => {
      if (e.target === _overlay) close();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && _overlay.classList.contains('is-open')) {
        e.stopPropagation();
        close();
      }
    }, true);
  }

  function init() {
    if (_overlay) return;
    buildDOM();
  }

  return { init, open, close };
})();

document.addEventListener('DOMContentLoaded', function () {
  window.MiniPadDiagramBuilder.init();
});

window.openDiagramModal = function () {
  if (window.MiniPadDiagramBuilder) window.MiniPadDiagramBuilder.open();
};

