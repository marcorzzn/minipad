function newNote() {
            createNote(getStr('new_tab_name'), "");
            toggleFileMenu();
        }

        function switchNote(id) {
            activeTabId = id;
            const tab = tabs.find(t => t.id === id);
            if (tab) document.getElementById('editor').value = tab.content;
            renderSidebar();
            updatePreview();
            updateStats();
        }

        function renderSidebar() {
            const list = document.getElementById('tabs-list'); // Changed from sidebar-list to tabs-list
            const searchEl = document.getElementById('sidebar-search');
            const query = searchEl ? searchEl.value.toLowerCase() : '';
            if (!list) return;
            list.innerHTML = '';

            // Sort by most recent if possible, though currently keeping array order is fine
            // We'll iterate backwards to show newest first
            const sortedTabs = [...tabs].reverse();

            sortedTabs.forEach(tab => {
                // Filter by search query
                if (query && !tab.name.toLowerCase().includes(query) && !tab.content.toLowerCase().includes(query)) {
                    return;
                }

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
                nameSpan.title = getStr('tab_rename_prompt');
                nameSpan.ondblclick = (e) => {
                    e.stopPropagation();
                    const newName = prompt(getStr('tab_rename_prompt'), tab.name);
                    if (newName && newName.trim()) {
                        tab.name = newName.trim().substring(0, 30);
                        saveToStorage();
                        renderSidebar();
                    }
                };

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

                div.appendChild(leftDiv);
                div.appendChild(closeBtn);
                list.appendChild(div);
            });
        }

        function deleteNote(e, id) {
            e.stopPropagation();
            if (tabs.length === 1) {
                if (!confirm(getStr('tab_close_confirm'))) return;
                tabs[0].content = "";
                tabs[0].name = getStr('tab_untitled');
                switchNote(tabs[0].id);
                return;
            }
            if (!confirm("Eliminare definitivamente questa nota?")) return;
            tabs = tabs.filter(t => t.id !== id);
            saveToStorage();
            if (activeTabId === id) switchNote(tabs[tabs.length - 1].id);
            else renderSidebar();
        }

        // --- AI PASTE INTERCEPTOR ---
        document.getElementById('editor').addEventListener('paste', function (e) {
            let pasteText = (e.clipboardData || window.clipboardData).getData('text');

            // Check if it contains typical AI math blocks \[ ... \] or \( ... \)
            if (pasteText.includes('\\[') || pasteText.includes('\\(')) {
                e.preventDefault();
                // Replace block math \[ ... \] with $$ ... $$
                pasteText = pasteText.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');
                // Replace inline math \( ... \) with $ ... $
                pasteText = pasteText.replace(/\\\((.*?)\\\)/g, '$$$1$$');

                const start = this.selectionStart;
                const val = this.value;
                this.value = val.substring(0, start) + pasteText + val.substring(this.selectionEnd);
                this.selectionStart = this.selectionEnd = start + pasteText.length;
                handleInput();

                const indicator = document.getElementById('save-indicator');
                const orig = indicator.getAttribute('data-original') || 'Salvato';
                indicator.textContent = "AI Mod";
                indicator.style.opacity = '1';
                clearTimeout(window.saveIndicatorTimeout);
                window.saveIndicatorTimeout = setTimeout(() => { indicator.style.opacity = '0'; setTimeout(() => indicator.textContent = orig, 300); }, 1500);
            }
        });

        function handleInput() {
            const tab = tabs.find(t => t.id === activeTabId);
            if (tab) {
                tab.content = document.getElementById('editor').value;
                const lines = tab.content.split('\n');
                for (let line of lines) if (line.trim().startsWith('#')) { tab.name = line.replace(/#/g, '').trim().substring(0, 20); break; }
                if (!tab.name || tab.name === "") tab.name = lines[0].substring(0, 15) || getStr('tab_untitled');
                tab.updatedAt = new Date().toLocaleString(currentLang === 'it' ? 'it-IT' : 'en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
            }
            clearTimeout(autoSaveTimeout);
            autoSaveTimeout = setTimeout(() => { saveToStorage(); showSavedIndicator(); }, 1000);

            clearTimeout(previewTimeout);
            previewTimeout = setTimeout(() => { updatePreview(); }, 300);

            updateStats();
        }
        async function saveToStorage() {
            try {
                await idbKeyval.set('minipad_tabs', tabs);
            } catch (e) {
                console.error("Save failed", e);
            }
        }
        function showSavedIndicator() {
            const el = document.getElementById('save-indicator');
            el.style.opacity = '1';
            clearTimeout(window.saveIndicatorTimeout);
            window.saveIndicatorTimeout = setTimeout(() => el.style.opacity = '0', 2000);
        }

        function toggleView(mode) {
            const eP = document.getElementById('editor-pane');
            const pP = document.getElementById('preview-pane');
            if (mode === 'split') {
                eP.classList.remove('hidden'); pP.classList.remove('hidden');
                eP.style.width = '50%'; pP.style.width = '50%';
            } else if (mode === 'editor') {
                eP.classList.remove('hidden'); pP.classList.add('hidden');
                eP.style.width = '100%';
            } else if (mode === 'preview') {
                eP.classList.add('hidden'); pP.classList.remove('hidden');
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

        const baseThemes = ['', 'sepia', 'hacker'];
        function toggleDarkMode() {
            const isDark = document.body.classList.toggle('dark-mode');
            try { localStorage.setItem('minipad_dark_mode', isDark); } catch (e) { }
            showToast(`Modalità: ${isDark ? 'Scura' : 'Chiara'}`);
        }

        function cycleTheme() {
            let current = document.body.getAttribute('data-theme') || '';
            let nextIndex = (baseThemes.indexOf(current) + 1) % baseThemes.length;
            let nextTheme = baseThemes[nextIndex];
            document.body.setAttribute('data-theme', nextTheme);
            try { localStorage.setItem('minipad_theme', nextTheme); } catch (e) { }
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

        function insertLink() {
            const field = document.getElementById('editor');
            const start = field.selectionStart, end = field.selectionEnd;
            const val = field.value;
            const selected = val.substring(start, end);
            const url = prompt('URL del link:', 'https://');
            if (!url) return;
            const linkText = selected || 'Testo del link';
            const md = `[${linkText}](${url})`;
            field.value = val.substring(0, start) + md + val.substring(end);
            field.focus();
            field.setSelectionRange(start, start + md.length);
            handleInput();
        }

        function insertHR() {
            const field = document.getElementById('editor');
            const start = field.selectionStart;
            const val = field.value;
            const hr = '\n---\n';
            field.value = val.substring(0, start) + hr + val.substring(start);
            field.focus();
            field.setSelectionRange(start + hr.length, start + hr.length);
            handleInput();
        }

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

        function openHelp() {
            const m = document.getElementById('help-modal');
            m.style.display = 'flex';
            m.style.zIndex = '3001'; // Above diagram modal
        }
        function closeHelp() { document.getElementById('help-modal').style.display = 'none'; }
        function handleShortcuts(e) {
            const field = document.getElementById('editor');
            const val = field.value;
            const start = field.selectionStart;
            const end = field.selectionEnd;

            // Ctrl+S: Save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveNow(); return; }

            // Ctrl+B: Bold
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); insertMarkdown('**', '**'); return; }

            // Ctrl+I: Italic
            if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); insertMarkdown('*', '*'); return; }

            // Ctrl+K: Insert link
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                const selected = val.substring(start, end);
                const url = prompt('URL link:', 'https://');
                if (url) {
                    const linkText = selected || 'Testo del link';
                    const md = `[${linkText}](${url})`;
                    field.value = val.substring(0, start) + md + val.substring(end);
                    field.focus();
                    field.setSelectionRange(start, start + md.length);
                    handleInput();
                }
                return;
            }

            // ESC: Exit Zen Mode only (don't exit fullscreen)
            if (e.key === 'Escape') {
                if (document.body.classList.contains('zen-mode')) {
                    e.preventDefault();
                    document.body.classList.remove('zen-mode');
                    // fullscreen stays until user manually toggles
                }
                return;
            }

            // TAB + SHIFT+TAB: Indent/dedent list items or insert spaces
            if (e.key === 'Tab') {
                e.preventDefault();
                const lineStart = val.lastIndexOf('\n', start - 1) + 1;
                const lineContent = val.substring(lineStart, start);
                const listMatch = lineContent.match(/^(\s*)([-*]\s|\d+\.\s|\[\s?[xX]?\]\s)/);
                if (listMatch) {
                    // Indent/dedent the list item
                    const lineEnd = val.indexOf('\n', start);
                    const fullLineEnd = lineEnd === -1 ? val.length : lineEnd;
                    const fullLine = val.substring(lineStart, fullLineEnd);
                    if (!e.shiftKey) {
                        const newLine = '  ' + fullLine;
                        field.value = val.substring(0, lineStart) + newLine + val.substring(fullLineEnd);
                        field.setSelectionRange(start + 2, start + 2);
                    } else {
                        // Dedent: remove up to 2 leading spaces
                        const newLine = fullLine.replace(/^\s{1,2}/, '');
                        const removed = fullLine.length - newLine.length;
                        field.value = val.substring(0, lineStart) + newLine + val.substring(fullLineEnd);
                        field.setSelectionRange(Math.max(start - removed, lineStart), Math.max(start - removed, lineStart));
                    }
                    handleInput();
                } else {
                    // Insert 2 spaces for code indentation
                    field.value = val.substring(0, start) + '  ' + val.substring(end);
                    field.setSelectionRange(start + 2, start + 2);
                    handleInput();
                }
                return;
            }

            // ENTER: Continue list items automatically
            if (e.key === 'Enter') {
                const lineStart = val.lastIndexOf('\n', start - 1) + 1;
                const lineContent = val.substring(lineStart, start);

                // Check for ordered list: e.g. "1. " or "  2. "
                const orderedMatch = lineContent.match(/^(\s*)(\d+)(\.\s)(.*)/);
                if (orderedMatch) {
                    const indent = orderedMatch[1];
                    const num = parseInt(orderedMatch[2]);
                    const itemContent = orderedMatch[4].trim();
                    if (!itemContent) {
                        // Empty item: exit list
                        const removeLen = lineContent.length;
                        e.preventDefault();
                        field.value = val.substring(0, lineStart) + '\n' + val.substring(start);
                        field.setSelectionRange(lineStart + 1, lineStart + 1);
                        handleInput();
                    } else {
                        e.preventDefault();
                        const nextLine = `\n${indent}${num + 1}. `;
                        field.value = val.substring(0, start) + nextLine + val.substring(end);
                        field.setSelectionRange(start + nextLine.length, start + nextLine.length);
                        handleInput();
                    }
                    return;
                }

                // Check for unordered list (- , * , - [ ] )
                const unorderedMatch = lineContent.match(/^(\s*)([-*]\s(?:\[[ xX]?\]\s)?)(.*)/);
                if (unorderedMatch) {
                    const indent = unorderedMatch[1];
                    const prefix = unorderedMatch[2];
                    const itemContent = unorderedMatch[3].trim();
                    const cleanPrefix = prefix.replace(/\[[ xX]?\]\s/, '[ ] '); // Reset checkbox
                    if (!itemContent) {
                        // Empty item: exit list
                        e.preventDefault();
                        field.value = val.substring(0, lineStart) + '\n' + val.substring(start);
                        field.setSelectionRange(lineStart + 1, lineStart + 1);
                        handleInput();
                    } else {
                        e.preventDefault();
                        const nextLine = `\n${indent}${cleanPrefix}`;
                        field.value = val.substring(0, start) + nextLine + val.substring(end);
                        field.setSelectionRange(start + nextLine.length, start + nextLine.length);
                        handleInput();
                    }
                    return;
                }
            }
        }

        function toggleFullScreen() { !document.fullscreenElement ? document.documentElement.requestFullscreen() : document.exitFullscreen(); }

        function updateStats() {
            const text = document.getElementById('editor').value;
            const chars = text.length;
            const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
            const lines = text.split('\n').length;
            const pages = Math.max(1, Math.ceil(chars / 1800)); // ≈1800 chars per page

            document.getElementById('status-left').textContent = `Caratteri: ${chars} | Parole: ${words} | Righe: ${lines} | ~${pages} pag.`;
        }

