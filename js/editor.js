// ===== EasyMDE Integration =====
let easyMDE = null;

function initEasyMDE(initialContent = '') {
    const editorContainer = document.getElementById('editor-container');
    if (!editorContainer) return;

    easyMDE = new EasyMDE({
        element: editorContainer,
        initialValue: initialContent,
        spellChecker: false,
        autosave: { enabled: false },
        toolbar: false,
        status: false,
        renderingConfig: {
            codeSyntaxHighlighting: true
        },
        previewRender: function(text) {
            return null; // We use our own preview pane
        },
        placeholder: getStr('placeholder')
    });

    // Listen for content changes
    easyMDE.codemirror.on('change', () => {
        const content = easyMDE.value();
        handleInput(content);
    });

    // Listen for scroll to sync with preview
    easyMDE.codemirror.on('scroll', syncScrollFromEditor);

    // Setup paste handler for LaTeX
    setupPasteHandler();
}

function getEditorContent() {
    return easyMDE ? easyMDE.value() : '';
}

function setEditorContent(content) {
    if (easyMDE) {
        easyMDE.value(content);
    }
}

// ===== Scroll Sync =====
function syncScrollFromEditor() {
    const previewDiv = document.getElementById('preview-pane');
    if (!previewDiv || !easyMDE) return;

    const scrollInfo = easyMDE.codemirror.getScrollInfo();
    const scrollPercentage = scrollInfo.top / Math.max(1, scrollInfo.height - scrollInfo.clientHeight);
    previewDiv.scrollTop = scrollPercentage * (previewDiv.scrollHeight - previewDiv.clientHeight);
}

// ===== Paste Handler for AI LaTeX =====
function setupPasteHandler() {
    if (!easyMDE) return;

    easyMDE.codemirror.on('paste', (cm, event) => {
        const clipboardData = event.clipboardData || window.clipboardData;
        let pastedText = clipboardData.getData('text/plain');

        // If no plain text, try HTML
        if (!pastedText) {
            const pastedHtml = clipboardData.getData('text/html');
            if (pastedHtml) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = pastedHtml;
                pastedText = tempDiv.textContent || tempDiv.innerText || '';
            }
        }

        if (!pastedText) return;

        // Clean up non-breaking spaces
        pastedText = pastedText.replace(/\u00A0/g, ' ');

        // Normalize AI LaTeX syntax
        // Replace \[ ... \] with $$ ... $$
        pastedText = pastedText.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');
        // Replace \( ... \) with $ ... $
        pastedText = pastedText.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');

        event.preventDefault();
        const doc = cm.getDoc();
        const cursor = doc.getCursor();
        doc.replaceRange(pastedText, cursor);
    });
}

// ===== Groups System =====
let groups = [];

function createGroup(name) {
    const newGroup = {
        id: 'group-' + Date.now(),
        name: name.trim() || 'Nuovo Gruppo',
        collapsed: false,
        createdAt: Date.now()
    };
    groups.push(newGroup);
    saveToStorage();
    renderSidebar();
}

function deleteGroup(groupId) {
    tabs.forEach(tab => {
        if (tab.groupId === groupId) tab.groupId = null;
    });
    groups = groups.filter(g => g.id !== groupId);
    saveToStorage();
    renderSidebar();
}

function renameGroup(groupId, newName) {
    const group = groups.find(g => g.id === groupId);
    if (group) {
        group.name = newName.trim();
        saveToStorage();
        renderSidebar();
    }
}

function toggleGroupCollapse(groupId) {
    const group = groups.find(g => g.id === groupId);
    if (group) {
        group.collapsed = !group.collapsed;
        saveToStorage();
        renderSidebar();
    }
}

function createGroupPrompt() {
    const name = prompt('Nome del nuovo gruppo:');
    if (name && name.trim()) {
        createGroup(name);
    }
    closeAllMenus();
}

function moveTabToGroup(tabId, groupId) {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
        tab.groupId = groupId || null;
        saveToStorage();
        renderSidebar();
    }
}

// ===== Note CRUD Operations =====
function newNote() {
    createNote(getStr('new_tab_name'), "");
    closeAllMenus();
}

function switchNote(id) {
    activeTabId = id;
    try {
        localStorage.setItem('minipad_active_tab', id);
    } catch(e) {}
    const tab = tabs.find(t => t.id === id);
    if (tab) {
        setEditorContent(tab.content);
        updatePreviewWithContent(tab.content);
    }
    renderSidebar();
    updateStats();
}

