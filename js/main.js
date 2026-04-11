let currentLang = 'it';

function getStr(key) {
    return i18n[currentLang][key] || key;
}

function toggleLanguage() {
    currentLang = currentLang === 'it' ? 'en' : 'it';
    const langLabel = document.getElementById('lang-label');
    if (langLabel) langLabel.textContent = currentLang.toUpperCase();
    try { localStorage.setItem('minipad_lang', currentLang); } catch (e) { }
    applyLanguage();
    renderSidebar(); // Redraw UI tabs
}

function applyLanguage() {
    // Translate all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');

        const translation = getStr(key);
        let emoji = "";
        if (el.innerHTML.includes("📄")) emoji = "📄 ";
        if (el.innerHTML.includes("💾")) emoji = "💾 ";
        if (el.innerHTML.includes("🗑")) emoji = "🗑 ";
        if (el.innerHTML.includes("⬇")) emoji = "⬇ ";
        if (el.innerHTML.includes("⬆")) emoji = "⬆ ";
        if (el.innerHTML.includes("📥")) emoji = "📥 ";
        if (el.innerHTML.includes("🖨")) emoji = "🖨 ";
        if (el.innerHTML.includes("ℹ️")) emoji = "ℹ️ ";

        el.textContent = emoji + translation;
    });

    // UI elements
    const bFile = document.getElementById('file-btn').querySelector('span');
    if (bFile) bFile.textContent = getStr('file');

    const diagTitle = document.querySelector('#diagram-modal h2');
    if (diagTitle) diagTitle.childNodes[0].nodeValue = getStr('diagram_title');

    const sInd = document.getElementById('save-indicator');
    if (sInd && (sInd.textContent === i18n['it']['saved_indicator'] || sInd.textContent === i18n['en']['saved_indicator'])) sInd.textContent = getStr('saved_indicator');

    const btnGuida = document.getElementById('btn-guida');
    if (btnGuida) btnGuida.title = getStr('btn_guida');
    const btnFind = document.getElementById('btn-find');
    if (btnFind) btnFind.title = getStr('btn_find');
    const btnToc = document.getElementById('btn-toc');
    if (btnToc) btnToc.title = getStr('btn_toc');

    // Update EasyMDE placeholder if initialized
    if (easyMDE) {
        easyMDE.options.placeholder = getStr('placeholder');
    }

    // Find bar
    const findLabel = document.getElementById('find-label');
    if (findLabel) findLabel.textContent = getStr('find_label');
    const replaceLabel = document.getElementById('replace-label');
    if (replaceLabel) replaceLabel.textContent = getStr('replace_label');
    const findInput = document.getElementById('find-input');
    if (findInput) findInput.placeholder = getStr('find_placeholder');
    const replaceInput = document.getElementById('replace-input');
    if (replaceInput) replaceInput.placeholder = getStr('replace_placeholder');
    const replaceBtn = document.getElementById('replace-btn');
    if (replaceBtn) replaceBtn.textContent = getStr('btn_replace');
    const sLeft = document.getElementById('status-left');
    if (sLeft && (sLeft.textContent === i18n['it']['status_ready'] || sLeft.textContent === i18n['en']['status_ready'])) sLeft.textContent = getStr('status_ready');

    const helpIt = document.getElementById('help-it');
    const helpEn = document.getElementById('help-en');
    if (helpIt && helpEn) {
        if (currentLang === 'it') {
            helpIt.style.display = 'block';
            helpEn.style.display = 'none';
        } else {
            helpIt.style.display = 'none';
            helpEn.style.display = 'block';
        }
    }
}

let tabs = [];
let groups = [];
let activeTabId = null;
let autoSaveTimeout = null;
let previewTimeout = null;
let savedSelection = null;

// --- INIT ---
async function init() {
    initMathToolbar();
    initTableGrid();

    try {
        const savedLang = localStorage.getItem('minipad_lang');
        if (savedLang === 'en' || savedLang === 'it') currentLang = savedLang;
    } catch (e) { }
    const langLabel = document.getElementById('lang-label');
    if (langLabel) langLabel.textContent = currentLang.toUpperCase();
    applyLanguage();

    // Load tabs and groups from storage
    await loadFromStorage();

    // If no tabs exist, create a default one
    if (tabs.length === 0) {
        await createNote(getStr('new_tab_name'), "# " + getStr('new_tab_name') + "\n\n" + getStr('placeholder'));
    }

    // Initialize EasyMDE
    const firstTab = tabs[0];
    initEasyMDE(firstTab ? firstTab.content : '');

    renderSidebar();

    // Restore active tab
    if (tabs.length > 0) {
        let lastActive = tabs[tabs.length - 1].id;
        try {
            const savedActiveTab = localStorage.getItem('minipad_active_tab');
            if (savedActiveTab && tabs.find(t => t.id == savedActiveTab)) {
                lastActive = savedActiveTab;
            }
        } catch(e) {}
        switchNote(lastActive);
    }

    // Keyboard shortcuts on EasyMDE
    if (easyMDE) {
        easyMDE.codemirror.on('keydown', (cm, e) => {
            // We'll handle shortcuts through EasyMDE's built-in functions
            // Most are already handled (Ctrl+B, Ctrl+I, etc.)
        });
    }

    // Image Drag & Drop
    const editorContainer = document.getElementById('editor-container');
    if (editorContainer) {
        editorContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        editorContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const base64 = event.target.result;
                        insertMarkdown(`\n![${file.name}](${base64})\n`, '');
                    };
                    reader.readAsDataURL(file);
                }
            }
        });
    }

    // Relying exclusively on 100dvh for mobile keyboard handling.
    updatePreview();

    // Global Ctrl+F to open find bar
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            toggleFindBar();
        }
        if (e.key === 'Escape') {
            if (findBarVisible) { closeFindBar(); return; }
            if (document.body.classList.contains('zen-mode')) {
                document.body.classList.remove('zen-mode');
            }
        }
    });

    // Enter key in find-input to jump to next
    document.getElementById('find-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); highlightFind(); }
        if (e.key === 'Escape') { closeFindBar(); }
    });
}

// Initialize the app
window.addEventListener('DOMContentLoaded', init);

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// PWA Install Logic
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('install-btn');
    const installDiv = document.getElementById('install-divider');
    if (installBtn && installDiv) {
        installBtn.style.display = 'block';
        installDiv.style.display = 'block';
    }
});

function installPWA() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
            const installBtn = document.getElementById('install-btn');
            const installDiv = document.getElementById('install-divider');
            if (installBtn) installBtn.style.display = 'none';
            if (installDiv) installDiv.style.display = 'none';
        }
        deferredPrompt = null;
    });
}
