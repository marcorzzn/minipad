# Changelog

Tutte le modifiche significative a questo progetto sono documentate in questo file.

## [v1.5.3.2] - 2026-11-06

### Fix Minori Esportazione LaTeX & Plain Text (`js/export.js`)

#### 1. Supporto Blockquote LaTeX (M1)
- Conversione dei blocchi di citazione Markdown (`> Citazione`) nell'ambiente nativo `\begin{quote}...\end{quote}`.

#### 2. Task List & Liste Annidate a Più Livelli (M2 + M3)
- **Task List**: conversione degli elementi `- [ ]` e `- [x]` in `\item[$\square$]` e `\item[$\boxtimes$]` (pacchetto `amssymb`).
- **Liste Annidate**: algoritmo ricorsivo indent-based (`convertNestedList`) che genera gerarchie arbitrarie di `\begin{itemize}` e `\begin{enumerate}` con corretta apertura e chiusura dei blocchi.

#### 3. Testo Barrato / Strikethrough (M4)
- Conversione della sintassi `~~testo~~` nel comando LaTeX `\sout{testo}`, con inclusione del pacchetto `\usepackage{ulem}` nel preambolo LaTeX.

#### 4. Rimozione Emoji nei Titoli per pdflatex (M5)
- Funzione `stripEmoji` applicata selettivamente agli argomenti di `\section`, `\subsection`, `\paragraph` e `\title{}` per prevenire errori di compilazione in ambienti LaTeX tradizionali a 8-bit (`pdflatex`).

#### 5. Un-escape Dollari Residui in TXT (M8)
- Ripristino finale di tutti i dollari escapati non numerici (es. `\$abc` -> `$abc`) nei file `.txt` esportati.

---

## [v1.5.3.1] - 2026-11-06

### Segnaposto Nonce-Based & Hardening Pipeline CommonMark

#### 1. Prevenzione Collisioni Segnaposto tramite Nonce Random (`js/preview.js`, `js/export.js`)
- **Nonce Univoco per Render (`generateRenderId`)**: ciascun ciclo di render genera un nonce crittografico o pseudo-casuale (formato `MP-{id}-CODE-N`, `MP-{id}-ICODE-N`, `MP-{id}-CUR-N`), azzerando qualsiasi rischio di collisione accidentale con testo utente o stringhe letterali (es. `@@MP_CODE_0@@`).
- **Eliminazione Loop Fragili**: la garanzia di unicità strutturale elimina la necessità di cicli `while` iterativi di espansione dei placeholder, semplificando e velocizzando il ripristino.

#### 2. Priorità e Isolamento Multi-Backtick
- **Ordine di Estrazione Rigoroso**: i code span con doppi o più backtick vengono estratti e protetti rigorosamente *prima* dei backtick singoli.
- **Isolamento Valute Preventivo**: isolamento immediato delle valute escapate `\$19,99` per evitare che vengano agganciate da delimitatori matematici.

---

## [v1.5.3] - 2026-11-06

### Conformità CommonMark, Rifinitura i18n & Hardening Pipeline