function deleteNote(e, id) {
    e.stopPropagation();
    if (tabs.length === 1) {
        if (!confirm(getStr('tab_close_confirm'))) return;
        tabs[0].content = "";
        tabs[0].name = getStr('tab_untitled');
        tabs[0].isTitleManual = false;
        switchNote(tabs[0].id);
        return;
    }
    if (!confirm("Eliminare definitivamente questa nota?")) return;
    tabs = tabs.filter(t => t.id !== id);
    saveToStorage();
    if (activeTabId === id) switchNote(tabs[tabs.length - 1].id);
    else renderSidebar();
}

async function createNote(name, content) {
    const id = Date.now().toString();
    const dateStr = new Date().toLocaleString(currentLang === 'it' ? 'it-IT' : 'en-US', { 
        day: '2-digit', 
        month: 'short', 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    tabs.push({ 
        id, 
        name, 
        content, 
        groupId: null,
        isTitleManual: false,
        updatedAt: dateStr 
    });
    await saveToStorage();
    switchNote(id);
}

// ===== Title Management =====
function updateTabTitleFromContent(tab) {
    if (tab.isTitleManual) return; // Don't overwrite manual titles

    const lines = tab.content.trim().split('\n');
    let newTitle = '';
    
    // Check for markdown headings
    if (lines[0].startsWith('# ')) {
        newTitle = lines[0].substring(2).trim();
    } else if (lines[0].startsWith('## ')) {
        newTitle = lines[0].substring(3).trim();
    } else {
        // Use first line or fallback
        newTitle = lines[0].trim().substring(0, 30) || 'Nuova Nota';
    }
    
    tab.name = newTitle.substring(0, 30);
}

function renameTab(tabId) {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    const newName = prompt('Nuovo titolo:', tab.name);
    if (newName && newName.trim()) {
        tab.name = newName.trim().substring(0, 30);
        tab.isTitleManual = true;
        saveToStorage();
        renderSidebar();
    }
}

function resetTabTitle(tabId) {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    tab.isTitleManual = false;
    updateTabTitleFromContent(tab);
    saveToStorage();
    renderSidebar();
}

// ===== Sidebar Rendering with Groups =====
function renderSidebar() {
    const list = document.getElementById('tabs-list');
    const searchEl = document.getElementById('sidebar-search');
    const query = searchEl ? searchEl.value.toLowerCase() : '';
    if (!list) return;
    list.innerHTML = '';

    // Create uncategorized group
    const uncategorizedGroup = { 
        id: null, 
        name: 'Senza Gruppo', 
        collapsed: false 
    };
    
    // Combine all groups
    const allGroups = [uncategorizedGroup, ...groups];

    allGroups.forEach(group => {
        // Filter tabs for this group
        const groupTabs = tabs.filter(t => {
            if (group.id === null) return !t.groupId;
            return t.groupId === group.id;
        });

        // Apply search filter
        const filteredTabs = groupTabs.filter(tab => {
            if (!query) return true;
            return tab.name.toLowerCase().includes(query) || 
                   tab.content.toLowerCase().includes(query);
        });

        // Skip empty groups when searching
        if (query && filteredTabs.length === 0) return;

        // Group header
        const groupHeader = document.createElement('div');
        groupHeader.className = 'sidebar-group-header';
        
        const isUncategorized = group.id === null;
        const collapseIcon = isUncategorized ? '' : (group.collapsed ? '▶' : '▼');
        
        groupHeader.innerHTML = `
            <span class="group-toggle">${collapseIcon}</span>
            <span class="group-name">${escapeHtml(group.name)}</span>
            ${!isUncategorized ? `
                <span class="group-actions">
                    <button class="group-btn" title="Rinomina">✏️</button>
                    <button class="group-btn" title="Elimina">🗑️</button>
                </span>
            ` : ''}
        `;

        // Toggle collapse
        const toggleBtn = groupHeader.querySelector('.group-toggle');
        if (toggleBtn && !isUncategorized) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleGroupCollapse(group.id);
            });
        }

        // Group action buttons
        const actionBtns = groupHeader.querySelectorAll('.group-btn');
        if (!isUncategorized) {
            actionBtns[0]?.addEventListener('click', (e) => {
                e.stopPropagation();
                const newName = prompt('Nuovo nome gruppo:', group.name);
                if (newName) renameGroup(group.id, newName);
            });
            actionBtns[1]?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Eliminare il gruppo? Le schede saranno spostate in "Senza Gruppo".')) {
                    deleteGroup(group.id);
                }
            });
        }

        list.appendChild(groupHeader);

        // Render tabs if not collapsed
        const isCollapsed = isUncategorized ? false : group.collapsed;
        if (!isCollapsed) {
            // Sort by most recent first
            filteredTabs.sort((a, b) => b.updatedAt - a.updatedAt);

            filteredTabs.forEach(tab => {
                const tabElement = createTabElement(tab);
                list.appendChild(tabElement);
            });
        }
    });
}

