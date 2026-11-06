/**
 * MiniPad Export
 * Standard di settore: .md, .html (standalone), .tex (con escape corretto), .pdf, .txt
 */
window.MiniPadExport = (function () {
  const LATEX_ESCAPE = {
    '\\': '\\textbackslash{}',
    '&': '\\&',
    '%': '\\%',
    '$': '\\$',
    '#': '\\#',
    '_': '\\_',
    '{': '\\{',
    '}': '\\}',
    '~': '\\textasciitilde{}',
    '^': '\\textasciicircum{}'
  };

  function escapeLatexText(s) {
    return String(s || '').replace(/[\\&%$#_{}~^]/g, (c) => LATEX_ESCAPE[c] || c);
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
</style>
</head>
<body>
${body}
<script>
  if (typeof mermaid !== 'undefined') {
    mermaid.initialize({ startOnLoad: true, securityLevel: 'loose' });
  }
<\/script>
</body>
</html>`;
    const blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
    download(blob, `${sanitizeFilename(name)}.html`);
  }

  /* ---------- LaTeX ---------- */
  /**
   * Conversione Markdown → LaTeX robusta:
   *  1. Estrae math ($ $ e $$ $$) in placeholder per proteggere i comandi LaTeX
   *  2. Estrae blocchi di codice e inline code in placeholder
   *  3. Converte struttura Markdown (titoli, bold, italic, liste, link)
   *  4. Esegue l'escape di tutti i caratteri riservati residui nel testo
   *  5. Re-inietta math e code verbatim
   */
  function markdownToLatex(md) {
    const maths = [];
    const codes = [];

    let text = String(md || '');

    // 1. Math blocks $$ ... $$
    text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, m) => {
      maths.push({ block: true, tex: m.trim() });
      return `\u0000M${maths.length - 1}\u0000`;
    });

    // 1b. Math inline $ ... $ (con lookaround per non prendere $$)
    text = text.replace(/(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g, (_, m) => {
      maths.push({ block: false, tex: m.trim() });
      return `\u0000M${maths.length - 1}\u0000`;
    });

    // 2. Fenced code blocks ``` ... ```
    text = text.replace(/```\w*\r?\n([\s\S]*?)```/g, (_, code) => {
      codes.push(code);
      return `\u0000C${codes.length - 1}\u0000`;
    });

    // 2b. Inline code ` ... `
    text = text.replace(/`([^`\n]+)`/g, (_, code) => {
      codes.push(code);
      return `\u0000C${codes.length - 1}\u0000`;
    });

    // 3. Escape caratteri riservati LaTeX nel testo (esclusi quelli della sintassi Markdown)
    const parts = text.split(/(\u0000[MC]\d+\u0000)/);
    text = parts
      .map((part) => {
        if (/^\u0000[MC]\d+\u0000$/.test(part)) return part;
        // Escape di %, _, &, ~, ^
        return part
          .replace(/%/g, '\\%')
          .replace(/&/g, '\\&')
          .replace(/_/g, '\\_')
          .replace(/~/g, '\\textasciitilde{}')
          .replace(/\^/g, '\\textasciicircum{}');
      })
      .join('');

    // 4. Struttura titoli e formattazione Markdown
    text = text
      .replace(/^###### (.+)$/gm, '\\paragraph{$1}')
      .replace(/^##### (.+)$/gm, '\\subparagraph{$1}')
      .replace(/^#### (.+)$/gm, '\\subsubsection{$1}')
      .replace(/^### (.+)$/gm, '\\subsection{$1}')
      .replace(/^## (.+)$/gm, '\\section{$1}')
      .replace(/^# (.+)$/gm, '\\section*{$1}')
      .replace(/^---+$/gm, '\\bigskip\\hrule\\bigskip')
      .replace(/\*\*(.+?)\*\*/g, '\\textbf{$1}')
      .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1\\textit{$2}')
      .replace(/\[(.+?)\]\((.+?)\)/g, '\\href{$2}{$1}');

    // Liste puntate e numerate
    text = text.replace(/(?:^|\n)((?:[-*] .+\r?\n?)+)/g, (block) => {
      const items = block.trim().split(/\r?\n/).map((l) => `\\item ${l.replace(/^[-*] /, '')}`).join('\n');
      return `\n\\begin{itemize}\n${items}\n\\end{itemize}\n`;
    });
    text = text.replace(/(?:^|\n)((?:\d+\. .+\r?\n?)+)/g, (block) => {
      const items = block.trim().split(/\r?\n/).map((l) => `\\item ${l.replace(/^\d+\. /, '')}`).join('\n');
      return `\n\\begin{enumerate}\n${items}\n\\end{enumerate}\n`;
    });

    // 5. Re-iniezione di formule matematiche e codice con replacer function per evitare collisioni con '$'
    text = text.replace(/\u0000M(\d+)\u0000/g, (_, i) => {
      const m = maths[+i];
      if (!m) return '';
      return m.block ? `\n\\[\n${m.tex}\n\\]\n` : `\\(${m.tex}\\)`;
    });

    text = text.replace(/\u0000C(\d+)\u0000/g, (_, i) => {
      const code = codes[+i] || '';
      return `\n\\begin{verbatim}\n${code}\n\\end{verbatim}\n`;
    });

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

  /* ---------- PDF ---------- */
  async function exportPDF(content, name) {
    if (typeof html2pdf === 'undefined') {
      console.warn('[Export] html2pdf non disponibile, fallback su window.print()');
      window.print();
      return;
    }
    const holder = document.createElement('div');
    holder.style.cssText =
      'padding:24px; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; line-height:1.6; color:#222; background:#fff; max-width:820px;';
    holder.innerHTML = typeof MiniPadPreview !== 'undefined'
      ? MiniPadPreview.renderToHTML(content)
      : (content || '');
    document.body.appendChild(holder);

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
      console.error('[Export] PDF fallito, fallback su window.print()', e);
      window.print();
    } finally {
      if (holder.parentNode) {
        holder.parentNode.removeChild(holder);
      }
    }
  }

  /* ---------- Plain Text ---------- */
  function exportTxt(content, name) {
    const text = String(content || '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/[#*_>`]/g, '')
      .replace(/\$\$[\s\S]*?\$\$/g, '')
      .replace(/\$([^$\n]+?)\$/g, '$1');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    download(blob, `${sanitizeFilename(name)}.txt`);
  }

  return {
    exportMarkdown,
    exportHTML,
    exportLaTeX,
    exportPDF,
    exportTxt,
    markdownToLatex,
    sanitizeFilename
  };
})();
