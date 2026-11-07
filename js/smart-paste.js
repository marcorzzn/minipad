/**
 * MiniPad Smart Paste v1.5.8.1
 * - Intercetta paste da ChatGPT/Claude/Gemini/Wikipedia/MathJax/EoM
 * - Disabilita escaping distruttivo di Turndown (preserva #, *, -, [, ], `, _)
 * - Supporto GFM (tabelle, task lists, strikethrough)
 * - De-escaping automatico per markdown indebitamente escapato (\#, \**, \-, \```)
 * - Isolamento prioritario dei blocchi di codice (fenced & inline) prima di qualsiasi parsing matematico
 * - Estrae LaTeX puro da KaTeX/MathML/alt/script con fallback gerarchico
 * - Converte \(...\) → $...$ e \[...\] → $$...$$ (senza intaccare link o task list)
 * - Ripulisce doppi backslash e caratteri orfani (\, \\, \\_)
 * - Protegge valute ($19,99 -> \$19,99)
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

    // CRITICO: Disabilita l'escaping distruttivo di Turndown!
    // Di default Turndown applica escape() a ogni carattere markdown (#, *, -, [, ], `, _, ., etc.)
    // distruggendo la formattazione, i blocchi di codice, i link e le formule.
    turndown.escape = function (str) {
      return str;
    };

    // Abilita il plugin GFM (tabelle, task lists, strikethrough) se disponibile
    if (typeof turndownPluginGfm !== 'undefined' && turndownPluginGfm.gfm) {
      turndown.use(turndownPluginGfm.gfm);
    } else {
      // Regole fallback per tabelle HTML se il plugin GFM non è caricato
      turndown.addRule('tableCell', {
        filter: ['th', 'td'],
        replacement: function (content) {
          return ' ' + content.trim().replace(/\n+/g, ' ') + ' |';
        }
      });
      turndown.addRule('tableRow', {
        filter: 'tr',
        replacement: function (content, node) {
          const isHeader = node.parentNode && node.parentNode.nodeName.toLowerCase() === 'thead';
          let border = '';
          if (isHeader) {
            const cells = node.querySelectorAll('th, td');
            border = '\n|' + Array.from(cells).map(() => ' --- |').join('');
          }
          return '\n|' + content + border;
        }
      });
      turndown.addRule('table', {
        filter: 'table',
        replacement: function (content) {
          return '\n\n' + content.trim() + '\n\n';
        }
      });
    }

    // Rimuove stili generici ma preserva il contenuto per il nostro estrattore
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

    // Rimuove backslash orfani isolati all'inizio
    f = f.replace(/^[ \t]*\\+(?![a-zA-Z,;!])/, '').trim();

    // Converte doppi backslash davanti a comandi LaTeX (\\hat -> \hat, \\frac -> \frac, ecc.)
    f = f.replace(/\\\\([a-zA-Z]+)/g, '\\$1');
    f = f.replace(/\\\\([,;!])/g, '\\$1');

    // De-escapa caratteri markdown indebitamente escapati dentro formule:
    // \_ -> _   \* -> *   \^ -> ^   \~ -> ~
    f = f.replace(/\\+([_*^~])/g, '$1');

    // Ripara graffe doppie escapate {\{p\}} o \{\{p\}\} -> {p}
    f = f.replace(/\{\\?\{([^{}]+)\}\\?\}/g, '{$1}');

    // Ripara annidamenti anomali \text{\mathrm{...}} -> \mathrm{...}
    f = f.replace(/\\text\{\\?mathrm\{([^}]+)\}\}/g, '\\mathrm{$1}');

    // Ripara \mathrm se perso o scritto come mathrm senza backslash:
    f = f.replace(/_\{mathrm\{([^}]+)\}\}/g, '_{\\mathrm{$1}}');
    f = f.replace(/_mathrm\{([^}]+)\}/g, '_{\\mathrm{$1}}');

    return f.trim();
  }

  /**
   * De-escapa costrutti Markdown che sono stati erroneamente escapati
   * (ad es. da Turndown pre-fix o copia/incolla da formati raw).
   */
  function cleanOverEscapedMarkdown(md) {
    if (!md) return '';
    let s = String(md).replace(/\r\n/g, '\n');

    // Rimuovi 'text\n' spurio in cima se il testo è stato copiato dal pulsante "Copia" di ChatGPT
    if (/^text\s*\n\s*(?:#|\*\*|```|<)/i.test(s)) {
      s = s.replace(/^text\s*\n/i, '');
    }

    // 1. Unescape blocchi di codice fenced (\`\`\` o \``` -> ```)
    s = s.replace(/(?:\\`){3,}/g, '```');
    s = s.replace(/^[ \t]*\\`{3,}/gm, '```');
    s = s.replace(/`{3,}\\/g, '```');

    // 2. Unescape titoli Markdown (\# -> #, \## -> ##)
    s = s.replace(/^[ \t]*\\(#{1,6}[ \t]+)/gm, '$1');

    // 3. Unescape righe orizzontali (\--- -> ---)
    s = s.replace(/^[ \t]*\\(---|\*\*\*|___)[ \t]*$/gm, '$1');

    // 4. Unescape citazioni blockquote (\> -> >)
    s = s.replace(/^[ \t]*\\(>+[ \t]*)/gm, '$1');

    // 5. Unescape task list checkboxes (\- \[ \] -> - [ ], \- \[x\] -> - [x])
    s = s.replace(/^[ \t]*\\?([-*+])[ \t]+\\\[([ xX]?)\\\]/gm, '$1 [$2]');
    s = s.replace(/\\\[([ xX]?)\\\]/g, '[$1]');

    // 6. Unescape punti elenco elenchi (\- -> -, \* -> *, 1\. -> 1.)
    s = s.replace(/^[ \t]*\\([-*+])[ \t]+/gm, '$1 ');
    s = s.replace(/^[ \t]*(\d+)\\\.[ \t]+/gm, '$1. ');

    // 7. Unescape link Markdown (\[text\](url) -> [text](url))
    s = s.replace(/\\\[([^\]\n]+)\\\]\(([^)\n]+)\)/g, '[$1]($2)');

    // 8. Unescape grassetto, corsivo e barrato (\** -> **, \* -> *, \~~ -> ~~)
    s = s.replace(/\\\*/g, '*');
    s = s.replace(/\\~/g, '~');

    // 9. Unescape backtick singoli di codice inline (\`code\` -> `code`)
    s = s.replace(/\\`/g, '`');

    return s;
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
   * - Normalizza terminatori di riga CRLF
   * - De-escapa costrutti Markdown danneggiati
   * - Isola TUTTI i blocchi di codice (fenced & inline) proteggendo Bash, Python, HTML
   * - Converte HTML matematico grezzo in TeX
   * - Elimina righe con soli backslash orfani
   * - Elimina backslash orfani prima di $$
   * - Converte \[...\] e \\[...\\] in $$...$$ (escludendo task list e link Markdown)
   * - Converte \(...\) e \\(...) in $...$
   * - Ripulisce doppi backslash e de-escapa _ e * all'interno delle formule
   * - Protegge valute ($19,99 -> \$19,99)
   * - Ripristina i blocchi di codice originali intatti
   */
  function normalizeAllMath(text) {
    if (!text) return '';
    let md = String(text).replace(/\r\n/g, '\n');

    // Step 0: De-escape preventivo di costrutti Markdown danneggiati
    md = cleanOverEscapedMarkdown(md);

    // Step 1: Isola code blocks fenced e inline PRIMA di qualsiasi parsing
    const blocks = [];
    // Fenced code ```lang ... ``` oppure ~~~ ... ~~~
    md = md.replace(/(^|\n)(```|~~~)[ \t]*[\w-]*\n[\s\S]*?\n\2[ \t]*(?=\n|$)/g, m => {
      blocks.push(m);
      return `\n\n\u0000B${blocks.length - 1}\u0000\n\n`;
    });
    // Inline code multi-backtick ``...``
    md = md.replace(/(`{2,})((?:[^`]|`(?![`]))*?)\1/g, m => {
      blocks.push(m);
      return `\u0000B${blocks.length - 1}\u0000`;
    });
    // Inline code singolo `...`
    md = md.replace(/`([^`\n]+)`/g, m => {
      blocks.push(m);
      return `\u0000B${blocks.length - 1}\u0000`;
    });

    // Step 2: Converti snippet HTML matematici grezzi (KaTeX / Wikipedia / MathML) in TeX standard
    md = md.replace(/<(?:span|div)\s+class="[^"]*(?:katex|mwe-math-element)[^"]*"[\s\S]*?<\/(?:span|div)>\s*<\/(?:span|div)>/gi, extractTexFromHtml);
    md = md.replace(/<span\s+class="katex"[^>]*>[\s\S]*?<\/span>/gi, extractTexFromHtml);
    md = md.replace(/<math[\s\S]*?<\/math>/gi, extractTexFromHtml);

    // Step 3: Rimuovi righe composte ESCLUSIVAMENTE da backslash orfani (es. \, \\, \\\)
    md = md.replace(/^[ \t]*\\+[ \t]*$/gm, '');

    // Step 4: Rimuovi backslash orfano subito prima della chiusura $$
    md = md.replace(/\\+\s*\$\$/g, () => '\n$$');

    // Step 5: Converti delimitatori standard LLM: sia \\[...\\] che \[...\]
    // ATTENZIONE: escludi tassativamente i task list [-*+] \[ \] e i link Markdown \[text\](url)
    md = md.replace(/(^|[^\\])\\{1,2}\[([\s\S]*?)\\{1,2}\](?!\()/g, (fullMatch, prefix, f) => {
      const trimmed = f.trim();
      // Se è un checkbox task list: [ ] o [x]
      if (!trimmed || /^[xX]$/.test(trimmed)) {
        return `${prefix}[${trimmed}]`;
      }
      return `${prefix}\n\n$$\n${cleanMathFormula(f)}\n$$\n\n`;
    });

    // Step 6: Converti delimitatori inline standard LLM: sia \\(...) che \(...\)
    md = md.replace(/(^|[^\\])\\{1,2}\(([\s\S]*?)\\{1,2}\)/g, (fullMatch, prefix, f) => {
      return `${prefix}$${cleanMathFormula(f)}$`;
    });

    // Step 7: Normalizza formule display $$ ... $$ esistenti
    md = md.replace(/\$\$([\s\S]*?)\$\$/g, (_, f) => {
      return `\n\n$$\n${cleanMathFormula(f)}\n$$\n\n`;
    });

    // Step 8: Normalizza formule inline $ ... $ esistenti (escluso valute $10)
    md = md.replace(/(?<![\\$])\$(?!\$)([^$\n]+?)\$(?!\$)/g, (match, f) => {
      if (/^\d+(?:[.,]\d+)?$/.test(f.trim())) return match;
      return `$${cleanMathFormula(f)}$`;
    });

    // Step 9: Proteggi valute: $<cifra> -> \$<cifra>
    md = md.replace(/(^|[^\\])\$(\d+(?:[.,]\d+)?)(?![\d$])/g, (match, prefix, num) => prefix + '\\$' + num);

    // Step 10: Rimuovi righe vuote multiple eccessive
    md = md.replace(/\n{3,}/g, '\n\n');

    // Step 11: Ripristina code blocks intatti al 100%
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

    // Caso 1: HTML con nodi matematici o tabelle/blocchi ricchi
    if (html && turndown && (/katex|mwe-math|mathml|<math|application\/x-tex|math\/tex|<table|<pre|<div|<h[1-6]/i.test(html))) {
      event.preventDefault();
      let md = '';
      try {
        md = turndown.turndown(html);
      } catch (e) {
        console.warn('[SmartPaste] Turndown fallito, fallback a plain text', e);
        md = plain || '';
      }
      md = normalizeAllMath(md);
      insertAtCursor(cmOrTextarea, md);
      return true;
    }

    // Caso 2: Plain text con delimitatori LaTeX, formule KaTeX o snippet HTML matematici
    if (plain && (/\\{1,2}\(|\\{1,2}\[|\\{1,2}\$|\$\$|<(?:span|div|math)[^>]*class=["'][^"']*(?:katex|mwe-math)|^[ \t]*\\#/im.test(plain))) {
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
    cleanOverEscapedMarkdown,
    cleanMathFormula,
    extractTexFromHtml,
    extractLatex,
    insertAtCursor
  };
})();

// Bridge globale
if (typeof window !== 'undefined') {
  window.normalizeAllMath = window.MiniPadSmartPaste.normalizeAllMath;
  window.cleanOverEscapedMarkdown = window.MiniPadSmartPaste.cleanOverEscapedMarkdown;
}
