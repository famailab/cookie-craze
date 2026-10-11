/* COOKIE CRAZE - main: screens, input, immersive mode, i18n. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('cc_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('cc_' + k, JSON.stringify(v)); } catch (e) {} }
  };

  var lang = store.get('lang', 'zh');
  var pixelOn = store.get('pixel', true);
  var muted = store.get('mute', false);

  function applyLang() {
    document.querySelectorAll('[data-zh]').forEach(function (el) {
      el.textContent = lang === 'zh' ? el.getAttribute('data-zh') : el.getAttribute('data-en');
    });
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }

  // ---------- setup ----------
  var audio = new AudioEngine();
  audio.setMuted(muted);
  var game = new CookieGame();
  var sprites = makeSprites();
  var canvas = $('game-canvas');
  var renderer = new Renderer(canvas, game, sprites);
  renderer.setPixelFx(pixelOn);

  var state = 'title'; // title | playing | paused | gameover
  var immersive = false;
  var returnTo = 'title';
  var warned = false;

  function syncToggles() {
    $('btn-pixel').setAttribute('aria-pressed', String(pixelOn));
    $('btn-mute').setAttribute('aria-pressed', String(!muted));
    $('btn-mute2').querySelector('.st').textContent = muted ? '✕' : '♪';
    $('btn-mute').querySelector('.dot').style.background = muted ? '#777' : '#6bcf5f';
    $('pixel-st').textContent = pixelOn ? '●' : '○';
    document.body.classList.toggle('pix-on', pixelOn);
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
    renderer.banner = null; renderer.shake = 0;
    renderer.sel = { r: 4, c: 1 };
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
    if (r < 0 || r > 5 || c < 0 || c > 5) return;
    var moves = game.rotate(r, c, dir);
    if (!moves.length) return;
    show('hint-bar', false);
    renderer.onRotate(moves, dir);
    audio.shuffle();
    var ev = game.resolveMatches();
    if (ev) handleClear(ev);
  }

  function handleClear(ev) {
    renderer.onClear(ev);
    audio.pop(ev.combo);
    if (ev.leveledUp) setTimeout(function () { audio.levelup(); }, 250);
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
    }
    if (state !== 'title') renderer.draw(dt);
  }

  // ---------- pointer input (swipe to rotate, tap to select) ----------
  var pdown = null;
  function cellFromEvent(e) {
    var rect = canvas.getBoundingClientRect();
    var x = (e.clientX - rect.left) / rect.width * 300;
    var y = (e.clientY - rect.top) / rect.height * 270;
    var c = Math.floor((x - 36) / 38), r = Math.floor((y - 42) / 38);
    if (c < 0 || c > 5 || r < 0 || r > 5) return null;
    return { r: r, c: c, x: x, y: y };
  }
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    audio.ensure();
    var cell = cellFromEvent(e);
    pdown = { cell: cell, x: e.clientX, y: e.clientY, swiped: false };
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
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
  canvas.addEventListener('pointerup', function (e) {
    if (pdown && !pdown.swiped && pdown.cell) {
      renderer.sel = { r: pdown.cell.r, c: pdown.cell.c };
      audio.click();
    }
    pdown = null;
  });
  canvas.addEventListener('pointercancel', function () { pdown = null; });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  document.addEventListener('dblclick', function (e) { e.preventDefault(); });

  // ---------- keyboard ----------
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
    var sel = renderer.sel || { r: 2, c: 2 };
    if (k === 'arrowleft') doRotate(sel.r, sel.c, 'L');
    else if (k === 'arrowright') doRotate(sel.r, sel.c, 'R');
    else if (k === 'arrowup') doRotate(sel.r, sel.c, 'U');
    else if (k === 'arrowdown') doRotate(sel.r, sel.c, 'D');
    else if (KEYMAP[k]) {
      var d = KEYMAP[k];
      var nr = sel.r + (d === 'S' ? 1 : d === 'W' ? -1 : 0);
      var nc = sel.c + (d === 'D' ? 1 : d === 'A' ? -1 : 0);
      renderer.sel = { r: (nr + 6) % 6, c: (nc + 6) % 6 };
    }
  });

  // ---------- device buttons ----------
  function devRotate(dir) {
    audio.ensure();
    if (state === 'title') { startGame(); return; }
    if (state === 'gameover') return;
    if (state === 'paused') return;
    var sel = renderer.sel || { r: 2, c: 2 };
    doRotate(sel.r, sel.c, dir);
  }
  document.querySelectorAll('.dp').forEach(function (b) {
    b.addEventListener('pointerdown', function (e) { e.preventDefault(); devRotate(b.getAttribute('data-dir')); });
  });
  $('dev-a').addEventListener('pointerdown', function (e) { e.preventDefault(); devRotate('R'); });
  $('dev-b').addEventListener('pointerdown', function (e) { e.preventDefault(); devRotate('L'); });
  $('dev-start').addEventListener('click', function () {
    audio.ensure(); audio.click();
    if (state === 'title') startGame();
    else if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
    else if (state === 'gameover') startGame();
  });
  $('dev-select').addEventListener('click', function () { audio.ensure(); togglePixel(); });

  // ---------- toggles ----------
  function togglePixel() {
    pixelOn = !pixelOn;
    store.set('pixel', pixelOn);
    renderer.setPixelFx(pixelOn);
    syncToggles(); audio.click();
  }
  function toggleMute() {
    muted = !muted;
    store.set('mute', muted);
    audio.ensure(); audio.setMuted(muted);
    syncToggles(); if (!muted) audio.click();
  }

  // ---------- immersive ----------
  function enterImmersive(from) {
    returnTo = from;
    immersive = true;
    $('device-screen').appendChild(canvas);
    $('immersive').classList.remove('hidden');
    show('boot', true);
    audio.ensure(); audio.boot();
    try {
      var el = document.documentElement;
      if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(function () {});
    } catch (e) {}
    setTimeout(function () { show('boot', false); }, 950);
  }
  function exitImmersive(silent) {
    immersive = false;
    $('stage').insertBefore(canvas, $('stage-scan'));
    $('immersive').classList.add('hidden');
    try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {}); } catch (e) {}
    if (!silent) audio.click();
  }

  // ---------- wire buttons ----------
  function on(id, fn) {
    $(id).addEventListener('click', function (e) { e.preventDefault(); audio.ensure(); fn(); });
  }
  on('btn-start', function () { audio.click(); startGame(); });
  on('btn-pixel', togglePixel);
  on('btn-mute', toggleMute);
  on('btn-immersive', function () { audio.click(); enterImmersive('title'); startGame(); });
  on('btn-help', function () { audio.click(); show('ov-help', true); });
  on('btn-lang', function () {
    lang = lang === 'zh' ? 'en' : 'zh';
    store.set('lang', lang); applyLang(); audio.click();
  });
  on('btn-pause', function () { if (state === 'playing') pauseGame(); });
  on('btn-mute2', toggleMute);
  on('btn-pixel2', togglePixel);
  on('btn-immersive2', function () { audio.click(); enterImmersive('game'); });
  on('btn-help2', function () { audio.click(); if (state === 'playing') pauseGame(); show('ov-help', true); });
  on('btn-resume', resumeGame);
  on('btn-restart', function () { audio.click(); startGame(); });
  on('btn-quit', quitToTitle);
  on('btn-again', function () { audio.click(); startGame(); });
  on('btn-quit2', quitToTitle);
  on('btn-help-close', function () { audio.click(); show('ov-help', false); if (state === 'paused') resumeGame(); });
  on('btn-exit-immersive', function () {
    exitImmersive();
    if (returnTo === 'title' && state !== 'title') quitToTitle();
  });
  document.addEventListener('pointerdown', function () { audio.ensure(); }, { once: true });

  // ---------- init ----------
  applyLang();
  syncToggles();
  $('title-best').textContent = store.get('best', 0);
  requestAnimationFrame(loop);
})();
