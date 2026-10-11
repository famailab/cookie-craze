/* COOKIE CRAZE - core game logic (no DOM). Yoshi's-Cookie-inspired, original code.
 * The play area is the bounding box of all cookies ("region"). Rotating a
 * row/column wraps WITHIN the region; matches are checked within it; each
 * invasion grows the region by one row/col from the top/right. Game over
 * when the region can no longer grow (hits the 6x6 tray edge).
 */
(function (global) {
  'use strict';

  var COLS = 6, ROWS = 6;
  var COMBO_WINDOW = 3.5;      // seconds
  var LINES_PER_LEVEL = 5;
  var WILD_CHANCE = 0.045;

  function CookieGame(opts) {
    opts = opts || {};
    this.rng = opts.rng || Math.random;
    this.now = 0;
    this.reset();
  }

  CookieGame.COLS = COLS;
  CookieGame.ROWS = ROWS;

  CookieGame.prototype.typesForLevel = function (level) {
    if (level >= 5) return 5;
    if (level >= 3) return 4;
    return 3;
  };

  CookieGame.prototype.invasionInterval = function () {
    return Math.max(5, 14 - (this.level - 1) * 1.1);
  };

  CookieGame.prototype.reset = function () {
    this.board = [];
    for (var r = 0; r < ROWS; r++) {
      this.board.push([null, null, null, null, null, null]);
    }
    this.nextId = 1;
    this.level = 1;
    this.score = 0;
    this.lines = 0;          // total lines cleared
    this.cookiesEaten = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.lastClearAt = -999;
    this.invasionIn = this.invasionInterval();
    this.gameOver = false;
    // initial 3x3 block, bottom-left
    var n = this.typesForLevel(1);
    for (var r = ROWS - 3; r < ROWS; r++) {
      for (var c = 0; c < 3; c++) {
        this.board[r][c] = this.makeCookie(n);
      }
    }
    // ensure no instant matches at start
    var guard = 0;
    while (this.findMatches().length > 0 && guard++ < 50) {
      for (var r2 = ROWS - 3; r2 < ROWS; r2++) {
        for (var c2 = 0; c2 < 3; c2++) {
          this.board[r2][c2] = this.makeCookie(n);
        }
      }
    }
    this.lastEvent = null;
  };

  CookieGame.prototype.makeCookie = function (nTypes) {
    var wild = this.rng() < WILD_CHANCE;
    return {
      id: this.nextId++,
      t: wild ? -1 : Math.floor(this.rng() * nTypes),
      wild: wild
    };
  };

  CookieGame.prototype.count = function () {
    var n = 0;
    for (var r = 0; r < ROWS; r++)
      for (var c = 0; c < COLS; c++)
        if (this.board[r][c]) n++;
    return n;
  };

  // Bounding box of all cookies; null when empty.
  CookieGame.prototype.bounds = function () {
    var r0 = ROWS, r1 = -1, c0 = COLS, c1 = -1;
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        if (this.board[r][c]) {
          if (r < r0) r0 = r;
          if (r > r1) r1 = r;
          if (c < c0) c0 = c;
          if (c > c1) c1 = c;
        }
      }
    }
    return r1 < 0 ? null : { r0: r0, r1: r1, c0: c0, c1: c1 };
  };

  // dir: row 'L'|'R', col 'U'|'D'. Wraps WITHIN the cookie region.
  // Returns list of moves for animation.
  CookieGame.prototype.rotate = function (r, c, dir) {
    if (this.gameOver) return [];
    var b = this.bounds();
    if (!b) return [];
    var moves = [], i;
    if (dir === 'L' || dir === 'R') {
      if (r < b.r0 || r > b.r1) return [];
      var n = b.c1 - b.c0 + 1;
      var has = false, row = [];
      for (i = b.c0; i <= b.c1; i++) {
        row.push(this.board[r][i]);
        if (this.board[r][i]) has = true;
      }
      if (!has) return [];
      for (i = 0; i < n; i++) {
        var fc = b.c0 + i;
        var tc = b.c0 + (dir === 'R' ? (i + 1) % n : (i - 1 + n) % n);
        this.board[r][tc] = row[i];
        if (row[i]) moves.push({ cookie: row[i], fr: r, fc: fc, tr: r, tc: tc });
      }
    } else {
      if (c < b.c0 || c > b.c1) return [];
      var m = b.r1 - b.r0 + 1;
      var has2 = false, col = [];
      for (i = b.r0; i <= b.r1; i++) {
        col.push(this.board[i][c]);
        if (this.board[i][c]) has2 = true;
      }
      if (!has2) return [];
      for (i = 0; i < m; i++) {
        var fr = b.r0 + i;
        var tr = b.r0 + (dir === 'D' ? (i + 1) % m : (i - 1 + m) % m);
        this.board[tr][c] = col[i];
        if (col[i]) moves.push({ cookie: col[i], fr: fr, fc: c, tr: tr, tc: c });
      }
    }
    this.lastEvent = { kind: 'rotate', moves: moves, bounds: { r0: b.r0, r1: b.r1, c0: b.c0, c1: b.c1 } };
    return moves;
  };

  // A line matches when it has >=2 cookies and all share one type
  // (wild matches any; all-wild line also clears). Checked within region.
  CookieGame.prototype.findMatches = function () {
    var b = this.bounds();
    if (!b) return [];
    var lines = [], r, c, i, cells, t;
    function lineType(cells, board) {
      var base = -2, n = 0;
      for (var j = 0; j < cells.length; j++) {
        var k = board[cells[j].r][cells[j].c];
        if (!k) continue;
        n++;
        if (!k.wild) {
          if (base === -2) base = k.t;
          else if (base !== k.t) return null;
        }
      }
      if (n < 2) return null;
      return base === -2 ? -1 : base; // -1 = all wild
    }
    for (r = b.r0; r <= b.r1; r++) {
      cells = [];
      for (c = b.c0; c <= b.c1; c++) cells.push({ r: r, c: c });
      t = lineType(cells, this.board);
      if (t !== null) lines.push({ cells: cells, type: t, dir: 'row', idx: r });
    }
    for (c = b.c0; c <= b.c1; c++) {
      cells = [];
      for (r = b.r0; r <= b.r1; r++) cells.push({ r: r, c: c });
      t = lineType(cells, this.board);
      if (t !== null) lines.push({ cells: cells, type: t, dir: 'col', idx: c });
    }
    return lines;
  };

  CookieGame.prototype.resolveMatches = function () {
    var lines = this.findMatches();
    if (!lines.length) return null;
    // union of cells actually holding cookies
    var seen = {}, cleared = [];
    lines.forEach(function (ln) {
      ln.cells.forEach(function (p) {
        var key = p.r + ',' + p.c;
        if (!seen[key] && this.board[p.r][p.c]) {
          seen[key] = true;
          cleared.push({ r: p.r, c: p.c, cookie: this.board[p.r][p.c] });
        }
      }, this);
    }, this);
    cleared.forEach(function (p) { this.board[p.r][p.c] = null; }, this);

    if (this.now - this.lastClearAt <= COMBO_WINDOW) this.combo++;
    else this.combo = 1;
    this.lastClearAt = this.now;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;

    var comboMult = Math.min(this.combo, 8);
    var gained = cleared.length * 10 * this.level * lines.length * comboMult;
    this.score += gained;
    this.lines += lines.length;
    this.cookiesEaten += cleared.length;

    var newLevel = 1 + Math.floor(this.lines / LINES_PER_LEVEL);
    var leveledUp = newLevel > this.level;
    this.level = newLevel;

    var ev = {
      kind: 'clear', cleared: cleared, lines: lines.length,
      gained: gained, combo: this.combo, level: this.level,
      leveledUp: leveledUp
    };
    this.lastEvent = ev;
    return ev;
  };

  // Advance timers; returns event if invasion happened.
  CookieGame.prototype.update = function (dt) {
    if (this.gameOver) return null;
    this.now += dt;
    this.invasionIn -= dt;
    if (this.invasionIn <= 0) {
      this.invasionIn = this.invasionInterval();
      return this.invade();
    }
    return null;
  };

  CookieGame.prototype.comboActive = function () {
    return this.combo >= 2 && (this.now - this.lastClearAt) <= COMBO_WINDOW;
  };

  // Grows the region by one line from the right or top. Game over when the
  // region already touches the tray edge and cannot grow further.
  CookieGame.prototype.invade = function () {
    var b = this.bounds(), r, c;
    if (!b) {
      // emptied board: seed a fresh 2x2 block, bottom-left
      var n = this.typesForLevel(this.level), incoming = [];
      var guard = 0;
      do {
        incoming = [];
        for (r = ROWS - 2; r < ROWS; r++) {
          for (c = 0; c < 2; c++) {
            this.board[r][c] = null;
          }
        }
        for (r = ROWS - 2; r < ROWS; r++) {
          for (c = 0; c < 2; c++) {
            var ks = this.makeCookie(n);
            this.board[r][c] = ks;
            incoming.push({ r: r, c: c, cookie: ks });
          }
        }
        guard++;
      } while (this.findMatches().length > 0 && guard < 20);
      var ev0 = { kind: 'invade', side: 'seed', incoming: incoming, prevBounds: null };
      this.lastEvent = ev0;
      return ev0;
    }
    var side = this.rng() < 0.65 ? 'right' : 'top';
    var nTypes = this.typesForLevel(this.level);
    var incoming = [];
    if (side === 'right') {
      if (b.c1 >= COLS - 1) {
        this.gameOver = true;
        this.lastEvent = { kind: 'gameover', reason: 'overflow' };
        return this.lastEvent;
      }
      for (r = b.r0; r <= b.r1; r++) {
        var k = this.makeCookie(nTypes);
        this.board[r][b.c1 + 1] = k;
        incoming.push({ r: r, c: b.c1 + 1, cookie: k });
      }
    } else {
      if (b.r0 <= 0) {
        this.gameOver = true;
        this.lastEvent = { kind: 'gameover', reason: 'overflow' };
        return this.lastEvent;
      }
      for (c = b.c0; c <= b.c1; c++) {
        var k2 = this.makeCookie(nTypes);
        this.board[b.r0 - 1][c] = k2;
        incoming.push({ r: b.r0 - 1, c: c, cookie: k2 });
      }
    }
    var ev = { kind: 'invade', side: side, incoming: incoming, prevBounds: { r0: b.r0, r1: b.r1, c0: b.c0, c1: b.c1 } };
    this.lastEvent = ev;
    // invasions can complete lines -> bonus clear
    var clearEv = this.resolveMatches();
    if (clearEv) {
      ev.clear = clearEv;
      this.lastEvent = ev;
    }
    return ev;
  };

  // Danger 0..1 for HUD tension (how full the tray is)
  CookieGame.prototype.danger = function () {
    return this.count() / (COLS * ROWS);
  };

  global.CookieGame = CookieGame;
})(typeof window !== 'undefined' ? window : global);
