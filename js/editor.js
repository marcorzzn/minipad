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

    window.easyMDE = easyMDE;
    window.insertDiagramAtCursor = function(text) {
        if (easyMDE && easyMDE.codemirror) {
            easyMDE.codemirror.replaceSelection(text);
            easyMDE.codemirror.focus();
        }
    };

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
let _scrollSyncRAF = null;
let _previewPaneEl = null;

function syncScrollFromEditor() {
    if (_scrollSyncRAF) return;
    _scrollSyncRAF = requestAnimationFrame(() => {
        _scrollSyncRAF = null;
        if (!_previewPaneEl) _previewPaneEl = document.getElementById('preview-pane');
        if (!_previewPaneEl || !easyMDE) return;

        const scrollInfo = easyMDE.codemirror.getScrollInfo();
        const maxEditorScroll = scrollInfo.height - scrollInfo.clientHeight;
        if (maxEditorScroll <= 0) return;

        const ratio = scrollInfo.top / maxEditorScroll;
        const maxPreviewScroll = _previewPaneEl.scrollHeight - _previewPaneEl.clientHeight;
        _previewPaneEl.scrollTop = ratio * maxPreviewScroll;
    });
}



// ===== Paste Handler for AI LaTeX =====
function setupPasteHandler() {
    if (!easyMDE) return;
    const cm = easyMDE.codemirror;
    cm.getWrapperElement().addEventListener('paste', (event) => {
        if (typeof MiniPadSmartPaste !== 'undefined') {
            if (MiniPadSmartPaste.handlePaste(event, cm)) {
                updateStats();
                updatePreview();
            }
        }
    }, true);
}

// ===== Groups System =====
// Nota: 'groups' è dichiarato in main.js come variabile globale

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
    const name = prompt(getStr('new_group_prompt'));
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
        // Refresh CodeMirror after content change to recalculate scroll bounds
        if (easyMDE) {
            setTimeout(() => easyMDE.codemirror.refresh(), 50);
        }
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
    if (!confirm(getStr('delete_tab_confirm'))) return;
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
        newTitle = lines[0].trim().substring(0, 30) || getStr('new_tab_name');
    }
    
    tab.name = newTitle.substring(0, 30);
}

