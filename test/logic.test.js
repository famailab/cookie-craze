/* Node harness for js/game.js core logic (region-based). Run: node test/logic.test.js */
'use strict';
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../js/game.js', 'utf8');
eval(src); // defines CookieGame on global

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL:', name); }
}
function seqRng(vals) {
  let i = 0;
  return function () { return vals[(i++) % vals.length]; };
}
function clearBoard(g) {
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) g.board[r][c] = null;
}
function ck(id, t, wild) { return { id: id, t: t, wild: !!wild }; }

// --- 1. bounds of initial board ---
{
  const g = new CookieGame({ rng: seqRng([0.5]) });
  g.reset();
  const b = g.bounds();
  ok(b && b.r0 === 3 && b.r1 === 5 && b.c0 === 0 && b.c1 === 2, 'initial bounds = rows 3-5, cols 0-2');
}

// --- 2. row rotation wraps WITHIN region ---
{
  const g = new CookieGame({ rng: seqRng([0.5]) });
  g.reset(); clearBoard(g);
  g.board[4][0] = ck(1, 0); g.board[4][2] = ck(2, 1);
  const moves = g.rotate(4, 0, 'R');
  ok(g.board[4][1].id === 1, 'row R within region: 0->1');
  ok(g.board[4][0].id === 2, 'row R within region: wrap 2->0');
  ok(g.board[4][3] === null && g.board[4][5] === null, 'row R: outside region untouched');
  ok(moves.length === 2, '2 moves reported');
  // region shrank to cols 0-1 (trailing hole dropped out); L wraps within it
  ok(JSON.stringify(g.bounds()) === JSON.stringify({r0:4,r1:4,c0:0,c1:1}), 'region shrank after R');
  g.rotate(4, 0, 'L');
  ok(g.board[4][0].id === 1 && g.board[4][1].id === 2, 'row L swaps within shrunken region');
}

// --- 3. rotate outside region = no-op ---
{
  const g = new CookieGame({ rng: seqRng([0.5]) });
  g.reset(); clearBoard(g);
  g.board[4][0] = ck(1, 0); g.board[4][2] = ck(2, 1);
  ok(g.rotate(0, 0, 'R').length === 0, 'row above region = no-op');
  ok(g.rotate(4, 5, 'D').length === 0, 'col outside region = no-op');
}

// --- 4. column rotation wraps within region ---
{
  const g = new CookieGame({ rng: seqRng([0.5]) });
  g.reset(); clearBoard(g);
  g.board[3][1] = ck(11, 0); g.board[5][1] = ck(12, 1);
  g.rotate(3, 1, 'D');
  ok(g.board[4][1].id === 11, 'col D within region: 3->4');
  ok(g.board[3][1].id === 12, 'col D within region: wrap 5->3');
  // region shrank to rows 3-4; U wraps within it
  g.rotate(3, 1, 'U');
  ok(g.board[3][1].id === 11 && g.board[4][1].id === 12, 'col U swaps within shrunken region');
}

// --- 5. row match clears (holes ignored, >=2, within region) ---
{
  const g = new CookieGame({ rng: seqRng([0.5]) });
  g.reset(); clearBoard(g);
  g.board[2][1] = ck(21, 2); g.board[2][4] = ck(22, 2);
  const ev = g.resolveMatches();
  ok(ev && ev.cleared.length === 2, 'row with holes clears');
  ok(ev.gained === 2 * 10 * 1 * 1 * 1, 'score = 2*10*level*lines*combo');
}

// --- 6. mixed types do NOT clear ---
{
  const g = new CookieGame({ rng: seqRng([0.5]) });
  g.reset(); clearBoard(g);
  g.board[3][0] = ck(31, 0); g.board[3][1] = ck(32, 1);
  ok(g.resolveMatches() === null, 'mixed row does not clear');
}

// --- 7. wild matches any type ---
{
  const g = new CookieGame({ rng: seqRng([0.5]) });
  g.reset(); clearBoard(g);
  g.board[4][0] = ck(41, 3); g.board[4][3] = ck(42, -1, true); g.board[4][5] = ck(43, 3);
  const ev = g.resolveMatches();
  ok(ev && ev.cleared.length === 3, 'wild bridges a line of 3');
}

// --- 8. single cookie never clears ---
{
  const g = new CookieGame({ rng: seqRng([0.5]) });
  g.reset(); clearBoard(g);
  g.board[1][2] = ck(61, 0);
  ok(g.resolveMatches() === null, 'lone cookie does not clear');
}

// --- 9. multi-line simultaneous clear ---
{
  const g = new CookieGame({ rng: seqRng([0.5]) });
  g.reset(); clearBoard(g);
  g.board[1][3] = ck(71, 0); g.board[1][4] = ck(72, 0);
  g.board[2][0] = ck(73, 1); g.board[5][0] = ck(74, 1);
  const ev = g.resolveMatches();
  ok(ev && ev.lines === 2 && ev.cleared.length === 4, 'two lines, 4 cookies');
  ok(ev.gained === 4 * 10 * 1 * 2 * 1, 'score x lines');
}

// --- 10. combo window ---
{
  const g = new CookieGame({ rng: seqRng([0.5]) });
  g.reset(); clearBoard(g);
  g.board[0][0] = ck(81, 0); g.board[0][1] = ck(82, 0);
  const e1 = g.resolveMatches();
  ok(e1.combo === 1, 'first clear combo=1');
  g.now += 1.0;
  g.board[1][0] = ck(83, 0); g.board[1][1] = ck(84, 0);
  const e2 = g.resolveMatches();
  ok(e2.combo === 2 && e2.gained === e1.gained * 2, 'combo=2 doubles score');
  g.now += 10.0;
  g.board[2][0] = ck(85, 0); g.board[2][1] = ck(86, 0);
  ok(g.resolveMatches().combo === 1, 'combo resets after window');
}

