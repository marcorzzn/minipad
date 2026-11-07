<p align="center">
  <img src="icon.svg" width="96" height="96" alt="MiniPad Logo">
</p>

<h1 align="center">MiniPad</h1>

<p align="center">
  <strong>Editor di testo Markdown, LaTeX e Diagrammi Mermaid gratuito, leggerissimo e 100% locale nel tuo browser.</strong><br>
  <em>Free, feather-light, privacy-first Markdown, LaTeX & Mermaid editor running 100% client-side.</em>
</p>

<p align="center">
  <a href="https://marcorzzn.github.io/minipad/"><img src="https://img.shields.io/badge/Web_App-Live_Demo-success?style=flat-square&logo=googlechrome&logoColor=white" alt="Live Demo"></a>
  <a href="https://github.com/marcorzzn/minipad/releases/tag/v1.5.8.1"><img src="https://img.shields.io/badge/Release-v1.5.8.1-blue.svg?style=flat-square" alt="Release"></a>
  <img src="https://img.shields.io/badge/License-MIT-green.svg?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/PWA-Ready-orange.svg?style=flat-square" alt="PWA">
  <img src="https://img.shields.io/badge/Privacy-100%25_Local-purple.svg?style=flat-square" alt="Privacy First">
</p>

---

## ✨ Funzionalità Principali / Main Features

- 🖨️ **Suite Avanzata di Impaginazione, Stampa & PDF A4**:
  - **Personalizzazione completa del layout**: scelta di margini foglio (*Stretti 10mm*, *Normali 15mm*, *Ampi 25mm*, *Minimi 6mm*), orientamento (*Verticale/Orizzontale*), font di stampa (*Moderno Sans-serif*, *Classico Serif*, *Monospazio Tecnico*), dimensione carattere e interlinea (*Compatta*, *Standard*, *Ampia*).
  - **Stili di documento**: *Pulito con accenti*, *Accademico B&W* (ideale per stampa laser su carta senza spreco di inchiostro), *Editoriale Formale*.
  - **Regole anti-spezzamento intelligenti**: evita il troncamento a metà pagina di elementi delle liste (`li`), tabelle (`tr`), blocchi di codice (`pre`), formule matematiche KaTeX (`.katex-display`), citazioni (`blockquote`) e diagrammi Mermaid.
  - **Intestazioni & piè di pagina dinamici**: opzione per mostrare titolo in alto e data/ora precisa di generazione in basso.
  - **Supporto universale salto pagina**: sintassi flessibile (`\pagebreak`, `<!-- pagebreak -->`, `---pagebreak---`, `<div class="page-break"></div>`) con visualizzatore visivo tratteggiato `✂ Salto Pagina (A4)` in anteprima live per verificare la divisione foglio prima di stampare.
  - **Doppio canale di output**: *Stampa / Salva PDF Vettoriale* ad altissima definizione tipografica oppure *Scarica PDF Diretto* in un clic.

- 📊 **Modale Centrale Diagrammi Mermaid Integrato**:
  - Finestra modale centrale in stile *Mac Classic* con 7 categorie pronte (*Flowchart*, *Sequence*, *Class*, *State*, *Pie*, *Mindmap*, *Git Graph*).
  - Galleria di template predefiniti per avviare rapidamente qualsiasi schema.
  - Editor di codice integrato con anteprima live in tempo reale (debounced a 250ms), supporto tema scuro automatico e inserimento diretto al cursore in EasyMDE/CodeMirror.

- 🧮 **Matematica Avanzata (LaTeX con KaTeX) & Palette Ricerca**:
  - Oltre 300 simboli ed espressioni catalogati per domini scientifici (*Alfabeto Greco*, *Analisi & Calcolo*, *Algebra & Geometria*, *Fisica & Scienze*, *Logica & Insiemi*, *Simboli & Notazione*).
  - Selettore a discesa compatto senza barre di scorrimento orizzontali ingombranti e campo di ricerca istantanea live con contatore risultati.
  - Isolamento completo dai conflitti Markdown grazie a tokenizzazione nonce-based che protegge equazioni inline `$ ... $`, blocchi `$$ ... $$` e valute `$19,99`.

- 🖥️ **Design "Mac Classic" & Toolbar Fluida**:
  - Toolbar superiore a larghezza piena auto-adattiva (`100%`) senza spazi vuoti sui display widescreen.
  - Icone dedicate per l'esploratore di Schede & Gruppi (`#i-tabs-sidebar`) e pulsante di salvataggio rapido (`💾`) accessibile direttamente accanto a `File ▾`.

- 💬 **Indicizzatore Intelligente Chat AI (Stile DeepSeek)**:
  - Modale dedicato per incollare intere conversazioni da ChatGPT, Claude, DeepSeek o Gemini.
  - Riconoscimento automatico dei turni di dialogo Utente/Assistente con formattazione tipografica chiara (`> 💬 Utente:`).
  - Pannello laterale di navigazione ad albero interattivo con salto sincronizzato tra editor e anteprima.
  - Generazione automatica dell'indice della conversazione (TOC) integrabile nel testo o navigabile dal cassetto laterale.

- 🤖 **Smart Paste per AI & Fonti Scientifiche**:
  - Incolla contenuti formattati da ChatGPT, Claude, Gemini, Wikipedia, arXiv o portali KaTeX/MathML.
  - Estrazione automatica del LaTeX sorgente originale dai tag `<annotation>`, normalizzazione automatica dei delimitatori `\[ \]` e `\( \)` in `$$` e `$`, con protezione selettiva di codice e valute.

- 💾 **Esportazione Professionale Multi-Formato**:
  - **Markdown (.md)**: sorgente Markdown standard pulito.
  - **HTML Standalone (.html)**: documento autonomo visualizzabile offline con KaTeX e Mermaid incorporati.
  - **LaTeX (.tex)**: codice compilabile con `pdflatex`, con conversione automatica delle tabelle in `\begin{tabular}`, codice in `\texttt{...}` e salti pagina in `\clearpage`.
  - **PDF (.pdf)**: documento A4 esportabile direttamente o via stampa vettoriale nativa.
  - **Plain Text (.txt)**: testo puro con formule matematiche e blocchi di codice preservati senza perdita di dati.

- 📁 **Esplora Note & Gruppi con Drag & Drop**:
  - Organizza gli appunti in cartelle e gruppi personalizzati con drag & drop HTML5, barra di ricerca istantanea e menu contestuale tasto destro.

- 🔒 **100% Locale, Offline & Privacy-First (PWA)**:
  - Architettura serverless: nessun dato viene mai trasmesso a server esterni. Tutto risiede in locale nel browser (IndexedDB con fallback).
  - Installabile come Progressive Web App (PWA) su Windows, macOS, Linux, Android e iOS con Service Worker aggiornato e supporto offline completo.

- 🧘 **Modalità Zen, Temi & Bilingue**:
  - Switch istantaneo tra vista divisa, solo editor, solo anteprima e modalità Zen a schermo intero.
  - Temi Chiaro, Scuro, Sepia e Hacker con commutazione lingua IT/EN al volo.

---

## 🚀 Come Usarlo / How to Use

Minipad non richiede configurazione né installazione di server:

1. **Uso Web**: Visita direttamente la web app su [marcorzzn.github.io/minipad](https://marcorzzn.github.io/minipad/).
2. **Uso Offline Standalone**: Scarica il repository, scompatta l'archivio e apri `index.html` con qualsiasi browser.
3. **Installazione PWA**: Apri il menu **File** e seleziona **📱 Installa Minipad** per usarlo come app desktop o mobile nativa.

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
