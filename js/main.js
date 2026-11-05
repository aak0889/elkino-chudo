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

  var hs = document.getElementById('hero-snow');
  if (hs) {
    var heroFig = document.getElementById('hero-globe');
    var heroSnow = GlobeSnow(hs, { count: 170, burst: 170 });
    var heroFire = shakeGesture(heroFig, heroSnow.shake, heroFig);
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

  /* ---------- календарь декабря ---------- */
  var TASKS = [
    'Повесить первую гирлянду. Хотя бы на окно.',
    'Составить список тех, кого хочется поздравить.',
    'Заварить чай с апельсиновой коркой и корицей.',
    'Вырезать бумажную снежинку и приклеить на стекло.',
    'Пересмотреть старые новогодние фотографии.',
    'Николин день: спрятать маленький сюрприз в чей-нибудь карман.',
    'Написать письмо Деду Морозу. Возраст значения не имеет.',
    'Выбрать фильм на вечер в старом телевизоре ниже.',
    'Испечь имбирное печенье и угостить соседей.',
    'Позвонить тому, с кем давно не говорили.',
    'Найти в коробке самую старую ёлочную игрушку.',
    'Сделать гирлянду из сушёных апельсинов.',
    'Погулять вечером там, где горят огни.',
    'Упаковать первый подарок.',
    'Придумать тост на тридцать первое.',
    'Сыграть в настольную игру всей семьёй.',
    'Записать три хороших события этого года.',
    'Поставить ёлку. Или веточку в вазу.',
    'Расписать меню праздничного стола.',
    'Отправить открытку бабушке или дедушке.',
    'Самая длинная ночь: зажечь свечи и выключить верхний свет.',
    'Повесить кормушку для птиц.',
    'Выучить с детьми новогоднее стихотворение.',
    'Сходить на каток или скатиться с горки.',
    'Заглянуть в шар-каток и побить свой рекорд.',
    'Купить мандарины. Много.',
    'Повесить на дверь венок или еловую ветку.',
    'Сфотографироваться всей семьёй у ёлки.',
    'Подписать подарки.',
    'Нарезать заранее всё, что можно нарезать заранее.',
    'Загадать желание под бой курантов.'
  ];
  var win = document.getElementById('windows'), note = document.getElementById('win-note'), seal = document.getElementById('adv-seal');
  if (win) {
    var now = new Date(), y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    var openUntil = 0;
    if (now.getMonth() === 11) openUntil = now.getDate();
    else if (now.getMonth() === 0) openUntil = 31;
    if (/[?&]advent=(\d+)/.test(location.search)) openUntil = +RegExp.$1;
    if (openUntil > 0 && seal) seal.hidden = true;
    var html = '';
    for (var dd = 1; dd <= 31; dd++) {
      var open = dd <= openUntil;
      html += '<li><button type="button" class="win' + (open ? ' is-open' : '') + (dd === openUntil && now.getMonth() === 11 ? ' is-today' : '') +
        '" data-d="' + dd + '" aria-label="' + dd + ' декабря' + (open ? ', открыто' : ', закрыто') + '">' + dd + '<small>декабря</small></button></li>';
    }
    win.innerHTML = html;
    win.addEventListener('click', function (e) {
      var b = e.target.closest('.win'); if (!b) return;
      var n = +b.getAttribute('data-d');
      if (n <= openUntil) note.innerHTML = '<b>' + n + ' декабря.</b> ' + TASKS[n - 1];
      else note.textContent = 'Это окошко откроется ' + n + ' декабря.';
    });
    if (openUntil > 0) note.innerHTML = '<b>' + Math.min(openUntil, 31) + ' декабря.</b> ' + TASKS[Math.min(openUntil, 31) - 1];
  }

  /* ---------- старый телевизор ---------- */
  var FILMS = [
    { t: 'Ирония судьбы, или С лёгким паром!', y: 1975, d: 'Эльдар Рязанов', s: 'Баня тридцать первого, самолёт в Ленинград и квартира, которая выглядит точь-в-точь как своя.', c: 'Под него режут салаты уже пятьдесят лет.', u: 'https://smotrim.ru/brand/5771' },
    { t: 'Карнавальная ночь', y: 1956, d: 'Эльдар Рязанов', s: 'Дом культуры готовит новогодний бал, а новый директор хочет вместо джаза лекцию.', c: 'Песня про пять минут и Гурченко в двадцать один год.', u: 'https://smotrim.ru/brand/5767' },
    { t: 'Морозко', y: 1964, d: 'Александр Роу', s: 'Настенька, хвастливый Иван и старик Мороз с посохом, который всё видит.', c: 'Сказка, которую родители смотрят вместе с детьми, а потом цитируют.', u: 'https://smotrim.ru/brand/5750' },
    { t: 'Двенадцать месяцев', y: 1972, d: 'Анатолий Граник', s: 'Юная королева требует подснежников в январе, а падчерица находит у костра двенадцать месяцев.', c: 'По пьесе Маршака: зимний лес и доброта, которая вознаграждается.', u: 'https://smotrim.ru/brand/8026' },
    { t: 'Вечера на хуторе близ Диканьки', y: 1961, d: 'Александр Роу', s: 'Кузнец Вакула, черевички царицы и чёрт, который украл месяц с неба.', c: 'Гоголь в сказочных декорациях, с колядками и снегом.', u: 'https://smotrim.ru/brand/8425' },
    { t: 'Чародеи', y: 1982, d: 'Константин Бромберг', s: 'НИИ волшебства под Новый год: волшебная палочка, заколдованная невеста и стена, сквозь которую можно пройти.', c: 'Песни из него знают наизусть даже те, кто не смотрел.', u: 'https://smotrim.ru/brand/7321' },
    { t: 'Служебный роман', y: 1977, d: 'Эльдар Рязанов', s: 'Строгая начальница, робкий Новосельцев и целое статистическое учреждение.', c: 'Тёплый фильм про людей, которые долго не решаются.', u: 'https://smotrim.ru/brand/6669' },
    { t: 'Любовь и голуби', y: 1984, d: 'Владимир Меньшов', s: 'Голуби на крыше, путёвка на юг и деревенская семья, которую невозможно не полюбить.', c: 'Каждую реплику Раисы Захаровны хочется записать.', u: 'https://smotrim.ru/brand/5959' },
    { t: 'Джентльмены удачи', y: 1971, d: 'Александр Серый', s: 'Заведующий детским садом как две капли воды похож на вора по кличке Доцент.', c: 'Смешно в любом возрасте, проверено поколениями.', u: 'https://smotrim.ru/brand/5768' },
    { t: 'Снегурочка', y: 1968, d: 'Павел Кадочников', s: 'Дочь Весны и Мороза приходит к людям и хочет узнать, что такое любовь.', c: 'Красивая и немного грустная сказка по Островскому.', u: 'https://smotrim.ru/brand/5749' },
    { t: 'Старый Новый год', y: 1980, d: 'Наум Ардашников, Олег Ефремов', s: 'Две семьи в новом доме отмечают старый Новый год: каждая по-своему.', c: 'Для тех, кому мало одного праздника.', u: 'https://cinema.mosfilm.ru/films/35401/', src: 'Мосфильм' }
  ];
  var card = document.getElementById('tv-card'), noise = document.getElementById('tv-noise'), knob = document.getElementById('tv-knob');
  if (card) {
    var ch = 0, nctx = noise.getContext('2d'), nt = 0;
    function render() {
      var f = FILMS[ch];
      card.innerHTML = '<p class="tv-ch">Канал ' + (ch + 1) + ' из ' + FILMS.length + '</p><h3>' + f.t + '</h3>' +
        '<p class="tv-meta">' + f.y + ', реж. ' + f.d + '</p><p class="tv-desc">' + f.s + '</p><p class="tv-cozy">' + f.c + '</p>' +
        '<a class="tv-watch" href="' + f.u + '" target="_blank" rel="noopener">Смотреть на «' + (f.src || 'Смотрим') + '»</a>';
      knob.querySelector('.knob-in').style.setProperty('--rot', (ch * 32) + 'deg');
    }
    function staticBurst(done) {
      if (reduce) { done(); return; }
      noise.width = 160; noise.height = 120; noise.classList.add('on');
      var start = performance.now();
      (function frame(t) {
        var img = nctx.createImageData(160, 120), dta = img.data;
        for (var q = 0; q < dta.length; q += 4) { var v = Math.random() * 255 | 0; dta[q] = dta[q + 1] = dta[q + 2] = v; dta[q + 3] = 255; }
        nctx.putImageData(img, 0, 0);
        if (t - start < 260) requestAnimationFrame(frame); else { done(); noise.classList.remove('on'); }
      })(start);
    }
    function go(dir) { ch = (ch + dir + FILMS.length) % FILMS.length; staticBurst(render); }
    knob.addEventListener('click', function () { go(1); });
    document.getElementById('tv-next').addEventListener('click', function () { go(1); });
    document.getElementById('tv-prev').addEventListener('click', function () { go(-1); });
    render();
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
