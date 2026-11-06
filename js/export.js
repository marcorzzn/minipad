/**
 * MiniPad Export v1.5.5
 * Pipeline di esportazione completa: Markdown, HTML, LaTeX, TXT, PDF vettoriale e Stampa
 *
 * Changelog v1.5.5:
 *   - Delimitatori con trattino finale (MP-{rid}-{TYPE}-{index}-) per evitare index bleed
 *   - Estrazione preventiva valute grezze ($5,00, $19,99) ed escapate prima delle formule math
 *   - Supporto link \href, grassetto, corsivo e barrato nelle celle delle tabelle LaTeX
 *   - Gestione ricorsiva blockquote annidati (> >) e righe vuote quote in LaTeX
 *   - Conversione stili HTML inline in LaTeX (\textcolor, \colorbox, \uline, \textsuperscript, \textsubscript)
 *   - Supporto salti pagina manuali: <div class="page-break"></div> -> \clearpage in LaTeX
 *   - Fix export TXT: preservata numerazione liste ordinate, rimossi tag HTML e placeholder
 *   - Modale impostazioni stampa e PDF (margini, font size, orientamento, regole anti-spezzamento)
 */
window.MiniPadExport = (function () {
  const LATEX_ESCAPE = {
    '\\': '\\textbackslash{}',
    '&': '\\&',
    '%': '\\%',
    '$': '\\$',
    '#': '\\#',
    '{': '\\{',
    '}': '\\}',
    '~': '\\textasciitilde{}',
    '^': '\\textasciicircum{}'
  };

  function escapeLatexText(s) {
    return String(s || '').replace(/[\\&%$#_{}~^]/g, (c) => LATEX_ESCAPE[c]);
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sanitizeFilename(name) {
    return String(name || 'minipad')
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 120) || 'minipad';
  }

  function generateRenderId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return 'r' + crypto.randomUUID().replace(/-/g, '').slice(0, 10);
    }
    return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  /* ============================================================
     Estrazione protetta (condivisa da TeX e TXT)
     ============================================================ */
  function extractProtected(md, rid) {
    const codeBlocks = [];
    const maths = [];
    const currencies = [];

    md = String(md || '');

    // 1. Fenced code PRIMA di tutto
    md = md.replace(/```([\w-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      codeBlocks.push({ lang, code: code.replace(/\n$/, ''), inline: false });
      return `\n\nMP-${rid}-CODE-${codeBlocks.length - 1}-\n\n`;
    });

    // 2. Inline code con fence multipli (PRIMA dei singoli)
    md = md.replace(/(`{2,})((?:[^`]|`(?![`]))*?)\1/g, (_, fence, code) => {
      if (code.length >= 2 && code.startsWith(' ') && code.endsWith(' ') && code.trim()) {
        code = code.slice(1, -1);
      }
      codeBlocks.push({ lang: '', code, inline: true });
      return `MP-${rid}-ICODE-${codeBlocks.length - 1}-`;
    });

    // 3. Inline code con fence singoli
    md = md.replace(/`([^`\n]+)`/g, (_, code) => {
      codeBlocks.push({ lang: '', code, inline: true });
      return `MP-${rid}-ICODE-${codeBlocks.length - 1}-`;
    });

    // 4. Valute esplicite \$N e $N (DOPO i code, PRIMA di math per evitare falsi positivi)
    md = md.replace(/\\\$(\d[\d.,]*)/g, (_, amount) => {
      currencies.push(amount);
      return `MP-${rid}-CUR-${currencies.length - 1}-`;
    });
    md = md.replace(/(?<![\\$])\$(\d[\d.,]*)(?!\w)/g, (_, amount) => {
      currencies.push(amount);
      return `MP-${rid}-CUR-${currencies.length - 1}-`;
    });

    // 5. Math block $$...$$
    md = md.replace(/\$\$([\s\S]*?)\$\$/g, (_, m) => {
      maths.push({ block: true, tex: m.trim() });
      return `\n\nMP-${rid}-MATH-${maths.length - 1}-\n\n`;
    });

    // 6. Math inline $...$ (escluso \$ escapato)
    md = md.replace(/(?<![\\$])\$(?!\$)([^$\n]+?)\$(?!\$)/g, (_, m) => {
      maths.push({ block: false, tex: m.trim() });
      return `MP-${rid}-MATH-${maths.length - 1}-`;
    });

    return { md, codeBlocks, maths, currencies, rid };
  }

  /* ============================================================
     Helper LaTeX
     ============================================================ */
  function stripEmoji(s) {
    return String(s || '').replace(
      /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu,
      ''
    ).replace(/<\/?[a-zA-Z][^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  function convertCell(c) {
    // 1. Link [text](url) -> \href{cleanUrl}{text}
    let out = String(c || '').replace(/\[(.+?)\]\((.+?)\)/g, (_, text, url) => {
      const cleanUrl = url.replace(/\s+"[^"]*"$/, '').trim();
      return `\\href{${cleanUrl}}{${text}}`;
    });
    // 2. Bold / Italic / Strike
    out = out.replace(/\*\*(.+?)\*\*/g, '\\textbf{$1}')
             .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1\\textit{$2}')
             .replace(/~~(.+?)~~/g, '\\sout{$1}');
    // 3. Escape caratteri riservati fuori dai comandi LaTeX
    out = out.replace(/(?<!\\)&/g, '\\&')
             .replace(/(?<!\\)%/g, '\\%')
             .replace(/~/g, '\\textasciitilde{}')
             .replace(/\^/g, '\\textasciicircum{}')
             .replace(/(?<!\\)#/g, '\\#');
    return out;
  }

  function convertNestedList(lines, ordered) {
    const items = [];
    for (const line of lines) {
      const m = line.match(/^([ \t]*)([-*]|\d+\.)\s+(.+)$/);
      if (!m) continue;
      const level = Math.floor(m[1].replace(/\t/g, '  ').length / 2);
      items.push({ level, text: m[3] });
    }
    if (!items.length) return '';

    const env = ordered ? 'enumerate' : 'itemize';
    let result = '';
    let currentLevel = -1;
    const stack = [];

    for (const item of items) {
      while (currentLevel < item.level) {
        currentLevel += 1;
        stack.push(env);
        result += `\\begin{${env}}\n`;
      }
      while (currentLevel > item.level) {
        currentLevel -= 1;
        const closed = stack.pop();
        result += `\\end{${closed}}\n`;
      }
      result += `\\item ${item.text}\n`;
    }
    while (stack.length > 0) {
      const closed = stack.pop();
      result += `\\end{${closed}}\n`;
    }
    return '\n' + result + '\n';
  }

  function convertBlockquote(block) {
    const lines = block.split('\n').map((l) => l.replace(/^>\s?/, ''));
    const innerText = lines.join('\n');
    const processed = innerText.replace(/(?:^|\n)((?:>[^\n]*\n?)+)/g, (nested) => {
      return convertBlockquote(nested.trim());
    });
    return `\n\\begin{quote}\n${processed.trim()}\n\\end{quote}\n`;
  }

  /* ============================================================
     Markdown → LaTeX
     ============================================================ */
  function markdownToLatex(md) {
    const rid = generateRenderId();
    const { md: prot, codeBlocks, maths, currencies } = extractProtected(md, rid);
    const tables = [];

    // Salto pagina manuale (incluso \pagebreak, <!-- pagebreak -->, ---pagebreak---)
    let body = prot
      .replace(/^[ \t]*(?:\\pagebreak|<!--\s*pagebreak\s*-->|---pagebreak---|===pagebreak===)[ \t]*$/gim, '\n\\clearpage\n')
      .replace(/<div\s+class=["']page-break["']\s*><\/div>/gi, '\n\\clearpage\n');

    // Tabelle Markdown → tabular
    body = body.replace(/(?:^|\n)((?:\|.+\|\n?)+)/g, (block) => {
      const lines = block.trim().split('\n').filter((r) => r.trim());
      if (lines.length < 2) return block;
      const parseRow = (r) => r.split('|').slice(1, -1).map((c) => c.trim());
      const header = parseRow(lines[0]);
      const sep = parseRow(lines[1]) || [];
      const bodyRows = lines.slice(2).map(parseRow);
      const spec = header.map((_, i) => {
        const s = sep[i] || '';
        if (/^:-+:$/.test(s)) return 'c';
        if (/^-+:$/.test(s)) return 'r';
        return 'l';
      }).join('');
      let tex = `\n\\begin{center}\n\\begin{tabular}{${spec}}\n\\hline\n`;
      tex += header.map(convertCell).join(' & ') + ' \\\\\n\\hline\n';
      for (const row of bodyRows) {
        tex += row.map(convertCell).join(' & ') + ' \\\\\n';
      }
      tex += '\\hline\n\\end{tabular}\n\\end{center}\n';
      tables.push(tex);
      return `\n\nMP-${rid}-TAB-${tables.length - 1}-\n\n`;
    });

    // Intestazioni con rimozione emoji ed HTML
    body = body
      .replace(/^###### (.+)$/gm, (_, t) => `\\paragraph{${stripEmoji(t)}}`)
      .replace(/^##### (.+)$/gm, (_, t) => `\\subparagraph{${stripEmoji(t)}}`)
      .replace(/^#### (.+)$/gm, (_, t) => `\\subsubsection{${stripEmoji(t)}}`)
      .replace(/^### (.+)$/gm, (_, t) => `\\subsection{${stripEmoji(t)}}`)
      .replace(/^## (.+)$/gm, (_, t) => `\\section{${stripEmoji(t)}}`)
      .replace(/^# (.+)$/gm, (_, t) => `\\section*{${stripEmoji(t)}}`)
      .replace(/^---+$/gm, '\\bigskip\\hrule\\bigskip');

    // Blockquote (inclusi livelli annidati e righe vuote >)
    body = body.replace(/(?:^|\n)((?:>[^\n]*\n?)+)/g, (match) => {
      return convertBlockquote(match.trim());
    });

    // Task list interattive
    body = body.replace(
      /(?:^|\n)((?:[ \t]*[-*] \[[ xX]\] .+\n?)+)/g,
      (block) => {
        const items = block.trim().split('\n')
          .map((l) => {
            const m = l.match(/^[ \t]*[-*] \[([ xX])\] (.+)$/);
            if (!m) return null;
            const checked = m[1].toLowerCase() === 'x';
            const marker = checked ? '$\\boxtimes$' : '$\\square$';
            return `\\item[${marker}] ${m[2]}`;
          })
          .filter(Boolean)
          .join('\n');
        return `\n\\begin{itemize}\n${items}\n\\end{itemize}\n`;
      }
    );

    // Liste non ordinate con supporto annidamento
    body = body.replace(
      /(?:^|\n)((?:[ \t]*[-*] .+\n?)+)/g,
      (block) => convertNestedList(block.trim().split('\n'), false)
    );

    // Liste ordinate con supporto annidamento
    body = body.replace(
      /(?:^|\n)((?:[ \t]*\d+\. .+\n?)+)/g,
      (block) => convertNestedList(block.trim().split('\n'), true)
    );

    // Formattazione inline HTML supportata
    body = body
      .replace(/<span\s+style=["']color:\s*#?([0-9a-fA-F]{6})["']>([^<]+)<\/span>/gi, '\\textcolor[HTML]{$1}{$2}')
      .replace(/<span\s+style=["']background-color:\s*#?([0-9a-fA-F]{6})["']>([^<]+)<\/span>/gi, '\\colorbox[HTML]{$1}{$2}')
      .replace(/<u>([^<]+)<\/u>/gi, '\\uline{$1}')
      .replace(/<sup>([^<]+)<\/sup>/gi, '\\textsuperscript{$1}')
      .replace(/<sub>([^<]+)<\/sub>/gi, '\\textsubscript{$1}')
      .replace(/<\/?[a-zA-Z][^>]*>/g, ''); // strip altri tag HTML spuri

    // Strikethrough, grassetto, corsivo, link
    body = body
      .replace(/~~(.+?)~~/g, '\\sout{$1}')
      .replace(/\*\*(.+?)\*\*/g, '\\textbf{$1}')
      .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1\\textit{$2}')
      .replace(/\[(.+?)\]\((.+?)\)/g, (_, text, url) => {
        const cleanUrl = url.replace(/\s+"[^"]*"$/, '').trim();
        return `\\href{${cleanUrl}}{${text}}`;
      });

    // Escape del testo libero (SOLO fuori da placeholder, preservando i comandi LaTeX)
    const placeholderRe = new RegExp(`MP-${rid}-(CODE|ICODE|MATH|CUR|TAB)-(\\d+)-`, 'g');
    const parts = body.split(placeholderRe);
    let escaped = '';
    for (let i = 0; i < parts.length; i++) {
      if (i % 3 === 0) {
        escaped += parts[i]
          .replace(/&/g, '\\&')
          .replace(/%/g, '\\%')
          .replace(/_/g, '\\_')
          .replace(/~/g, '\\textasciitilde{}')
          .replace(/\^/g, '\\textasciicircum{}')
          .replace(/(?<!\\)#/g, '\\#');
      } else {
        escaped += `MP-${rid}-${parts[i]}-${parts[i + 1]}-`;
        i += 1;
      }
    }

    // Re-inject tabelle
    escaped = escaped.replace(
      new RegExp(`MP-${rid}-TAB-(\\d+)-`, 'g'),
      (_, i) => tables[+i]
    );

    // Re-inject valute
    escaped = escaped.replace(
      new RegExp(`MP-${rid}-CUR-(\\d+)-`, 'g'),
      (_, i) => `\\$${currencies[+i]}`
    );

    // Re-inject formule KaTeX/LaTeX
    escaped = escaped.replace(
      new RegExp(`MP-${rid}-MATH-(\\d+)-`, 'g'),
      (_, i) => {
        const m = maths[+i];
        return m.block ? `\n\\[\n${m.tex}\n\\]\n` : `\\(${m.tex}\\)`;
      }
    );

    // Re-inject codice blocco
    escaped = escaped.replace(
      new RegExp(`MP-${rid}-CODE-(\\d+)-`, 'g'),
      (_, i) => {
        const b = codeBlocks[+i];
        return `\n\\begin{verbatim}\n${b.code}\n\\end{verbatim}\n`;
      }
    );

    // Re-inject codice inline
    escaped = escaped.replace(
      new RegExp(`MP-${rid}-ICODE-(\\d+)-`, 'g'),
      (_, i) => {
        const b = codeBlocks[+i];
        const txt = b.code
          .replace(/\\/g, '\\textbackslash{}')
          .replace(/([&%$#_{}])/g, '\\$1')
          .replace(/~/g, '\\textasciitilde{}')
          .replace(/\^/g, '\\textasciicircum{}')
          .replace(/`/g, '\\textasciigrave{}');
        return `\\texttt{${txt}}`;
      }
    );

    return escaped;
  }

  /* ============================================================
     Export Markdown
     ============================================================ */
  function exportMarkdown(content, name) {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    download(blob, `${sanitizeFilename(name)}.md`);
  }

  /* ============================================================
     Export HTML standalone
     ============================================================ */
  function exportHTML(content, name) {
    const body = MiniPadPreview.renderToHTML(content);
    const title = escapeHtml(name || 'minipad');
    const doc = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"><\/script>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         max-width: 840px; margin: 2em auto; padding: 0 1.5em; line-height: 1.65; color: #222; }
  @media (prefers-color-scheme: dark) { body { color: #e6e6e6; background: #111; }
    pre, code { background: #1e1e1e !important; } }
  h1, h2, h3, h4 { margin-top: 1.4em; border-bottom: 1px solid #eee; padding-bottom: 6px; }
  pre { background: #f4f4f4; padding: 1em; border-radius: 6px; overflow-x: auto; }
  code { background: #f4f4f4; padding: .15em .35em; border-radius: 3px; font-size: .93em;
         font-family: Consolas, monospace; }
  pre code { background: transparent; padding: 0; }
  blockquote { border-left: 4px solid #0067c0; margin-left: 0; padding-left: 1em; color: #555; }
  img { max-width: 100%; border-radius: 4px; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #ccc; padding: .45em .8em; text-align: left; }
  th { background-color: rgba(0,0,0,0.04); }
  .mermaid { background: #fafafa; padding: 1em; border-radius: 6px; text-align: center; }
  .page-break { break-after: page !important; page-break-after: always !important; height: 0; margin: 0; padding: 0; }
  @media print {
    @page { size: A4; margin: 15mm; }
    .katex-mathml { display: none !important; }
    .katex-html { display: inline !important; }
    .katex-display, pre, table, blockquote, .mermaid { break-inside: avoid !important; page-break-inside: avoid !important; }
    h1, h2, h3, h4, h5, h6 { break-after: avoid !important; page-break-after: avoid !important; }
    thead { display: table-header-group !important; }
  }
</style>
</head>
<body>
${body}
<script>
  (function () {
    async function renderMermaid() {
      if (typeof mermaid === 'undefined') return;
      try {
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict',
          htmlLabels: false, theme: 'default' });
        const nodes = document.querySelectorAll('pre.mermaid, .mermaid');
        if (nodes.length > 0) {
          if (typeof mermaid.run === 'function') {
            await mermaid.run({ nodes: Array.from(nodes) });
          } else {
            for (const node of nodes) {
              const id = 'm' + Math.random().toString(36).slice(2);
              const { svg } = await mermaid.render(id, node.textContent);
              node.innerHTML = svg;
            }
          }
        }
      } catch (e) { console.warn('Mermaid render fallito:', e); }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', renderMermaid);
    } else { renderMermaid(); }
  })();
<\/script>
</body>
</html>`;
    const blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
    download(blob, `${sanitizeFilename(name)}.html`);
  }

  /* ============================================================
     Export LaTeX
     ============================================================ */
  function exportLaTeX(content, name) {
    const body = markdownToLatex(content);
    const doc = `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[italian]{babel}
\\usepackage{amsmath,amssymb,amsfonts}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\usepackage{geometry}
\\usepackage{ulem}
\\usepackage{xcolor}
\\geometry{margin=2.5cm}
\\hypersetup{colorlinks=true,linkcolor=blue,urlcolor=blue}

\\title{${escapeLatexText(stripEmoji(name || 'minipad'))}}
\\author{}
\\date{\\today}

\\begin{document}
\\maketitle

${body}

\\end{document}
`;
    const blob = new Blob([doc], { type: 'application/x-tex;charset=utf-8' });
    download(blob, `${sanitizeFilename(name)}.tex`);
  }

  /* ============================================================
     Export TXT
     ============================================================ */
  function exportTxt(content, name) {
    const rid = generateRenderId();
    let text = String(content || '');

    const codeBlocks = [];
    const maths = [];
    const currencies = [];

    // Salto pagina -> separatore
    text = text
      .replace(/^[ \t]*(?:\\pagebreak|<!--\s*pagebreak\s*-->|---pagebreak---|===pagebreak===)[ \t]*$/gim, '\n\n--------------------\n\n')
      .replace(/<div\s+class=["']page-break["']\s*><\/div>/gi, '\n\n--------------------\n\n');

    // Code PRIMA di tutto
    text = text.replace(/```([\w-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      codeBlocks.push({ code: code.replace(/\n$/, ''), inline: false });
      return `\n\nMP-${rid}-CODE-${codeBlocks.length - 1}-\n\n`;
    });
    text = text.replace(/(`{2,})((?:[^`]|`(?![`]))*?)\1/g, (_, fence, code) => {
      if (code.length >= 2 && code.startsWith(' ') && code.endsWith(' ') && code.trim()) {
        code = code.slice(1, -1);
      }
      codeBlocks.push({ code: code.replace(/`/g, ''), inline: true });
      return `MP-${rid}-ICODE-${codeBlocks.length - 1}-`;
    });
    text = text.replace(/`([^`\n]+)`/g, (_, code) => {
      codeBlocks.push({ code, inline: true });
      return `MP-${rid}-ICODE-${codeBlocks.length - 1}-`;
    });

    // Valute
    text = text.replace(/\\\$(\d[\d.,]*)/g, (_, amt) => {
      currencies.push(amt);
      return `MP-${rid}-CUR-${currencies.length - 1}-`;
    });
    text = text.replace(/(?<![\\$])\$(\d[\d.,]*)(?!\w)/g, (_, amt) => {
      currencies.push(amt);
      return `MP-${rid}-CUR-${currencies.length - 1}-`;
    });

    // Math (block preserva $$, inline preserva $)
    text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, m) => {
      maths.push({ block: true, tex: m.trim() });
      return `\n\n$$${m.trim()}$$\n\n`;
    });
    text = text.replace(/(?<![\\$])\$(?!\$)([^$\n]+?)\$(?!\$)/g, (_, m) => {
      maths.push({ block: false, tex: m.trim() });
      return `MP-${rid}-MATH-${maths.length - 1}-`;
    });

    // Markdown → plain
    text = text
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^>\s?/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1$2')
      .replace(/~~(.+?)~~/g, '$1')
      .replace(/\[(.+?)\]\((.+?)\)/g, (_, t, u) => {
        const clean = u.replace(/\s+"[^"]*"$/, '').trim();
        return `${t} (${clean})`;
      })
      .replace(/^[ \t]*[-*]\s+/gm, '• ')
      .replace(/<\/?[a-zA-Z][^>]*>/g, ''); // strip tag HTML rimanenti

    // Restore valute, math inline, codice
    text = text.replace(
      new RegExp(`MP-${rid}-CUR-(\\d+)-`, 'g'),
      (_, i) => `$${currencies[+i]}`
    );
    text = text.replace(
      new RegExp(`MP-${rid}-MATH-(\\d+)-`, 'g'),
      (_, i) => `$${maths[+i].tex}$`
    );
    text = text.replace(
      new RegExp(`MP-${rid}-CODE-(\\d+)-`, 'g'),
      (_, i) => `\n${codeBlocks[+i].code}\n`
    );
    text = text.replace(
      new RegExp(`MP-${rid}-ICODE-(\\d+)-`, 'g'),
      (_, i) => codeBlocks[+i].code
    );

    // Un-escape \$ residui
    text = text.replace(/\\\$/g, '$');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    download(blob, `${sanitizeFilename(name)}.txt`);
  }

  /* ============================================================
     Export PDF via html2pdf
     ============================================================ */
  async function exportPDF(content, name, options) {
    if (typeof html2pdf === 'undefined') {
      alert('Export PDF non disponibile: libreria html2pdf non caricata. Puoi usare "Stampa / Salva PDF" per salvare via browser.');
      return;
    }
    const opts = options || {};
    const marginMap = {
      compact: [10, 10, 10, 10],
      normal: [15, 15, 15, 15],
      wide: [25, 25, 25, 25],
      zero: [6, 6, 6, 6]
    };
    const marginArr = marginMap[opts.margins] || [12, 12, 12, 12];
    const orient = opts.orientation === 'landscape' ? 'landscape' : 'portrait';

    const holder = document.createElement('div');
    holder.style.cssText =
      'padding:20px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
      'line-height:1.6;color:#111;background:#fff;max-width:820px;';
    holder.innerHTML = MiniPadPreview.renderToHTML(content);
    document.body.appendChild(holder);

    const mermaidNodes = holder.querySelectorAll('.mermaid');
    if (typeof mermaid !== 'undefined' && mermaidNodes.length) {
      try {
        await mermaid.run({ nodes: Array.from(mermaidNodes) });
      } catch (e) { console.warn(e); }
    }

    try {
      await html2pdf().set({
        margin: marginArr,
        filename: `${sanitizeFilename(name)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: orient },
        pagebreak: { mode: ['css', 'legacy'] }
      }).from(holder).save();
    } catch (e) {
      console.error('[Export] PDF fallito', e);
      alert("Errore durante l'esportazione PDF: " + e.message);
    } finally {
      if (holder.parentNode) document.body.removeChild(holder);
    }
  }

  /* ============================================================
     Stampa avanzata e PDF Vettoriale nativo
     ============================================================ */
  function printDocument(content, name, options) {
    const opts = Object.assign({
      margins: 'normal',
      fontFamily: 'sans',
      fontSize: 'normal',
      lineHeight: 'normal',
      orientation: 'portrait',
      theme: 'clean',
      avoidBreaks: true,
      headerTitle: true,
      footerDate: true,
      h1Break: false
    }, options || {});

    const marginMap = {
      compact: '10mm',
      normal: '15mm',
      wide: '25mm',
      zero: '6mm'
    };
    const fontFamMap = {
      sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
      mono: 'Consolas, "SF Mono", Monaco, Menlo, "Courier New", monospace'
    };
    const fontMap = {
      compact: '10.5pt',
      normal: '12pt',
      large: '13.5pt'
    };
    const lineHeightMap = {
      compact: '1.4',
      normal: '1.6',
      relaxed: '1.85'
    };

    const marginVal = marginMap[opts.margins] || '15mm';
    const fontFamVal = fontFamMap[opts.fontFamily] || fontFamMap.sans;
    const fontVal = fontMap[opts.fontSize] || '12pt';
    const lineHVal = lineHeightMap[opts.lineHeight] || '1.6';
    const orientationVal = opts.orientation === 'landscape' ? 'landscape' : 'portrait';

    let themeHeaderBorder = '#ccc';
    let themeCodeBg = '#f4f4f4';
    let themeQuoteBorder = '#0067c0';
    let themeThBg = '#f0f0f0';

    if (opts.theme === 'academic') {
      themeHeaderBorder = '#000';
      themeCodeBg = '#fcfcfc';
      themeQuoteBorder = '#333';
      themeThBg = '#e8e8e8';
    } else if (opts.theme === 'formal') {
      themeHeaderBorder = '#444';
      themeCodeBg = '#f6f8fa';
      themeQuoteBorder = '#555';
      themeThBg = '#ececec';
    }

    const body = MiniPadPreview.renderToHTML(content);
    const w = window.open('', '_blank');
    if (!w) {
      alert('Blocca-popup attivo: consenti i popup per stampare o salvare in PDF.');
      return;
    }

    w.document.write(`<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(name || 'minipad')}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"><\/script>
<style>
  @page {
    size: A4 ${orientationVal};
    margin: ${marginVal};
  }
  * { box-sizing: border-box; }
  body {
    font-family: ${fontFamVal};
    font-size: ${fontVal};
    line-height: ${lineHVal};
    color: #1a1a1a;
    background: #fff;
    margin: 0;
    padding: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .mp-print-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid ${themeHeaderBorder};
    padding-bottom: 5px;
    margin-bottom: 20px;
    font-size: 8.5pt;
    color: #666;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .mp-print-header strong {
    color: #222;
  }
  .mp-print-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid #ddd;
    padding-top: 6px;
    margin-top: 25px;
    font-size: 8pt;
    color: #888;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  h1, h2, h3, h4, h5, h6 {
    color: #111;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    font-weight: 700;
    ${opts.avoidBreaks ? 'break-after: avoid-page !important; break-after: avoid !important; page-break-after: avoid !important; break-inside: avoid !important;' : ''}
  }
  ${opts.h1Break ? 'h1 { break-before: page !important; page-break-before: always !important; } h1:first-of-type { break-before: auto !important; page-break-before: auto !important; }' : ''}
  h1 { font-size: 1.85em; border-bottom: 2px solid #222; padding-bottom: 4px; }
  h2 { font-size: 1.45em; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
  h3 { font-size: 1.2em; }
  h4 { font-size: 1.05em; }
  p {
    margin: 0.6em 0 0.9em 0;
    orphans: 3;
    widows: 3;
  }
  ul, ol {
    margin: 0.5em 0 0.9em 1.4em;
    padding: 0;
  }
  li {
    margin-bottom: 0.35em;
    ${opts.avoidBreaks ? 'break-inside: avoid !important; page-break-inside: avoid !important;' : ''}
  }
  pre {
    background: ${themeCodeBg};
    padding: 0.85em 1em;
    border-radius: 4px;
    border: 1px solid #ddd;
    overflow-x: auto;
    font-family: Consolas, "SF Mono", Monaco, Menlo, monospace;
    font-size: 0.88em;
    line-height: 1.45;
    margin: 1em 0;
    ${opts.avoidBreaks ? 'break-inside: avoid !important; page-break-inside: avoid !important;' : ''}
  }
  code {
    background: ${themeCodeBg};
    padding: .15em .35em;
    border-radius: 3px;
    font-family: Consolas, "SF Mono", Monaco, Menlo, monospace;
    font-size: 0.88em;
  }
  pre code { background: transparent; padding: 0; border: none; font-size: 1em; }
  blockquote {
    border-left: 4px solid ${themeQuoteBorder};
    margin: 1em 0;
    padding: 0.4em 1em;
    background: #f8f9fa;
    color: #444;
    ${opts.avoidBreaks ? 'break-inside: avoid !important; page-break-inside: avoid !important;' : ''}
  }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 1.2em 0;
    font-size: 0.92em;
  }
  thead {
    display: table-header-group !important;
  }
  tr {
    ${opts.avoidBreaks ? 'break-inside: avoid !important; page-break-inside: avoid !important;' : ''}
  }
  th, td {
    border: 1px solid #ccc;
    padding: .45em .75em;
    text-align: left;
  }
  th { background: ${themeThBg}; font-weight: 600; }
  .mermaid {
    background: #fafafa;
    padding: 1em;
    border: 1px solid #eee;
    border-radius: 4px;
    text-align: center;
    margin: 1.2em 0;
    ${opts.avoidBreaks ? 'break-inside: avoid !important; page-break-inside: avoid !important;' : ''}
  }
  .mermaid svg {
    max-width: 100% !important;
    height: auto !important;
  }
  .katex-display {
    margin: 1em 0;
    overflow-x: visible !important;
    overflow-y: visible !important;
    ${opts.avoidBreaks ? 'break-inside: avoid !important; page-break-inside: avoid !important;' : ''}
  }
  .page-break {
    break-after: page !important;
    page-break-after: always !important;
    break-before: page !important;
    page-break-before: always !important;
    height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    display: block !important;
    visibility: hidden !important;
  }
  @media print {
    .katex-mathml { display: none !important; }
    .katex-html { display: inline !important; }
    body { width: 100% !important; margin: 0 !important; padding: 0 !important; }
  }
</style>
</head>
<body>
${opts.headerTitle ? `
  <div class="mp-print-header">
    <strong>${escapeHtml(name || 'Documento')}</strong>
    <span>${new Date().toLocaleDateString('it-IT')}</span>
  </div>
` : ''}
${body}
${opts.footerDate ? `
  <div class="mp-print-footer">
    <span>MiniPad — Documento formattato</span>
    <span>Generato il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
  </div>
` : ''}
<script>
  (function() {
    async function init() {
      if (typeof mermaid !== 'undefined') {
        try {
          mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
          const nodes = document.querySelectorAll('.mermaid');
          if (nodes.length > 0) {
            await mermaid.run({ nodes: Array.from(nodes) });
          }
        } catch(e) { console.warn('Mermaid print error', e); }
      }
      setTimeout(function() {
        window.focus();
        window.print();
      }, 500);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();
<\/script>
</body>
</html>`);
    w.document.close();
  }

  /* ============================================================
     Anteprima Live nel Modale di Stampa & PDF
     ============================================================ */
  function updatePrintPreview() {
    const sheetEl = document.getElementById('print-sheet-preview');
    if (!sheetEl) return;

    let content = '';
    if (typeof MiniPadEditor !== 'undefined' && MiniPadEditor.getValue) {
      content = MiniPadEditor.getValue();
    } else if (typeof getEditorContent === 'function') {
      content = getEditorContent();
    } else if (window.editorInstance) {
      content = window.editorInstance.value();
    }

    const margins = document.getElementById('print-opt-margins')?.value || 'normal';
    const fontFamily = document.getElementById('print-opt-fontfamily')?.value || 'sans';
    const fontSize = document.getElementById('print-opt-fontsize')?.value || 'normal';
    const lineHeight = document.getElementById('print-opt-lineheight')?.value || 'normal';
    const orientation = document.getElementById('print-opt-orientation')?.value || 'portrait';
    const theme = document.getElementById('print-opt-theme')?.value || 'clean';
    const headerTitle = document.getElementById('print-opt-header-title')?.checked ?? true;
    const footerDate = document.getElementById('print-opt-footer-date')?.checked ?? true;
    const h1Break = document.getElementById('print-opt-h1-break')?.checked ?? false;

    let title = 'minipad';
    const titleEl = document.getElementById('doc-title') || document.querySelector('.note-tab.active .tab-title');
    if (titleEl) {
      title = (titleEl.value || titleEl.textContent || 'minipad').trim();
    }

    const marginPaddingMap = {
      compact: '16px 20px',
      normal: '24px 28px',
      wide: '34px 40px',
      zero: '10px 12px'
    };

    const fontFamMap = {
      sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      serif: 'Georgia, Cambria, "Times New Roman", serif',
      mono: 'Consolas, "SF Mono", Monaco, monospace'
    };

    const fontScaleMap = {
      compact: '11px',
      normal: '12.5px',
      large: '14px'
    };

    const lineHMap = {
      compact: '1.4',
      normal: '1.6',
      relaxed: '1.85'
    };

    sheetEl.className = 'mp-print-sheet' + (orientation === 'landscape' ? ' is-landscape' : '') + ' theme-' + theme;
    sheetEl.style.padding = marginPaddingMap[margins] || '24px 28px';
    sheetEl.style.fontFamily = fontFamMap[fontFamily] || fontFamMap.sans;
    sheetEl.style.fontSize = fontScaleMap[fontSize] || '12.5px';
    sheetEl.style.lineHeight = lineHMap[lineHeight] || '1.6';

    const body = MiniPadPreview.renderToHTML(content);

    let html = '';
    if (headerTitle) {
      html += `
        <div class="mp-print-sheet-header">
          <strong>${escapeHtml(title)}</strong>
          <span>${new Date().toLocaleDateString('it-IT')}</span>
        </div>
      `;
    }

    html += `<div class="mp-print-sheet-content ${h1Break ? 'h1-break-active' : ''}">${body}</div>`;

    if (footerDate) {
      html += `
        <div class="mp-print-sheet-footer">
          <span>MiniPad — Anteprima di Stampa</span>
          <span>${new Date().toLocaleDateString('it-IT')} ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      `;
    }

    sheetEl.innerHTML = html;

    const badge = document.getElementById('print-preview-badge');
    if (badge) {
      const orientLabel = orientation === 'landscape' ? 'A4 Orizzontale' : 'A4 Verticale';
      const marginLabel = margins === 'compact' ? '10 mm' : (margins === 'wide' ? '25 mm' : (margins === 'zero' ? '6 mm' : '15 mm'));
      badge.textContent = `${orientLabel} • ${marginLabel}`;
    }

    const mermaidNodes = sheetEl.querySelectorAll('.mermaid');
    if (typeof mermaid !== 'undefined' && mermaidNodes.length > 0) {
      try {
        mermaid.run({ nodes: Array.from(mermaidNodes) });
      } catch (e) { /* ignore */ }
    }
  }

  /* ============================================================
     Modale Impostazioni Stampa & PDF
     ============================================================ */
  function openPrintModal() {
    const modal = document.getElementById('print-modal-overlay');
    if (modal) {
      modal.classList.add('is-open');
      document.body.classList.add('mp-modal-open');
      updatePrintPreview();
    }
  }

  function closePrintModal() {
    const modal = document.getElementById('print-modal-overlay');
    if (modal) {
      modal.classList.remove('is-open');
      document.body.classList.remove('mp-modal-open');
    }
  }

  function confirmPrintDocument(action) {
    const margins = document.getElementById('print-opt-margins')?.value || 'normal';
    const fontFamily = document.getElementById('print-opt-fontfamily')?.value || 'sans';
    const fontSize = document.getElementById('print-opt-fontsize')?.value || 'normal';
    const lineHeight = document.getElementById('print-opt-lineheight')?.value || 'normal';
    const orientation = document.getElementById('print-opt-orientation')?.value || 'portrait';
    const theme = document.getElementById('print-opt-theme')?.value || 'clean';
    const avoidBreaks = document.getElementById('print-opt-avoid-breaks')?.checked ?? true;
    const headerTitle = document.getElementById('print-opt-header-title')?.checked ?? true;
    const footerDate = document.getElementById('print-opt-footer-date')?.checked ?? true;
    const h1Break = document.getElementById('print-opt-h1-break')?.checked ?? false;

    closePrintModal();

    let content = '';
    if (typeof MiniPadEditor !== 'undefined' && MiniPadEditor.getValue) {
      content = MiniPadEditor.getValue();
    } else if (typeof getEditorContent === 'function') {
      content = getEditorContent();
    } else if (window.editorInstance) {
      content = window.editorInstance.value();
    }

    let title = 'minipad';
    const titleEl = document.getElementById('doc-title') || document.querySelector('.note-tab.active .tab-title');
    if (titleEl) {
      title = (titleEl.value || titleEl.textContent || 'minipad').trim();
    }

    if (action === 'direct-pdf') {
      exportPDF(content, title, { margins, orientation });
    } else {
      printDocument(content, title, {
        margins,
        fontFamily,
        fontSize,
        lineHeight,
        orientation,
        theme,
        avoidBreaks,
        headerTitle,
        footerDate,
        h1Break
      });
    }
  }

  // Bridge su window per retrocompatibilità ed eventi DOM inline
  window.openPrintModal = openPrintModal;
  window.closePrintModal = closePrintModal;
  window.confirmPrintDocument = confirmPrintDocument;
  window.exportMarkdown = function() {
    const content = typeof getEditorContent === 'function' ? getEditorContent() : (window.editorInstance ? window.editorInstance.value() : '');
    const name = typeof promptExportName === 'function' ? promptExportName() : 'minipad';
    if (name) exportMarkdown(content, name);
  };
  window.exportHTML = function() {
    const content = typeof getEditorContent === 'function' ? getEditorContent() : (window.editorInstance ? window.editorInstance.value() : '');
    const name = typeof promptExportName === 'function' ? promptExportName() : 'minipad';
    if (name) exportHTML(content, name);
  };
  window.exportTXT = function() {
    const content = typeof getEditorContent === 'function' ? getEditorContent() : (window.editorInstance ? window.editorInstance.value() : '');
    const name = typeof promptExportName === 'function' ? promptExportName() : 'minipad';
    if (name) exportTxt(content, name);
  };
  window.exportTeX = function() {
    const content = typeof getEditorContent === 'function' ? getEditorContent() : (window.editorInstance ? window.editorInstance.value() : '');
    const name = typeof promptExportName === 'function' ? promptExportName() : 'minipad';
    if (name) exportLaTeX(content, name);
  };
  window.exportPDF = function() {
    openPrintModal();
  };
  window.updatePrintPreview = updatePrintPreview;
  window.printDocument = printDocument;

  return {
    exportMarkdown,
    exportHTML,
    exportLaTeX,
    exportPDF,
    exportTxt,
    printDocument,
    openPrintModal,
    closePrintModal,
    confirmPrintDocument,
    updatePrintPreview,
    markdownToLatex,
    sanitizeFilename
  };
})();
