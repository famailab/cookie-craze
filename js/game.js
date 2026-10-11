/* COOKIE CRAZE - core game logic (no DOM). Yoshi's-Cookie-inspired, original code.
 * Board: 6x6. Rotate rows/cols with wrap. A line clears when it holds >=2
 * cookies and all are the same type (wild rainbow cookie matches anything).
 * New cookie lines invade from the right/top on a timer; overflow = game over.
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
    this.overflowAt = -1;
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

  // dir: row 'L'|'R', col 'U'|'D'. Returns list of moves for animation.
  CookieGame.prototype.rotate = function (r, c, dir) {
    if (this.gameOver) return [];
    var moves = [], i, cookie;
    if (dir === 'L' || dir === 'R') {
      var row = this.board[r];
      var nn = (dir === 'R') ? 1 : COLS - 1;
      var moved = false;
      for (i = 0; i < COLS; i++) if (row[i]) { moved = true; break; }
      if (!moved) return [];
      var copy = row.slice();
      for (i = 0; i < COLS; i++) {
        var ni = (i + nn) % COLS;
        row[ni] = copy[i];
        if (copy[i]) moves.push({ cookie: copy[i], fr: r, fc: i, tr: r, tc: ni });
      }
    } else {
      var col = [];
      for (i = 0; i < ROWS; i++) col.push(this.board[i][c]);
      var moved2 = false;
      for (i = 0; i < ROWS; i++) if (col[i]) { moved2 = true; break; }
      if (!moved2) return [];
      var nn2 = (dir === 'D') ? 1 : ROWS - 1;
      for (i = 0; i < ROWS; i++) {
        var ni2 = (i + nn2) % ROWS;
        this.board[ni2][c] = col[i];
        if (col[i]) moves.push({ cookie: col[i], fr: i, fc: c, tr: ni2, tc: c });
      }
    }
    this.lastEvent = { kind: 'rotate', moves: moves };
    return moves;
  };

  // A line matches when it has >=2 cookies and all share one type
  // (wild matches any; all-wild line also clears).
  CookieGame.prototype.findMatches = function () {
    var lines = [], r, c, i;
    function lineType(cells, board) {
      var base = -2, n = 0;
      for (i = 0; i < cells.length; i++) {
        var k = board[cells[i].r][cells[i].c];
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
    for (r = 0; r < ROWS; r++) {
      var rcells = [];
      for (c = 0; c < COLS; c++) rcells.push({ r: r, c: c });
      var t = lineType(rcells, this.board);
      if (t !== null) lines.push({ cells: rcells.filter(function (p) { return true; }), type: t, dir: 'row', idx: r });
    }
    for (c = 0; c < COLS; c++) {
      var ccells = [];
      for (r = 0; r < ROWS; r++) ccells.push({ r: r, c: c });
      var t2 = lineType(ccells, this.board);
      if (t2 !== null) lines.push({ cells: ccells, type: t2, dir: 'col', idx: c });
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
    // combo decay (display only; combo resets on next clear outside window)
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

  CookieGame.prototype.invade = function () {
    var r, c, i;
    if (this.count() >= COLS * ROWS) {
      this.gameOver = true;
      this.lastEvent = { kind: 'gameover', reason: 'full' };
      return this.lastEvent;
    }
    var side = this.rng() < 0.65 ? 'right' : 'top';
    var nTypes = this.typesForLevel(this.level);
    var incoming = [];
    if (side === 'right') {
      for (r = 0; r < ROWS; r++) {
        if (this.board[r][0]) { // pushed out of the field
          this.gameOver = true;
          this.lastEvent = { kind: 'gameover', reason: 'overflow', row: r };
          return this.lastEvent;
        }
      }
      for (r = 0; r < ROWS; r++) {
        for (c = 0; c < COLS - 1; c++) this.board[r][c] = this.board[r][c + 1];
        var k = this.makeCookie(nTypes);
        this.board[r][COLS - 1] = k;
        incoming.push({ r: r, c: COLS - 1, cookie: k });
      }
    } else {
      for (c = 0; c < COLS; c++) {
        if (this.board[ROWS - 1][c]) {
          this.gameOver = true;
          this.lastEvent = { kind: 'gameover', reason: 'overflow', col: c };
          return this.lastEvent;
        }
      }
      for (c = 0; c < COLS; c++) {
        for (r = ROWS - 1; r > 0; r--) this.board[r][c] = this.board[r - 1][c];
        var k2 = this.makeCookie(nTypes);
        this.board[0][c] = k2;
        incoming.push({ r: 0, c: c, cookie: k2 });
      }
    }
    var ev = { kind: 'invade', side: side, incoming: incoming };
    this.lastEvent = ev;
    // invasions can complete lines -> bonus clear
    var clearEv = this.resolveMatches();
    if (clearEv) {
      ev.clear = clearEv;
      this.lastEvent = ev;
    }
    return ev;
  };

  // Danger 0..1 for HUD tension (how full the board is)
  CookieGame.prototype.danger = function () {
    return this.count() / (COLS * ROWS);
  };

  global.CookieGame = CookieGame;
})(typeof window !== 'undefined' ? window : global);
