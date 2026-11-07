/**
 * MiniPad Smart Paste
 * - Intercetta paste da ChatGPT/Claude/Gemini/Wikipedia/MathJax/EoM
 * - Estrae LaTeX puro da KaTeX/MathML/alt/script con fallback gerarchico
 * - Converte \(...\) → $...$ e \[...\] → $$...$$
 * - Gestisce i dollari escapati (\$)
 */
window.MiniPadSmartPaste = (function () {
  let turndown = null;

  function init() {
    if (typeof TurndownService === 'undefined') {
      console.warn('[SmartPaste] Turndown non caricato');
      return;
    }
    turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      emDelimiter: '*',
      strongDelimiter: '**'
    });

    // Rimuove stili e script generici ma preserva il contenuto per il nostro estrattore
    turndown.remove(['style']);

    // Regola custom: estrai il LaTeX dai nodi matematici
    turndown.addRule('mathExtract', {
      filter: function (node) {
        if (!node || node.nodeType !== 1) return false;
        const cls = node.classList;
        return (
          (cls && (
            cls.contains('katex') ||
            cls.contains('katex-display') ||
            cls.contains('mwe-math-element') ||
            cls.contains('mwe-math-mathml-display') ||
            cls.contains('tex')
          )) ||
          node.tagName.toLowerCase() === 'math' ||
          (node.tagName.toLowerCase() === 'script' && (node.getAttribute('type') || '').startsWith('math/tex'))
        );
      },
      replacement: function (content, node) {
        const latex = extractLatex(node);
        if (!latex) return content;

        const isBlock =
          (node.classList && (
            node.classList.contains('katex-display') ||
            node.classList.contains('mwe-math-mathml-display')
          )) ||
          (node.tagName.toLowerCase() === 'math' && node.getAttribute('display') === 'block') ||
          (node.querySelector && node.querySelector('.mwe-math-fallback-image-display')) ||
          (node.getAttribute && (node.getAttribute('type') || '').includes('mode=display'));

        return isBlock
          ? `\n\n$$\n${latex}\n$$\n\n`
          : `$${latex}$`;
      }
    });
  }

  /**
   * Estrae il sorgente LaTeX da un nodo DOM con fallback gerarchico.
   */
  function extractLatex(node) {
    if (!node) return '';

    // 1. MathML <annotation encoding="application/x-tex">
    const ann =
      node.querySelector &&
      node.querySelector('annotation[encoding="application/x-tex"]');
    if (ann && ann.textContent.trim()) return cleanMathFormula(ann.textContent.trim());

    // 2. Attributo alttext su <math> o sul nodo
    if (node.getAttribute && (node.getAttribute('alttext') || '').trim()) {
      return cleanMathFormula(node.getAttribute('alttext').trim());
    }
    const mathEl = node.querySelector && node.querySelector('math[alttext]');
    if (mathEl && (mathEl.getAttribute('alttext') || '').trim()) {
      return cleanMathFormula(mathEl.getAttribute('alttext').trim());
    }

    // 3. <script type="math/tex"> (MathJax)
    if (node.tagName && node.tagName.toLowerCase() === 'script' && (node.getAttribute('type') || '').startsWith('math/tex')) {
      return cleanMathFormula((node.textContent || '').trim());
    }
    const scr =
      node.querySelector &&
      node.querySelector('script[type^="math/tex"]');
    if (scr && scr.textContent.trim()) return cleanMathFormula(scr.textContent.trim());

    // 4. Attributo alt sull'elemento stesso
    if (node.getAttribute) {
      const alt = node.getAttribute('alt');
      if (alt && alt.trim()) return cleanMathFormula(alt.trim());
    }

    // 5. <img alt="...">
    const img = node.querySelector && node.querySelector('img[alt]');
    if (img && img.getAttribute('alt') && img.getAttribute('alt').trim()) {
      return cleanMathFormula(img.getAttribute('alt').trim());
    }

    // 6. data-tex o data-latex attribute
    if (node.getAttribute) {
      const dataTex = node.getAttribute('data-tex') || node.getAttribute('data-latex');
      if (dataTex && dataTex.trim()) return cleanMathFormula(dataTex.trim());
    }

    // 7. Fallback per .katex-html
    const kHtml = node.querySelector && node.querySelector('.katex-html');
    if (kHtml && kHtml.textContent.trim()) {
      return cleanMathFormula(kHtml.textContent.trim());
    }

    return '';
  }

  /**
   * Pulisce una formula LaTeX da residui di escaping Markdown, doppi backslash e caratteri orfani.
   */
  function cleanMathFormula(tex) {
    if (!tex) return '';
    let f = String(tex).trim();

    // Rimuove backslash finali orfani (evita che rompano la chiusura $$ o KaTeX)
    f = f.replace(/\\+\s*$/, '').trim();

    // Converte doppi backslash davanti a comandi LaTeX (\\hat -> \hat, \\frac -> \frac, ecc.)
    f = f.replace(/\\\\([a-zA-Z]+)/g, '\\$1');
    f = f.replace(/\\\\([,;!])/g, '\\$1');

    // De-escapa caratteri markdown indebitamente escapati dentro formule:
    // \_ -> _   \* -> *   \^ -> ^   \~ -> ~
    f = f.replace(/\\+([_*^~])/g, '$1');

    // Ripara graffe doppie escapate {\{p\}} o \{\{p\}\} -> {p}
    f = f.replace(/\{\\?\{([^{}]+)\}\\?\}/g, '{$1}');

    // Ripara \mathrm se perso o scritto come mathrm senza backslash:
    f = f.replace(/_\{mathrm\{([^}]+)\}\}/g, '_{\\mathrm{$1}}');
    f = f.replace(/_mathrm\{([^}]+)\}/g, '_{\\mathrm{$1}}');

    return f.trim();
  }

  /**
   * Estrae TeX da snippet HTML grezzi (es. span KaTeX o MediaWiki incollati o presenti nel testo).
   */
  function extractTexFromHtml(html) {
    const annMatch = html.match(/<annotation\s+[^>]*encoding=["']application\/x-tex["'][^>]*>([\s\S]*?)<\/annotation>/i);
    let tex = annMatch ? annMatch[1].trim() : '';

    if (!tex) {
      const altMatch = html.match(/(?:alttext|alt)=["']([^"']+)["']/i);
      if (altMatch) tex = altMatch[1].trim();
    }

    if (!tex) {
      const kHtmlMatch = html.match(/<span\s+class="katex-html"[^>]*>([\s\S]*?)<\/span>/i);
      if (kHtmlMatch) tex = kHtmlMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    if (!tex) return html;

    tex = tex.replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&quot;/g, '"')
             .replace(/&#39;/g, "'");

    tex = cleanMathFormula(tex);

    const isDisplay = /katex-display|display=["']block["']|mwe-math-fallback-image-display|\\displaystyle/i.test(html);
    return isDisplay ? `\n\n$$\n${tex}\n$$\n\n` : `$${tex}$`;
  }

  /**
   * Pipeline Universale di Normalizzazione Matematica MiniPad.
   * - Converte HTML matematico grezzo in TeX
   * - Elimina righe con soli backslash orfani
   * - Elimina backslash orfani prima di $$
   * - Converte \[...\] e \\[...\\] in $$...$$
   * - Converte \(...\) e \\(...) in $...$
   * - Ripulisce doppi backslash e de-escapa _ e * all'interno delle formule
   * - Protegge valute ($19,99 -> \$19,99)
   * - Preserva i blocchi di codice originali
   */
  function normalizeAllMath(text) {
    if (!text) return '';
    let md = String(text);

    // 1. Isola code blocks fenced e inline
    const blocks = [];
    md = md.replace(/```[\s\S]*?```/g, m => {
      blocks.push(m);
      return `\u0000B${blocks.length - 1}\u0000`;
    });
    md = md.replace(/`[^`\r\n]+`/g, m => {
      blocks.push(m);
      return `\u0000B${blocks.length - 1}\u0000`;
    });

    // 2. Converti snippet HTML matematici grezzi (KaTeX / Wikipedia / MathML) in TeX standard
    md = md.replace(/<(?:span|div)\s+class="[^"]*(?:katex|mwe-math-element)[^"]*"[\s\S]*?<\/(?:span|div)>\s*<\/(?:span|div)>/gi, (match) => {
      return extractTexFromHtml(match);
    });
    md = md.replace(/<math[\s\S]*?<\/math>/gi, (match) => {
      return extractTexFromHtml(match);
    });

    // 3. Rimuovi righe composte ESCLUSIVAMENTE da backslash orfani (es. \, \\, \\\)
    md = md.replace(/^[ \t]*\\+[ \t]*$/gm, '');

    // 4. Rimuovi backslash orfano subito prima della chiusura $$ (usando arrow function per non corrompere $$ in $)
    md = md.replace(/\\+\s*\$\$/g, () => '\n$$');

    // 5. Converti delimitatori standard LLM: sia \\[...\\] che \[...\]
    md = md.replace(/\\{1,2}\[([\s\S]*?)\\{1,2}\]/g, (_, f) => {
      return `\n\n$$\n${cleanMathFormula(f)}\n$$\n\n`;
    });
    md = md.replace(/\\{1,2}\(([\s\S]*?)\\{1,2}\)/g, (_, f) => {
      return `$${cleanMathFormula(f)}$`;
    });

    // 6. Normalizza formule display $$ ... $$ esistenti
    md = md.replace(/\$\$([\s\S]*?)\$\$/g, (_, f) => {
      return `\n\n$$\n${cleanMathFormula(f)}\n$$\n\n`;
    });

    // 7. Normalizza formule inline $ ... $ esistenti (escluso valute $10)
    md = md.replace(/(?<![\\$])\$(?!\$)([^$\n]+?)\$(?!\$)/g, (match, f) => {
      if (/^\d+(?:[.,]\d+)?$/.test(f.trim())) return match;
      return `$${cleanMathFormula(f)}$`;
    });

    // 8. Proteggi valute: $<cifra> -> \$<cifra>
    md = md.replace(/(^|[^\\])\$(\d+(?:[.,]\d+)?)(?![\d$])/g, (match, prefix, num) => prefix + '\\$' + num);

    // 9. Rimuovi righe vuote multiple
    md = md.replace(/\n{3,}/g, '\n\n');

    // 10. Ripristina code blocks
    md = md.replace(/\u0000B(\d+)\u0000/g, (_, i) => blocks[+i] || '');

    return md;
  }

  // Alias retrocompatibile
  const normalizeLLMMath = normalizeAllMath;

  /**
   * Gestisce l'evento paste. Ritorna true se ha gestito l'incolla.
   */
  function handlePaste(event, cmOrTextarea) {
    const cd = event.clipboardData;
    if (!cd) return false;

    const html = cd.getData('text/html');
    const plain = cd.getData('text/plain');

    // Caso 1: HTML con nodi matematici (ChatGPT/Claude/Wikipedia/EoM)
    if (html && /katex|mwe-math|mathml|<math|application\/x-tex|math\/tex/i.test(html) && turndown) {
      event.preventDefault();
      let md = '';
      try {
        md = turndown.turndown(html);
      } catch (e) {
        console.warn('[SmartPaste] Turndown fallito, fallback a plain text', e);
        md = plain || '';
      }
      md = normalizeLLMMath(md);
      insertAtCursor(cmOrTextarea, md);
      return true;
    }

    // Caso 2: Plain text con delimitatori LaTeX, formule KaTeX o snippet HTML matematici
    if (plain && (/\\{1,2}\(|\\{1,2}\[|\\{1,2}\$|\$\$|<(?:span|div|math)[^>]*class=["'][^"']*(?:katex|mwe-math)/i.test(plain))) {
      event.preventDefault();
      insertAtCursor(cmOrTextarea, normalizeAllMath(plain));
      return true;
    }

    return false;
  }

  /**
   * Inserisce testo rispettando CodeMirror (EasyMDE) o un textarea nativo.
   */
  function insertAtCursor(target, text) {
    if (target && typeof target.replaceSelection === 'function') {
      // CodeMirror
      target.replaceSelection(text);
      target.focus();
      return;
    }
    if (target && typeof target.selectionStart === 'number') {
      // Textarea nativo
      const start = target.selectionStart;
      const end = target.selectionEnd;
      target.value = target.value.slice(0, start) + text + target.value.slice(end);
      const pos = start + text.length;
      target.selectionStart = target.selectionEnd = pos;
      target.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  return {
    init,
    handlePaste,
    normalizeAllMath,
    normalizeLLMMath,
    cleanMathFormula,
    extractTexFromHtml,
    extractLatex,
    insertAtCursor
  };
})();

// Bridge globale
if (typeof window !== 'undefined') {
  window.normalizeAllMath = window.MiniPadSmartPaste.normalizeAllMath;
}
