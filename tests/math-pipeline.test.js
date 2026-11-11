'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { env, pasteEvent, fakeCm } = require('./helpers/env');

const w = env();
const SP = w.MiniPadSmartPaste;
const render = (md) => w.MiniPadPreview.renderToHTML(md);
const BS = '\\';

/* ---------- Bug storici (giudizio v1.5.8.1) ---------- */

test('render: gli escape voluti dall\'utente restano escape', () => {
  const src = 'Prezzo ' + BS + '*scontato' + BS + '* oggi';
  assert.equal(SP.normalizeForRender(src), src);
  const html = render(src);
  assert.match(html, /\*scontato\*/);
  assert.doesNotMatch(html, /<em>/);
});

test('\\[1\\] e \\[a, b\\] non diventano formule (né al render né all\'incolla)', () => {
  for (const s of ['Vedi nota \\[1\\] in fondo', 'Array \\[a, b\\] qui']) {
    assert.equal(SP.normalizeForRender(s), s);
    assert.equal(SP.normalizePasted(s), s);
    assert.doesNotMatch(render(s), /katex/);
  }
});

test('valute: "$5 e poi $10" non perde spazi e non diventa formula', () => {
  const out = SP.normalizePasted('Costa $5 e poi $10');
  assert.equal(out, 'Costa \\$5 e poi \\$10');
  const html = render('Costa $5 e poi $10');
  assert.match(html, /Costa \$5 e poi \$10/);
  assert.doesNotMatch(html, /katex/);
});

test('formula che inizia con una cifra resta formula ($5x + 3$)', () => {
  assert.equal(SP.normalizePasted('- $5x + 3$ ok'), '- $5x + 3$ ok');
  assert.match(render('- $5x + 3$ ok'), /katex/);
});

