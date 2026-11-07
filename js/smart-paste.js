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
    if (ann && ann.textContent.trim()) return ann.textContent.trim();

    // 2. <script type="math/tex"> (MathJax)
    if (node.tagName && node.tagName.toLowerCase() === 'script' && (node.getAttribute('type') || '').startsWith('math/tex')) {
      return (node.textContent || '').trim();
    }
    const scr =
      node.querySelector &&
      node.querySelector('script[type^="math/tex"]');
    if (scr && scr.textContent.trim()) return scr.textContent.trim();

    // 3. Attributo alt sull'elemento stesso
    if (node.getAttribute) {
      const alt = node.getAttribute('alt');
      if (alt && alt.trim()) return alt.trim();
    }

    // 4. <img alt="...">
    const img = node.querySelector && node.querySelector('img[alt]');
    if (img && img.getAttribute('alt') && img.getAttribute('alt').trim()) {
      return img.getAttribute('alt').trim();
    }

    // 5. data-tex o data-latex attribute
    if (node.getAttribute) {
      const dataTex = node.getAttribute('data-tex') || node.getAttribute('data-latex');
      if (dataTex && dataTex.trim()) return dataTex.trim();
    }

    return '';
  }

  /**
   * Normalizza \( \) → $ $ e \[ \] → $$ $$, protegge valute e code block.
   * Gestisce:
   * - \[...\] (singolo backslash da Claude/Gemini)
   * - \\[...\\] (doppio backslash da ChatGPT plain text copy)
   * - \(...\) e \\(...)
   * - Rimuove trailing backslash orfani prima della chiusura formula (\ $$)
   * - De-escapa markdown escaping dentro la formula (\_ -> _, \* -> *)
   */
  function normalizeLLMMath(text) {
    if (!text) return text;

    // 1. Isola temporaneamente tutti i blocchi di codice (fenced e inline)
    const blocks = [];
    let md = text.replace(/```[\s\S]*?```/g, m => {
      blocks.push(m);
      return `\u0000B${blocks.length - 1}\u0000`;
    });
    md = md.replace(/`[^`\r\n]+`/g, m => {
      blocks.push(m);
      return `\u0000B${blocks.length - 1}\u0000`;
    });

    // 2. Converte i delimitatori standard degli LLM.
    //    Gestisce sia \[...\] che \\[...\\]
    md = md.replace(/\\{1,2}\[([\s\S]*?)\\{1,2}\]/g, (_, f) => {
      let clean = f.trim();
      // Rimuove eventuali backslash orfani alla fine della formula (che romperebbero \ $$)
      clean = clean.replace(/\\+$/, '').trim();
      // De-escapa caratteri markdown escapati all'interno della formula (\_ -> _, \* -> *)
      clean = clean.replace(/\\([_*])/g, '$1');
      return `\n\n$$\n${clean}\n$$\n\n`;
    });

    md = md.replace(/\\{1,2}\(([\s\S]*?)\\{1,2}\)/g, (_, f) => {
      let clean = f.trim();
      clean = clean.replace(/\\+$/, '').trim();
      clean = clean.replace(/\\([_*])/g, '$1');
      return `$${clean}$`;
    });

    // 3. Protegge le valute: $<cifra> → \$<cifra> (evita che $19,99 e $4,50 diventino formule matematiche)
    md = md.replace(/(^|[^\\])\$(\d+(?:[.,]\d+)?)(?![\d$])/g, (match, prefix, num) => prefix + '\\$' + num);

    // 4. Ripristina i blocchi di codice originali
    md = md.replace(/\u0000B(\d+)\u0000/g, (_, i) => blocks[+i] || '');

    return md;
  }

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

    // Caso 2: Plain text con \( o \[ o \$ (singolo o doppio backslash degli LLM)
    if (plain && (/\\{1,2}\(|\\{1,2}\[|\\{1,2}\$/.test(plain))) {
      event.preventDefault();
      insertAtCursor(cmOrTextarea, normalizeLLMMath(plain));
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

  return { init, handlePaste, normalizeLLMMath, extractLatex, insertAtCursor };
})();
