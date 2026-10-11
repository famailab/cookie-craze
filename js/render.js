/* COOKIE CRAZE - canvas renderer: board, cookies, particles, HUD, juice. */
(function (global) {
  'use strict';
  var W = 300, H = 270, HUD_H = 42, CELL = 38, COLS = 6, ROWS = 6;
  var BOARD_X = 36, BOARD_Y = HUD_H; // 228x228 board, 10:9 like a real COLOR screen

  function Renderer(canvas, game, sprites) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    this.sprites = sprites;
    this.pixelOn = true;
    this.vis = {};      // id -> {x,y} cell coords (float)
    this.pop = {};      // id -> {x,y,t,cookie}
    this.parts = [];
    this.floats = [];
    this.banner = null; // {txt, sub, t, dur}
    this.shake = 0;
    this.sel = { r: 4, c: 1 };
    this.time = 0;
    this.setPixelFx(true);
  }

  Renderer.prototype.setPixelFx = function (on) {
    this.pixelOn = on;
    var dpr = (!on && window.devicePixelRatio) ? Math.min(window.devicePixelRatio, 2) : 1;
    var sx = on ? 0.5 : dpr, sy = on ? 0.5 : dpr;
    this.canvas.width = Math.round(W * sx);
    this.canvas.height = Math.round(H * sy);
    this.scaleX = this.canvas.width / W;
    this.scaleY = this.canvas.height / H;
    this.ctx.imageSmoothingEnabled = !on;
  };

  Renderer.prototype.cellXY = function (c, r) {
    return { x: BOARD_X + c * CELL + CELL / 2, y: BOARD_Y + r * CELL + CELL / 2 };
  };

  // --- event hooks from main ---
  Renderer.prototype.onRotate = function (moves, dir) {
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i], id = m.cookie.id;
      var v = this.vis[id] || { x: m.fc, y: m.fr };
      // wrap-around: start just off the edge so it slides in
      var sx = m.fc, sy = m.fr;
      if (dir === 'R' && m.fc === COLS - 1 && m.tc === 0) sx = COLS;
      if (dir === 'L' && m.fc === 0 && m.tc === COLS - 1) sx = -1;
      if (dir === 'D' && m.fr === ROWS - 1 && m.tr === 0) sy = ROWS;
      if (dir === 'U' && m.fr === 0 && m.tr === ROWS - 1) sy = -1;
      this.vis[id] = { x: sx, y: sy };
    }
  };

  Renderer.prototype.onClear = function (ev) {
    var self = this;
    ev.cleared.forEach(function (p) {
      var v = self.vis[p.cookie.id] || { x: p.c, y: p.r };
      self.pop[p.cookie.id] = { x: v.x, y: v.y, t: 0, cookie: p.cookie };
      delete self.vis[p.cookie.id];
      var xy = self.cellXY(p.c, p.r);
      self.burst(xy.x, xy.y, p.cookie);
    });
    this.shake = Math.min(7, 2 + ev.lines * 1.5 + Math.min(ev.combo, 5));
    var xy0 = this.cellXY(2.5, 2.5);
    var txt = '+' + ev.gained;
    if (ev.combo >= 2) txt += '  x' + Math.min(ev.combo, 8);
    this.floats.push({
      x: xy0.x, y: xy0.y - 20, txt: txt, t: 0, dur: 1.1,
      color: ev.combo >= 2 ? '#ffd93b' : '#ffffff', size: ev.combo >= 3 ? 20 : 15
    });
    if (ev.leveledUp) {
      this.banner = { txt: 'LEVEL ' + ev.level, sub: '', t: 0, dur: 1.4 };
    }
  };

  Renderer.prototype.onInvade = function (ev) {
    var self = this;
    ev.incoming.forEach(function (p) {
      self.vis[p.cookie.id] = ev.side === 'right' ? { x: COLS, y: p.r } : { x: p.c, y: -1 };
    });
    this.shake = Math.max(this.shake, 2.5);
  };

  Renderer.prototype.burst = function (x, y, cookie) {
    var colors = {
      '-1': ['#ff5b5b', '#ffd93b', '#4fb8ff', '#9b7bff'],
      0: ['#d8934a', '#8a4f1d', '#3d2410'],
      1: ['#f2668a', '#ffb3c1', '#c9335c'],
      2: ['#7cba5f', '#b5e394', '#4e8a3c'],
      3: ['#f6d789', '#fff8e2', '#d9a44e'],
      4: ['#f9b545', '#ffe48c', '#cf7a1c']
    }[cookie.wild ? '-1' : String(cookie.t)];
    for (var i = 0; i < 10; i++) {
      var a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 90;
      this.parts.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        t: 0, dur: 0.5 + Math.random() * 0.4,
        color: colors[i % colors.length],
        size: 2 + Math.random() * 3.5
      });
    }
  };

  // --- frame ---
  Renderer.prototype.draw = function (dt) {
    var g = this.ctx, game = this.game;
    this.time += dt;
    g.save();
    g.scale(this.scaleX, this.scaleY);
    // shake
    if (this.shake > 0.1) {
      g.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
      this.shake *= Math.pow(0.02, dt);
    }

    this.drawBg(g);
    this.drawBoard(g, game, dt);
    this.drawCookies(g, game, dt);
    this.drawParts(g, dt);
    this.drawFloats(g, dt);
    this.drawHud(g, game);
    this.drawBanner(g, dt);
    this.drawWarning(g, game);
    g.restore();
  };

  Renderer.prototype.drawBg = function (g) {
    var gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#2b1f16');
    gr.addColorStop(1, '#171009');
    g.fillStyle = gr;
    g.fillRect(-10, -10, W + 20, H + 20);
  };

  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  Renderer.prototype.drawBoard = function (g, game, dt) {
    var bx = BOARD_X - 4, by = BOARD_Y - 4, bw = COLS * CELL + 8, bh = ROWS * CELL + 8;
    // panel
    var gr = g.createLinearGradient(0, by, 0, by + bh);
    gr.addColorStop(0, '#3a2a1d');
    gr.addColorStop(1, '#2c2015');
    g.fillStyle = gr;
    rr(g, bx, by, bw, bh, 10); g.fill();
    // slots
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        rr(g, bx + 4 + c * CELL + 3, by + 4 + r * CELL + 3, CELL - 6, CELL - 6, 7);
        g.fill();
      }
    }
    // selection cursor
    if (this.sel && !game.gameOver) {
      var pulse = 0.55 + 0.35 * Math.sin(this.time * 6);
      g.strokeStyle = 'rgba(255,217,59,' + pulse.toFixed(2) + ')';
      g.lineWidth = 2.5;
      rr(g, bx + 4 + this.sel.c * CELL + 1.5, by + 4 + this.sel.r * CELL + 1.5, CELL - 3, CELL - 3, 8);
      g.stroke();
    }
    // danger glow
    var d = game.danger();
    if (d > 0.55) {
      var warn = game.invasionIn < 1.3 ? (0.5 + 0.5 * Math.sin(this.time * 12)) : 0;
      var a = Math.min(0.75, (d - 0.55) * 1.6 + warn * 0.4);
      g.strokeStyle = 'rgba(255,70,60,' + a.toFixed(2) + ')';
      g.lineWidth = 3;
      rr(g, bx + 1, by + 1, bw - 2, bh - 2, 10); g.stroke();
    }
  };

  Renderer.prototype.spriteFor = function (cookie) {
    return cookie.wild ? this.sprites.wild : this.sprites.list[cookie.t];
  };

  Renderer.prototype.drawCookies = function (g, game, dt) {
    var self = this, k = Math.min(1, dt * 16);
    // live cookies ease toward their cells
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var ck = game.board[r][c];
        if (!ck) continue;
        var v = self.vis[ck.id];
        if (!v) { v = { x: c, y: r }; self.vis[ck.id] = v; }
        v.x += (c - v.x) * k;
        v.y += (r - v.y) * k;
        if (Math.abs(c - v.x) < 0.002) v.x = c;
        if (Math.abs(r - v.y) < 0.002) v.y = r;
      }
    }
    // draw sorted by y for slight overlap niceness
    var drawList = [];
    Object.keys(this.vis).forEach(function (id) {
      drawList.push({ id: +id, v: self.vis[id] });
    });
    drawList.sort(function (a, b) { return a.v.y - b.v.y; });
    drawList.forEach(function (e) {
      var ck = findCookie(game, e.id);
      if (!ck) { delete self.vis[e.id]; return; }
      var xy = self.cellXY(e.v.x, e.v.y);
      // shadow
      g.fillStyle = 'rgba(0,0,0,0.30)';
      g.beginPath();
      g.ellipse(xy.x, xy.y + 12, 12, 4, 0, 0, Math.PI * 2);
      g.fill();
      g.drawImage(self.spriteFor(ck), xy.x - 17, xy.y - 17, 34, 34);
    });
    // popping ghosts
    Object.keys(this.pop).forEach(function (id) {
      var p = self.pop[id];
      p.t += dt;
      var T = 0.3, q = p.t / T;
      if (q >= 1) { delete self.pop[id]; return; }
      var sc = 1 + q * 0.55, alpha = 1 - q;
      var xy = self.cellXY(p.x, p.y);
      g.save();
      g.globalAlpha = alpha;
      g.translate(xy.x, xy.y);
      g.scale(sc, sc);
      g.drawImage(self.spriteFor(p.cookie), -17, -17, 34, 34);
      g.restore();
    });
    function findCookie(game, id) {
      for (var r = 0; r < ROWS; r++)
        for (var c = 0; c < COLS; c++) {
          var ck = game.board[r][c];
          if (ck && ck.id === id) return ck;
        }
      return null;
    }
  };

  Renderer.prototype.drawParts = function (g, dt) {
    for (var i = this.parts.length - 1; i >= 0; i--) {
      var p = this.parts[i];
      p.t += dt;
      if (p.t >= p.dur) { this.parts.splice(i, 1); continue; }
      p.vy += 320 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      g.globalAlpha = 1 - p.t / p.dur;
      g.fillStyle = p.color;
      g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    g.globalAlpha = 1;
  };

  Renderer.prototype.drawFloats = function (g, dt) {
    var self = this;
    this.floats = this.floats.filter(function (f) {
      f.t += dt;
      if (f.t >= f.dur) return false;
      var q = f.t / f.dur;
      g.save();
      g.globalAlpha = 1 - q * q;
      g.font = '700 ' + f.size + 'px "Baloo 2", sans-serif';
      g.textAlign = 'center';
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(40,20,5,0.85)';
      var y = f.y - q * 34;
      g.strokeText(f.txt, f.x, y);
      g.fillStyle = f.color;
      g.fillText(f.txt, f.x, y);
      g.restore();
      return true;
    });
  };

  Renderer.prototype.drawHud = function (g, game) {
    g.textBaseline = 'alphabetic';
    // score
    g.textAlign = 'left';
    g.font = '700 10px "Baloo 2", sans-serif';
    g.fillStyle = '#c9a06a';
    g.fillText('SCORE', 10, 13);
    g.font = '700 21px "Baloo 2", sans-serif';
    g.fillStyle = '#fff3dd';
    g.fillText(String(game.score), 10, 33);
    // level
    g.textAlign = 'right';
    g.font = '700 10px "Baloo 2", sans-serif';
    g.fillStyle = '#c9a06a';
    g.fillText('LEVEL', W - 10, 13);
    g.font = '700 21px "Baloo 2", sans-serif';
    g.fillStyle = '#fff3dd';
    g.fillText(String(game.level), W - 10, 33);
    // invasion bar
    var bw = W - 20, frac = 1 - game.invasionIn / game.invasionInterval();
    frac = Math.max(0, Math.min(1, frac));
    g.fillStyle = 'rgba(0,0,0,0.35)';
    rr(g, 10, 36, bw, 5, 2.5); g.fill();
    var urgent = game.invasionIn < 1.3;
    g.fillStyle = urgent ? '#ff5b4d' : '#8fd18a';
    if (frac > 0.02) { rr(g, 10, 36, bw * frac, 5, 2.5); g.fill(); }
    // combo pill
    if (game.comboActive()) {
      var n = Math.min(game.combo, 8);
      var pop = 1 + 0.25 * Math.max(0, 1 - (game.now - game.lastClearAt) * 3);
      g.save();
      g.translate(W / 2, 21); g.scale(pop, pop);
      var label = 'COMBO x' + n;
      g.font = '700 15px "Baloo 2", sans-serif';
      var tw = g.measureText(label).width;
      g.fillStyle = 'rgba(120,40,10,0.85)';
      rr(g, -tw / 2 - 9, -14, tw + 18, 24, 12); g.fill();
      g.strokeStyle = '#ffd93b'; g.lineWidth = 2;
      rr(g, -tw / 2 - 9, -14, tw + 18, 24, 12); g.stroke();
      g.fillStyle = '#ffd93b';
      g.textAlign = 'center';
      g.fillText(label, 0, 4);
      g.restore();
    }
  };

  Renderer.prototype.drawBanner = function (g, dt) {
    if (!this.banner) return;
    var b = this.banner;
    b.t += dt;
    if (b.t >= b.dur) { this.banner = null; return; }
    var q = b.t / b.dur;
    var sc = q < 0.18 ? 0.5 + (q / 0.18) * 0.5 : 1;
    var alpha = q > 0.7 ? 1 - (q - 0.7) / 0.3 : 1;
    g.save();
    g.globalAlpha = alpha;
    g.translate(W / 2, H / 2 - 10);
    g.scale(sc, sc);
    g.font = '700 30px "Titan One", "Baloo 2", sans-serif';
    g.textAlign = 'center';
    g.lineWidth = 6; g.strokeStyle = 'rgba(60,25,5,0.9)';
    g.strokeText(b.txt, 0, 0);
    g.fillStyle = '#ffd93b';
    g.fillText(b.txt, 0, 0);
    g.restore();
  };

  Renderer.prototype.drawWarning = function (g, game) {
    if (game.gameOver || game.invasionIn > 1.3 || game.danger() < 0.5) return;
    var a = 0.10 + 0.08 * Math.sin(this.time * 12);
    var gr = g.createRadialGradient(W / 2, HUD_H + 120, 60, W / 2, HUD_H + 120, 190);
    gr.addColorStop(0, 'rgba(255,60,40,0)');
    gr.addColorStop(1, 'rgba(255,60,40,' + a.toFixed(3) + ')');
    g.fillStyle = gr;
    g.fillRect(0, HUD_H, W, ROWS * CELL);
  };

  global.Renderer = Renderer;
})(typeof window !== 'undefined' ? window : global);