// --- 11. level up every 5 lines + type growth ---
{
  const g = new CookieGame({ rng: seqRng([0.5]) });
  g.reset(); clearBoard(g);
  g.lines = 4;
  g.board[0][0] = ck(91, 0); g.board[0][1] = ck(92, 0);
  const ev = g.resolveMatches();
  ok(ev.leveledUp && g.level === 2, 'level up at 5 lines');
  ok(g.typesForLevel(1) === 3 && g.typesForLevel(3) === 4 && g.typesForLevel(5) === 5, 'types grow');
}

// --- 12. right invasion GROWS region (no shift) ---
{
  const g = new CookieGame({ rng: seqRng([0.1]) });
  g.reset(); clearBoard(g);
  g.rng = seqRng([0.1, 0.99, 0.2, 0.99, 0.5, 0.99, 0.8]); // side right, mixed types
  g.board[4][1] = ck(111, 1);
  const ev = g.invade();
  ok(!g.gameOver && ev.side === 'right', 'right invasion proceeds');
  ok(g.board[4][1].id === 111, 'existing cookie NOT shifted');
  ok(g.board[4][2] !== null, 'new cookie at region right+1 (col 2)');
  const b = g.bounds();
  ok(b.c1 === 2, 'region grew to col 2');
  ok(ev.prevBounds && ev.prevBounds.c1 === 1, 'prevBounds reported');
}

// --- 13. top invasion grows upward ---
{
  const g = new CookieGame({ rng: seqRng([0.9]) });
  g.reset(); clearBoard(g);
  g.rng = seqRng([0.9, 0.99, 0.5, 0.99, 0.2]); // top; new row t1,t0 avoids auto-clear
  g.board[4][1] = ck(121, 0); g.board[5][2] = ck(122, 1);
  const ev = g.invade();
  ok(!g.gameOver && ev.side === 'top', 'top invasion proceeds');
  ok(g.board[3][1] !== null && g.board[3][2] !== null, 'new row at region top-1 (row 3)');
  ok(g.bounds().r0 === 3, 'region grew to row 3');
}

// --- 14. overflow: region at right edge + right invasion = game over ---
{
  const g = new CookieGame({ rng: seqRng([0.1]) });
  g.reset(); clearBoard(g);
  g.rng = seqRng([0.1]);
  g.board[2][5] = ck(131, 0);
  const ev = g.invade();
  ok(g.gameOver && ev.kind === 'gameover', 'right edge overflow = game over');
}

// --- 15. overflow: region at top edge + top invasion = game over ---
{
  const g = new CookieGame({ rng: seqRng([0.9]) });
  g.reset(); clearBoard(g);
  g.rng = seqRng([0.9]);
  g.board[0][2] = ck(141, 0);
  const ev = g.invade();
  ok(g.gameOver && ev.kind === 'gameover', 'top edge overflow = game over');
}

// --- 16. full tray invasion = game over ---
{
  const g = new CookieGame({ rng: seqRng([0.1]) });
  g.reset();
  let id = 200;
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) g.board[r][c] = { id: id++, t: (r + c) % 3, wild: false };
  const ev = g.invade();
  ok(g.gameOver, 'full tray invasion = game over');
}

// --- 17. empty board invasion seeds 2x2 ---
{
  const g = new CookieGame({ rng: seqRng([0.5, 0.99, 0.1, 0.99, 0.4, 0.99, 0.7, 0.99, 0.2]) });
  g.reset(); clearBoard(g);
  const ev = g.invade();
  ok(!g.gameOver && ev.side === 'seed', 'empty board seeds');
  ok(g.count() === 4, 'seeded 2x2 = 4 cookies');
  ok(g.findMatches().length === 0, 'seed has no instant match');
}

// --- 18. rotate on empty region line = no-op; empty board rotate = no-op ---
{
  const g = new CookieGame({ rng: seqRng([0.5]) });
  g.reset(); clearBoard(g);
  ok(g.rotate(2, 2, 'R').length === 0, 'empty board rotate = no-op');
  ok(g.bounds() === null, 'empty bounds = null');
}

// --- 19. update() triggers invasion on timer ---
{
  const g = new CookieGame({ rng: seqRng([0.1, 0.99, 0.2]) });
  g.reset(); clearBoard(g);
  g.board[4][1] = ck(151, 0);
  g.invasionIn = 0.05;
  const ev = g.update(0.1);
  ok(ev && ev.kind === 'invade', 'timer triggers invasion');
  ok(g.invasionIn > 5, 'timer reset');
}

// --- 20. initial board clean + bounds shrink after clear ---
{
  for (let t = 0; t < 10; t++) {
    const g = new CookieGame();
    g.reset();
    ok(g.findMatches().length === 0, 'initial clean (trial ' + t + ')');
  }
  const g = new CookieGame({ rng: seqRng([0.5]) });
  g.reset(); clearBoard(g);
  g.board[3][0] = ck(161, 0); g.board[3][1] = ck(162, 0); g.board[5][5] = ck(163, 1);
  g.resolveMatches();
  const b = g.bounds();
  ok(b.r0 === 5 && b.c0 === 5 && b.c1 === 5, 'bounds shrink after clear');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
