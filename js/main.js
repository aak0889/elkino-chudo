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
  function GlobeSnow(cv, opts) {
    opts = opts || {};
    var ctx = cv.getContext('2d'), S, flakes = [], energy = opts.energy || 0.6;
    function seed() {
      S = fit(cv); flakes = [];
      var n = opts.count || 70;
      for (var k = 0; k < n; k++) flakes.push(newFlake(true));
    }
    function newFlake(any) {
      return { a: Math.random() * 6.283, rad: Math.random(), y: any ? Math.random() : -0.05, r: (Math.random() * 1.6 + 0.6) * DPR * (opts.scale || 1), sp: 0.4 + Math.random() * 0.8, fall: 0.0006 + Math.random() * 0.001 };
    }
    function draw(dt) {
      ctx.clearRect(0, 0, S.w, S.h);
      var cx = S.w / 2;
      energy += ((opts.base || 0.25) - energy) * 0.004 * dt;
      for (var k = 0; k < flakes.length; k++) {
        var f = flakes[k];
        f.a += 0.012 * f.sp * energy * dt * 2.2;
        f.y += (f.fall * (1.2 - energy) - 0.0012 * energy * Math.sin(f.a * 1.7)) * dt;
        if (f.y > 1.02) { flakes[k] = newFlake(false); continue; }
        if (f.y < -0.06) f.y = 1;
        var x = cx + Math.cos(f.a) * f.rad * S.w * 0.46;
        var y = f.y * S.h + Math.sin(f.a * 2) * 6 * DPR * energy;
        var depth = 0.55 + 0.45 * Math.sin(f.a);
        ctx.globalAlpha = 0.45 + 0.5 * depth;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(x, y, f.r * (0.7 + 0.5 * depth), 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    seed();
    var l = loop(draw);
    window.addEventListener('resize', seed);
    if (reduce) draw(0); else whenVisible(cv, l.start, l.stop);
    return { shake: function () { energy = 1.6; for (var k = 0; k < flakes.length; k++) flakes[k].y = 0.55 + Math.random() * 0.45; if (reduce) draw(0); } };
  }
  var hs = document.getElementById('hero-snow');
  if (hs) {
    var heroSnow = GlobeSnow(hs, { count: 110, base: 0.35, energy: 0.9 });
    document.getElementById('hero-shake').addEventListener('click', function () { heroSnow.shake(); });
  }
  var globes = document.querySelectorAll('.globe');
  window.ElkGlobes = [];
  for (var g = 0; g < globes.length; g++) {
    (function (btn) {
      var gs = GlobeSnow(btn.querySelector('canvas'), { count: 46, base: 0.3, energy: 0.5, scale: 0.9 });
      btn.addEventListener('pointerenter', function () { gs.shake(); });
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
    { t: 'Старый Новый год', y: 1980, d: 'Наум Ардашников, Олег Ефремов', s: 'Две семьи в новом доме отмечают старый Новый год: каждая по-своему.', c: 'Для тех, кому мало одного праздника.', u: 'https://smotrim.ru/brand/7344' }
  ];
  var card = document.getElementById('tv-card'), noise = document.getElementById('tv-noise'), knob = document.getElementById('tv-knob');
  if (card) {
    var ch = 0, nctx = noise.getContext('2d'), nt = 0;
    function render() {
      var f = FILMS[ch];
      card.innerHTML = '<p class="tv-ch">Канал ' + (ch + 1) + ' из ' + FILMS.length + '</p><h3>' + f.t + '</h3>' +
        '<p class="tv-meta">' + f.y + ', реж. ' + f.d + '</p><p class="tv-desc">' + f.s + '</p><p class="tv-cozy">' + f.c + '</p>' +
        '<a class="tv-watch" href="' + f.u + '" target="_blank" rel="noopener">Смотреть на «Смотрим»</a>';
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
})();
