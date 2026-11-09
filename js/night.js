/* Первый экран «зимняя ночь»: гирлянда на проводе, снег в три плана, лёгкий параллакс слоёв.
   Всё работает только пока первый экран виден; при «уменьшить движение» — статичная картинка. */
(function () {
  'use strict';
  var hero = document.querySelector('.hn');
  if (!hero) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var visible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) kick(); }, { rootMargin: '60px' }).observe(hero);
  }

  /* ---------- гирлянда: провод-цепочка и тёплые лампочки на нём ---------- */
  var gsvg = document.getElementById('hn-garland');
  function buildGarland() {
    if (!gsvg) return;
    var mobile = window.innerWidth < 700, n = mobile ? 9 : 17, W = 1000;
    // провод провисает между тремя точками подвеса
    var hooks = mobile ? [[-20, 18], [500, 34], [1020, 14]] : [[-20, 14], [340, 30], [660, 26], [1020, 12]];
    var sag = mobile ? 48 : 34;
    function y(x) {
      for (var i = 0; i < hooks.length - 1; i++) {
        var a = hooks[i], b = hooks[i + 1];
        if (x <= b[0]) { var t = (x - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * t + sag * 4 * t * (1 - t); }
      }
      return hooks[hooks.length - 1][1];
    }
    var d = 'M' + hooks[0][0] + ' ' + hooks[0][1];
    for (var x = hooks[0][0]; x <= 1020; x += 10) d += ' L' + x + ' ' + y(x).toFixed(1);
    var s = '<path d="' + d + '" fill="none" stroke="#1b1408" stroke-width="2.2" vector-effect="non-scaling-stroke" opacity=".9"/>' +
            '<path d="' + d + '" fill="none" stroke="#5a4626" stroke-width="1" vector-effect="non-scaling-stroke" opacity=".7" transform="translate(0 -1)"/>';
    gsvg.innerHTML = s;
    // лампочки — HTML-элементы поверх SVG (чтобы не растягивались вместе с viewBox)
    var old = hero.querySelectorAll('.hn-bulb'); for (var k = 0; k < old.length; k++) old[k].remove();
    var frag = document.createDocumentFragment();
    for (var i = 0; i < n; i++) {
      var bx = 30 + (W - 60) * (i + 0.5) / n + (i % 2 ? 6 : -6), by = y(bx);
      var b = document.createElement('span');
      b.className = 'hn-bulb' + (i % 5 === 2 ? ' amber' : '');
      b.style.left = (bx / W * 100) + '%';
      b.style.top = 'calc(var(--g-top) + var(--g-h) * ' + (by / 120).toFixed(4) + ')';
      b.style.setProperty('--d', (Math.random() * 4).toFixed(2) + 's');
      b.style.setProperty('--t', (2.6 + Math.random() * 2.4).toFixed(2) + 's');
      b.style.setProperty('--r', ((i % 3) - 1) * 8 + 'deg');
      frag.appendChild(b);
    }
    hero.querySelector('.hn-scene').appendChild(frag);
  }
  buildGarland();
  var lastW = window.innerWidth;
  window.addEventListener('resize', function () { if (Math.abs(window.innerWidth - lastW) > 40) { lastW = window.innerWidth; buildGarland(); } });

  /* ---------- снег первого экрана: дальний мелкий, средний, ближний размытый ---------- */
  var cv = document.getElementById('hn-snow'), ctx = cv && cv.getContext('2d'), W = 0, H = 0, flakes = [];
  var SPR = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 32; var g = c.getContext('2d');
    var gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return c;
  })();
  function seed() {
    if (!cv) return;
    var r = cv.getBoundingClientRect(); W = cv.width = Math.round(r.width * DPR); H = cv.height = Math.round(r.height * DPR);
    var n = Math.min(window.innerWidth < 700 ? 110 : 190, Math.round(r.width * r.height / 5200));
    flakes = [];
    for (var k = 0; k < n; k++) {
      var z = Math.random(); z = z * z;                     // больше дальних
      flakes.push({ x: Math.random() * W, y: Math.random() * H, z: z, r: (0.7 + z * 2.6) * DPR, vy: (0.25 + z * 1.1) * DPR, ph: Math.random() * 6.28, w: 0.3 + Math.random() * 0.8, a: 0.35 + z * 0.6 });
    }
  }
  function drawSnow(dt) {
    ctx.clearRect(0, 0, W, H);
    for (var k = 0; k < flakes.length; k++) {
      var f = flakes[k];
      f.y += f.vy * dt; f.ph += 0.012 * f.w * dt; f.x += Math.sin(f.ph) * (0.25 + f.z * 0.6) * DPR * dt;
      if (f.y > H + 10) { f.y = -10; f.x = Math.random() * W; }
      if (f.x < -10) f.x = W + 8; else if (f.x > W + 10) f.x = -8;
      ctx.globalAlpha = f.a * (f.z > 0.75 ? 0.55 : 1);
      var s = f.r * (f.z > 0.8 ? 1.9 : 1.4);
      ctx.drawImage(SPR, f.x - s, f.y - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- параллакс: слои сдвигаются от прокрутки и от курсора/наклона ---------- */
  var layers = [].slice.call(hero.querySelectorAll('.hn-l[data-depth]')).map(function (el) { return { el: el, d: +el.getAttribute('data-depth') }; });
  var px = 0, py = 0, tx = 0, ty = 0;
  if (!reduce && window.matchMedia('(pointer: fine)').matches) {
    hero.addEventListener('pointermove', function (e) {
      tx = (e.clientX / window.innerWidth - 0.5) * 2; ty = (e.clientY / window.innerHeight - 0.5) * 2; kick();
    });
  }
  function applyParallax() {
    px += (tx - px) * 0.06; py += (ty - py) * 0.06;
    var sy = Math.min(window.scrollY, window.innerHeight * 1.2);
    for (var i = 0; i < layers.length; i++) {
      var L = layers[i], k = L.d * 1000;
      L.el.style.transform = 'translate3d(' + (-px * k * 0.6).toFixed(1) + 'px,' + (sy * L.d * 4 - py * k * 0.4).toFixed(1) + 'px,0)';
    }
    return Math.abs(tx - px) > 0.002 || Math.abs(ty - py) > 0.002;
  }

  var raf = 0, last = 0;
  function frame(t) {
    raf = 0;
    if (!visible || document.hidden) return;
    var dt = Math.min(3, (t - (last || t)) / 16.67); last = t;
    if (ctx) drawSnow(dt);
    if (!reduce) applyParallax();
    raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && !reduce) { last = 0; raf = requestAnimationFrame(frame); } }

  seed();
  window.addEventListener('resize', seed);
  if (reduce) { if (ctx) drawSnow(0); }
  else {
    window.addEventListener('scroll', kick, { passive: true });
    document.addEventListener('visibilitychange', kick);
    kick();
  }
})();
