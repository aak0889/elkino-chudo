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
    else if (+dt === +today) { leaves[i].classList.add('is-today'); if (!next) next = leaves[i]; }
    else { if (!leaves[i].parentNode.querySelector('.is-next')) leaves[i].classList.add('is-next'); if (!next) next = leaves[i]; }
  }
  if (next) {
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
        sctx.globalAlpha = a; sctx.fillStyle = '#f4f7ff';
        sctx.beginPath(); sctx.arc(s.x, s.y, s.r, 0, 6.283); sctx.fill();
        if (s.big) {
          var L = s.r * 6 * a; sctx.globalAlpha = a * 0.7; sctx.strokeStyle = '#dfe8ff'; sctx.lineWidth = DPR * 0.8;
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

  /* ---------- большой круглый шар на первом экране: новогодняя ярмарка с каруселью ----------
     Две фотографии одной сцены: «сумерки» (огни погашены) и «чудо» (огни горят). Карусель — отдельный
     спрайт-лист (24 кадра поворота на 60°, отрисованы в three.js), он стоит на круглой площадке ярмарки.
     «Включить чудо»: проявляется вторая фотография, карусель плавно разгоняется, бегут огоньки по фестону,
     мерцают гирлянды над палатками, в шаре идёт снег. Всё в canvas строго внутри круга стекла.
     Координаты — доли картинки 880×939 (кадр 805×859 из исходника 1024×1024, форма шара — вариант 3: большая сфера, золотое кольцо, точёная подставка). */
  var ORB = { cx: 0.5001, cy: 0.4691, r: 0.4824, floor: 0.64 };   // r — доля ширины; floor — верх снега на площади
  // огни сцены [x, y, вес]: найдены по яркости на фото «включено» (кроме тех, что закрывает карусель)
  var ORB_LIGHTS = [[0.212,0.442,2.75],[0.498,0.212,2.75],[0.142,0.468,2.75],[0.486,0.213,2.74],[0.165,0.446,2.74],[0.887,0.496,2.71],[0.22,0.54,2.71],[0.773,0.432,2.7],[0.795,0.446,2.68],[0.286,0.423,2.67],[0.15,0.446,2.67],[0.494,0.222,2.66],[0.866,0.468,2.66],[0.185,0.797,2.65],[0.764,0.424,2.64],[0.749,0.412,2.63],[0.272,0.419,2.62],[0.858,0.446,2.6],[0.325,0.423,2.6],[0.251,0.412,2.6],[0.511,0.229,2.59],[0.837,0.449,2.56],[0.314,0.425,2.52],[0.185,0.449,2.51],[0.275,0.671,2.49],[0.226,0.432,2.49],[0.483,0.064,2.49],[0.815,0.452,2.48],[0.21,0.801,2.48],[0.132,0.488,2.47],[0.493,0.247,2.45],[0.799,0.637,2.45],[0.711,0.424,2.42],[0.338,0.42,2.41],[0.737,0.619,2.39],[0.875,0.449,2.38],[0.511,0.246,2.37],[0.607,0.815,2.35],[0.425,0.816,2.34],[0.758,0.632,2.33],[0.235,0.425,2.32],[0.077,0.364,2.32],[0.68,0.263,2.32],[0.635,0.814,2.31],[0.506,0.292,2.31],[0.743,0.541,2.29],[0.073,0.378,2.28],[0.083,0.348,2.25],[0.538,0.327,2.24],[0.07,0.395,2.24],[0.067,0.405,2.24],[0.64,0.215,2.22],[0.799,0.658,2.22],[0.23,0.661,2.21],[0.709,0.509,2.21],[0.154,0.435,2.21],[0.929,0.383,2.2],[0.738,0.661,2.19],[0.194,0.563,2.18],[0.171,0.651,2.18]];
  var ORB_STAR = [0.502, 0.22];
  // карусель: рамка спрайта (доли картинки) и эллипс фестона с лампочками
  var CAR = { x: 0.2943, y: 0.317, w: 0.4375, h: 0.41, frames: 24, cols: 8, rows: 3 };
  var CAR_RING = [CAR.x + CAR.w * 0.5, CAR.y + CAR.h * 0.405, CAR.w * 0.4, CAR.h * 0.135];
  function HeroGlobe(fig, cv, btn) {
    var ctx = cv.getContext('2d'), W = 0, H = 0, R = Math.min(DPR, 1.5), C = {};
    var weak = window.innerWidth < 700 || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3;
    var N = weak ? 80 : 140, on = false, k = 0, time = 0, flakes = [], smoke = [], spin = 0, carF = -1;
    var carEl = fig.querySelector('.gb-carousel');
    function carFrame() {                                  // поворот карусели → кадр спрайт-листа (период 60°)
      var P = Math.PI / 3, f = Math.floor(((spin % P) + P) % P / P * CAR.frames) % CAR.frames;
      if (f === carF || !carEl) return; carF = f;
      carEl.style.backgroundPosition = (f % CAR.cols) / (CAR.cols - 1) * 100 + '% ' + Math.floor(f / CAR.cols) / (CAR.rows - 1) * 100 + '%';
    }
    var lp = loop(frame), visible = true, running = false;
    function sprite(sz, fn) { var c = document.createElement('canvas'); c.width = c.height = sz; fn(c.getContext('2d'), sz / 2); return c; }
    var SNOW = sprite(32, function (g, h) { var gr = g.createRadialGradient(h, h, 0, h, h, h); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.45, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 2 * h, 2 * h); });
    var GLOW = sprite(64, function (g, h) { var gr = g.createRadialGradient(h, h, 0, h, h, h); gr.addColorStop(0, 'rgba(255,244,222,.95)'); gr.addColorStop(.22, 'rgba(255,218,170,.42)'); gr.addColorStop(1, 'rgba(255,190,130,0)'); g.fillStyle = gr; g.fillRect(0, 0, 2 * h, 2 * h); });
    var STAR = sprite(96, function (g, h) {
      var gr = g.createRadialGradient(h, h, 0, h, h, h); gr.addColorStop(0, 'rgba(255,240,190,.9)'); gr.addColorStop(.2, 'rgba(255,236,208,.35)'); gr.addColorStop(1, 'rgba(255,170,60,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 2 * h, 2 * h);
      g.fillStyle = 'rgba(255,250,230,.95)'; g.beginPath(); var s = h * .95;
      g.moveTo(h, h - s); g.quadraticCurveTo(h, h, h + s, h); g.quadraticCurveTo(h, h, h, h + s); g.quadraticCurveTo(h, h, h - s, h); g.quadraticCurveTo(h, h, h, h - s); g.fill();
    });
    var PUFF = sprite(64, function (g, h) { var gr = g.createRadialGradient(h, h, 0, h, h, h); gr.addColorStop(0, 'rgba(236,240,248,.55)'); gr.addColorStop(.6, 'rgba(220,228,240,.18)'); gr.addColorStop(1, 'rgba(220,228,240,0)'); g.fillStyle = gr; g.fillRect(0, 0, 2 * h, 2 * h); });
    var lights = ORB_LIGHTS.map(function (a) {
      var tree = a[0] > 0.42 && a[0] < 0.59 && a[1] < 0.53;
      return { x: a[0], y: a[1], s: a[2], ph: Math.random() * 6.3, sp: .7 + Math.random() * 1.6, tree: tree };
    });

    function geo() {
      var box = cv.parentNode; W = box.offsetWidth; H = box.offsetHeight;
      cv.width = Math.max(1, Math.round(W * R)); cv.height = Math.max(1, Math.round(H * R));
      C = { x: ORB.cx * W, y: ORB.cy * H, r: ORB.r * W * 0.955 };
    }
    function floorY(x) {                                   // снежный холм или стекло — что выше
      var dx = x - C.x, cb = C.y + Math.sqrt(Math.max(0, C.r * C.r - dx * dx));
      return Math.min(ORB.floor * H - H * 0.012 * Math.cos(dx / C.r * 1.6), cb - 2);
    }
    function place(f, top) {                              // случайная точка внутри стекла (top — только верхняя часть)
      for (var i = 0; i < 30; i++) {
        var x = C.x + (Math.random() * 2 - 1) * C.r, y = C.y - C.r + Math.random() * C.r * (top ? 1.1 : 1.75);
        if (Math.hypot(x - C.x, y - C.y) < C.r - 4 && y < floorY(x) - 6) { f.x = x; f.y = y; return; }
      }
      f.x = C.x; f.y = C.y - C.r * .6;
    }
    function newFlake(delay, top) {
      var z = Math.random(), f = { z: z, r: (1 + z * 2.1 + (Math.random() < .07 ? 1.4 : 0)) * (W / 470), vt: (14 + z * 16 + Math.random() * 8) * (W / 470),
        ph: Math.random() * 6.3, wf: .6 + Math.random() * 1.1, vx: 0, a: 0, wait: delay, rest: 0 };
      place(f, top); return f;
    }
    function seed(delayed) {
      flakes = []; for (var i = 0; i < N; i++) flakes.push(newFlake(delayed ? Math.random() * 1.8 : 0, false));
    }
    function emitSmoke(p, big) {
      smoke.push({ x: p[0] * W + (Math.random() - .5) * 3, y: p[1] * H, vx: (Math.random() - .3) * 6 * (W / 470), vy: -(14 + Math.random() * 10) * (W / 470) * (big ? 1.4 : 1),
        s: (big ? 9 : 6) * (W / 470), t: 0, life: 2.2 + Math.random() * 1.2 });
    }

    function step(dt) {
      time += dt;
      var target = on ? 1 : 0, rate = reduce ? 99 : dt / 1.0;          // огни: ~1 с на включение и выключение
      k += Math.max(-rate, Math.min(rate, target - k));
      for (var i = flakes.length - 1; i >= 0; i--) {
        var f = flakes[i];
        if (f.wait > 0) { f.wait -= dt; continue; }
        if (f.rest) {                                     // лёг на снег: тает в сугробе и, если чудо включено, падает заново
          f.rest += dt; if (f.rest > 2.2) { if (on) { var n = newFlake(Math.random() * .6, true); flakes[i] = n; } else flakes.splice(i, 1); }
          continue;
        }
        f.a = Math.min(1, f.a + dt * 1.6);
        f.ph += dt * f.wf;
        var sway = Math.sin(f.ph) * (6 + f.r * 2) * (W / 470);
        f.vx += (sway - f.vx) * Math.min(1, 2 * dt);
        f.x += f.vx * dt; f.y += f.vt * dt;
        var dx = f.x - C.x, dy = f.y - C.y, d = Math.hypot(dx, dy), lim = C.r - f.r - 2;
        if (d > lim) { f.x = C.x + dx / d * lim; f.y = C.y + dy / d * lim; f.vx *= -.4; }
        if (f.y >= floorY(f.x) - f.r * .3) { f.y = floorY(f.x) - f.r * .3; f.rest = 0.0001; }
      }
      spin += dt * 0.75 * k * k; carFrame();               // карусель разгоняется и тормозит вместе с огнями (оборот ≈ 8 с)
      for (i = smoke.length - 1; i >= 0; i--) {
        var s = smoke[i]; s.t += dt; if (s.t > s.life) { smoke.splice(i, 1); continue; }
        s.x += (s.vx + Math.sin(time * .8 + i) * 3) * dt; s.y += s.vy * dt; s.vy *= Math.pow(.6, dt); s.s += dt * 9 * (W / 470);
      }
    }
    function draw() {
      ctx.setTransform(R, 0, 0, R, 0, 0); ctx.clearRect(0, 0, W, H);
      ctx.save(); ctx.beginPath(); ctx.arc(C.x, C.y, C.r, 0, 6.2832); ctx.clip();
      // дым
      for (var i = 0; i < smoke.length; i++) {
        var s = smoke[i], u = s.t / s.life; ctx.globalAlpha = Math.sin(Math.PI * Math.min(1, u * 1.3)) * .55 * (1 - u * .4) * k;
        ctx.drawImage(PUFF, s.x - s.s, s.y - s.s, s.s * 2, s.s * 2);
      }
      if (k > 0.003) {
        ctx.globalCompositeOperation = 'lighter';
        var gl = W * 0.034;
        for (i = 0; i < lights.length; i++) {
          var L = lights[i], a = .6 + .25 * Math.sin(time * L.sp + L.ph) + .1 * Math.sin(time * 6.1 + L.ph * 3);
          if (L.tree) a *= .35 + .75 * Math.pow(.5 + .5 * Math.sin(time * 2.2 - L.y * 46 + L.x * 14), 2);   // бегущие огоньки гирлянды
          ctx.globalAlpha = Math.max(0, Math.min(1, a * k * .75));
          var sz = gl * (.7 + L.s * .55);
          ctx.drawImage(GLOW, L.x * W - sz / 2, L.y * H - sz / 2, sz, sz);
        }
        // звезда на ёлке
        var ss = W * (.11 + .015 * Math.sin(time * 1.4)); ctx.save(); ctx.translate(ORB_STAR[0] * W, ORB_STAR[1] * H); ctx.rotate(time * .2);
        ctx.globalAlpha = Math.min(1, (.75 + .25 * Math.sin(time * 2.3)) * k); ctx.drawImage(STAR, -ss / 2, -ss / 2, ss, ss); ctx.restore();
        // лампочки на фестоне карусели едут вместе с ней; по ним бежит волна света
        var cx = CAR_RING[0] * W, cy = CAR_RING[1] * H, rx = CAR_RING[2] * W, ry = CAR_RING[3] * H;
        for (i = 0; i < 24; i++) {
          var ang = spin + i * 0.2618, front = Math.sin(ang), cs = W * (.02 + .012 * (front + 1) / 2);
          if (front < -0.35) continue;                    // задние закрыты шатром
          var chase = .55 + .45 * Math.pow(.5 + .5 * Math.sin(time * 3.2 - i * .9), 3);
          ctx.globalAlpha = Math.min(1, (.3 + .6 * (front + 1) / 2) * chase * k);
          ctx.drawImage(GLOW, cx + Math.cos(ang) * rx - cs / 2, cy + front * ry - cs / 2, cs, cs);
        }
        // тёплое сияние под шатром
        var ug = W * .2; ctx.globalAlpha = .32 * k * (.9 + .1 * Math.sin(time * 2));
        ctx.drawImage(GLOW, cx - ug / 2, cy + ry * .9 - ug * .3, ug, ug * .7);
        ctx.globalCompositeOperation = 'source-over';
      }
      for (i = 0; i < flakes.length; i++) {
        var f = flakes[i]; if (f.wait > 0) continue;
        var al = f.rest ? Math.max(0, 1 - f.rest / 2.2) * .7 : (.45 + .5 * f.z) * f.a, r = f.r * 2.2;
        if (al <= 0) continue; ctx.globalAlpha = al; ctx.drawImage(SNOW, f.x - r, f.y - r, r * 2, r * 2);
      }
      ctx.restore(); ctx.globalAlpha = 1;
    }
    function frame(dts) {
      step(Math.min(0.05, dts / 60)); draw();
      if (!on && k <= 0 && !flakes.length && !smoke.length) { lp.stop(); running = false; }
    }
    function run() { if (reduce) { draw(); return; } if (visible && !running) { running = true; lp.start(); } }
    function set(v) {
      on = v; fig.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.querySelector('span').textContent = on ? 'Выключить' : 'Включить чудо';
      if (on && !flakes.length) seed(true);
      if (reduce) {                                       // без анимации: один спокойный кадр
        k = on ? 1 : 0; time = 1.3; spin = on ? 0.4 : 0; carFrame();
        if (on) { seed(false); flakes.forEach(function (f) { f.a = 1; f.wait = 0; }); } else flakes = [];
        smoke = []; draw(); return;
      }
      run();
    }
    geo();
    btn.addEventListener('click', function () { set(!on); });
    window.addEventListener('resize', function () {
      var oW = W, oH = H; geo(); if (!oW) return;
      var sx = W / oW, sy = H / oH; flakes.forEach(function (f) { f.x *= sx; f.y *= sy; f.r *= sx; f.vt *= sx; });
      if (reduce || !running) draw();
    });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) { if (on || k > 0) run(); } else { lp.stop(); running = false; } }, { rootMargin: '80px' }).observe(fig);
    document.addEventListener('visibilitychange', function () { if (document.hidden) { lp.stop(); running = false; } else if (visible && (on || k > 0)) run(); });
    // лёгкий наклон шара за курсором (только мышь, без reduced-motion)
    if (!reduce && window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) {
      var body = fig.querySelector('.globe-body');
      fig.addEventListener('pointermove', function (e) {
        var r = fig.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
        body.style.transform = 'perspective(1200px) rotateY(' + (px * 5).toFixed(2) + 'deg) rotateX(' + (-py * 4).toFixed(2) + 'deg)';
      });
      fig.addEventListener('pointerleave', function () { body.style.transform = ''; });
    }
    window.__heroGlobe = { set: set, stats: function () {
      var out = 0; flakes.forEach(function (f) { if (f.wait <= 0 && Math.hypot(f.x - C.x, f.y - C.y) > C.r + 0.5) out++; });
      return { on: on, k: +k.toFixed(3), flakes: flakes.length, falling: flakes.filter(function (f) { return f.wait <= 0 && !f.rest; }).length, smoke: smoke.length, outside: out, running: running };
    } };
    return { set: set };
  }

  var hs = document.getElementById('hero-snow');
  if (hs) HeroGlobe(document.getElementById('hero-globe'), hs, document.getElementById('hero-switch'));
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
    var season = m === 10 || m === 11 || (m === 0 && d <= 14);   // снег с 1 ноября (11.11.2026: Настя просит снег по всему сайту)
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
  /* Механика: декабрь по локальной дате посетителя. Будущие шары заперты, сегодняшний светится,
     прошедшие доступны, открытые «распакованы» (хранится в localStorage). ?day=N — имитация N декабря
     для проверки (0 — режим «скоро»), со своим отдельным хранилищем, обычных посетителей не касается. */
  var win = document.getElementById('windows'), note = document.getElementById('win-note'), seal = document.getElementById('adv-seal'), legend = document.getElementById('adv-legend');
  if (win) {
    var advNow = new Date(), qs = location.search;
    var mDay = /[?&](?:day|advent)=(\d+)/.exec(qs);
    var advDay; // 0 — до декабря, 1..31 — день декабря, 32 — январские каникулы: открыто всё
    if (mDay) advDay = Math.min(31, +mDay[1]);
    else if (advNow.getMonth() === 11) advDay = advNow.getDate();
    else if (advNow.getMonth() === 0 && advNow.getDate() <= 14) advDay = 32;
    else advDay = 0;
    var KEY = mDay ? 'elk-adv-test' : 'elk-adv-opened';
    var opened = {};
    try { (JSON.parse(store(KEY) || '[]') || []).forEach(function (n) { opened[n] = 1; }); } catch (e) { opened = {}; }
    function save() { store(KEY, JSON.stringify(Object.keys(opened).map(Number))); }
    function img(n, big) { return 'img/adv/d' + pad(n) + (big ? '-l' : '') + '.webp'; }
    function state(n) { return n > advDay ? 'future' : opened[n] ? 'opened' : n === advDay ? 'today' : 'ready'; }

    if (seal) seal.textContent = advDay === 0 ? 'Первое окошко откроется 1 декабря' : advDay <= 31 ? 'Сегодня ' + advDay + ' декабря: ваш шар светится' : 'Все тридцать одно окошко открыты';
    if (legend) {
      var cnt = {};
      ADVENT.forEach(function (a) { cnt[a.k] = (cnt[a.k] || 0) + 1; });
      legend.innerHTML = Object.keys(KINDS).map(function (k) { return '<li class="lg">' + KINDS[k].n + '<small>' + cnt[k] + '</small></li>'; }).join('');
    }
    var LBL = { future: '', ready: 'открыть', today: 'Сегодня', opened: 'открыто' };
    function paint(b) {
      var n = +b.getAttribute('data-d'), s = state(n), next = advDay === 0 && n === 1;
      b.className = 'orn is-' + s + (next ? ' is-next' : '') + (n === advDay ? ' is-day' : '');
      b.setAttribute('aria-label', n + ' декабря, ' + (s === 'future' ? 'откроется ' + n + ' декабря' : s === 'opened' ? 'открыто, посмотреть ещё раз' : s === 'today' ? 'сегодняшнее окошко, открыть' : 'можно открыть'));
      b.querySelector('.st-w').textContent = next ? '1 декабря' : s === 'future' ? 'с ' + n + ' дек' : (n === advDay && s === 'opened' ? 'сегодня ✓' : LBL[s]);
    }
    var html = '';
    for (var dd = 1; dd <= 31; dd++) {
      html += '<li style="--d:' + [0, 3, 1, 4, 2][dd % 5] + '"><button type="button" class="orn" data-d="' + dd + '">' +
        '<span class="rib" aria-hidden="true"></span><span class="cap" aria-hidden="true"></span>' +
        '<span class="ball" aria-hidden="true"><span class="in"><img src="' + img(dd) + '" alt="" width="280" height="280" loading="lazy" decoding="async"><i class="frost"></i><i class="gl"></i><b>' + dd + '</b></span><i class="mk"></i></span>' +
        '<small class="st-w" aria-hidden="true"></small><span class="tap" aria-hidden="true">нажмите</span></button></li>';
    }
    win.innerHTML = html;
    var btns = [].slice.call(win.querySelectorAll('.orn'));
    function summary() {
      btns.forEach(paint);
      if (!note) return;
      var avail = Math.min(advDay, 31), done = Object.keys(opened).filter(function (n) { return +n <= avail; }).length;
      note.innerHTML = advDay === 0
        ? '<p class="wn-hint">Шары пока заперты. Первый засветится 1 декабря, а нажать на любой можно уже сейчас: подскажем, когда он откроется.</p>'
        : '<p class="wn-hint">Открыто <b>' + done + '</b> из ' + avail + '. ' +
          (advDay <= 31 ? (opened[advDay] ? 'Сегодняшнее окошко уже ваше, следующее откроется завтра.' : 'Светящийся шар ждёт вас сегодня.') : '') + '</p>';
    }
    summary();

    /* подсказка для запертых шаров */
    var advToast = document.createElement('div');
    advToast.className = 'adv-toast'; advToast.setAttribute('role', 'status'); advToast.setAttribute('aria-live', 'polite');
    document.body.appendChild(advToast);
    var tT;
    function say(t) { advToast.textContent = t; advToast.classList.add('on'); clearTimeout(tT); tT = setTimeout(function () { advToast.classList.remove('on'); }, 2600); }

    /* модалка окошка */
    var dlg = document.createElement('dialog');
    dlg.className = 'adv-dlg'; dlg.setAttribute('aria-labelledby', 'adv-dlg-h');
    document.body.appendChild(dlg);
    var lastBtn = null;
    function closeDlg() { if (dlg.close) dlg.close(); else { dlg.removeAttribute('open'); if (lastBtn) lastBtn.focus(); } }
    function openDay(n, b) {
      var a = ADVENT[n - 1], kd = KINDS[a.k], first = !opened[n];
      opened[n] = 1; save(); summary();
      lastBtn = b;
      dlg.innerHTML = '<button type="button" class="dlg-x" aria-label="Закрыть">×</button>' +
        '<div class="dlg-orn' + (first && !reduce ? ' pop' : '') + '"><span class="ball"><span class="in"><img src="' + img(n, 1) + '" alt="" width="520" height="520"><i class="gl"></i><b>' + n + '</b></span></span></div>' +
        '<p class="wn-top"><span class="wn-kind">' + kd.n + '</span><span class="wn-date">' + n + ' декабря</span></p>' +
        '<h3 id="adv-dlg-h">' + a.h + '</h3><p class="wn-free">' + a.f + '</p>' +
        '<p class="wn-plus"><span class="soon">скоро</span> Расширенное окошко. ' + a.p + '</p>' +
        '<button type="button" class="dlg-ok">Хорошо, закрыть</button>';
      if (dlg.showModal) { try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); } } else dlg.setAttribute('open', '');
      var ok = dlg.querySelector('.dlg-ok'); if (ok) ok.focus({ preventScroll: true });
    }
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg || e.target.closest('.dlg-x') || e.target.closest('.dlg-ok')) closeDlg();
    });
    dlg.addEventListener('close', function () { if (lastBtn) lastBtn.focus({ preventScroll: true }); });
    win.addEventListener('click', function (e) {
      var b = e.target.closest('.orn'); if (!b) return;
      var n = +b.getAttribute('data-d');
      if (n > advDay) {
        say(advDay === 0 && n === 1 ? 'Первый шар откроется 1 декабря' : 'Этот шар откроется ' + n + ' декабря');
        b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
        return;
      }
      openDay(n, b);
    });
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

  /* ---------- бриллиантовый блеск: редкие мягкие искорки с переливом (вместо золотых ромбов) ----------
     Каждая искра — светлое ядро и тонкие лучи-«крест», лучи переливаются от ледяного голубого к сиреневому и розовому,
     вспыхивают быстро и гаснут мягко. На светлых разделах — серебристо-голубые, чтобы не пропадали на сливочном фоне. */
  (function () {
    var cv = document.getElementById('glints');
    if (!cv || reduce) return;
    var ctx = cv.getContext('2d'), W = 0, H = 0, R = Math.min(DPR, 1.5), list = [], raf = 0, nextAt = 0, skip = 0;
    var MAX = window.innerWidth < 700 ? 3 : 5;
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
    var HUES = [200, 215, 265, 320, 40];                 // лёд, голубой, сирень, розовый, сливочный
    function spawn() {
      var x, y, g = document.getElementById('hero-globe'), r = g && g.getBoundingClientRect();
      if (r && r.bottom > 0 && r.top < innerHeight && Math.random() < 0.4) { x = r.left + r.width * (0.18 + Math.random() * 0.64); y = r.top + r.height * (0.08 + Math.random() * 0.55); }
      else { x = Math.random() * innerWidth; y = 70 + Math.random() * (innerHeight - 90); }
      var big = Math.random() < 0.2;
      list.push({ x: x * R, y: y * R, t: 0, life: 1100 + Math.random() * 700, s: (big ? 9 + Math.random() * 4 : 4.5 + Math.random() * 3.5) * R,
        rot: (Math.random() - 0.5) * 0.35, h: HUES[Math.floor(Math.random() * HUES.length)], light: onLight(x, y) });
    }
    function ray(len, w, col, a) {                       // тонкий луч, сужается к концу
      var gr = ctx.createLinearGradient(0, 0, len, 0);
      gr.addColorStop(0, 'hsla(' + col + ',' + a + ')'); gr.addColorStop(1, 'hsla(' + col + ',0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(0, -w); ctx.lineTo(len, 0); ctx.lineTo(0, w); ctx.closePath(); ctx.fill();
    }
    function glint(p, k, u) {
      var s = p.s * (0.7 + 0.3 * k), hue = (p.h + u * 90) % 360, w = Math.max(0.55, 0.38 * R);
      var col = p.light ? (hue + ',38%,58%') : (hue + ',85%,90%');
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot + u * 0.5);
      if (!p.light) ctx.globalCompositeOperation = 'lighter';
      var gr = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.1);
      gr.addColorStop(0, 'hsla(' + col + ',' + (0.42 * k) + ')'); gr.addColorStop(1, 'hsla(' + col + ',0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, s * 1.1, 0, 6.283); ctx.fill();
      for (var i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ray(s * 2.4, w, col, 0.85 * k); }                       // длинный крест
      ctx.rotate(Math.PI / 4); for (i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ray(s * 0.95, w * 0.8, col, 0.45 * k); }  // короткие косые
      ctx.fillStyle = p.light ? 'hsla(' + hue + ',30%,45%,' + (0.7 * k) + ')' : 'rgba(255,255,255,' + k + ')';
      ctx.beginPath(); ctx.arc(0, 0, Math.max(0.7 * R, s * 0.12), 0, 6.283); ctx.fill();
      ctx.restore();
    }    var lastT = 0;
    function frame(t) {
      raf = requestAnimationFrame(frame);
      if (++skip % 2) return;                             // ~30 кадров в секунду достаточно
      var dt = Math.min(80, t - (lastT || t)); lastT = t;
      if (document.getElementById('rk') || document.getElementById('rl') || document.documentElement.classList.contains('menu-open')) { if (list.length) { list = []; ctx.clearRect(0, 0, W, H); } return; }
      if (t > nextAt && list.length < MAX) { spawn(); nextAt = t + 900 + Math.random() * 1600; }
      ctx.clearRect(0, 0, W, H);
      for (var k = list.length - 1; k >= 0; k--) {
        var p = list[k]; p.t += dt;
        if (p.t >= p.life) { list.splice(k, 1); continue; }
        var u = p.t / p.life, b = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.6)), 3);   // быстрая вспышка, мягкое угасание
        b *= 0.85 + 0.15 * Math.sin(p.t * 0.03);         // лёгкое мерцание
        glint(p, b, u);
      }
    }
    function start() { if (!raf) { lastT = 0; raf = requestAnimationFrame(frame); } }
    function stop() { cancelAnimationFrame(raf); raf = 0; }
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
    start();
  })();
})();