#### 1. Code Spans Multi-Backtick CommonMark (`js/preview.js`, `js/export.js`)
- **Supporto Completo ai Fence Multipli**: implementata la gestione rigorosa dei blocchi inline con due o più backtick (es. \`\` \`inline\` \`\`), consentendo l'inclusione di backtick letterali senza annidamenti spuri di tag `<code>`.
- **Regola di Stripping Spazi CommonMark**: rimozione conforme dello spazio perimetrale attorno al codice inline delimitato da doppi backtick.
- **Fedeltà LaTeX**: traduzione fedele dei backtick letterali in `\textasciigrave{}` all'interno dei blocchi `\texttt{...}` per la corretta compilazione in `pdflatex`.
- **Pulizia Plain Text**: rimozione trasparente dei backtick letterali nei file `.txt` per una lettura naturale.

#### 2. Salvaguardia Architetturale Loop di Risoluzione
- Documentati esplicitamente con commenti protettivi i cicli `while` in `preview.js` ed `export.js` per preservare lo srotolamento completo di placeholder annidati (es. celle di tabella contenenti codice e formule).

#### 3. Chiarimento sul Comportamento Offline del Formato HTML (`js/export.js`)
- Aggiunta nota descrittiva nell'intestazione del file HTML esportato che chiarisce la dipendenza da CDN al primo caricamento per i font KaTeX e il runtime Mermaid, raccomandando "Stampa…" o "Esporta PDF" per archivi 100% autonomi e indipendenti dalla rete.

#### 4. Rifinitura i18n & Event Binding UI (`js/main.js`, `index.html`)
- Assegnato ID `btn-diagram` al pulsante diagrammi e collegata la traduzione del tooltip in `applyLanguage()`, rimuovendo il vecchio selettore orfano `#diagram-modal`.
- Registrato listener esplicito `addEventListener('input', renderSidebar)` sul campo di ricerca `#sidebar-search` all'inizializzazione dell'app.

---

## [v1.5.2] - 2026-11-06

### Risoluzione Bug Critici di Esportazione & Ottimizzazione Stampa

#### 1. Pipeline di Protezione e Restore Senza Leak (`js/preview.js`)
- **Segnaposto Bulletproof**: adottato il formato `@@MP_CODE_<id>@@` e `@@MP_ICODE_<id>@@`, privo di tag HTML intermedi e null-bytes, immune da alterazioni durante la serializzazione o il parsing Markdown.
- **Risoluzione Annidata**: implementato loop di ripristino per garantire lo srotolamento completo di qualsiasi segnaposto annidato (es. frammenti di codice o backtick all'interno di celle di tabelle Markdown).
- **Fenced Code Scoping**: vincolati i blocchi fenced su righe dedicate per evitare catture errate di backtick multipli su riga singola.

#### 2. Pipeline LaTeX ad Alta Fedeltà (`js/export.js`)
- **Sequenza di Trasformazione Rigorosa**: estrazione del codice prima della matematica per prevenire la corruzione di variabili ed espressioni shell come `$(( $PREZZO * $QTA ))`.
- **Protezione Selettiva Valute**: isolamento preventivo dei prezzi (`$19,99`, `$4,50`) per impedire che i simboli di valuta vengano scambiati per delimitatori di formule matematiche inline.
- **Supporto Tabelle Markdown**: compilazione automatica in ambienti `\begin{center}\begin{tabular}{...}\hline ... \end{tabular}\end{center}` con escape corretto dei contenuti delle celle.
- **Codice Inline Sicuro**: i frammenti inline (es. `` `$` ``) vengono renderizzati come `\texttt{...}` con escape dei caratteri speciali LaTeX anziché generare blocchi `\begin{verbatim}` illegali all'interno dei paragrafi.

#### 3. Esportazione Plain Text Completa (`js/export.js`)
- **Zero Data Loss**: i blocchi di codice vengono preservati come testo leggibile anziché rimossi.
- **Preservazione Underscore**: la rimozione del markup Markdown non intacca più gli underscore delle formule matematiche (`x_1`, `a_{n+1}`).
- **Valute Non Escapate**: ripristinati i dollari normali (`$19,99`) eliminando i backslash non necessari per il testo puro.

#### 4. HTML Standalone con Mermaid e Stampa Vettoriale (`js/export.js`)
- **Rendering Standalone Deterministico**: aggiunto script di inizializzazione e render esplicito su `DOMContentLoaded` per garantire la corretta visualizzazione dei diagrammi Mermaid anche con protocollo locale `file://`.
- **Regole `@media print` KaTeX**: forzata l'invisibilità di `.katex-mathml` in stampa per evitare che il browser stampi il testo grezzo di `<annotation>` al posto del rendering vettoriale `.katex-html`.

#### 5. Separazione UI "Stampa" ed "Esporta PDF" (`index.html`, `js/editor.js`, `js/data.js`, `css/style.css`)
- **Due Azioni Distinte**: il menu File include ora separatamente "🖨️ Stampa…" (`printDocument()` con finestra di stampa del browser) ed "📄 Esporta PDF" (`exportPDF()` con download diretto A4 via `html2pdf.js`).
- **Supporto i18n Completo**: aggiunta chiave `print_doc` per italiano e inglese.

#### 6. Persistenza Resiliente (`js/editor.js`)
- `saveToStorage()` gestisce ora in modo indipendente il salvataggio di `minipad_tabs` e `minipad_groups`, isolando eventuali errori IndexedDB sul singolo store.

---

## [v1.5.1] - 2026-11-06

### Miglioramenti di Manutenzione & Pulizia Debito Tecnico

#### 1. Commento di Salvaguardia sull'Ordine di Caricamento Script (`index.html`)
- Aggiunta documentazione esplicita nel markup HTML sul vincolo architetturale: `katex.min.js` deve tassativamente precedere `marked-katex-extension` in quanto l'inizializzazione della build UMD richiede la presenza immediata di `global.katex`.

#### 2. Rimozione Stub Morti & Handler Obsoleti (`js/ui.js`, `js/main.js`, `index.html`)
- Rimossi gli stub vuoti `initTableGrid()` e `saveSelection()` in `js/ui.js`.
- Rimosso il listener inline `onmousedown="saveSelection()"` non più necessario da `index.html`.
- Rimosso il richiamo a `initTableGrid()` e la variabile morta `savedSelection` in `js/main.js`.
- Eliminati tutti i commenti fantasma obsoleti derivanti dalla divisione modulare originaria in `js/ui.js`.

#### 3. Verifica Integrità Funzionale
- Confermato il comportamento asincrono con `await` di `saveToStorage()` per una gestione affidabile del fallback su `localStorage` in caso di errore IndexedDB.
- Confermato il corretto azzeramento dei contatori in `updateStats()` su documenti vuoti.

---

## [v1.5.0] - 2026-11-06

### Nuove Funzionalità & Miglioramenti Maggiori

#### 1. Smart Paste da LLM & Fonti Scientifiche (`js/smart-paste.js`)
- **Normalizzazione delimitatori AI**: intercettazione automatica all'incolla di testi da ChatGPT, Claude, Gemini, con conversione di `\( ... \)` in `$ ... $`, `\[ ... \]` in `$$ ... $$` e pulizia dei dollari escapati `\$`.
- **Estrazione LaTeX da HTML ricco**: quando si copia tramite selezione mouse da interfacce web (KaTeX, MathML, MathJax, Wikipedia, EoM), Turndown estrae il codice LaTeX originale da `<annotation encoding="application/x-tex">`, attributi `alt` o script `math/tex`, convertendo il resto del testo in Markdown pulito.

#### 2. Motore Grafico Mermaid Integrato (`js/preview.js`, `js/data.js`)
- **Compilazione visuale nativa**: i blocchi ```mermaid``` vengono compilati direttamente come diagrammi vettoriali SVG in anteprima (Flowchart, Sequence Diagram, Mindmap, Class Diagram, Pie Chart).
- **Retrocompatibilità**: conservato il supporto completo per gli schemi ASCII in blocchi ```text```.
- **Palette Diagrammi**: aggiunti template rapidi Mermaid pronti all'uso nella toolbar.

#### 3. Preview Matematica Robusta con `marked-katex-extension`
- **Isolamento della sintassi**: la matematica KaTeX viene protetta prima del parsing Markdown, eliminando ogni collisione con corsivo/grassetto (`_`, `*`) e variabili shell.
- **Debounce fluido a 60 ms**: ottimizzato per una frequenza di rendering fino a 60 FPS senza lag di digitazione.
- **Fix Anteprima Vuota**: corretta la gestione delle note svuotate, azzerando istantaneamente il pannello di anteprima invece di congelarlo sul testo precedente.

#### 4. Esportazione Professionale Multi-formato (`js/export.js`)
- **Markdown (.md)**: download diretto del sorgente.
- **HTML Standalone (.html)**: pacchetto HTML autonomo con fogli di stile KaTeX e runtime Mermaid inclusi per visualizzazione immediata in qualsiasi browser offline.
- **LaTeX (.tex)**: compilatore robusto Markdown → LaTeX con escape selettivo dei caratteri riservati (`%`, `_`, `&`, `~`, `^`) senza intaccare formule e blocchi di codice, pronto per la compilazione con `pdflatex`.
- **PDF (.pdf)**: esportazione vettoriale A4 tramite `html2pdf.js` con fallback su stampa nativa.
- **Plain Text (.txt)**: estrazione testo pulito senza markup.

#### 5. PWA & Offline Resiliente (`sw.js`)
- **Service Worker v1.5.0**: inclusi in pre-caching tutti gli asset critici precedentemente mancanti (EasyMDE JS/CSS, Mermaid, Turndown, html2pdf, IDB-Keyval, icone PNG/SVG e font vettoriali `.woff2`). L'app è ora completamente autonoma e funzionante anche offline.
- **Pulsante Installa PWA**: inserito nel menu File l'elemento `#install-btn` collegato al prompt `beforeinstallprompt`.

#### 6. Risoluzione Debito Tecnico & UI Fix
- **Ricerca Schede**: inserito il campo `#sidebar-search` nell'intestazione della barra laterale per il filtraggio real-time delle note e dei gruppi.
- **Barra Trova & Sostituisci**: assegnati gli ID corretti per garantire la corretta internazionalizzazione (IT/EN) di etichette e pulsanti.
- **Statistiche su Note Vuote**: corretto `updateStats` per azzerare caratteri, parole e righe quando l'editor è vuoto.
- **Persistenza Affidabile**: `saveToStorage` reso asincrono con fallback automatico su `localStorage` in caso di eccezioni IndexedDB.
- **Pulizia File Orfani**: rimossi `temp_css.txt`, `replace.py`, `FIX_LOG_v1.2.0.txt` e la cartella duplicata `minipad-main/`.

---

## [v1.1.0] - 2026-04-11

### Fix Applicati

#### 1. CSS - Dark Theme Selector (Bug #6)
- **File**: `css/style.css`
- **Problema**: I selettori `[data-theme="dark"]` non venivano mai applicati perché il tema scuro usa la classe `body.dark-mode`, non l'attributo `data-theme="dark"`.
- **Modifica**: Sostituiti tutti i selettori `[data-theme="dark"]` con `body.dark-mode` per le componenti:
  - `#math-toolbar` (riga 415)
  - `.math-tabs` (riga 432)
  - `.math-tab`, `.math-tab:hover`, `.math-tab.active` (righe 462-476)
  - `.math-btn`, `.math-btn:hover` (righe 536-554)
- **Impatto**: Ora la toolbar matematica si adatta correttamente al tema scuro.

#### 2. Input Validation - Funzioni Critiche (Bug #7)
- **File**: `js/ui.js`
- **Problema**: Molte funzioni non validavano gli input utente, causando potenziali comportamenti imprevisti.
- **Modifiche**:
  - `insertTable()` (riga ~411): Aggiunta validazione per dimensions (1-50), controllo esistenza campo editor
  - `applyHeading()` (riga ~449): Aggiunta validazione per livello (0-6), controllo esistenza campo editor
  - `insertCustomTable()` (riga ~293): Limiti massimi portati a 50 per rows/cols, valori default corretti a 4
- **Impatto**: Previene errori con input invalidi o estremi.

#### 3. Backup Import - ID Duplicati (Bug #6)
- **File**: `js/ui.js`
- **Problema**: La logica di merge poteva creare ID duplicati se lo stesso backup veniva importato più volte.
- **Modifica**: 
  - ID conflittuali ora includono timestamp: `_imported_1234567890`
  - Nome nota ora include data import: `(Backup 11/04/2026)`
- **Impatto**: Import multipli dello stesso backup non creano più conflitti.

### Note
- La funzione `applyList` era stata segnalata come potenzialmente troncata ma è risultata completa (era un limite di visualizzazione del tool di analisi).
- Tutte le funzioni referenziate (`toggleFileMenu`, `insertColor`, `insertTableFromInputs`) sono risultate presenti e funzionanti.

### Come Tornare alla Versione Pre-Fix
Se desideri ripristinare la versione prima di queste modifiche:
```bash
git checkout v1.0-pre-fixes
```
Oppure:
```bash
git checkout backup-pre-fixes
```

---

## [v1.0.0] - Versione Iniziale
- Prima release pubblica di minipad
- Editor Markdown e LaTeX completo
- Supporto PWA
- Gestione note multiple con IndexedDB
- Temi: Chiaro, Scuro, Sepia, Hacker
- Bilingue IT/EN