function createTabElement(tab) {
    const div = document.createElement('div');
    div.className = `sidebar-item ${tab.id === activeTabId ? 'active' : ''}`;
    div.onclick = () => switchNote(tab.id);

    const leftDiv = document.createElement('div');
    leftDiv.style.display = 'flex';
    leftDiv.style.flexDirection = 'column';
    leftDiv.style.flex = '1';
    leftDiv.style.overflow = 'hidden';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = tab.name;
    nameSpan.style.whiteSpace = 'nowrap';
    nameSpan.style.overflow = 'hidden';
    nameSpan.style.textOverflow = 'ellipsis';
    nameSpan.title = 'Doppio click per rinominare';
    nameSpan.ondblclick = (e) => {
        e.stopPropagation();
        renameTab(tab.id);
    };

    // Add indicator for manual title
    if (tab.isTitleManual) {
        nameSpan.style.fontWeight = 'bold';
    }

    const dateSpan = document.createElement('span');
    dateSpan.className = 'sidebar-item-date';
    dateSpan.textContent = tab.updatedAt || 'Ora';

    leftDiv.appendChild(nameSpan);
    leftDiv.appendChild(dateSpan);

    const closeBtn = document.createElement('div');
    closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    closeBtn.style.opacity = '0.5';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.marginLeft = '8px';
    closeBtn.onmouseenter = () => closeBtn.style.color = '#e81123';
    closeBtn.onmouseleave = () => closeBtn.style.color = '';
    closeBtn.onclick = (e) => deleteNote(e, tab.id);

    // Right-click context menu for moving to group
    div.oncontextmenu = (e) => {
        e.preventDefault();
        showTabContextMenu(e, tab.id);
    };

    div.appendChild(leftDiv);
    div.appendChild(closeBtn);
    
    return div;
}

