const diagramTemplates = [
    { category: "Blocchi", title: "Riquadro Testo", code: "+-------+\n| testo |\n+-------+" },
    { category: "Blocchi", title: "Etichetta", code: "[concetto]" },
    { category: "Blocchi", title: "Bolla", code: "(_____)" },
    { category: "Frecce", title: "Destra", code: "---->" },
    { category: "Frecce", title: "Sinistra", code: "<----" },
    { category: "Frecce", title: "Doppia", code: "<====>" },
    { category: "Frecce", title: "Freccia Curva", code: ".-->" },
    { category: "Frecce", title: "Verticale (Giu')", code: "  |\n  v" },
    { category: "Frecce", title: "Verticale (Su)", code: "  ^\n  |" },
    { category: "Forme", title: "Cerchio", code: " .-. \n(   )\n '-'" },
    { category: "Forme", title: "Rombo", code: "  /\\  \n /  \\ \n \\  / \n  \\/" },
    { category: "Forme", title: "Nuvola", code: "   .-\"\"-.   \n .'      '. \n(          )\n '-.____.-' " },
    { category: "Template rapidi", title: "Catena Dati", code: "```text\n[A] ---> [B] ---> [C]\n```" },
    { category: "Template rapidi", title: "Ciclo di Controllo", code: "```text\n[Inizio] --> [Azione] --> [Controllo] --No--> [Azione]\n                             |\n                            Si\n                             |\n                             v\n                           [Fine]\n```" },
    { category: "Template rapidi", title: "Mappa 3 Nodi", code: "```text\n          [Tema Centrale]\n            /         \\\n      [Ramo 1]      [Ramo 2]\n```" },
    { category: "Template rapidi", title: "Albero Cartelle", code: "```text\nProgetto/\n ├── Src/\n │   ├── index.html\n │   └── style.css\n └── Assets/\n     └── logo.png\n```" }
];

