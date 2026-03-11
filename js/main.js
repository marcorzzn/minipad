// marked.setOptions is removed because it causes errors in newer marked.js versions.
        if (window.mermaid) {
            mermaid.initialize({ startOnLoad: false, theme: 'default' });
        }

        let currentLang = 'it';
        const i18n = {
            'it': {
                'file': 'File',
                'new': 'Nuovo',
                'open': 'Apri...',
                'save_as': 'Salva con nome...',
                'export_pdf': 'Esporta PDF',
                'export_html': 'Esporta HTML',
                'export_md': 'Esporta Markdown (.md)',
                'export_tex': 'Esporta LaTeX (.tex)',
                'save_title': 'Salva Ora',
                'saved_indicator': 'Salvato',
                'find_label': 'Cerca:',
                'replace_label': 'Sostituisci:',
                'btn_replace': 'Sostituisci tutto',
                'find_placeholder': 'Testo da cercare...',
                'replace_placeholder': 'Sostituisci con...',
                'diagram_title': 'Inserisci Diagramma',
                'tooltip_bold': 'Grassetto (Ctrl+B)',
                'tooltip_italic': 'Corsivo (Ctrl+I)',
                'tooltip_underline': 'Sottolineato',
                'tooltip_strikethrough': 'Barrato',
                'status_ready': 'Pronto',
                'placeholder': 'Scrivi qui... Usa $$ ... $$ per formule.',
                'new_tab_name': 'Nuova Nota',
                'tab_rename_prompt': 'Rinomina scheda:',
                'tab_untitled': 'Senza nome',
                'tab_close_confirm': "Chiudere l'ultima scheda?",
                'btn_guida': 'Guida',
                'btn_find': 'Cerca (Ctrl+F)',
                'btn_toc': 'Genera Indice (TOC)'
            },
            'en': {
                'file': 'File',
                'new': 'New',
                'open': 'Open...',
                'save_as': 'Save as...',
                'export_pdf': 'Export PDF',
                'export_html': 'Export HTML',
                'export_md': 'Export Markdown (.md)',
                'export_tex': 'Export LaTeX (.tex)',
                'save_title': 'Save Now',
                'saved_indicator': 'Saved',
                'find_label': 'Find:',
                'replace_label': 'Replace:',
                'btn_replace': 'Replace All',
                'find_placeholder': 'Search text...',
                'replace_placeholder': 'Replace with...',
                'diagram_title': 'Insert Diagram',
                'tooltip_bold': 'Bold (Ctrl+B)',
                'tooltip_italic': 'Italic (Ctrl+I)',
                'tooltip_underline': 'Underline',
                'tooltip_strikethrough': 'Strikethrough',
                'status_ready': 'Ready',
                'placeholder': 'Type here... Use $$ ... $$ for math.',
                'new_tab_name': 'New Note',
                'tab_rename_prompt': 'Rename tab:',
                'tab_untitled': 'Untitled',
                'tab_close_confirm': "Close the last tab?",
                'btn_guida': 'Help',
                'btn_find': 'Find (Ctrl+F)',
                'btn_toc': 'Generate TOC'
            }
        };

        function getStr(key) {
            return i18n[currentLang][key] || key;
        }

        function toggleLanguage() {
            currentLang = currentLang === 'it' ? 'en' : 'it';
            document.getElementById('lang-label').textContent = currentLang.toUpperCase();
            try { localStorage.setItem('minipad_lang', currentLang); } catch (e) { }
            applyLanguage();
            renderSidebar(); // Redraw UI tabs
        }

        function applyLanguage() {
            // Dropdowns
            const fileMenu = document.getElementById('file-menu').children;
            if (fileMenu.length > 5) {
                fileMenu[0].textContent = getStr('new');
                fileMenu[1].textContent = getStr('open');
                fileMenu[3].textContent = getStr('save_as');
                fileMenu[5].textContent = getStr('export_pdf');
                fileMenu[6].textContent = getStr('export_html');
                fileMenu[7].textContent = getStr('export_md');
                fileMenu[8].textContent = getStr('export_tex');
            }

            // UI elements
            const bFile = document.getElementById('file-btn').querySelector('span');
            if (bFile) bFile.textContent = getStr('file');

            const diagTitle = document.querySelector('#diagram-modal h2');
            if (diagTitle) diagTitle.childNodes[0].nodeValue = getStr('diagram_title');

            const sInd = document.getElementById('save-indicator');
            if (sInd && sInd.textContent === i18n['it']['saved_indicator'] || sInd.textContent === i18n['en']['saved_indicator']) sInd.textContent = getStr('saved_indicator');

            const btnGuida = document.getElementById('btn-guida');
            if (btnGuida) btnGuida.title = getStr('btn_guida');
            const btnFind = document.getElementById('btn-find');
            if (btnFind) btnFind.title = getStr('btn_find');
            const btnToc = document.getElementById('btn-toc');
            if (btnToc) btnToc.title = getStr('btn_toc');

            document.getElementById('editor').placeholder = getStr('placeholder');

            // Find bar
            document.getElementById('find-label').textContent = getStr('find_label');
            document.getElementById('replace-label').textContent = getStr('replace_label');
            document.getElementById('find-input').placeholder = getStr('find_placeholder');
            document.getElementById('replace-input').placeholder = getStr('replace_placeholder');
            document.getElementById('replace-btn').textContent = getStr('btn_replace');
            const sLeft = document.getElementById('status-left');
            if (sLeft.textContent === i18n['it']['status_ready'] || sLeft.textContent === i18n['en']['status_ready']) sLeft.textContent = getStr('status_ready');

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
        let activeTabId = null;
        let autoSaveTimeout = null;
        let previewTimeout = null;
        let savedSelection = null;

        // --- DIAGRAM DATA TEMPLATES ---
        async function init() {
            initMathToolbar();
            initDiagramGrid();
            initTableGrid(); // New

            try {
                const savedLang = localStorage.getItem('minipad_lang');
                if (savedLang === 'en' || savedLang === 'it') currentLang = savedLang;
            } catch (e) { }
            document.getElementById('lang-label').textContent = currentLang.toUpperCase();
            applyLanguage();

            // PERSISTENCE FIX: Ensure we read from IndexedDB
            let savedData = null;
            try {
                savedData = await idbKeyval.get('minipad_tabs');
            } catch (e) {
                console.warn("Failed to read from IndexedDB, falling back:", e);
            }

            // Fallback to localStorage if idb is empty but localstorage has data (migration)
            if (!savedData) {
                const legacyData = localStorage.getItem('minipad_tabs');
                if (legacyData && legacyData !== "[]") {
                    savedData = legacyData;
                }
            }

            if (savedData && savedData !== "[]") {
                try {
                    tabs = typeof savedData === 'string' ? JSON.parse(savedData) : savedData;
                    // Ensure at least one tab
                    if (tabs.length === 0) throw new Error("No tabs");
                } catch (e) {
                    // Fallback
                    await createNote(getStr('new_tab_name'), "# " + getStr('new_tab_name') + "\n\n" + getStr('placeholder'));
                }
            } else {
                await createNote(getStr('new_tab_name'), "# " + getStr('new_tab_name') + "\n\n" + getStr('placeholder'));
            }

            renderSidebar();

            // Restore active tab
            if (tabs.length > 0) {
                const lastActive = tabs[tabs.length - 1].id; // Default to last
                switchNote(lastActive);
            }

            document.getElementById('editor').addEventListener('input', handleInput);
            document.getElementById('editor').addEventListener('keydown', handleShortcuts);

            // Image Drag & Drop
            const editorEl = document.getElementById('editor');
            editorEl.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
            editorEl.addEventListener('drop', (e) => {
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

            // Sync scroll
            const editorPane = document.getElementById('editor');
            const previewPane = document.getElementById('preview-pane');
            let isSyncingLeft = false;
            let isSyncingRight = false;

            editorPane.addEventListener('scroll', function () {
                if (!isSyncingLeft) {
                    isSyncingRight = true;
                    // Calculate percentage
                    const percentage = this.scrollTop / (this.scrollHeight - this.clientHeight);
                    previewPane.scrollTop = percentage * (previewPane.scrollHeight - previewPane.clientHeight);
                }
                isSyncingLeft = false;
            });

            previewPane.addEventListener('scroll', function () {
                if (!isSyncingRight) {
                    isSyncingLeft = true;
                    const percentage = this.scrollTop / (this.scrollHeight - this.clientHeight);
                    editorPane.scrollTop = percentage * (editorPane.scrollHeight - editorPane.clientHeight);
                }
                isSyncingRight = false;
            });

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
        init();

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
        