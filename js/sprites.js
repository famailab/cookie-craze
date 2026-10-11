/* COOKIE CRAZE - procedural cookie artwork. Original designs, drawn in canvas.
 * makeSprites() -> { list: [choc, heart, triangle, flower, star], wild }
 * Each sprite is a 96x96 canvas, cookie ~r40 centered.
 */
(function (global) {
  'use strict';
  var S = 96, C = 48;

  function cv() {
    var c = document.createElement('canvas');
    c.width = S; c.height = S;
    return c;
  }

  function gloss(g, x, y, rx, ry, rot, alpha) {
    g.save();
    g.translate(x, y); g.rotate(rot);
    var gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, 'rgba(255,255,255,' + alpha + ')');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  function rim(g, r, color, w) {
    g.strokeStyle = color; g.lineWidth = w || 3;
    g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.stroke();
  }

  function bottomShade(g, r) {
    var gr = g.createRadialGradient(C, C + r * 0.55, r * 0.2, C, C, r * 1.15);
    gr.addColorStop(0, 'rgba(70,35,10,0.30)');
    gr.addColorStop(0.55, 'rgba(70,35,10,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.fill();
  }

  // ---- 0. choc chip cookie ----
  function choc() {
    var c = cv(), g = c.getContext('2d');
    var base = g.createRadialGradient(40, 36, 6, C, C, 42);
    base.addColorStop(0, '#f4bd72');
    base.addColorStop(0.55, '#d8934a');
    base.addColorStop(1, '#9c5c22');
    g.fillStyle = base;
    g.beginPath(); g.arc(C, C, 40, 0, Math.PI * 2); g.fill();
    rim(g, 38.5, 'rgba(96,52,16,0.65)', 3);
    // baked blotches
    g.fillStyle = 'rgba(150,90,35,0.28)';
    [[30, 62, 9, 6], [64, 58, 8, 7], [58, 32, 7, 5], [36, 40, 6, 8]].forEach(function (b) {
      g.beginPath(); g.ellipse(b[0], b[1], b[2], b[3], 0.4, 0, Math.PI * 2); g.fill();
    });
    // chips
    var chips = [[34, 34, 7], [52, 28, 6], [62, 46, 7.5], [44, 52, 6], [30, 50, 5.5], [56, 64, 6], [42, 66, 5]];
    chips.forEach(function (p) {
      var cg = g.createRadialGradient(p[0] - 2, p[1] - 2, 1, p[0], p[1], p[2]);
      cg.addColorStop(0, '#6b4423'); cg.addColorStop(1, '#33200e');
      g.fillStyle = cg;
      g.beginPath(); g.arc(p[0], p[1], p[2], 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,220,170,0.35)';
      g.beginPath(); g.arc(p[0] - 2, p[1] - 2, p[2] * 0.32, 0, Math.PI * 2); g.fill();
    });
    bottomShade(g, 40);
    gloss(g, 33, 28, 15, 8, -0.5, 0.5);
    return c;
  }

  // ---- 1. strawberry heart ----
  function heartPath(g, s) {
    s = s || 1;
    g.beginPath();
    g.moveTo(C, C + 30 * s);
    g.bezierCurveTo(C - 44 * s, C + 2 * s, C - 34 * s, C - 34 * s, C, C - 8 * s);
    g.bezierCurveTo(C + 34 * s, C - 34 * s, C + 44 * s, C + 2 * s, C, C + 30 * s);
    g.closePath();
  }
  function heart() {
    var c = cv(), g = c.getContext('2d');
    var base = g.createRadialGradient(38, 32, 6, C, C + 4, 46);
    base.addColorStop(0, '#ffb3c1');
    base.addColorStop(0.55, '#f2668a');
    base.addColorStop(1, '#c9335c');
    heartPath(g); g.fillStyle = base; g.fill();
    g.strokeStyle = 'rgba(140,25,55,0.6)'; g.lineWidth = 3;
    heartPath(g, 0.97); g.stroke();
    // seeds
    g.fillStyle = '#ffe6ec';
    [[36, 40], [48, 34], [60, 40], [42, 52], [54, 52], [48, 62], [33, 52], [63, 52], [48, 44]].forEach(function (p, i) {
      g.save(); g.translate(p[0], p[1]); g.rotate(i * 0.7);
      g.beginPath(); g.ellipse(0, 0, 2.6, 3.6, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    });
    // leaves at the notch
    g.fillStyle = '#58a34b';
    [[38, 22, -0.5], [58, 22, 0.5]].forEach(function (p) {
      g.save(); g.translate(p[0], p[1]); g.rotate(p[2]);
      g.beginPath(); g.ellipse(0, 0, 9, 4.5, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    });
    g.strokeStyle = '#3c7a32'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(C, 26); g.lineTo(C, 16); g.stroke();
    gloss(g, 34, 36, 13, 7, -0.6, 0.55);
    return c;
  }

  // ---- 2. matcha triangle ----
  function triPath(g, r, dy) {
    dy = dy || 0;
    g.beginPath();
    var pts = [];
    for (var i = 0; i < 3; i++) {
      var a = -Math.PI / 2 + i * Math.PI * 2 / 3;
      pts.push([C + Math.cos(a) * r, C + Math.sin(a) * r + dy]);
    }
    g.moveTo((pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2);
    for (i = 0; i < 3; i++) {
      var p = pts[i], q = pts[(i + 1) % 3];
      g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    g.closePath();
  }
  function triangle() {
    var c = cv(), g = c.getContext('2d');
    var base = g.createRadialGradient(40, 34, 6, C, C + 6, 48);
    base.addColorStop(0, '#b5e394');
    base.addColorStop(0.55, '#7cba5f');
    base.addColorStop(1, '#4e8a3c');
    triPath(g, 42, 4); g.fillStyle = base; g.fill();
    g.strokeStyle = 'rgba(52,100,40,0.65)'; g.lineWidth = 3;
    triPath(g, 40, 4); g.stroke();
    // swirl
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.arc(C, C + 8, 16, 0.4, 2.6); g.stroke();
    g.beginPath(); g.arc(C, C + 8, 24, 2.8, 5.2); g.stroke();
    // sesame
    g.fillStyle = '#f7efdc';
    [[40, 44], [56, 44], [48, 56], [44, 32], [54, 60]].forEach(function (p) {
      g.beginPath(); g.arc(p[0], p[1], 2.4, 0, Math.PI * 2); g.fill();
    });
    gloss(g, 36, 30, 12, 7, -0.5, 0.5);
    return c;
  }

  // ---- 3. vanilla flower ----
  function flower() {
    var c = cv(), g = c.getContext('2d');
    for (var i = 0; i < 5; i++) {
      var a = -Math.PI / 2 + i * Math.PI * 2 / 5;
      var px = C + Math.cos(a) * 22, py = C + Math.sin(a) * 22;
      var pg = g.createRadialGradient(px - 4, py - 4, 2, px, py, 20);
      pg.addColorStop(0, '#fff8e2'); pg.addColorStop(0.7, '#f6d789'); pg.addColorStop(1, '#d9a44e');
      g.fillStyle = pg;
      g.save(); g.translate(px, py); g.rotate(a);
      g.beginPath(); g.ellipse(0, 0, 19, 13.5, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    g.strokeStyle = 'rgba(160,110,40,0.5)'; g.lineWidth = 2.5;
    for (i = 0; i < 5; i++) {
      a = -Math.PI / 2 + i * Math.PI * 2 / 5;
      px = C + Math.cos(a) * 22; py = C + Math.sin(a) * 22;
      g.save(); g.translate(px, py); g.rotate(a);
      g.beginPath(); g.ellipse(0, 0, 19, 13.5, 0, 0, Math.PI * 2); g.stroke();
      g.restore();
    }
    var cg = g.createRadialGradient(44, 42, 2, C, C, 16);
    cg.addColorStop(0, '#ffd873'); cg.addColorStop(1, '#dd8f26');
    g.fillStyle = cg;
    g.beginPath(); g.arc(C, C, 14, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(150,80,15,0.55)';
    [[42, 44], [52, 42], [47, 52]].forEach(function (p) {
      g.beginPath(); g.arc(p[0], p[1], 2.2, 0, Math.PI * 2); g.fill();
    });
    gloss(g, 34, 30, 12, 7, -0.5, 0.45);
    return c;
  }

  // ---- 4. honey star ----
  function starPath(g, rO, rI, rot) {
    rot = rot || -Math.PI / 2;
    g.beginPath();
    for (var i = 0; i < 10; i++) {
      var r = i % 2 === 0 ? rO : rI;
      var a = rot + i * Math.PI / 5;
      var x = C + Math.cos(a) * r, y = C + Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
  }
  function star() {
    var c = cv(), g = c.getContext('2d');
    g.lineJoin = 'round';
    var base = g.createRadialGradient(42, 38, 6, C, C, 44);
    base.addColorStop(0, '#ffe48c');
    base.addColorStop(0.55, '#f9b545');
    base.addColorStop(1, '#cf7a1c');
    starPath(g, 42, 18); g.fillStyle = base; g.fill();
    g.strokeStyle = 'rgba(150,85,15,0.6)'; g.lineWidth = 3;
    starPath(g, 40, 17); g.stroke();
    // inner glow star
    g.fillStyle = 'rgba(255,255,255,0.30)';
    starPath(g, 24, 10.5); g.fill();
    // honey drizzle
    g.strokeStyle = 'rgba(165,95,20,0.55)'; g.lineWidth = 3; g.lineCap = 'round';
    [[30, 52, 44, 58], [52, 58, 64, 50], [36, 40, 50, 34]].forEach(function (p) {
      g.beginPath(); g.moveTo(p[0], p[1]);
      g.quadraticCurveTo((p[0] + p[2]) / 2, Math.max(p[1], p[3]) + 4, p[2], p[3]);
      g.stroke();
    });
    gloss(g, 36, 30, 12, 7, -0.5, 0.5);
    return c;
  }

  // ---- 5. rainbow wild ----
  function rainbow() {
    var c = cv(), g = c.getContext('2d');
    var cols = ['#ff5b5b', '#ff9f43', '#ffd93b', '#6bcf5f', '#4fb8ff', '#9b7bff'];
    if (g.createConicGradient) {
      var cg = g.createConicGradient(-0.4, C, C);
      cols.forEach(function (col, i) {
        cg.addColorStop(i / cols.length, col);
        cg.addColorStop((i + 1) / cols.length, col);
      });
      g.fillStyle = cg;
    } else {
      for (var i = 0; i < 12; i++) {
        g.fillStyle = cols[i % cols.length];
        g.beginPath(); g.moveTo(C, C);
        g.arc(C, C, 40, i * Math.PI / 6, (i + 1) * Math.PI / 6); g.fill();
      }
    }
    g.beginPath(); g.arc(C, C, 40, 0, Math.PI * 2); g.fill();
    // white swirl
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.arc(C, C, 24, 0.6, 3.4); g.stroke();
    g.lineWidth = 3.5;
    g.beginPath(); g.arc(C, C, 13, 3.6, 6.0); g.stroke();
    rim(g, 38.5, 'rgba(255,255,255,0.85)', 3.5);
    // sparkles
    function spark(x, y, r) {
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.beginPath();
      g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y);
      g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y);
      g.quadraticCurveTo(x, y, x, y - r); g.fill();
    }
    spark(30, 32, 7); spark(64, 56, 5.5); spark(56, 28, 4.5);
    gloss(g, 34, 28, 13, 7, -0.5, 0.5);
    return c;
  }

  function makeSprites() {
    return { list: [choc(), heart(), triangle(), flower(), star()], wild: rainbow() };
  }

  global.makeSprites = makeSprites;
})(typeof window !== 'undefined' ? window : global);
