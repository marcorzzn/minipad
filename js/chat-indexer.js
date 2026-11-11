/**
 * MiniPad Chat Indexer v1.5.9
 *
 * Obiettivo: incollare in MiniPad un'intera conversazione con un LLM (copiata "grezza" dalla
 * pagina con Ctrl+A / Ctrl+C, oppure trascritta) e ritrovare subito ogni domanda e ogni sezione
 * della risposta, senza dover rileggere tutta la chat.
 *
 * Fonti riconosciute:
 *   - HTML della pagina (ruoli letti dal DOM): ChatGPT, Claude, Gemini, DeepSeek, attributi generici
 *   - Testo semplice con etichette: "Hai detto:" / "ChatGPT ha detto:", "You said:", "User:",
 *     "**Assistant:**", "Domanda:" / "Risposta:", "Q:" / "A:", ...
 *   - Note già indicizzate da MiniPad (formato attuale e formato v1.5.8)
 *
 * L'indice è sempre ricostruito dal testo reale dell'editor (numeri di riga esatti) e si
 * aggiorna da solo mentre si scrive.
 */
window.MiniPadChatIndexer = (function () {
  let _tree = [];
  let _query = '';
  let _cmBound = null;
  let _refreshTimer = null;
  let _activeKey = null;
  let _detectTimer = null;

  /* =====================================================================
     TESTI (IT / EN)
     ===================================================================== */
  const STR = {
    it: {
      turn: 'Turno', user: 'Utente', assistant: 'Assistente', start: 'Inizio conversazione',
      toc: 'Indice della Conversazione', empty: 'Nessun elemento indicizzato. Incolla una chat o usa "Indicizza Chat".',
      noMatch: 'Nessun turno contiene', turns: 'turni', sections: 'sezioni', of: 'su',
      detected: 'Conversazione rilevata', detectNone: 'Nessun turno riconosciuto: verranno indicizzati i titoli del testo.',
      detectHint: 'Suggerimento: copia direttamente dalla pagina della chat (Ctrl+A, Ctrl+C) per riconoscere i ruoli automaticamente.',
      index: 'Indicizza', openIndex: 'Apri indice', pasteFirst: 'Incolla prima il testo della conversazione da indicizzare.',
      copied: 'Indice Markdown copiato negli appunti!', noIndex: 'Nessun indice disponibile da copiare.',
      formatNote: 'Formattare questa nota come conversazione indicizzata (titoli per ogni turno)? L\'operazione si può annullare con Ctrl+Z.',
      noTurnsInNote: 'Nella nota corrente non sono stati riconosciuti turni di conversazione.',
      untitled: 'Messaggio senza testo'
    },
    en: {
      turn: 'Turn', user: 'User', assistant: 'Assistant', start: 'Conversation start',
      toc: 'Conversation Index', empty: 'Nothing indexed yet. Paste a chat or use "Index Chat".',
      noMatch: 'No turn contains', turns: 'turns', sections: 'sections', of: 'of',
      detected: 'Conversation detected', detectNone: 'No turns recognised: the text headings will be indexed.',
      detectHint: 'Tip: copy straight from the chat page (Ctrl+A, Ctrl+C) so roles are detected automatically.',
      index: 'Index', openIndex: 'Open index', pasteFirst: 'Paste the conversation text first.',
      copied: 'Markdown index copied to clipboard!', noIndex: 'No index to copy.',
      formatNote: 'Format this note as an indexed conversation (one heading per turn)? You can undo with Ctrl+Z.',
      noTurnsInNote: 'No conversation turns were recognised in the current note.',
      untitled: 'Empty message'
    }
  };
  function lang() {
    try { return (typeof currentLang !== 'undefined' && STR[currentLang]) ? currentLang : 'it'; } catch (e) { return 'it'; }
  }
  const t = (k) => STR[lang()][k] || STR.it[k] || k;

  /* =====================================================================
     UTILITÀ
     ===================================================================== */
  const SP = () => (typeof MiniPadSmartPaste !== 'undefined' ? MiniPadSmartPaste : null);

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escapeRx(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function fold(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  /** Testo leggibile di una riga Markdown, per titoli e anteprime. */
  function plainTitle(s, max = 80) {
    let x = String(s || '')
      .replace(/^[ \t]*(?:>[ \t]?)+/, '')
      .replace(/^[ \t]*#{1,6}[ \t]+/, '')
      .replace(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/, '')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/(\*\*|__|~~)(.+?)\1/g, '$2')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
      .replace(/`+([^`]+)`+/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (x.length > max) {
      const cut = x.slice(0, max);
      const sp = cut.lastIndexOf(' ');
      x = (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,.;:]+$/, '') + '…';
    }
    return x;
  }

  /** Righe con flag "dentro un blocco di codice" (fence ``` / ~~~ secondo CommonMark). */
  function scanLines(text) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    const inCode = new Array(lines.length).fill(false);
    let fence = null;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!fence) {
        const m = l.match(/^[ \t]*(`{3,}|~{3,})(.*)$/);
        if (m && !(m[1][0] === '`' && m[2].includes('`'))) { fence = { ch: m[1][0], len: m[1].length }; inCode[i] = true; }
      } else {
        inCode[i] = true;
        const c = l.match(/^[ \t]*(`{3,}|~{3,})[ \t]*$/);
        if (c && c[1][0] === fence.ch && c[1].length >= fence.len) fence = null;
      }
    }
    return { lines, inCode };
  }

  /* =====================================================================
     ETICHETTE DI TURNO (testo semplice)
     ===================================================================== */
  const ASSISTANT_NAMES = ['ChatGPT', 'Claude', 'Gemini', 'DeepSeek', 'Copilot', 'Mistral', 'Le Chat', 'Perplexity', 'Grok', 'Llama', 'Qwen', 'Kimi', 'Bard'];
  const SAID_USER = ['You said', 'Hai detto', 'Tu hai detto', 'Dijiste', 'Has dicho', 'Vous avez dit', 'Tu as dit', 'Du hast gesagt', 'Sie sagten', 'Você disse', 'Voce disse'];
  const SAID_VERBS = ['said', 'says', 'ha detto', 'dice', 'dijo', 'a dit', 'hat gesagt', 'disse', 'responded', 'replied', 'ha risposto', 'risponde'];

  // Livello 1: frasi dell'interfaccia delle chat ed etichette scritte da MiniPad (massima affidabilità)
  // Livello 2: nomi dei ruoli / dei modelli
  // Livello 3: etichette generiche che possono comparire anche nel testo (richiedono i due punti)
  const TIERS = [
    {
      user: SAID_USER,
      assistant: ASSISTANT_NAMES.concat(['Assistant', 'Assistente', 'AI', 'Gemini']).reduce((acc, n) => acc.concat(SAID_VERBS.map(v => n + ' ' + v)), []),
      needColon: false
    },
    {
      user: ['User', 'Utente', 'Human', 'Umano', 'Prompt', 'Me', 'Io'],
      assistant: ASSISTANT_NAMES.concat(['Assistant', 'Assistente', 'Model', 'Modello', 'Bot', 'AI', 'IA']),
      needColon: false,
      colonOnly: ['Me', 'Io', 'Bot', 'AI', 'IA', 'Model', 'Modello']
    },
    {
      user: ['Domanda', 'Question', 'Richiesta', 'Request', 'Q', 'Tu', 'You'],
      assistant: ['Risposta', 'Answer', 'Response', 'A'],
      needColon: true
    }
  ];

  const DECOR_PRE = '^[ \\t]*(?:>[ \\t]*)*(?:#{1,6}[ \\t]+)?(?:[\\p{Extended_Pictographic}\\uFE0F\\u200D][ \\t]*)*(?:\\*\\*|__)?[ \\t]*';
  const PAREN = '(?:[ \\t]*\\([^)\\n]{0,40}\\))?';

  function compileTier(tier) {
    const mk = (names) => names.slice().sort((a, b) => b.length - a.length).map(escapeRx).join('|');
    const build = (names, colonRequired) => ({
      whole: new RegExp(DECOR_PRE + '(' + mk(names) + ')' + PAREN + '[ \\t]*(?:\\*\\*|__)?[ \\t]*' + (colonRequired ? ':' : ':?') + '[ \\t]*(?:\\*\\*|__)?[ \\t]*$', 'iu'),
      inline: new RegExp(DECOR_PRE + '(' + mk(names) + ')' + PAREN + '[ \\t]*(?:(?:\\*\\*|__)[ \\t]*:|:[ \\t]*(?:\\*\\*|__)?)[ \\t]*(\\S.*)$', 'iu')
    });
    const colonOnly = tier.colonOnly || [];
    const pick = (names) => ({
      free: names.filter(n => !colonOnly.includes(n)),
      colon: names.filter(n => colonOnly.includes(n))
    });
    const u = pick(tier.user);
    const a = pick(tier.assistant);
    return {
      user: [u.free.length && build(u.free, tier.needColon), u.colon.length && build(u.colon, true)].filter(Boolean),
      assistant: [a.free.length && build(a.free, tier.needColon), a.colon.length && build(a.colon, true)].filter(Boolean)
    };
  }
  const COMPILED = TIERS.map(compileTier);

  // Etichette scritte da MiniPad (formato attuale e v1.5.8) — livello 1
  const OWN_USER = /^[ \t]*(?:>[ \t]*)?(?:(?:🧑|💬)[ \t]*)?\*\*(?:(?:🧑|💬)[ \t]*)?(?:Utente|User)(?:[ \t]*\([^)\n]{0,40}\))?:?\*\*:?[ \t]*(.*)$/u;
  const OWN_ASSISTANT = /^[ \t]*(?:>[ \t]*)?(?:🤖[ \t]*)?\*\*(?:🤖[ \t]*)?(?:Assistente|Assistant)(?:[ \t]*\([^)\n]{0,40}\))?:?\*\*:?[ \t]*(.*)$/u;
  const TURN_HEADING = /^##[ \t]+💬[ \t]+(?:Turno|Turn)[ \t]+(\d+)(?:[ \t]*[—–-][ \t]*(.*))?[ \t]*$/u;

  function matchRole(line, compiled) {
    for (const role of ['user', 'assistant']) {
      for (const rx of compiled[role]) {
        const w = line.match(rx.whole);
        if (w) return { role, inline: '' };
        const m = line.match(rx.inline);
        if (m) return { role, inline: m[2] || '' };
      }
    }
    return null;
  }

  /**
   * Trova i marcatori di turno fuori dai blocchi di codice, usando il livello più affidabile
   * presente nel testo. Ritorna [{ line, role, inline, tier }].
   */
  function findMarkers(lines, inCode) {
    const byTier = [[], [], [], []];
    for (let i = 0; i < lines.length; i++) {
      if (inCode[i]) continue;
      const line = lines[i];
      if (!line.trim() || line.length > 400) continue;
      const own = line.match(OWN_USER) ? 'user' : (line.match(OWN_ASSISTANT) ? 'assistant' : null);
      if (own) {
        const m = line.match(own === 'user' ? OWN_USER : OWN_ASSISTANT);
        byTier[0].push({ line: i, role: own, inline: (m[1] || '').trim(), tier: 0 });
        continue;
      }
      for (let k = 0; k < COMPILED.length; k++) {
        const r = matchRole(line, COMPILED[k]);
        if (r) { byTier[k + 1].push({ line: i, role: r.role, inline: r.inline.trim(), tier: k + 1 }); break; }
      }
    }
    const roles = (arr) => ({ u: arr.filter(m => m.role === 'user').length, a: arr.filter(m => m.role === 'assistant').length });
    // Livello 0 (etichette scritte da MiniPad): basta un messaggio utente
    if (roles(byTier[0]).u >= 1) return byTier[0];
    // Livello 1 (frasi delle interfacce, es. "Hai detto:")
    const r1 = roles(byTier[1]);
    if (r1.u >= 1 && (r1.a >= 1 || r1.u >= 2)) return byTier[1];
    // Livelli 2-3: servono entrambi i ruoli; per le etichette generiche almeno due scambi
    const r2 = roles(byTier[2]);
    if (r2.u >= 1 && r2.a >= 1) return byTier[2];
    const r3 = roles(byTier[3]);
    if (r3.u >= 2 && r3.a >= 2) return byTier[3];
    return [];
  }

  /**
   * Divide un testo con etichette in turni { user, assistant } (Markdown).
   * Ritorna [] se non riconosce una conversazione.
   */
  function parseChatText(text) {
    const { lines, inCode } = scanLines(text);
    const markers = findMarkers(lines, inCode);
    if (!markers.length) return [];
    const turns = [];
    let cur = null;
    const clean = (s) => stripUiNoise(s)
      .split('\n').filter(l => !TURN_HEADING.test(l)).join('\n')
      .trim().replace(/(?:^|\n)[ \t]*(?:---+|\*\*\*+)$/, '').trim();
    const pre = lines.slice(0, markers[0].line).join('\n').trim();
    for (let k = 0; k < markers.length; k++) {
      const m = markers[k];
      const end = k + 1 < markers.length ? markers[k + 1].line : lines.length;
      const bodyLines = lines.slice(m.line + 1, end);
      if (m.inline) bodyLines.unshift(m.inline);
      if (m.role === 'user') {
        cur = { user: '', assistant: '' };
        // Formato v1.5.8 ("> 💬 **Utente (Turno N):**" + domanda citata + risposta senza etichetta)
        if (/^[ \t]*>/.test(lines[m.line]) && m.tier === 0) {
          let q = 0;
          while (q < bodyLines.length && /^[ \t]*>/.test(bodyLines[q])) q++;
          cur.user = clean(bodyLines.slice(0, q).map(l => l.replace(/^[ \t]*>[ \t]?/, '')).join('\n'));
          cur.assistant = clean(bodyLines.slice(q).join('\n'));
        } else {
          let u = clean(bodyLines.join('\n'));
          // Nota già formattata da MiniPad: la domanda è citata con "> "
          if (m.tier === 0 && u && u.split('\n').every(l => !l.trim() || /^[ \t]*>/.test(l))) {
            u = u.split('\n').map(l => l.replace(/^[ \t]*>[ \t]?/, '')).join('\n').trim();
          }
          cur.user = u;
        }
        turns.push(cur);
      } else {
        const body = clean(bodyLines.join('\n'));
        if (!cur || cur.assistant) { cur = { user: '', assistant: '' }; turns.push(cur); }
        cur.assistant = cur.assistant ? cur.assistant + '\n\n' + body : body;
      }
    }
    if (pre && turns.length) {
      // Testo prima del primo marcatore: di solito il titolo della chat, lo teniamo in testa
      turns[0].preamble = pre;
    }
    return turns;
  }

  /** Righe residue dell'interfaccia (pulsanti) presenti nelle copie di testo semplice. */
  function stripUiNoise(s) {
    return s.replace(/^[ \t]*(?:Copy code|Copia codice|Copia il codice|Copiar código|Copier le code|Code kopieren)[ \t]*$/gim, '');
  }

  /* =====================================================================
     CONVERSAZIONI DALL'HTML DELLA PAGINA
     ===================================================================== */

  /** Elimina dall'elemento del messaggio etichette per screen reader, ragionamenti e pulsanti. */
  function cleanMessageEl(el) {
    const c = el.cloneNode(true);
    c.querySelectorAll('.sr-only, .visually-hidden, .cdk-visually-hidden, [class*="sr-only"], model-thoughts, .thoughts-container, .ds-think-content, [class*="think-content"], .ds-thinking, button, [role="button"]')
      .forEach(x => x.remove());
    return c;
  }

  /** Il più basso antenato comune di un insieme di elementi. */
  function commonAncestor(els) {
    if (!els.length) return null;
    let anc = els[0].parentElement;
    while (anc && !els.every(e => anc.contains(e))) anc = anc.parentElement;
    return anc;
  }

  /** Rimuove gli elementi contenuti in un altro elemento della stessa lista. */
  function outermost(els) {
    return els.filter(e => !els.some(o => o !== e && o.contains(e)));
  }

  /**
   * Estrae i messaggi (in ordine) dall'HTML di una pagina di chat.
   * Ritorna { source, messages: [{ role, el }] } oppure null.
   */
  function messagesFromHtml(html) {
    if (!html || typeof DOMParser === 'undefined') return null;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const body = doc.body;
    const order = (a, b) => (a.el.compareDocumentPosition(b.el) & 4 ? -1 : 1);
    const collect = (sel, role) => outermost(Array.from(body.querySelectorAll(sel))).map(el => ({ role, el }));

    const strategies = [
      () => ({
        source: 'ChatGPT',
        messages: Array.from(body.querySelectorAll('[data-message-author-role]'))
          .map(el => ({ role: /^(user|human)$/i.test(el.getAttribute('data-message-author-role')) ? 'user' : (/assistant|tool|model/i.test(el.getAttribute('data-message-author-role')) ? 'assistant' : null), el }))
          .filter(m => m.role)
      }),
      () => ({
        source: 'Claude',
        messages: collect('[data-testid="user-message"]', 'user')
          .concat(collect('.font-claude-response, .font-claude-message, [data-testid="assistant-message"]', 'assistant'))
      }),
      () => ({
        source: 'Gemini',
        messages: collect('user-query, .user-query-container, [data-test-id="user-query"]', 'user')
          .concat(collect('model-response, .model-response-container, [data-test-id="model-response"]', 'assistant'))
      }),
      () => {
        // DeepSeek: solo le risposte hanno una classe stabile (.ds-markdown); i messaggi utente
        // sono i "fratelli" delle risposte nel contenitore della conversazione.
        const answers = outermost(Array.from(body.querySelectorAll('.ds-markdown'))
          .filter(el => !el.closest('.ds-think-content, [class*="think"]')));
        if (!answers.length) return { source: 'DeepSeek', messages: [] };
        const lca = commonAncestor(answers);
        if (!lca) return { source: 'DeepSeek', messages: [] };
        const msgs = [];
        Array.from(lca.children).forEach(child => {
          const own = answers.filter(a => child.contains(a));
          if (own.length) own.forEach(a => msgs.push({ role: 'assistant', el: a }));
          else if (child.textContent.trim()) msgs.push({ role: 'user', el: child });
        });
        return { source: 'DeepSeek', messages: msgs };
      },
      () => ({
        source: 'chat',
        messages: Array.from(body.querySelectorAll('[data-role], [data-author], [data-author-role], [data-message-role], [data-sender]'))
          .map(el => {
            const v = (el.getAttribute('data-role') || el.getAttribute('data-author') || el.getAttribute('data-author-role') || el.getAttribute('data-message-role') || el.getAttribute('data-sender') || '').toLowerCase();
            const role = /^(user|human|me|utente)$/.test(v) ? 'user' : (/^(assistant|model|bot|ai|assistente)$/.test(v) ? 'assistant' : null);
            return { role, el };
          })
          .filter(m => m.role)
      })
    ];

    for (const s of strategies) {
      const res = s();
      let msgs = res.messages;
      if (!msgs.length) continue;
      msgs = msgs.filter((m, i) => !msgs.some((o, j) => j !== i && o.el !== m.el && o.el.contains(m.el)));
      msgs.sort(order);
      const u = msgs.filter(m => m.role === 'user').length;
      const a = msgs.filter(m => m.role === 'assistant').length;
      if (u >= 1 && a >= 1) return { source: res.source, messages: msgs };
    }
    return null;
  }

  /** Converte i messaggi HTML in turni Markdown { user, assistant }. */
  function turnsFromMessages(messages) {
    const sp = SP();
    const toMd = (el) => {
      const clean = cleanMessageEl(el);
      if (sp && sp.htmlToMarkdown) return sp.htmlToMarkdown(clean).trim();
      return (clean.textContent || '').trim();
    };
    const turns = [];
    let cur = null;
    for (const m of messages) {
      const md = toMd(m.el);
      if (!md) continue;
      if (m.role === 'user') {
        if (cur && !cur.assistant) cur.user += '\n\n' + md; // messaggi utente consecutivi
        else { cur = { user: md, assistant: '' }; turns.push(cur); }
      } else {
        if (!cur) { cur = { user: '', assistant: '' }; turns.push(cur); }
        cur.assistant = cur.assistant ? cur.assistant + '\n\n' + md : md;
      }
    }
    return turns;
  }

  /**
   * Se gli appunti contengono una conversazione AI (HTML con ruoli), ritorna
   * { turns, source, transcript } — altrimenti null.
   */
  function chatFromClipboard(html) {
    const found = messagesFromHtml(html);
    if (!found) return null;
    const turns = turnsFromMessages(found.messages);
    if (!turns.length || !turns.some(tt => tt.user) || !turns.some(tt => tt.assistant)) return null;
    return { turns, source: found.source, transcript: transcriptFromTurns(turns, found.source) };
  }

  /* =====================================================================
     FORMATI DI USCITA
     ===================================================================== */

  function userLabel() { return `**🧑 ${t('user')}:**`; }
  function assistantLabel(source) {
    const name = source && source !== 'chat' ? ` (${source})` : '';
    return `**🤖 ${t('assistant')}${name}:**`;
  }

  /** Trascrizione leggibile con etichette (riconosciuta dall'indice anche senza formattazione). */
  function transcriptFromTurns(turns, source) {
    const parts = [];
    turns.forEach(tt => {
      if (tt.preamble) parts.push(tt.preamble);
      if (tt.user) parts.push(userLabel() + '\n\n' + tt.user);
      if (tt.assistant) parts.push(assistantLabel(source) + '\n\n' + tt.assistant);
    });
    return parts.join('\n\n') + '\n';
  }

  /** Abbassa i titoli della risposta sotto il titolo del turno (## → ###), fuori dal codice. */
  function shiftHeadings(md, minLevel) {
    const { lines, inCode } = scanLines(md);
    let min = 7;
    lines.forEach((l, i) => { const m = !inCode[i] && l.match(/^(#{1,6})[ \t]/); if (m) min = Math.min(min, m[1].length); });
    if (min >= minLevel || min === 7) return md;
    const shift = minLevel - min;
    return lines.map((l, i) => {
      if (inCode[i]) return l;
      return l.replace(/^(#{1,6})(?=[ \t])/, h => '#'.repeat(Math.min(6, h.length + shift)));
    }).join('\n');
  }

  function quote(md) {
    return md.split('\n').map(l => (l.trim() ? '> ' + l : '>')).join('\n');
  }

  function turnTitleFrom(userMd) {
    const { lines, inCode } = scanLines(userMd || '');
    for (let i = 0; i < lines.length; i++) {
      if (inCode[i]) continue;
      const tt = plainTitle(lines[i]);
      if (tt) return tt;
    }
    return '';
  }

  /** Conversazione formattata: un titolo "## 💬 Turno N — …" per ogni domanda. */
  function formatTurns(turns, source) {
    const out = [];
    let n = 0;
    turns.forEach(tt => {
      if (tt.preamble) out.push(tt.preamble, '');
      n++;
      const title = turnTitleFrom(tt.user) || (tt.user ? t('untitled') : t('start'));
      out.push(`## 💬 ${t('turn')} ${n} — ${title}`, '');
      if (tt.user) out.push(userLabel(), '', quote(tt.user), '');
      if (tt.assistant) out.push(assistantLabel(source), '', shiftHeadings(tt.assistant, 3), '');
      out.push('---', '');
    });
    return out.join('\n');
  }

  /* =====================================================================
     COSTRUZIONE DELL'INDICE (dal testo reale dell'editor)
     ===================================================================== */

  function headingAt(lines, inCode, i) {
    if (inCode[i]) return null;
    const m = lines[i].match(/^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/);
    if (m) return { level: m[1].length, text: m[2] };
    // Titoli setext: riga di testo isolata seguita da === (h1) o --- (h2)
    const next = lines[i + 1];
    const isolated = i === 0 || !lines[i - 1].trim();
    if (next !== undefined && !inCode[i + 1] && isolated && lines[i].trim() &&
        !/^[ \t]*(?:[-*+>#]|\d+[.)]|\|)/.test(lines[i])) {
      if (/^[ \t]*=+[ \t]*$/.test(next)) return { level: 1, text: lines[i].trim() };
      if (/^[ \t]*-{2,}[ \t]*$/.test(next)) return { level: 2, text: lines[i].trim() };
    }
    return null;
  }

  function firstTextAfter(lines, inCode, from, to) {
    for (let i = from; i < to; i++) {
      if (inCode[i]) continue;
      if (OWN_USER.test(lines[i]) || OWN_ASSISTANT.test(lines[i])) continue;
      if (/^[ \t]*(?:---+|\*\*\*+|___+)[ \t]*$/.test(lines[i])) continue;
      const tt = plainTitle(lines[i]);
      if (tt) return tt;
    }
    return '';
  }

  /**
   * Indice di un documento: [{ type:'turn', index, title, subtitle, line, end, children:[...] }]
   * oppure, per documenti senza turni, [{ type:'heading', level, title, line }].
   */
  function buildIndex(text) {
    const { lines, inCode } = scanLines(text);
    const headings = [];
    for (let i = 0; i < lines.length; i++) {
      const h = headingAt(lines, inCode, i);
      if (h) headings.push({ line: i, level: h.level, raw: h.text, title: plainTitle(h.text, 90) });
    }

    // Punti d'inizio dei turni
    let starts = [];
    let mode = 'none';
    const formatted = headings.filter(h => TURN_HEADING.test('## ' + h.raw) && h.level === 2);
    if (formatted.length) {
      mode = 'formatted';
      starts = formatted.map(h => {
        const m = ('## ' + h.raw).match(TURN_HEADING);
        return { line: h.line, title: plainTitle(m[2] || '', 80), number: +m[1] };
      });
    } else {
      const markers = findMarkers(lines, inCode);
      if (markers.length) {
        mode = 'labels';
        let lastUser = -1;
        markers.forEach((m, k) => {
          if (m.role === 'user') {
            const end = k + 1 < markers.length ? markers[k + 1].line : lines.length;
            starts.push({ line: m.line, title: plainTitle(m.inline, 80) || firstTextAfter(lines, inCode, m.line + 1, end) });
            lastUser = k;
          } else if (lastUser === -1 && k === 0) {
            starts.push({ line: m.line, title: t('start') });
          }
        });
      }
    }

    if (!starts.length) {
      if (headings.length) {
        return headings.map(h => ({ type: 'heading', level: h.level, title: h.title, line: h.line, children: [] }));
      }
      // Testo libero senza titoli: un punto di accesso per paragrafo (massimo ~60)
      const items = [];
      const step = Math.max(1, Math.ceil(lines.length / 60));
      let lastAdded = -step;
      for (let i = 0; i < lines.length; i++) {
        if (inCode[i] || !lines[i].trim()) continue;
        const paraStart = i === 0 || !lines[i - 1].trim();
        if (paraStart && i - lastAdded >= step) {
          const tt = plainTitle(lines[i], 70);
          if (tt.length > 3) { items.push({ type: 'heading', level: 2, title: tt, line: i, children: [] }); lastAdded = i; }
        }
      }
      return items;
    }

    return starts.map((s, k) => {
      const end = k + 1 < starts.length ? starts[k + 1].line : lines.length;
      const children = headings
        .filter(h => h.line > s.line && h.line < end)
        .map(h => ({ type: 'heading', level: h.level, title: h.title, line: h.line }));
      // Sottotitolo: prima sezione della risposta, oppure la sua prima frase
      let subtitle = children.length ? children[0].title : '';
      if (!subtitle) {
        let aStart = -1;
        for (let i = s.line + 1; i < end; i++) {
          if (!inCode[i] && (OWN_ASSISTANT.test(lines[i]) || (mode === 'labels' && matchAnyAssistant(lines[i])))) { aStart = i + 1; break; }
        }
        if (aStart > 0) subtitle = firstTextAfter(lines, inCode, aStart, end);
      }
      if (subtitle === s.title) subtitle = '';
      return {
        type: 'turn',
        index: k + 1,
        title: s.title || t('untitled'),
        subtitle: plainTitle(subtitle, 90),
        line: s.line,
        end,
        mode,
        children,
        search: fold(lines.slice(s.line, end).join('\n'))
      };
    });
  }

  function matchAnyAssistant(line) {
    if (OWN_ASSISTANT.test(line)) return true;
    return COMPILED.some(c => { const r = matchRole(line, c); return r && r.role === 'assistant'; });
  }

  /** Indice in formato Markdown (per "Copia indice" o TOC nel documento). */
  function tocMarkdown(items) {
    let s = `## 📑 ${t('toc')}\n\n`;
    items.forEach(it => {
      if (it.type === 'turn') {
        s += `- **${t('turn')} ${it.index}:** ${it.title}\n`;
        (it.children || []).forEach(c => { s += `${'  '.repeat(Math.max(1, c.level - 2))}- ${c.title}\n`; });
      } else {
        s += `${'  '.repeat(Math.max(0, it.level - 1))}- ${it.title}\n`;
      }
    });
    return s;
  }

  /* =====================================================================
     EDITOR
     ===================================================================== */
  function cm() { return window.easyMDE && window.easyMDE.codemirror ? window.easyMDE.codemirror : null; }

  function editorText() {
    if (window.easyMDE) return window.easyMDE.value();
    if (typeof getEditorContent === 'function') return getEditorContent();
    return '';
  }

  function applyTextToEditor(text, mode, suggestedTitle) {
    if (mode === 'new' && typeof createNote === 'function') {
      return Promise.resolve(createNote(suggestedTitle, text)).then(() => afterApply());
    }
    if (window.easyMDE) {
      if (mode === 'append') {
        const cur = window.easyMDE.value();
        window.easyMDE.value((cur ? cur.replace(/\s*$/, '') + '\n\n' : '') + text);
      } else {
        window.easyMDE.value(text);
      }
      if (typeof updateStats === 'function') updateStats();
      if (typeof updatePreview === 'function') updatePreview();
    }
    return Promise.resolve(afterApply());
  }

  function afterApply() {
    refreshFromEditor();
  }

  /* =====================================================================
     MODALE "INDICIZZA CHAT"
     ===================================================================== */
  function openModal() {
    const modal = document.getElementById('chat-indexer-modal-overlay');
    if (!modal) return;
    modal.classList.add('is-open');
    document.body.classList.add('mp-modal-open');
    const ta = document.getElementById('chat-indexer-input');
    if (ta) {
      ta.value = '';
      bindModalTextarea(ta);
      updateDetection();
      setTimeout(() => ta.focus(), 100);
    }
  }

  function closeModal() {
    const modal = document.getElementById('chat-indexer-modal-overlay');
    if (modal) {
      modal.classList.remove('is-open');
      document.body.classList.remove('mp-modal-open');
    }
  }

  let _lastPasteSource = null;

  function bindModalTextarea(ta) {
    if (ta._mpBound) return;
    ta._mpBound = true;
    // Stessa conversione dell'editor: il risultato non dipende da dove si incolla.
    ta.addEventListener('paste', (e) => {
      const cd = e.clipboardData;
      if (!cd) return;
      const html = cd.getData('text/html');
      const plain = cd.getData('text/plain');
      const chat = html ? chatFromClipboard(html) : null;
      const sp = SP();
      let text = null;
      if (chat) { text = chat.transcript; _lastPasteSource = chat.source; }
      else if (sp && sp.clipboardToMarkdown) {
        const res = sp.clipboardToMarkdown(html, plain);
        if (res.source !== 'raw') text = res.markdown;
        _lastPasteSource = null;
      }
      if (text === null) { setTimeout(updateDetection, 0); return; }
      e.preventDefault();
      if (sp && sp.insertAtCursor) sp.insertAtCursor(ta, text);
      else ta.value += text;
      updateDetection();
    });
    ta.addEventListener('input', () => {
      clearTimeout(_detectTimer);
      _detectTimer = setTimeout(updateDetection, 250);
    });
  }

  function updateDetection() {
    const el = document.getElementById('chat-indexer-detect');
    const ta = document.getElementById('chat-indexer-input');
    if (!el || !ta) return;
    const val = ta.value;
    if (!val.trim()) {
      el.className = 'mp-chat-detect';
      el.textContent = t('detectHint');
      return;
    }
    const turns = parseChatText(val);
    if (turns.length) {
      const src = _lastPasteSource ? ` · ${_lastPasteSource}` : '';
      el.className = 'mp-chat-detect is-ok';
      el.textContent = `✓ ${t('detected')}: ${turns.length} ${t('turns')}${src}`;
    } else {
      el.className = 'mp-chat-detect is-warn';
      el.textContent = t('detectNone') + ' ' + t('detectHint');
    }
  }

  function applyIndexedChat() {
    const ta = document.getElementById('chat-indexer-input');
    if (!ta || !ta.value.trim()) {
      alert(t('pasteFirst'));
      return;
    }
    const sp = SP();
    const raw = ta.value.trim();
    const formatOn = document.getElementById('chat-opt-format-turns')?.checked ?? true;
    const tocMode = document.getElementById('chat-opt-toc-mode')?.value || 'panel';
    const targetMode = document.getElementById('chat-opt-target')?.value || 'replace';

    const norm = (s) => (sp && sp.normalizePasted ? sp.normalizePasted(s) : s);
    const turns = parseChatText(raw).map(tt => ({
      preamble: tt.preamble ? norm(tt.preamble) : '',
      user: norm(tt.user),
      assistant: norm(tt.assistant)
    }));

    let output;
    if (turns.length && formatOn) output = formatTurns(turns, _lastPasteSource);
    else output = norm(raw) + '\n';

    if (tocMode === 'doc' || tocMode === 'both') {
      output = tocMarkdown(buildIndex(output)) + '\n---\n\n' + output;
    }

    const title = (turns.length && turnTitleFrom(turns[0].user)) || plainTitle(raw.split('\n')[0], 50) || 'Conversazione';
    closeModal();
    applyTextToEditor(output, targetMode, title).then(() => {
      if (tocMode === 'panel' || tocMode === 'both') togglePanel(true);
    });
    _lastPasteSource = null;
  }

  /* =====================================================================
     INCOLLA DIRETTO NELL'EDITOR
     ===================================================================== */
  let _toastTimer = null;

  /** Chiamato da MiniPadSmartPaste dopo l'incolla di una conversazione nell'editor. */
  function onChatPasted(chat, editor, from) {
    let mark = null;
    if (editor && editor.markText && from) {
      const to = editor.getCursor('to');
      mark = editor.markText(from, to, { clearWhenEmpty: false });
    }
    if (isPanelOpen()) scheduleRefresh(0);
    showChatToast(chat, editor, mark);
  }

  function showChatToast(chat, editor, mark) {
    if (typeof document === 'undefined' || !document.body) return;
    let el = document.getElementById('mp-chat-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'mp-chat-toast';
      el.className = 'mp-chat-toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.innerHTML = '';
    const msg = document.createElement('span');
    msg.textContent = `💬 ${t('detected')} (${chat.source}): ${chat.turns.length} ${t('turns')}`;
    const bIndex = document.createElement('button');
    bIndex.className = 'mp-modal-btn is-primary';
    bIndex.textContent = t('index');
    bIndex.onclick = () => {
      const range = mark && mark.find ? mark.find() : null;
      const formatted = formatTurns(chat.turns, chat.source);
      if (range && editor) {
        editor.replaceRange(formatted, range.from, range.to);
        mark.clear();
      } else if (editor) {
        editor.replaceSelection(formatted);
      }
      hideToast();
      togglePanel(true);
    };
    const bOpen = document.createElement('button');
    bOpen.className = 'mp-modal-btn';
    bOpen.textContent = t('openIndex');
    bOpen.onclick = () => { hideToast(); togglePanel(true); };
    const bClose = document.createElement('button');
    bClose.className = 'mp-chat-toast-close';
    bClose.setAttribute('aria-label', 'Chiudi');
    bClose.textContent = '✕';
    bClose.onclick = () => { if (mark) mark.clear(); hideToast(); };
    el.append(msg, bIndex, bOpen, bClose);
    el.classList.add('is-visible');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(hideToast, 15000);
  }

  function hideToast() {
    const el = document.getElementById('mp-chat-toast');
    if (el) el.classList.remove('is-visible');
  }

  /** Formatta come conversazione la nota corrente (chat incollata a mano o trascritta). */
  function formatCurrentNote() {
    const text = editorText();
    const turns = parseChatText(text);
    if (!turns.length) { alert(t('noTurnsInNote')); return; }
    if (buildIndex(text).some(i => i.mode === 'formatted')) { refreshFromEditor(); return; }
    if (!confirm(t('formatNote'))) return;
    const c = cm();
    const out = formatTurns(turns, null);
    if (c) c.setValue(out); else if (window.easyMDE) window.easyMDE.value(out);
    if (typeof updatePreview === 'function') updatePreview();
    refreshFromEditor();
  }

  /* =====================================================================
     PANNELLO LATERALE
     ===================================================================== */
  function isPanelOpen() {
    const p = document.getElementById('chat-index-panel');
    return !!(p && p.classList.contains('is-open'));
  }

  function togglePanel(force) {
    const panel = document.getElementById('chat-index-panel');
    if (!panel) return;
    const open = typeof force === 'boolean' ? force : !panel.classList.contains('is-open');
    panel.classList.toggle('is-open', open);
    if (open) {
      bindPanel();
      bindEditor();
      refreshFromEditor();
    }
  }

  function bindPanel() {
    const panel = document.getElementById('chat-index-panel');
    if (!panel || panel._mpBound) return;
    panel._mpBound = true;
    const tree = document.getElementById('chat-index-tree');
    if (tree) {
      tree.addEventListener('click', (e) => {
        const toggle = e.target.closest('[data-toggle]');
        if (toggle) {
          const li = toggle.closest('.mp-tree-turn');
          if (li) li.classList.toggle('is-collapsed');
          e.stopPropagation();
          return;
        }
        const node = e.target.closest('[data-line]');
        if (!node) return;
        let line = +node.getAttribute('data-line');
        const end = node.hasAttribute('data-end') ? +node.getAttribute('data-end') : null;
        // Con una ricerca attiva, salta alla prima riga che contiene i termini cercati
        if (_query && end !== null) {
          const hit = findLineMatching(line, end, _query);
          if (hit !== -1) line = hit;
        }
        jumpToLine(line, node.getAttribute('data-title') || '', node.getAttribute('data-kind'));
      });
    }
    const search = document.getElementById('chat-index-search');
    if (search) {
      search.addEventListener('input', () => { _query = search.value.trim(); renderTree(_tree); });
      search.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const first = document.querySelector('#chat-index-tree [data-line]');
          if (first) first.click();
        } else if (e.key === 'Escape') {
          search.value = ''; _query = ''; renderTree(_tree);
        }
      });
    }
  }

  function bindEditor() {
    const c = cm();
    if (!c || _cmBound === c) return;
    _cmBound = c;
    c.on('change', () => { if (isPanelOpen()) scheduleRefresh(500); });
    c.on('scroll', () => { if (isPanelOpen()) highlightActive(); });
    c.on('cursorActivity', () => { if (isPanelOpen()) highlightActive(); });
  }

  function scheduleRefresh(delay) {
    clearTimeout(_refreshTimer);
    _refreshTimer = setTimeout(refreshFromEditor, delay);
  }

  function refreshFromEditor() {
    _tree = buildIndex(editorText());
    renderTree(_tree);
    highlightActive();
  }

  function queryTerms() { return fold(_query).split(/\s+/).filter(Boolean); }

  function matchesQuery(item) {
    const terms = queryTerms();
    if (!terms.length) return true;
    const hay = item.search || fold(item.title + ' ' + (item.subtitle || ''));
    return terms.every(q => hay.includes(q));
  }

  function findLineMatching(from, to, query) {
    const terms = fold(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return -1;
    const lines = editorText().split('\n');
    for (let i = from; i < Math.min(to, lines.length); i++) {
      const l = fold(lines[i]);
      if (terms.some(q => l.includes(q))) return i;
    }
    return -1;
  }

  function highlightTerms(s) {
    const html = escapeHtml(s);
    const terms = queryTerms().filter(q => q.length > 1);
    if (!terms.length) return html;
    // evidenzia confrontando la versione senza accenti, carattere per carattere
    const folded = fold(s);
    const marks = new Array(s.length).fill(false);
    terms.forEach(q => {
      let idx = folded.indexOf(q);
      while (idx !== -1) { for (let k = idx; k < idx + q.length && k < s.length; k++) marks[k] = true; idx = folded.indexOf(q, idx + q.length); }
    });
    if (folded.length !== s.length) return html;
    let out = '', open = false;
    for (let i = 0; i < s.length; i++) {
      if (marks[i] && !open) { out += '<mark>'; open = true; }
      if (!marks[i] && open) { out += '</mark>'; open = false; }
      out += escapeHtml(s[i]);
    }
    return out + (open ? '</mark>' : '');
  }

  function renderTree(items) {
    const listEl = document.getElementById('chat-index-tree');
    const statsEl = document.getElementById('chat-index-stats');
    if (!listEl) return;

    if (!items || !items.length) {
      listEl.innerHTML = `<li class="mp-tree-empty">${escapeHtml(t('empty'))}</li>`;
      if (statsEl) statsEl.innerHTML = '<span>0</span>';
      return;
    }

    const turns = items.filter(i => i.type === 'turn');
    const visible = items.filter(matchesQuery);
    const sections = turns.reduce((n, tt) => n + tt.children.length, 0);
    let html = '';

    visible.forEach(item => {
      const key = item.type + ':' + item.line;
      if (item.type === 'turn') {
        const kids = item.children || [];
        html += `<li class="mp-tree-turn" data-key="${key}">
          <div class="mp-tree-turn-header" data-line="${item.line}" data-end="${item.end}" data-kind="turn" data-title="${escapeHtml(item.title)}" title="${escapeHtml(item.title)}">
            <span class="mp-tree-badge">T${item.index}</span>
            <span class="mp-tree-turn-main">
              <span class="mp-tree-turn-text">${highlightTerms(item.title)}</span>
              ${item.subtitle ? `<span class="mp-tree-turn-sub">${highlightTerms(item.subtitle)}</span>` : ''}
            </span>
            ${kids.length ? `<span class="mp-tree-caret" data-toggle="1" title="${kids.length} ${escapeHtml(t('sections'))}">${kids.length}</span>` : ''}
          </div>`;
        if (kids.length) {
          html += '<ul class="mp-tree-sublist">';
          kids.forEach(c => {
            html += `<li class="mp-tree-item level-${Math.min(3, Math.max(1, c.level - 2))}" data-key="heading:${c.line}" data-line="${c.line}" data-kind="heading" data-title="${escapeHtml(c.title)}" title="${escapeHtml(c.title)}">
              <span>${highlightTerms(c.title)}</span></li>`;
          });
          html += '</ul>';
        }
        html += '</li>';
      } else {
        html += `<li class="mp-tree-item level-${Math.min(3, item.level)}" data-key="${key}" data-line="${item.line}" data-kind="heading" data-title="${escapeHtml(item.title)}" title="${escapeHtml(item.title)}">
          <span>${highlightTerms(item.title)}</span></li>`;
      }
    });

    if (!visible.length) html = `<li class="mp-tree-empty">${escapeHtml(t('noMatch'))} “${escapeHtml(_query)}”</li>`;
    listEl.innerHTML = html;

    if (statsEl) {
      const left = turns.length
        ? (_query ? `${visible.length} ${t('of')} ${turns.length} ${t('turns')}` : `${turns.length} ${t('turns')} · ${sections} ${t('sections')}`)
        : `${items.length} ${t('sections')}`;
      statsEl.innerHTML = `<span>${escapeHtml(left)}</span><span class="mp-chat-index-keys" title="Alt+↑ / Alt+↓">Alt ↑↓</span>`;
    }
    _activeKey = null;
  }

  /** Evidenzia nel pannello il turno/sezione visibile in cima all'editor. */
  function highlightActive() {
    const c = cm();
    if (!c || !_tree.length) return;
    const info = c.getScrollInfo();
    const topLine = c.lineAtHeight(info.top + 4, 'local');
    const cursor = c.getCursor().line;
    const ref = c.hasFocus() ? cursor : topLine;
    let active = null;
    const all = [];
    _tree.forEach(it => { all.push(it); (it.children || []).forEach(ch => all.push(ch)); });
    all.sort((a, b) => a.line - b.line).forEach(it => { if (it.line <= ref) active = it; });
    const key = active ? active.type + ':' + active.line : null;
    if (key === _activeKey) return;
    _activeKey = key;
    document.querySelectorAll('#chat-index-tree .is-active').forEach(e => e.classList.remove('is-active'));
    if (!key) return;
    const el = document.querySelector(`#chat-index-tree [data-key="${key}"]`);
    if (el) {
      const target = el.classList.contains('mp-tree-turn') ? el.querySelector('.mp-tree-turn-header') : el;
      target.classList.add('is-active');
      const body = el.closest('.mp-chat-index-body');
      if (body) {
        const r = target.getBoundingClientRect();
        const b = body.getBoundingClientRect();
        if (r.top < b.top || r.bottom > b.bottom) target.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  /** Turno successivo/precedente rispetto alla posizione corrente. */
  function gotoTurn(dir) {
    const c = cm();
    if (!_tree.length) _tree = buildIndex(editorText());
    const turns = _tree.filter(i => i.type === 'turn');
    const list = turns.length ? turns : _tree;
    if (!list.length) return;
    const cur = c ? c.getCursor().line : 0;
    let target;
    if (dir > 0) target = list.find(i => i.line > cur) || list[list.length - 1];
    else target = list.slice().reverse().find(i => i.line < cur) || list[0];
    jumpToLine(target.line, target.title, target.type);
  }

  /* =====================================================================
     SALTO NELL'EDITOR E NELL'ANTEPRIMA
     ===================================================================== */
  function jumpToLine(lineNum, title, kind) {
    const c = cm();
    if (c) {
      const target = Math.max(0, Math.min(c.lineCount() - 1, lineNum));
      c.setCursor({ line: target, ch: 0 });
      const top = c.charCoords({ line: target, ch: 0 }, 'local').top;
      c.scrollTo(null, Math.max(0, top - 8));
      c.focus();
      try {
        const handle = c.addLineClass(target, 'background', 'mp-highlight-flash');
        setTimeout(() => c.removeLineClass(handle, 'background', 'mp-highlight-flash'), 1600);
      } catch (e) { /* ignore */ }
      syncPreview(target, title, kind, c.lineCount());
    }
  }

  /** Scorre l'anteprima al titolo corrispondente (stesso testo e stessa occorrenza). */
  function syncPreview(line, title, kind, lineCount) {
    const pane = document.getElementById('preview-pane');
    const content = document.getElementById('preview-content');
    if (!content) return;
    let el = null;
    const want = fold(plainTitle(title || '', 400)).replace(/[^\p{L}\p{N}]+/gu, '');
    if (want) {
      // occorrenza: quanti titoli con lo stesso testo precedono questa riga
      const items = [];
      _tree.forEach(it => { items.push(it); (it.children || []).forEach(ch => items.push(ch)); });
      const same = items.filter(it => fold(it.title).replace(/[^\p{L}\p{N}]+/gu, '') === want && it.line < line).length;
      const hs = Array.from(content.querySelectorAll('h1, h2, h3, h4, h5, h6'))
        .filter(h => fold(h.textContent).replace(/[^\p{L}\p{N}]+/gu, '').includes(want));
      el = hs[same] || hs[0] || null;
    }
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('mp-preview-flash');
      setTimeout(() => el.classList.remove('mp-preview-flash'), 1500);
    } else if (pane && lineCount > 1) {
      // Nessun titolo nell'anteprima (es. chat con sole etichette): posizione proporzionale
      const max = pane.scrollHeight - pane.clientHeight;
      pane.scrollTo({ top: Math.max(0, (line / (lineCount - 1)) * max), behavior: 'smooth' });
    }
  }

  function copyTocMarkdown() {
    if (!_tree || !_tree.length) _tree = buildIndex(editorText());
    if (!_tree.length) { alert(t('noIndex')); return; }
    const toc = tocMarkdown(_tree);
    navigator.clipboard.writeText(toc).then(() => {
      if (typeof showToast === 'function') showToast(t('copied')); else alert(t('copied'));
    }).catch(() => {
      prompt('Copia manualmente l\'indice Markdown:', toc);
    });
  }

  // Scorciatoie: Alt+↑ / Alt+↓ per passare da un turno all'altro
  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', (e) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const inEditor = e.target && e.target.closest && e.target.closest('.CodeMirror');
      if (!inEditor && !isPanelOpen()) return;
      e.preventDefault();
      gotoTurn(e.key === 'ArrowDown' ? 1 : -1);
    });
  }

  // Compatibilità con la v1.5.8: parseDialogue
  function parseDialogue(rawText) {
    const turns = parseChatText(rawText || '');
    return { turns, hasTurns: turns.length > 0, normalizedText: rawText || '' };
  }

  return {
    openModal,
    closeModal,
    togglePanel,
    applyIndexedChat,
    refreshFromEditor,
    formatCurrentNote,
    jumpToLine,
    gotoTurn,
    copyTocMarkdown,
    // logica pura (testata)
    parseChatText,
    parseDialogue,
    messagesFromHtml,
    chatFromClipboard,
    transcriptFromTurns,
    formatTurns,
    buildIndex,
    tocMarkdown,
    shiftHeadings,
    plainTitle,
    onChatPasted
  };
})();

// Bridge globali per i pulsanti HTML inline
if (typeof window !== 'undefined') {
  window.openChatIndexerModal = function () { window.MiniPadChatIndexer.openModal(); };
  window.closeChatIndexerModal = function () { window.MiniPadChatIndexer.closeModal(); };
  window.toggleChatIndexPanel = function (force) { window.MiniPadChatIndexer.togglePanel(force); };
  window.applyIndexedChat = function () { window.MiniPadChatIndexer.applyIndexedChat(); };
  window.refreshFromEditor = function () { window.MiniPadChatIndexer.refreshFromEditor(); };
  window.copyTocMarkdown = function () { window.MiniPadChatIndexer.copyTocMarkdown(); };
  window.formatChatNote = function () { window.MiniPadChatIndexer.formatCurrentNote(); };
  window.gotoChatTurn = function (dir) { window.MiniPadChatIndexer.gotoTurn(dir); };
}
