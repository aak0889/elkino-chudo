/* «Ёлкино чудо»: глубина на всех разделах и страницах (11.11.2026, просьба Насти «как на первой: снежок и по заднику домики или ёлочки»).
   Каждому разделу главной (кроме первого экрана) — задник из трёх планов: дальние холмы с ёлочками (бледные),
   средний план с домиками и тёплыми окнами, ближние ёлки по краям. Цвет берётся от фона раздела.
   Внутренние страницы — тот же задник, закреплённый внизу окна. Параллакс только от прокрутки, без лишних кадров;
   при «уменьшить движение» — статично. Лёгкий SVG, без картинок. */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NS = 'http://www.w3.org/2000/svg';

  function rng(seed) { var s = seed % 2147483647; if (s <= 0) s += 2147483646; return function () { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; }; }
  // ёлка ярусами
  function pine(x, base, h, w) {
    var tiers = 4 + Math.floor(h / 45), d = 'M' + x.toFixed(1) + ' ' + (base - h).toFixed(1), L = [], R = [];
    for (var t = 1; t <= tiers; t++) {
      var y = base - h + h * t / tiers, ww = w * (0.22 + 0.78 * t / tiers), yi = y - h / tiers * 0.38;
      R.push((x + ww).toFixed(1) + ' ' + y.toFixed(1), (x + ww * 0.4).toFixed(1) + ' ' + yi.toFixed(1));
      L.unshift((x - ww * 0.4).toFixed(1) + ' ' + yi.toFixed(1), (x - ww).toFixed(1) + ' ' + y.toFixed(1));
    }
    R.pop(); L.shift();
    return d + 'L' + R.join('L') + 'L' + (x + w * 0.07).toFixed(1) + ' ' + base + 'L' + (x - w * 0.07).toFixed(1) + ' ' + base + 'L' + L.join('L') + 'Z';
  }
  // домик: сруб и крыша, окна отдельно
  function house(x, base, w, h) {
    var roof = h * 0.62, top = base - h;
    return 'M' + (x - w * 0.62) + ' ' + (top + roof * 0.02) + 'L' + x + ' ' + (top - roof) + 'L' + (x + w * 0.62) + ' ' + (top + roof * 0.02) + 'L' + (x + w * 0.5) + ' ' + top +
      'V' + base + 'H' + (x - w * 0.5) + 'V' + top + 'Z' + 'M' + (x + w * 0.22) + ' ' + (top - roof * 0.55) + 'h' + (w * 0.13) + 'v' + (-roof * 0.42) + 'h' + (-w * 0.13) + 'Z';
  }
  function hill(r, y0, amp, W) {
    var d = 'M0 ' + y0, k = 6 + Math.floor(r() * 3);
    for (var i = 1; i <= k; i++) { var x = W * i / k; d += ' Q' + (x - W / k / 2).toFixed(0) + ' ' + (y0 - amp * (0.4 + r())).toFixed(0) + ' ' + x.toFixed(0) + ' ' + (y0 - amp * r() * 0.5).toFixed(0); }
    return d + ' V300 H0Z';
  }

  // тон по фону раздела: светлый фон → голубовато-серые силуэты, тёмный → глубокий синий, красный → бордо
  function tones(el) {
    var c = getComputedStyle(el).backgroundColor.match(/\d+(\.\d+)?/g) || [8, 20, 41, 1];
    var bgi = getComputedStyle(el).backgroundImage || '';
    var m = bgi.match(/rgb\((\d+), (\d+), (\d+)\)/g);
    if ((+c[3] === 0 || c.length < 3) && m) c = m[m.length - 1].match(/\d+/g);
    var r = +c[0], g = +c[1], b = +c[2], lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (r > 120 && r > g * 1.6) return { far: 'rgba(255,200,190,.12)', mid: 'rgba(70,4,14,.45)', near: 'rgba(50,2,10,.62)', win: '#ffd48a', snow: 'rgba(255,240,230,.28)' };
    if (lum > 160) return { far: 'rgba(120,150,195,.26)', mid: 'rgba(78,108,160,.38)', near: 'rgba(44,70,120,.5)', win: '#f5b54f', snow: 'rgba(255,255,255,.9)' };
    return { far: 'rgba(110,140,205,.24)', mid: '#0a1631', near: '#040b1a', win: '#ffcf7a', snow: 'rgba(225,236,255,.55)' };
  }

  function build(host, seed, T, opts) {
    var mobile = window.innerWidth < 700, r = rng(seed), W = mobile ? 560 : 1440, H = 300;
    var wrap = document.createElement('div'); wrap.className = 'dp' + (opts && opts.fixed ? ' dp-fixed' : ''); wrap.setAttribute('aria-hidden', 'true');
    var planes = [];
    [['far', 0.5], ['mid', 0.75], ['near', 1]].forEach(function (p, idx) {
      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('preserveAspectRatio', 'xMidYMax slice');
      svg.setAttribute('class', 'dp-l dp-' + p[0]);
      var d = '', wins = '', roofs = '', fill = T[p[0]], hp = '';
      if (idx === 0) {                                   // дальние холмы и мелкий ельник
        hp = hill(r, 238, 34, W); d += hp;
        for (var i = 0; i < (mobile ? 26 : 46); i++) { var x = r() * W, h = 26 + r() * 36; d += pine(x, 236 + r() * 10, h, h * 0.3); }
      } else if (idx === 1) {                            // средний план: домики и ёлки
        hp = hill(r, 268, 18, W); d += hp;
        var hx = (mobile ? [0.22, 0.74] : [0.16, 0.64, 0.84]).map(function (k) { return W * (k + (r() - 0.5) * 0.06); });
        hx.forEach(function (x, j) {
          var w = (64 + r() * 26) * (mobile ? 1.25 : 1), h = (46 + r() * 14) * (mobile ? 1.25 : 1), base = 266;
          d += house(x, base, w, h); var tp = base - h, rf = h * 0.62; roofs += 'M' + (x - w * 0.64).toFixed(1) + ' ' + (tp + 1).toFixed(1) + 'L' + x.toFixed(1) + ' ' + (tp - rf).toFixed(1) + 'L' + (x + w * 0.64).toFixed(1) + ' ' + (tp + 1).toFixed(1);
          for (var q = 0; q < 2; q++) { var wx = x - w * 0.3 + q * w * 0.38; wins += '<rect x="' + wx.toFixed(1) + '" y="' + (base - h * 0.62).toFixed(1) + '" width="' + (w * 0.16).toFixed(1) + '" height="' + (h * 0.28).toFixed(1) + '" rx="1.5"/>'; }
          d += pine(x - w * 0.95, base + 2, 70 + r() * 30, 22); d += pine(x + w * 0.98, base + 2, 60 + r() * 30, 20);
        });
        for (i = 0; i < (mobile ? 8 : 16); i++) { x = r() * W; h = 50 + r() * 50; d += pine(x, 270, h, h * 0.3); }
      } else {                                           // ближние ёлки по краям
        d += 'M0 300 V288 Q' + W / 4 + ' 276 ' + W / 2 + ' 290 T' + W + ' 284 V300Z';
        (mobile ? [[16, 170], [74, 120], [490, 130], [548, 180]] : [[30, 190], [120, 140], [210, 110], [1240, 120], [1330, 160], [1420, 200]]).forEach(function (t) { d += pine(t[0] + (r() - 0.5) * 20, 296, t[1], t[1] * 0.3); });
      }
      svg.innerHTML = '<path d="' + d + '" fill="' + fill + '"/>' +
        (roofs ? '<path d="' + roofs + '" fill="none" stroke="' + T.snow + '" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>' : '') + (wins ? '<g fill="' + T.win + '" class="dp-win">' + wins + '</g>' : '') +
        (hp ? '<path d="' + hp.replace(/ V300 H0Z$/, '') + '" fill="none" stroke="' + T.snow + '" stroke-width="' + (idx ? 3 : 2) + '" stroke-linecap="round"/>' : '');
      wrap.appendChild(svg); planes.push({ el: svg, k: [0.03, 0.06, 0.1][idx] });
    });
    host.appendChild(wrap);
    return { host: host, planes: planes, fixed: opts && opts.fixed };
  }

  var items = [];
  var home = document.querySelector('.hn');
  if (home) {
    var secs = document.querySelectorAll('main > section:not(.hn)');
    for (var i = 0; i < secs.length; i++) {
      var s = secs[i]; s.classList.add('dp-host');
      items.push(build(s, 97 + i * 131, tones(s)));
    }
  } else if (document.body.classList.contains('pn') || document.querySelector('.pg-main')) {
    // полоса с задником перед красной лентой/подвалом: видна и на телефоне, где панель занимает всю ширину
    var strip = document.createElement('div'); strip.className = 'dp-strip dp-host';
    var before = document.querySelector('.pn-band') || document.querySelector('.pg-foot');
    if (before) { before.parentNode.insertBefore(strip, before); items.push(build(strip, 4242, { far: 'rgba(130,160,220,.3)', mid: '#0d1b3a', near: '#050d1f', win: '#ffcf7a', snow: 'rgba(230,240,255,.7)' })); }
  }
  if (!items.length || reduce) return;

  // параллакс от прокрутки: смещаем планы только у видимых разделов
  var vis = new Set(), ticking = false;
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { e.isIntersecting ? vis.add(e.target) : vis.delete(e.target); }); update(); }, { rootMargin: '100px' });
    items.forEach(function (it) { if (!it.fixed) io.observe(it.host); });
  }
  function update() {
    ticking = false;
    var vh = window.innerHeight;
    items.forEach(function (it) {
      var off;
      if (it.fixed) off = -Math.min(window.scrollY, 2000) * 0.25;
      else { if (!vis.has(it.host)) return; var rc = it.host.getBoundingClientRect(); off = Math.max(-240, Math.min(420, rc.bottom - vh)); }
      it.planes.forEach(function (p) { p.el.style.transform = 'translate3d(0,' + (off * p.k).toFixed(1) + 'px,0)'; });
    });
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener('resize', update);
  update();
})();
