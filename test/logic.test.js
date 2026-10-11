/* Node harness for js/game.js core logic. Run: node test/logic.test.js */
'use strict';
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../js/game.js', 'utf8');
eval(src); // defines CookieGame on global

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL:', name); }
}
// deterministic rng
function seqRng(vals) {
  let i = 0;
  return function () { return vals[(i++) % vals.length]; };
}

// --- 1. rotation wraps rows ---
{
  const g = new CookieGame({ rng: seqRng([0.5]) });
  g.reset();
  // empty row 0 first
  for (let c = 0; c < 6; c++) g.board[0][c] = null;
  g.board[0][0] = { id: 1, t: 0, wild: false };
  g.board[0][5] = { id: 2, t: 1, wild: false };
  const moves = g.rotate(0, 0, 'R');
  ok(g.board[0][1] && g.board[0][1].id === 1, 'row R: cookie 0->1');
  ok(g.board[0][0] && g.board[0][0].id === 2, 'row R: wrap 5->0');
  ok(moves.length === 2, 'row R: 2 moves reported');
  g.rotate(0, 0, 'L');
  ok(g.board[0][0].id === 1 && g.board[0][5].id === 2, 'row L: back to start');
}

// --- 2. rotation wraps columns ---
{
  const g = new CookieGame({ rng: seqRng([0.5]) });
  g.reset();
  for (let r = 0; r < 6; r++) g.board[r][2] = null;
  g.board[0][2] = { id: 11, t: 0, wild: false };
  g.board[5][2] = { id: 12, t: 1, wild: false };
  g.rotate(0, 2, 'D');
  ok(g.board[1][2].id === 11, 'col D: 0->1');
  ok(g.board[0][2].id === 12, 'col D: wrap 5->0');
  g.rotate(0, 2, 'U');
  ok(g.board[0][2].id === 11 && g.board[5][2].id === 12, 'col U: back to start');
}

// --- 3. row match clears (holes ignored, >=2) ---
{
  const g = new CookieGame({ rng: seqRng([0.5]) });
  g.reset();
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) g.board[r][c] = null;
  g.board[2][1] = { id: 21, t: 2, wild: false };
  g.board[2][4] = { id: 22, t: 2, wild: false };
  const ev = g.resolveMatches();
  ok(ev && ev.cleared.length === 2, 'row with holes clears (2 cookies)');
  ok(g.board[2][1] === null && g.board[2][4] === null, 'cleared cells emptied');
  ok(ev.gained === 2 * 10 * 1 * 1 * 1, 'score = 2*10*level(1)*lines(1)*combo(1)');
}

// --- 4. mixed types do NOT clear ---
{
  const g = new CookieGame({ rng: seqRng([0.5]) });
  g.reset();
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) g.board[r][c] = null;
  g.board[3][0] = { id: 31, t: 0, wild: false };
  g.board[3][1] = { id: 32, t: 1, wild: false };
  ok(g.resolveMatches() === null, 'mixed row does not clear');
}

// --- 5. wild matches any type ---
{
  const g = new CookieGame({ rng: seqRng([0.5]) });
  g.reset();
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) g.board[r][c] = null;
  g.board[4][0] = { id: 41, t: 3, wild: false };
  g.board[4][3] = { id: 42, t: -1, wild: true };
  g.board[4][5] = { id: 43, t: 3, wild: false };
  const ev = g.resolveMatches();
  ok(ev && ev.cleared.length === 3, 'wild bridges a line of 3');
}

// --- 6. column match clears ---
{
  const g = new CookieGame({ rng: seqRng([0.5]) });
  g.reset();
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) g.board[r][c] = null;
  g.board[1][5] = { id: 51, t: 1, wild: false };
  g.board[4][5] = { id: 52, t: 1, wild: false };
  const ev = g.resolveMatches();
  ok(ev && ev.cleared.length === 2, 'column match clears');
}

// --- 7. single cookie never clears ---
{
  const g = new CookieGame({ rng: seqRng([0.5]) });
  g.reset();
  for (let c = 0; c < 6; c++) g.board[1][c] = null;
  g.board[1][2] = { id: 61, t: 0, wild: false };
  // make sure nothing else matches: clear board fully first
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) g.board[r][c] = null;
  g.board[1][2] = { id: 61, t: 0, wild: false };
  ok(g.resolveMatches() === null, 'lone cookie does not clear');
}

// --- 8. multi-line simultaneous clear: bonus multiplier = lines ---
{
  const g = new CookieGame({ rng: seqRng([0.5]) });
  g.reset();
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) g.board[r][c] = null;
  // row 1: two t0; col 0: two t1 -> both clear at once (disjoint)
  g.board[1][3] = { id: 71, t: 0, wild: false };
  g.board[1][4] = { id: 72, t: 0, wild: false };
  g.board[2][0] = { id: 73, t: 1, wild: false };
  g.board[5][0] = { id: 74, t: 1, wild: false };
  const ev = g.resolveMatches();
  ok(ev && ev.lines === 2, 'two lines clear simultaneously');
  ok(ev.cleared.length === 4, '4 cookies cleared');
  ok(ev.gained === 4 * 10 * 1 * 2 * 1, 'score multiplied by line count (2)');
}

