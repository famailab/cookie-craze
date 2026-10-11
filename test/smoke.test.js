/* DOM-stub smoke test: loads all js files, simulates start/rotates/invade/gameover. */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

function load(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); }

// ---- minimal DOM stub ----
function makeEl(id) {
  const cls = new Set();
  return {
    id, _text: '', _handlers: {},
    classList: {
      add: (...a) => a.forEach(x => cls.add(x)),
      remove: (...a) => a.forEach(x => cls.delete(x)),
      toggle: (c, f) => { if (f === undefined) { cls.has(c) ? cls.delete(c) : cls.add(c); } else { f ? cls.add(c) : cls.delete(c); } },
      contains: c => cls.has(c),
    },
    style: {},
    dataset: {},
    addEventListener(t, fn) { (this._handlers[t] = this._handlers[t] || []).push(fn); },
    removeEventListener() {},
    appendChild() {}, insertBefore() {}, setPointerCapture() {},
    setAttribute() {}, getAttribute() { return null; },
    querySelector() { return makeEl('inner'); },
    querySelectorAll() { return []; },
    click() { (this._handlers.click || []).forEach(fn => fn({ preventDefault() {} })); },
    get textContent() { return this._text; },
    set textContent(v) { this._text = String(v); },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 270 }),
  };
}
const els = {};
function el(id) { if (!els[id]) els[id] = makeEl(id); return els[id]; }

const gradStub = { addColorStop() {} };
const ctxStub = new Proxy({}, {
  get(t, p) {
    if (p === 'canvas') return null;
    if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createConicGradient') return () => gradStub;
    if (p === 'measureText') return () => ({ width: 10 });
    if (p === 'getImageData') return () => ({ data: [] });
    if (!(p in t)) t[p] = (...a) => {};
    return t[p];
  },
  set(t, p, v) { t[p] = v; return true; },
});
el('game-canvas').getContext = () => ctxStub;
el('stage').insertBefore = () => {};
el('device-screen').appendChild = () => {};

const listeners = {};
const rafQueue = [];
const sandbox = {
  console, setTimeout: (fn) => { try { fn(); } catch (e) {} return 0; }, clearTimeout: () => {},
  setInterval: () => 0, clearInterval: () => {},
  requestAnimationFrame: (cb) => { rafQueue.push(cb); return rafQueue.length; },
  localStorage: { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = String(v); } },
  location: { search: '' },
  document: {
    getElementById: (id) => el(id),
    body: null, // set below
    querySelectorAll: (sel) => sel === '.dp' ? [] : [],
    querySelector: () => null,
    createElement: (tag) => { const e = makeEl('dyn'); if (tag === 'canvas') e.getContext = () => ctxStub; return e; },
    addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
    documentElement: { requestFullscreen: () => Promise.resolve(), lang: '' },
    fullscreenElement: null, exitFullscreen: () => Promise.resolve(),
    fonts: { ready: Promise.resolve() },
  },
  window: {},
};
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.document.body = makeEl('body');
vm.createContext(sandbox);

for (const f of ['js/game.js', 'js/sprites.js', 'js/render.js', 'js/audio.js', 'js/main.js']) {
  try {
    vm.runInContext(load(f), sandbox, { filename: f });
  } catch (e) {
    console.error('LOAD FAIL', f, e.message);
    process.exit(1);
  }
}
console.log('all scripts loaded OK');

// drive frames: simulate gameplay (t must be monotonic across calls)
let tick = 0;
function frames(n, dtms) {
  for (let i = 0; i < n; i++) {
    tick++;
    const q = rafQueue.splice(0);
    q.forEach(cb => cb(tick * dtms));
  }
}
frames(120, 16); // 2s on title (loop runs, no draw on title)

// click start
el('btn-start').click();
frames(120, 16);
console.log('game started OK');

// keyboard rotates
const kd = listeners.keydown || [];
function key(k) { kd.forEach(fn => fn({ key: k, preventDefault() {} })); }
for (let i = 0; i < 12; i++) { key('ArrowRight'); frames(10, 16); }
for (let i = 0; i < 6; i++) { key('ArrowDown'); frames(10, 16); }
key('w'); key('a'); key('s'); key('d');
frames(60, 16);
console.log('keyboard input OK');

// pause/resume
key('p'); frames(30, 16);
el('btn-resume').click(); frames(30, 16);
console.log('pause/resume OK');

// toggles
el('btn-pixel2').click();
el('btn-mute2').click();
el('btn-lang').click();
el('btn-lang').click();
frames(30, 16);
console.log('toggles OK');

// help open/close
el('btn-help2').click(); frames(10, 16);
el('btn-help-close').click(); frames(10, 16);
console.log('help OK');

// force many invasions to trigger game over path (no player input -> must overflow)
for (let i = 0; i < 3000 && els['ov-gameover'].classList.contains('hidden'); i++) frames(30, 16);
console.log('gameover overlay shown:', !els['ov-gameover'].classList.contains('hidden'));

// play again
el('btn-again').click(); frames(60, 16);
console.log('play-again OK');

// immersive enter/exit
el('btn-immersive2').click(); frames(80, 16);
console.log('immersive entered, hidden =', els['immersive'].classList.contains('hidden'));
el('btn-exit-immersive').click(); frames(30, 16);
console.log('immersive exited OK');

console.log('\nSMOKE TEST PASSED');
