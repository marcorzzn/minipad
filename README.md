# minipad 📝

**minipad** è un editor di testo gratuito e leggerissimo che gira interamente in locale nel tuo browser. Combina la semplicità di un blocco note con la potenza di **Markdown**, **LaTeX** e **Mermaid** per creare documenti, appunti matematici e diagrammi vettoriali.

*🇬🇧 **minipad** is an advanced, free, and feather-light text editor that runs entirely locally within your browser. It combines the simplicity of a notepad with the power of Markdown, LaTeX, and Mermaid to create documents, math notes, and vector diagrams.*

---

## ✨ Funzionalità Principali / Main Features

- 🌍 **Supporto Bilingue (IT/EN)**: Cambia lingua dell'interfaccia al volo con l'apposito pulsante in alto a destra. *(Bilingual Support: Switch UI language instantly on the fly).*
- 🔒 **100% Locale & Privacy-First**: Minipad è completamente serverless. Nessun dato viene mai inviato a server esterni; tutto funziona e si salva in modo persistente nel tuo browser (tramite IndexedDB con fallback su LocalStorage). *(100% Local & Privacy-First: No telemetry, no external databases. Everything persists safely inside your browser).*
- 🤖 **Smart Paste per AI & Fonti Scientifiche**: Incolla risposte da ChatGPT, Gemini, Claude, Wikipedia o portali scientifici (KaTeX, MathML, MathJax). Minipad estrae automaticamente il codice LaTeX originale da `<annotation>` e converte delimitatori `\[ \]` e `\( \)` in `$$` e `$`, proteggendo selettivamente codice e valute (es. `$19,99`). *(Smart Paste: Seamlessly paste AI or scientific text with automatic delimiter normalization and math/currency preservation).*
- 🧮 **Matematica Avanzata (LaTeX con KaTeX)**: Supporto nativo integrato con parsing isolato privo di conflitti Markdown. Usa formule inline `$ ... $` o blocchi `$$ ... $$` con palette rapida per simboli, matrici ed equazioni. *(Advanced Math: Native KaTeX rendering isolated from Markdown markup).*
- 📊 **Diagrammi Mermaid Integrati**: Compilazione visuale nativa in SVG per Flowchart, Sequence Diagram, Mindmap, Class Diagram e grafici logici in blocchi ````mermaid````. Include anche palette di template rapidi e retrocompatibilità per diagrammi ASCII. *(Native Mermaid Diagrams: Real-time SVG rendering for flowcharts, sequence diagrams, and mindmaps with strict security).*
- 💾 **Esportazione Professionale Multi-Formato**:
  - **Markdown (.md)**: sorgente originale pulito.
  - **HTML Standalone (.html)**: anteprima completa pronta da visualizzare e condividere.
  - **LaTeX (.tex)**: codice compilabile con `pdflatex`, con conversione automatica delle tabelle in `\begin{tabular}` e codice inline in `\texttt{...}`.
  - **PDF (.pdf)**: documento A4 generato in-app via `html2pdf.js`.
  - **Plain Text (.txt)**: testo puro con formule matematiche e blocchi di codice preservati senza perdita di dati.
  - **🖨️ Stampa Vettoriale**: impaginazione tipografica ad alta risoluzione tramite finestra di stampa del browser (`Ctrl+P`).
- 📁 **Esplora Note & Gruppi con Drag & Drop**: Organizza i tuoi appunti in cartelle e gruppi personalizzati con drag & drop nativo HTML5, barra di ricerca istantanea e menu contestuale tasto destro. *(Notes & Groups Explorer: Folders, drag & drop sorting, instant search filter, and custom context menus).*
- 📱 **PWA Installabile & Funzionante Offline**: Installabile su Desktop, Android e iOS come Progressive Web App (PWA) con Service Worker aggiornato e supporto offline completo. *(Installable PWA: Full offline capabilities on desktop and mobile).*
- 🧘 **Modalità Zen & Temi Personalizzati**: Scegli tra Vista Divisa (Editor + Anteprima), Solo Editor, Solo Anteprima o la "Modalità Zen" a schermo intero. Temi disponibili: Chiaro, Scuro, Sepia e Hacker. *(Zen Mode & Color Themes: Split view, Zen full-screen, Light, Dark, Sepia, and Hacker themes).*

---

## 🚀 Come Usarlo / How to Use

Minipad non richiede configurazione o server backend:

1. **Uso Web**: Naviga all'indirizzo online (es. [GitHub Pages](https://marcorzzn.github.io/minipad/)).
2. **Uso Offline Standalone**: Scarica il repository, scompatta e fai doppio clic su `index.html`.
3. **Installazione PWA**: Apri il menu **File** e clicca su **📱 Installa Minipad** per installarlo sul tuo sistema operativo.

---

## 🛠️ Tecnologie Utilizzate / Tech Stack

Minipad è costruito su standard web moderni in Vanilla JavaScript con zero overhead da framework pesanti:

* [EasyMDE](https://github.com/Ionaru/easy-markdown-editor) / [CodeMirror 5](https://codemirror.net/5/) - Editor di testo e syntax highlighting
* [Marked.js](https://marked.js.org/) & [marked-katex-extension](https://github.com/UziTech/marked-katex-extension) - Parsing ultraveloce Markdown e formule
* [KaTeX](https://katex.org/) - Rendering tipografico matematico ad alte prestazioni
* [Mermaid.js](https://mermaid.js.org/) - Generazione visuale diagrammi in SVG (con `securityLevel: 'strict'`)
* [Turndown](https://github.com/mixmark-io/turndown) - Conversione da HTML ad alta fedeltà a Markdown per Smart Paste
* [DOMPurify](https://github.com/cure53/DOMPurify) - Sanitizzazione XSS su anteprima e SVG
* [idb-keyval](https://github.com/jakearchibald/idb-keyval) - Persistenza asincrona IndexedDB con fallback locale
* [html2pdf.js](https://github.com/eKoopmans/html2pdf.js) - Generazione documenti PDF A4 lato client

---

## 📄 Licenza / License

Questo progetto è distribuito sotto licenza **MIT**. Sentiti libero di usarlo, studiarlo, modificarlo e condividerlo! *(MIT License).*
Vedi il file [LICENSE](LICENSE) per maggiori dettagli.
