/**
 * MiniPad Preview
 * - Pipeline robusta: protegge i blocchi di codice (fenced e inline) PRIMA di processare Markdown e KaTeX
 * - marked + marked-katex-extension per il parsing matematico
 * - Mermaid integrato con securityLevel: 'strict' e htmlLabels: false (prevenzione XSS)
 * - Promozione automatica dei blocchi ```mermaid in <pre class="mermaid"> post-parse
 * - DOMPurify per la sanitizzazione finale
 * - Gestione immediata dell'azzeramento anteprima su nota vuota
 * - Debounce a 60ms per preview a 60 FPS
 */
window.MiniPadPreview = (function () {
  let _el = null;
  let _debounceTimer = null;
  let _initialized = false;

  function init() {
    if (_initialized) return;
    _initialized = true;

    if (typeof marked === 'undefined') {
      console.warn('[Preview] marked non disponibile');
      return;
    }

    // Configura marked-katex-extension
    if (typeof markedKatex === 'function') {
      try {
        marked.use(
          markedKatex({
            throwOnError: false,
            displayMode: false,
            output: 'htmlAndMathml',
            nonStandard: true,
            strict: false
          })
        );
      } catch (e) {
        console.warn('[Preview] Inizializzazione markedKatex con fallback:', e);
        try { marked.use(markedKatex({ throwOnError: false })); } catch (e2) {}
      }
    }

    // Inizializza Mermaid con impostazioni di massima sicurezza (no XSS)
    if (typeof mermaid !== 'undefined') {
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: document.body.classList.contains('dark-mode') ? 'dark' : 'default',
          securityLevel: 'strict', // Sicurezza attiva: nessun HTML arbitrario nelle label
          fontFamily: 'inherit',
          htmlLabels: false
        });
      } catch (err) {
        console.warn('[Preview] Inizializzazione Mermaid fallita:', err);
      }
    }
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getEl() {
    if (!_el) _el = document.getElementById('preview-content');
    return _el;
  }

  /**
   * Protegge i blocchi di codice (fenced e inline) trasformandoli in
   * segnaposto HTML che marked lascia intatti senza far processare la matematica.
   */
  function protectCodeBlocks(md) {
    const codeBlocks = [];

    // 1. Fenced code ```lang\n...\n```
    md = md.replace(/```([\w-]*)\r?\n?([\s\S]*?)```/g, (_, lang, code) => {
      const escaped = escapeHtml(code.replace(/\r?\n$/, ''));
      const cleanLang = (lang || '').trim().toLowerCase();
      const cls = cleanLang ? ` class="language-${cleanLang}"` : '';
      codeBlocks.push({
        html: `<pre><code${cls}>${escaped}</code></pre>`,
        lang: cleanLang,
        rawCode: code.replace(/\r?\n$/, '')
      });
      return `\n\n<div data-codeblock="${codeBlocks.length - 1}"></div>\n\n`;
    });

    // 2. Inline code `...` (usiamo <span> per non spezzare il paragrafo inline)
    md = md.replace(/`([^`\r\n]+)`/g, (_, code) => {
      const escaped = escapeHtml(code);
      codeBlocks.push({
        html: `<code>${escaped}</code>`,
        lang: '',
        rawCode: code
      });
      return `<span data-inlinecode="${codeBlocks.length - 1}"></span>`;
    });

    return { md, codeBlocks };
  }

  /**
   * Estrae il testo grezzo dal blocco code
   */
  function extractCodeContent(preHtml) {
    const m = preHtml.match(/<code[^>]*>([\s\S]*?)<\/code>/);
    return m ? m[1] : '';
  }

  /**
   * Ripristina i blocchi di codice proteggendoli da marked e KaTeX,
   * e promuove i blocchi ```mermaid in <pre class="mermaid">.
   */
  function restoreCodeBlocks(html, codeBlocks) {
    // Ripristina blocchi multiriga
    html = html.replace(/<div data-codeblock="(\d+)"><\/div>/g, (_, i) => {
      const b = codeBlocks[+i];
      if (!b) return '';
      if (b.lang === 'mermaid') {
        // Escapa le label ma lascia la sintassi Mermaid intatta
        return `<pre class="mermaid">${escapeHtml(b.rawCode)}</pre>`;
      }
      return b.html;
    });

    // Ripristina inline code
    html = html.replace(/<span data-inlinecode="(\d+)"><\/span>/g, (_, i) => {
      const b = codeBlocks[+i];
      return b ? b.html : '';
    });

    return html;
  }

  /**
   * Genera l'HTML renderizzato a partire dal Markdown.
   * Utilizzato sia per l'anteprima live che per l'export (.html / .pdf).
   */
  function renderToHTML(markdown) {
    init();
    if (markdown === undefined || markdown === null || !markdown.trim()) {
      return '';
    }

    let md = String(markdown || '');

    // 1. Normalizza la sintassi LaTeX da LLM prima del parsing, ma RISPETTANDO i code block
    if (typeof MiniPadSmartPaste !== 'undefined') {
      md = MiniPadSmartPaste.normalizeLLMMath(md);
    }

    // 2. Proteggi tutti i blocchi di codice (fenced e inline)
    const { md: protectedMd, codeBlocks } = protectCodeBlocks(md);

    // 3. Esegui il parsing con marked (marked-katex-extension processa solo il testo fuori dal codice)
    let html = '';
    try {
      html = marked.parse(protectedMd);
    } catch (e) {
      console.error('[Preview] Errore parsing marked:', e);
      html = `<pre>${escapeHtml(md)}</pre>`;
    }

    // 4. Ripristina i blocchi di codice e promuovi i blocchi Mermaid
    html = restoreCodeBlocks(html, codeBlocks);

    // 5. Sanitizzazione sicura con DOMPurify
    if (typeof DOMPurify !== 'undefined') {
      try {
        html = DOMPurify.sanitize(html, {
          ADD_TAGS: [
            'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon',
            'defs', 'marker', 'text', 'tspan', 'g', 'style', 'foreignObject',
            'annotation', 'semantics', 'math', 'mrow', 'mi', 'mo', 'mn', 'msup',
            'msub', 'mfrac', 'mover', 'munder', 'munderover', 'mtable', 'mtr', 'mtd',
            'use'
          ],
          ADD_ATTR: [
            'cx', 'cy', 'r', 'x', 'y', 'width', 'height', 'rx', 'ry', 'd',
            'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap',
            'stroke-linejoin', 'transform', 'marker-end', 'marker-start',
            'text-anchor', 'class', 'style', 'viewBox', 'data-tex', 'encoding',
            'xmlns', 'aria-hidden', 'data-codeblock', 'data-inlinecode'
          ]
        });
      } catch (e) {
        console.warn('[Preview] DOMPurify sanitize warning:', e);
      }
    }

    return html;
  }

  /**
   * Aggiorna l'elemento di anteprima del DOM.
   */
  async function updatePreviewWithContent(content) {
    init();
    const el = getEl();
    if (!el) return;

    // Azzeramento immediato se il contenuto è vuoto o null
    if (content === undefined || content === null || !content.trim()) {
      el.innerHTML = '';
      return;
    }

    const html = renderToHTML(content);
    el.innerHTML = html;

    // Renderizza i blocchi Mermaid presenti con gestione errori
    if (typeof mermaid !== 'undefined') {
      const mermaidNodes = el.querySelectorAll('.mermaid');
      if (mermaidNodes.length > 0) {
        try {
          await mermaid.run({ nodes: Array.from(mermaidNodes) });
        } catch (err) {
          console.warn('[Preview] Mermaid run error:', err);
        }
      }
    }
  }

  /**
   * Wrapper con debounce per l'evento input (60ms).
   */
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
    updatePreviewDebounced
  };
})();

// Funzioni ponte globali per retrocompatibilità
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
