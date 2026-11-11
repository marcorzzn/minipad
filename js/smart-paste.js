/**
 * MiniPad Smart Paste v1.5.9
 *
 * Due livelli di normalizzazione, con lo STESSO motore:
 *   - normalizePasted(text)    → usato quando il testo ENTRA in MiniPad (Ctrl+V, modale "Indicizza
 *                                Chat", import). Ripara in modo deciso l'output di LLM/Wikipedia.
 *   - normalizeForRender(text) → usato da anteprima ed export. Conservativo: non tocca gli escape
 *                                voluti dall'utente (\*, \[1\], \_ dentro \text{}), converte solo
 *                                ciò che è inequivocabilmente matematica.
 *
 * Garanzie (coperte dai test in tests/):
 *   - Blocchi di codice fenced (``` e ~~~, anche annidati con 4+ backtick, anche indentati in liste)
 *     e codice inline non vengono MAI modificati.
 *   - \[...\] diventa formula solo se contiene matematica o occupa righe proprie
 *     (mai "\[1\]", link "\[t\](url)" o checkbox "\[x\]").
 *   - Valute ($5, $19,99) protette senza toccare le formule ($5x + 3$ resta formula).
 *   - Lo stesso contenuto incollato da HTML (KaTeX/MathML/Wikipedia), dal pulsante "Copia" di un LLM
 *     o nella modale chat produce lo stesso Markdown.
 */
