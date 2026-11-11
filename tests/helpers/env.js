/**
 * Ambiente di test: carica in una finestra jsdom le STESSE librerie (e versioni)
 * usate da index.html, poi i moduli MiniPad, nello stesso ordine della pagina.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');
const NM = path.join(ROOT, 'node_modules');

const LIBS = [
  'katex/dist/katex.min.js',
  'marked/lib/marked.umd.js',
  'marked-katex-extension/lib/index.umd.js',
  'dompurify/dist/purify.min.js',
  'turndown/dist/turndown.js',
  'turndown-plugin-gfm/dist/turndown-plugin-gfm.js'
];

const APP = ['js/smart-paste.js', 'js/preview.js', 'js/export.js', 'js/chat-indexer.js'];

function createEnv() {
  const dom = new JSDOM('<!doctype html><html><body><div id="preview-content"></div></body></html>', {
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const { window } = dom;
  for (const rel of LIBS) window.eval(fs.readFileSync(path.join(NM, rel), 'utf8'));
  for (const rel of APP) window.eval(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  window.MiniPadSmartPaste.init();
  return window;
}

let _shared = null;
function env() {
  if (!_shared) _shared = createEnv();
  return _shared;
}

/** Costruisce un finto evento paste con text/html e/o text/plain. */
function pasteEvent(data) {
  let prevented = false;
  return {
    clipboardData: { getData: (type) => data[type] || '' },
    preventDefault() { prevented = true; },
    get defaultPrevented() { return prevented; }
  };
}

/** Finto target CodeMirror minimale: registra il testo inserito. */
function fakeCm() {
  return {
    inserted: null,
    replaceSelection(t) { this.inserted = t; },
    focus() {}
  };
}

function fixture(name) {
  return fs.readFileSync(path.join(__dirname, '..', 'fixtures', name), 'utf8');
}

module.exports = { env, createEnv, pasteEvent, fakeCm, fixture };