// --- 9. combo: second clear within window multiplies ---
{
  const g = new CookieGame({ rng: seqRng([0.5]) });
  g.reset();
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) g.board[r][c] = null;
  g.board[0][0] = { id: 81, t: 0, wild: false };
  g.board[0][1] = { id: 82, t: 0, wild: false };
  const e1 = g.resolveMatches();
  ok(e1.combo === 1, 'first clear combo=1');
  g.now += 1.0;
  g.board[1][0] = { id: 83, t: 0, wild: false };
  g.board[1][1] = { id: 84, t: 0, wild: false };
  const e2 = g.resolveMatches();
  ok(e2.combo === 2, 'second clear within window combo=2');
  ok(e2.gained === e1.gained * 2, 'combo doubles score');
  g.now += 10.0;
  g.board[2][0] = { id: 85, t: 0, wild: false };
  g.board[2][1] = { id: 86, t: 0, wild: false };
  const e3 = g.resolveMatches();
  ok(e3.combo === 1, 'combo resets after window');
}

// --- 10. level up every 5 lines ---
{
  const g = new CookieGame({ rng: seqRng([0.5]) });
  g.reset();
  ok(g.level === 1, 'starts at level 1');
  g.lines = 4;
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) g.board[r][c] = null;
  g.board[0][0] = { id: 91, t: 0, wild: false };
  g.board[0][1] = { id: 92, t: 0, wild: false };
  const ev = g.resolveMatches();
  ok(ev.leveledUp && g.level === 2, 'level up at 5 lines');
  ok(g.typesForLevel(1) === 3 && g.typesForLevel(3) === 4 && g.typesForLevel(5) === 5, 'type count grows with level');
}

// --- 11. invasion from right shifts left; overflow at col 0 = game over ---
{
  const g = new CookieGame({ rng: seqRng([0.9, 0.1]) }); // 0.9 -> side 'top'? 0.9>=0.65 -> top. use 0.1 for right
  g.reset();
  g.rng = seqRng([0.1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]); // side right, then cookie gen
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) g.board[r][c] = null;
  g.board[2][0] = { id: 101, t: 0, wild: false }; // will be pushed out
  const ev = g.invade();
  ok(g.gameOver && ev.kind === 'gameover', 'overflow from col 0 = game over');
}

// --- 12. invasion from right normally shifts + inserts ---
{
  const g = new CookieGame({ rng: seqRng([0.1]) });
  g.reset();
  // mixed types in the new column so it does not auto-clear
  g.rng = seqRng([0.1, 0.99, 0.2, 0.99, 0.5, 0.99, 0.8, 0.99, 0.2, 0.99, 0.5, 0.99, 0.8]);
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) g.board[r][c] = null;
  g.board[3][2] = { id: 111, t: 1, wild: false };
  const ev = g.invade();
  ok(!g.gameOver && ev.side === 'right', 'right invasion proceeds');
  ok(g.board[3][1] && g.board[3][1].id === 111, 'cookie shifted left');
  ok(g.board[3][5] !== null, 'new cookie inserted at col 5');
}

// --- 13. invasion from top shifts down; overflow at bottom row = game over ---
{
  const g = new CookieGame({ rng: seqRng([0.9]) });
  g.reset();
  g.rng = seqRng([0.9, 0.5]);
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) g.board[r][c] = null;
  g.board[5][3] = { id: 121, t: 0, wild: false };
  const ev = g.invade();
  ok(g.gameOver && ev.kind === 'gameover' && ev.reason === 'overflow', 'overflow from bottom row = game over');
}

// --- 14. full board invasion = game over ---
{
  const g = new CookieGame({ rng: seqRng([0.1]) });
  g.reset();
  let id = 200;
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) g.board[r][c] = { id: id++, t: (r + c) % 3, wild: false };
  const ev = g.invade();
  ok(g.gameOver, 'full board invasion = game over');
}

// --- 15. rotate on empty line is a no-op ---
{
  const g = new CookieGame({ rng: seqRng([0.5]) });
  g.reset();
  for (let c = 0; c < 6; c++) g.board[5][c] = null;
  ok(g.rotate(5, 0, 'R').length === 0, 'empty row rotate = no-op');
}

// --- 16. update() triggers invasion on timer ---
{
  const g = new CookieGame({ rng: seqRng([0.1, 0.99, 0.0]) });
  g.reset();
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) g.board[r][c] = null;
  g.invasionIn = 0.05;
  const ev = g.update(0.1);
  ok(ev && ev.kind === 'invade', 'timer triggers invasion');
  ok(g.invasionIn > 5, 'invasion timer reset');
}

// --- 17. initial board has no matches ---
{
  for (let t = 0; t < 20; t++) {
    const g = new CookieGame();
    g.reset();
    ok(g.findMatches().length === 0, 'initial board clean (trial ' + t + ')');
    ok(g.count() === 9, 'initial 3x3 = 9 cookies');
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
