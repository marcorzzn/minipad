# Changelog

Tutte le modifiche significative a questo progetto sono documentate in questo file.

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
