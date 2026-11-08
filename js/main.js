(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  window.ElkStore = store;

  /* ---------- отсчёт ---------- */
  var elD = document.getElementById('c-days'), elU = document.getElementById('c-days-unit');
  var elH = document.getElementById('c-h'), elM = document.getElementById('c-m'), elS = document.getElementById('c-s');
  var elL = document.getElementById('count-label');
  function tick() {
    var now = new Date();
    if (now.getMonth() === 0 && now.getDate() === 1) {
      elL.textContent = 'Новый год наступил';
      elD.textContent = '1'; elU.textContent = 'января';
      elH.textContent = elM.textContent = elS.textContent = '00';
      return;
    }
    var target = new Date(now.getFullYear() + 1, 0, 1, 0, 0, 0);
    var diff = Math.max(0, Math.floor((target - now) / 1000));
    var d = Math.floor(diff / 86400), h = Math.floor((diff % 86400) / 3600), m = Math.floor((diff % 3600) / 60), s = diff % 60;
    elL.textContent = plural(d, 'до Нового года остался', 'до Нового года осталось', 'до Нового года осталось');
    elD.textContent = d; elU.textContent = plural(d, 'день', 'дня', 'дней');
    elH.textContent = pad(h); elM.textContent = pad(m); elS.textContent = pad(s);
  }
  if (elD) { tick(); setInterval(tick, 1000); }

  /* ---------- ближайший пост ---------- */
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var leaves = document.querySelectorAll('.leaf[data-date]'), next = null;
  for (var i = 0; i < leaves.length; i++) {
    var p = leaves[i].getAttribute('data-date').split('-');
    var dt = new Date(+p[0], +p[1] - 1, +p[2]);
    if (dt < today) leaves[i].classList.add('is-past');
    else if (!next) next = leaves[i];
  }
  if (next) {
    next.classList.add('is-next');
    var strip = document.getElementById('strip');
    if (strip && strip.scrollWidth > strip.clientWidth && next.offsetLeft > 40) strip.scrollLeft = next.offsetLeft - 16;
  }

  /* ---------- шапка ---------- */
  var top = document.querySelector('.top');
  function onScroll() { top.classList.toggle('is-solid', window.scrollY > 40); }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ---------- музыка: только по кнопке ---------- */
  var mBtn = document.getElementById('music'), audio = document.getElementById('music-audio');
  function setMusic(on, save) {
    mBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    mBtn.setAttribute('aria-label', on ? 'Музыка: выключить' : 'Музыка: включить');
    if (on) { audio.volume = 0.35; var pr = audio.play(); if (pr && pr.catch) pr.catch(function () { mBtn.setAttribute('aria-pressed', 'false'); }); }
    else audio.pause();
    if (save) store('elk-music', on ? '1' : '0');
  }
  if (mBtn && audio) {
    mBtn.addEventListener('click', function () { setMusic(mBtn.getAttribute('aria-pressed') !== 'true', true); });
    // если человек раньше включал музыку — включаем после первого касания страницы (браузеры не дают играть сами)
    if (store('elk-music') === '1') {
      var resume = function () { setMusic(true, false); window.removeEventListener('pointerdown', resume); window.removeEventListener('keydown', resume); };
      window.addEventListener('pointerdown', resume); window.addEventListener('keydown', resume);
    }
  }

  /* ---------- утилита: анимация только когда видно ---------- */
  function whenVisible(el, start, stop) {
    if (!('IntersectionObserver' in window)) { start(); return; }
    new IntersectionObserver(function (es) { es.forEach(function (e) { e.isIntersecting ? start() : stop(); }); }, { rootMargin: '80px' }).observe(el);
  }
  function loop(fn) {
    var raf = 0, on = false, last = 0;
    function f(t) { if (!on) return; var dt = Math.min(50, t - (last || t)); last = t; fn(dt / 16.67, t); raf = requestAnimationFrame(f); }
    return { start: function () { if (on) return; on = true; last = 0; raf = requestAnimationFrame(f); }, stop: function () { on = false; cancelAnimationFrame(raf); } };
  }
  function fit(cv) {
    var r = cv.getBoundingClientRect();
    cv.width = Math.max(1, Math.round(r.width * DPR)); cv.height = Math.max(1, Math.round(r.height * DPR));
    return { w: cv.width, h: cv.height };
  }

  /* ---------- звёздное небо ---------- */
  var sky = document.getElementById('sky');
  if (sky) {
    var sctx = sky.getContext('2d'), stars = [], ss;
    function seedStars() {
      ss = fit(sky); stars = [];
      var n = Math.round(ss.w * ss.h / (9000 * DPR * DPR));
      for (var k = 0; k < n; k++) stars.push({ x: Math.random() * ss.w, y: Math.random() * ss.h * 0.75, r: (Math.random() * 1.1 + 0.3) * DPR, ph: Math.random() * 6.28, sp: 0.01 + Math.random() * 0.03, big: Math.random() < 0.06 });
    }
    function drawStars(dt) {
      sctx.clearRect(0, 0, ss.w, ss.h);
      for (var k = 0; k < stars.length; k++) {
        var s = stars[k]; s.ph += s.sp * dt;
        var a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s.ph));
        sctx.globalAlpha = a; sctx.fillStyle = '#fff4dc';
        sctx.beginPath(); sctx.arc(s.x, s.y, s.r, 0, 6.283); sctx.fill();
        if (s.big) {
          var L = s.r * 6 * a; sctx.globalAlpha = a * 0.7; sctx.strokeStyle = '#ffe7b0'; sctx.lineWidth = DPR * 0.8;
          sctx.beginPath(); sctx.moveTo(s.x - L, s.y); sctx.lineTo(s.x + L, s.y); sctx.moveTo(s.x, s.y - L); sctx.lineTo(s.x, s.y + L); sctx.stroke();
        }
      }
      sctx.globalAlpha = 1;
    }
    seedStars();
    if (reduce) drawStars(0);
    else { var sl = loop(drawStars); whenVisible(sky, sl.start, sl.stop); }
    window.addEventListener('resize', function () { seedStars(); if (reduce) drawStars(0); });
  }

  /* ---------- ельник по краю ночной сцены ---------- */
  var pines = document.getElementById('pines');
  if (pines) {
    var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    function pine(x, base, h, w) {
      // ёлка из ярусов с неровными лапами
      var tiers = 5 + Math.floor(h / 40), d = 'M' + x + ' ' + (base - h);
      var left = [], right = [];
      for (var t = 1; t <= tiers; t++) {
        var y = base - h + h * t / tiers, ww = w * (0.25 + 0.75 * t / tiers) * (0.9 + rnd() * 0.2);
        var yi = y - h / tiers * 0.35;
        right.push((x + ww) + ' ' + y, (x + ww * 0.42) + ' ' + yi);
        left.unshift((x - ww * 0.42) + ' ' + yi, (x - ww) + ' ' + y);
      }
      right.pop(); left.shift();
      return d + ' L' + right.join(' L') + ' L' + (x + w * 0.08) + ' ' + base + ' L' + (x - w * 0.08) + ' ' + base + ' L' + left.join(' L') + ' Z';
    }
    var svg = '';
    var layers = [
      { fill: '#14304a', n: 26, hMin: 70, hMax: 130, base: 190 },
      { fill: '#0d2236', n: 20, hMin: 100, hMax: 180, base: 205 },
      { fill: '#081627', n: 14, hMin: 120, hMax: 200, base: 222 }
    ];
    layers.forEach(function (L, li) {
      var d = '';
      for (var k = 0; k < L.n; k++) {
        var x = (k + rnd() * 0.8) * 1440 / L.n + (li * 23);
        var h = L.hMin + rnd() * (L.hMax - L.hMin);
        // оставляем середину чуть ниже, чтобы не закрывать шар
        if (x > 700 && x < 1150) h *= 0.55;
        d += pine(Math.round(x), L.base, Math.round(h), Math.round(h * 0.28));
      }
      svg += '<path fill="' + L.fill + '" d="' + d + '"/>';
    });
    // сугроб, переходящий в светлую часть
    svg += '<path fill="#f6eddc" d="M0 196 C 180 176 320 206 520 192 S 900 172 1100 190 S 1340 200 1440 186 V 222 H0 Z"/>';
    svg += '<path fill="#ffffff" opacity=".55" d="M0 200 C 200 186 360 210 560 198 S 920 182 1120 196 S 1350 204 1440 192 V 200 C 1300 210 1100 204 900 196 S 400 214 0 206 Z"/>';
    pines.innerHTML = svg;
  }

  /* ---------- снег внутри шара ---------- */
  // Частицы в нормированных координатах (0..1). Встряхивание: снег взмывает со дна,
  // кружится и медленно оседает; на время метели добавляются «лишние» снежинки.
  function GlobeSnow(cv, opts) {
    opts = opts || {};
    var ctx = cv.getContext('2d'), S, flakes = [], amt = 0, sc = opts.scale || 1;
    function seed() {
      S = fit(cv); flakes = [];
      for (var k = 0; k < (opts.count || 90); k++) flakes.push(newFlake(Math.random(), false));
    }
    function newFlake(y, extra) {
      var z = Math.random();                       // глубина: дальние мельче и прозрачнее
      return { x: Math.random(), y: y, vx: 0, vy: 0, z: z, r: (0.6 + z * 1.7) * DPR * sc, ph: Math.random() * 6.283, w: 0.5 + Math.random(), fall: 0.0007 + z * 0.0009 + Math.random() * 0.0004, extra: extra };
    }
    function draw(dt) {
      ctx.clearRect(0, 0, S.w, S.h);
      amt *= Math.pow(0.986, dt);
      var term = 1 - 0.72 * amt, keep = [];
      for (var k = 0; k < flakes.length; k++) {
        var f = flakes[k];
        f.ph += 0.02 * f.w * (1 + 3 * amt) * dt;
        f.vy += (f.fall * term - f.vy) * 0.03 * dt;
        f.vx += (Math.sin(f.ph) * (0.0005 + 0.0025 * amt) - f.vx) * 0.03 * dt;
        f.x += f.vx * dt; f.y += f.vy * dt;
        if (f.x < 0) { f.x = 0; f.vx = Math.abs(f.vx) * 0.5; } else if (f.x > 1) { f.x = 1; f.vx = -Math.abs(f.vx) * 0.5; }
        if (f.y < 0.02) { f.y = 0.02; f.vy = Math.abs(f.vy) * 0.6; }
        if (f.y > 1.02) { if (f.extra) continue; f.y = -0.03; f.x = Math.random(); f.vy = f.fall; }
        keep.push(f);
        ctx.globalAlpha = 0.4 + 0.55 * f.z;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(f.x * S.w, f.y * S.h, f.r, 0, 6.283); ctx.fill();
      }
      flakes = keep;
      ctx.globalAlpha = 1;
    }
    function kick(p, dir) {
      p = Math.max(0.3, Math.min(1.4, p || 1)); dir = dir || 0;
      amt = Math.min(1, amt + 0.8 * p);
      var add = Math.round((opts.burst || 80) * p);
      for (var k = 0; k < add; k++) flakes.push(newFlake(0.82 + Math.random() * 0.2, true));
      for (k = 0; k < flakes.length; k++) {
        var f = flakes[k], low = 0.4 + f.y;      // нижние подлетают выше
        f.vy -= (0.005 + Math.random() * 0.014) * p * low;
        f.vx += ((Math.random() - 0.5) * 0.018 + dir * 0.008) * p;
      }
      if (reduce) { for (k = 0; k < flakes.length; k++) { flakes[k].y = Math.random(); flakes[k].x = Math.random(); } draw(0); }
    }
    seed();
    var l = loop(draw);
    window.addEventListener('resize', function () { var old = flakes; seed(); if (old.length) flakes = old; });
    if (reduce) draw(0); else whenVisible(cv, l.start, l.stop);
    return { shake: kick };
  }

  // жест встряхивания: быстрое перетаскивание/свайп по шару и встряхивание телефона
  function shakeGesture(el, kick, wobble) {
    var last = null, acc = 0, lastKick = 0;
    function fire(p, dir) {
      var now = Date.now(); if (now - lastKick < 260) return; lastKick = now; kick(p, dir);
      if (wobble && !reduce) { wobble.classList.remove('is-shaken'); void wobble.offsetWidth; wobble.classList.add('is-shaken'); }
    }
    el.addEventListener('pointerdown', function (e) { if (e.target.closest('button')) return; last = { x: e.clientX, y: e.clientY, t: e.timeStamp }; acc = 0; });
    el.addEventListener('pointermove', function (e) {
      if (!last) return;
      var dx = e.clientX - last.x, dy = e.clientY - last.y, d = Math.hypot(dx, dy), dt = Math.max(8, e.timeStamp - last.t);
      acc += d; last = { x: e.clientX, y: e.clientY, t: e.timeStamp };
      if (acc > 46 && d / dt > 0.5) { fire(Math.min(1.3, d / dt / 1.6 + 0.4), dx > 0 ? 1 : -1); acc = 0; }
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) { el.addEventListener(n, function () { last = null; }); });
    return fire;
  }
  var motionAsked = false, motionFns = [];
  function askMotion() {
    if (motionAsked || typeof DeviceMotionEvent === 'undefined' || !DeviceMotionEvent.requestPermission) return;
    motionAsked = true; DeviceMotionEvent.requestPermission().catch(function () { });
  }
  window.addEventListener('devicemotion', function (e) {
    if (!motionFns.length || document.getElementById('rk') || document.getElementById('rl')) return;
    var a = e.acceleration, m;
    if (a && a.x != null) m = Math.hypot(a.x, a.y, a.z); else { var g = e.accelerationIncludingGravity; if (!g || g.x == null) return; m = Math.abs(Math.hypot(g.x, g.y, g.z) - 9.81); }
    if (m > 13) motionFns.forEach(function (fn) { fn(Math.min(1.4, m / 18), 0); });
  });

  /* ---------- большой шар на первом экране ----------
     Купол — «колпак»: полуэллипс сверху и прямые стенки, дно — снежный холм. Координаты в долях картинки 720×1148.
     Снежинки живут в жидкости: тянутся за её течением (вихри + «плескание» после встряски), падают с малой
     предельной скоростью, покачиваются, отскакивают от стекла и ложатся на дно горкой. */
  var DOME = { cx: 0.4875, rx: 0.344, cy: 0.283, ry: 0.168, floor: 0.676 };
  function HeroGlobe(fig, cv) {
    var ctx = cv.getContext('2d'), W = 0, H = 0, R = Math.min(DPR, 1.75);
    var weak = window.innerWidth < 700 || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3;
    var N = weak ? 150 : 260, NMOTE = weak ? 14 : 24, NDUST = weak ? 26 : 46;
    var flakes = [], motes = [], dust = [], vort = [], slosh = { x: 0, y: 0, vx: 0, vy: 0 }, energy = 0, heap = [], BINS = 36, time = 0, warm = 0;
    var G = {};                                   // геометрия купола в css-пикселях
    var dbg = /[?&]globedebug=1/.test(location.search);
    function geo() {
      var box = cv.parentNode; W = box.offsetWidth; H = box.offsetHeight;   // размеры без учёта покачивания (transform)
      cv.width = Math.max(1, Math.round(W * R)); cv.height = Math.max(1, Math.round(H * R));
      G = { cx: DOME.cx * W, rx: DOME.rx * W, cy: DOME.cy * H, ry: DOME.ry * H, fl: DOME.floor * H };
    }
    function floorY(x) {                          // снежный холм: чуть выше за ёлкой и домом
      var u = x / W; return G.fl - H * 0.03 * Math.exp(-Math.pow((u - 0.30) / 0.15, 2));
    }
    function bin(x) { return Math.max(0, Math.min(BINS - 1, Math.floor((x - (G.cx - G.rx)) / (2 * G.rx) * BINS))); }
    // спрайты: мягкая снежинка и золотая звёздочка
    function sprite(sz, fn) { var c = document.createElement('canvas'); c.width = c.height = sz; fn(c.getContext('2d'), sz / 2); return c; }
    var SNOW = sprite(32, function (g, h) { var gr = g.createRadialGradient(h, h, 0, h, h, h); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.45, 'rgba(255,255,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 2 * h, 2 * h); });
    var GOLD = sprite(48, function (g, h) {
      var gr = g.createRadialGradient(h, h, 0, h, h, h); gr.addColorStop(0, 'rgba(255,236,180,.9)'); gr.addColorStop(.25, 'rgba(255,200,110,.35)'); gr.addColorStop(1, 'rgba(255,170,60,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 2 * h, 2 * h);
      g.fillStyle = 'rgba(255,248,225,.95)'; g.beginPath(); var s = h * .95;
      g.moveTo(h, h - s); g.quadraticCurveTo(h, h, h + s, h); g.quadraticCurveTo(h, h, h, h + s); g.quadraticCurveTo(h, h, h - s, h); g.quadraticCurveTo(h, h, h, h - s); g.fill();
    });
    var GLOW = sprite(64, function (g, h) { var gr = g.createRadialGradient(h, h, 0, h, h, h); gr.addColorStop(0, 'rgba(255,214,140,.85)'); gr.addColorStop(.35, 'rgba(255,170,80,.35)'); gr.addColorStop(1, 'rgba(255,140,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, 2 * h, 2 * h); });
    // тёплые огни сцены (окна дома, вагон, звезда на ёлке) — в пикселях исходной картинки 720×1148
    var LIGHTS = [[272, 444, 1], [258, 508, 1.1], [300, 508, 1.1], [386, 372, .8], [374, 432, .9], [346, 506, .9], [300, 646, .8], [334, 670, .9], [372, 673, .9], [410, 676, .9], [466, 672, .8], [492, 672, .8], [517, 670, .8], [150, 560, .6], [134, 640, .6], [255, 600, .7]]
      .map(function (a) { return { x: a[0] / 720, y: a[1] / 1148, s: a[2], ph: Math.random() * 6.3, sp: .6 + Math.random() * 1.2 }; });
    var STAR = { x: 443 / 720, y: 268 / 1148 };

    function inside(x, y) {
      if (y < G.cy) { var qx = (x - G.cx) / G.rx, qy = (y - G.cy) / G.ry; return qx * qx + qy * qy < 1; }
      return Math.abs(x - G.cx) < G.rx && y < floorY(x);
    }
    function randIn() { for (var k = 0; k < 40; k++) { var x = G.cx + (Math.random() * 2 - 1) * G.rx, y = G.cy - G.ry + Math.random() * (G.fl - G.cy + G.ry); if (inside(x, y)) return [x, y]; } return [G.cx, G.cy + G.ry]; }
    function newFlake() {
      var z = Math.random(), p = randIn();
      return { x: p[0], y: p[1], vx: 0, vy: 0, z: z, r: (1.2 + z * 2.3 + (Math.random() < .08 ? 1.8 : 0)) * (W / 470),
        vt: (9 + z * 9 + Math.random() * 6) * (H / 750), ph: Math.random() * 6.3, wf: .8 + Math.random() * 1.4, rest: false };
    }
    function settleAll() {                         // стартовое состояние: снег лежит на дне, часть ещё падает
      heap = []; for (var b = 0; b < BINS; b++) heap.push(0);
      flakes.forEach(function (f, i) {
        if (i % 4 === 0) return;
        f.x = G.cx + (Math.random() * 2 - 1) * G.rx * .96; rest(f);
      });
    }
    function rest(f) { var b = bin(f.x); f.rest = true; f.vx = f.vy = 0; f.y = floorY(f.x) - heap[b] - f.r * .4; heap[b] = Math.min(H * .012, heap[b] + f.r * .22); }
    function seed() {
      geo(); flakes = []; motes = []; dust = [];
      for (var k = 0; k < N; k++) flakes.push(newFlake());
      for (k = 0; k < NMOTE; k++) { var p = randIn(); motes.push({ x: p[0], y: p[1], vx: 0, vy: 0, ph: Math.random() * 6.3, s: (2 + Math.random() * 3) * (W / 470) }); }
      settleAll();
    }
    // течение жидкости в точке: вихри + общее плескание + лёгкая турбулентность
    function flow(x, y, out) {
      var ux = slosh.vx, uy = slosh.vy;
      for (var k = 0; k < vort.length; k++) {
        var v = vort[k], dx = x - v.x, dy = y - v.y, r2 = dx * dx + dy * dy, f = v.g * Math.exp(-r2 / (2 * v.rc * v.rc)) / v.rc;
        ux += -dy * f; uy += dx * f;
      }
      var e = energy * W * 0.05;
      ux += e * Math.sin(y * 0.031 + time * 1.7) * Math.cos(x * 0.017 - time * 1.1);
      uy += e * Math.cos(x * 0.029 - time * 1.3) * Math.sin(y * 0.021 + time * .9);
      out[0] = ux; out[1] = uy;
    }
    function collide(p, rad, bounce) {             // удар о стекло: возвращаем внутрь, гасим нормальную скорость
      var nx = 0, ny = 0, hit = false;
      if (p.y < G.cy) {
        var qx = (p.x - G.cx) / (G.rx - rad), qy = (p.y - G.cy) / (G.ry - rad), L = Math.hypot(qx, qy);
        if (L > 1) { p.x = G.cx + qx / L * (G.rx - rad); p.y = G.cy + qy / L * (G.ry - rad); nx = qx / (G.rx - rad); ny = qy / (G.ry - rad); hit = true; }
      } else if (Math.abs(p.x - G.cx) > G.rx - rad) { var s = p.x > G.cx ? 1 : -1; p.x = G.cx + s * (G.rx - rad); nx = s; ny = 0; hit = true; }
      if (hit) {
        var nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        var vn = p.vx * nx + p.vy * ny;
        if (vn > 0) { p.vx -= (1 + bounce) * vn * nx; p.vy -= (1 + bounce) * vn * ny; p.vx *= .8; p.vy *= .8; }
      }
    }
    var U = [0, 0];
    function step(dt) {                            // dt в секундах
      time += dt;
      energy *= Math.exp(-dt / 2.2); warm *= Math.exp(-dt / 1.6);
      // плескание: жидкость качается на «пружине» и успокаивается
      slosh.vx += (-slosh.x * 9 - slosh.vx * 2.4) * dt; slosh.vy += (-slosh.y * 9 - slosh.vy * 2.4) * dt;
      slosh.x += slosh.vx * dt; slosh.y += slosh.vy * dt;
      for (var k = vort.length - 1; k >= 0; k--) { var v = vort[k]; v.g *= Math.exp(-dt / v.tau); v.x += slosh.vx * dt * .5; v.y += slosh.vy * dt * .5; if (Math.abs(v.g) < 0.5) vort.splice(k, 1); }
      var calm = energy < 0.05 && !vort.length;
      for (k = 0; k < flakes.length; k++) {
        var f = flakes[k];
        if (f.rest) continue;
        flow(f.x, f.y, U);
        f.ph += dt * f.wf * (1.6 + 3 * energy);
        var sway = Math.sin(f.ph) * (5 + f.r * 2) * (W / 470);           // покачивание при оседании
        var drag = (2.2 + (1 - f.z) * 1.2) * (1 - .55 * Math.min(1, energy));  // мелкие сильнее слушаются течения; сразу после встряски летят по инерции
        f.vx += ((U[0] + sway) - f.vx) * Math.min(1, drag * dt);
        f.vy += ((U[1] + f.vt) - f.vy) * Math.min(1, drag * dt);
        f.x += f.vx * dt; f.y += f.vy * dt;
        collide(f, f.r, .25);
        var fy = floorY(f.x) - heap[bin(f.x)];
        if (f.y > fy - f.r * .4) {
          if (f.vy > 0 && (calm || f.vy < 60 * (H / 750))) rest(f);
          else { f.y = fy - f.r * .4; f.vy = -Math.abs(f.vy) * .3; }
        }
      }
      for (k = 0; k < motes.length; k++) {           // блёстки почти невесомы: висят и кружат всегда
        var m = motes[k]; flow(m.x, m.y, U); m.ph += dt * .7;
        m.vx += ((U[0] + Math.sin(m.ph) * 6) - m.vx) * Math.min(1, 1.5 * dt);
        m.vy += ((U[1] + Math.cos(m.ph * .8) * 4 + 1.5) - m.vy) * Math.min(1, 1.5 * dt);
        m.x += m.vx * dt; m.y += m.vy * dt; collide(m, m.s, .5);
        if (m.y > floorY(m.x) - 6) { m.y = floorY(m.x) - 6; m.vy = -Math.abs(m.vy) - 3; }
      }
      for (k = dust.length - 1; k >= 0; k--) {
        var d = dust[k]; d.t += dt; if (d.t > d.life) { dust.splice(k, 1); continue; }
        flow(d.x, d.y, U); d.vx += (U[0] - d.vx) * Math.min(1, 1.8 * dt); d.vy += (U[1] - 4 - d.vy) * Math.min(1, 1.8 * dt);
        d.x += d.vx * dt; d.y += d.vy * dt; collide(d, 2, .6);
      }
    }
    function draw() {
      ctx.setTransform(R, 0, 0, R, 0, 0); ctx.clearRect(0, 0, W, H);
      // живая сцена: окна и вагон мерцают тёплым, после встряски вспыхивают ярче
      ctx.globalCompositeOperation = 'lighter';
      var gl = W * 0.075;
      for (var k = 0; k < LIGHTS.length; k++) {
        var L = LIGHTS[k], a = (.16 + .1 * Math.sin(time * L.sp + L.ph) + .05 * Math.sin(time * 7.3 + L.ph * 3)) * (1 + 1.6 * warm) * L.s;
        ctx.globalAlpha = Math.max(0, Math.min(1, a)); var s = gl * L.s * (1 + .3 * warm);
        ctx.drawImage(GLOW, L.x * W - s / 2, L.y * H - s / 2, s, s);
      }
      var sa = .55 + .25 * Math.sin(time * 2.1) + .2 * warm, ss = W * (.07 + .015 * Math.sin(time * 1.3) + .04 * warm);
      ctx.save(); ctx.translate(STAR.x * W, STAR.y * H); ctx.rotate(time * .15);
      ctx.globalAlpha = Math.min(1, sa); ctx.drawImage(GOLD, -ss / 2, -ss / 2, ss, ss); ctx.restore();
      // блёстки
      for (k = 0; k < motes.length; k++) {
        var m = motes[k], tw = .35 + .65 * Math.pow(.5 + .5 * Math.sin(time * 3 + m.ph * 5), 3);
        ctx.globalAlpha = tw * .8; var ms = m.s * (1.5 + tw); ctx.drawImage(GOLD, m.x - ms, m.y - ms, ms * 2, ms * 2);
      }
      // звёздная пыль после встряски
      for (k = 0; k < dust.length; k++) {
        var d = dust[k], u = d.t / d.life, b = Math.sin(Math.PI * Math.min(1, u * 1.4)) * (1 - u * .3) * (.6 + .4 * Math.sin(d.t * 18 + d.ph));
        ctx.globalAlpha = Math.max(0, b); var dsz = d.s * (.7 + .5 * b); ctx.drawImage(GOLD, d.x - dsz, d.y - dsz, dsz * 2, dsz * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
      // снег
      for (k = 0; k < flakes.length; k++) {
        var f = flakes[k], r = f.r * 2.2;
        ctx.globalAlpha = f.rest ? .75 : .45 + .5 * f.z;
        ctx.drawImage(SNOW, f.x - r, f.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      if (dbg) {
        ctx.strokeStyle = '#0f0'; ctx.lineWidth = 1; ctx.beginPath();
        ctx.ellipse(G.cx, G.cy, G.rx, G.ry, 0, Math.PI, 2 * Math.PI); ctx.lineTo(G.cx + G.rx, floorY(G.cx + G.rx));
        for (var x = G.cx + G.rx; x >= G.cx - G.rx; x -= 4) ctx.lineTo(x, floorY(x));
        ctx.closePath(); ctx.stroke();
      }
    }
    var acc = 0, frames = 0, cut = false, slow = 0;
    function frame(dts) {
      var dt = Math.min(0.05, dts / 60);
      step(dt); draw();
      acc += dts * 16.67; frames++;
      if (frames === 90) {                          // слабое устройство: вдвое меньше снежинок
        slow = acc / frames > 30 ? slow + 1 : 0;   // два медленных отрезка подряд, чтобы не реагировать на рывок при загрузке
        if (!cut && slow >= 2) { cut = true; flakes = flakes.filter(function (f, i) { return i % 2 === 0; }); NDUST = Math.round(NDUST / 2); }
        acc = 0; frames = 0;
      }
    }
    function kick(p, dir) {
      p = Math.max(0.35, Math.min(1.4, p || 1)); dir = dir || (Math.random() < .5 ? -1 : 1);
      if (reduce) {                                  // без анимации: просто новый «кадр» с кружащимся снегом
        flakes.forEach(function (f) { var q = randIn(); f.x = q[0]; f.y = q[1]; f.rest = Math.random() < .35; if (f.rest) rest(f); });
        warm = .6; draw(); return;
      }
      energy = Math.min(1.4, energy + .9 * p); warm = Math.min(1, warm + .8 * p);
      // инерция: стекло дёрнули в сторону — жидкость отстаёт и плещется обратно
      slosh.vx += -dir * p * W * 0.55; slosh.vy += -p * H * 0.12;
      for (var k = 0; k < 2 + Math.round(p * 3); k++) {
        var q = randIn();
        vort.push({ x: q[0], y: q[1] * .6 + G.fl * .4, g: (Math.random() < .5 ? -1 : 1) * (60 + Math.random() * 90) * p * (W / 470), rc: W * (.09 + Math.random() * .1), tau: 1.2 + Math.random() * 1.6 });
      }
      heap = heap.map(function () { return 0; });
      flakes.forEach(function (f) {
        var low = (f.y - (G.cy - G.ry)) / (G.fl - G.cy + G.ry);   // со дна снег взлетает сильнее
        if (f.rest) { f.rest = false; f.vy = -(240 + Math.random() * 520) * p * (H / 750); f.vx = (Math.random() - .5) * 300 * p * (W / 470) - dir * 60 * p; }
        else { f.vy -= (40 + Math.random() * 140) * p * low * (H / 750); f.vx += ((Math.random() - .5) * 120 - dir * 50) * p * (W / 470); }
      });
      var nd = Math.round(NDUST * Math.min(1, p));
      for (k = 0; k < nd && dust.length < NDUST * 1.5; k++) {
        var q2 = randIn();
        dust.push({ x: q2[0], y: q2[1], vx: (Math.random() - .5) * 80, vy: -Math.random() * 60, t: 0, life: 1.4 + Math.random() * 1.6, s: (2 + Math.random() * 3.4) * (W / 470), ph: Math.random() * 6.3 });
      }
      fig.style.setProperty('--warm', '1'); clearTimeout(fig._wt); fig._wt = setTimeout(function () { fig.style.setProperty('--warm', '0'); }, 900);
    }
    seed();
    var lp = loop(frame);
    window.addEventListener('resize', function () {
      var oW = W, oH = H; geo(); if (!oW) return;
      var sx = W / oW, sy = H / oH; flakes.concat(motes).forEach(function (f) { f.x *= sx; f.y *= sy; });
      if (reduce) draw();
    });
    if (reduce) draw();
    else {
      whenVisible(cv, lp.start, lp.stop);
      document.addEventListener('visibilitychange', function () { if (document.hidden) lp.stop(); else if (cv.getBoundingClientRect().bottom > 0) lp.start(); });
      setTimeout(function () { kick(.55, 1); }, 900);   // при загрузке шар сам чуть «вздыхает», чтобы было видно, что он живой
    }
    window.__heroGlobe = { kick: kick, stats: function () { return { flakes: flakes.length, resting: flakes.filter(function (f) { return f.rest; }).length, dust: dust.length, outside: flakes.filter(function (f) { return !f.rest && !inside(f.x, f.y + 0.01); }).length }; } };
    return { shake: kick };
  }

  // стекло купола: френель по краю, блики, лёгкая радужная кромка преломления, тёплое свечение при встряске
  function glassLayer(fig) {
    var d = DOME, X = function (u) { return (u * 720).toFixed(1); }, Y = function (v) { return (v * 1148).toFixed(1); };
    var l = d.cx - d.rx, r = d.cx + d.rx, rx = d.rx * 720, ry = d.ry * 1148, fy = d.floor + .045;
    var dome = 'M' + X(l) + ' ' + Y(fy) + ' L' + X(l) + ' ' + Y(d.cy) + ' A' + rx + ' ' + ry + ' 0 0 1 ' + X(r) + ' ' + Y(d.cy) + ' L' + X(r) + ' ' + Y(fy);
    var svg = '<svg class="globe-glass" viewBox="0 0 720 1148" preserveAspectRatio="none" aria-hidden="true">' +
      '<defs>' +
      '<radialGradient id="gg-fres" cx="50%" cy="46%" r="60%"><stop offset="62%" stop-color="#cfe6ff" stop-opacity="0"/><stop offset="92%" stop-color="#d8ecff" stop-opacity=".16"/><stop offset="100%" stop-color="#fff" stop-opacity=".28"/></radialGradient>' +
      '<linearGradient id="gg-streak" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".25" stop-color="#fff" stop-opacity=".75"/><stop offset=".7" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
      '<radialGradient id="gg-spot" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff" stop-opacity=".8"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="gg-warm" cx="50%" cy="62%" r="55%"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".26"/><stop offset=".6" stop-color="#ff9c3a" stop-opacity=".08"/><stop offset="1" stop-color="#ff8a20" stop-opacity="0"/></radialGradient>' +
      '<filter id="gg-b6" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>' +
      '<filter id="gg-b2" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2"/></filter>' +
      '<clipPath id="gg-clip"><path d="' + dome + ' Z"/></clipPath>' +
      '</defs>' +
      '<g clip-path="url(#gg-clip)">' +
      '<rect class="gg-warm" x="0" y="0" width="720" height="1148" fill="url(#gg-warm)"/>' +
      '<rect x="0" y="0" width="720" height="1148" fill="url(#gg-fres)"/>' +
      '<path d="' + dome + '" fill="none" stroke="#e8f4ff" stroke-opacity=".22" stroke-width="30" filter="url(#gg-b6)"/>' +
      '</g>' +
      // радужная кромка: стекло чуть разводит свет по краю
      '<path d="' + dome + '" fill="none" stroke="#9fd8ff" stroke-opacity=".35" stroke-width="2" transform="translate(-1.5 0)"/>' +
      '<path d="' + dome + '" fill="none" stroke="#ffc9a0" stroke-opacity=".28" stroke-width="2" transform="translate(1.5 1)"/>' +
      '<path d="' + dome + '" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.2"/>' +
      // блики
      '<g class="gg-shine">' +
      '<path d="M138 640 C 122 520 124 380 166 286 C 186 242 214 210 246 188" fill="none" stroke="url(#gg-streak)" stroke-width="13" stroke-linecap="round" filter="url(#gg-b2)" opacity=".75"/>' +
      '<path d="M156 600 C 146 500 150 400 180 320" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2.4" stroke-linecap="round" filter="url(#gg-b2)"/>' +
      '<ellipse cx="262" cy="176" rx="64" ry="20" transform="rotate(-24 262 176)" fill="url(#gg-spot)" opacity=".7"/>' +
      '<ellipse cx="572" cy="560" rx="9" ry="70" fill="url(#gg-spot)" opacity=".45"/>' +
      '</g>' +
      '</svg>';
    fig.insertAdjacentHTML('beforeend', svg);
  }

  var hs = document.getElementById('hero-snow');
  if (hs) {
    var heroFig = document.getElementById('hero-globe');
    glassLayer(document.getElementById('hero-globe-body') || heroFig);   // стекло в одном контейнере с картинкой и снегом
    heroFig.appendChild(document.getElementById('hero-shake'));     // кнопка поверх стекла
    var heroSnow = HeroGlobe(heroFig, hs);
    var heroFire = shakeGesture(heroFig, heroSnow.shake, heroFig);
    // тап по шару — тоже встряска (свайп обрабатывает shakeGesture)
    (function () {
      var st = null;
      heroFig.addEventListener('pointerdown', function (e) { if (e.target.closest('button')) return; st = { x: e.clientX, y: e.clientY, t: e.timeStamp }; });
      heroFig.addEventListener('pointerup', function (e) {
        if (!st) return; var moved = Math.hypot(e.clientX - st.x, e.clientY - st.y), dur = e.timeStamp - st.t; st = null;
        if (moved < 12 && dur < 450) { askMotion(); var r = heroFig.getBoundingClientRect(); heroFire(.8, e.clientX < r.left + r.width / 2 ? 1 : -1); }
      });
    })();
    document.getElementById('hero-shake').addEventListener('click', function () { askMotion(); heroFire(1.2, 0); });
    var heroOn = true;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { heroOn = es[0].isIntersecting; }).observe(heroFig);
    motionFns.push(function (p, d) { if (heroOn) heroFire(p, d); });
  }
  var globes = document.querySelectorAll('.globe');
  window.ElkGlobes = [];
  for (var g = 0; g < globes.length; g++) {
    (function (btn) {
      var gs = GlobeSnow(btn.querySelector('canvas'), { count: 70, burst: 70, scale: 0.9 });
      btn.addEventListener('pointerenter', function () { gs.shake(0.7); });
      btn._snow = gs;
    })(globes[g]);
  }

  /* ---------- снег по всему сайту с 25 ноября ---------- */
  var snowCv = document.getElementById('snow');
  (function () {
    var now = new Date(), m = now.getMonth(), d = now.getDate();
    var season = (m === 10 && d >= 25) || m === 11 || (m === 0 && d <= 14);
    if (/[?&]snow=1/.test(location.search)) season = true;
    if (!snowCv || !season || reduce) return;
    snowCv.classList.add('on');
    var ctx = snowCv.getContext('2d'), S, fl = [];
    function seed() {
      S = fit(snowCv); fl = [];
      var n = Math.min(140, Math.round(S.w * S.h / (14000 * DPR * DPR)));
      for (var k = 0; k < n; k++) fl.push({ x: Math.random() * S.w, y: Math.random() * S.h, r: (Math.random() * 2 + 0.8) * DPR, vy: (0.4 + Math.random() * 0.9) * DPR, ph: Math.random() * 6.28, a: 0.4 + Math.random() * 0.5 });
    }
    function draw(dt) {
      ctx.clearRect(0, 0, S.w, S.h);
      ctx.fillStyle = '#fff';
      for (var k = 0; k < fl.length; k++) {
        var f = fl[k]; f.y += f.vy * dt; f.ph += 0.015 * dt; f.x += Math.sin(f.ph) * 0.4 * DPR * dt;
        if (f.y > S.h + 5) { f.y = -5; f.x = Math.random() * S.w; }
        ctx.globalAlpha = f.a; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    seed(); window.addEventListener('resize', seed);
    var l = loop(draw); l.start();
    document.addEventListener('visibilitychange', function () { document.hidden ? l.stop() : l.start(); });
  })();

  /* ---------- календарь декабря: программа 31 окошка ----------
     Источник правды для текста: «Новогодний проект\Адвент — программа 31 окошка.md».
     k — тип (цвет шара), h — название, f — бесплатное окошко, p — расширенное (премиум, пока «скоро»). */
  var KINDS = {
    tale:  { n: 'Сказка',         c: 'tale' },
    game:  { n: 'Игра',           c: 'game' },
    food:  { n: 'Рецепт',         c: 'food' },
    print: { n: 'Распечатка',     c: 'print' },
    quest: { n: 'Семейный квест', c: 'quest' },
    craft: { n: 'Мастер-класс',   c: 'craft' },
    card:  { n: 'Открытка',       c: 'card' }
  };
  var ADVENT = [
    { k: 'tale',  h: 'Как просыпается декабрь', f: 'Сказка на три минуты: как ёлочные шары в коробке спорят, кто первым увидит праздник.', p: 'Аудиосказка и раскраска к ней.' },
    { k: 'print', h: 'Карта чудес на декабрь', f: 'Распечатка на одну страницу: 31 клеточка, в которые ребёнок отмечает каждое открытое окошко.', p: 'Версия с наклейками-звёздочками и именем ребёнка.' },
    { k: 'food',  h: 'Чай с апельсиновой коркой', f: 'Рецепт на десять минут: корка, корица, ложка мёда. Первый «вкус декабря».', p: 'Три детских напитка без кофеина и карточка-рецепт для холодильника.' },
    { k: 'craft', h: 'Бумажные снежинки', f: 'Три схемы для вырезания: от простой до кружевной. Наклеиваем на окно.', p: 'Видео-урок и ещё десять схем для печати.' },
    { k: 'game',  h: 'Кино по эмодзи', f: 'Десять новогодних фильмов, загаданных эмодзи. Угадывайте всей семьёй.', p: 'Тридцать карточек для печати и правила игры командами.' },
    { k: 'quest', h: 'Где прячется гирлянда', f: 'Пять записок-подсказок по квартире. В конце ребёнок находит первую гирлянду и вешает её на окно.', p: 'Готовые записки для печати и вариант квеста для взрослой компании.' },
    { k: 'card',  h: 'Тем, кого давно не видели', f: 'Пять коротких тёплых текстов для открытки, которую не стыдно отправить через год молчания.', p: 'Открытка с именем получателя.' },
    { k: 'game',  h: 'Бинго у телевизора', f: 'Карточка с моментами из «Иронии судьбы»: увидели — зачеркнули. Включайте фильм в нашем старом телевизоре.', p: 'Бинго ещё к пяти фильмам из телевизора.' },
    { k: 'food',  h: 'Имбирное печенье, которое не ломается', f: 'Тесто, которое можно доверить детям, и как раскатать, чтобы фигурки держали форму.', p: 'Шаблоны для вырезания: ёлка, варежка, домик.' },
    { k: 'tale',  h: 'Варежка, которая потерялась', f: 'Сказка на ночь про варежку, которая искала свою пару по всему двору.', p: 'Сказка с именем вашего ребёнка (скоро).' },
    { k: 'print', h: 'Бланк письма Деду Морозу', f: 'Красивый бланк: «Меня зовут…», «В этом году я научился…», «Я мечтаю…».', p: 'Ответное письмо от Деда Мороза с именем ребёнка.' },
    { k: 'craft', h: 'Гирлянда из сушёных апельсинов', f: 'Как нарезать, высушить в духовке или на батарее и нанизать на нитку.', p: 'Видео и ещё два варианта: с корицей и с бадьяном.' },
    { k: 'quest', h: 'Прогулка за огнями', f: 'Вечерний маршрут-чек-лист: найти окно со звездой, ёлку на балконе, снеговика, синюю гирлянду и ещё шесть вещей.', p: 'Карточка-бинго для печати, по одной на каждого.' },
    { k: 'game',  h: 'Новогодний «Крокодил»', f: 'Тридцать слов для показа без слов: от «оливье» до «бой курантов».', p: 'Карточки для печати с таймером и уровнями сложности.' },
    { k: 'card',  h: 'Открытка коллегам', f: 'Десять поздравлений для рабочего чата без пошлости и канцелярита.', p: 'Открытка с именем коллеги.' },
    { k: 'food',  h: 'Безалкогольный глинтвейн', f: 'Вишнёвый сок, апельсин, гвоздика. Чтобы пахло праздником и пить могли все.', p: 'Карточка-рецепт для печати и вариант на большую компанию.' },
    { k: 'print', h: 'Раскраска «Ёлкин шар»', f: 'Снежный шар с домиком и ёлкой: раскрасить и повесить на холодильник.', p: 'Пять раскрасок разного уровня сложности.' },
    { k: 'tale',  h: 'Почему у снеговика нос-морковка', f: 'Короткая сказка-объяснение, после которой хочется слепить своего снеговика.', p: 'Аудиоверсия голосом сказочника.' },
    { k: 'quest', h: 'Николин день', f: '19 декабря, по традиции, в обувь или под подушку кладут маленький сюрприз. Идеи, что положить, и как устроить это незаметно.', p: 'Записки от святого Николая для печати.' },
    { k: 'craft', h: 'Упаковка без скотча', f: 'Как завернуть подарок в платок или крафт и завязать красиво.', p: 'Видео: четыре способа упаковки и бирки к ним.' },
    { k: 'game',  h: 'Самая длинная ночь', f: '21 декабря выключаем верхний свет: театр теней на стене и истории по кругу при свечах.', p: 'Карточки «продолжи историю» для печати.' },
    { k: 'food',  h: 'Что приготовить заранее', f: 'Список того, что можно сделать за три-четыре дня до праздника, чтобы тридцать первого не стоять у плиты.', p: 'План стола по дням и «Калькулятор стола»: сколько готовить на ваших гостей.' },
    { k: 'card',  h: 'Открытка бабушке и дедушке', f: 'Рисуем вместе с ребёнком: простая открытка-раскладушка и что в ней написать.', p: 'Шаблоны для печати с местом для рисунка.' },
    { k: 'craft', h: 'Кормушка для птиц', f: 'Из пакета от молока или бутылки за двадцать минут. И чем кормить зимой.', p: 'Видео и раскраска «Кто прилетел к кормушке».' },
    { k: 'game',  h: 'Рекорд на катке', f: 'Загляните в наш шар-каток и попробуйте побить семейный рекорд.', p: 'Дипломы «Чемпион катка» для печати.' },
    { k: 'print', h: 'Бирки для подарков', f: 'Лист бирок: вырезать, подписать, привязать. Чтобы никто не перепутал, где чей подарок.', p: 'Бирки с именами всей семьи.' },
    { k: 'tale',  h: 'Игрушка, которая боялась высоты', f: 'Сказка про стеклянную шишку, которой предстояло висеть на самой макушке ёлки.', p: 'Аудиосказка и раскраска.' },
    { k: 'quest', h: 'Пять кадров у ёлки', f: 'Фотоквест для семьи: пять заданий-кадров, от «все в шапках» до «самая смешная рожица».', p: 'Рамки и надписи для фото.' },
    { k: 'food',  h: 'Канапе вместе с детьми', f: 'Шесть закусок на шпажках, которые дети собирают сами.', p: 'Карточки-инструкции с картинками для самых маленьких.' },
    { k: 'craft', h: 'Фотозона из того, что есть дома', f: 'Плед, гирлянда, коробки и бумажные звёзды: собираем фон для праздничных фото за полчаса.', p: 'Видео и шаблоны надписей для печати.' },
    { k: 'card',  h: 'Желание под бой курантов', f: 'Маленькая открытка для желания и семейная традиция: что с ней делать, когда бьют часы.', p: 'Открытки-желания с именем для каждого гостя.' }
  ];
  var win = document.getElementById('windows'), note = document.getElementById('win-note'), seal = document.getElementById('adv-seal'), legend = document.getElementById('adv-legend');
  if (win) {
    var now = new Date();
    var openUntil = 0;
    if (now.getMonth() === 11) openUntil = now.getDate();
    else if (now.getMonth() === 0) openUntil = 31;
    if (/[?&]advent=(\d+)/.test(location.search)) openUntil = Math.min(31, +RegExp.$1);
    var today = now.getMonth() === 11 || /[?&]advent=/.test(location.search) ? openUntil : 0;
    if (openUntil > 0 && seal) seal.hidden = true;
    if (legend) {
      var cnt = {};
      ADVENT.forEach(function (a) { cnt[a.k] = (cnt[a.k] || 0) + 1; });
      legend.innerHTML = Object.keys(KINDS).map(function (k) {
        return '<li class="lg lg-' + KINDS[k].c + '"><i aria-hidden="true"></i>' + KINDS[k].n + '<small>' + cnt[k] + '</small></li>';
      }).join('');
    }
    var html = '';
    for (var dd = 1; dd <= 31; dd++) {
      var a = ADVENT[dd - 1], open = dd <= openUntil;
      html += '<li style="--d:' + [0, 3, 1, 4, 2][dd % 5] + '"><button type="button" class="win k-' + KINDS[a.k].c + ' pt' + (dd % 3) + (open ? ' is-open' : '') + (dd === today ? ' is-today' : '') +
        '" data-d="' + dd + '" aria-label="' + dd + ' декабря, ' + KINDS[a.k].n.toLowerCase() + (open ? ', открыто' : ', откроется ' + dd + ' декабря') + '">' +
        '<span class="cap" aria-hidden="true"></span><span class="ball" aria-hidden="true"><b>' + dd + '</b></span><small class="st-w" aria-hidden="true">' + (open ? 'открыто' : 'с ' + dd + ' дек') + '</small></button></li>';
    }
    win.innerHTML = html;
    function show(n) {
      var a = ADVENT[n - 1], kd = KINDS[a.k], open = n <= openUntil;
      note.className = 'win-note is-card k-' + kd.c;
      note.innerHTML = '<p class="wn-top"><span class="wn-kind">' + kd.n + '</span><span class="wn-date">' + n + ' декабря' + (open ? '' : ' · откроется в этот день') + '</span></p>' +
        '<h3>' + a.h + '</h3>' +
        (open ? '<p class="wn-free">' + a.f + '</p>' : '<p class="wn-free wn-lock">Окошко ещё закрыто. Загляните ' + n + ' декабря или подпишитесь, и мы пришлём его утром.</p>') +
        '<p class="wn-plus"><span class="soon">скоро</span> Расширенное окошко. ' + a.p + '</p>';
      [].forEach.call(win.querySelectorAll('.win.is-sel'), function (b) { b.classList.remove('is-sel'); });
      var cur = win.querySelector('.win[data-d="' + n + '"]'); if (cur) cur.classList.add('is-sel');
    }
    win.addEventListener('click', function (e) {
      var b = e.target.closest('.win'); if (!b) return;
      show(+b.getAttribute('data-d'));
    });
    if (openUntil > 0) show(openUntil);
    else note.innerHTML = '<p class="wn-hint">Нажмите на любой шар: покажем, что спрятано в окошке. Цвет шара подсказывает, что внутри.</p>';
  }

  /* ---------- старый телевизор ---------- */
  var RT = 'https://rutube.ru/play/embed/';
  function SM(id) { return 'https://player.smotrim.ru/iframe/video/id/' + id + '/start_zoom/true/showZoomBtn/false/sid/smotrim/isPlay/false/mute/false/'; }
  var MOS = 'Мосфильм, RuTube', GOR = 'Киностудия Горького, RuTube';
  var FILMS = [
    { t: 'Ирония судьбы, или С лёгким паром!', y: 1975, d: 'Эльдар Рязанов', s: 'Баня тридцать первого, самолёт в Ленинград и квартира, которая выглядит точь-в-точь как своя.', c: 'Под него режут салаты уже пятьдесят лет.', u: 'https://cinema.mosfilm.ru/films/35162/', src: 'Мосфильм', es: MOS,
      embed: [{ n: '1 серия', u: RT + '2d0899d6388926b7caa66a09e9073572/' }, { n: '2 серия', u: RT + '83e55d3104776e47517b7bbab318e018/' }] },
    { t: 'Карнавальная ночь', y: 1956, d: 'Эльдар Рязанов', s: 'Дом культуры готовит новогодний бал, а новый директор хочет вместо джаза лекцию.', c: 'Песня про пять минут и Гурченко в двадцать один год.', u: 'https://cinema.mosfilm.ru/films/34844/', src: 'Мосфильм', es: MOS,
      embed: RT + '2489d73325e7135837a6663027535d61/?p=ZsQfh_G09CaB2Gv2UGRzvw' },
    { t: 'Морозко', y: 1964, d: 'Александр Роу', s: 'Настенька, хвастливый Иван и старик Мороз с посохом, который всё видит.', c: 'Сказка, которую родители смотрят вместе с детьми, а потом цитируют.', u: 'https://rutube.ru/video/15c3b499bbd1dec49ab415f491893615/', src: 'RuTube', es: GOR,
      embed: RT + '15c3b499bbd1dec49ab415f491893615/' },
    { t: 'Двенадцать месяцев', y: '1972 (премьера на ТВ 1 января 1973)', d: 'Анатолий Граник', s: 'Юная королева требует подснежников в январе, а падчерица находит у костра двенадцать месяцев.', c: 'По пьесе Маршака: зимний лес и доброта, которая вознаграждается.', u: 'https://smotrim.ru/brand/8026' },
    { t: 'Вечера на хуторе близ Диканьки', y: 1961, d: 'Александр Роу', s: 'Кузнец Вакула, черевички царицы и чёрт, который украл месяц с неба.', c: 'Гоголь в сказочных декорациях, с колядками и снегом.', u: 'https://rutube.ru/video/3203985926beb304a01b6781c77d78fe/', src: 'RuTube', es: GOR,
      embed: RT + '3203985926beb304a01b6781c77d78fe/' },
    { t: 'Чародеи', y: 1982, d: 'Константин Бромберг', s: 'НИИ волшебства под Новый год: волшебная палочка, заколдованная невеста и стена, сквозь которую можно пройти.', c: 'Песни из него знают наизусть даже те, кто не смотрел.', u: 'https://smotrim.ru/brand/7321', es: 'Смотрим, ВГТРК',
      embed: SM(2217810) },
    { t: 'Служебный роман', y: 1977, d: 'Эльдар Рязанов', s: 'Строгая начальница, робкий Новосельцев и целое статистическое учреждение.', c: 'Тёплый фильм про людей, которые долго не решаются.', u: 'https://cinema.mosfilm.ru/films/34315/', src: 'Мосфильм', es: MOS,
      embed: [{ n: '1 серия', u: RT + '9b8a20607f7a35bde58aaf51fd9d8348/' }, { n: '2 серия', u: RT + '45fd0c7752add6e3cad61521a8869dac/' }] },
    { t: 'Любовь и голуби', y: 1984, d: 'Владимир Меньшов', s: 'Голуби на крыше, путёвка на юг и деревенская семья, которую невозможно не полюбить.', c: 'Каждую реплику Раисы Захаровны хочется записать.', u: 'https://cinema.mosfilm.ru/films/34335/', src: 'Мосфильм', es: MOS,
      embed: RT + '68781d890618ea50933ec020fd5060bf/' },
    { t: 'Джентльмены удачи', y: 1971, d: 'Александр Серый', s: 'Заведующий детским садом как две капли воды похож на вора по кличке Доцент.', c: 'Смешно в любом возрасте, проверено поколениями.', u: 'https://cinema.mosfilm.ru/films/34360/', src: 'Мосфильм', es: MOS,
      embed: RT + '8f50ed5a7841ff1418671a3c6b7440d4/' },
    { t: 'Снегурочка', y: 1968, d: 'Павел Кадочников', s: 'Дочь Весны и Мороза приходит к людям и хочет узнать, что такое любовь.', c: 'Красивая и немного грустная сказка по Островскому.', u: 'https://smotrim.ru/brand/5749' },
    { t: 'Старый Новый год', y: 1980, d: 'Наум Ардашников, Олег Ефремов', s: 'Две семьи в новом доме отмечают старый Новый год: каждая по-своему.', c: 'Для тех, кому мало одного праздника.', u: 'https://cinema.mosfilm.ru/films/35401/', src: 'Мосфильм' }
  ];
  var card = document.getElementById('tv-card'), noise = document.getElementById('tv-noise'), knob = document.getElementById('tv-knob');
  if (card) {
    var ch = 0, nctx = noise.getContext('2d'), part = 0;
    var screen = document.getElementById('tv-screen'), bar = document.getElementById('tv-bar'), player = document.getElementById('tv-player');
    function parts(f) { return !f.embed ? [] : (typeof f.embed === 'string' ? [{ n: '', u: f.embed }] : f.embed); }
    function render() {
      var f = FILMS[ch], ep = parts(f);
      card.innerHTML = '<p class="tv-ch">Канал ' + (ch + 1) + ' из ' + FILMS.length + '</p><h3>' + f.t + '</h3>' +
        '<p class="tv-meta">' + f.y + ', реж. ' + f.d + '</p><p class="tv-desc">' + f.s + '</p><p class="tv-cozy">' + f.c + '</p>' +
        (ep.length
          ? '<div class="tv-acts"><button type="button" class="tv-watch tv-play" data-part="0">▶ Включить' + (ep.length > 1 ? ' 1 серию' : ' фильм') + '</button>' +
            (ep.length > 1 ? '<button type="button" class="tv-watch tv-watch-line tv-play" data-part="1">2 серия</button>' : '') + '</div>' +
            '<p class="tv-src">Плеер: ' + f.es + '. <a href="' + f.u + '" target="_blank" rel="noopener">Смотреть на сайте правообладателя</a></p>'
          : '<a class="tv-watch" href="' + f.u + '" target="_blank" rel="noopener">Смотреть на «' + (f.src || 'Смотрим') + '»</a>');
      knob.querySelector('.knob-in').style.setProperty('--rot', (ch * 32) + 'deg');
    }
    function play(p) {
      var f = FILMS[ch], ep = parts(f);
      if (!ep[p]) return;
      part = p;
      var fr = document.createElement('iframe');
      fr.title = f.t + (ep[p].n ? ', ' + ep[p].n : '') + ' (' + f.es + ')';
      fr.setAttribute('allow', 'autoplay; fullscreen; encrypted-media; picture-in-picture');
      fr.setAttribute('allowfullscreen', '');
      fr.setAttribute('loading', 'lazy');
      fr.src = ep[p].u;
      player.innerHTML = '';
      player.appendChild(fr);
      screen.classList.add('playing');
      var sw = ep.length > 1 ? ep.map(function (e, i) { return '<button type="button" class="tv-ctl tv-part' + (i === p ? ' on' : '') + '" data-part="' + i + '" aria-pressed="' + (i === p) + '">' + e.n + '</button>'; }).join('') : '';
      var canFs = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
      bar.innerHTML = '<p class="tv-bar-src"><b>' + f.t + '</b>' + (ep[p].n ? ', ' + ep[p].n : '') + '. Плеер: ' + f.es +
        '. <a href="' + f.u + '" target="_blank" rel="noopener">Смотреть на сайте правообладателя</a></p>' +
        '<div class="tv-bar-btns">' + sw +
        (canFs ? '<button type="button" class="tv-ctl" id="tv-fs">⛶ На весь экран</button>' : '') +
        '<button type="button" class="tv-ctl tv-off" id="tv-off">Выключить телевизор</button></div>';
      bar.hidden = false;
    }
    function off() {
      player.innerHTML = '';
      screen.classList.remove('playing');
      bar.hidden = true; bar.innerHTML = '';
      var fe = document.fullscreenElement || document.webkitFullscreenElement;
      if (fe) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    }
    function fullscreen() {
      var el = player.querySelector('iframe') || player;
      var rq = el.requestFullscreen || el.webkitRequestFullscreen;
      if (rq) { try { var r = rq.call(el); if (r && r.catch) r.catch(function () {}); } catch (e) {} }
    }
    card.addEventListener('click', function (e) {
      var b = e.target.closest('.tv-play');
      if (b) staticBurst(function () { play(+b.dataset.part); });
    });
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.id === 'tv-off') staticBurst(off);
      else if (b.id === 'tv-fs') fullscreen();
      else if (b.classList.contains('tv-part') && +b.dataset.part !== part) staticBurst(function () { play(+b.dataset.part); });
    });
    function staticBurst(done) {
      if (reduce) { done(); return; }
      noise.width = 160; noise.height = 120; noise.classList.add('on');
      var start = performance.now(), fin = false;
      function finish() { if (fin) return; fin = true; done(); noise.classList.remove('on'); }
      setTimeout(finish, 600); // если вкладка в фоне и кадры не идут
      (function frame(t) {
        if (fin) return;
        var img = nctx.createImageData(160, 120), dta = img.data;
        for (var q = 0; q < dta.length; q += 4) { var v = Math.random() * 255 | 0; dta[q] = dta[q + 1] = dta[q + 2] = v; dta[q + 3] = 255; }
        nctx.putImageData(img, 0, 0);
        if (t - start < 260) requestAnimationFrame(frame); else finish();
      })(start);
    }
    function go(dir) { ch = (ch + dir + FILMS.length) % FILMS.length; staticBurst(function () { off(); render(); }); }
    knob.addEventListener('click', function () { go(1); });
    document.getElementById('tv-next').addEventListener('click', function () { go(1); });
    document.getElementById('tv-prev').addEventListener('click', function () { go(-1); });
    render();
  }

  /* ---------- верхнее меню: подсветка текущего раздела ---------- */
  var navEl = document.getElementById('nav');
  if (navEl && 'IntersectionObserver' in window) {
    var navLinks = [].slice.call(navEl.querySelectorAll('a[href^="#"]:not(.nav-cta)'));
    var navMap = {};
    navLinks.forEach(function (a) { var t = document.getElementById(a.getAttribute('href').slice(1)); if (t) navMap[t.id] = a; });
    var navIo = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (!en.isIntersecting) return;
        navLinks.forEach(function (a) { a.classList.remove('on'); a.removeAttribute('aria-current'); });
        var a = navMap[en.target.id]; if (a) { a.classList.add('on'); a.setAttribute('aria-current', 'true'); }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(navMap).forEach(function (id) { navIo.observe(document.getElementById(id)); });
  }

  /* ---------- соцсети без ссылки ---------- */
  var toast = document.getElementById('toast');
  document.querySelectorAll('[data-todo]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      if (toast) { toast.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { toast.hidden = true; }, 2600); }
    });
  });

  /* ---------- меню разделов (левый верхний угол) ---------- */
  var menu = document.getElementById('menu'), menuBtn = document.getElementById('menu-btn');
  if (menu && menuBtn) {
    var panel = menu.querySelector('.menu-panel'), menuMusic = document.getElementById('menu-music'), siteMusic = document.getElementById('music'), mT = 0;
    function syncMusic() {
      if (!menuMusic || !siteMusic) return;
      var on = siteMusic.getAttribute('aria-pressed') === 'true';
      menuMusic.setAttribute('aria-pressed', on ? 'true' : 'false');
      menuMusic.querySelector('span').textContent = on ? 'Музыка играет — выключить' : 'Включить музыку';
    }
    function openMenu() {
      clearTimeout(mT); syncMusic();
      menu.hidden = false; menuBtn.setAttribute('aria-expanded', 'true');
      document.documentElement.classList.add('menu-open');
      requestAnimationFrame(function () { menu.classList.add('on'); });
      setTimeout(function () { var f = panel.querySelector('.menu-list a'); if (f) f.focus({ preventScroll: true }); }, reduce ? 0 : 60);
    }
    function closeMenu(noFocus) {
      if (menu.hidden) return;
      menu.classList.remove('on'); menuBtn.setAttribute('aria-expanded', 'false');
      document.documentElement.classList.remove('menu-open');
      mT = setTimeout(function () { menu.hidden = true; }, reduce ? 0 : 360);
      if (!noFocus) menuBtn.focus({ preventScroll: true });
    }
    menuBtn.addEventListener('click', function () { menu.hidden ? openMenu() : closeMenu(); });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) { closeMenu(); return; }
      var a = e.target.closest('a[href^="#"]');
      if (a) { closeMenu(true); return; }      // переход по якорю браузер сделает сам
      var gb = e.target.closest('[data-open-game]');
      if (gb) {
        closeMenu(true);
        var globe = document.querySelector('.globe[data-game="' + gb.getAttribute('data-open-game') + '"]');
        if (globe) setTimeout(function () { globe.scrollIntoView({ block: 'center' }); globe.click(); }, 40);
        return;
      }
      if (e.target.closest('#menu-music') && siteMusic) { siteMusic.click(); setTimeout(syncMusic, 30); }
    });
    document.addEventListener('keydown', function (e) {
      if (menu.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
      if (e.key === 'Tab') {                    // фокус не уходит из панели
        var f = panel.querySelectorAll('a[href], button:not([disabled])'), first = f[0], lastF = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastF.focus(); }
        else if (!e.shiftKey && document.activeElement === lastF) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ---------- золотые искры: редкие, тонкие, мерцают и гаснут ---------- */
  (function () {
    var cv = document.getElementById('glints');
    if (!cv || reduce) return;
    var ctx = cv.getContext('2d'), W = 0, H = 0, R = Math.min(DPR, 1.5), list = [], raf = 0, nextAt = 0, skip = 0;
    var MAX = window.innerWidth < 700 ? 6 : 10;
    function size() { W = cv.width = Math.round(innerWidth * R); H = cv.height = Math.round(innerHeight * R); }
    size(); window.addEventListener('resize', size);
    var lightSecs = [].filter.call(document.querySelectorAll('main > section, .foot'), function (s) {
      var m = getComputedStyle(s).backgroundColor.match(/\d+(\.\d+)?/g);
      return m && (+m[3] !== 0) && (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) > 160;
    });
    function onLight(x, y) {
      for (var k = 0; k < lightSecs.length; k++) { var r = lightSecs[k].getBoundingClientRect(); if (y >= r.top && y <= r.bottom) return true; }
      return false;
    }
    function spawn() {
      var x, y, g = document.getElementById('hero-globe'), r = g && g.getBoundingClientRect();
      if (r && r.bottom > 0 && r.top < innerHeight && Math.random() < 0.35) { x = r.left + r.width * (0.2 + Math.random() * 0.6); y = r.top + r.height * (0.12 + Math.random() * 0.5); }
      else { x = Math.random() * innerWidth; y = 70 + Math.random() * (innerHeight - 90); }
      var big = Math.random() < 0.22;
      list.push({ x: x * R, y: y * R, t: 0, life: 1500 + Math.random() * 1400, s: (big ? 10 + Math.random() * 6 : 4 + Math.random() * 5) * R, rot: (Math.random() - 0.5) * 0.5, light: onLight(x, y) });
    }
    function glint(p, k) {
      var s = p.s * (0.6 + 0.4 * k), c = p.light ? '160,112,40' : '246,222,160';
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      var gr = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.3);
      gr.addColorStop(0, 'rgba(' + c + ',' + (0.55 * k) + ')'); gr.addColorStop(1, 'rgba(' + c + ',0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, s * 1.3, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(' + c + ',' + (0.95 * k) + ')';
      ctx.beginPath();                                   // четырёхлучевая звёздочка с тонкими лучами
      ctx.moveTo(0, -s * 1.6); ctx.quadraticCurveTo(0, 0, s * 1.6, 0); ctx.quadraticCurveTo(0, 0, 0, s * 1.6); ctx.quadraticCurveTo(0, 0, -s * 1.6, 0); ctx.quadraticCurveTo(0, 0, 0, -s * 1.6);
      ctx.fill();
      if (!p.light) { ctx.fillStyle = 'rgba(255,252,240,' + k + ')'; ctx.beginPath(); ctx.arc(0, 0, Math.max(0.8 * R, s * 0.14), 0, 6.283); ctx.fill(); }
      ctx.restore();
    }
    var lastT = 0;
    function frame(t) {
      raf = requestAnimationFrame(frame);
      if (++skip % 2) return;                             // ~30 кадров в секунду достаточно
      var dt = Math.min(80, t - (lastT || t)); lastT = t;
      if (document.getElementById('rk') || document.getElementById('rl') || document.documentElement.classList.contains('menu-open')) { if (list.length) { list = []; ctx.clearRect(0, 0, W, H); } return; }
      if (t > nextAt && list.length < MAX) { spawn(); nextAt = t + 420 + Math.random() * 900; }
      ctx.clearRect(0, 0, W, H);
      for (var k = list.length - 1; k >= 0; k--) {
        var p = list[k]; p.t += dt;
        if (p.t >= p.life) { list.splice(k, 1); continue; }
        var u = p.t / p.life, b = Math.pow(Math.sin(Math.PI * u), 2);
        b *= 0.75 + 0.25 * Math.sin(p.t * 0.02);         // лёгкое мерцание
        glint(p, b);
      }
    }
    function start() { if (!raf) { lastT = 0; raf = requestAnimationFrame(frame); } }
    function stop() { cancelAnimationFrame(raf); raf = 0; }
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
    start();
  })();
})();
