/* «Ёлкино чудо»: гирлянда и снег для внутренних страниц. Один файл на все страницы, кроме главной.
   Снег: лёгкий canvas; на телефоне частиц меньше; при скрытой вкладке и «уменьшить движение» не анимируется. */
(function () {
  'use strict';
  var body = document.body;
  if (!body || document.querySelector('.hn')) return;       // на главной своя версия
  body.classList.add('pn');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- гирлянда ---------- */
  var gl = document.createElement('div'); gl.className = 'pn-garland'; gl.setAttribute('aria-hidden', 'true');
  var NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 1000 120'); svg.setAttribute('preserveAspectRatio', 'none');
  gl.appendChild(svg); body.appendChild(gl);
  function buildGarland() {
    var top = document.querySelector('.pg-top'); gl.style.top = (top ? top.offsetHeight - 1 : 60) + 'px';
    var mobile = window.innerWidth < 700, n = mobile ? 8 : 15, W = 1000;
    var hooks = mobile ? [[-20, 18], [500, 34], [1020, 14]] : [[-20, 14], [340, 30], [660, 26], [1020, 12]], sag = mobile ? 48 : 34;
    function y(x) {
      for (var i = 0; i < hooks.length - 1; i++) {
        var a = hooks[i], b = hooks[i + 1];
        if (x <= b[0]) { var t = (x - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * t + sag * 4 * t * (1 - t); }
      }
      return hooks[hooks.length - 1][1];
    }
    var d = 'M' + hooks[0][0] + ' ' + hooks[0][1];
    for (var x = hooks[0][0]; x <= 1020; x += 10) d += ' L' + x + ' ' + y(x).toFixed(1);
    svg.innerHTML = '<path d="' + d + '" fill="none" stroke="#1b1408" stroke-width="2.2" vector-effect="non-scaling-stroke" opacity=".9"/>' +
      '<path d="' + d + '" fill="none" stroke="#5a4626" stroke-width="1" vector-effect="non-scaling-stroke" opacity=".7" transform="translate(0 -1)"/>';
    var old = gl.querySelectorAll('.pn-bulb'); for (var k = 0; k < old.length; k++) old[k].remove();
    var h = gl.offsetHeight || 70;
    for (var i = 0; i < n; i++) {
      var bx = 30 + (W - 60) * (i + 0.5) / n + (i % 2 ? 6 : -6), by = y(bx), b = document.createElement('span');
      b.className = 'pn-bulb' + (i % 5 === 2 ? ' amber' : '');
      b.style.left = (bx / W * 100) + '%'; b.style.top = (by / 120 * h).toFixed(1) + 'px';
      b.style.setProperty('--d', (Math.random() * 4).toFixed(2) + 's');
      b.style.setProperty('--t', (2.6 + Math.random() * 2.4).toFixed(2) + 's');
      b.style.setProperty('--r', ((i % 3) - 1) * 8 + 'deg');
      gl.appendChild(b);
    }
  }
  buildGarland();
  var lastW = window.innerWidth;
  window.addEventListener('resize', function () { if (Math.abs(window.innerWidth - lastW) > 40) { lastW = window.innerWidth; buildGarland(); } });

  /* ---------- снег ---------- */
  var cv = document.createElement('canvas'); cv.className = 'pn-snow'; cv.setAttribute('aria-hidden', 'true'); body.appendChild(cv);
  var ctx = cv.getContext('2d'); if (!ctx) return;
  var DPR = Math.min(window.devicePixelRatio || 1, 1.5), W = 0, H = 0, flakes = [], raf = 0, last = 0;
  var SPR = document.createElement('canvas'); SPR.width = SPR.height = 32;
  (function () {
    var g = SPR.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  })();
  function seed() {
    W = cv.width = Math.round(window.innerWidth * DPR); H = cv.height = Math.round(window.innerHeight * DPR);
    var n = window.innerWidth < 700 ? 40 : Math.min(90, Math.round(window.innerWidth * window.innerHeight / 14000));
    flakes = [];
    for (var k = 0; k < n; k++) {
      var z = Math.random(); z = z * z;
      flakes.push({ x: Math.random() * W, y: Math.random() * H, r: (0.8 + z * 2.4) * DPR, vy: (0.3 + z * 1.0) * DPR, ph: Math.random() * 6.28, w: 0.3 + Math.random() * 0.8, a: 0.4 + z * 0.5, z: z });
    }
  }
  function draw(dt) {
    ctx.clearRect(0, 0, W, H);
    for (var k = 0; k < flakes.length; k++) {
      var f = flakes[k];
      f.y += f.vy * dt; f.ph += 0.012 * f.w * dt; f.x += Math.sin(f.ph) * (0.25 + f.z * 0.5) * DPR * dt;
      if (f.y > H + 10) { f.y = -10; f.x = Math.random() * W; }
      if (f.x < -10) f.x = W + 8; else if (f.x > W + 10) f.x = -8;
      ctx.globalAlpha = f.a;
      var s = f.r * 1.5; ctx.drawImage(SPR, f.x - s, f.y - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
  }
  function frame(t) {
    raf = 0; if (document.hidden) return;
    var dt = Math.min(3, (t - (last || t)) / 16.67); last = t;
    draw(dt); raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && !reduce) { last = 0; raf = requestAnimationFrame(frame); } }
  seed();
  var rt = 0;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { seed(); if (reduce) draw(0); }, 150); });
  if (reduce) draw(0); else { document.addEventListener('visibilitychange', kick); kick(); }
})();
