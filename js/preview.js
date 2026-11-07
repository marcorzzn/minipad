/**
 * MiniPad Preview v1.5.3.1
 * - marked + marked-katex-extension
 * - Renderer Mermaid via post-processing
 * - DOMPurify su output finale
 * - Placeholder nonce-based: MP-{id}-CODE-N / MP-{id}-ICODE-N / MP-{id}-CUR-N
 * - Bug fix v1.5.3.1:
 *   C1: collisione placeholder con testo utente (nonce random per render)
 *   C5: doppi backtick (multi-backtick estrae PRIMA dei singoli)
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

  /**
   * Protegge i blocchi di codice (fence multipli PRIMA dei singoli)
   * e le valute escape \$N.
   * Ritorna { md, codeBlocks, currencies, rid }
   */
  function protectCodeAndCurrency(md, rid) {
    const codeBlocks = [];
    const currencies = [];

    // 1. Fenced code ```lang\n...\n```
    md = md.replace(/```([\w-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      const escaped = escapeHtml(code.replace(/\n$/, ''));
      const cls = lang ? ` class="language-${lang}"` : '';
      codeBlocks.push({
        html: `<pre><code${cls}>${escaped}</code></pre>`,
        lang,
        raw: code.replace(/\n$/, '')
      });
      return `\n\nMP-${rid}-CODE-${codeBlocks.length - 1}\n\n`;
    });

    // 2. Inline code con fence multipli ``...`` (PRIMA dei singoli)
    md = md.replace(/(`{2,})((?:[^`]|`(?![`]))*?)\1/g, (_, fence, code) => {
      // CommonMark: se inizia e finisce con spazio (ma non è tutto spazio), rimuovi uno spazio
      if (code.length >= 2 && code.startsWith(' ') && code.endsWith(' ') && code.trim()) {
        code = code.slice(1, -1);
      }
      const escaped = escapeHtml(code);
      codeBlocks.push({
        html: `<code>${escaped}</code>`,
        lang: '',
        raw: code,
        inline: true
      });
      return `MP-${rid}-ICODE-${codeBlocks.length - 1}`;
    });

    // 3. Inline code con fence singoli `...` (dopo i multi)
    md = md.replace(/`([^`\n]+)`/g, (_, code) => {
      const escaped = escapeHtml(code);
      codeBlocks.push({
        html: `<code>${escaped}</code>`,
        lang: '',
        raw: code,
        inline: true
      });
      return `MP-${rid}-ICODE-${codeBlocks.length - 1}`;
    });

    // 4. Valute escape \$N (dopo i code, prima della math)
    md = md.replace(/\\\$(\d[\d.,]*)/g, (_, amount) => {
      currencies.push(amount);
      return `MP-${rid}-CUR-${currencies.length - 1}`;
    });

    return { md, codeBlocks, currencies };
  }

  /**
   * Ripristina placeholder. Con nonce, non serve loop.
   */
  function restoreAll(html, codeBlocks, currencies, rid) {
    // Mermaid: promuovi CODE con lang==='mermaid' a <pre class="mermaid">
    html = html.replace(
      new RegExp(`MP-${rid}-CODE-(\\d+)`, 'g'),
      (_, i) => {
        const b = codeBlocks[+i];
        if (!b) return '';
        if (b.lang === 'mermaid') {
          return `<pre class="mermaid">${escapeHtml(b.raw)}</pre>`;
        }
        return b.html;
      }
    );

    html = html.replace(
      new RegExp(`MP-${rid}-ICODE-(\\d+)`, 'g'),
      (_, i) => codeBlocks[+i] ? codeBlocks[+i].html : ''
    );

    html = html.replace(
      new RegExp(`MP-${rid}-CUR-(\\d+)`, 'g'),
      (_, i) => `$${currencies[+i]}`
    );

    return html;
  }

  function renderToHTML(markdown) {
    init();
    if (typeof marked === 'undefined') return escapeHtml(markdown || '');

    const rid = generateRenderId();
    // Normalizza scorciatoie salto pagina (\pagebreak, <!-- pagebreak -->, ---pagebreak---) in <div class="page-break"></div>
    let source = String(markdown || '').replace(
      /^[ \t]*(?:\\pagebreak|<!--\s*pagebreak\s*-->|---pagebreak---|===pagebreak===)[ \t]*$/gim,
      '\n\n<div class="page-break"></div>\n\n'
    );

    // Pipeline Universale di Normalizzazione Matematica (LLM, doppi backslash, escaping, HTML KaTeX/Wikipedia)
    if (typeof MiniPadSmartPaste !== 'undefined' && typeof MiniPadSmartPaste.normalizeAllMath === 'function') {
      source = MiniPadSmartPaste.normalizeAllMath(source);
    } else if (typeof window !== 'undefined' && typeof window.normalizeAllMath === 'function') {
      source = window.normalizeAllMath(source);
    }

    const { md: protectedMd, codeBlocks, currencies } = protectCodeAndCurrency(source, rid);

    let html;
    try {
      html = marked.parse(protectedMd);
    } catch (e) {
      console.error('[Preview] parse error', e);
      html = `<pre>${escapeHtml(source)}</pre>`;
    }

    html = restoreAll(html, codeBlocks, currencies, rid);

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
