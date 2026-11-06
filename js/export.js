/**
 * MiniPad Export v1.5.3.1
 * Bug fix v1.5.3.1:
 *   C1: placeholder nonce-based (MP-{id}-*)
 *   C2: escape LaTeX non distrugge placeholder (_ non presente nel formato)
 *   C3: math regex (?<![\\$]) esclude \$ escapati
 *   C4: estrazione valute dedicata DOPO code, PRIMA di math
 *   C5: doppi backtick (multi PRIMA di singoli)
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
    return String(s).replace(/[\\&%$#_{}~^]/g, (c) => LATEX_ESCAPE[c]);
  }

  function escapeHtml(s) {
    return String(s)
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
      return `\n\nMP-${rid}-CODE-${codeBlocks.length - 1}\n\n`;
    });

    // 2. Inline code con fence multipli (PRIMA dei singoli)
    md = md.replace(/(`{2,})((?:[^`]|`(?![`]))*?)\1/g, (_, fence, code) => {
      if (code.length >= 2 && code.startsWith(' ') && code.endsWith(' ') && code.trim()) {
        code = code.slice(1, -1);
      }
      codeBlocks.push({ lang: '', code, inline: true });
      return `MP-${rid}-ICODE-${codeBlocks.length - 1}`;
    });

    // 3. Inline code con fence singoli
    md = md.replace(/`([^`\n]+)`/g, (_, code) => {
      codeBlocks.push({ lang: '', code, inline: true });
      return `MP-${rid}-ICODE-${codeBlocks.length - 1}`;
    });

    // 4. Valute escape \$N (DOPO code, PRIMA math)
    md = md.replace(/\\\$(\d[\d.,]*)/g, (_, amount) => {
      currencies.push(amount);
      return `MP-${rid}-CUR-${currencies.length - 1}`;
    });

    // 5. Math block $$...$$
    md = md.replace(/\$\$([\s\S]*?)\$\$/g, (_, m) => {
      maths.push({ block: true, tex: m.trim() });
      return `\n\nMP-${rid}-MATH-${maths.length - 1}\n\n`;
    });

    // 6. Math inline $...$ (escluso \$ escapato)
    md = md.replace(/(?<![\\$])\$(?!\$)([^$\n]+?)\$(?!\$)/g, (_, m) => {
      maths.push({ block: false, tex: m.trim() });
      return `MP-${rid}-MATH-${maths.length - 1}`;
    });

    return { md, codeBlocks, maths, currencies, rid };
  }

  /* ============================================================
     Helper LaTeX (Emoji & Liste annidate)
     ============================================================ */
  function stripEmoji(s) {
    return String(s).replace(
      /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu,
      ''
    ).replace(/\s+/g, ' ').trim();
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
      if (item.level > currentLevel) {
        for (let l = currentLevel + 1; l <= item.level; l++) {
          result += `\\begin{${env}}\n`;
          stack.push(l);
        }
      } else if (item.level < currentLevel) {
        for (let l = currentLevel; l > item.level; l--) {
          result += `\\end{${env}}\n`;
          stack.pop();
        }
      }
      result += `\\item ${item.text}\n`;
      currentLevel = item.level;
    }
    while (stack.length > 0) {
      result += `\\end{${env}}\n`;
      stack.pop();
    }
    return '\n' + result + '\n';
  }

  /* ============================================================
     Markdown → LaTeX
     ============================================================ */
  function markdownToLatex(md) {
    const rid = generateRenderId();
    const { md: prot, codeBlocks, maths, currencies } = extractProtected(md, rid);
    const tables = [];

    // Tabelle Markdown → tabular (salvate in array e isolate tramite segnaposto)
    let body = prot.replace(/(?:^|\n)((?:\|.+\|\n?)+)/g, (block) => {
      const lines = block.trim().split('\n').filter((r) => r.trim());
      if (lines.length < 2) return block;
      const parseRow = (r) =>
        r.split('|').slice(1, -1).map((c) => c.trim());
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
      tex += header.map((c) => escapeLatexText(c)).join(' & ') + ' \\\\\n\\hline\n';
      for (const row of bodyRows) {
        tex += row.map((c) => escapeLatexText(c)).join(' & ') + ' \\\\\n';
      }
      tex += '\\hline\n\\end{tabular}\n\\end{center}\n';
      tables.push(tex);
      return `\n\nMP-${rid}-TAB-${tables.length - 1}\n\n`;
    });

    // Trasformazioni strutturali con emoji stripping (M5)
    body = body
      .replace(/^###### (.+)$/gm, (_, t) => `\\paragraph{${stripEmoji(t)}}`)
      .replace(/^##### (.+)$/gm, (_, t) => `\\subparagraph{${stripEmoji(t)}}`)
      .replace(/^#### (.+)$/gm, (_, t) => `\\subsubsection{${stripEmoji(t)}}`)
      .replace(/^### (.+)$/gm, (_, t) => `\\subsection{${stripEmoji(t)}}`)
      .replace(/^## (.+)$/gm, (_, t) => `\\section{${stripEmoji(t)}}`)
      .replace(/^# (.+)$/gm, (_, t) => `\\section*{${stripEmoji(t)}}`)
      .replace(/^---+$/gm, '\\bigskip\\hrule\\bigskip');

    // M1: Blockquote (semplice, un livello)
    body = body.replace(
      /(?:^|\n)((?:> .+\n?)+)/g,
      (block) => {
        const inner = block.trim().split('\n').map((l) => l.replace(/^> ?/, '')).join('\n');
        return `\n\\begin{quote}\n${inner}\n\\end{quote}\n`;
      }
    );

    // M2+M3: Task list e Liste con supporto annidamento
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

    // Liste non ordinate con supporto annidamento (indent-based)
    body = body.replace(
      /(?:^|\n)((?:[ \t]*[-*] .+\n?)+)/g,
      (block) => convertNestedList(block.trim().split('\n'), false)
    );

    // Liste ordinate con supporto annidamento
    body = body.replace(
      /(?:^|\n)((?:[ \t]*\d+\. .+\n?)+)/g,
      (block) => convertNestedList(block.trim().split('\n'), true)
    );

    // M4: Strikethrough (richiede \usepackage{ulem})
    body = body.replace(/~~(.+?)~~/g, '\\sout{$1}');

    // Grassetto / corsivo / link
    body = body
      .replace(/\*\*(.+?)\*\*/g, '\\textbf{$1}')
      .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1\\textit{$2}')
      .replace(/\[(.+?)\]\((.+?)\)/g, (_, text, url) => {
        // Rimuove eventuale title "..." dall'URL
        const cleanUrl = url.replace(/\s+"[^"]*"$/, '').trim();
        return `\\href{${cleanUrl}}{${text}}`;
      });

    // Escape del testo libero (SOLO fuori da placeholder, preservando i comandi LaTeX)
    const placeholderRe = new RegExp(
      `MP-${rid}-(CODE|ICODE|MATH|CUR|TAB)-(\\d+)`,
      'g'
    );
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
        escaped += `MP-${rid}-${parts[i]}-${parts[i + 1]}`;
        i += 1; // salta l'index, già usato
      }
    }

    // Re-inject tabelle PRIMA di valute/math/code per risolverne i placeholder interni
    escaped = escaped.replace(
      new RegExp(`MP-${rid}-TAB-(\\d+)`, 'g'),
      (_, i) => tables[+i]
    );

    // Re-inject: currency, math, code
    escaped = escaped.replace(
      new RegExp(`MP-${rid}-CUR-(\\d+)`, 'g'),
      (_, i) => `\\$${currencies[+i]}`
    );

    escaped = escaped.replace(
      new RegExp(`MP-${rid}-MATH-(\\d+)`, 'g'),
      (_, i) => {
        const m = maths[+i];
        return m.block ? `\n\\[\n${m.tex}\n\\]\n` : `\\(${m.tex}\\)`;
      }
    );

    escaped = escaped.replace(
      new RegExp(`MP-${rid}-CODE-(\\d+)`, 'g'),
      (_, i) => {
        const b = codeBlocks[+i];
        return `\n\\begin{verbatim}\n${b.code}\n\\end{verbatim}\n`;
      }
    );

    escaped = escaped.replace(
      new RegExp(`MP-${rid}-ICODE-(\\d+)`, 'g'),
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
<!-- Nota: questo file richiede internet al primo caricamento per i font KaTeX e il runtime Mermaid.
     Per un documento 100% autonomo offline senza dipendenze CDN, usa "Stampa…" -> "Salva come PDF". -->
<title>${title}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"><\/script>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         max-width: 820px; margin: 2em auto; padding: 0 1.2em; line-height: 1.65; color: #222; }
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
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict',
          htmlLabels: false, theme: 'default' });
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

    // Code PRIMA di tutto
    text = text.replace(/```([\w-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      codeBlocks.push({ code: code.replace(/\n$/, ''), inline: false });
      return `\n\nMP-${rid}-CODE-${codeBlocks.length - 1}\n\n`;
    });
    text = text.replace(/(`{2,})((?:[^`]|`(?![`]))*?)\1/g, (_, fence, code) => {
      if (code.length >= 2 && code.startsWith(' ') && code.endsWith(' ') && code.trim()) {
        code = code.slice(1, -1);
      }
      codeBlocks.push({ code: code.replace(/`/g, ''), inline: true });
      return `MP-${rid}-ICODE-${codeBlocks.length - 1}`;
    });
    text = text.replace(/`([^`\n]+)`/g, (_, code) => {
      codeBlocks.push({ code, inline: true });
      return `MP-${rid}-ICODE-${codeBlocks.length - 1}`;
    });

    // Valute escape
    text = text.replace(/\\\$(\d[\d.,]*)/g, (_, amt) => {
      currencies.push(amt);
      return `MP-${rid}-CUR-${currencies.length - 1}`;
    });

    // Math (block preserva $$, inline preserva $)
    text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, m) => {
      maths.push({ block: true, tex: m.trim() });
      return `MP-${rid}-MATH-${maths.length - 1}`;
    });
    text = text.replace(/(?<![\\$])\$(?!\$)([^$\n]+?)\$(?!\$)/g, (_, m) => {
      maths.push({ block: false, tex: m.trim() });
      return `MP-${rid}-MATH-${maths.length - 1}`;
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
      .replace(/^[-*]\s+/gm, '• ')
      .replace(/^\d+\.\s+/gm, '');

    // Restore
    text = text.replace(
      new RegExp(`MP-${rid}-CUR-(\\d+)`, 'g'),
      (_, i) => `$${currencies[+i]}`
    );
    text = text.replace(
      new RegExp(`MP-${rid}-MATH-(\\d+)`, 'g'),
      (_, i) => {
        const m = maths[+i];
        return m.block ? `$$${m.tex}$$` : `$${m.tex}$`;
      }
    );
    text = text.replace(
      new RegExp(`MP-${rid}-CODE-(\\d+)`, 'g'),
      (_, i) => `\n${codeBlocks[+i].code}\n`
    );
    text = text.replace(
      new RegExp(`MP-${rid}-ICODE-(\\d+)`, 'g'),
      (_, i) => codeBlocks[+i].code
    );

    // M8: un-escape completo di \$ residui (oltre a \$N già gestiti)
    text = text.replace(/\\\$/g, '$');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    download(blob, `${sanitizeFilename(name)}.txt`);
  }

  /* ============================================================
     Export PDF via html2pdf
     ============================================================ */
  async function exportPDF(content, name) {
    if (typeof html2pdf === 'undefined') {
      alert('Export PDF non disponibile: libreria html2pdf non caricata.');
      return;
    }
    const holder = document.createElement('div');
    holder.style.cssText =
      'padding:24px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
      'line-height:1.6;color:#222;background:#fff;max-width:820px;';
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
        margin: [12, 12, 12, 12],
        filename: `${sanitizeFilename(name)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] }
      }).from(holder).save();
    } catch (e) {
      console.error('[Export] PDF fallito', e);
      alert("Errore durante l'esportazione PDF: " + e.message);
    } finally {
      document.body.removeChild(holder);
    }
  }

  /* ============================================================
     Stampa (window.print — qualità tipografica nativa)
     ============================================================ */
  function printDocument(content, name) {
    const body = MiniPadPreview.renderToHTML(content);
    const w = window.open('', '_blank');
    if (!w) {
      alert('Blocca-popup attivo: consenti i popup per stampare.');
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
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         max-width: 820px; margin: 1.5em auto; padding: 0 1em; line-height: 1.6; color: #222; }
  pre { background: #f4f4f4; padding: 1em; border-radius: 6px; overflow-x: auto; }
  code { background: #f4f4f4; padding: .15em .35em; border-radius: 3px;
         font-family: Consolas, monospace; }
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
<body>${body}</body>
</html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 900);
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