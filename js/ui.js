function openDiagramModal() {
            document.getElementById('diagram-modal').style.display = 'flex';
            document.getElementById('diagram-modal').classList.add('active'); // Add active class to CSS to handle z-index
        }

        // Helper to handle z-index of modals correctly
        document.querySelectorAll('.modal').forEach(m => {
            m.addEventListener('click', (e) => {
                if (e.target === m) m.style.display = 'none';
            });
        });

        /* --- MATH TOOLBAR LOGIC --- */
        function initMathToolbar() {
            const tabsContainer = document.getElementById('math-tabs-container');
            Object.keys(mathCategories).forEach((catName, index) => {
                const btn = document.createElement('div');
                btn.className = `math-tab ${index === 0 ? 'active' : ''}`;
                btn.textContent = catName;
                btn.onclick = () => switchMathTab(catName, btn);
                tabsContainer.appendChild(btn);
            });
            loadMathCategory(Object.keys(mathCategories)[0]);
        }

        function switchMathTab(catName, clickedTab) {
            document.querySelectorAll('.math-tab').forEach(t => t.classList.remove('active'));
            clickedTab.classList.add('active');
            loadMathCategory(catName);
        }

        function loadMathCategory(catName) {
            const grid = document.getElementById('math-grid');
            grid.innerHTML = '';
            mathCategories[catName].forEach(item => {
                const btn = document.createElement('button');
                btn.className = 'math-btn';
                btn.title = item.cmd; // tooltip shows LaTeX command

                // Try rendering the full cmd expression with KaTeX for a real math preview
                // If the cmd is complex (long formula), fall back to a shortened label
                const renderTarget = item.cmd.length < 60 ? item.cmd : item.html;
                let rendered = false;

                if (!renderTarget.trim().startsWith('<')) {
                    try {
                        btn.innerHTML = katex.renderToString(renderTarget, {
                            throwOnError: true,
                            displayMode: false,
                            strict: false
                        });
                        rendered = true;
                    } catch (e) {
                        try {
                            // Try rendering just the html alias (simpler)
                            btn.innerHTML = katex.renderToString(item.html, {
                                throwOnError: true, displayMode: false, strict: false
                            });
                            rendered = true;
                        } catch (e2) { /* fall through to label */ }
                    }
                } else {
                    btn.innerHTML = renderTarget;
                    rendered = true;
                }

                if (!rendered) {
                    // Use a short text fallback showing the key symbol
                    const label = document.createElement('span');
                    label.className = 'math-label';
                    label.textContent = item.html.replace(/\\/g, '').substring(0, 12);
                    btn.appendChild(label);
                }

                // HOVER PREVIEW
                btn.addEventListener('mouseenter', (e) => showTooltip(e, item));
                btn.addEventListener('mousemove', moveTooltip);
                btn.addEventListener('mouseleave', hideTooltip);

                btn.onclick = () => insertLatex(item.cmd);
                grid.appendChild(btn);
            });
        }

        function toggleMathBar() {
            document.getElementById('math-toolbar').classList.toggle('show');
        }

        function insertLatex(code) {
            const field = document.getElementById('editor');
            const start = field.selectionStart;
            const end = field.selectionEnd;
            const val = field.value;

            let cursorPos = start + code.length;
            if (code.includes('\\frac{a}{b}') || code.includes('\\dfrac{a}{b}')) cursorPos = start + code.indexOf('{a}') + 1;
            else if (code.includes('\\tfrac')) cursorPos = start + code.indexOf('{a}') + 1;
            else if (code.includes('\\sqrt{x}')) cursorPos = start + code.indexOf('{x}') + 1;
            else if (code.includes('\\binom{n}{k}')) cursorPos = start + code.indexOf('{n}') + 1;
            else if (code.includes('\\begin{pmatrix}')) cursorPos = start + code.indexOf('{a}') + 1;
            else if (code.includes('\\lim_{x \\to 0}')) cursorPos = start + code.indexOf('x');

            field.value = val.substring(0, start) + code + val.substring(end);
            field.focus();
            field.setSelectionRange(cursorPos, cursorPos);
            handleInput();
        }

        function insertDiagram(code) {
            const field = document.getElementById('editor');
            const start = field.selectionStart;
            const end = field.selectionEnd;
            const val = field.value;

            field.value = val.substring(0, start) + "\n" + code + "\n" + val.substring(end);
            document.getElementById('diagram-modal').style.display = 'none';
            handleInput();
        }

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

        function closeAllMenus() {
            ['file-menu', 'table-menu'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.remove('show');
            });
        }

        function closeOtherMenus(exceptId) {
            ['file-menu', 'table-menu'].forEach(id => {
                const el = document.getElementById(id);
                if (el && id !== exceptId) el.classList.remove('show');
            });
        }

        // Updated Insert Formula Logic (Smart Inline / Block)
        function insertSpecialFormula(borderStr, offset) {
            const field = document.getElementById('editor');
            const start = field.selectionStart;
            const end = field.selectionEnd;
            const val = field.value;
            const selected = val.substring(start, end);

            let newText = "";
            if (selected.length > 0) {
                newText = borderStr + " " + selected + " " + borderStr;
                field.value = val.substring(0, start) + newText + val.substring(end);
                field.selectionStart = start;
                field.selectionEnd = start + newText.length;
            } else {
                newText = borderStr + "  " + borderStr;
                field.value = val.substring(0, start) + newText + val.substring(end);
                field.selectionStart = start + offset + 1;
                field.selectionEnd = start + offset + 1;
            }
            field.focus();
            handleInput();
        }

        function insertFormulaInline() {
            insertSpecialFormula('$', 1);
        }

        function insertFormulaBlock() {
            insertSpecialFormula('$$', 2);
        }

        /* --- FONT & COLOR with Span --- */
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

        /* --- TABLE BUILDER --- */
        function initTableGrid() {
            const grid = document.getElementById('table-grid');
            const label = document.getElementById('table-size-label');
            if (!grid || !label) return;
            grid.innerHTML = '';

            for (let r = 1; r <= 8; r++) {
                for (let c = 1; c <= 8; c++) {
                    const cell = document.createElement('div');
                    cell.style.width = '12px';
                    cell.style.height = '12px';
                    cell.style.border = '1px solid #ccc';
                    cell.style.background = '#fff';
                    cell.style.cursor = 'pointer';

                    cell.onmouseenter = () => highlightGrid(r, c);
                    cell.onclick = () => insertTable(r, c);

                    grid.appendChild(cell);
                }
            }

            grid.onmouseleave = () => {
                const cells = grid.children;
                for (let cell of cells) cell.style.background = '#fff';
                label.textContent = "0 x 0";
            };
        }

        function highlightGrid(rows, cols) {
            const grid = document.getElementById('table-grid');
            Array.from(grid.children).forEach((cell, index) => {
                const r = Math.floor(index / 8) + 1;
                const c = (index % 8) + 1;
                if (r <= rows && c <= cols) cell.style.background = 'var(--accent-color)';
                else cell.style.background = '#fff';
            });
            document.getElementById('table-size-label').textContent = `${rows} x ${cols}`;
        }

        function buildTableMd(rows, cols) {
            let table = '\n|';
            for (let c = 0; c < cols; c++) table += ` Intestazione ${c + 1} |`;
            table += '\n|';
            for (let c = 0; c < cols; c++) table += ' --- |';
            table += '\n';
            for (let r = 0; r < rows; r++) {
                table += '|';
                for (let c = 0; c < cols; c++) table += '   |';
                table += '\n';
            }
            return table;
        }

        function insertTable(rows, cols) {
            const table = buildTableMd(rows, cols);
            const field = document.getElementById('editor');
            const start = field.selectionStart;
            const val = field.value;
            field.value = val.substring(0, start) + table + val.substring(start);
            // Put cursor inside first data cell
            const firstCellPos = table.indexOf('\n| ') + 3;
            field.focus();
            field.setSelectionRange(start + firstCellPos, start + firstCellPos);
            handleInput();
            closeAllMenus();
        }

        function insertTableFromInputs() {
            const rows = parseInt(document.getElementById('table-rows-input').value) || 3;
            const cols = parseInt(document.getElementById('table-cols-input').value) || 3;
            insertTable(rows, cols);
        }


        /* --- FILE MENU FIX --- */
        window.addEventListener('click', (e) => {
            // Don't close if clicking inside a dropdown menu or on a designated menu toggle button
            const insideMenu = e.target.closest('.dropdown-menu');
            const isMenuToggle = e.target.closest('#file-btn') || e.target.closest('#table-menu-btn');
            if (!insideMenu && !isMenuToggle) {
                closeAllMenus();
            }
        });

        /* --- HEADING HELPERS --- */
        function applyHeading(level) {
            const field = document.getElementById('editor');
            const start = field.selectionStart;
            const val = field.value;
            const lineStart = val.lastIndexOf('\n', start - 1) + 1;
            const lineEnd = val.indexOf('\n', start);
            const end = lineEnd === -1 ? val.length : lineEnd;
            let line = val.substring(lineStart, end).replace(/^#+\s*/, '');
            const prefix = level > 0 ? '#'.repeat(level) + ' ' : '';
            const newLine = prefix + line;
            field.value = val.substring(0, lineStart) + newLine + val.substring(end);
            field.focus();
            field.setSelectionRange(lineStart + newLine.length, lineStart + newLine.length);
            handleInput();
        }

        function saveSelection() {
            const field = document.getElementById('editor');
            savedSelection = { start: field.selectionStart, end: field.selectionEnd };
        }

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
            const text = document.getElementById('editor').value;
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
            const field = document.getElementById('editor');
            const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            const matches = (field.value.match(re) || []).length;
            if (matches === 0) { alert('Nessuna occorrenza trovata.'); return; }
            field.value = field.value.replace(re, replace);
            handleInput();
            document.getElementById('find-count').textContent =
                `${matches} sostituzion${matches === 1 ? 'e' : 'i'} effettuate`;
        }

        /* ─── TOC GENERATOR ──────────────────────────────────────────────── */
        function generateTOC() {
            const field = document.getElementById('editor');
            const lines = field.value.split('\n');
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
            const start = field.selectionStart;
            field.value = field.value.substring(0, start) + toc + field.value.substring(start);
            field.focus();
            field.setSelectionRange(start, start + toc.length);
            handleInput();
        }

        /* ─── IMPROVED STATS ─────────────────────────────────────────────── */
        function updateStats() {
            const editorEl = document.getElementById('editor');
            if (!editorEl) return;
            const t = editorEl.value;
            const chars = t.length;
            const words = t.split(/\s+/).filter(w => w).length;
            const lines = t.split('\n').length;
            const pages = Math.max(1, Math.ceil(words / 500));
            const sLeft = document.getElementById('status-left');
            if (sLeft) sLeft.textContent = `Caratteri: ${chars.toLocaleString('it')} | Parole: ${words.toLocaleString('it')} | Righe: ${lines} | ~${pages} pag.`;
        }

        function applyList(prefix) {
            const field = document.getElementById('editor');
            const start = field.selectionStart;
            const end = field.selectionEnd;
            const val = field.value;
            const selected = val.substring(start, end);

            if (selected.length > 0) {
                const lines = selected.split('\n');
                const isOrdered = /^\d+\./.test(prefix);
                const newLines = lines.map((l, i) => {
                    const clean = l.replace(/^(\s*)(- \[[ xX]\] |[-*]\s|\d+\.\s)/, '$1');
                    return isOrdered ? `${i + 1}. ${clean}` : prefix + clean;
                });
                const joined = newLines.join('\n');
                field.value = val.substring(0, start) + joined + val.substring(end);
                field.setSelectionRange(start, start + joined.length);
            } else {
                const lineStart = val.lastIndexOf('\n', start - 1) + 1;
                const newVal = val.substring(0, lineStart) + prefix + val.substring(lineStart);
                field.value = newVal;
                field.setSelectionRange(lineStart + prefix.length, lineStart + prefix.length);
            }
            field.focus();
            handleInput();
        }


        /* --- IMPORT/EXPORT --- */
        function importFile(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                const name = file.name.replace(/\.[^/.]+$/, ""); // strip extension
                createTab(name, text);
            };
            reader.readAsText(file);
            event.target.value = ''; // reset input
            toggleFileMenu();
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

        function downloadFile(filename, content, type) {
            const blob = new Blob([content], { type: type });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        }

        /* --- BACKUP LOGIC --- */
        function exportBackup() {
            const dataStr = JSON.stringify(tabs, null, 2);
            const dateStr = new Date().toISOString().split('T')[0];
            downloadFile(`minipad_backup_${dateStr}.json`, dataStr, "application/json");
            toggleFileMenu();
        }

        async function importBackup(e) {
            const file = e.target.files[0];
            if (!file) return;
            const text = await file.text();
            try {
                const importedTabs = JSON.parse(text);
                if (Array.isArray(importedTabs) && importedTabs.length > 0) {
                    if (confirm("Questo unirà le note salvate in questo browser con quelle del backup. Continuare?")) {
                        // Merge logic: Add imported notes avoiding exact ID duplicates or generating new IDs
                        importedTabs.forEach(t => {
                            const existing = tabs.find(localTab => localTab.id === t.id);
                            if (existing) {
                                // If id conflict but different name/content, append as new
                                if (existing.content !== t.content) {
                                    t.id = t.id + "_imported";
                                    t.name = t.name + " (Backup)";
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
            e.target.value = ''; // reset
            toggleFileMenu();
        }

        function exportPDF() { promptExport('pdf'); toggleFileMenu(); }
        function exportHTML() { promptExport('html'); toggleFileMenu(); }
        function exportMD() { promptExport('md'); toggleFileMenu(); }
        function exportTXT() { promptExport('txt'); toggleFileMenu(); }
        function exportTEX() { promptExport('tex'); toggleFileMenu(); }
        function saveNow() { saveToStorage(); showSavedIndicator(); }

        /* --- EDITING --- */
        function insertMarkdown(start, end) {
            const field = document.getElementById('editor');
            const sStart = field.selectionStart;
            const sEnd = field.selectionEnd;
            const val = field.value;
            const selected = val.substring(sStart, sEnd);
            field.value = val.substring(0, sStart) + start + selected + end + val.substring(sEnd);
            field.focus();
            field.selectionStart = sStart + start.length;
            field.selectionEnd = sEnd + start.length;
            handleInput();
        }

        function insertColor(prop, color) {
            const field = document.getElementById('editor');
            let start = field.selectionStart;
            let end = field.selectionEnd;
            if (savedSelection && start === end) {
                start = savedSelection.start;
                end = savedSelection.end;
            }
            const val = field.value;
            let selected = val.substring(start, end);
            if (!selected) selected = "Testo";

            const insertText = `<span style="${prop}:${color}">` + selected + `</span>`;
            field.value = val.substring(0, start) + insertText + val.substring(end);

            savedSelection = null;

            setTimeout(() => {
                field.focus();
                field.setSelectionRange(start, start + insertText.length);
            }, 10);

            handleInput();
        }

        /* --- DIAGRAM LOGIC UPDATED --- */
        function initDiagramGrid() {
            const grid = document.getElementById('diagram-grid');
            if (!grid) return;
            grid.innerHTML = '';

            diagramTemplates.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'diagram-card';
        card.onclick = () => insertDiagram(item.code);

        const title = document.createElement('div');
        title.className = 'diagram-title';
        title.textContent = item.title;

        const preview = document.createElement('div');
        preview.className = 'diagram-preview';
        preview.style.fontFamily = 'monospace';
        preview.style.whiteSpace = 'pre';
        preview.style.textAlign = 'left';
        preview.style.fontSize = '10px';
        preview.style.lineHeight = '1.2';
        preview.style.overflow = 'hidden';
        preview.style.color = 'var(--text-color)';
        
        // Pulizia dei markdown backticks per l'anteprima visiva
        const cleanText = item.code.replace(/```text/g, '').replace(/```/g, '').trim();
        preview.textContent = cleanText;

        card.appendChild(title);
        card.appendChild(preview);
        grid.appendChild(card);
    });
}

        function insertDiagram(code) {
            const field = document.getElementById('editor');
            const start = field.selectionStart;
            const end = field.selectionEnd;
            const val = field.value;

            field.value = val.substring(0, start) + "\n" + code + "\n" + val.substring(end);
            document.getElementById('diagram-modal').style.display = 'none';
            handleInput();
        }

        /* --- OLD FUNCTIONS REMOVED (Replaced above) --- */

        /* --- CORE NOTES LOGIC (SIDEBAR) --- */
        let sidebarVisible = false;

        // Auto-collapse on load
        window.addEventListener('DOMContentLoaded', () => {
            if (!sidebarVisible && !document.getElementById('sidebar').classList.contains('collapsed')) {
                document.getElementById('sidebar').classList.add('collapsed');
            }
        });

        function toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            sidebarVisible = !sidebarVisible;
            if (sidebarVisible) {
                sidebar.classList.remove('collapsed');
            } else {
                sidebar.classList.add('collapsed');
            }
        }

        async function createNote(name, content) {
            const id = Date.now().toString();
            const dateStr = new Date().toLocaleString(currentLang === 'it' ? 'it-IT' : 'en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
            tabs.push({ id, name, content, updatedAt: dateStr });
            await saveToStorage();
            switchNote(id);
        }

        