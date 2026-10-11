/* COOKIE CRAZE v2 - main: calculator UI, display modes, touch-first input. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('cc_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('cc_' + k, JSON.stringify(v)); } catch (e) {} }
  };

  var lang = store.get('lang', 'zh');
  var mode = store.get('mode', 'color'); // color | pixel | lcd
  var muted = store.get('mute', false);
  var MODES = ['color', 'pixel', 'lcd'];

  var I18N = {
    modeName: { color: { zh: '彩色', en: 'COLOR' }, pixel: { zh: '像素', en: 'PIXEL' }, lcd: { zh: '液晶', en: 'LCD' } },
    muteName: { on: { zh: '开', en: 'ON' }, off: { zh: '关', en: 'OFF' } }
  };

  function applyLang() {
    document.querySelectorAll('[data-zh]').forEach(function (el) {
      el.textContent = lang === 'zh' ? el.getAttribute('data-zh') : el.getAttribute('data-en');
    });
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    syncMode();
  }

  // ---------- setup ----------
  var audio = new AudioEngine();
  audio.setMuted(muted);
  var game = new CookieGame();
  var sprites = makeSprites();
  var canvas = $('game-canvas');
  var renderer = new Renderer(canvas, game, sprites);

  var state = 'title'; // title | playing | paused | gameover
  var immersive = false;
  var warned = false;

  function syncMode() {
    document.body.classList.remove('dm-color', 'dm-pixel', 'dm-lcd');
    document.body.classList.add('dm-' + mode);
    renderer.setPixelFx(mode === 'pixel');
    $('mode-name').textContent = I18N.modeName[mode][lang];
  }
  function cycleMode() {
    mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
    store.set('mode', mode);
    syncMode(); audio.click();
  }
  function syncMute() {
    $('mute-name').textContent = I18N.muteName[muted ? 'off' : 'on'][lang];
    $('mute-name').setAttribute('data-zh', muted ? '关' : '开');
    $('mute-name').setAttribute('data-en', muted ? 'OFF' : 'ON');
  }
  function toggleMute() {
    muted = !muted;
    store.set('mute', muted);
    audio.ensure(); audio.setMuted(muted);
    syncMute(); if (!muted) audio.click();
  }

  function show(id, on) { $(id).classList.toggle('hidden', !on); }
  function showScreen(name) {
    show('screen-title', name === 'title');
    show('screen-game', name === 'game');
  }

  // ---------- game flow ----------
  function startGame() {
    game.reset();
    renderer.vis = {}; renderer.pop = {}; renderer.parts = []; renderer.floats = [];
    renderer.banner = null; renderer.shake = 0; renderer.panel = null;
    var b = game.bounds();
    renderer.sel = b ? { r: b.r1, c: b.c0 } : null;
    warned = false;
    state = 'playing';
    showScreen('game');
    show('ov-pause', false); show('ov-gameover', false); show('ov-help', false);
    show('hint-bar', true);
    audio.ensure(); audio.startBgm();
    $('title-best').textContent = store.get('best', 0);
  }

  function pauseGame() {
    if (state !== 'playing') return;
    state = 'paused';
    show('ov-pause', true);
    audio.pauseSfx(); audio.stopBgm();
  }
  function resumeGame() {
    if (state !== 'paused') return;
    state = 'playing';
    show('ov-pause', false);
    audio.ensure(); audio.startBgm(); audio.click();
  }
  function quitToTitle() {
    state = 'title';
    audio.stopBgm(); audio.click();
    show('ov-pause', false); show('ov-gameover', false); show('ov-help', false);
    if (immersive) exitImmersive(true);
    showScreen('title');
    $('title-best').textContent = store.get('best', 0);
  }
  function gameOver() {
    state = 'gameover';
    audio.stopBgm(); audio.gameover();
    var best = store.get('best', 0), nb = game.score > best;
    if (nb) store.set('best', game.score);
    $('go-score').textContent = game.score;
    $('go-best').textContent = Math.max(best, game.score);
    $('go-lines').textContent = game.lines;
    $('go-combo').textContent = 'x' + Math.min(game.maxCombo, 8);
    show('go-newbest', nb);
    setTimeout(function () { show('ov-gameover', true); }, 650);
  }

  // ---------- actions ----------
  function doRotate(r, c, dir) {
    if (state !== 'playing' || game.gameOver) return;
    var moves = game.rotate(r, c, dir);
    if (!moves.length) return;
    show('hint-bar', false);
    renderer.onRotate(game.lastEvent, dir);
    audio.shuffle();
    var ev = game.resolveMatches();
    if (ev) handleClear(ev);
  }

  function handleClear(ev) {
    renderer.onClear(ev);
    audio.pop(ev.combo);
    if (ev.leveledUp) setTimeout(function () { audio.levelup(); }, 250);
  }

  function clampSel() {
    var b = game.bounds();
    if (!b) { renderer.sel = null; return; }
    if (!renderer.sel) { renderer.sel = { r: b.r1, c: b.c0 }; return; }
    renderer.sel.r = Math.max(b.r0, Math.min(b.r1, renderer.sel.r));
    renderer.sel.c = Math.max(b.c0, Math.min(b.c1, renderer.sel.c));
  }

  // ---------- main loop ----------
  var lastT = 0;
  function loop(t) {
    requestAnimationFrame(loop);
    var dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    if (state === 'playing' && !game.gameOver) {
      var ev = game.update(dt);
      if (ev) {
        if (ev.kind === 'invade') {
          renderer.onInvade(ev);
          audio.invade();
          if (ev.clear) handleClear(ev.clear);
        } else if (ev.kind === 'gameover') {
          gameOver();
        }
      }
      if (!warned && game.invasionIn <= 1.3 && game.danger() > 0.4) {
        warned = true; audio.warn();
      }
      if (game.invasionIn > 2) warned = false;
      clampSel();
    }
    if (state !== 'title') renderer.draw(dt);
  }

  // ---------- pointer input (swipe to rotate, tap to select) ----------
  var pdown = null;
  function cellFromEvent(e) {
    var rect = canvas.getBoundingClientRect();
    if (rect.width < 4) return null;
    var x = (e.clientX - rect.left) / rect.width * 300;
    var y = (e.clientY - rect.top) / rect.height * 270;
    var c = Math.floor((x - 36) / 38), r = Math.floor((y - 42) / 38);
    if (c < 0 || c > 5 || r < 0 || r > 5) return null;
    return { r: r, c: c };
  }
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    audio.ensure();
    pdown = { cell: cellFromEvent(e), x: e.clientX, y: e.clientY, swiped: false };
    if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (err) {} }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!pdown || pdown.swiped || !pdown.cell) return;
    var dx = e.clientX - pdown.x, dy = e.clientY - pdown.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 26) return;
    pdown.swiped = true;
    var cell = pdown.cell;
    if (Math.abs(dx) > Math.abs(dy)) doRotate(cell.r, cell.c, dx > 0 ? 'R' : 'L');
    else doRotate(cell.r, cell.c, dy > 0 ? 'D' : 'U');
  });
  canvas.addEventListener('pointerup', function () {
    if (pdown && !pdown.swiped && pdown.cell && state === 'playing') {
      var b = game.bounds();
      if (b && pdown.cell.r >= b.r0 && pdown.cell.r <= b.r1 &&
          pdown.cell.c >= b.c0 && pdown.cell.c <= b.c1) {
        renderer.sel = { r: pdown.cell.r, c: pdown.cell.c };
        audio.click();
      }
    }
    pdown = null;
  });
  canvas.addEventListener('pointercancel', function () { pdown = null; });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  document.addEventListener('dblclick', function (e) { e.preventDefault(); });

  // ---------- keyboard (desktop convenience) ----------
  var KEYMAP = { w: 'W', a: 'A', s: 'S', d: 'D' };
  document.addEventListener('keydown', function (e) {
    var k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(k) >= 0) e.preventDefault();
    audio.ensure();
    if (k === 'm') { toggleMute(); return; }
    if (k === 'p' || k === 'escape') {
      if (state === 'playing') pauseGame(); else if (state === 'paused') resumeGame();
      return;
    }
    if (k === 'enter' || k === ' ') {
      if (state === 'title') startGame();
      else if (state === 'paused') resumeGame();
      else if (state === 'gameover') startGame();
      return;
    }
    if (state !== 'playing') return;
    var b = game.bounds();
    if (!b) return;
    var sel = renderer.sel || { r: b.r1, c: b.c0 };
    if (k === 'arrowleft') doRotate(sel.r, sel.c, 'L');
    else if (k === 'arrowright') doRotate(sel.r, sel.c, 'R');
    else if (k === 'arrowup') doRotate(sel.r, sel.c, 'U');
    else if (k === 'arrowdown') doRotate(sel.r, sel.c, 'D');
    else if (KEYMAP[k]) {
      var d = KEYMAP[k];
      var nr = sel.r + (d === 'S' ? 1 : d === 'W' ? -1 : 0);
      var nc = sel.c + (d === 'D' ? 1 : d === 'A' ? -1 : 0);
      renderer.sel = {
        r: Math.max(b.r0, Math.min(b.r1, nr)),
        c: Math.max(b.c0, Math.min(b.c1, nc))
      };
    }
  });

  // ---------- immersive ----------
  function enterImmersive() {
    if (state !== 'playing' && state !== 'paused') return;
    immersive = true;
    $('big-holder').appendChild(canvas);
    $('immersive').classList.remove('hidden');
    audio.click();
    try {
      var el = document.documentElement;
      if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(function () {});
    } catch (e) {}
  }
  function exitImmersive(silent) {
    immersive = false;
    $('immersive').classList.add('hidden');
    var lcd = document.querySelector('.lcd');
    lcd.insertBefore(canvas, lcd.querySelector('.scanlines'));
    try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {}); } catch (e) {}
    if (!silent) audio.click();
  }

  // auto-pause when the page hides (call, notification, tab switch)
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && state === 'playing') pauseGame();
  });

  // ---------- wire buttons ----------
  function on(id, fn) {
    $(id).addEventListener('click', function (e) { e.preventDefault(); audio.ensure(); fn(); });
  }
  on('btn-start', function () { audio.click(); startGame(); });
  on('btn-help', function () { audio.click(); show('ov-help', true); });
  on('btn-lang', function () {
    lang = lang === 'zh' ? 'en' : 'zh';
    store.set('lang', lang); applyLang(); audio.click();
  });
  on('key-mode', cycleMode);
  on('key-mute', toggleMute);
  on('key-pause', function () { if (state === 'playing') pauseGame(); });
  on('key-help', function () { audio.click(); if (state === 'playing') pauseGame(); show('ov-help', true); });
  on('key-lang', function () {
    lang = lang === 'zh' ? 'en' : 'zh';
    store.set('lang', lang); applyLang(); audio.click();
  });
  on('key-full', enterImmersive);
  on('btn-resume', resumeGame);
  on('btn-restart', function () { audio.click(); startGame(); });
  on('btn-quit', quitToTitle);
  on('btn-again', function () { audio.click(); startGame(); });
  on('btn-quit2', quitToTitle);
  on('btn-help-close', function () { audio.click(); show('ov-help', false); if (state === 'paused') resumeGame(); });
  on('immersive-exit', function () { exitImmersive(); });
  document.addEventListener('pointerdown', function () { audio.ensure(); }, { once: true });

  // ---------- init ----------
  applyLang();
  syncMute();
  $('title-best').textContent = store.get('best', 0);
  requestAnimationFrame(loop);
})();
