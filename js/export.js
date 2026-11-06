/**
 * MiniPad Export
 * Standard di settore: .md, .html (standalone), .tex (con escape corretto), .pdf, .txt, e stampa nativa
 */
window.MiniPadExport = (function () {
  const LATEX_ESCAPE = {
    '&': '\\&',
    '%': '\\%',
    '_': '\\_',
    '{': '\\{',
    '}': '\\}',
    '~': '\\textasciitilde{}',
    '^': '\\textasciicircum{}'
  };

  function escapeLatexText(s) {
    return String(s || '').replace(/[&%_{}~^]/g, (c) => LATEX_ESCAPE[c] || c);
  }

  function sanitizeFilename(name) {
    return String(name || 'minipad')
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 120) || 'minipad';
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

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ---------- Markdown ---------- */
  function exportMarkdown(content, name) {
    const blob = new Blob([content || ''], { type: 'text/markdown;charset=utf-8' });
    download(blob, `${sanitizeFilename(name)}.md`);
  }

  /* ---------- HTML Standalone ---------- */
  function exportHTML(content, name) {
    const body = typeof MiniPadPreview !== 'undefined'
      ? MiniPadPreview.renderToHTML(content)
      : (content || '');
    const title = escapeHtml(name || 'minipad');
    const doc = `<!DOCTYPE html>
<!-- Nota: questo file richiede internet al primo caricamento per i font KaTeX e il runtime Mermaid.
     Per un documento 100% autonomo offline senza dipendenze CDN, usa "Stampa…" -> "Salva come PDF". -->
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"><\/script>
<style>
  :root { color-scheme: light dark; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    max-width: 820px;
    margin: 2em auto;
    padding: 0 1.2em;
    line-height: 1.65;
    color: #222;
  }
  @media (prefers-color-scheme: dark) {
    body { color: #e6e6e6; background: #111; }
    pre, code { background: #1e1e1e !important; }
  }
  h1, h2, h3, h4 { margin-top: 1.4em; border-bottom: 1px solid #eee; padding-bottom: 6px; }
  pre { background: #f4f4f4; padding: 1em; border-radius: 6px; overflow-x: auto; }
  code { background: #f4f4f4; padding: .15em .35em; border-radius: 3px; font-size: .93em; font-family: Consolas, monospace; }
  pre code { background: transparent; padding: 0; }
  blockquote { border-left: 4px solid #0067c0; margin-left: 0; padding-left: 1em; color: #555; }
  img { max-width: 100%; border-radius: 4px; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #ccc; padding: .45em .8em; text-align: left; }
  th { background-color: rgba(0,0,0,0.04); }
  .mermaid { background: #fafafa; padding: 1em; border-radius: 6px; text-align: center; }
  @media print {
    .katex-mathml { display: none !important; }
    .katex-html { display: inline !important; }
    .katex-display { page-break-inside: avoid; }
    pre, table { page-break-inside: avoid; }
    h1, h2, h3 { page-break-after: avoid; }
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
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          htmlLabels: false,
          theme: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default'
        });
        const nodes = document.querySelectorAll('pre.mermaid');
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
      } catch (e) {
        console.warn('Mermaid render fallito:', e);
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', renderMermaid);
    } else {
      renderMermaid();
    }
  })();
<\/script>
</body>
</html>`;
    const blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
    download(blob, `${sanitizeFilename(name)}.html`);
  }

  /* ---------- LaTeX ---------- */
  function markdownToLatex(md) {
    const codeBlocks = [];
    const mathBlocks = [];
    const tables = [];

    let text = String(md || '');

    // 1. CODE PRIMA DI TUTTO — protegge $HOME, $(( )), etc.
    text = text.replace(/(^|\n)```([\w-]*)[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*```(?=\r?\n|$)/g, (_, lead, lang, code) => {
      codeBlocks.push({ lang, code: code.replace(/\r?\n$/, ''), inline: false });
      return `${lead}\n\n@@MP_CODE_${codeBlocks.length - 1}@@\n\n`;
    });

    // Inline code CommonMark: prima i fence multipli (2+ backtick), poi i singoli
    text = text.replace(/(`{2,})([\s\S]*?)\1/g, (match, fence, code) => {
      if (code.length >= 2 && code.startsWith(' ') && code.endsWith(' ') && code.trim()) {
        code = code.slice(1, -1);
      }
      codeBlocks.push({ lang: '', code, inline: true });
      return `@@MP_ICODE_${codeBlocks.length - 1}@@`;
    });

    text = text.replace(/`([^`\r\n]+)`/g, (_, code) => {
      codeBlocks.push({ lang: '', code, inline: true });
      return `@@MP_ICODE_${codeBlocks.length - 1}@@`;
    });

    // 2. PROTEZIONE VALUTE: $<cifra> non deve MAI diventare math
    text = text.replace(/(^|[^\\])\$(\d)/g, '$1@@MP_CURR_$2');

    // 3. MATH (le formule non collidono con le valute protette)
    text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, m) => {
      mathBlocks.push({ block: true, tex: m.trim() });
      return `\n\n@@MP_MATH_${mathBlocks.length - 1}@@\n\n`;
    });

    text = text.replace(/(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g, (_, m) => {
      mathBlocks.push({ block: false, tex: m.trim() });
      return `@@MP_MATH_${mathBlocks.length - 1}@@`;
    });

    // Ripristina valute con \$ per LaTeX usando function replacer
    text = text.replace(/@@MP_CURR_(\d)/g, (_, d) => `\\$${d}`);

    // 4. Tabelle Markdown -> tabular
    text = text.replace(
      /(?:^|\n)((?:\|.+\|\r?\n)+)/g,
      (block) => {
        const rows = block.trim().split(/\r?\n/).filter(r => r.trim());
        if (rows.length < 2) return block;
        const parseRow = r => r.split('|').slice(1, -1).map(c => c.trim());
        const header = parseRow(rows[0]);
        const bodyRows = rows.slice(1).filter(r => !/^\s*\|?\s*:?-+:?\s*\|/.test(r));
        const body = bodyRows.map(parseRow);
        const spec = 'l'.repeat(header.length);
        let tex = `\n\\begin{center}\n\\begin{tabular}{${spec}}\n\\hline\n`;
        tex += header.map(c => escapeLatexText(c)).join(' & ') + ' \\\\\n\\hline\n';
        for (const row of body) {
          tex += row.map(c => escapeLatexText(c)).join(' & ') + ' \\\\\n';
        }
        tex += '\\hline\n\\end{tabular}\n\\end{center}\n';
        tables.push(tex);
        return `\n\n@@MP_TAB_${tables.length - 1}@@\n\n`;
      }
    );

    // 5. Struttura titoli e linee Markdown -> comandi LaTeX (PRIMA di escape #)
    text = text
      .replace(/^###### (.+)$/gm, '\\paragraph{$1}')
      .replace(/^##### (.+)$/gm, '\\subparagraph{$1}')
      .replace(/^#### (.+)$/gm, '\\subsubsection{$1}')
      .replace(/^### (.+)$/gm, '\\subsection{$1}')
      .replace(/^## (.+)$/gm, '\\section{$1}')
      .replace(/^# (.+)$/gm, '\\section*{$1}')
      .replace(/^---+$/gm, '\\bigskip\\hrule\\bigskip');

    // 6. Escape testo ordinario preservando i placeholder @@MP_...@@ e comandi LaTeX
    const parts = text.split(/(@@MP_[A-Z]+_\d+@@)/);
    text = parts.map(part => {
      if (/^@@MP_[A-Z]+_\d+@@$/.test(part)) return part;
      return part
        .replace(/&/g, '\\&')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_')
        .replace(/~/g, '\\textasciitilde{}')
        .replace(/\^/g, '\\textasciicircum{}')
        .replace(/(?<!\\)#/g, '\\#');
    }).join('');

    // 7. Grassetto, corsivo, link
    text = text
      .replace(/\*\*(.+?)\*\*/g, '\\textbf{$1}')
      .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1\\textit{$2}')
      .replace(/\[(.+?)\]\((.+?)\)/g, '\\href{$2}{$1}');

    // 8. Liste puntate e numerate
    text = text.replace(/(?:^|\n)((?:[-*] .+\r?\n?)+)/g, (block) => {
      const items = block.trim().split(/\r?\n/).map(l => `\\item ${l.replace(/^[-*] /, '')}`).join('\n');
      return `\n\\begin{itemize}\n${items}\n\\end{itemize}\n`;
    });
    text = text.replace(/(?:^|\n)((?:\d+\. .+\r?\n?)+)/g, (block) => {
      const items = block.trim().split(/\r?\n/).map(l => `\\item ${l.replace(/^\d+\. /, '')}`).join('\n');
      return `\n\\begin{enumerate}\n${items}\n\\end{enumerate}\n`;
    });

    // 9. Re-inject TABELLE
    text = text.replace(/@@MP_TAB_(\d+)@@/g, (_, i) => tables[+i] || '');

    // 10. Re-inject MATH
    text = text.replace(/@@MP_MATH_(\d+)@@/g, (_, i) => {
      const m = mathBlocks[+i];
      if (!m) return '';
      return m.block ? `\n\\[\n${m.tex}\n\\]\n` : `\\(${m.tex}\\)`;
    });

    // 11. Re-inject CODE (con loop di risoluzione per placeholder annidati)
    // Il loop è necessario perché il contenuto utente può annidare placeholder
    // (es. una tabella Markdown con inline code che contiene backtick o formule).
    // Limite 5: oltre è quasi certamente un bug di auto-referenza.
    let prevCode = '';
    let itCode = 0;
    while (text !== prevCode && itCode < 5) {
      prevCode = text;
      itCode++;
      text = text.replace(/@@MP_CODE_(\d+)@@/g, (_, i) => {
        const b = codeBlocks[+i];
        return b ? `\n\\begin{verbatim}\n${b.code}\n\\end{verbatim}\n` : '';
      });

      text = text.replace(/@@MP_ICODE_(\d+)@@/g, (_, i) => {
        const b = codeBlocks[+i];
        if (!b) return '';
        const txt = b.code
          .replace(/\\/g, '\\textbackslash{}')
          .replace(/([{}])/g, '\\$1')
          .replace(/\$/g, '\\$')
          .replace(/_/g, '\\_')
          .replace(/%/g, '\\%')
          .replace(/&/g, '\\&')
          .replace(/#/g, '\\#')
          .replace(/\^/g, '\\textasciicircum{}')
          .replace(/~/g, '\\textasciitilde{}')
          .replace(/`/g, '\\textasciigrave{}');
        return `\\texttt{${txt}}`;
      });
    }

    return text;
  }

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
\\geometry{margin=2.5cm}
\\hypersetup{colorlinks=true,linkcolor=blue,urlcolor=blue}

\\title{${escapeLatexText(name || 'minipad')}}
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

  /* ---------- Stampa Nativa Browser ---------- */
  function printDocument(content, name) {
    const body = typeof MiniPadPreview !== 'undefined'
      ? MiniPadPreview.renderToHTML(content)
      : (content || '');
    const title = escapeHtml(name || 'minipad');
    const w = window.open('', '_blank');
    if (!w) {
      alert('Blocca-popup attivo: consenti i popup per stampare.');
      return;
    }
    w.document.write(`<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"><\/script>
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    max-width: 820px;
    margin: 1.5em auto;
    padding: 0 1em;
    line-height: 1.6;
    color: #222;
  }
  pre { background: #f4f4f4; padding: 1em; border-radius: 6px; overflow-x: auto; }
  code { background: #f4f4f4; padding: .15em .35em; border-radius: 3px; font-family: Consolas, monospace; }
  pre code { background: transparent; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #ccc; padding: .45em .8em; text-align: left; }
  th { background: rgba(0,0,0,0.04); }
  .mermaid { background: #fafafa; padding: 1em; border-radius: 6px; text-align: center; }
  @media print {
    .katex-mathml { display: none !important; }
    .katex-html { display: inline !important; }
    .katex-display { page-break-inside: avoid; }
    pre, table { page-break-inside: avoid; }
    h1, h2, h3 { page-break-after: avoid; }
  }
</style>
</head>
<body>
${body}
<script>
  (async function () {
    if (typeof mermaid !== 'undefined') {
      try {
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', htmlLabels: false });
        const nodes = document.querySelectorAll('.mermaid');
        if (nodes.length > 0) {
          await mermaid.run({ nodes: Array.from(nodes) });
        }
      } catch (e) {
        console.warn('Mermaid print error:', e);
      }
    }
    setTimeout(() => {
      window.focus();
      window.print();
    }, 500);
  })();
<\/script>
</body>
</html>`);
    w.document.close();
  }

  /* ---------- PDF ---------- */
  async function exportPDF(content, name) {
    if (typeof html2pdf === 'undefined') {
      console.warn('[Export] html2pdf non disponibile, fallback su stampa nativa');
      printDocument(content, name);
      return;
    }
    const holder = document.createElement('div');
    holder.style.cssText =
      'padding:24px; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; line-height:1.6; color:#222; background:#fff; max-width:820px;';
    holder.innerHTML = typeof MiniPadPreview !== 'undefined'
      ? MiniPadPreview.renderToHTML(content)
      : (content || '');
    document.body.appendChild(holder);

    // Aspetta che Mermaid renderizzi gli SVG
    if (typeof mermaid !== 'undefined') {
      const mermaidNodes = holder.querySelectorAll('.mermaid');
      if (mermaidNodes.length > 0) {
        try {
          await mermaid.run({ nodes: Array.from(mermaidNodes) });
        } catch (e) {
          console.warn('[Export] Mermaid error in PDF:', e);
        }
      }
    }

    try {
      await html2pdf()
        .set({
          margin: [12, 12, 12, 12],
          filename: `${sanitizeFilename(name)}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] }
        })
        .from(holder)
        .save();
    } catch (e) {
      console.error('[Export] PDF fallito, fallback su printDocument', e);
      printDocument(content, name);
    } finally {
      if (holder.parentNode) {
        holder.parentNode.removeChild(holder);
      }
    }
  }

  /* ---------- Plain Text ---------- */
  function exportTxt(content, name) {
    let text = String(content || '');
    const codeBlocks = [];
    const mathBlocks = [];

    // 1. Proteggi code
    text = text.replace(/(^|\n)```[\w-]*[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*```(?=\r?\n|$)/g, (_, lead, code) => {
      codeBlocks.push(code.replace(/\r?\n$/, ''));
      return `${lead}\n\n@@MP_CODE_${codeBlocks.length - 1}@@\n\n`;
    });
    // Fence multipli
    text = text.replace(/(`{2,})([\s\S]*?)\1/g, (match, fence, code) => {
      if (code.length >= 2 && code.startsWith(' ') && code.endsWith(' ') && code.trim()) {
        code = code.slice(1, -1);
      }
      codeBlocks.push(code.replace(/`/g, ''));
      return `@@MP_ICODE_${codeBlocks.length - 1}@@`;
    });

    // Singoli
    text = text.replace(/`([^`\r\n]+)`/g, (_, code) => {
      codeBlocks.push(code);
      return `@@MP_ICODE_${codeBlocks.length - 1}@@`;
    });

    // 2. Proteggi valute prima di math
    text = text.replace(/(^|[^\\])\$(\d)/g, '$1@@MP_CURR_$2');

    // 3. Proteggi math
    text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, m) => {
      mathBlocks.push(m.trim());
      return `\n\n@@MP_MATH_${mathBlocks.length - 1}@@\n\n`;
    });
    text = text.replace(/(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g, (_, m) => {
      mathBlocks.push(m.trim());
      return `@@MP_MATH_${mathBlocks.length - 1}@@`;
    });

    // Ripristina valute ($ è letterale in TXT)
    text = text.replace(/@@MP_CURR_(\d)/g, '$$$1');

    // Rimuovi eventuali dollari escapati (\$) -> $
    text = text.replace(/\\(\$)/g, '$1');

    // 4. Rimuovi markup Markdown base
    text = text
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1$2')
      .replace(/\[(.+?)\]\((.+?)\)/g, '$1 ($2)')
      .replace(/^---+$/gm, '----------------------------------------');

    // 5. Re-inject math (come formule tra $)
    text = text.replace(/@@MP_MATH_(\d+)@@/g, (_, i) => `$${mathBlocks[+i]}$`);

    // 6. Re-inject code come testo puro (con loop di risoluzione per annidamenti)
    // Risolve fino a 5 livelli di placeholder annidati (es. tabelle con frammenti di codice multipli)
    let prevTxt = '';
    let itTxt = 0;
    while (text !== prevTxt && itTxt < 5) {
      prevTxt = text;
      itTxt++;
      text = text.replace(/@@MP_CODE_(\d+)@@/g, (_, i) => `\n${codeBlocks[+i]}\n`);
      text = text.replace(/@@MP_ICODE_(\d+)@@/g, (_, i) => codeBlocks[+i]);
    }

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    download(blob, `${sanitizeFilename(name)}.txt`);
  }

  return {
    exportMarkdown,
    exportHTML,
    exportLaTeX,
    exportPDF,
    exportTxt,
    printDocument,
    markdownToLatex,
    sanitizeFilename
  };
})();
