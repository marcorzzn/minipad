/**
 * MiniPad Chat Indexer v1.5.8
 * - Parser intelligente per conversazioni AI (ChatGPT, Claude, DeepSeek, Gemini, ecc.)
 * - Riconoscimento turni Utente / Assistente e formattazione tipografica
 * - Generazione automatica indice gerarchico (TOC ad albero stile DeepSeek)
 * - Pannello laterale di navigazione reattivo con scroll sincronizzato
 */
window.MiniPadChatIndexer = (function () {
  let _isOpen = false;
  let _lastParsedTree = [];

  // Espressioni regolari per identificare i marcatori di turno
  const USER_PATTERNS = [
    /^[ \t]*(?:>?[ \t]*)?(?:\*\*|###[ \t]*|##[ \t]*|#?[ \t]*)?(?:User|Utente|Tu|Human|Prompt|Domanda|Domanda\s+\d+|User\s+\d+|Q)(?:\*\*|:|\b)(?:[ \t]*[:\-])?[ \t]*(.*)$/i,
    /^[ \t]*<div[^>]*class=["'][^"']*(?:user|human|prompt)[^"']*["'][^>]*>(.*?)<\/div>/i
  ];

  const ASSISTANT_PATTERNS = [
    /^[ \t]*(?:>?[ \t]*)?(?:\*\*|###[ \t]*|##[ \t]*|#?[ \t]*)?(?:Assistant|Assistente|ChatGPT|Claude|DeepSeek|Gemini|Risposta|Risposta\s+\d+|A)(?:\*\*|:|\b)(?:[ \t]*[:\-])?[ \t]*(.*)$/i,
    /^[ \t]*<div[^>]*class=["'][^"']*(?:assistant|bot|model|reply)[^"']*["'][^>]*>(.*?)<\/div>/i
  ];

  function openModal() {
    const modal = document.getElementById('chat-indexer-modal-overlay');
    if (modal) {
      modal.classList.add('is-open');
      document.body.classList.add('mp-modal-open');
      const textarea = document.getElementById('chat-indexer-input');
      if (textarea) {
        textarea.value = '';
        setTimeout(() => textarea.focus(), 100);
      }
    }
  }

  function closeModal() {
    const modal = document.getElementById('chat-indexer-modal-overlay');
    if (modal) {
      modal.classList.remove('is-open');
      document.body.classList.remove('mp-modal-open');
    }
  }

  function togglePanel(force) {
    const panel = document.getElementById('chat-index-panel');
    if (!panel) return;
    _isOpen = typeof force === 'boolean' ? force : !panel.classList.contains('is-open');
    if (_isOpen) {
      panel.classList.add('is-open');
    } else {
      panel.classList.remove('is-open');
    }
  }

  /**
   * Analizza il testo per estrarre i turni della conversazione.
   * Ritorna un array di turni { userText, assistantText, headings: [{ text, level, line }] }
   */
  function parseDialogue(rawText) {
    if (!rawText) return { turns: [], hasTurns: false };

    // Sanitizza preventivamente le formule matematiche
    let text = rawText;
    if (typeof MiniPadSmartPaste !== 'undefined' && typeof MiniPadSmartPaste.normalizeAllMath === 'function') {
      text = MiniPadSmartPaste.normalizeAllMath(text);
    } else if (typeof window.normalizeAllMath === 'function') {
      text = window.normalizeAllMath(text);
    }

    const lines = text.split(/\r?\n/);
    const turns = [];
    let currentTurn = null;
    let mode = 'none'; // 'user' | 'assistant'

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Controlla se la riga avvia un turno utente
      let isUser = false;
      let userPrefixText = '';
      for (const rx of USER_PATTERNS) {
        const m = line.match(rx);
        if (m) {
          isUser = true;
          userPrefixText = m[1] || '';
          break;
        }
      }

      // Controlla se la riga avvia un turno assistente
      let isAssistant = false;
      let assistantPrefixText = '';
      for (const rx of ASSISTANT_PATTERNS) {
        const m = line.match(rx);
        if (m) {
          isAssistant = true;
          assistantPrefixText = m[1] || '';
          break;
        }
      }

      if (isUser) {
        // Salva il turno precedente se presente
        if (currentTurn && (currentTurn.userLines.length || currentTurn.assistantLines.length)) {
          turns.push(currentTurn);
        }
        const cleanUserText = userPrefixText.replace(/^[\s*:*]+|[\s*:*]+$/g, '').trim();
        currentTurn = {
          turnIndex: turns.length + 1,
          userLines: cleanUserText ? [cleanUserText] : [],
          assistantLines: [],
          headings: []
        };
        mode = 'user';
        continue;
      }

      if (isAssistant) {
        const cleanAssistantText = assistantPrefixText.replace(/^[\s*:*]+|[\s*:*]+$/g, '').trim();
        if (!currentTurn) {
          currentTurn = {
            turnIndex: turns.length + 1,
            userLines: ['Richiesta iniziale'],
            assistantLines: cleanAssistantText ? [cleanAssistantText] : [],
            headings: []
          };
        } else if (cleanAssistantText) {
          currentTurn.assistantLines.push(cleanAssistantText);
        }
        mode = 'assistant';
        continue;
      }

      // Linee di corpo
      if (mode === 'user' && currentTurn) {
        currentTurn.userLines.push(line);
      } else if (mode === 'assistant' && currentTurn) {
        currentTurn.assistantLines.push(line);
      } else {
        // Prima che inizi qualsiasi marcatore
        if (!currentTurn) {
          currentTurn = {
            turnIndex: 1,
            userLines: [],
            assistantLines: [line],
            headings: []
          };
          mode = 'assistant';
        } else {
          currentTurn.assistantLines.push(line);
        }
      }
    }

    if (currentTurn && (currentTurn.userLines.length || currentTurn.assistantLines.length)) {
      turns.push(currentTurn);
    }

    const hasTurns = turns.some(t => t.userLines.length > 0 && t.assistantLines.length > 0);
    return { turns, hasTurns, normalizedText: text };
  }

  /**
   * Estrae i titoli Markdown da un blocco di testo.
   */
  function extractHeadingsFromLines(lines, startLineOffset = 0) {
    const headings = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const m = line.match(/^(#{1,6})[ \t]+(.+)$/);
      if (m) {
        const level = m[1].length;
        const text = m[2].replace(/<[^>]+>/g, '').trim();
        headings.push({
          level,
          text,
          line: startLineOffset + i
        });
      }
    }
    return headings;
  }

  /**
   * Esegue l'indicizzazione ed applica le modifiche all'editor.
   */
  function applyIndexedChat() {
    const textarea = document.getElementById('chat-indexer-input');
    if (!textarea || !textarea.value.trim()) {
      alert('Incolla prima il testo della conversazione da indicizzare.');
      return;
    }

    const raw = textarea.value.trim();
    const formatTurns = document.getElementById('chat-opt-format-turns')?.checked ?? true;
    const tocMode = document.getElementById('chat-opt-toc-mode')?.value || 'panel';
    const targetMode = document.getElementById('chat-opt-target')?.value || 'replace';

    const { turns, hasTurns, normalizedText } = parseDialogue(raw);

    let outputMarkdown = '';
    const treeItems = [];
    let currentLineCursor = 0;

    if (hasTurns && formatTurns) {
      // Formatta la conversazione a turni
      turns.forEach((turn, idx) => {
        const userPrompt = turn.userLines.join('\n').trim();
        const assistantReply = turn.assistantLines.join('\n').trim();

        const turnTitle = userPrompt
          ? userPrompt.split('\n')[0].substring(0, 75).trim()
          : `Turno ${idx + 1}`;

        const turnItem = {
          type: 'turn',
          title: turnTitle,
          fullPrompt: userPrompt,
          index: idx + 1,
          line: currentLineCursor,
          children: []
        };

        // Blocco utente elegante (citazione con icona)
        const userBlock = `> 💬 **Utente (Turno ${idx + 1}):**\n> ${userPrompt.replace(/\n/g, '\n> ')}\n\n`;
        outputMarkdown += userBlock;
        currentLineCursor += userBlock.split('\n').length - 1;

        // Estrai titoli dalla risposta assistente
        const assistantLines = assistantReply.split('\n');
        const headings = extractHeadingsFromLines(assistantLines, currentLineCursor);
        headings.forEach(h => {
          turnItem.children.push({
            type: 'heading',
            title: h.text,
            level: h.level,
            line: h.line
          });
        });

        const replyBlock = assistantReply + '\n\n---\n\n';
        outputMarkdown += replyBlock;
        currentLineCursor += replyBlock.split('\n').length - 1;

        treeItems.push(turnItem);
      });
    } else {
      // Documento continuo senza turni espliciti: indicizza da tutti i titoli
      outputMarkdown = normalizedText;
      const allLines = normalizedText.split('\n');
      const headings = extractHeadingsFromLines(allLines, 0);

      if (headings.length > 0) {
        headings.forEach(h => {
          treeItems.push({
            type: 'heading',
            title: h.text,
            level: h.level,
            line: h.line,
            children: []
          });
        });
      } else {
        // Nessun titolo: crea nodi basati sui primi paragrafi
        let lineAcc = 0;
        allLines.forEach((l, idx) => {
          if (l.trim() && l.length > 10 && idx % 15 === 0) {
            treeItems.push({
              type: 'heading',
              title: l.substring(0, 60).trim() + '...',
              level: 2,
              line: idx,
              children: []
            });
          }
        });
      }
    }

    // Se l'utente ha richiesto TOC nel testo del documento
    if (tocMode === 'doc' || tocMode === 'both') {
      let tocText = '## 📑 Indice della Conversazione\n\n';
      treeItems.forEach(item => {
        if (item.type === 'turn') {
          tocText += `- **Turno ${item.index}:** ${item.title}\n`;
          if (item.children && item.children.length) {
            item.children.forEach(c => {
              const indent = '  '.repeat(Math.max(1, c.level - 1));
              tocText += `${indent}- ${c.title}\n`;
            });
          }
        } else {
          const indent = '  '.repeat(Math.max(0, item.level - 1));
          tocText += `${indent}- ${item.title}\n`;
        }
      });
      outputMarkdown = tocText + '\n---\n\n' + outputMarkdown;
    }

    // Applicazione all'editor
    applyTextToEditor(outputMarkdown, targetMode, treeItems[0]?.title || 'Conversazione Indicizzata');

    // Costruisci il pannello dell'indice
    _lastParsedTree = treeItems;
    renderTree(treeItems);

    // Apri il pannello se richiesto
    if (tocMode === 'panel' || tocMode === 'both') {
      togglePanel(true);
    }

    closeModal();
  }

  function applyTextToEditor(text, mode, suggestedTitle) {
    if (mode === 'new') {
      if (typeof createNote === 'function') {
        createNote(suggestedTitle, text);
        return;
      }
    }

    if (window.easyMDE) {
      if (mode === 'append') {
        const cur = window.easyMDE.value();
        window.easyMDE.value((cur ? cur + '\n\n' : '') + text);
      } else {
        window.easyMDE.value(text);
      }
      if (typeof updateStats === 'function') updateStats();
      if (typeof updatePreview === 'function') updatePreview();
    }
  }

  /**
   * Rigenera l'indice ad albero dal testo attualmente presente nell'editor.
   */
  function refreshFromEditor() {
    let content = '';
    if (window.easyMDE) {
      content = window.easyMDE.value();
    } else if (typeof getEditorContent === 'function') {
      content = getEditorContent();
    }
    if (!content) return;

    const { turns, hasTurns, normalizedText } = parseDialogue(content);
    const treeItems = [];

    if (hasTurns) {
      let lineCursor = 0;
      turns.forEach((turn, idx) => {
        const userPrompt = turn.userLines.join('\n').trim();
        const turnTitle = userPrompt ? userPrompt.split('\n')[0].substring(0, 75).trim() : `Turno ${idx + 1}`;
        const turnItem = {
          type: 'turn',
          title: turnTitle,
          index: idx + 1,
          line: lineCursor,
          children: []
        };
        lineCursor += (turn.userLines.length + 2);
        const headings = extractHeadingsFromLines(turn.assistantLines, lineCursor);
        headings.forEach(h => {
          turnItem.children.push({
            type: 'heading',
            title: h.text,
            level: h.level,
            line: h.line
          });
        });
        lineCursor += (turn.assistantLines.length + 3);
        treeItems.push(turnItem);
      });
    } else {
      const allLines = normalizedText.split('\n');
      const headings = extractHeadingsFromLines(allLines, 0);
      headings.forEach(h => {
        treeItems.push({
          type: 'heading',
          title: h.text,
          level: h.level,
          line: h.line,
          children: []
        });
      });
    }

    _lastParsedTree = treeItems;
    renderTree(treeItems);
  }

  /**
   * Renderizza l'albero di navigazione nel pannello laterale.
   */
  function renderTree(items) {
    const listEl = document.getElementById('chat-index-tree');
    const statsEl = document.getElementById('chat-index-stats');
    if (!listEl) return;

    if (!items || !items.length) {
      listEl.innerHTML = '<li style="padding:16px;font-size:11.5px;color:#888;text-align:center;">Nessun elemento indicizzato. Fai clic su "Indicizza Chat" o inserisci titoli Markdown.</li>';
      if (statsEl) statsEl.textContent = '0 elementi';
      return;
    }

    let totalElements = 0;
    let html = '';

    items.forEach(item => {
      totalElements++;
      if (item.type === 'turn') {
        html += `
          <li class="mp-tree-turn">
            <div class="mp-tree-turn-header" onclick="MiniPadChatIndexer.jumpToLine(${item.line}, '${escapeAttr(item.title)}')">
              <span class="mp-tree-badge">T${item.index}</span>
              <span class="mp-tree-turn-text">${escapeHtml(item.title)}</span>
            </div>
        `;
        if (item.children && item.children.length) {
          html += '<ul class="mp-tree-sublist">';
          item.children.forEach(child => {
            totalElements++;
            html += `
              <li class="mp-tree-item level-${Math.min(3, child.level)}" onclick="MiniPadChatIndexer.jumpToLine(${child.line}, '${escapeAttr(child.title)}')">
                <span style="opacity:0.6;">${'#'.repeat(child.level)}</span>
                <span>${escapeHtml(child.title)}</span>
              </li>
            `;
          });
          html += '</ul>';
        }
        html += '</li>';
      } else {
        html += `
          <li class="mp-tree-item level-${Math.min(3, item.level)}" onclick="MiniPadChatIndexer.jumpToLine(${item.line}, '${escapeAttr(item.title)}')">
            <span style="opacity:0.6;">${'#'.repeat(item.level)}</span>
            <span>${escapeHtml(item.title)}</span>
          </li>
        `;
      }
    });

    listEl.innerHTML = html;
    if (statsEl) {
      statsEl.innerHTML = `<span>Elementi: <strong>${totalElements}</strong></span><span>Aggiornato</span>`;
    }
  }

  /**
   * Salta alla riga specificata nell'editor e nell'anteprima.
   */
  function jumpToLine(lineNum, title) {
    if (window.easyMDE && window.easyMDE.codemirror) {
      const cm = window.easyMDE.codemirror;
      const targetLine = Math.max(0, Math.min(cm.lineCount() - 1, lineNum));
      cm.setCursor({ line: targetLine, ch: 0 });
      cm.scrollIntoView({ line: targetLine, ch: 0 }, 140);
      cm.focus();

      // Feedback visivo riga attiva
      try {
        const lineHandle = cm.addLineClass(targetLine, 'background', 'mp-highlight-flash');
        setTimeout(() => {
          cm.removeLineClass(lineHandle, 'background', 'mp-highlight-flash');
        }, 1600);
      } catch (e) { /* ignore */ }
    }

    // Scroll nell'anteprima live verso il titolo corrispondente
    const previewEl = document.getElementById('preview-content');
    if (previewEl && title) {
      const headings = previewEl.querySelectorAll('h1, h2, h3, h4, h5, h6, blockquote strong');
      for (const h of headings) {
        if (h.textContent.trim().toLowerCase().includes(title.toLowerCase().substring(0, 20))) {
          h.scrollIntoView({ behavior: 'smooth', block: 'center' });
          h.style.transition = 'outline 0.2s';
          h.style.outline = '2px solid #0067c0';
          setTimeout(() => { h.style.outline = 'none'; }, 1500);
          break;
        }
      }
    }
  }

  function copyTocMarkdown() {
    if (!_lastParsedTree || !_lastParsedTree.length) {
      alert('Nessun indice disponibile da copiare.');
      return;
    }
    let tocText = '## 📑 Indice Conversazione\n\n';
    _lastParsedTree.forEach(item => {
      if (item.type === 'turn') {
        tocText += `- **Turno ${item.index}:** ${item.title}\n`;
        if (item.children) {
          item.children.forEach(c => {
            const indent = '  '.repeat(Math.max(1, c.level - 1));
            tocText += `${indent}- ${c.title}\n`;
          });
        }
      } else {
        const indent = '  '.repeat(Math.max(0, item.level - 1));
        tocText += `${indent}- ${item.title}\n`;
      }
    });

    navigator.clipboard.writeText(tocText).then(() => {
      alert('Indice Markdown copiato negli appunti!');
    }).catch(() => {
      prompt('Copia manualmente l\'indice Markdown:', tocText);
    });
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeAttr(s) {
    return String(s || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }

  return {
    openModal,
    closeModal,
    togglePanel,
    parseDialogue,
    applyIndexedChat,
    refreshFromEditor,
    jumpToLine,
    copyTocMarkdown
  };
})();

// Bridge globali per pulsanti HTML inline
if (typeof window !== 'undefined') {
  window.openChatIndexerModal = function () {
    if (window.MiniPadChatIndexer) window.MiniPadChatIndexer.openModal();
  };
  window.closeChatIndexerModal = function () {
    if (window.MiniPadChatIndexer) window.MiniPadChatIndexer.closeModal();
  };
  window.toggleChatIndexPanel = function (force) {
    if (window.MiniPadChatIndexer) window.MiniPadChatIndexer.togglePanel(force);
  };
  window.applyIndexedChat = function () {
    if (window.MiniPadChatIndexer) window.MiniPadChatIndexer.applyIndexedChat();
  };
  window.refreshFromEditor = function () {
    if (window.MiniPadChatIndexer) window.MiniPadChatIndexer.refreshFromEditor();
  };
  window.copyTocMarkdown = function () {
    if (window.MiniPadChatIndexer) window.MiniPadChatIndexer.copyTocMarkdown();
  };
}