function renameTab(tabId) {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    const newName = prompt(getStr('rename_tab_prompt'), tab.name);
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
        name: getStr('uncategorized_group'), 
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
        
        let headerDragEvents = '';
        if (group.id !== null) {
            headerDragEvents = `
                ondragover="event.preventDefault(); this.classList.add('drag-over');"
                ondragleave="this.classList.remove('drag-over');"
                ondrop="event.preventDefault(); this.classList.remove('drag-over'); moveTabToGroup(event.dataTransfer.getData('text/plain'), '${group.id}');"
            `;
        } else {
            headerDragEvents = `
                ondragover="event.preventDefault(); this.classList.add('drag-over');"
                ondragleave="this.classList.remove('drag-over');"
                ondrop="event.preventDefault(); this.classList.remove('drag-over'); moveTabToGroup(event.dataTransfer.getData('text/plain'), null);"
            `;
        }

        const isUncategorized = group.id === null;
        const collapseIcon = isUncategorized ? '' : (group.collapsed ? '▶' : '▼');
        
        groupHeader.innerHTML = `
            <div style="display:flex; width:100%; align-items:center;" ${headerDragEvents}>
                <span class="group-toggle">${collapseIcon}</span>
                <span class="group-name">${escapeHtml(group.name)}</span>
                ${!isUncategorized ? `
                    <span class="group-actions">
                        <button class="group-btn" title="Rinomina">✏️</button>
                        <button class="group-btn" title="Elimina">🗑️</button>
                    </span>
                ` : ''}
            </div>
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
                const newName = prompt(getStr('rename_group_prompt'), group.name);
                if (newName) renameGroup(group.id, newName);
            });
            actionBtns[1]?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(getStr('delete_group_confirm'))) {
                    deleteGroup(group.id);
                }
            });
        }

        list.appendChild(groupHeader);

        // Render tabs if not collapsed
        const isCollapsed = isUncategorized ? false : group.collapsed;
        if (!isCollapsed) {
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
    div.draggable = true;
    div.onclick = () => switchNote(tab.id);

    // Drag events for reordering
    div.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', tab.id);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => div.classList.add('dragging'), 0);
    });

    div.addEventListener('dragend', () => {
        div.classList.remove('dragging');
        document.querySelectorAll('.sidebar-item').forEach(el => {
            el.classList.remove('drag-over-above', 'drag-over-below');
        });
    });

    div.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = div.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
            div.classList.add('drag-over-above');
            div.classList.remove('drag-over-below');
        } else {
            div.classList.add('drag-over-below');
            div.classList.remove('drag-over-above');
        }
    });

    div.addEventListener('dragleave', () => {
        div.classList.remove('drag-over-above', 'drag-over-below');
    });

    div.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation(); // prevent group header from catching it
        div.classList.remove('drag-over-above', 'drag-over-below');
        
        const draggedId = e.dataTransfer.getData('text/plain');
        if (draggedId === tab.id) return;
        
        const rect = div.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const insertAfter = e.clientY >= midY;

        reorderTab(draggedId, tab.id, insertAfter, tab.groupId);
    });

    const leftDiv = document.createElement('div');
    leftDiv.style.display = 'flex';
    leftDiv.style.flexDirection = 'column';
    leftDiv.style.flex = '1';
    leftDiv.style.overflow = 'hidden';
    leftDiv.style.pointerEvents = 'none'; // so drag events hit the parent

    const nameSpan = document.createElement('span');
    nameSpan.textContent = tab.name;
    nameSpan.style.whiteSpace = 'nowrap';
    nameSpan.style.overflow = 'hidden';
    nameSpan.style.textOverflow = 'ellipsis';
    nameSpan.title = 'Doppio click per rinominare';
    nameSpan.style.pointerEvents = 'auto';
    nameSpan.ondblclick = (e) => {
        e.stopPropagation();
        renameTab(tab.id);
    };

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

    div.oncontextmenu = (e) => {
        e.preventDefault();
        showTabContextMenu(e, tab.id, tab.name);
    };

    div.appendChild(leftDiv);
    div.appendChild(closeBtn);
    
    return div;
}

function reorderTab(draggedId, targetId, insertAfter, targetGroupId) {
    const draggedIndex = tabs.findIndex(t => t.id === draggedId);
    let targetIndex = tabs.findIndex(t => t.id === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    const [draggedTab] = tabs.splice(draggedIndex, 1);
    
    // Update target index if it shifted during splice
    targetIndex = tabs.findIndex(t => t.id === targetId);
    
    draggedTab.groupId = targetGroupId;
    
    if (insertAfter) {
        tabs.splice(targetIndex + 1, 0, draggedTab);
    } else {
        tabs.splice(targetIndex, 0, draggedTab);
    }
    
    saveToStorage();
    renderSidebar();
}

let contextMenuEl = null;

function hideTabContextMenu() {
    if (contextMenuEl) {
        contextMenuEl.style.display = 'none';
    }
}

document.addEventListener('click', hideTabContextMenu);

function showTabContextMenu(e, tabId, tabName) {
    if (!contextMenuEl) {
        contextMenuEl = document.createElement('div');
        contextMenuEl.id = 'custom-context-menu';
        document.body.appendChild(contextMenuEl);
    }
    
    const groupOptions = groups.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');
    
    contextMenuEl.innerHTML = `
        <div class="context-menu-item" id="ctx-rename">✏️ Rinomina</div>
        <div class="context-menu-item" onclick="event.stopPropagation()">
            📁 Sposta in: 
            <select id="ctx-group-select" style="margin-left:5px; max-width:80px; font-size:12px;">
                <option value="">(Senza Gruppo)</option>
                ${groupOptions}
            </select>
        </div>
        <div class="context-menu-item danger" id="ctx-delete">🗑️ Elimina</div>
    `;
    
    contextMenuEl.style.left = `${e.pageX}px`;
    contextMenuEl.style.top = `${e.pageY}px`;
    contextMenuEl.style.display = 'block';
    
    document.getElementById('ctx-rename').onclick = () => {
        hideTabContextMenu();
        renameTab(tabId);
    };
    
    const groupSelect = document.getElementById('ctx-group-select');
    groupSelect.onchange = (e) => {
        hideTabContextMenu();
        moveTabToGroup(tabId, e.target.value || null);
    };
    
    document.getElementById('ctx-delete').onclick = (ev) => {
        hideTabContextMenu();
        deleteNote(ev, tabId);
    };
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== Input Handler =====
let _statsTimeout = null;

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

    // Live preview a 60 FPS con debounce rapido (60ms)
    if (typeof MiniPadPreview !== 'undefined') {
        MiniPadPreview.updatePreviewDebounced(content, 60);
    } else {
        clearTimeout(previewTimeout);
        previewTimeout = setTimeout(() => { 
            updatePreview(); 
        }, 60);
    }

    // Debounce stats update
    clearTimeout(_statsTimeout);
    _statsTimeout = setTimeout(updateStats, 200);
}

// ===== Storage Functions =====
async function saveToStorage() {
    if (typeof idbKeyval !== 'undefined' && idbKeyval.set) {
        try {
            await idbKeyval.set('minipad_tabs', tabs);
        } catch (e) {
            console.warn("tabs: fallback localStorage", e);
            try { localStorage.setItem('minipad_tabs', JSON.stringify(tabs)); } catch (e2) {}
        }
        try {
            await idbKeyval.set('minipad_groups', groups);
        } catch (e) {
            console.warn("groups: fallback localStorage", e);
            try { localStorage.setItem('minipad_groups', JSON.stringify(groups)); } catch (e2) {}
        }
    } else {
        try {
            localStorage.setItem('minipad_tabs', JSON.stringify(tabs));
            localStorage.setItem('minipad_groups', JSON.stringify(groups));
        } catch (e) {
            console.error("Salvataggio localStorage fallito", e);
        }
    }
}

async function loadFromStorage() {
    try {
        let savedTabs = null;
        let savedGroups = null;
        if (typeof idbKeyval !== 'undefined' && idbKeyval.get) {
            savedTabs = await idbKeyval.get('minipad_tabs');
            savedGroups = await idbKeyval.get('minipad_groups');
        }

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
        } else {
            const legacyGroups = localStorage.getItem('minipad_groups');
            if (legacyGroups) {
                groups = JSON.parse(legacyGroups);
            }
        }

        // Migration: ensure all tabs have required fields
        tabs.forEach(tab => {
            if (tab.isTitleManual === undefined) tab.isTitleManual = false;
            if (tab.groupId === undefined) tab.groupId = null;
        });
    } catch (e) {
        console.error("Load failed", e);
    }
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
    } else if (mode === 'preview') {
        eP.classList.add('hidden'); 
        pP.classList.remove('hidden');
        pP.style.width = '100%';
    }
    
    // Refresh CodeMirror after layout change to recalculate dimensions
    if (easyMDE && mode !== 'preview') {
        setTimeout(() => easyMDE.codemirror.refresh(), 100);
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
    const selected = easyMDE.codemirror.getSelection();
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
    if (confirm(getStr('clear_editor_confirm'))) {
        if (easyMDE) {
            easyMDE.value('');
            handleInput('');
        }
    }
}

// ===== Import/Export Functions =====
function getCurrentTabName() {
    const t = tabs.find(x => x.id === activeTabId);
    return (t && t.name) ? t.name : 'documento';
}

function promptExportName() {
    const defaultName = getCurrentTabName();
    const name = prompt("Inserisci il nome del file:", defaultName);
    return name ? name.trim() : null;
}

function exportHTML() {
    const name = promptExportName();
    if (!name) return;
    if (typeof MiniPadExport !== 'undefined') {
        MiniPadExport.exportHTML(getEditorContent(), name);
    } else {
        promptExport('html');
    }
    closeAllMenus();
}

function exportMarkdown() {
    const name = promptExportName();
    if (!name) return;
    if (typeof MiniPadExport !== 'undefined') {
        MiniPadExport.exportMarkdown(getEditorContent(), name);
    } else {
        promptExport('md');
    }
    closeAllMenus();
}

function exportTXT() {
    const name = promptExportName();
    if (!name) return;
    if (typeof MiniPadExport !== 'undefined') {
        MiniPadExport.exportTxt(getEditorContent(), name);
    } else {
        promptExport('txt');
    }
    closeAllMenus();
}

function exportTeX() {
    const name = promptExportName();
    if (!name) return;
    if (typeof MiniPadExport !== 'undefined') {
        MiniPadExport.exportLaTeX(getEditorContent(), name);
    } else {
        promptExport('tex');
    }
    closeAllMenus();
}

function printDoc() {
    if (typeof MiniPadExport !== 'undefined') {
        MiniPadExport.printDocument(getEditorContent(), getCurrentTabName());
    } else {
        window.print();
    }
    closeAllMenus();
}

function exportPDF() {
    const name = promptExportName();
    if (!name) return;
    if (typeof MiniPadExport !== 'undefined') {
        MiniPadExport.exportPDF(getEditorContent(), name);
    } else {
        window.print();
    }
    closeAllMenus();
}
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
    const selection = easyMDE.codemirror.getSelection();
    if (selection && selection.includes('\n')) {
        alert("Impossibile applicare colore a selezioni multi-riga (romperebbe la formattazione). Seleziona una singola riga o parola.");
        return;
    }
    const textToWrap = selection || "Testo";
    const insertText = `<span style="${prop}:${color}">` + textToWrap + `</span>`;
    easyMDE.codemirror.replaceSelection(insertText);
    easyMDE.codemirror.focus();
}

function applyStyle(styleStart, styleEnd) {
    if (!easyMDE) return;
    const selection = easyMDE.codemirror.getSelection();
    if (selection && selection.includes('\n')) {
        alert("Impossibile applicare stile inline a più righe.");
        return;
    }
    insertMarkdown(styleStart, styleEnd);
}

function changeFont() {
    const font = document.getElementById('font-family').value;
    if (!easyMDE) return;
    const selection = easyMDE.codemirror.getSelection();
    if (selection && !selection.includes('\n')) {
        applyStyle(`<span style="font-family:${font}">`, `</span>`);
    } else {
        // Nessuna selezione: cambia il font di visualizzazione senza inquinare il markdown con tag vuoti
        const cmEl = easyMDE.codemirror.getWrapperElement();
        if (cmEl) cmEl.style.fontFamily = font;
        const preview = document.getElementById('preview-pane');
        if (preview) preview.style.fontFamily = font;
    }
}

function changeFontSize() {
    const size = document.getElementById('font-size').value;
    if (!easyMDE) return;
    const selection = easyMDE.codemirror.getSelection();
    if (selection && !selection.includes('\n')) {
        applyStyle(`<span style="font-size:${size}px">`, `</span>`);
    } else {
        // Nessuna selezione: cambia la dimensione base di visualizzazione
        const cmEl = easyMDE.codemirror.getWrapperElement();
        if (cmEl) cmEl.style.fontSize = size + 'px';
        if (easyMDE.codemirror.refresh) easyMDE.codemirror.refresh();
    }
}

function insertPageBreak() {
    if (!easyMDE) return;
    easyMDE.codemirror.replaceSelection('\n\n<div class="page-break"></div>\n\n');
    easyMDE.codemirror.focus();
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
// Nota: 'sidebarVisible' è dichiarato in ui.js come variabile globale

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
    const content = getEditorContent() || '';
    const chars = content.length;
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    const lines = content ? content.split('\n').length : 0;
    const pages = Math.max(1, Math.ceil(words / 500));
    const sLeft = document.getElementById('status-left');
    const loc = currentLang === 'it' ? 'it-IT' : 'en-US';
    if (sLeft) {
        if (currentLang === 'it') {
            sLeft.textContent = `Caratteri: ${chars.toLocaleString(loc)} | Parole: ${words.toLocaleString(loc)} | Righe: ${lines} | ~${pages} pag.`;
        } else {
            sLeft.textContent = `Characters: ${chars.toLocaleString(loc)} | Words: ${words.toLocaleString(loc)} | Lines: ${lines} | ~${pages} pages`;
        }
    }
}
