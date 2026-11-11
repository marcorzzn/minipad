'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { env, pasteEvent, fakeCm, fixture } = require('./helpers/env');

const w = env();
const CI = w.MiniPadChatIndexer;
const SP = w.MiniPadSmartPaste;

const turnsOf = (items) => items.filter(i => i.type === 'turn');
// gli array creati nella finestra jsdom hanno un altro prototipo: confronto per valore
const plain = (x) => JSON.parse(JSON.stringify(x));

/* ---------- HTML delle pagine di chat ---------- */

test('ChatGPT: ruoli dal DOM, formule KaTeX, codice senza "Copia codice", niente barra laterale', () => {
  const chat = CI.chatFromClipboard(fixture('chatgpt-page.html'));
  assert.ok(chat);
  assert.equal(chat.source, 'ChatGPT');
  assert.equal(chat.turns.length, 2);
  assert.equal(chat.turns[0].user, "Come si calcola l'integrale di x^2?");
  const a = chat.turns[0].assistant;
  assert.match(a, /\$\\int x\^2\\,dx = \\frac\{x\^3\}\{3\} \+ C\$/);
  assert.match(a, /```python\nimport sympy as sp[\s\S]*# costa \$0\n```/);
  assert.doesNotMatch(chat.transcript, /Copia codice|Rigenera|Modifica|Cronologia|Ricetta torta|Hai detto|può commettere errori/);
  assert.match(chat.turns[1].assistant, /\$\$\n\\int x\^3\\,dx = \\frac\{x\^4\}\{4\} \+ C\n\$\$/);
});

