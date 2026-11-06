
        // Stato sidebar — var per compatibilità cross-script
        var sidebarVisible = false;

        // Helper to handle z-index of modals correctly
        document.querySelectorAll('.modal').forEach(m => {
            m.addEventListener('click', (e) => {
                if (e.target === m) m.style.display = 'none';
            });
        });

        /* --- MATH TOOLBAR LOGIC (v1.5.6) --- */
        let currentMathCat = 'Greco min.';
        let mathSearchQuery = '';

        const mathGroups = [
            {
                group: '🔤 Alfabeto Greco',
                cats: ['Greco min.', 'Greco mai.', 'Greco var.']
            },
            {
                group: '📐 Analisi & Calcolo',
                cats: ['Integrali', 'Derivate', 'Limiti', 'Serie', 'Eq. Diff.', 'Analisi Compl.']
            },
            {
                group: '📊 Algebra & Geometria',
                cats: ['Trigon.', 'Funz. Spec.', 'Algebra Lin.', 'Strutture', 'Combinatoria']
            },
            {
                group: '⚛️ Fisica & Scienze',
                cats: ['Fisica', 'Quantistica']
            },
            {
                group: '💡 Logica & Insiemi',
                cats: ['Probabilità', 'Logica', 'Relazioni', 'Insiemi Num.']
            },
            {
                group: '↗️ Simboli & Notazione',
                cats: ['Operatori', 'Frecce', 'Parentesi', 'Font', 'Decoratori', 'Spaziatura']
            }
        ];

        function initMathToolbar() {
            const tabsContainer = document.getElementById('math-tabs-container');
            const selectEl = document.getElementById('math-category-select');

            if (tabsContainer) {
                tabsContainer.innerHTML = '';
            }
            if (selectEl) {
                selectEl.innerHTML = '';
                mathGroups.forEach(grp => {
                    const optgroup = document.createElement('optgroup');
                    optgroup.label = grp.group;
                    grp.cats.forEach(c => {
                        if (typeof mathCategories !== 'undefined' && mathCategories[c]) {
                            const opt = document.createElement('option');
                            opt.value = c;
                            opt.textContent = c;
                            optgroup.appendChild(opt);
                        }
                    });
                    selectEl.appendChild(optgroup);
                });
            }

            // Quick category chips
            if (tabsContainer && typeof mathCategories !== 'undefined') {
                Object.keys(mathCategories).forEach((catName, index) => {
                    const btn = document.createElement('div');
                    btn.className = `math-tab ${index === 0 ? 'active' : ''}`;
                    btn.textContent = catName;
                    btn.dataset.cat = catName;
                    btn.onclick = () => switchMathTab(catName);
                    tabsContainer.appendChild(btn);
                });
            }

            const initialCat = (typeof mathCategories !== 'undefined' && Object.keys(mathCategories)[0]) || 'Greco min.';
            switchMathTab(initialCat);
        }

        function switchMathTab(catName) {
            currentMathCat = catName;
            mathSearchQuery = '';
            const searchInput = document.getElementById('math-search-input');
            const clearBtn = document.getElementById('math-search-clear');
            if (searchInput) searchInput.value = '';
            if (clearBtn) clearBtn.style.display = 'none';

            const selectEl = document.getElementById('math-category-select');
            if (selectEl && selectEl.value !== catName) {
                selectEl.value = catName;
            }

            document.querySelectorAll('.math-tab').forEach(t => {
                t.classList.toggle('active', t.dataset.cat === catName);
            });

            if (typeof mathCategories !== 'undefined' && mathCategories[catName]) {
                renderMathGrid(mathCategories[catName], `${mathCategories[catName].length} simboli`);
            }
        }

        function onMathCategorySelect(catName) {
            switchMathTab(catName);
        }

        function onMathSearch(query) {
            mathSearchQuery = String(query || '').trim().toLowerCase();
            const clearBtn = document.getElementById('math-search-clear');
            if (clearBtn) clearBtn.style.display = mathSearchQuery ? 'inline-block' : 'none';

            if (!mathSearchQuery) {
                switchMathTab(currentMathCat);
                return;
            }

            // Deselect tabs visually when searching across all categories
            document.querySelectorAll('.math-tab').forEach(t => t.classList.remove('active'));

            const results = [];
            const seen = new Set();

            if (typeof mathCategories !== 'undefined') {
                Object.keys(mathCategories).forEach(cat => {
                    mathCategories[cat].forEach(item => {
                        const key = item.cmd;
                        if (seen.has(key)) return;
                        const matchCmd = item.cmd.toLowerCase().includes(mathSearchQuery);
                        const matchHtml = (item.html || '').toLowerCase().includes(mathSearchQuery);
                        const matchCat = cat.toLowerCase().includes(mathSearchQuery);
                        if (matchCmd || matchHtml || matchCat) {
                            seen.add(key);
                            results.push(item);
                        }
                    });
                });
            }

            renderMathGrid(results, `${results.length} risultati per "${query}"`);
        }

        function clearMathSearch() {
            const searchInput = document.getElementById('math-search-input');
            if (searchInput) {
                searchInput.value = '';
                if (typeof searchInput.focus === 'function') searchInput.focus();
            }
            onMathSearch('');
        }

        function renderMathGrid(items, badgeText) {
            const grid = document.getElementById('math-grid');
            const badge = document.getElementById('math-count-badge');
            if (badge && badgeText) {
                badge.textContent = badgeText;
            }

            if (!grid) return;
            grid.innerHTML = '';

            if (!items || items.length === 0) {
                grid.innerHTML = '<div class="mp-math-empty">Nessun simbolo trovato. Prova con "alpha", "int", "sum", "geq", "to"...</div>';
                return;
            }

            items.forEach(item => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'math-btn';
                btn.title = item.cmd;

                const renderTarget = item.cmd.length < 60 ? item.cmd : item.html;
                let rendered = false;

                if (!renderTarget.trim().startsWith('<')) {
                    try {
                        if (typeof katex !== 'undefined') {
                            btn.innerHTML = katex.renderToString(renderTarget, {
                                throwOnError: true,
                                displayMode: false,
                                strict: false
                            });
                            rendered = true;
                        }
                    } catch (e) {
                        try {
                            btn.innerHTML = katex.renderToString(item.html, {
                                throwOnError: true, displayMode: false, strict: false
                            });
                            rendered = true;
                        } catch (e2) { }
                    }
                } else {
                    btn.innerHTML = renderTarget;
                    rendered = true;
                }

                if (!rendered) {
                    const label = document.createElement('span');
                    label.className = 'math-label';
                    label.textContent = item.html.replace(/\\/g, '').substring(0, 12);
                    btn.appendChild(label);
                }

                btn.addEventListener('mouseenter', (e) => showTooltip(e, item));
                btn.addEventListener('mousemove', moveTooltip);
                btn.addEventListener('mouseleave', hideTooltip);

                btn.onclick = () => insertLatex(item.cmd);
                grid.appendChild(btn);
            });
        }

        function toggleMathBar() {
            const bar = document.getElementById('math-toolbar');
            if (!bar) return;
            bar.classList.toggle('show');
            if (bar.classList.contains('show')) {
                const search = document.getElementById('math-search-input');
                if (search && window.innerWidth >= 768) {
                    // non forzare focus su mobile per evitare tastiera virtuale indesiderata
                }
            }
        }

        window.initMathToolbar = initMathToolbar;
        window.toggleMathBar = toggleMathBar;
        window.onMathCategorySelect = onMathCategorySelect;
        window.onMathSearch = onMathSearch;
        window.clearMathSearch = clearMathSearch;
        window.switchMathTab = switchMathTab;

        // insertLatex moved to editor.js to work with EasyMDE


        /* --- TOOLTIP FUNCTIONS --- */
        const tooltip = document.getElementById('math-tooltip');

        function showTooltip(e, item) {
            tooltip.innerHTML = '';
            // Render the FULL cmd expression for the preview
            const previewDiv = document.createElement('div');
            previewDiv.style.cssText = 'font-size:16px; padding: 4px 0 8px 0;';

            if (item.html.trim().startsWith('<')) {
                previewDiv.innerHTML = item.html;
                const svg = previewDiv.querySelector('svg');
                if (svg) { svg.style.width = '40px'; svg.style.height = '40px'; }
            } else {
                try {
                    // Render the full cmd in display mode for maximum clarity
                    previewDiv.innerHTML = katex.renderToString(
                        item.cmd.length < 120 ? item.cmd : item.html,
                        { throwOnError: false, displayMode: true, strict: false }
                    );
                } catch (ex) {
                    try {
                        previewDiv.innerHTML = katex.renderToString(item.html, { throwOnError: false, displayMode: true });
                    } catch (ex2) {
                        previewDiv.textContent = item.cmd;
                    }
                }
            }
            tooltip.appendChild(previewDiv);

            // Show the raw LaTeX command below
            const cmdDiv = document.createElement('div');
            cmdDiv.style.cssText = 'font-family:monospace; font-size:10px; color:#aaa; border-top:1px solid #444; padding-top:4px; margin-top:2px; word-break:break-all;';
            cmdDiv.textContent = item.cmd;
            tooltip.appendChild(cmdDiv);

            tooltip.style.display = 'block';
            moveTooltip(e);
        }

        function moveTooltip(e) {
            const x = e.clientX + 15;
            const y = e.clientY + 15;

            const rect = tooltip.getBoundingClientRect();
            const winWidth = window.innerWidth;
            const winHeight = window.innerHeight;

            let finalX = x;
            let finalY = y;

            if (x + rect.width > winWidth) finalX = x - rect.width - 10;
            if (y + rect.height > winHeight) finalY = y - rect.height - 10;

            tooltip.style.left = finalX + 'px';
            tooltip.style.top = finalY + 'px';
        }

        function hideTooltip() {
            tooltip.style.display = 'none';
        }

        /* --- CORE PREVIEW LOGIC --- */
        function positionDropdown(menuId, btnEl) {
            const menu = document.getElementById(menuId);
            if (!menu || !btnEl) return;
            // Force display block first to get accurate rects if needed, though they are fixed
            const rect = btnEl.getBoundingClientRect();
            menu.style.top = (rect.bottom + 2) + 'px';
            menu.style.left = Math.min(rect.left, window.innerWidth - 210) + 'px';
            menu.classList.add('show');
        }

        function toggleFileMenu(e) {
            if (e) e.stopPropagation();
            const btn = document.getElementById('file-btn');
            const menu = document.getElementById('file-menu');
            if (!menu) return;
            const isShowing = menu.classList.contains('show');
            closeAllMenus();
            if (!isShowing) positionDropdown('file-menu', btn);
        }

        function toggleFormulaMenu(e) {
            // Disabled: formula menu has been replaced by the Math Toolbar.
            console.log("toggleFormulaMenu disabled in latest version.");
        }

        function toggleTableMenu(e) {
            if (e) e.stopPropagation();
            const btn = e && e.currentTarget ? e.currentTarget : document.querySelector('[onclick*="toggleTableMenu"]');
            const menu = document.getElementById('table-menu');
            if (!menu) return;
            const isShowing = menu.classList.contains('show');
            closeAllMenus();
            if (!isShowing) positionDropdown('table-menu', btn);
        }

        function toggleListMenu(e) {
            if (e) e.stopPropagation();
            const btn = e && e.currentTarget ? e.currentTarget : document.querySelector('[onclick*="toggleListMenu"]');
            const menu = document.getElementById('list-menu');
            if (!menu) return;
            const isShowing = menu.classList.contains('show');
            closeAllMenus();
            if (!isShowing) positionDropdown('list-menu', btn);
        }

        function toggleHeadingsMenu(e) {
            if (e) e.stopPropagation();
            const btn = e && e.currentTarget ? e.currentTarget : document.querySelector('[onclick*="toggleHeadingsMenu"]');
            const menu = document.getElementById('headings-menu');
            if (!menu) return;
            const isShowing = menu.classList.contains('show');
            closeAllMenus();
            if (!isShowing) positionDropdown('headings-menu', btn);
        }

        function toggleDiagramMenu(e) {
            if (e) e.stopPropagation();
            const btn = e && e.currentTarget ? e.currentTarget : document.querySelector('[onclick*="toggleDiagramMenu"]');
            const menu = document.getElementById('diagram-dropdown-menu');
            if (!menu) return;

            // Guard idempotente: costruisce il menu una sola volta
            if (!menu.dataset.built) {
                buildDiagramMenu();
                menu.dataset.built = 'true';
            }

            const isShowing = menu.classList.contains('show');
            closeAllMenus();
            if (!isShowing) positionDropdown('diagram-dropdown-menu', btn);
        }

        function buildDiagramMenu() {
            const menu = document.getElementById('diagram-dropdown-menu');
            if (!menu) return;
            menu.innerHTML = '';

            const categories = [...new Set(diagramTemplates.map(t => t.category || "Altri"))];

            categories.forEach(cat => {
                const catTitle = document.createElement('div');
                catTitle.style.cssText = "font-size: 11px; font-weight: bold; color: #888; padding: 4px 12px; margin-top: 4px;";
                catTitle.textContent = cat.toUpperCase();
                menu.appendChild(catTitle);

                const items = diagramTemplates.filter(t => (t.category || "Altri") === cat);
                items.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'dropdown-item';
                    div.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; cursor: pointer;";

                    const titleSpan = document.createElement('span');
                    titleSpan.textContent = item.title;

                    div.appendChild(titleSpan);

                    div.onclick = () => {
                        insertDiagramAtCursor(item.code);
                        closeAllMenus();
                    };
                    menu.appendChild(div);
                });
            });
        }

        function insertCustomTable() {
            const rowsInput = document.getElementById('custom-table-rows');
            const colsInput = document.getElementById('custom-table-cols');
            let r = parseInt(rowsInput ? rowsInput.value : 4);
            let c = parseInt(colsInput ? colsInput.value : 4);
            if (isNaN(r) || r < 1 || r > 50) r = 4;
            if (isNaN(c) || c < 1 || c > 50) c = 4;
            insertTable(r, c);
        }

        const ALL_MENUS = ['file-menu', 'table-menu', 'list-menu', 'headings-menu', 'diagram-dropdown-menu'];

        function closeAllMenus() {
            ALL_MENUS.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.remove('show');
            });
        }

        function closeOtherMenus(exceptId) {
            ALL_MENUS.forEach(id => {
                const el = document.getElementById(id);
                if (el && id !== exceptId) el.classList.remove('show');
            });
        }

        /* --- TABLE BUILDER --- */
        function buildTableMd(rows, cols) {
            const headerRow = '\n|' + Array.from({ length: cols }, (_, i) => ` Intestazione ${i + 1} |`).join('');
            const separatorRow = '\n|' + ' --- |'.repeat(cols);
            const dataRow = '\n|' + '   |'.repeat(cols);

            return headerRow + separatorRow + dataRow.repeat(rows) + '\n';
        }

        function insertTable(rows, cols) {
            if (!rows || !cols || rows < 1 || rows > 50 || cols < 1 || cols > 50) {
                console.warn("insertTable: dimensioni non valide", rows, cols);
                return;
            }
            if (!easyMDE) {
                console.warn("insertTable: EasyMDE non inizializzato");
                return;
            }
            const table = buildTableMd(rows, cols);
            easyMDE.codemirror.replaceSelection(table);
            easyMDE.codemirror.focus();
            closeAllMenus();
        }

        /* --- MENU FIX --- */
        window.addEventListener('click', (e) => {
            // Don't close if clicking inside a dropdown menu or on a designated menu toggle button
            const insideMenu = e.target.closest('.dropdown-menu');
            const isMenuToggle = e.target.closest('.format-btn') || e.target.closest('.menu-btn');
            if (!insideMenu && !isMenuToggle) {
                closeAllMenus();
            }
        });

        // Restore saved theme
        try {
            const savedTheme = localStorage.getItem('minipad_theme');
            if (savedTheme) {
                document.body.setAttribute('data-theme', savedTheme);
            }
            if (localStorage.getItem('minipad_dark_mode') === 'true') {
                document.body.classList.add('dark-mode');
            }
        } catch (e) { }

        /* ─── FIND / REPLACE ─────────────────────────────────────────────── */
        let findBarVisible = false;
        function toggleFindBar() {
            const bar = document.getElementById('find-bar');
            findBarVisible = !findBarVisible;
            bar.style.display = findBarVisible ? 'flex' : 'none';
            if (findBarVisible) setTimeout(() => document.getElementById('find-input').focus(), 50);
            else document.getElementById('find-count').textContent = '';
        }
        function closeFindBar() {
            findBarVisible = false;
            document.getElementById('find-bar').style.display = 'none';
            document.getElementById('find-count').textContent = '';
        }
        function highlightFind() {
            const query = document.getElementById('find-input').value;
            const countEl = document.getElementById('find-count');
            if (!query) { countEl.textContent = ''; return; }
            const text = typeof getEditorContent === 'function' ? getEditorContent() : '';
            const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            const matches = [...text.matchAll(re)];
            countEl.textContent = matches.length > 0
                ? `${matches.length} risultat${matches.length === 1 ? 'o' : 'i'}`
                : 'Nessun risultato';
        }
        function findAndReplace() {
            const query = document.getElementById('find-input').value;
            const replace = document.getElementById('replace-input').value;
            if (!query) return;
            if (!easyMDE) return;
            const currentContent = getEditorContent();
            const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            const matches = (currentContent.match(re) || []).length;
            if (matches === 0) { alert('Nessuna occorrenza trovata.'); return; }
            const newContent = currentContent.replace(re, replace);
            setEditorContent(newContent);
            handleInput(newContent);
            document.getElementById('find-count').textContent =
                `${matches} sostituzion${matches === 1 ? 'e' : 'i'} effettuate`;
        }

        /* ─── TOC GENERATOR ──────────────────────────────────────────────── */
        function generateTOC() {
            if (!easyMDE) return;
            const content = getEditorContent();
            const lines = content.split('\n');
            const headings = lines.filter(l => /^#{1,6}\s/.test(l));
            if (headings.length === 0) { alert('Nessun titolo trovato nel documento.'); return; }
            let toc = '## Indice\n\n';
            headings.forEach(h => {
                const level = h.match(/^(#+)/)[1].length;
                const text = h.replace(/^#+\s*/, '').trim();
                const anchor = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
                const indent = '  '.repeat(level - 1);
                toc += `${indent}- [${text}](#${anchor})\n`;
            });
            toc += '\n';
            const doc = easyMDE.codemirror.getDoc();
            const cursor = doc.getCursor();
            doc.replaceRange(toc, cursor);
            easyMDE.codemirror.focus();
        }

        // Auto-collapse on load
        window.addEventListener('DOMContentLoaded', () => {
            if (!sidebarVisible && !document.getElementById('sidebar').classList.contains('collapsed')) {
                document.getElementById('sidebar').classList.add('collapsed');
            }
        });

        