test('fence annidati (4 backtick) non lasciano placeholder nel testo', () => {
  const src = '````md\n```js\nx = "$a + $b"\n```\n````';
  assert.equal(SP.normalizePasted(src), src);
  assert.equal(SP.normalizeForRender(src), src);
  const html = render(src);
  assert.doesNotMatch(html, /[\u0000\uE000\uE001]/);
  assert.match(html, /x = (?:&quot;|")\$a \+ \$b/);
});

/* ---------- Protezione del codice ---------- */

test('codice bash/python con $ non viene toccato (fenced, ~~~, indentato in lista, inline)', () => {
  const cases = [
    '```bash\necho $HOME e $(( $A * $B )) \\[x\\]\n```',
    '~~~python\nprint(f"{a}$ e \\(b\\)")\n~~~',
    '- passo\n  ```bash\n  echo $HOME and $PATH\n  ```',
    'usa `$PATH` e ``a ` $b$ ``',
    '```\nnon chiuso $x$ \\[y\\]'
  ];
  for (const c of cases) {
    assert.equal(SP.normalizePasted(c), c, c);
    assert.equal(SP.normalizeForRender(c), c, c);
  }
});

test('\\pagebreak dentro un blocco di codice LaTeX resta codice', () => {
  const html = render('```latex\n\\pagebreak\n```\n\n\\pagebreak');
  assert.equal((html.match(/page-break/g) || []).length, 1);
  assert.match(html, /<code[^>]*>\\pagebreak/);
});

test('mermaid continua a essere renderizzato come diagramma', () => {
  const html = render('```mermaid\ngraph TD\n A-->B\n```');
  assert.match(html, /<pre class="mermaid">graph TD/);
});

/* ---------- Delimitatori LLM ---------- */

test('\\[ ... \\] su righe proprie diventa blocco matematico anche dopo un paragrafo', () => {
  const src = 'La formula è:\n\\[\nE = mc^2\n\\]\nfine.';
  const html = render(src);
  assert.match(html, /katex-display/);
  assert.match(html, /fine\./);
});

test('\\[ \\] dentro una lista e dentro una citazione', () => {
  const list = render('1. Primo\n   \\[\n   x^2 + y^2\n   \\]\n2. Secondo');
  assert.match(list, /<li>[\s\S]*katex-display[\s\S]*<\/li>[\s\S]*Secondo/);
  const quote = render('> Citazione\n> \\[\n> a+b\n> \\]');
  assert.match(quote, /<blockquote>[\s\S]*katex-display/);
});

test('\\( ... \\) e doppio backslash ChatGPT', () => {
  assert.equal(SP.normalizePasted('dove \\(x^2\\) cresce'), 'dove $x^2$ cresce');
  assert.equal(SP.normalizePasted('\\\\(\\\\frac{a}{b}\\\\)'), '$\\frac{a}{b}$');
  // "$$...$$" da solo su una riga diventa un blocco display (comportamento storico)
  assert.equal(SP.normalizePasted('$$\\\\alpha + \\\\beta$$'), '$$\n\\alpha + \\beta\n$$');
  assert.equal(SP.normalizePasted('a $$\\\\alpha$$ b'), 'a $$\\alpha$$ b');
});

test('le righe di una matrice (\\\\) non vengono rovinate', () => {
  const src = '$$\n\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}\n$$';
  assert.equal(SP.normalizePasted(src), src);
  assert.equal(SP.normalizeForRender(src), src);
});

test('\\text{nome\\_var} resta valido', () => {
  const src = '$\\text{my\\_var} + x\\_1$';
  assert.equal(SP.normalizePasted(src), '$\\text{my\\_var} + x_1$');
  assert.equal(SP.normalizeForRender(src), src);
});

test('formula che inizia con \\{ non perde il backslash', () => {
  assert.equal(SP.normalizePasted('$\\{1, 2\\}$'), '$\\{1, 2\\}$');
});

test('checkbox e link escapati non diventano formule', () => {
  assert.equal(SP.normalizePasted('- \\[x\\] fatto'), '- [x] fatto');
  assert.equal(SP.normalizeForRender('\\[testo\\](https://a.b)'), '\\[testo\\](https://a.b)');
});

/* ---------- Markdown sovra-escapato ---------- */

test('markdown sovra-escapato viene riparato all\'incolla, ma non dentro il codice', () => {
  const src = '\\# Titolo\n\n\\- uno\n\\- due\n\n```\n\\*resta\\*\n```';
  assert.equal(SP.normalizePasted(src), '# Titolo\n\n- uno\n- due\n\n```\n\\*resta\\*\n```');
});

test('al render un singolo escape non attiva la riparazione', () => {
  const src = '\\# non è un titolo';
  assert.equal(SP.normalizeForRender(src), src);
});

/* ---------- Idempotenza e coerenza ---------- */

test('render(incolla(x)) == incolla(x): l\'anteprima non riscrive ciò che è già stato normalizzato', () => {
  const samples = [
    'La formula \\[\\frac{1}{2}\\] e \\(a_i\\) costano $5.',
    '### Titolo\n\n\\[\n\\sum_{i=1}^n i = \\frac{n(n+1)}{2}\n\\]\n',
    '> Nota: $x$ e $$y$$',
    'Prezzo $19,99 e formula $a^2$'
  ];
  for (const s of samples) {
    const p = SP.normalizePasted(s);
    assert.equal(SP.normalizePasted(p), p, 'incolla idempotente: ' + s);
    assert.equal(SP.normalizeForRender(p), p, 'render stabile: ' + s);
  }
});

test('stesso contenuto da HTML KaTeX, da Markdown "Copia" e da Wikipedia → stesso Markdown', () => {
  const katexInline = '<p>Energia <span class="katex"><span class="katex-mathml"><math><semantics><mrow><mi>E</mi></mrow><annotation encoding="application/x-tex">E = mc^2</annotation></semantics></math></span><span class="katex-html" aria-hidden="true">E=mc2</span></span> nota</p>';
  const wiki = '<p>Energia <span class="mwe-math-element"><span class="mwe-math-mathml-inline mwe-math-mathml-a11y" style="display: none;"><math alttext="{\\displaystyle E = mc^2}"><semantics><mrow></mrow><annotation encoding="application/x-tex">{\\displaystyle E = mc^2}</annotation></semantics></math></span><img src="x.svg" class="mwe-math-fallback-image-inline" alt="{\\displaystyle E = mc^2}"></span> nota</p>';
  const plain = 'Energia \\(E = mc^2\\) nota';

  const fromHtml = SP.clipboardToMarkdown(katexInline, 'Energia E=mc2 nota').markdown.trim();
  const fromWiki = SP.clipboardToMarkdown(wiki, 'Energia E=mc2{\\displaystyle E=mc^2} nota').markdown.trim();
  const fromPlain = SP.clipboardToMarkdown('', plain).markdown.trim();
  assert.equal(fromHtml, 'Energia $E = mc^2$ nota');
  assert.equal(fromWiki, fromHtml);
  assert.equal(fromPlain, fromHtml);
});

test('blocco display KaTeX da HTML → $$ su righe proprie', () => {
  const html = '<p>Vale:</p><span class="katex-display"><span class="katex"><span class="katex-mathml"><math display="block"><semantics><annotation encoding="application/x-tex">\\int_0^1 x\\,dx</annotation></semantics></math></span></span></span><p>Fine</p>';
  const md = SP.clipboardToMarkdown(html, '').markdown.trim();
  assert.equal(md, 'Vale:\n\n$$\n\\int_0^1 x\\,dx\n$$\n\nFine');
});

test('il pulsante "Copia" degli LLM (Markdown + HTML) usa il Markdown sorgente', () => {
  const plain = '## Titolo\n\n- **uno**\n- due\n\n```python\nprint(1)\n```';
  const html = '<h2>Titolo</h2><ul><li><strong>uno</strong></li><li>due</li></ul><pre><code class="language-python">print(1)</code></pre>';
  assert.equal(SP.clipboardToMarkdown(html, plain).markdown, plain);
});

test('pulsante "Copia" con formule: il sorgente LaTeX vince sull\'HTML renderizzato', () => {
  const plain = 'La formula è:\n\\[\n\\int_0^1 x^2\\,dx = \\frac{1}{3}\n\\]\ne vale \\(x>0\\).';
  const html = '<p>La formula è:</p><span class="katex-display"><span class="katex">resa grafica</span></span><p>e vale x&gt;0.</p>';
  const md = SP.clipboardToMarkdown(html, plain).markdown;
  assert.equal(md, 'La formula è:\n\n$$\n\\int_0^1 x^2\\,dx = \\frac{1}{3}\n$$\n\ne vale $x>0$.');
});

test('selezione dalla pagina con codice Python ("# commento", x**2): si usa l\'HTML', () => {
  const plain = 'Ecco:\npython\nCopia codice\n# calcolo\ny = x**2\n';
  const html = '<p>Ecco:</p><pre><div>python</div><button>Copia codice</button><code class="language-python"># calcolo\ny = x**2\n</code></pre>';
  assert.equal(SP.clipboardToMarkdown(html, plain).markdown.trim(), 'Ecco:\n\n```python\n# calcolo\ny = x**2\n```');
});

test('blocchi di codice copiati dalla pagina di ChatGPT/Claude: niente "Copia codice"', () => {
  const html = '<div><p>Esempio:</p><pre class="overflow-visible!"><div class="contain-inline-size"><div class="flex items-center">python</div><div class="sticky"><button>Copia codice</button></div><div class="overflow-y-auto p-4"><code class="whitespace-pre! language-python">def f(x):\n    return x * 2\n</code></div></div></pre></div>';
  const md = SP.clipboardToMarkdown(html, 'Esempio:\npython\nCopia codice\ndef f(x):\n    return x * 2').markdown.trim();
  assert.equal(md, 'Esempio:\n\n```python\ndef f(x):\n    return x * 2\n```');
});

test('HTML da editor di codice (VS Code) → incolla nativo del testo', () => {
  const html = '<div style="color: #ccc;background-color: #1f1f1f;font-family: Consolas;white-space: pre;"><div><span>const</span> a = 1;</div></div>';
  const ev = pasteEvent({ 'text/html': html, 'text/plain': 'const a = 1;' });
  const cm = fakeCm();
  assert.equal(SP.handlePaste(ev, cm), false);
  assert.equal(cm.inserted, null);
});

test('export .md/.tex usano la stessa normalizzazione dell\'anteprima', () => {
  const md = 'Nota \\[1\\] e ````md\n```\n$x$\n```\n````';
  assert.equal(SP.normalizeForRender(md), md);
});

/* ---------- Export LaTeX ---------- */

function captureDownload(fn) {
  const blobs = [];
  const origCreate = w.URL.createObjectURL;
  const origRevoke = w.URL.revokeObjectURL;
  const origClick = w.HTMLAnchorElement.prototype.click;
  w.URL.createObjectURL = (b) => { blobs.push(b); return 'blob:test'; };
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () {};
  try { fn(); } finally {
    w.URL.createObjectURL = origCreate;
    w.URL.revokeObjectURL = origRevoke;
    w.HTMLAnchorElement.prototype.click = origClick;
  }
  return blobs[0].text();
}

test('export .tex: i blocchi di codice mantengono gli a-capo', async () => {
  const tex = await captureDownload(() => w.MiniPadExport.exportLaTeX('Uno.\n\n```html\n<div>x</div>\ny = 2\n```\n\nDue 😀.', 't'));
  assert.ok(tex.includes('\\begin{verbatim}\n<div>x</div>\ny = 2\n\\end{verbatim}'), tex);
  assert.doesNotMatch(tex, /😀/);
});

test('export .tex: escape Markdown diventano caratteri letterali, valute e formule corrette', () => {
  const out = w.MiniPadExport.markdownToLatex('Nota \\[1\\] e \\*stella\\*. Prezzo $5 e poi $10, formula $5x+3$.');
  assert.ok(out.includes('Nota {[}1{]} e {\\textasteriskcentered}stella{\\textasteriskcentered}.'), out);
  assert.ok(out.includes('Prezzo \\$5 e poi \\$10, formula \\(5x+3\\).'), out);
});