function showTabContextMenu(e, tabId) {
    // Simple prompt for now
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    const groupOptions = groups.map(g => `${g.name} (ID: ${g.id})`).join('\n');
    const message = `Sposta "${tab.name}" in un gruppo:\n\n${groupOptions}\n\nInserisci l'ID del gruppo (lascia vuoto per "Senza Gruppo"):`;
    const newGroupId = prompt(message, tab.groupId || '');
    
    if (newGroupId !== null) {
        moveTabToGroup(tabId, newGroupId || null);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== Input Handler =====
function handleInput(content) {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab) {
        tab.content = content;
        updateTabTitleFromContent(tab);
        tab.updatedAt = new Date().toLocaleString(currentLang === 'it' ? 'it-IT' : 'en-US', { 
            day: '2-digit', 
            month: 'short', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => { 
        saveToStorage(); 
        showSavedIndicator(); 
    }, 1000);

    clearTimeout(previewTimeout);
    previewTimeout = setTimeout(() => { 
        updatePreview(); 
    }, 300);

    updateStats();
}

// ===== Storage Functions =====
function saveToStorage() {
    try {
        idbKeyval.set('minipad_tabs', tabs);
        idbKeyval.set('minipad_groups', groups);
    } catch (e) {
        console.error("Save failed", e);
    }
}

function loadFromStorage() {
    return new Promise(async (resolve) => {
        try {
            const savedTabs = await idbKeyval.get('minipad_tabs');
            const savedGroups = await idbKeyval.get('minipad_groups');

            if (savedTabs && Array.isArray(savedTabs) && savedTabs.length > 0) {
                tabs = savedTabs;
            } else {
                // Fallback to localStorage
                const legacyData = localStorage.getItem('minipad_tabs');
                if (legacyData) {
                    tabs = JSON.parse(legacyData);
                }
            }

            if (savedGroups && Array.isArray(savedGroups)) {
                groups = savedGroups;
            }

            // Migration: ensure all tabs have required fields
            tabs.forEach(tab => {
                if (tab.isTitleManual === undefined) tab.isTitleManual = false;
                if (tab.groupId === undefined) tab.groupId = null;
            });

            resolve();
        } catch (e) {
            console.error("Load failed", e);
            resolve();
        }
    });
}

// ===== View Mode Toggling =====
function toggleView(mode) {
    const eP = document.getElementById('editor-pane');
    const pP = document.getElementById('preview-pane');
    
    if (mode === 'split') {
        eP.classList.remove('hidden'); 
        pP.classList.remove('hidden');
        eP.style.width = '50%'; 
        pP.style.width = '50%';
    } else if (mode === 'editor') {
        eP.classList.remove('hidden'); 
        pP.classList.add('hidden');
        eP.style.width = '100%';
        // Refresh EasyMDE
        if (easyMDE) {
            setTimeout(() => easyMDE.codemirror.refresh(), 100);
        }
    } else if (mode === 'preview') {
        eP.classList.add('hidden'); 
        pP.classList.remove('hidden');
        pP.style.width = '100%';
    }
    
    // Highlight the active view button
    ['view-editor-btn', 'view-split-btn', 'view-preview-btn'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.style.background = '';
    });
    const activeId = `view-${mode}-btn`;
    const activeBtn = document.getElementById(activeId);
    if (activeBtn) activeBtn.style.background = 'var(--hover-color)';
}

// ===== Theme Functions =====
const baseThemes = ['', 'sepia', 'hacker'];

function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    try { 
        localStorage.setItem('minipad_dark_mode', isDark); 
    } catch (e) { }
    showToast(`Modalità: ${isDark ? 'Scura' : 'Chiara'}`);
    
    // Update EasyMDE theme
    if (easyMDE) {
        const wrapper = easyMDE.wrapper;
        if (wrapper) {
            wrapper.classList.toggle('dark-mode', isDark);
        }
    }
}

function cycleTheme() {
    let current = document.body.getAttribute('data-theme') || '';
    let nextIndex = (baseThemes.indexOf(current) + 1) % baseThemes.length;
    let nextTheme = baseThemes[nextIndex];
    document.body.setAttribute('data-theme', nextTheme);
    try { 
        localStorage.setItem('minipad_theme', nextTheme); 
    } catch (e) { }
    showToast(`Tema: ${nextTheme === '' ? 'Default' : nextTheme.charAt(0).toUpperCase() + nextTheme.slice(1)}`);
}

function showToast(msg) {
    const el = document.getElementById('save-indicator');
    const original = el.getAttribute('data-original') || 'Salvato';
    if (!el.hasAttribute('data-original')) el.setAttribute('data-original', original);
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.textContent = original, 300);
    }, 1500);
}

// ===== Link and HR Insertion =====
function insertLink() {
    if (!easyMDE) return;
    const selected = easyMDE.valueSelection();
    const linkText = selected || 'Testo del link';
    const url = prompt('URL del link:', 'https://');
    if (!url) return;
    
    const md = `[${linkText}](${url})`;
    easyMDE.codemirror.replaceSelection(md);
    easyMDE.codemirror.focus();
}

function insertHR() {
    if (!easyMDE) return;
    easyMDE.codemirror.replaceSelection('\n---\n');
    easyMDE.codemirror.focus();
}

// ===== Zen Mode =====
function toggleZenMode() {
    const isZen = document.body.classList.toggle('zen-mode');
    if (isZen) {
        document.documentElement.requestFullscreen().catch(() => { });
    } else {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => { });
        }
    }
}

document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) {
        document.body.classList.remove('zen-mode');
    }
});

// ===== Help Modal =====
function openHelp() {
    const m = document.getElementById('help-modal');
    m.style.display = 'flex';
    m.style.zIndex = '3001';
}

function closeHelp() { 
    document.getElementById('help-modal').style.display = 'none'; 
}

// ===== Keyboard Shortcuts =====
function handleShortcuts(e) {
    // Ctrl+S: Save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { 
        e.preventDefault(); 
        saveNow(); 
        return; 
    }

    // Ctrl+B: Bold
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') { 
        e.preventDefault(); 
        if (easyMDE) easyMDE.toggleBold(); 
        return; 
    }

    // Ctrl+I: Italic
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') { 
        e.preventDefault(); 
        if (easyMDE) easyMDE.toggleItalic(); 
        return; 
    }

    // Ctrl+K: Insert link
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        insertLink();
        return;
    }

    // ESC: Exit Zen Mode only
    if (e.key === 'Escape') {
        if (document.body.classList.contains('zen-mode')) {
            e.preventDefault();
            document.body.classList.remove('zen-mode');
        }
        return;
    }
}

// ===== Utility Functions =====
function toggleFullScreen() { 
    !document.fullscreenElement ? 
        document.documentElement.requestFullscreen() : 
        document.exitFullscreen(); 
}

