# Changelog

Tutte le modifiche significative a questo progetto sono documentate in questo file.

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
