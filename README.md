# minipad 📝
**minipad** è un editor di testo gratuito e leggerissimo che gira interamente in locale nel tuo browser. Combina la semplicità di un blocco note con la potenza di **Markdown** e **LaTeX** e per creare documenti, appunti matematici e diagrammi.

*🇬🇧 **minipad** is an advanced, free, and feather-light text editor that runs entirely locally within your browser. It combines the simplicity of a notepad with the power of Markdown and LaTeX to create documents, math notes, and diagrams.*

## ✨ Funzionalità Principali / Main Features

- 🌍 **Supporto Bilingue (IT/EN)**: Cambia lingua dell'interfaccia al volo con l'apposito pulsante in alto a destra. *(Bilingual Support: Switch UI language instantly on the fly).*
- 🔒 **100% Locale & Privacy-First**: Minipad è completamente "serverless". Nessun dato viene mai inviato a server esterni; tutto funziona e si salva nel tuo browser offline. *(Local & Privacy first: serverless app, everything works and saves offline in your browser).*
- 🤖 **Incolla Perfetto dalle AI (Copia & Incolla)**: Incolla risposte e testi generati dalle Intelligenze Artificiali (es. ChatGPT, Gemini, Claude). Minipad riconosce e renderizza automaticamente le espressioni matematiche esportate nei formati `\[ \]` e `\( \)`, mostrandoti subito la formula corretta senza farti impazzire tra sintassi rotte! *(AI Seamless Pasting: easily paste ChatGPT/Gemini/Claude answers and Minipad will automatically render mathematical expressions exported as `\[ \]` or `\( \)`).*
- 📝 **Editor Markdown Completo**: Formattazione veloce, tabelle avanzate ed evidenziazione, affiancati a un'anteprima in tempo reale ultra veloce. *(Full Markdown Editor with live parsing and advanced tables).*
- 🧮 **Matematica Avanzata e Simboli (LaTeX)**: Supporto nativo integrato a KaTeX. Usa i blocchi `$$ ... $$` o seleziona dal vasto menu a discesa per digitare matrici, frazioni ed equazioni senza sforzo. *(Advanced Math with LaTeX support using KaTeX).*
- 📊 **Diagrammi Integrati**: Crea grafici di flusso, diagrammi di sequenza e mentali usando istantaneamente la sintassi testuale 
- 💾 **Gestione File & Backup**: Puoi importare o esportare liberamente i file Markdown (.md), LaTeX (.tex) e HTML. Inoltre c'è un potente sistema di Backup/Ripristino per non perdere mai le tue sessioni su dispositivi diversi. *(File Management & Backup: export PDF, MD, HTML, TEX, and use the full JSON backup/restore tool).*
- 🔄 **Salvataggio & Esplora Note**: Nessuna scheda persa! Puoi passare da una nota all'altra dalla pratica barra laterale (Sidebar). Il salvataggio dei tuoi documenti è automatico fin dal primo carattere (tramite IndexedDB). *(Autosave & Note Explorer: switch notes seamlessly from the sidebar).*
- 🧘 **Interfaccia Zen & Temi Scuri**: Scegli tra la comoda Visualizzazione Divisa (Editor/Preview), oppure concentrati con la "Modalità Zen" a Schermo Intero. Disponibili i temi: Chiaro, Scuro, Sepia e Hacker. *(Zen Interface & Dark Themes: choose split view or Full-Screen Zen mode. Available themes: Default, Dark, Sepia, Hacker).*

## 🚀 Come Usarlo / How to Use

Non serve installare nulla, ma può essere installata come libreria desktop (PWA)! *(No installation required, but it works as an installable PWA!)*

1.  Scarica il pacchetto e apri il file `index.html`. *(Download the package and open `index.html`).*
2.  Oppure naviga all'indirizzo online e clicca su "Installa Minipad" dal menu **File** per averlo fisso sul dispositivo. *(Or navigate online and click "Install Minipad" from the File menu to have it on your device).*
3.  Inizia a scrivere liberamente. *(Start writing freely).*

## 🛠️ Tecnologie Utilizzate / Stack

Minipad è costruito con standard web ottimizzati all'osso e zero framework ingombranti (Solo HTML5, puro CSS, Vanilla JS), appoggiandosi a solide librerie open-source:

*   [Marked.js](https://marked.js.org/) - Parsing ultraveloce del Markdown
*   [KaTeX](https://katex.org/) - Rendering iperveloce per le formule matematiche
*   [Mermaid.js](https://mermaid.js.org/) - Generazione visuale di diagrammi e grafici logici 
*   [DOMPurify](https://github.com/cure53/DOMPurify) - Sanitizzazione affidabile dell'HTML 
*   [idb-keyval](https://github.com/jakearchibald/idb-keyval) - Salvataggio locale persistente / Persistent Local Storage

## 📄 Licenza / License

Questo progetto è distribuito sotto licenza **MIT**. Sentiti libero di usarlo, studiarlo, modificarlo e condividerlo! *(MIT License).*
Vedi il file [LICENSE](LICENSE) per maggiori dettagli.
