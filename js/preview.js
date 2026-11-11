/**
 * MiniPad Preview v1.5.9
 * - marked + marked-katex-extension; il codice (fenced/inline) è gestito nativamente da marked
 * - Mermaid tramite renderer dedicato per i blocchi ```mermaid
 * - Normalizzazione matematica conservativa (MiniPadSmartPaste.normalizeForRender)
 * - Salti pagina riconosciuti solo fuori dai blocchi di codice
 * - DOMPurify su output finale
 */
window.MiniPadPreview = (function () {
  let _el = null;
  let _debounceTimer = null;
  let _initialized = false;

  function generateRenderId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return 'r' + crypto.randomUUID().replace(/-/g, '').slice(0, 10);
    }
    return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function init() {
    if (_initialized) return;
    _initialized = true;

    if (typeof marked === 'undefined') {
      console.error('[Preview] marked non caricato');
      return;
    }

    if (typeof markedKatex === 'function') {
      marked.use(
        markedKatex({
          throwOnError: false,
          displayMode: false,
          output: 'htmlAndMathml',
          nonStandard: true,
          strict: false
        })
      );
    }

    // Blocchi ```mermaid → <pre class="mermaid"> (gli altri blocchi usano il renderer standard).
    // Il codice è gestito nativamente da marked: nessun placeholder, nessuna alterazione.
    marked.use({
      renderer: {
        code(token, langArg) {
          const lang = (typeof token === 'object' && token !== null ? token.lang : langArg) || '';
          const text = typeof token === 'object' && token !== null ? token.text : token;
          if (String(lang).trim().split(/\s+/)[0] === 'mermaid') {
            return `<pre class="mermaid">${escapeHtml(text)}</pre>\n`;
          }
          return false;
        }
      }
    });

    if (typeof mermaid !== 'undefined') {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'strict',
        fontFamily: 'inherit',
        htmlLabels: false
      });
    }
  }

  const PAGEBREAK_RX = /^[ \t]*(?:\\pagebreak|<!--\s*pagebreak\s*-->|---pagebreak---|===pagebreak===)[ \t]*$/gim;
  const PAGEBREAK_HTML = '\n\n<div class="page-break"></div>\n\n';

  /** Prepara il sorgente: salti pagina e normalizzazione matematica, mai dentro il codice. */
  function prepareSource(markdown) {
    let source = String(markdown || '');
    const SP = typeof MiniPadSmartPaste !== 'undefined' ? MiniPadSmartPaste : null;
    if (SP && SP.mapProse) {
      source = SP.mapProse(source, t => t.replace(PAGEBREAK_RX, PAGEBREAK_HTML));
    } else {
      source = source.replace(PAGEBREAK_RX, PAGEBREAK_HTML);
    }
    if (SP && SP.normalizeForRender) source = SP.normalizeForRender(source);
    return source;
  }

  function renderToHTML(markdown) {
    init();
    if (typeof marked === 'undefined') return escapeHtml(markdown || '');

    const source = prepareSource(markdown);

    let html;
    try {
      html = marked.parse(source);
    } catch (e) {
      console.error('[Preview] parse error', e);
      html = `<pre>${escapeHtml(source)}</pre>`;
    }

    if (typeof DOMPurify !== 'undefined') {
      html = DOMPurify.sanitize(html, {
        ADD_ATTR: ['class', 'style', 'data-tex'],
        ADD_TAGS: ['use'],
        USE_PROFILES: { html: true, svg: true, svgFilters: true }
      });
    }

    return html;
  }

  function getEl() {
    if (!_el) _el = document.getElementById('preview-content');
    return _el;
  }

  function updatePreviewWithContent(content) {
    init();
    const el = getEl();
    if (!el) return;

    if (content === undefined || content === null) {
      el.innerHTML = '';
      return;
    }

    el.innerHTML = renderToHTML(content);

    if (typeof mermaid !== 'undefined') {
      const nodes = el.querySelectorAll('pre.mermaid');
      if (nodes.length) {
        try {
          mermaid.run({ nodes: Array.from(nodes) });
        } catch (e) {
          console.warn('[Preview] mermaid.render failed', e);
        }
      }
    }
  }

  function updatePreviewDebounced(content, delay = 60) {
    if (_debounceTimer) clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => {
      _debounceTimer = null;
      updatePreviewWithContent(content);
    }, delay);
  }

  return {
    init,
    renderToHTML,
    updatePreviewWithContent,
    updatePreviewDebounced,
    prepareSource,
    generateRenderId,
    escapeHtml
  };
})();

// Funzioni ponte globali per retrocompatibilità con editor.js e main.js
function updatePreview() {
  if (typeof getEditorContent === 'function') {
    MiniPadPreview.updatePreviewWithContent(getEditorContent());
  }
}

function updatePreviewWithContent(content) {
  MiniPadPreview.updatePreviewWithContent(content);
}

function parseMarkdown(markdown) {
  return MiniPadPreview.renderToHTML(markdown);
}