const i18n = {
    'it': {
        'file': 'File',
        'new': 'Nuova Scheda',
        'open': 'Apri/Importa File',
        'save_as': 'Salva con nome...',
        'export_pdf': 'Stampa / Esporta PDF',
        'export_html': 'Esporta .html',
        'export_md': 'Esporta .md',
        'export_tex': 'Esporta .tex (LaTeX)',
        'export_txt': 'Esporta .txt',
        'save_title': 'Salva (Ctrl+S)',
        'clear_editor': 'Svuota Editor',
        'backup_json': 'Backup JSON',
        'restore_backup': 'Ripristina Backup',
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
        'btn_guida': 'Informazioni / Guida',
        'btn_find': 'Cerca (Ctrl+F)',
        'btn_toc': 'Genera Indice (TOC)'
    },
    'en': {
        'file': 'File',
        'new': 'New Note',
        'open': 'Open/Import File',
        'save_as': 'Save as...',
        'export_pdf': 'Print / Export PDF',
        'export_html': 'Export .html',
        'export_md': 'Export .md',
        'export_tex': 'Export .tex (LaTeX)',
        'export_txt': 'Export .txt',
        'save_title': 'Save (Ctrl+S)',
        'clear_editor': 'Clear Editor',
        'backup_json': 'Backup JSON',
        'restore_backup': 'Restore Backup',
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
        'btn_guida': 'About / Help',
        'btn_find': 'Find (Ctrl+F)',
        'btn_toc': 'Generate TOC'
    }
};
const mathCategories = {
            // ── GREEK ──
            "Greco min.": [
                { cmd: "\\alpha", html: "\\alpha" }, { cmd: "\\beta", html: "\\beta" },
                { cmd: "\\gamma", html: "\\gamma" }, { cmd: "\\delta", html: "\\delta" },
                { cmd: "\\epsilon", html: "\\epsilon" }, { cmd: "\\zeta", html: "\\zeta" },
                { cmd: "\\eta", html: "\\eta" }, { cmd: "\\theta", html: "\\theta" },
                { cmd: "\\iota", html: "\\iota" }, { cmd: "\\kappa", html: "\\kappa" },
                { cmd: "\\lambda", html: "\\lambda" }, { cmd: "\\mu", html: "\\mu" },
                { cmd: "\\nu", html: "\\nu" }, { cmd: "\\xi", html: "\\xi" },
                { cmd: "\\pi", html: "\\pi" }, { cmd: "\\rho", html: "\\rho" },
                { cmd: "\\sigma", html: "\\sigma" }, { cmd: "\\tau", html: "\\tau" },
                { cmd: "\\upsilon", html: "\\upsilon" }, { cmd: "\\phi", html: "\\phi" },
                { cmd: "\\chi", html: "\\chi" }, { cmd: "\\psi", html: "\\psi" },
                { cmd: "\\omega", html: "\\omega" }
            ],
            "Greco mai.": [
                { cmd: "\\Gamma", html: "\\Gamma" }, { cmd: "\\Delta", html: "\\Delta" },
                { cmd: "\\Theta", html: "\\Theta" }, { cmd: "\\Lambda", html: "\\Lambda" },
                { cmd: "\\Xi", html: "\\Xi" }, { cmd: "\\Pi", html: "\\Pi" },
                { cmd: "\\Sigma", html: "\\Sigma" }, { cmd: "\\Upsilon", html: "\\Upsilon" },
                { cmd: "\\Phi", html: "\\Phi" }, { cmd: "\\Psi", html: "\\Psi" },
                { cmd: "\\Omega", html: "\\Omega" }
            ],
            "Greco var.": [
                { cmd: "\\varepsilon", html: "\\varepsilon" }, { cmd: "\\varphi", html: "\\varphi" },
                { cmd: "\\varpi", html: "\\varpi" }, { cmd: "\\varrho", html: "\\varrho" },
                { cmd: "\\varsigma", html: "\\varsigma" }, { cmd: "\\vartheta", html: "\\vartheta" },
                { cmd: "\\varkappa", html: "\\varkappa" }
            ],
            // ── INTEGRALI ──
            "Integrali": [
                { cmd: "\\int", html: "\\int" },
                { cmd: "\\int_{a}^{b}", html: "\\int_{a}^{b}" },
                { cmd: "\\int_{a}^{b} f(x)\\,dx", html: "\\int_{a}^{b} f(x)\\,dx" },
                { cmd: "\\int_{0}^{\\infty} f(x)\\,dx", html: "\\int_{0}^{\\infty} f(x)\\,dx" },
                { cmd: "\\int_{-\\infty}^{+\\infty} f(x)\\,dx", html: "\\int_{-\\infty}^{+\\infty} f(x)\\,dx" },
                { cmd: "\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}", html: "\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}" },
                { cmd: "\\iint_{D}", html: "\\iint_{D}" },
                { cmd: "\\iint_{D} f(x,y)\\,dA", html: "\\iint_{D} f(x,y)\\,dA" },
                { cmd: "\\iiint_{V}", html: "\\iiint_{V}" },
                { cmd: "\\iiint_{V} f(x,y,z)\\,dV", html: "\\iiint_{V} f(x,y,z)\\,dV" },
                { cmd: "\\oint_{C}", html: "\\oint_{C}" },
                { cmd: "\\oint_{C} \\mathbf{F} \\cdot d\\mathbf{r}", html: "\\oint_{C} \\mathbf{F} \\cdot d\\mathbf{r}" },
                { cmd: "\\int_0^{2\\pi}", html: "\\int_0^{2\\pi}" },
                { cmd: "\\int_0^1", html: "\\int_0^1" },
                { cmd: "\\int_C f\\,ds", html: "\\int_C f\\,ds" },
                { cmd: "\\int_a^b u\\,dv = [uv]_a^b - \\int_a^b v\\,du", html: "\\int_a^b u\\,dv = [uv]_a^b - \\int_a^b v\\,du" }
            ],
            // ── DERIVATE ──
            "Derivate": [
                { cmd: "\\frac{d}{dx}", html: "\\frac{d}{dx}" },
                { cmd: "\\frac{dy}{dx}", html: "\\frac{dy}{dx}" },
                { cmd: "\\frac{d^2y}{dx^2}", html: "\\frac{d^2y}{dx^2}" },
                { cmd: "\\frac{d^n y}{dx^n}", html: "\\frac{d^n y}{dx^n}" },
                { cmd: "\\frac{d}{dx}\\left[f(x)\\right]", html: "\\frac{d}{dx}\\left[f(x)\\right]" },
                { cmd: "\\frac{\\partial}{\\partial x}", html: "\\frac{\\partial}{\\partial x}" },
                { cmd: "\\frac{\\partial f}{\\partial x}", html: "\\frac{\\partial f}{\\partial x}" },
                { cmd: "\\frac{\\partial^2 f}{\\partial x^2}", html: "\\frac{\\partial^2 f}{\\partial x^2}" },
                { cmd: "\\frac{\\partial^2 f}{\\partial x \\partial y}", html: "\\frac{\\partial^2 f}{\\partial x \\partial y}" },
                { cmd: "\\frac{\\partial^n f}{\\partial x^n}", html: "\\frac{\\partial^n f}{\\partial x^n}" },
                { cmd: "f'(x)", html: "f'(x)" }, { cmd: "f''(x)", html: "f''(x)" },
                { cmd: "f^{(n)}(x)", html: "f^{(n)}(x)" },
                { cmd: "\\dot{x}", html: "\\dot{x}" }, { cmd: "\\ddot{x}", html: "\\ddot{x}" },
                { cmd: "\\nabla f", html: "\\nabla f" }, { cmd: "\\nabla^2 f", html: "\\nabla^2 f" },
                { cmd: "\\frac{Df}{Dt}", html: "\\frac{Df}{Dt}" },
                { cmd: "\\left. \\frac{df}{dx} \\right|_{x=a}", html: "\\left. \\frac{df}{dx} \\right|_{x=a}" }
            ],
            // ── LIMITI ──
            "Limiti": [
                { cmd: "\\lim_{x \\to a}", html: "\\lim_{x \\to a}" },
                { cmd: "\\lim_{x \\to 0}", html: "\\lim_{x \\to 0}" },
                { cmd: "\\lim_{x \\to \\infty}", html: "\\lim_{x \\to \\infty}" },
                { cmd: "\\lim_{x \\to -\\infty}", html: "\\lim_{x \\to -\\infty}" },
                { cmd: "\\lim_{n \\to \\infty}", html: "\\lim_{n \\to \\infty}" },
                { cmd: "\\lim_{h \\to 0} \\frac{f(x+h)-f(x)}{h}", html: "\\lim_{h \\to 0} \\frac{f(x+h)-f(x)}{h}" },
                { cmd: "\\lim_{x \\to a^+}", html: "\\lim_{x \\to a^+}" },
                { cmd: "\\lim_{x \\to a^-}", html: "\\lim_{x \\to a^-}" },
                { cmd: "\\limsup_{n \\to \\infty}", html: "\\limsup_{n \\to \\infty}" },
                { cmd: "\\liminf_{n \\to \\infty}", html: "\\liminf_{n \\to \\infty}" },
                { cmd: "\\lim_{(x,y) \\to (0,0)}", html: "\\lim_{(x,y) \\to (0,0)}" },
                { cmd: "\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1", html: "\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1" },
                { cmd: "\\lim_{n \\to \\infty} \\left(1+\\frac{1}{n}\\right)^n = e", html: "\\lim_{n \\to \\infty} \\left(1+\\frac{1}{n}\\right)^n = e" }
            ],
            // ── SERIE ──
            "Serie": [
                { cmd: "\\sum_{n=0}^{\\infty} a_n", html: "\\sum_{n=0}^{\\infty} a_n" },
                { cmd: "\\sum_{n=1}^{N} a_n", html: "\\sum_{n=1}^{N} a_n" },
                { cmd: "\\sum_{n=0}^{\\infty} \\frac{x^n}{n!}", html: "\\sum_{n=0}^{\\infty} \\frac{x^n}{n!}" },
                { cmd: "\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}", html: "\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}" },
                { cmd: "\\sum_{n=0}^{\\infty} r^n = \\frac{1}{1-r}", html: "\\sum_{n=0}^{\\infty} r^n = \\frac{1}{1-r}" },
                { cmd: "f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x-a)^n", html: "f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x-a)^n" },
                { cmd: "e^x = \\sum_{n=0}^{\\infty} \\frac{x^n}{n!}", html: "e^x = \\sum_{n=0}^{\\infty} \\frac{x^n}{n!}" },
                { cmd: "\\sin x = \\sum_{n=0}^{\\infty} \\frac{(-1)^n x^{2n+1}}{(2n+1)!}", html: "\\sin x = \\sum_{n=0}^{\\infty} \\frac{(-1)^n x^{2n+1}}{(2n+1)!}" },
                { cmd: "\\prod_{i=1}^{n} a_i", html: "\\prod_{i=1}^{n} a_i" },
                { cmd: "\\sum_{k=0}^{n} \\binom{n}{k} a^k b^{n-k}", html: "\\sum_{k=0}^{n} \\binom{n}{k} a^k b^{n-k}" }
            ],
            // ── TRIGONOMETRIA ──
            "Trigon.": [
                { cmd: "\\sin(x)", html: "\\sin(x)" }, { cmd: "\\cos(x)", html: "\\cos(x)" },
                { cmd: "\\tan(x)", html: "\\tan(x)" }, { cmd: "\\cot(x)", html: "\\cot(x)" },
                { cmd: "\\sec(x)", html: "\\sec(x)" }, { cmd: "\\csc(x)", html: "\\csc(x)" },
                { cmd: "\\arcsin(x)", html: "\\arcsin(x)" }, { cmd: "\\arccos(x)", html: "\\arccos(x)" },
                { cmd: "\\arctan(x)", html: "\\arctan(x)" },
                { cmd: "\\sinh(x)", html: "\\sinh(x)" }, { cmd: "\\cosh(x)", html: "\\cosh(x)" },
                { cmd: "\\tanh(x)", html: "\\tanh(x)" }, { cmd: "\\coth(x)", html: "\\coth(x)" },
                { cmd: "\\sin^2 x + \\cos^2 x = 1", html: "\\sin^2 x + \\cos^2 x = 1" },
                { cmd: "\\sin(A \\pm B) = \\sin A\\cos B \\pm \\cos A\\sin B", html: "\\sin(A \\pm B) = \\sin A\\cos B \\pm \\cos A\\sin B" },
                { cmd: "\\cos(A \\pm B) = \\cos A\\cos B \\mp \\sin A\\sin B", html: "\\cos(A \\pm B) = \\cos A\\cos B \\mp \\sin A\\sin B" },
                { cmd: "\\tan(A+B) = \\frac{\\tan A + \\tan B}{1 - \\tan A\\tan B}", html: "\\tan(A+B) = \\frac{\\tan A + \\tan B}{1 - \\tan A\\tan B}" }
            ],
            // ── FUNZIONI SPECIALI ──
            "Funz. Spec.": [
                { cmd: "\\Gamma(n) = (n-1)!", html: "\\Gamma(n) = (n-1)!" },
                { cmd: "\\Gamma(z) = \\int_0^{\\infty} t^{z-1} e^{-t}\\,dt", html: "\\Gamma(z) = \\int_0^{\\infty} t^{z-1} e^{-t}\\,dt" },
                { cmd: "B(x,y) = \\frac{\\Gamma(x)\\Gamma(y)}{\\Gamma(x+y)}", html: "B(x,y) = \\frac{\\Gamma(x)\\Gamma(y)}{\\Gamma(x+y)}" },
                { cmd: "\\zeta(s) = \\sum_{n=1}^{\\infty} \\frac{1}{n^s}", html: "\\zeta(s) = \\sum_{n=1}^{\\infty} \\frac{1}{n^s}" },
                { cmd: "\\text{erf}(x) = \\frac{2}{\\sqrt{\\pi}}\\int_0^x e^{-t^2}\\,dt", html: "\\text{erf}(x) = \\frac{2}{\\sqrt{\\pi}}\\int_0^x e^{-t^2}\\,dt" },
                { cmd: "\\text{erfc}(x) = 1 - \\text{erf}(x)", html: "\\text{erfc}(x) = 1 - \\text{erf}(x)" },
                { cmd: "J_n(x)", html: "J_n(x)" },
                { cmd: "P_n(x)", html: "P_n(x)" },
                { cmd: "H_n(x)", html: "H_n(x)" },
                { cmd: "\\text{Li}_2(x) = -\\int_0^x \\frac{\\ln(1-t)}{t}\\,dt", html: "\\text{Li}_2(x) = -\\int_0^x \\frac{\\ln(1-t)}{t}\\,dt" },
                { cmd: "\\psi(x) = \\frac{\\Gamma'(x)}{\\Gamma(x)}", html: "\\psi(x) = \\frac{\\Gamma'(x)}{\\Gamma(x)}" }
            ],
            // ── PROBABILITÀ ──
            "Probabilità": [
                { cmd: "P(A)", html: "P(A)" },
                { cmd: "P(A \\mid B)", html: "P(A \\mid B)" },
                { cmd: "P(A \\cap B) = P(A)P(B\\mid A)", html: "P(A \\cap B) = P(A)P(B\\mid A)" },
                { cmd: "P(A \\cup B) = P(A)+P(B)-P(A\\cap B)", html: "P(A \\cup B) = P(A)+P(B)-P(A\\cap B)" },
                { cmd: "\\mathbb{E}[X]", html: "\\mathbb{E}[X]" },
                { cmd: "\\mathbb{E}[X] = \\sum_x x\\, P(X=x)", html: "\\mathbb{E}[X] = \\sum_x x\\, P(X=x)" },
                { cmd: "\\operatorname{Var}(X) = \\mathbb{E}[X^2] - (\\mathbb{E}[X])^2", html: "\\operatorname{Var}(X) = \\mathbb{E}[X^2] - (\\mathbb{E}[X])^2" },
                { cmd: "\\bar{X} = \\frac{1}{n}\\sum_{i=1}^n X_i", html: "\\bar{X} = \\frac{1}{n}\\sum_{i=1}^n X_i" },
                { cmd: "X \\sim \\mathcal{N}(\\mu, \\sigma^2)", html: "X \\sim \\mathcal{N}(\\mu, \\sigma^2)" },
                { cmd: "f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}", html: "f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}" },
                { cmd: "X \\sim \\text{Bin}(n,p)", html: "X \\sim \\text{Bin}(n,p)" },
                { cmd: "X \\sim \\text{Pois}(\\lambda)", html: "X \\sim \\text{Pois}(\\lambda)" },
                { cmd: "\\rho_{XY} = \\frac{\\operatorname{Cov}(X,Y)}{\\sigma_X \\sigma_Y}", html: "\\rho_{XY} = \\frac{\\operatorname{Cov}(X,Y)}{\\sigma_X \\sigma_Y}" }
            ],
            // ── FISICA ──
            "Fisica": [
                { cmd: "\\nabla \\cdot \\mathbf{F}", html: "\\nabla \\cdot \\mathbf{F}" },
                { cmd: "\\nabla \\times \\mathbf{F}", html: "\\nabla \\times \\mathbf{F}" },
                { cmd: "\\nabla^2 f", html: "\\nabla^2 f" },
                { cmd: "\\mathbf{F} = m\\mathbf{a}", html: "\\mathbf{F} = m\\mathbf{a}" },
                { cmd: "\\mathbf{v} = \\frac{d\\mathbf{r}}{dt}", html: "\\mathbf{v} = \\frac{d\\mathbf{r}}{dt}" },
                { cmd: "\\mathcal{L} = T - V", html: "\\mathcal{L} = T - V" },
                { cmd: "\\mathcal{H} = T + V", html: "\\mathcal{H} = T + V" },
                { cmd: "E = mc^2", html: "E = mc^2" },
                { cmd: "\\hbar = \\frac{h}{2\\pi}", html: "\\hbar = \\frac{h}{2\\pi}" },
                { cmd: "\\frac{d}{dt}\\frac{\\partial \\mathcal{L}}{\\partial \\dot{q}} - \\frac{\\partial \\mathcal{L}}{\\partial q} = 0", html: "\\frac{d}{dt}\\frac{\\partial \\mathcal{L}}{\\partial \\dot{q}} - \\frac{\\partial \\mathcal{L}}{\\partial q} = 0" },
                { cmd: "\\oint \\mathbf{E} \\cdot d\\mathbf{A} = \\frac{Q}{\\varepsilon_0}", html: "\\oint \\mathbf{E} \\cdot d\\mathbf{A} = \\frac{Q}{\\varepsilon_0}" },
                { cmd: "\\nabla \\times \\mathbf{E} = -\\frac{\\partial \\mathbf{B}}{\\partial t}", html: "\\nabla \\times \\mathbf{E} = -\\frac{\\partial \\mathbf{B}}{\\partial t}" }
            ],
            // ── QUANTISTICA ──
            "Quantistica": [
                { cmd: "|\\psi\\rangle", html: "|\\psi\\rangle" },
                { cmd: "\\langle\\psi|", html: "\\langle\\psi|" },
                { cmd: "\\langle\\phi|\\psi\\rangle", html: "\\langle\\phi|\\psi\\rangle" },
                { cmd: "\\hat{H}|\\psi\\rangle = E|\\psi\\rangle", html: "\\hat{H}|\\psi\\rangle = E|\\psi\\rangle" },
                { cmd: "i\\hbar\\frac{\\partial}{\\partial t}|\\psi\\rangle = \\hat{H}|\\psi\\rangle", html: "i\\hbar\\frac{\\partial}{\\partial t}|\\psi\\rangle = \\hat{H}|\\psi\\rangle" },
                { cmd: "[\\hat{x},\\hat{p}] = i\\hbar", html: "[\\hat{x},\\hat{p}] = i\\hbar" },
                { cmd: "\\langle\\hat{A}\\rangle = \\langle\\psi|\\hat{A}|\\psi\\rangle", html: "\\langle\\hat{A}\\rangle = \\langle\\psi|\\hat{A}|\\psi\\rangle" },
                { cmd: "\\Delta x \\Delta p \\geq \\frac{\\hbar}{2}", html: "\\Delta x \\Delta p \\geq \\frac{\\hbar}{2}" }
            ],
            // ── EQ. DIFFERENZIALI ──
            "Eq. Diff.": [
                { cmd: "y' + p(x)y = q(x)", html: "y' + p(x)y = q(x)" },
                { cmd: "y'' + py' + qy = 0", html: "y'' + py' + qy = 0" },
                { cmd: "\\frac{d^2y}{dx^2} + \\omega^2 y = 0", html: "\\frac{d^2y}{dx^2} + \\omega^2 y = 0" },
                { cmd: "y(x) = C_1 e^{r_1 x} + C_2 e^{r_2 x}", html: "y(x) = C_1 e^{r_1 x} + C_2 e^{r_2 x}" },
                { cmd: "\\frac{\\partial u}{\\partial t} = k\\frac{\\partial^2 u}{\\partial x^2}", html: "\\frac{\\partial u}{\\partial t} = k\\frac{\\partial^2 u}{\\partial x^2}" },
                { cmd: "\\nabla^2 u = 0", html: "\\nabla^2 u = 0" },
                { cmd: "\\frac{\\partial^2 u}{\\partial t^2} = c^2\\nabla^2 u", html: "\\frac{\\partial^2 u}{\\partial t^2} = c^2\\nabla^2 u" },
                { cmd: "\\begin{cases} \\dot{x} = f(x,y) \\\\ \\dot{y} = g(x,y) \\end{cases}", html: "\\begin{cases} \\dot{x} = f(x,y) \\\\ \\dot{y} = g(x,y) \\end{cases}" }
            ],
            // ── ALGEBRA LINEARE ──
            "Algebra Lin.": [
                { cmd: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}", html: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}" },
                { cmd: "\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}", html: "\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}" },
                { cmd: "\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}", html: "\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}" },
                { cmd: "\\det(A) = ad - bc", html: "\\det(A) = ad - bc" },
                { cmd: "\\operatorname{tr}(A)", html: "\\operatorname{tr}(A)" },
                { cmd: "A^{-1}", html: "A^{-1}" }, { cmd: "A^T", html: "A^T" }, { cmd: "A^\\dagger", html: "A^\\dagger" },
                { cmd: "Av = \\lambda v", html: "Av = \\lambda v" },
                { cmd: "\\det(A - \\lambda I) = 0", html: "\\det(A - \\lambda I) = 0" },
                { cmd: "\\ker(A)", html: "\\ker(A)" }, { cmd: "\\operatorname{rank}(A)", html: "\\operatorname{rank}(A)" },
                { cmd: "\\langle u, v \\rangle", html: "\\langle u, v \\rangle" },
                { cmd: "\\|u\\|", html: "\\|u\\|" },
                { cmd: "u \\cdot v = \\|u\\|\\|v\\|\\cos\\theta", html: "u \\cdot v = \\|u\\|\\|v\\|\\cos\\theta" },
                { cmd: "\\begin{pmatrix} a_{11} & \\cdots & a_{1n} \\\\ \\vdots & \\ddots & \\vdots \\\\ a_{m1} & \\cdots & a_{mn} \\end{pmatrix}", html: "\\begin{pmatrix} a_{11} & \\cdots & a_{1n} \\\\ \\vdots & \\ddots & \\vdots \\\\ a_{m1} & \\cdots & a_{mn} \\end{pmatrix}" }
            ],
            // ── ANALISI COMPLESSA ──
            "Analisi Compl.": [
                { cmd: "z = a + bi", html: "z = a + bi" },
                { cmd: "\\bar{z} = a - bi", html: "\\bar{z} = a - bi" },
                { cmd: "|z| = \\sqrt{a^2+b^2}", html: "|z| = \\sqrt{a^2+b^2}" },
                { cmd: "e^{i\\theta} = \\cos\\theta + i\\sin\\theta", html: "e^{i\\theta} = \\cos\\theta + i\\sin\\theta" },
                { cmd: "e^{i\\pi} + 1 = 0", html: "e^{i\\pi} + 1 = 0" },
                { cmd: "\\operatorname{Re}(z)", html: "\\operatorname{Re}(z)" }, { cmd: "\\operatorname{Im}(z)", html: "\\operatorname{Im}(z)" },
                { cmd: "\\frac{1}{2\\pi i} \\oint_\\gamma \\frac{f(z)}{z-a}\\,dz = f(a)", html: "\\frac{1}{2\\pi i} \\oint_\\gamma \\frac{f(z)}{z-a}\\,dz = f(a)" },
                { cmd: "\\text{Res}(f, a)", html: "\\text{Res}(f, a)" },
                { cmd: "\\sum_{n=-\\infty}^{\\infty} c_n z^n", html: "\\sum_{n=-\\infty}^{\\infty} c_n z^n" }
            ],
            // ── STRUTTURE ──
            "Strutture": [
                { cmd: "\\frac{a}{b}", html: "\\frac{a}{b}" }, { cmd: "\\dfrac{a}{b}", html: "\\dfrac{a}{b}" },
                { cmd: "\\sqrt{x}", html: "\\sqrt{x}" }, { cmd: "\\sqrt[n]{x}", html: "\\sqrt[n]{x}" },
                { cmd: "\\binom{n}{k}", html: "\\binom{n}{k}" },
                { cmd: "\\begin{cases} x & \\text{se } x \\geq 0 \\\\ -x & \\text{se } x < 0 \\end{cases}", html: "\\begin{cases} x & \\text{se } x \\geq 0 \\\\ -x & \\text{se } x < 0 \\end{cases}" },
                { cmd: "\\underbrace{a+b}_{\\text{etich.}}", html: "\\underbrace{a+b}_{\\text{etich.}}" },
                { cmd: "\\overbrace{a+b}^{\\text{etich.}}", html: "\\overbrace{a+b}^{\\text{etich.}}" },
                { cmd: "\\overline{AB}", html: "\\overline{AB}" }, { cmd: "\\underline{abc}", html: "\\underline{abc}" },
                { cmd: "\\widehat{abc}", html: "\\widehat{abc}" }, { cmd: "\\widetilde{abc}", html: "\\widetilde{abc}" },
                { cmd: "\\overrightarrow{AB}", html: "\\overrightarrow{AB}" }, { cmd: "\\boxed{x}", html: "\\boxed{x}" }
            ],
            // ── COMBINATORIA ──
            "Combinatoria": [
                { cmd: "n!", html: "n!" }, { cmd: "\\binom{n}{k}", html: "\\binom{n}{k}" },
                { cmd: "P(n,k) = \\frac{n!}{(n-k)!}", html: "P(n,k) = \\frac{n!}{(n-k)!}" },
                { cmd: "\\sum_{k=0}^{n} \\binom{n}{k} = 2^n", html: "\\sum_{k=0}^{n} \\binom{n}{k} = 2^n" },
                { cmd: "(a+b)^n = \\sum_{k=0}^{n} \\binom{n}{k} a^k b^{n-k}", html: "(a+b)^n = \\sum_{k=0}^{n} \\binom{n}{k} a^k b^{n-k}" },
                { cmd: "\\left\\lfloor x \\right\\rfloor", html: "\\left\\lfloor x \\right\\rfloor" },
                { cmd: "\\left\\lceil x \\right\\rceil", html: "\\left\\lceil x \\right\\rceil" },
                { cmd: "a \\equiv b \\pmod{n}", html: "a \\equiv b \\pmod{n}" },
                { cmd: "\\gcd(a,b)", html: "\\gcd(a,b)" },
                { cmd: "\\phi(n)", html: "\\phi(n)" }, { cmd: "\\mu(n)", html: "\\mu(n)" }
            ],
            // ── LOGICA ──
            "Logica": [
                { cmd: "\\forall", html: "\\forall" }, { cmd: "\\exists", html: "\\exists" },
                { cmd: "\\nexists", html: "\\nexists" }, { cmd: "\\neg", html: "\\neg" },
                { cmd: "\\land", html: "\\land" }, { cmd: "\\lor", html: "\\lor" },
                { cmd: "\\implies", html: "\\implies" }, { cmd: "\\iff", html: "\\iff" },
                { cmd: "\\therefore", html: "\\therefore" }, { cmd: "\\because", html: "\\because" },
                { cmd: "\\top", html: "\\top" }, { cmd: "\\bot", html: "\\bot" },
                { cmd: "A \\cup B", html: "A \\cup B" }, { cmd: "A \\cap B", html: "A \\cap B" },
                { cmd: "A \\setminus B", html: "A \\setminus B" }, { cmd: "\\emptyset", html: "\\emptyset" },
                { cmd: "\\mathcal{P}(A)", html: "\\mathcal{P}(A)" },
                { cmd: "A \\times B", html: "A \\times B" }, { cmd: "\\aleph_0", html: "\\aleph_0" }
            ],
            // ── RELAZIONI ──
            "Relazioni": [
                { cmd: "<", html: "<" }, { cmd: ">", html: ">" },
                { cmd: "\\le", html: "\\le" }, { cmd: "\\ge", html: "\\ge" },
                { cmd: "\\ll", html: "\\ll" }, { cmd: "\\gg", html: "\\gg" },
                { cmd: "\\ne", html: "\\ne" }, { cmd: "\\approx", html: "\\approx" },
                { cmd: "\\equiv", html: "\\equiv" }, { cmd: "\\sim", html: "\\sim" },
                { cmd: "\\simeq", html: "\\simeq" }, { cmd: "\\cong", html: "\\cong" },
                { cmd: "\\propto", html: "\\propto" }, { cmd: "\\perp", html: "\\perp" },
                { cmd: "\\parallel", html: "\\parallel" }, { cmd: "\\mid", html: "\\mid" },
                { cmd: "\\prec", html: "\\prec" }, { cmd: "\\succ", html: "\\succ" },
                { cmd: "\\preceq", html: "\\preceq" }, { cmd: "\\succeq", html: "\\succeq" },
                { cmd: "\\models", html: "\\models" }, { cmd: "\\vdash", html: "\\vdash" },
                { cmd: "\\subset", html: "\\subset" }, { cmd: "\\supset", html: "\\supset" },
                { cmd: "\\subseteq", html: "\\subseteq" }, { cmd: "\\in", html: "\\in" }, { cmd: "\\notin", html: "\\notin" }
            ],
            // ── FRECCE ──
            "Frecce": [
                { cmd: "\\rightarrow", html: "\\rightarrow" }, { cmd: "\\leftarrow", html: "\\leftarrow" },
                { cmd: "\\leftrightarrow", html: "\\leftrightarrow" },
                { cmd: "\\Rightarrow", html: "\\Rightarrow" }, { cmd: "\\Leftarrow", html: "\\Leftarrow" },
                { cmd: "\\Leftrightarrow", html: "\\Leftrightarrow" },
                { cmd: "\\mapsto", html: "\\mapsto" }, { cmd: "\\to", html: "\\to" },
                { cmd: "\\longrightarrow", html: "\\longrightarrow" },
                { cmd: "\\xrightarrow{f}", html: "\\xrightarrow{f}" },
                { cmd: "\\xrightarrow[a]{b}", html: "\\xrightarrow[a]{b}" },
                { cmd: "\\hookleftarrow", html: "\\hookleftarrow" }, { cmd: "\\hookrightarrow", html: "\\hookrightarrow" },
                { cmd: "\\twoheadrightarrow", html: "\\twoheadrightarrow" },
                { cmd: "\\nearrow", html: "\\nearrow" }, { cmd: "\\nwarrow", html: "\\nwarrow" },
                { cmd: "\\searrow", html: "\\searrow" }, { cmd: "\\swarrow", html: "\\swarrow" },
                { cmd: "\\uparrow", html: "\\uparrow" }, { cmd: "\\downarrow", html: "\\downarrow" },
                { cmd: "\\circlearrowleft", html: "\\circlearrowleft" }, { cmd: "\\circlearrowright", html: "\\circlearrowright" }
            ],
            // ── OPERATORI ──
            "Operatori": [
                { cmd: "\\pm", html: "\\pm" }, { cmd: "\\mp", html: "\\mp" },
                { cmd: "\\times", html: "\\times" }, { cmd: "\\div", html: "\\div" },
                { cmd: "\\cdot", html: "\\cdot" }, { cmd: "\\circ", html: "\\circ" },
                { cmd: "\\oplus", html: "\\oplus" }, { cmd: "\\otimes", html: "\\otimes" },
                { cmd: "\\ominus", html: "\\ominus" }, { cmd: "\\oslash", html: "\\oslash" },
                { cmd: "\\odot", html: "\\odot" }, { cmd: "\\wedge", html: "\\wedge" }, { cmd: "\\vee", html: "\\vee" },
                { cmd: "\\cap", html: "\\cap" }, { cmd: "\\cup", html: "\\cup" },
                { cmd: "\\star", html: "\\star" }, { cmd: "\\bullet", html: "\\bullet" },
                { cmd: "\\bigcup_{i=1}^n", html: "\\bigcup_{i=1}^n" },
                { cmd: "\\bigcap_{i=1}^n", html: "\\bigcap_{i=1}^n" },
                { cmd: "\\bigoplus_{i=1}^n", html: "\\bigoplus_{i=1}^n" }
            ],
            // ── PARENTESI ──
            "Parentesi": [
                { cmd: "\\left( \\right)", html: "\\left( \\right)" },
                { cmd: "\\left[ \\right]", html: "\\left[ \\right]" },
                { cmd: "\\left\\{ \\right\\}", html: "\\left\\{ \\right\\}" },
                { cmd: "\\left| \\right|", html: "\\left| \\right|" },
                { cmd: "\\left\\| \\right\\|", html: "\\left\\| \\right\\|" },
                { cmd: "\\langle \\rangle", html: "\\langle \\rangle" },
                { cmd: "\\lfloor \\rfloor", html: "\\lfloor \\rfloor" },
                { cmd: "\\lceil \\rceil", html: "\\lceil \\rceil" },
                { cmd: "\\big( \\big)", html: "\\big( \\big)" },
                { cmd: "\\Big( \\Big)", html: "\\Big( \\Big)" },
                { cmd: "\\bigg( \\bigg)", html: "\\bigg( \\bigg)" },
                { cmd: "\\Bigg( \\Bigg)", html: "\\Bigg( \\Bigg)" },
                { cmd: "\\left. \\frac{df}{dx} \\right|_{x=0}", html: "\\left. \\frac{df}{dx} \\right|_{x=0}" }
            ],
            // ── INSIEMI NUMERICI ──
            "Insiemi Num.": [
                { cmd: "\\mathbb{N}", html: "\\mathbb{N}" }, { cmd: "\\mathbb{Z}", html: "\\mathbb{Z}" },
                { cmd: "\\mathbb{Q}", html: "\\mathbb{Q}" }, { cmd: "\\mathbb{R}", html: "\\mathbb{R}" },
                { cmd: "\\mathbb{C}", html: "\\mathbb{C}" }, { cmd: "\\mathbb{H}", html: "\\mathbb{H}" },
                { cmd: "\\mathbb{R}^n", html: "\\mathbb{R}^n" },
                { cmd: "\\mathbb{R}^{m \\times n}", html: "\\mathbb{R}^{m \\times n}" },
                { cmd: "\\mathbb{Z}/n\\mathbb{Z}", html: "\\mathbb{Z}/n\\mathbb{Z}" },
                { cmd: "\\mathbb{F}_q", html: "\\mathbb{F}_q" },
                { cmd: "\\mathbb{P}", html: "\\mathbb{P}" }
            ],
            // ── STILI FONT ──
            "Font": [
                { cmd: "\\mathbf{v}", html: "\\mathbf{v}" }, { cmd: "\\mathit{x}", html: "\\mathit{x}" },
                { cmd: "\\mathrm{d}", html: "\\mathrm{d}" }, { cmd: "\\mathsf{A}", html: "\\mathsf{A}" },
                { cmd: "\\mathtt{x}", html: "\\mathtt{x}" }, { cmd: "\\mathbb{R}", html: "\\mathbb{R}" },
                { cmd: "\\mathcal{A}", html: "\\mathcal{A}" }, { cmd: "\\mathcal{L}", html: "\\mathcal{L}" },
                { cmd: "\\mathcal{F}", html: "\\mathcal{F}" }, { cmd: "\\mathcal{H}", html: "\\mathcal{H}" },
                { cmd: "\\mathfrak{g}", html: "\\mathfrak{g}" }, { cmd: "\\mathfrak{h}", html: "\\mathfrak{h}" },
                { cmd: "\\text{parola}", html: "\\text{parola}" },
                { cmd: "\\boldsymbol{\\alpha}", html: "\\boldsymbol{\\alpha}" }
            ],
            // ── DECORATORI ──
            "Decoratori": [
                { cmd: "\\hat{x}", html: "\\hat{x}" }, { cmd: "\\check{x}", html: "\\check{x}" },
                { cmd: "\\tilde{x}", html: "\\tilde{x}" }, { cmd: "\\acute{x}", html: "\\acute{x}" },
                { cmd: "\\grave{x}", html: "\\grave{x}" }, { cmd: "\\breve{x}", html: "\\breve{x}" },
                { cmd: "\\dot{x}", html: "\\dot{x}" }, { cmd: "\\ddot{x}", html: "\\ddot{x}" },
                { cmd: "\\dddot{x}", html: "\\dddot{x}" }, { cmd: "\\vec{x}", html: "\\vec{x}" },
                { cmd: "\\bar{x}", html: "\\bar{x}" }, { cmd: "\\widehat{abc}", html: "\\widehat{abc}" },
                { cmd: "\\widetilde{abc}", html: "\\widetilde{abc}" },
                { cmd: "\\overrightarrow{AB}", html: "\\overrightarrow{AB}" },
                { cmd: "\\overline{abc}", html: "\\overline{abc}" }, { cmd: "\\underline{abc}", html: "\\underline{abc}" },
                { cmd: "\\overleftrightarrow{ABC}", html: "\\overleftrightarrow{ABC}" },
                { cmd: "\\boxed{x}", html: "\\boxed{x}" }
            ],
            // ── SPAZIATURA ──
            "Spaziatura": [
                { cmd: "\\quad", html: "\\quad" }, { cmd: "\\qquad", html: "\\qquad" },
                { cmd: "\\,", html: "\\," }, { cmd: "\\;", html: "\\;" },
                { cmd: "\\:", html: "\\:" }, { cmd: "\\!", html: "\\!" },
                { cmd: "\\ldots", html: "\\ldots" }, { cmd: "\\cdots", html: "\\cdots" },
                { cmd: "\\vdots", html: "\\vdots" }, { cmd: "\\ddots", html: "\\ddots" },
                { cmd: "\\ast", html: "\\ast" }, { cmd: "\\dagger", html: "\\dagger" },
                { cmd: "\\ddagger", html: "\\ddagger" }, { cmd: "\\prime", html: "\\prime" },
                { cmd: "^{\\circ}", html: "^{\\circ}" }
            ]
        };

        