function showSavedIndicator() {
    const el = document.getElementById('save-indicator');
    if (!el) return;
    el.style.opacity = '1';
    clearTimeout(window.saveIndicatorTimeout);
    window.saveIndicatorTimeout = setTimeout(() => el.style.opacity = '0', 2000);
}

function saveNow() { 
    saveToStorage(); 
    showSavedIndicator(); 
}

function clearEditor() {
    if (confirm("Sei sicuro di voler svuotare l'editor?")) {
        if (easyMDE) {
            easyMDE.value('');
            handleInput('');
        }
    }
}

// ===== Import/Export Functions =====
function importFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        const name = file.name.replace(/\.[^/.]+$/, "");
        createNote(name, text);
    };
    reader.readAsText(file);
    event.target.value = '';
    closeAllMenus();
}

function exportBackup() {
    const dataStr = JSON.stringify(tabs, null, 2);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadFile(`minipad_backup_${dateStr}.json`, dataStr, "application/json");
    closeAllMenus();
}

async function importBackup(e) {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
        const importedTabs = JSON.parse(text);
        if (Array.isArray(importedTabs) && importedTabs.length > 0) {
            if (confirm("Questo unirà le note salvate in questo browser con quelle del backup. Continuare?")) {
                importedTabs.forEach(t => {
                    const existing = tabs.find(localTab => localTab.id === t.id);
                    if (existing) {
                        if (existing.content !== t.content) {
                            const timestamp = Date.now();
                            t.id = t.id + "_imported_" + timestamp;
                            t.name = t.name + " (Backup " + new Date().toLocaleDateString() + ")";
                            tabs.push(t);
                        }
                    } else {
                        tabs.push(t);
                    }
                });
                await saveToStorage();
                renderSidebar();
                alert("Backup importato con successo!");
            }
        } else {
            alert("File di backup non valido o vuoto.");
        }
    } catch (err) {
        alert("Errore nella lettura del file JSON di backup.");
    }
    e.target.value = '';
    closeAllMenus();
}