test('Claude, Gemini e DeepSeek: turni riconosciuti dall\'HTML (ragionamenti esclusi)', () => {
  const claude = CI.chatFromClipboard(fixture('claude-page.html'));
  assert.equal(claude.source, 'Claude');
  assert.equal(claude.turns.length, 2);
  assert.match(claude.turns[0].assistant, /\$V = R I\$/);
  assert.match(claude.turns[0].assistant, /## Esempio/);

  const gem = CI.chatFromClipboard(fixture('gemini-page.html'));
  assert.equal(gem.source, 'Gemini');
  assert.deepEqual(plain(gem.turns.map(t => t.user)), ["Qual è la capitale dell'Australia?", 'E la città più grande?']);
  assert.doesNotMatch(gem.transcript, /Mostra ragionamento|Mostra bozze|Hai detto/);

  const ds = CI.chatFromClipboard(fixture('deepseek-page.html'));
  assert.equal(ds.source, 'DeepSeek');
  assert.equal(ds.turns.length, 2);
  assert.equal(ds.turns[1].user, 'Grazie! E in Python?');
  assert.doesNotMatch(ds.transcript, /Pensiero interno/);
  assert.match(ds.turns[0].assistant, /```javascript\nconst rev/);
});

test('HTML senza conversazione non viene scambiato per una chat', () => {
  assert.equal(CI.chatFromClipboard('<p>Un articolo</p><h2>Sezione</h2><p>Testo</p>'), null);
  assert.equal(CI.chatFromClipboard('<div data-role="user">solo utente</div>'), null);
});

test('incollare la pagina nell\'editor produce una trascrizione indicizzabile', () => {
  const cm = fakeCm();
  const ev = pasteEvent({ 'text/html': fixture('chatgpt-page.html'), 'text/plain': 'testo grezzo' });
  assert.equal(SP.handlePaste(ev, cm), true);
  assert.ok(ev.defaultPrevented);
  const idx = turnsOf(CI.buildIndex(cm.inserted));
  assert.equal(idx.length, 2);
  assert.equal(idx[0].title, "Come si calcola l'integrale di x^2?");
  assert.deepEqual(plain(idx[0].children.map(c => c.title)), plain(['Metodo', 'Verifica in Python']));
});

/* ---------- Testo semplice con etichette ---------- */

test('copia testuale di ChatGPT ("Hai detto:" / "ChatGPT ha detto:")', () => {
  const txt = 'Hai detto:\nCiao, cos\'è un vettore?\nChatGPT ha detto:\nUn vettore è...\n\n## Definizione\nTesto\n\nHai detto:\nE una matrice?\nChatGPT ha detto:\nUna matrice è...';
  const turns = CI.parseChatText(txt);
  assert.equal(turns.length, 2);
  assert.equal(turns[0].user, "Ciao, cos'è un vettore?");
  assert.match(turns[0].assistant, /## Definizione/);
  const idx = turnsOf(CI.buildIndex(txt));
  assert.deepEqual(plain(idx.map(i => i.line)), plain([0, 8]));
  assert.deepEqual(plain(idx[0].children.map(c => c.title)), plain(['Definizione']));
});

test('etichette inline e in inglese (**User:** / **Assistant:**, You said / ChatGPT said)', () => {
  assert.equal(CI.parseChatText('**User:** ciao\n**Assistant:** salve\n**User:** come va?\n**Assistant:** bene').length, 2);
  assert.equal(CI.parseChatText('You said:\nhi\nChatGPT said:\nhello').length, 1);
  assert.equal(CI.parseChatText('### Human\nciao\n### Claude\nciao a te').length, 1);
});

test('nessun falso positivo su frasi normali ("A volte", "Tu sei", "Claude Monet")', () => {
  const txt = 'A volte succede.\nTu sei bravo.\nClaude Monet era un pittore.\nQ è una lettera.\nUtente registrato ieri.';
  assert.equal(CI.parseChatText(txt).length, 0);
  // Q:/A: solo con almeno due scambi
  assert.equal(CI.parseChatText('Q: uno\nA: due').length, 0);
  assert.equal(CI.parseChatText('Q: uno\nA: due\nQ: tre\nA: quattro').length, 2);
});

test('etichette dentro un blocco di codice vengono ignorate', () => {
  const txt = 'Hai detto:\nscrivi un esempio\nChatGPT ha detto:\n```\nUser: ciao\nAssistant: salve\nHai detto:\n```\nfine';
  const turns = CI.parseChatText(txt);
  assert.equal(turns.length, 1);
  assert.match(turns[0].assistant, /User: ciao/);
});

test('le etichette affidabili hanno la precedenza (una risposta con "Domanda:" non spezza il turno)', () => {
  const txt = 'Hai detto:\nfammi un quiz\nChatGPT ha detto:\nDomanda: 2+2?\nRisposta: 4\nDomanda: 3+3?\nRisposta: 6\nHai detto:\ngrazie\nChatGPT ha detto:\nprego';
  assert.equal(CI.parseChatText(txt).length, 2);
});

/* ---------- Formattazione e indice ---------- */

test('formattazione: un titolo per turno, titoli della risposta abbassati, righe esatte', () => {
  const chat = CI.chatFromClipboard(fixture('chatgpt-page.html'));
  const md = CI.formatTurns(chat.turns, chat.source);
  const lines = md.split('\n');
  const idx = turnsOf(CI.buildIndex(md));
  assert.equal(idx.length, 2);
  idx.forEach(it => assert.match(lines[it.line], /^## 💬 Turno \d+ — /));
  assert.equal(idx[0].title, "Come si calcola l'integrale di x^2?");
  assert.ok(lines.includes('### Metodo'));
  assert.ok(lines.includes('> E se fosse x^3?'));
  idx[0].children.forEach(c => assert.equal(lines[c.line], '### ' + c.title));
  // ri-analizzare una nota già formattata restituisce gli stessi turni
  const again = CI.parseChatText(md);
  assert.equal(again.length, 2);
  assert.equal(again[1].user, 'E se fosse x^3?');
});

test('i titoli dentro i blocchi di codice non vengono spostati né indicizzati', () => {
  const md = CI.shiftHeadings('# Titolo\n```md\n# non toccare\n```', 3);
  assert.equal(md, '### Titolo\n```md\n# non toccare\n```');
  const items = CI.buildIndex('# A\n```\n# B\n```\n## C');
  assert.deepEqual(plain(items.map(i => i.title)), plain(['A', 'C']));
});

test('note indicizzate con la v1.5.8 vengono ancora riconosciute', () => {
  const old = '> 💬 **Utente (Turno 1):**\n> Prima domanda\n\nRisposta uno\n\n---\n\n> 💬 **Utente (Turno 2):**\n> Seconda domanda\n\nRisposta due\n\n---\n';
  const idx = turnsOf(CI.buildIndex(old));
  assert.deepEqual(plain(idx.map(i => i.title)), plain(['Prima domanda', 'Seconda domanda']));
  const turns = CI.parseChatText(old);
  assert.equal(turns[0].user, 'Prima domanda');
  assert.equal(turns[0].assistant, 'Risposta uno');
});

test('ricerca: il testo di ogni turno è indicizzato senza accenti', () => {
  const idx = turnsOf(CI.buildIndex('Hai detto:\nperché?\nChatGPT ha detto:\nLa città è bella\nHai detto:\naltro\nChatGPT ha detto:\nniente'));
  assert.ok(idx[0].search.includes('citta'));
  assert.ok(!idx[1].search.includes('citta'));
});

test('documento senza turni: indice dei titoli; senza titoli: punti d\'accesso per paragrafo', () => {
  assert.deepEqual(plain(CI.buildIndex('# Uno\ntesto\n## Due').map(i => i.title)), plain(['Uno', 'Due']));
  const free = CI.buildIndex('Primo paragrafo lungo\n\nSecondo paragrafo lungo');
  assert.equal(free.length, 2);
});

test('trascrizione e incolla diretto danno lo stesso Markdown dei messaggi', () => {
  const html = fixture('claude-page.html');
  const chat = CI.chatFromClipboard(html);
  const again = CI.parseChatText(chat.transcript);
  assert.deepEqual(plain(again.map(t => [t.user, t.assistant])), plain(chat.turns.map(t => [t.user, t.assistant])));
});