window.MiniPadSmartPaste = (function () {
  let turndown = null;

  /* =====================================================================
     1. SEGMENTAZIONE CODE-AWARE
     ===================================================================== */

  const FENCE_OPEN = /^([ \t]*)(`{3,}|~{3,})(.*)$/;
  const FENCE_CLOSE = /^[ \t]*(`{3,}|~{3,})[ \t]*$/;

  /**
   * Divide il testo in segmenti { type: 'code' | 'text', value } rispettando le regole CommonMark
   * dei fence: la chiusura deve usare lo stesso carattere e almeno la stessa lunghezza
   * dell'apertura; un fence non chiuso arriva fino alla fine del documento.
   * La ricomposizione è segs.map(s => s.value).join('\n').
   */
  function splitFenced(text) {
    const lines = String(text).split('\n');
    const segs = [];
    let buf = [];
    let fence = null;

    const flush = (type) => {
      if (buf.length) segs.push({ type, value: buf.join('\n') });
      buf = [];
    };

    for (const line of lines) {
      if (!fence) {
        const m = line.match(FENCE_OPEN);
        if (m && !(m[2][0] === '`' && m[3].includes('`'))) {
          flush('text');
          fence = { ch: m[2][0], len: m[2].length };
        }
        buf.push(line);
      } else {
        buf.push(line);
        const c = line.match(FENCE_CLOSE);
        if (c && c[1][0] === fence.ch && c[1].length >= fence.len) {
          flush('code');
          fence = null;
        }
      }
    }
    flush(fence ? 'code' : 'text');
    return segs;
  }

  /** Estrae lingua e corpo da un segmento di codice fenced. */
  function parseFencedSegment(raw) {
    const lines = raw.split('\n');
    const open = lines[0].match(FENCE_OPEN);
    const indent = open ? open[1].length : 0;
    const lang = open ? (open[3].trim().split(/\s+/)[0] || '') : '';
    let body = lines.slice(1);
    const last = body[body.length - 1];
    if (body.length && FENCE_CLOSE.test(last || '')) body = body.slice(0, -1);
    const strip = new RegExp('^[ \\t]{0,' + indent + '}');
    body = body.map(l => l.replace(strip, ''));
    return { lang, code: body.join('\n'), raw };
  }

  /** Placeholder in area Unicode privata: non collide con testo reale né con la sintassi Markdown. */
  const PH_OPEN = '';
  const PH_CLOSE = '';
  const PH_RX = /(\d+)/g;
  const ph = (i) => PH_OPEN + i + PH_CLOSE;

  /**
   * Sostituisce gli span di codice inline con placeholder (regola CommonMark: la chiusura è una
   * sequenza di backtick della STESSA lunghezza; lo span non attraversa paragrafi).
   */
  function protectInlineCode(text, store) {
    let out = '';
    let i = 0;
    const n = text.length;
    while (i < n) {
      const ch = text[i];
      if (ch === '\\' && text[i + 1] === '`') { out += '\\`'; i += 2; continue; }
      if (ch !== '`') { out += ch; i++; continue; }

      let run = 0;
      while (text[i + run] === '`') run++;
      let j = i + run;
      let close = -1;
      while (j < n) {
        const c = text[j];
        if (c === '`') {
          let r = 0;
          while (text[j + r] === '`') r++;
          if (r === run) { close = j; break; }
          j += r;
        } else if (c === '\n') {
          let k = j + 1;
          while (k < n && (text[k] === ' ' || text[k] === '\t')) k++;
          if (k >= n || text[k] === '\n') break; // riga vuota: fine paragrafo
          j++;
        } else {
          j++;
        }
      }
      if (close === -1) { out += text.slice(i, i + run); i += run; continue; }
      store.push(text.slice(i, close + run));
      out += ph(store.length - 1);
      i = close + run;
    }
    return out;
  }

  /**
   * Applica fn solo alla prosa: i blocchi fenced restano identici, il codice inline è
   * sostituito da placeholder durante fn e ripristinato byte per byte.
   */
  function mapProse(text, fn) {
    return splitFenced(text).map(seg => {
      if (seg.type === 'code') return seg.value;
      const store = [];
      const out = fn(protectInlineCode(seg.value, store));
      return out.replace(PH_RX, (_, k) => (store[+k] !== undefined ? store[+k] : ''));
    }).join('\n');
  }

  /** Sostituisce ogni blocco fenced con fn({lang, code, raw}). Usato dagli export TeX/TXT. */
  function replaceFencedBlocks(text, fn) {
    return splitFenced(String(text || '')).map(seg =>
      seg.type === 'code' ? fn(parseFencedSegment(seg.value)) : seg.value
    ).join('\n');
  }

  /* =====================================================================
     2. TURNDOWN (HTML → Markdown)
     ===================================================================== */

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

    // Disabilita l'escaping distruttivo di Turndown (preserva #, *, -, [, ], `, _).
    turndown.escape = function (str) { return str; };

    if (typeof turndownPluginGfm !== 'undefined' && turndownPluginGfm.gfm) {
      turndown.use(turndownPluginGfm.gfm);
    } else {
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

    turndown.remove(['style']);

    // Estrae il LaTeX originale dai nodi matematici (KaTeX, MathML, Wikipedia, MathJax 2)
    turndown.addRule('mathExtract', {
      filter: function (node) {
        if (!node || node.nodeType !== 1) return false;
        const cls = node.classList;
        const tag = node.tagName.toLowerCase();
        return (
          (cls && (
            cls.contains('katex') ||
            cls.contains('katex-display') ||
            cls.contains('mwe-math-element') ||
            cls.contains('mwe-math-mathml-display') ||
            cls.contains('tex')
          )) ||
          tag === 'math' ||
          (tag === 'script' && (node.getAttribute('type') || '').startsWith('math/tex'))
        );
      },
      replacement: function (content, node) {
        const latex = extractLatex(node);
        if (!latex) return content;
        return isDisplayMathNode(node)
          ? `\n\n$$\n${latex}\n$$\n\n`
          : `$${latex}$`;
      }
    });
  }

  function isDisplayMathNode(node) {
    const tag = node.tagName.toLowerCase();
    return !!(
      (node.classList && (
        node.classList.contains('katex-display') ||
        node.classList.contains('mwe-math-mathml-display') ||
        (node.parentElement && node.parentElement.classList && node.parentElement.classList.contains('katex-display'))
      )) ||
      (tag === 'math' && node.getAttribute('display') === 'block') ||
      (node.querySelector && node.querySelector('.mwe-math-fallback-image-display, math[display="block"]')) ||
      (node.getAttribute && (node.getAttribute('type') || '').includes('mode=display'))
    );
  }

  /** Rimuove il wrapper {\displaystyle ...} che Wikipedia aggiunge a ogni formula. */
  function stripDisplayStyleWrapper(tex) {
    const m = String(tex).trim().match(/^\{\\displaystyle\s*([\s\S]*)\}$/);
    if (!m) return tex;
    // Verifica che le graffe del contenuto siano bilanciate (il wrapper avvolge tutto)
    let depth = 0;
    for (let i = 0; i < m[1].length; i++) {
      const c = m[1][i];
      if (c === '\\') { i++; continue; }
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth < 0) return tex; }
    }
    return depth === 0 ? m[1].trim() : tex;
  }

  /** Estrae il sorgente LaTeX da un nodo DOM con fallback gerarchico. */
  function extractLatex(node) {
    if (!node) return '';
    const done = (t) => cleanMathFormula(stripDisplayStyleWrapper(t.trim()), 'paste');

    const ann = node.querySelector && node.querySelector('annotation[encoding="application/x-tex"]');
    if (ann && ann.textContent.trim()) return done(ann.textContent);

    if (node.getAttribute && (node.getAttribute('alttext') || '').trim()) return done(node.getAttribute('alttext'));
    const mathEl = node.querySelector && node.querySelector('math[alttext]');
    if (mathEl && (mathEl.getAttribute('alttext') || '').trim()) return done(mathEl.getAttribute('alttext'));

    if (node.tagName && node.tagName.toLowerCase() === 'script' && (node.getAttribute('type') || '').startsWith('math/tex')) {
      return done(node.textContent || '');
    }
    const scr = node.querySelector && node.querySelector('script[type^="math/tex"]');
    if (scr && scr.textContent.trim()) return done(scr.textContent);

    if (node.getAttribute) {
      const alt = node.getAttribute('alt');
      if (alt && alt.trim()) return done(alt);
    }
    const img = node.querySelector && node.querySelector('img[alt]');
    if (img && img.getAttribute('alt') && img.getAttribute('alt').trim()) return done(img.getAttribute('alt'));

    if (node.getAttribute) {
      const dataTex = node.getAttribute('data-tex') || node.getAttribute('data-latex');
      if (dataTex && dataTex.trim()) return done(dataTex);
    }

    const kHtml = node.querySelector && node.querySelector('.katex-html');
    if (kHtml && kHtml.textContent.trim()) return done(kHtml.textContent);

    return '';
  }

  /**
   * Ripulisce il DOM incollato dagli elementi d'interfaccia (pulsanti "Copia codice", icone,
   * intestazioni dei blocchi di codice) e normalizza i <pre> in <pre><code class="language-x">.
   */
  function cleanPastedDom(root) {
    const insideMath = (el) => !!(el.closest && el.closest('.katex, math, .mwe-math-element, mjx-container'));

    root.querySelectorAll('button, [role="button"], noscript, template, input, select, textarea, style, link, meta')
      .forEach(el => el.remove());
    root.querySelectorAll('script').forEach(el => {
      if (!(el.getAttribute('type') || '').startsWith('math/tex')) el.remove();
    });
    root.querySelectorAll('svg').forEach(el => { if (!insideMath(el)) el.remove(); });

    root.querySelectorAll('pre').forEach(pre => {
      const code = pre.querySelector('code');
      let lang = '';
      let text;
      if (code) {
        const m = (code.className || '').match(/(?:language|lang)-([\w#+.-]+)/i);
        if (m) lang = m[1];
        text = code.textContent;
      } else {
        text = pre.textContent;
        // Intestazione con il solo nome del linguaggio (es. "python") prima del codice
        const first = pre.firstElementChild;
        if (first && pre.children.length > 1) {
          const head = first.textContent.trim();
          if (head && head.length <= 20 && !/\s/.test(head)) {
            lang = head.toLowerCase();
            text = text.slice(text.indexOf(head) + head.length);
          }
        }
      }
      const doc = pre.ownerDocument;
      const fresh = doc.createElement('code');
      if (lang) fresh.className = 'language-' + lang;
      fresh.textContent = String(text).replace(/^\n+/, '').replace(/\s+$/, '');
      while (pre.firstChild) pre.removeChild(pre.firstChild);
      pre.appendChild(fresh);
    });
    return root;
  }

  /** HTML (stringa o elemento) → Markdown normalizzato per l'incolla. */
  function htmlToMarkdown(htmlOrNode) {
    if (!turndown) init();
    if (!turndown) return '';
    let root;
    if (typeof htmlOrNode === 'string') {
      const doc = new DOMParser().parseFromString(htmlOrNode, 'text/html');
      root = doc.body;
    } else {
      root = htmlOrNode.cloneNode(true);
    }
    cleanPastedDom(root);
    const md = turndown.turndown(root.innerHTML || '');
    return normalizePasted(md);
  }

  /* =====================================================================
     3. PULIZIA FORMULE
     ===================================================================== */

  /**
   * Ripara il doppio escape dei backslash tipico dei copia-incolla da LLM.
   *  - Formula interamente "raddoppiata" (ogni sequenza di \ ha lunghezza pari): dimezza tutto.
   *  - Altrimenti converte \\comando → \comando solo se la formula non usa \\ come a-capo
   *    (niente &, \begin, o \\ seguito da spazio/fine).
   */
  function fixDoubledBackslashes(f) {
    const runs = f.match(/\\+/g) || [];
    if (!runs.length) return f;
    const allEven = runs.every(r => r.length % 2 === 0);
    if (allEven && /\\\\[a-zA-Z]/.test(f)) {
      return f.replace(/\\+/g, r => '\\'.repeat(r.length / 2));
    }
    const usesLineBreaks = /&|\\begin\{|\\\\(?=\s|$|\d)/.test(f);
    if (usesLineBreaks) return f;
    return f.replace(/(^|[^\\])\\\\([a-zA-Z]+|[,;!])/g, '$1\\$2');
  }

  /**
   * Pulisce una formula LaTeX.
   * mode 'paste'  → riparazioni complete (escape Markdown dentro la formula, graffe raddoppiate, ...)
   * mode 'render' → solo riparazioni prive di ambiguità.
   */
  function cleanMathFormula(tex, mode) {
    if (!tex) return '';
    const aggressive = mode !== 'render';
    let f = String(tex).trim();

    // Backslash finale orfano (una formula che termina con un "\" dispari rompe KaTeX)
    f = f.replace(/(^|[^\\])((?:\\\\)*)\\$/, '$1$2');
    // Backslash orfani a inizio formula seguiti da a-capo
    f = f.replace(/^\\+[ \t]*(?=\n)/, '');

    f = fixDoubledBackslashes(f);

    if (aggressive) {
      // Escape Markdown dentro la formula (\_ \* \^ \~), preservando \text{...} & simili
      const keep = [];
      f = f.replace(/\\(?:text|textrm|textit|textbf|texttt|mathrm|operatorname)\{[^{}]*\}/g, m => {
        keep.push(m);
        return ph(keep.length - 1);
      });
      f = f.replace(/\\+([_*^~])/g, '$1');
      f = f.replace(PH_RX, (_, k) => keep[+k]);

      // Graffe doppie escapate {\{p\}} → {p}
      f = f.replace(/\{\\?\{([^{}]+)\\?\}\}/g, '{$1}');
      // \text{\mathrm{...}} → \mathrm{...}
      f = f.replace(/\\text\{\\?mathrm\{([^}]+)\}\}/g, '\\mathrm{$1}');
      // mathrm senza backslash
      f = f.replace(/_\{mathrm\{([^}]+)\}\}/g, '_{\\mathrm{$1}}');
      f = f.replace(/_mathrm\{([^}]+)\}/g, '_{\\mathrm{$1}}');
    }

    return f.trim();
  }

  /** Euristica: il contenuto tra \[ \] è matematica? */
  function looksLikeMath(s) {
    const t = String(s).trim();
    if (!t) return false;
    if (/\\[a-zA-Z]+/.test(t)) return true;          // comandi LaTeX
    if (/[\^_=<>+]|[{}]|\\[{}|]/.test(t)) return true;  // operatori / gruppi
    if (/\d\s*[*/-]\s*\d/.test(t)) return true;       // aritmetica
    return false;
  }

  /* =====================================================================
     4. MARKDOWN SOVRA-ESCAPATO
     ===================================================================== */

  /** Quanti segnali di Markdown escapato in modo distruttivo contiene il testo. */
  function overEscapeScore(md) {
    const s = String(md || '');
    let n = 0;
    n += (s.match(/^[ \t]*\\(?:#{1,6}[ \t]|[-*+][ \t]|>|`{3}|\d+\\?\.[ \t])/gm) || []).length;
    n += (s.match(/^[ \t]*\d+\\\.[ \t]/gm) || []).length;
    n += (s.match(/\\\*\\\*/g) || []).length;
    n += (s.match(/\\\[[ xX]?\\\]/g) || []).length;
    n += (s.match(/(?:\\`){3}/g) || []).length;
    return n;
  }

  function unescapeFences(s) {
    s = s.replace(/(?:\\`){3,}/g, '```');
    s = s.replace(/^([ \t]*)\\`{3,}/gm, '$1```');
    s = s.replace(/`{3,}\\(?=\s|$)/g, '```');
    return s;
  }

  function unescapeProse(s) {
    s = s.replace(/^([ \t]*)\\(#{1,6}[ \t]+)/gm, '$1$2');
    s = s.replace(/^([ \t]*)\\(---|\*\*\*|___)[ \t]*$/gm, '$1$2');
    s = s.replace(/^([ \t]*)\\(>+[ \t]*)/gm, '$1$2');
    s = s.replace(/^([ \t]*)\\?([-*+])[ \t]+\\\[([ xX]?)\\\]/gm, '$1$2 [$3]');
    s = s.replace(/\\\[([ xX]?)\\\]/g, '[$1]');
    s = s.replace(/^([ \t]*)\\([-*+])[ \t]+/gm, '$1$2 ');
    s = s.replace(/^([ \t]*)(\d+)\\\.[ \t]+/gm, '$1$2. ');
    s = s.replace(/\\\[([^\]\n]+)\\\]\(([^)\n]+)\)/g, '[$1]($2)');
    s = s.replace(/\\\*/g, '*');
    s = s.replace(/\\~/g, '~');
    s = s.replace(/\\`/g, '`');
    return s;
  }

  /**
   * De-escapa costrutti Markdown escapati in modo distruttivo (\#, \*\*, \-, \`\`\`).
   * Il contenuto dei blocchi di codice non viene toccato.
   */
  function cleanOverEscapedMarkdown(md) {
    if (!md) return '';
    let s = String(md).replace(/\r\n?/g, '\n');
    // Header "text" spurio del pulsante "Copia" di ChatGPT
    if (/^text\s*\n\s*(?:#|\*\*|```|<)/i.test(s)) s = s.replace(/^text\s*\n/i, '');
    s = unescapeFences(s);
    return mapProse(s, unescapeProse);
  }

  /** Estrae TeX da snippet HTML matematici grezzi presenti nel testo. */
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
    tex = cleanMathFormula(stripDisplayStyleWrapper(tex), 'paste');

    const isDisplay = /katex-display|display=["']block["']|mwe-math-fallback-image-display|\\displaystyle/i.test(html);
    return isDisplay ? `\n\n$$\n${tex}\n$$\n\n` : `$${tex}$`;
  }

  /* =====================================================================
     5. PIPELINE MATEMATICA
     ===================================================================== */

  /** Prefisso di contenitore di una riga (indentazione e/o marcatori di citazione). */
  function linePrefix(line) {
    const m = line.match(/^([ \t]*(?:>[ \t]?)*)/);
    return m ? m[1] : '';
  }

  /**
   * Un blocco $$ su più righe deve essere separato da righe vuote, altrimenti Markdown lo
   * incolla al paragrafo precedente e la formula non viene renderizzata.
   * Rispetta il prefisso di contenitore (liste indentate, citazioni "> ").
   */
  function separateDisplayBlocks(text) {
    const lines = text.split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const prefix = linePrefix(line);
      const rest = line.slice(prefix.length);
      const blankLine = prefix.replace(/[ \t]+$/, '');
      const isText = (l) => l !== undefined && l.slice(linePrefix(l).length).trim() !== '';

      // "$$ formula $$" da solo su una riga → blocco display (come nelle versioni precedenti)
      const single = rest.trim().match(/^\$\$([^$]+)\$\$$/);
      if (single) {
        const prev = out.length ? out[out.length - 1] : undefined;
        const prevIsListItem = prev !== undefined && /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/.test(prev) && /^[ \t]+/.test(prefix);
        if (isText(prev) && !prevIsListItem) out.push(blankLine);
        out.push(prefix + '$$', prefix + single[1].trim(), prefix + '$$');
        if (isText(lines[i + 1])) out.push(blankLine);
        i++;
        continue;
      }

      const opens = /^\$\$/.test(rest.trim()) && (rest.trim().match(/\$\$/g) || []).length === 1;
      if (!opens) { out.push(line); i++; continue; }

      // Cerca la riga di chiusura
      let j = i + 1;
      while (j < lines.length && !/\$\$/.test(lines[j])) {
        if (!lines[j].slice(linePrefix(lines[j]).length).trim() && !lines[j].trim().startsWith('>')) break;
        j++;
      }
      if (j >= lines.length || !/\$\$/.test(lines[j])) { out.push(line); i++; continue; }

      const blank = prefix.replace(/[ \t]+$/, '');
      const prevLine = out.length ? out[out.length - 1] : '';
      const prevIsText = out.length && prevLine.slice(linePrefix(prevLine).length).trim() !== '';
      const prevIsListItem = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/.test(prevLine) && /^[ \t]+/.test(prefix);
      if (prevIsText && !prevIsListItem) out.push(blank);

      // Normalizza: "$$ a" → "$$" + "a"; "b $$" → "b" + "$$"
      const openContent = rest.trim().slice(2).trim();
      out.push(prefix + '$$');
      if (openContent) out.push(prefix + openContent);
      for (let k = i + 1; k < j; k++) out.push(lines[k]);
      const closeLine = lines[j];
      const cp = linePrefix(closeLine);
      const cRest = closeLine.slice(cp.length);
      const idx = cRest.indexOf('$$');
      const before = cRest.slice(0, idx).trim();
      const after = cRest.slice(idx + 2).trim();
      if (before) out.push(prefix + before);
      out.push(prefix + '$$');
      if (after) out.push(prefix + after);

      const next = lines[j + 1];
      if (next !== undefined && next.slice(linePrefix(next).length).trim() !== '') out.push(blank);
      i = j + 1;
    }
    return out.join('\n');
  }

  /**
   * Trasformazioni applicate alla sola prosa (il codice è già protetto da placeholder).
   * mode: 'paste' | 'render'
   */
  function transformProse(md, mode) {
    // 1. Snippet HTML matematici grezzi (KaTeX / Wikipedia / MathML) → TeX
    md = md.replace(/<(?:span|div)\s+class="[^"]*(?:katex|mwe-math-element)[^"]*"[\s\S]*?<\/(?:span|div)>\s*<\/(?:span|div)>/gi, extractTexFromHtml);
    md = md.replace(/<span\s+class="katex"[^>]*>[\s\S]*?<\/span>/gi, extractTexFromHtml);
    md = md.replace(/<math[\s\S]*?<\/math>/gi, extractTexFromHtml);

    // 2. Righe composte solo da backslash orfani
    md = md.replace(/^[ \t]*\\+[ \t]*$/gm, '');

    // 3. Delimitatori display LLM: \[...\] e \\[...\\]
    md = md.replace(/(^|[^\\])\\{1,2}\[([\s\S]*?)\\{1,2}\](?!\()/g, (full, prefix, f, offset, str) => {
      const trimmed = f.trim();
      if (!trimmed || /^[xX]$/.test(trimmed)) return `${prefix}[${trimmed}]`; // checkbox
      if (/\n[ \t]*(?:>[ \t]*)*\n/.test(f)) return full;                       // attraversa paragrafi
      const start = offset + prefix.length;
      const lineStart = str.lastIndexOf('\n', start - 1) + 1;
      const end = offset + full.length;
      const lineEnd = str.indexOf('\n', end) === -1 ? str.length : str.indexOf('\n', end);
      const ownLine = /^[ \t]*(?:>[ \t]?)*$/.test(str.slice(lineStart, start)) && !str.slice(end, lineEnd).trim();
      const multiLine = f.includes('\n');
      if (!(ownLine || multiLine || looksLikeMath(f))) return full;          // es. "\[1\]"
      const lead = /\n/.test(f.match(/^\s*/)[0]) ? f.match(/^\s*/)[0] : '';
      const trail = /\n/.test(f.match(/\s*$/)[0]) ? f.match(/\s*$/)[0] : '';
      return `${prefix}$$${lead}${cleanMathFormula(f, mode)}${trail}$$`;
    });

    // 4. Delimitatori inline LLM: \(...\) e \\(...\\)
    md = md.replace(/(^|[^\\])\\{1,2}\(((?:(?!\n[ \t]*\n)[\s\S]){1,800}?)\\{1,2}\)/g, (full, prefix, f) => {
      if (!f.trim()) return full;
      return `${prefix}$${cleanMathFormula(f, mode)}$`;
    });

    // 5. Formule esistenti: proteggi e pulisci $$...$$ e $...$ (così le valute non le toccano)
    const maths = [];
    const keepMath = (s) => { maths.push(s); return '' + (maths.length - 1) + ''; };

    md = md.replace(/\$\$([\s\S]+?)\$\$/g, (full, f) => {
      if (/\n[ \t]*\n/.test(f)) return full;
      const lead = f.match(/^\s*/)[0];
      const trail = f.match(/\s*$/)[0];
      return keepMath('$$' + lead + cleanMathFormula(f, mode) + trail + '$$');
    });

    // Inline (regole Pandoc): niente spazio dopo $ di apertura né prima di $ di chiusura,
    // e il $ di chiusura non è seguito da una cifra. "$5 e poi $10" NON è una formula.
    md = md.replace(/(^|[^\\$])\$(?![\s$])((?:\\.|[^$\\\n])+?)\$(?![\d$])/g, (full, pre, f) => {
      if (/\s$/.test(f)) return full;
      if (/^\d+(?:[.,]\d+)*$/.test(f.trim())) return full;
      return pre + keepMath('$' + cleanMathFormula(f, mode) + '$');
    });

    // 6. Valute: $<cifra> → \$<cifra>
    md = md.replace(/(^|[^\\])\$(\d+(?:[.,]\d+)*)(?![\d$])/g, (m, pre, num) => pre + '\\$' + num);

    md = md.replace(/(\d+)/g, (_, k) => maths[+k]);

    // 7. Separazione dei blocchi $$ multi-riga
    md = separateDisplayBlocks(md);

    // 8. Righe vuote multiple
    md = md.replace(/\n{3,}/g, '\n\n');
    return md;
  }

  function normalizeMath(text, mode) {
    if (!text) return '';
    let md = String(text).replace(/\r\n?/g, '\n');
    const threshold = mode === 'render' ? 3 : 1;
    if (overEscapeScore(md) >= threshold) md = cleanOverEscapedMarkdown(md);
    return mapProse(md, (prose) => transformProse(prose, mode));
  }

  /** Normalizzazione completa per il testo che entra in MiniPad (incolla, import, modale chat). */
  function normalizePasted(text) {
    return normalizeMath(text, 'paste');
  }

  /** Normalizzazione conservativa per anteprima ed export (non altera gli escape voluti). */
  function normalizeForRender(text) {
    return normalizeMath(text, 'render');
  }

  /* =====================================================================
     6. GESTIONE APPUNTI
     ===================================================================== */

  /** L'HTML proviene da un editor di codice (VS Code, IDE): meglio il testo semplice. */
  function isCodeEditorHtml(html) {
    if (!/white-space:\s*pre/i.test(html)) return false;
    return !/<(?:p|h[1-6]|li|table|blockquote|math)\b|katex|mwe-math/i.test(html);
  }

  /**
   * Il testo semplice è già sorgente Markdown (es. pulsante "Copia" di ChatGPT/Claude)?
   * In tal caso è più fedele dell'HTML renderizzato che lo accompagna.
   */
  function plainLooksLikeMarkdownSource(plain) {
    if (!plain) return false;
    // Segnali che il testo renderizzato di una pagina non contiene mai: fence, delimitatori
    // matematici, righe separatrici delle tabelle Markdown.
    const strong = [
      /^[ \t]*```/m, /^[ \t]*~~~/m, /\\\[[\s\S]*?\\\]/, /\\\([\s\S]*?\\\)/, /\$\$[\s\S]+?\$\$/,
      /(^|[^\\$])\$(?![\s$])[^$\n]+[^\s\\$]\$(?![\d$])/m,
      /^\|?[ \t]*:?-{3,}:?[ \t]*\|/m
    ];
    if (strong.some(rx => rx.test(plain))) return true;
    // Segnali deboli (un "# commento" o un "x**2" nel codice copiato non bastano da soli)
    const weak = [/^#{1,6}[ \t]+\S/m, /\*\*[^*\n\s][^*\n]*\*\*/, /\[[^\]\n]+\]\([^)\n]+\)/, /`[^`\n]+`/];
    return weak.filter(rx => rx.test(plain)).length >= 2;
  }

  const RICH_HTML_RX = /katex|mwe-math|mathml|<math|application\/x-tex|math\/tex|<table|<pre|<div|<h[1-6]|<li\b/i;
  const MATHY_PLAIN_RX = /\\{1,2}\(|\\{1,2}\[|\\{1,2}\$|\$\$|<(?:span|div|math)[^>]*class=["'][^"']*(?:katex|mwe-math)|^[ \t]*\\(?:#|-|\*|>|`)/im;

  /**
   * Decide come convertire il contenuto degli appunti. Unica funzione usata sia dall'editor
   * sia dalla modale "Indicizza Chat", così il risultato è identico.
   * Ritorna { markdown, source: 'html' | 'plain' | 'raw' }.
   */
  function clipboardToMarkdown(html, plain) {
    if (html && turndown && RICH_HTML_RX.test(html) && !isCodeEditorHtml(html)) {
      // Il pulsante "Copia" degli LLM fornisce sia Markdown sorgente sia HTML: vince il sorgente.
      if (!plainLooksLikeMarkdownSource(plain)) {
        try {
          return { markdown: htmlToMarkdown(html), source: 'html' };
        } catch (e) {
          console.warn('[SmartPaste] conversione HTML fallita, uso il testo semplice', e);
        }
      }
    }
    if (plain && MATHY_PLAIN_RX.test(plain)) return { markdown: normalizePasted(plain), source: 'plain' };
    return { markdown: plain || '', source: 'raw' };
  }

  /** Gestisce l'evento paste dell'editor. Ritorna true se ha gestito l'incolla. */
  function handlePaste(event, cmOrTextarea) {
    const cd = event.clipboardData;
    if (!cd) return false;
    const html = cd.getData('text/html');
    const plain = cd.getData('text/plain');

    // Conversazione AI copiata dalla pagina (HTML con ruoli): trascrizione pulita + indice
    if (html && typeof window.MiniPadChatIndexer !== 'undefined' && window.MiniPadChatIndexer.chatFromClipboard) {
      const chat = window.MiniPadChatIndexer.chatFromClipboard(html, plain);
      if (chat) {
        event.preventDefault();
        const from = cmOrTextarea && cmOrTextarea.getCursor ? cmOrTextarea.getCursor('from') : null;
        insertAtCursor(cmOrTextarea, chat.transcript);
        if (window.MiniPadChatIndexer.onChatPasted) {
          window.MiniPadChatIndexer.onChatPasted(chat, cmOrTextarea, from);
        }
        return true;
      }
    }

    const res = clipboardToMarkdown(html, plain);
    if (res.source === 'raw') return false; // lascia l'incolla nativo
    event.preventDefault();
    insertAtCursor(cmOrTextarea, res.markdown);
    return true;
  }

  /** Inserisce testo rispettando CodeMirror (EasyMDE) o un textarea nativo. */
  function insertAtCursor(target, text) {
    if (target && typeof target.replaceSelection === 'function') {
      target.replaceSelection(text);
      if (target.focus) target.focus();
      return;
    }
    if (target && typeof target.selectionStart === 'number') {
      const start = target.selectionStart;
      const end = target.selectionEnd;
      target.value = target.value.slice(0, start) + text + target.value.slice(end);
      const pos = start + text.length;
      target.selectionStart = target.selectionEnd = pos;
      target.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // Alias retrocompatibili: normalizeAllMath = normalizzazione d'incolla (comportamento storico)
  const normalizeAllMath = normalizePasted;
  const normalizeLLMMath = normalizePasted;

  return {
    init,
    handlePaste,
    clipboardToMarkdown,
    htmlToMarkdown,
    cleanPastedDom,
    normalizePasted,
    normalizeForRender,
    normalizeAllMath,
    normalizeLLMMath,
    cleanOverEscapedMarkdown,
    overEscapeScore,
    cleanMathFormula,
    looksLikeMath,
    extractTexFromHtml,
    extractLatex,
    insertAtCursor,
    splitFenced,
    parseFencedSegment,
    mapProse,
    replaceFencedBlocks,
    protectInlineCode
  };
})();

if (typeof window !== 'undefined') {
  window.normalizeAllMath = window.MiniPadSmartPaste.normalizeAllMath;
  window.cleanOverEscapedMarkdown = window.MiniPadSmartPaste.cleanOverEscapedMarkdown;
}