function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function promptExport(type) {
    const t = tabs.find(x => x.id === activeTabId);
    if (!t) return;
    const name = prompt("Inserisci il nome del file:", t.name || "documento");
    if (!name) return;

    if (type === 'md') downloadFile(name + ".md", t.content, "text/markdown");
    if (type === 'txt') downloadFile(name + ".txt", t.content, "text/plain");
    if (type === 'tex') {
        const texStr = t.content
            .replace(/^# (.+)$/gm, '\\section{$1}')
            .replace(/^## (.+)$/gm, '\\subsection{$1}')
            .replace(/^### (.+)$/gm, '\\subsubsection{$1}')
            .replace(/\*\*(.+?)\*\*/g, '\\textbf{$1}')
            .replace(/\*(.+?)\*/g, '\\textit{$1}')
            .replace(/`(.+?)`/g, '\\texttt{$1}')
            .replace(/\$\$(.+?)\$\$/gs, '\\[\n$1\n\\]')
            .replace(/\$(.+?)\$/g, '$$$1$$');
        const fullTex = `\\documentclass{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amsmath, amssymb}\n\\begin{document}\n\n${texStr}\n\n\\end{document}`;
        downloadFile(name + ".tex", fullTex, "text/plain");
    }
    if (type === 'html') {
        const c = document.getElementById('preview-content').innerHTML;
        const html = `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <title>${name}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex/dist/katex.min.css">
    <style>
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            background: #fff;
        }
        h1, h2, h3 { border-bottom: 1px solid #eee; padding-bottom: 10px; }
        code { background: #f4f4f4; padding: 2px 4px; border-radius: 4px; font-family: monospace; }
        pre { background: #f8f8f8; padding: 15px; border-radius: 8px; overflow-x: auto; border: 1px solid #ddd; }
        blockquote { border-left: 4px solid #0067c0; margin: 0; padding-left: 15px; color: #555; }
        img { max-width: 100%; border-radius: 4px; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
${c}
</body>
</html>`;
        downloadFile(name + ".html", html, "text/html");
    }
    if (type === 'pdf') window.print();
}

function exportHTML() { promptExport('html'); closeAllMenus(); }
function exportMarkdown() { promptExport('md'); closeAllMenus(); }
function exportTXT() { promptExport('txt'); closeAllMenus(); }
function exportTeX() { promptExport('tex'); closeAllMenus(); }

// ===== Markdown Insertion =====
function insertMarkdown(start, end) {
    if (!easyMDE) return;
    const doc = easyMDE.codemirror.getDoc();
    const selection = doc.getSelection();
    doc.replaceSelection(start + selection + end);
    
    if (!selection) {
        const cursor = doc.getCursor();
        doc.setCursor({ line: cursor.line, ch: cursor.ch - end.length });
    }
    easyMDE.codemirror.focus();
}

function insertColor(prop, color) {
    if (!easyMDE) return;
    const selection = easyMDE.valueSelection() || "Testo";
    const insertText = `<span style="${prop}:${color}">` + selection + `</span>`;
    easyMDE.codemirror.replaceSelection(insertText);
    easyMDE.codemirror.focus();
}

function applyStyle(styleStart, styleEnd) {
    insertMarkdown(styleStart, styleEnd);
}

function changeFont() {
    const font = document.getElementById('font-family').value;
    applyStyle(`<span style="font-family:${font}">`, `</span>`);
}

function changeFontSize() {
    const size = document.getElementById('font-size').value;
    applyStyle(`<span style="font-size:${size}px">`, `</span>`);
}

function applyHeading(level) {
    if (!easyMDE) return;
    const doc = easyMDE.codemirror.getDoc();
    const cursor = doc.getCursor();
    const line = doc.getLine(cursor.line);
    const cleanLine = line.replace(/^#+\s*/, '');
    const prefix = level > 0 ? '#'.repeat(level) + ' ' : '';
    const newLine = prefix + cleanLine;
    doc.replaceRange(newLine, { line: cursor.line, ch: 0 }, { line: cursor.line, ch: line.length });
    easyMDE.codemirror.focus();
}

function applyList(prefix) {
    if (!easyMDE) return;
    const doc = easyMDE.codemirror.getDoc();
    const selection = doc.getSelection();
    
    if (selection) {
        const lines = selection.split('\n');
        const isOrdered = /^\d+\./.test(prefix);
        const newLines = lines.map((l, i) => {
            const clean = l.replace(/^(\s*)([-*]\s|\d+\.\s|\[\s?[xX]?\]\s)/, '');
            return isOrdered ? `${i + 1}. ${clean}` : prefix + clean;
        });
        doc.replaceSelection(newLines.join('\n'));
    } else {
        const cursor = doc.getCursor();
        doc.replaceRange(prefix, cursor);
    }
    easyMDE.codemirror.focus();
}

function insertDiagramAtCursor(code) {
    if (!easyMDE) return;
    easyMDE.codemirror.replaceSelection('\n' + code + '\n');
    easyMDE.codemirror.focus();
}

function insertFormulaBlock() {
    if (!easyMDE) return;
    easyMDE.codemirror.replaceSelection('\n$$\n\n$$\n');
    easyMDE.codemirror.focus();
}

function insertLatex(code) {
    if (!easyMDE) return;
    const doc = easyMDE.codemirror.getDoc();
    const cursor = doc.getCursor();
    
    let cursorPos = cursor.ch + code.length;
    if (code.includes('\\frac{a}{b}') || code.includes('\\dfrac{a}{b}')) {
        cursorPos = cursor.ch + code.indexOf('{a}') + 1;
    } else if (code.includes('\\sqrt{x}')) {
        cursorPos = cursor.ch + code.indexOf('{x}') + 1;
    } else if (code.includes('\\binom{n}{k}')) {
        cursorPos = cursor.ch + code.indexOf('{n}') + 1;
    }
    
    doc.replaceRange(code, cursor);
    
    if (cursorPos !== cursor.ch + code.length) {
        doc.setCursor({ line: cursor.line, ch: cursorPos });
    }
    easyMDE.codemirror.focus();
}

// ===== Sidebar Toggle =====
let sidebarVisible = false;

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebarVisible = !sidebarVisible;
    if (sidebarVisible) {
        sidebar.classList.remove('collapsed');
    } else {
        sidebar.classList.add('collapsed');
    }
}

// ===== Stats Update =====
function updateStats() {
    const content = getEditorContent();
    if (!content) return;
    
    const chars = content.length;
    const words = content.split(/\s+/).filter(w => w).length;
    const lines = content.split('\n').length;
    const pages = Math.max(1, Math.ceil(words / 500));
    const sLeft = document.getElementById('status-left');
    if (sLeft) sLeft.textContent = `Caratteri: ${chars.toLocaleString('it')} | Parole: ${words.toLocaleString('it')} | Righe: ${lines} | ~${pages} pag.`;
}
