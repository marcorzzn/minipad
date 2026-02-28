import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Math Button CSS
css_orig = """.math-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(28px, 1fr));
            gap: 2px;
        }

        /* The Compact Math Button Style */
        .math-btn {
            height: 28px;
            width: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #fff;
            border: 1px solid #ccc;
            border-radius: 2px;
            cursor: pointer;
            color: #000;
            font-size: 14px;
            transition: all 0.05s;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
            overflow: hidden;
        }"""
css_new = """.math-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
            gap: 6px;
            padding: 4px;
        }

        /* The Compact Math Button Style */
        .math-btn {
            height: 38px;
            width: 38px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #fff;
            border: 1px solid #ccc;
            border-radius: 6px;
            cursor: pointer;
            color: #000;
            font-size: 18px;
            transition: all 0.1s ease-in-out;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
            overflow: hidden;
        }"""
content = content.replace(css_orig, css_new)

# 2. Add Mobile Media Query
media_query = """
        /* --- MOBILE RESPONSIVENESS --- */
        @media (max-width: 768px) {
            #workspace { flex-direction: column; height: calc(100vh - 150px); }
            #editor-pane, #preview-pane { width: 100% !important; height: 50%; border-right: none; }
            #preview-pane { border-top: 1px solid var(--border-color); padding: 15px; }
            #toolbar { overflow-x: auto; flex-wrap: nowrap; padding-bottom: 2px; }
            .tool-group { flex-shrink: 0; }
            .modal-content { width: 95%; padding: 10px; }
            #titlebar { font-size: 11px; }
            .math-tabs { overflow-x: auto; flex-wrap: nowrap; padding-bottom: 2px; }
        }
        .hidden {"""
content = content.replace("        .hidden {", media_query)

# 3. Add onmousedown="saveSelection()" to Colors
content = content.replace('        <!-- Colors -->\n        <div class="tool-group">', '        <!-- Colors -->\n        <div class="tool-group" onmousedown="saveSelection()">')

# 4. Insert saveSelection variables
vars_orig = """        let tabs = [];
        let activeTabId = null;
        let autoSaveTimeout = null;"""
vars_new = """        let tabs = [];
        let activeTabId = null;
        let autoSaveTimeout = null;
        let previewTimeout = null;
        let savedSelection = null;

        function saveSelection() {
            const field = document.getElementById('editor');
            savedSelection = { start: field.selectionStart, end: field.selectionEnd };
        }"""
content = content.replace(vars_orig, vars_new)

# 5. Modify insertColor
insertColorOrig = """        function insertColor(prop, color) {
            const field = document.getElementById('editor');
            const start = field.selectionStart;
            const end = field.selectionEnd;
            const val = field.value;
            const selected = val.substring(start, end);
            field.value = val.substring(0, start) + `<span style="${prop}:${color}">` + selected + `</span>` + val.substring(end);
            handleInput();
        }"""
insertColorNew = """        function insertColor(prop, color) {
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
            
            // Re-select the inserted text
            setTimeout(() => {
                field.focus();
                field.setSelectionRange(start, start + insertText.length);
            }, 10);
            
            handleInput();
        }"""
content = content.replace(insertColorOrig, insertColorNew)

# 6. Debounce handleInput
handleInputOrig = """            clearTimeout(autoSaveTimeout);
            autoSaveTimeout = setTimeout(() => { saveToStorage(); showSavedIndicator(); }, 1000);
            updatePreview();
            updateStats();"""
handleInputNew = """            clearTimeout(autoSaveTimeout);
            autoSaveTimeout = setTimeout(() => { saveToStorage(); showSavedIndicator(); }, 1000);
            
            clearTimeout(previewTimeout);
            previewTimeout = setTimeout(() => { updatePreview(); }, 300);
            
            updateStats();"""
content = content.replace(handleInputOrig, handleInputNew)

# 7. Add extra math categories
math_ext = """
            "Analisi": [
                { cmd: "\\frac{d}{dx}", html: "\\frac{d}{dx}" }, { cmd: "\\frac{\\partial}{\\partial x}", html: "\\frac{\\partial}{\\partial x}" },
                { cmd: "\\int_{-\\infty}^{\\infty}", html: "\\int_{-\\infty}^{\\infty}" }, { cmd: "\\oint_C", html: "\\oint_C" },
                { cmd: "\\lim_{x \\to 0}", html: "\\lim_{x \\to 0}" }, { cmd: "\\lim_{n \\to \\infty}", html: "\\lim_{n \\to \\infty}" },
                { cmd: "\\sum_{i=1}^{n}", html: "\\sum_{i=1}^{n}" }, { cmd: "\\prod_{i=1}^{n}", html: "\\prod_{i=1}^{n}" },
                { cmd: "\\nabla", html: "\\nabla" }, { cmd: "\\Delta", html: "\\Delta" }, { cmd: "\\infty", html: "\\infty" }
            ],
            "Algebra": [
                { cmd: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}", html: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}" },
                { cmd: "\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}", html: "\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}" },
                { cmd: "\\det(A)", html: "\\det(A)" }, { cmd: "\\operatorname{tr}(A)", html: "\\operatorname{tr}(A)" },
                { cmd: "\\vec{v}", html: "\\vec{v}" }, { cmd: "\\mathbf{v}", html: "\\mathbf{v}" }, { cmd: "\\hat{v}", html: "\\hat{v}" },
                { cmd: "\\langle u, v \\rangle", html: "\\langle u, v \\rangle" }, { cmd: "\\| u \\|", html: "\\| u \\|" }, { cmd: "\\oplus", html: "\\oplus" }, { cmd: "\\otimes", html: "\\otimes" },
                { cmd: "\\dim", html: "\\dim" }, { cmd: "\\ker", html: "\\ker" }, { cmd: "\\Im", html: "\\Im" }
            ],"""

content = content.replace('"Relazioni":', math_ext.lstrip('\n') + '\n            "Relazioni":')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("success")
