/* Шары-игры. «Каток» — 3D в js/rink3d.js, «Железная дорога» — 3D в js/rail3d.js; здесь их 2D-запасные варианты. */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var store = window.ElkStore || function () { return null; };

  var portal = document.getElementById('portal'), title = document.getElementById('portal-title'), hud = document.getElementById('hud');
  var cv = document.getElementById('game'), ctx = cv.getContext('2d'), stage = document.getElementById('stage');
  var veil = document.getElementById('veil'), veilH = document.getElementById('veil-h'), veilP = document.getElementById('veil-p'), veilBtn = document.getElementById('veil-btn');
  var W = 0, H = 0, raf = 0, game = null, lastBtn = null, lastT = 0;

  function resize() {
    var r = stage.getBoundingClientRect();
    W = r.width; H = r.height;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (game && game.resize) game.resize();
  }
  function frame(t) {
    var dt = Math.min(48, t - (lastT || t)) / 16.67; lastT = t;
    if (game) { game.update(dt); game.draw(); }
    raf = requestAnimationFrame(frame);
  }
  function showVeil(h, p, btn, img) {
    veilH.textContent = h; veilP.innerHTML = p; veilBtn.textContent = btn || 'Начать';
    var old = veil.querySelector('.veil-card img'); if (old) old.remove();
    if (img) { var im = new Image(); im.src = img; im.alt = ''; veil.querySelector('.veil-card').insertBefore(im, veilH); }
    veilBtn.hidden = !btn;
    veil.hidden = false; if (btn) veilBtn.focus();
  }
  veilBtn.addEventListener('click', function () { veil.hidden = true; if (game) game.start(); cv.focus && cv.focus(); });

  function open(btn) {
    lastBtn = btn;
    var r = btn.querySelector('.glass').getBoundingClientRect();
    portal.style.setProperty('--cx', Math.max(0, Math.min(innerWidth, r.left + r.width / 2)) + 'px');
    portal.style.setProperty('--cy', Math.max(0, Math.min(innerHeight, r.top + r.height / 2)) + 'px');
    portal.hidden = false; document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { requestAnimationFrame(function () { portal.classList.add('open'); }); });
    resize();
    var id = btn.getAttribute('data-game');
    if (id === 'rink') game = Rink();
    else if (id === 'rail') game = Rail();
    else {
      game = Idle();
      title.textContent = btn.getAttribute('data-title') || btn.parentNode.querySelector('h3').textContent; hud.textContent = '';
      if (!btn.getAttribute('data-soon')) showVeil('Шар не открылся', 'Этому миру нужен браузер с поддержкой 3D. Попробуйте открыть сайт в свежем Chrome, Safari или Яндекс Браузере.', '', btn.querySelector('img').src);
      else showVeil('Откроется ' + btn.getAttribute('data-soon'), 'Этот шар ещё запечатан. Загляните сюда ' + btn.getAttribute('data-soon') + ', а пока погуляйте по катку, прокатитесь в поезде или загляните в дом Деда Мороза.', '', btn.querySelector('img').src);
    }
    game.resize && game.resize();
    lastT = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
    document.getElementById('portal-close').focus({ preventScroll: true });
  }
  function close() {
    portal.classList.remove('open');
    var done = function () { portal.hidden = true; cancelAnimationFrame(raf); game = null; document.body.style.overflow = ''; if (lastBtn) lastBtn.focus({ preventScroll: true }); };
    if (reduce) done(); else setTimeout(done, 650);
  }
  // 3D-шары (three.js): «Каток» — js/rink3d.js, «Железная дорога» — js/rail3d.js. Если WebGL/модули недоступны — прежняя 2D-игра.
  var MOD3D = { rink: './rink3d.js?v=20261109a', rail: './rail3d.js?v=20261107a', santa: './santa3d.js?v=20261107a', forest: './forest3d.js?v=20261107a' }, mods = {};
  function load3d(id) { id = id || 'rink'; if (!mods[id]) mods[id] = import(MOD3D[id]).catch(function (e) { mods[id] = null; throw e; }); return mods[id]; }
  function openGlobe(b) {
    var id = b.getAttribute('data-game');
    // шар с датой открытия: до неё запечатан (для проверки: ?open=1)
    var from = b.getAttribute('data-open-from');
    if (from && Date.now() < Date.parse(from) && !/[?&]open=1/.test(location.search)) { open(b); return; }
    if (MOD3D[id] && 'noModule' in HTMLScriptElement.prototype) {
      load3d(id).then(function (m) { return m.open(b); }).catch(function (e) { if (window.console) console.warn('3D недоступно, открываю 2D', e); ['rk', 'rl', 'sn', 'fr'].forEach(function (x) { var r = document.getElementById(x); if (r) r.remove(); }); document.body.style.overflow = ''; open(b); });
      return;
    }
    open(b);
  }
  document.querySelectorAll('.globe').forEach(function (b) { b.addEventListener('click', function () { if (b._snow) b._snow.shake(); openGlobe(b); }); });
  // заранее подгружаем three.js, когда полка с шарами показалась на экране
  var shelfEl = document.getElementById('shary');
  if (shelfEl && 'IntersectionObserver' in window) { var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); load3d('rink').catch(function () { }); } }, { rootMargin: '300px' }); io.observe(shelfEl); }
  document.getElementById('portal-close').addEventListener('click', close);
  document.addEventListener('keydown', function (e) {
    if (portal.hidden) return;
    if (e.key === 'Escape') close();
    if (game && game.key) game.key(e, true);
  });
  document.addEventListener('keyup', function (e) { if (!portal.hidden && game && game.key) game.key(e, false); });
  window.addEventListener('resize', function () { if (!portal.hidden) resize(); });
  if ('ResizeObserver' in window) new ResizeObserver(function () { if (!portal.hidden) resize(); }).observe(stage);

  // прямая ссылка на игру: #igra-katok, #igra-doroga (?demo=1 — сразу старт, для проверки)
  var LINKS = { '#igra-katok': 'rink', '#igra-doroga': 'rail', '#igra-ded-moroz': 'santa', '#igra-les': 'forest' };
  if (LINKS[location.hash]) {
    var gb = document.querySelector('.globe[data-game="' + LINKS[location.hash] + '"]');
    if (gb) setTimeout(function () { if (!/[?&]demo=1/.test(location.search)) { openGlobe(gb); return; } open(gb); if (/[?&]demo=1/.test(location.search)) { veil.hidden = true; game.start(); } }, 300);
  }

  /* общий падающий снег поверх игры */
  function Flakes(n) {
    var a = [];
    for (var i = 0; i < n; i++) a.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.8 + .6, v: .0008 + Math.random() * .0016, ph: Math.random() * 6 });
    return {
      step: function (dt) { a.forEach(function (f) { f.y += f.v * dt; f.ph += .02 * dt; if (f.y > 1.02) { f.y = -.02; f.x = Math.random(); } }); },
      draw: function () { ctx.fillStyle = '#fff'; a.forEach(function (f) { ctx.globalAlpha = .55; ctx.beginPath(); ctx.arc(f.x * W + Math.sin(f.ph) * 6, f.y * H, f.r, 0, 6.283); ctx.fill(); }); ctx.globalAlpha = 1; }
    };
  }
  function star(x, y, r, rot) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) { var rr = i % 2 ? r * .45 : r, a = rot + i * Math.PI / 5 - Math.PI / 2; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath();
  }
  function Idle() { var fl = Flakes(60); return { update: fl.step, draw: function () { var g = ctx.createRadialGradient(W / 2, H * .4, 10, W / 2, H / 2, Math.max(W, H)); g.addColorStop(0, '#1d3557'); g.addColorStop(1, '#070d18'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); fl.draw(); } }; }

  /* ================= КАТОК ================= */
  function Rink() {
    title.textContent = 'Каток';
    var best = +(store('elk-best-rink') || 0);
    var S = { run: false, time: 60, score: 0 }, p, stars = [], trail = [], sparks = [], keys = {}, ptr = null, fl = Flakes(70), lamps = [], trees = [], bg = null;
    var cx, cy, rx, ry;
    function layout() {
      cx = W / 2; cy = H / 2 + 6; rx = W * .43; ry = Math.min(H * .40, rx * .62);
      if (W < 600) { rx = W * .44; ry = H * .40; }
      lamps = []; trees = [];
      for (var i = 0; i < 10; i++) { var a = i / 10 * Math.PI * 2 + .3; lamps.push({ x: cx + Math.cos(a) * (rx + 26), y: cy + Math.sin(a) * (ry + 22) }); }
      var sd = 3; function r() { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; }
      for (var j = 0; j < 46; j++) {
        var x = r() * W, y = r() * H, dx = (x - cx) / (rx + 46), dy = (y - cy) / (ry + 46);
        if (dx * dx + dy * dy > 1) trees.push({ x: x, y: y, s: 14 + r() * 16 });
      }
      trees.sort(function (a, b) { return a.y - b.y; });
      bg = null;
    }
    function inside(x, y, m) { var dx = (x - cx) / (rx - m), dy = (y - cy) / (ry - m); return dx * dx + dy * dy <= 1; }
    function place() { var x, y, n = 0; do { x = cx + (Math.random() * 2 - 1) * rx; y = cy + (Math.random() * 2 - 1) * ry; n++; } while ((!inside(x, y, 30) || Math.hypot(x - p.x, y - p.y) < 90) && n < 60); return { x: x, y: y, rot: Math.random() * 6, big: false, life: 0 }; }
    function reset() {
      layout();
      p = { x: cx, y: cy, vx: 0, vy: 0, ang: 0 };
      S.time = 60; S.score = 0; trail = []; sparks = [];
      stars = [place(), place(), place()];
    }
    function drawBg() {
      // фон рисуем один раз в отдельный холст
      bg = document.createElement('canvas'); bg.width = cv.width; bg.height = cv.height;
      var b = bg.getContext('2d'); b.setTransform(DPR, 0, 0, DPR, 0, 0);
      var g = b.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#dfe7f0'); g.addColorStop(1, '#c4d2e2');
      b.fillStyle = g; b.fillRect(0, 0, W, H);
      // искры снега
      for (var i = 0; i < 260; i++) { b.fillStyle = 'rgba(255,255,255,' + (.4 + Math.random() * .6) + ')'; b.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5); }
      // бортик
      b.save(); b.beginPath(); b.ellipse(cx, cy, rx + 10, ry + 10, 0, 0, 6.283); b.fillStyle = '#8a5a32'; b.fill();
      b.beginPath(); b.ellipse(cx, cy, rx + 4, ry + 4, 0, 0, 6.283); b.fillStyle = '#f4f7fb'; b.fill();
      // лёд
      var ice = b.createRadialGradient(cx - rx * .3, cy - ry * .4, 10, cx, cy, rx);
      ice.addColorStop(0, '#f4fbff'); ice.addColorStop(.6, '#cfe4f2'); ice.addColorStop(1, '#a9c9df');
      b.beginPath(); b.ellipse(cx, cy, rx, ry, 0, 0, 6.283); b.fillStyle = ice; b.fill(); b.clip();
      // царапины на льду
      b.strokeStyle = 'rgba(255,255,255,.55)'; b.lineWidth = 1;
      for (var k = 0; k < 40; k++) { var a0 = Math.random() * 6.28, rr = Math.random() * .8; b.beginPath(); b.ellipse(cx, cy, rx * rr, ry * rr, 0, a0, a0 + .5 + Math.random()); b.stroke(); }
      // отражения фонарей
      lamps.forEach(function (l) { var gg = b.createRadialGradient(l.x + (cx - l.x) * .25, l.y + (cy - l.y) * .25, 0, l.x + (cx - l.x) * .25, l.y + (cy - l.y) * .25, 70); gg.addColorStop(0, 'rgba(255,214,140,.45)'); gg.addColorStop(1, 'rgba(255,214,140,0)'); b.fillStyle = gg; b.fillRect(0, 0, W, H); });
      // центральный круг
      b.strokeStyle = 'rgba(180,60,70,.35)'; b.lineWidth = 2; b.beginPath(); b.arc(cx, cy, Math.min(rx, ry) * .28, 0, 6.283); b.stroke();
      b.restore();
      // ёлки вокруг
      trees.forEach(function (t) { tree(b, t.x, t.y, t.s); });
    }
    function tree(b, x, y, s) {
      b.fillStyle = 'rgba(30,50,70,.18)'; b.beginPath(); b.ellipse(x + s * .2, y + 2, s * .55, s * .18, 0, 0, 6.283); b.fill();
      for (var i = 0; i < 3; i++) {
        var ty = y - s * (.35 + i * .45), w = s * (.62 - i * .14);
        b.fillStyle = i % 2 ? '#1d5a48' : '#164a3b';
        b.beginPath(); b.moveTo(x, ty - s * .55); b.lineTo(x + w, ty + s * .2); b.lineTo(x - w, ty + s * .2); b.closePath(); b.fill();
        b.fillStyle = 'rgba(255,255,255,.85)'; b.beginPath(); b.moveTo(x, ty - s * .55); b.lineTo(x + w * .45, ty - s * .12); b.lineTo(x - w * .35, ty - s * .18); b.closePath(); b.fill();
      }
      b.fillStyle = '#5a3a1e'; b.fillRect(x - 2, y - s * .2, 4, s * .22);
    }
    function lamp(l, t) {
      var gl = ctx.createRadialGradient(l.x, l.y - 18, 0, l.x, l.y - 18, 36);
      gl.addColorStop(0, 'rgba(255,220,150,' + (.55 + .1 * Math.sin(t / 400 + l.x)) + ')'); gl.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(l.x, l.y - 18, 36, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#2a2a2a'; ctx.fillRect(l.x - 1.5, l.y - 16, 3, 18);
      ctx.fillStyle = '#ffe2a0'; ctx.beginPath(); ctx.arc(l.x, l.y - 19, 5, 0, 6.283); ctx.fill();
    }
    function skater() {
      var sp = Math.hypot(p.vx, p.vy);
      if (sp > .3) p.ang = Math.atan2(p.vy, p.vx);
      ctx.save(); ctx.translate(p.x, p.y);
      ctx.fillStyle = 'rgba(40,60,90,.25)'; ctx.beginPath(); ctx.ellipse(3, 4, 15, 11, 0, 0, 6.283); ctx.fill();
      // шарф развевается позади
      ctx.rotate(p.ang + Math.PI);
      var wave = Math.sin(performance.now() / 120) * 3;
      ctx.strokeStyle = '#c53b46'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(6, 0); ctx.quadraticCurveTo(16, wave, 22 + Math.min(10, sp * 3), -wave); ctx.stroke();
      ctx.strokeStyle = '#f3e6d0'; ctx.lineWidth = 2; ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.quadraticCurveTo(16, wave, 22 + Math.min(10, sp * 3), -wave); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
      ctx.save(); ctx.translate(p.x, p.y);
      // плечи-пальто
      ctx.rotate(p.ang);
      ctx.fillStyle = '#1f4f7a'; ctx.beginPath(); ctx.ellipse(0, 0, 9, 14, 0, 0, 6.283); ctx.fill();
      ctx.rotate(-p.ang);
      // вязаная шапка сверху
      var g = ctx.createRadialGradient(-3, -3, 1, 0, 0, 10); g.addColorStop(0, '#e2525d'); g.addColorStop(1, '#9e2a35');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 9.5, 0, 6.283); ctx.fill();
      ctx.strokeStyle = 'rgba(255,240,230,.75)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, 6.283); ctx.stroke();
      ctx.fillStyle = '#fbf6ef'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 6.283); ctx.fill();
      ctx.restore();
    }
    var api = {
      resize: function () { layout(); if (!S.run && p) { p.x = cx; p.y = cy; } },
      start: function () { reset(); S.run = true; },
      key: function (e, down) { var k = e.key.toLowerCase(); if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's', 'ф', 'в', 'ц', 'ы'].indexOf(k) >= 0) { keys[k] = down; e.preventDefault(); } },
      update: function (dt) {
        fl.step(dt);
        if (!S.run) return;
        S.time -= dt / 60;
        var ax = 0, ay = 0, acc = .32;
        if (keys.arrowleft || keys.a || keys['ф']) ax -= acc; if (keys.arrowright || keys.d || keys['в']) ax += acc;
        if (keys.arrowup || keys.w || keys['ц']) ay -= acc; if (keys.arrowdown || keys.s || keys['ы']) ay += acc;
        if (ptr) { var dx = ptr.x - p.x, dy = ptr.y - p.y, d = Math.hypot(dx, dy); if (d > 8) { ax += dx / d * acc * Math.min(1, d / 80); ay += dy / d * acc * Math.min(1, d / 80); } }
        p.vx = (p.vx + ax * dt) * Math.pow(.985, dt); p.vy = (p.vy + ay * dt) * Math.pow(.985, dt);
        var sp = Math.hypot(p.vx, p.vy), max = 7; if (sp > max) { p.vx *= max / sp; p.vy *= max / sp; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        // отскок от бортика
        var ex = (p.x - cx) / (rx - 12), ey = (p.y - cy) / (ry - 12), e2 = ex * ex + ey * ey;
        if (e2 > 1) {
          var k = 1 / Math.sqrt(e2); p.x = cx + (p.x - cx) * k; p.y = cy + (p.y - cy) * k;
          var nx = (p.x - cx) / ((rx - 12) * (rx - 12)), ny = (p.y - cy) / ((ry - 12) * (ry - 12)), nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
          var dot = p.vx * nx + p.vy * ny; if (dot > 0) { p.vx = (p.vx - 2 * dot * nx) * .6; p.vy = (p.vy - 2 * dot * ny) * .6; }
        }
        if (sp > .5) { trail.push({ x: p.x, y: p.y, a: p.ang, life: 1 }); if (trail.length > 140) trail.shift(); }
        trail.forEach(function (t) { t.life -= .006 * dt; });
        stars.forEach(function (s, i) {
          s.rot += .02 * dt; s.life += dt;
          if (s.big && s.life > 300) stars[i] = place();
          if (Math.hypot(s.x - p.x, s.y - p.y) < (s.big ? 30 : 24)) {
            S.score += s.big ? 3 : 1;
            for (var q = 0; q < 14; q++) { var a = Math.random() * 6.28, v = 1 + Math.random() * 2.5; sparks.push({ x: s.x, y: s.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1 }); }
            stars[i] = place(); if (Math.random() < .18) { stars[i].big = true; }
          }
        });
        sparks.forEach(function (s) { s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= .94; s.vy *= .94; s.life -= .03 * dt; });
        sparks = sparks.filter(function (s) { return s.life > 0; });
        if (S.time <= 0) {
          S.run = false; S.time = 0;
          var rec = S.score > best; if (rec) { best = S.score; store('elk-best-rink', String(best)); }
          showVeil(rec ? 'Новый рекорд!' : 'Время вышло', 'Собрано звёзд: <b>' + S.score + '</b>. Лучший результат: ' + best + '.', 'Ещё раз');
        }
        hud.textContent = 'Звёзды: ' + S.score + ' · ' + Math.ceil(S.time) + ' с · рекорд ' + best;
      },
      draw: function () {
        if (!bg || bg.width !== cv.width) drawBg();
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(bg, 0, 0); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        var t = performance.now();
        // следы коньков
        ctx.lineCap = 'round';
        for (var i = 1; i < trail.length; i++) {
          var a = trail[i - 1], b = trail[i]; if (b.life <= 0 || Math.hypot(a.x - b.x, a.y - b.y) > 20) continue;
          ctx.strokeStyle = 'rgba(255,255,255,' + (b.life * .8) + ')'; ctx.lineWidth = 1.4;
          var ox = Math.cos(b.a + Math.PI / 2) * 4, oy = Math.sin(b.a + Math.PI / 2) * 4;
          ctx.beginPath(); ctx.moveTo(a.x + ox, a.y + oy); ctx.lineTo(b.x + ox, b.y + oy); ctx.moveTo(a.x - ox, a.y - oy); ctx.lineTo(b.x - ox, b.y - oy); ctx.stroke();
        }
        // звёзды
        stars.forEach(function (s) {
          var r = s.big ? 17 : 11, pulse = 1 + .08 * Math.sin(t / 200 + s.x);
          var g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 2.4); g.addColorStop(0, 'rgba(255,220,130,.6)'); g.addColorStop(1, 'rgba(255,220,130,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, r * 2.4, 0, 6.283); ctx.fill();
          star(s.x, s.y, r * pulse, s.rot); var sg = ctx.createLinearGradient(s.x, s.y - r, s.x, s.y + r); sg.addColorStop(0, '#fff1c4'); sg.addColorStop(1, s.big ? '#e08a2e' : '#d4a548');
          ctx.fillStyle = sg; ctx.fill(); ctx.strokeStyle = 'rgba(140,90,20,.5)'; ctx.lineWidth = 1; ctx.stroke();
        });
        sparks.forEach(function (s) { ctx.globalAlpha = s.life; ctx.fillStyle = '#ffe3a0'; ctx.beginPath(); ctx.arc(s.x, s.y, 2.2, 0, 6.283); ctx.fill(); }); ctx.globalAlpha = 1;
        if (p) skater();
        lamps.forEach(function (l) { lamp(l, t); });
        // лёгкая виньетка
        var v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .4, W / 2, H / 2, Math.max(W, H) * .75); v.addColorStop(0, 'rgba(10,20,36,0)'); v.addColorStop(1, 'rgba(10,20,36,.45)');
        ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
        fl.draw();
      }
    };
    function pos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    cv.onpointerdown = function (e) { ptr = pos(e); cv.setPointerCapture && cv.setPointerCapture(e.pointerId); };
    cv.onpointermove = function (e) { if (ptr || e.pointerType === 'mouse') ptr = pos(e); };
    cv.onpointerup = cv.onpointercancel = function (e) { if (e.pointerType !== 'mouse') ptr = null; };
    cv.onpointerleave = function () { ptr = null; };
    layout(); p = { x: cx, y: cy, vx: 0, vy: 0, ang: -Math.PI / 2 };
    showVeil('Звёздный каток', 'Ведите фигуриста мышкой, пальцем или стрелками и собирайте звёзды. Лёд скользкий: тормозить заранее. Большая звезда даёт три очка, но долго не ждёт. На всё одна минута.', 'Начать');
    hud.textContent = 'рекорд ' + best;
    return api;
  }

  /* ================= ЖЕЛЕЗНАЯ ДОРОГА ================= */
  function Rail() {
    title.textContent = 'Железная дорога';
    var best = +(store('elk-best-rail') || 0);
    var HOUSES = [
      { c: '#d2484f', name: 'красный', shape: 'heart' },
      { c: '#e0a93b', name: 'золотой', shape: 'star' },
      { c: '#3f9a6b', name: 'зелёный', shape: 'tree' },
      { c: '#4f86d9', name: 'синий', shape: 'drop' }
    ];
    // узлы в долях экрана
    var N = { S: [.05, .5], A: [.3, .5], B: [.58, .27], C: [.58, .73], H0: [.9, .12], H1: [.9, .4], H2: [.9, .6], H3: [.9, .88] };
    var SW = { A: ['B', 'C'], B: ['H0', 'H1'], C: ['H2', 'H3'] };
    var state = { A: 0, B: 0, C: 0 };
    var segs = {}, S = { run: false, score: 0, lives: 3, speed: 1.4, gap: 0 }, trains = [], puffs = [], fl = Flakes(50), pops = [], bg = null, trees = [];
    function P(k) { return { x: N[k][0] * W, y: N[k][1] * H }; }
    function build() {
      if (W < 600) { N.S = [.06, .5]; N.A = [.28, .5]; N.B = [.56, .29]; N.C = [.56, .71]; N.H0 = [.8, .13]; N.H1 = [.8, .39]; N.H2 = [.8, .61]; N.H3 = [.8, .87]; }
      segs = {};
      function seg(a, b) {
        var p0 = P(a), p1 = P(b), dx = (p1.x - p0.x) / 2, pts = [], len = 0, prev = p0;
        for (var i = 0; i <= 60; i++) {
          var t = i / 60, u = 1 - t;
          var x = u * u * u * p0.x + 3 * u * u * t * (p0.x + dx) + 3 * u * t * t * (p1.x - dx) + t * t * t * p1.x;
          var y = u * u * u * p0.y + 3 * u * u * t * p0.y + 3 * u * t * t * p1.y + t * t * t * p1.y;
          len += Math.hypot(x - prev.x, y - prev.y); prev = { x: x, y: y }; pts.push({ x: x, y: y, l: len });
        }
        segs[a + b] = { a: a, b: b, pts: pts, len: len };
      }
      seg('S', 'A'); seg('A', 'B'); seg('A', 'C'); seg('B', 'H0'); seg('B', 'H1'); seg('C', 'H2'); seg('C', 'H3');
      var sd = 11; function r() { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; }
      trees = [];
      for (var j = 0; j < 40; j++) {
        var x = r() * W, y = r() * H, ok = true;
        for (var k in segs) { segs[k].pts.forEach(function (q) { if (Math.hypot(q.x - x, q.y - y) < 34) ok = false; }); }
        ['H0', 'H1', 'H2', 'H3', 'S'].forEach(function (h) { var q = P(h); if (Math.hypot(q.x - x, q.y - y) < 70) ok = false; });
        if (ok) trees.push({ x: x, y: y, s: 12 + r() * 14 });
      }
      trees.sort(function (a, b) { return a.y - b.y; });
      bg = null;
    }
    function at(seg, d) {
      var pts = seg.pts; if (d <= 0) return { x: pts[0].x, y: pts[0].y, a: Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) };
      for (var i = 1; i < pts.length; i++) if (pts[i].l >= d) { var p0 = pts[i - 1], p1 = pts[i], t = (d - p0.l) / (p1.l - p0.l || 1); return { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t, a: Math.atan2(p1.y - p0.y, p1.x - p0.x) }; }
      var l = pts[pts.length - 1], m = pts[pts.length - 2]; return { x: l.x, y: l.y, a: Math.atan2(l.y - m.y, l.x - m.x) };
    }
    function spawn() { trains.push({ seg: segs.SA, d: 0, gift: Math.floor(Math.random() * 4), done: false }); }
    function shape(c, kind, x, y, s) {
      c.beginPath();
      if (kind === 'heart') { c.moveTo(x, y + s * .7); c.bezierCurveTo(x - s * 1.2, y - s * .1, x - s * .5, y - s, x, y - s * .35); c.bezierCurveTo(x + s * .5, y - s, x + s * 1.2, y - s * .1, x, y + s * .7); }
      else if (kind === 'star') { for (var i = 0; i < 10; i++) { var rr = i % 2 ? s * .45 : s, a = i * Math.PI / 5 - Math.PI / 2; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } }
      else if (kind === 'tree') { c.moveTo(x, y - s); c.lineTo(x + s * .8, y + s * .7); c.lineTo(x - s * .8, y + s * .7); }
      else { c.moveTo(x, y - s); c.quadraticCurveTo(x + s, y + s * .2, x, y + s * .8); c.quadraticCurveTo(x - s, y + s * .2, x, y - s); }
      c.closePath();
    }
    function drawBg() {
      bg = document.createElement('canvas'); bg.width = cv.width; bg.height = cv.height;
      var b = bg.getContext('2d'); b.setTransform(DPR, 0, 0, DPR, 0, 0);
      var g = b.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#e6edf5'); g.addColorStop(1, '#c9d6e6'); b.fillStyle = g; b.fillRect(0, 0, W, H);
      for (var i = 0; i < 300; i++) { b.fillStyle = 'rgba(255,255,255,' + (.5 + Math.random() * .5) + ')'; b.fillRect(Math.random() * W, Math.random() * H, 1.6, 1.6); }
      // насыпь и шпалы
      for (var k in segs) {
        var s = segs[k];
        b.strokeStyle = 'rgba(120,130,150,.25)'; b.lineWidth = 22; b.lineCap = 'round'; b.beginPath(); s.pts.forEach(function (q, i) { i ? b.lineTo(q.x, q.y) : b.moveTo(q.x, q.y); }); b.stroke();
        for (var d = 6; d < s.len; d += 11) { var q = at(s, d); b.save(); b.translate(q.x, q.y); b.rotate(q.a); b.fillStyle = '#6b4a2e'; b.fillRect(-2, -9, 4, 18); b.restore(); }
      }
      // деревья
      trees.forEach(function (t) {
        b.fillStyle = 'rgba(30,50,70,.18)'; b.beginPath(); b.ellipse(t.x + 4, t.y + 2, t.s * .6, t.s * .2, 0, 0, 6.283); b.fill();
        for (var i = 0; i < 3; i++) { var ty = t.y - t.s * (.35 + i * .45), w = t.s * (.62 - i * .14); b.fillStyle = i % 2 ? '#1d5a48' : '#164a3b'; b.beginPath(); b.moveTo(t.x, ty - t.s * .55); b.lineTo(t.x + w, ty + t.s * .2); b.lineTo(t.x - w, ty + t.s * .2); b.closePath(); b.fill(); b.fillStyle = 'rgba(255,255,255,.85)'; b.beginPath(); b.moveTo(t.x, ty - t.s * .55); b.lineTo(t.x + w * .45, ty - t.s * .12); b.lineTo(t.x - w * .35, ty - t.s * .18); b.closePath(); b.fill(); }
      });
      // вокзал
      var st = P('S'); b.fillStyle = '#7a4a26'; b.fillRect(st.x - 22, st.y - 46, 44, 30); b.fillStyle = '#f4f7fb'; b.beginPath(); b.moveTo(st.x - 28, st.y - 44); b.lineTo(st.x, st.y - 64); b.lineTo(st.x + 28, st.y - 44); b.closePath(); b.fill();
      b.fillStyle = '#fff0d2'; b.fillRect(st.x - 14, st.y - 38, 9, 10); b.fillRect(st.x + 5, st.y - 38, 9, 10);
    }
    function rails() {
      for (var k in segs) {
        var s = segs[k], live = isLive(s);
        ctx.strokeStyle = live ? '#4a4f5a' : 'rgba(74,79,90,.35)'; ctx.lineWidth = 2.2;
        [-5, 5].forEach(function (o) { ctx.beginPath(); s.pts.forEach(function (q, i) { var a = i ? Math.atan2(q.y - s.pts[i - 1].y, q.x - s.pts[i - 1].x) : Math.atan2(s.pts[1].y - q.y, s.pts[1].x - q.x); var x = q.x + Math.cos(a + Math.PI / 2) * o, y = q.y + Math.sin(a + Math.PI / 2) * o; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); });
      }
    }
    function isLive(s) { if (s.a === 'S') return true; if (SW[s.a]) return SW[s.a][state[s.a]] === s.b && (s.a === 'A' || isLive(segs['A' + s.a])); return false; }
    function house(i, t) {
      var h = HOUSES[i], q = P('H' + i), x = q.x + (W < 600 ? 22 : 30), y = q.y + 6, w = 50, hh = 34;
      var glow = ctx.createRadialGradient(x, y - 10, 0, x, y - 10, 70); glow.addColorStop(0, h.c + '55'); glow.addColorStop(1, h.c + '00'); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y - 10, 70, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(30,50,70,.2)'; ctx.beginPath(); ctx.ellipse(x + 4, y + 2, w * .65, 8, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#8a5a32'; ctx.fillRect(x - w / 2, y - hh, w, hh);
      ctx.fillStyle = '#6b4224'; for (var r = 0; r < 4; r++) ctx.fillRect(x - w / 2, y - hh + r * 8.5, w, 1.2);
      ctx.fillStyle = '#fbfdff'; ctx.beginPath(); ctx.moveTo(x - w / 2 - 8, y - hh + 2); ctx.lineTo(x, y - hh - 26); ctx.lineTo(x + w / 2 + 8, y - hh + 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5a3a1e'; ctx.fillRect(x + 10, y - hh - 22, 7, 14);
      var flick = .85 + .15 * Math.sin(t / 300 + i);
      ctx.fillStyle = 'rgba(255,214,140,' + flick + ')'; ctx.fillRect(x - 17, y - hh + 9, 11, 11); ctx.fillRect(x + 6, y - hh + 9, 11, 11);
      ctx.fillStyle = h.c; ctx.fillRect(x - 4, y - 14, 8, 14);
      // флажок с формой — подсказка для тех, кто плохо различает цвета
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - w / 2 - 14, y); ctx.lineTo(x - w / 2 - 14, y - 44); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - w / 2 - 14, y - 50, 11, 0, 6.283); ctx.fill(); ctx.strokeStyle = h.c; ctx.lineWidth = 2; ctx.stroke();
      shape(ctx, h.shape, x - w / 2 - 14, y - 50, 6.5); ctx.fillStyle = h.c; ctx.fill();
    }
    function sw(k) {
      var q = P(k), up = state[k] === 0;
      ctx.fillStyle = 'rgba(10,20,36,.82)'; ctx.beginPath(); ctx.arc(q.x, q.y, 20, 0, 6.283); ctx.fill();
      ctx.strokeStyle = '#e9dfc8'; ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(up ? -.6 : .6);
      ctx.strokeStyle = '#f5ecd8'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(9, 0); ctx.moveTo(4, -5); ctx.lineTo(9, 0); ctx.lineTo(4, 5); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#5b5346'; ctx.font = '600 12px Golos Text, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText({ A: '1', B: '2', C: '3' }[k], q.x, q.y + 36);
    }
    function train(tr) {
      var cars = [{ off: 0, loco: true }, { off: -34, loco: false }];
      cars.forEach(function (c) {
        var d = tr.d + c.off, seg = tr.seg;
        if (d < 0 && tr.prev) { seg = tr.prev; d = seg.len + d; }
        var q = at(seg, d);
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.a);
        ctx.fillStyle = 'rgba(20,30,50,.25)'; ctx.fillRect(-14, -9, 30, 20);
        if (c.loco) {
          ctx.fillStyle = '#9e2a35'; roundRect(-14, -9, 28, 18, 4); ctx.fill();
          ctx.fillStyle = '#2b2f38'; roundRect(-14, -9, 11, 18, 3); ctx.fill();
          ctx.fillStyle = '#e9dfc8'; ctx.fillRect(-2, -9, 2, 18);
          ctx.fillStyle = '#2b2f38'; ctx.beginPath(); ctx.arc(7, 0, 4, 0, 6.283); ctx.fill();
          var lg = ctx.createRadialGradient(18, 0, 0, 18, 0, 40); lg.addColorStop(0, 'rgba(255,230,160,.7)'); lg.addColorStop(1, 'rgba(255,230,160,0)');
          ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(54, -16); ctx.lineTo(54, 16); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(14, 0, 2.5, 0, 6.283); ctx.fill();
        } else {
          ctx.fillStyle = '#3a4250'; roundRect(-13, -8, 26, 16, 3); ctx.fill();
          var h = HOUSES[tr.gift];
          ctx.fillStyle = h.c; roundRect(-8, -7, 16, 14, 2); ctx.fill();
          ctx.fillStyle = '#fff6df'; ctx.fillRect(-1.2, -7, 2.4, 14); ctx.fillRect(-8, -1.2, 16, 2.4);
          ctx.rotate(-q.a); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -20, 9, 0, 6.283); ctx.fill(); ctx.strokeStyle = h.c; ctx.lineWidth = 2; ctx.stroke();
          shape(ctx, h.shape, 0, -20, 5.5); ctx.fillStyle = h.c; ctx.fill();
        }
        ctx.restore();
        if (c.loco && Math.random() < .25) puffs.push({ x: q.x + Math.cos(q.a) * 7, y: q.y + Math.sin(q.a) * 7, r: 3, life: 1 });
      });
    }
    function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function toggle(k) { state[k] = 1 - state[k]; }
    function nearest(x, y) { var best = null, bd = 44; ['A', 'B', 'C'].forEach(function (k) { var q = P(k), d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; best = k; } }); return best; }
    cv.onpointerdown = function (e) { var r = cv.getBoundingClientRect(), k = nearest(e.clientX - r.left, e.clientY - r.top); if (k) toggle(k); };
    cv.onpointermove = function (e) { var r = cv.getBoundingClientRect(); cv.style.cursor = nearest(e.clientX - r.left, e.clientY - r.top) ? 'pointer' : 'default'; };
    cv.onpointerup = cv.onpointercancel = cv.onpointerleave = null;
    var api = {
      resize: build,
      start: function () { S.run = true; S.score = 0; S.lives = 3; S.speed = 1.3; S.gap = 0; trains = []; pops = []; spawn(); },
      key: function (e, down) { if (!down) return; if (e.key === '1') toggle('A'); if (e.key === '2') toggle('B'); if (e.key === '3') toggle('C'); },
      update: function (dt) {
        fl.step(dt);
        puffs.forEach(function (p) { p.r += .25 * dt; p.y -= .3 * dt; p.life -= .02 * dt; }); puffs = puffs.filter(function (p) { return p.life > 0; });
        pops.forEach(function (p) { p.y -= .4 * dt; p.life -= .012 * dt; }); pops = pops.filter(function (p) { return p.life > 0; });
        if (!S.run) return;
        trains.forEach(function (tr) {
          tr.d += S.speed * dt;
          if (tr.d >= tr.seg.len) {
            var end = tr.seg.b;
            if (SW[end]) { var nx = SW[end][state[end]]; tr.prev = tr.seg; tr.d -= tr.seg.len; tr.seg = segs[end + nx]; }
            else if (!tr.done) {
              tr.done = true; var hi = +end.slice(1), q = P(end);
              if (hi === tr.gift) { S.score++; pops.push({ x: q.x, y: q.y - 60, t: '+1', ok: true, life: 1 }); if (S.score % 4 === 0) S.speed += .25; }
              else { S.lives--; pops.push({ x: q.x, y: q.y - 60, t: 'не тот дом', ok: false, life: 1 }); }
            }
          }
        });
        trains = trains.filter(function (tr) { return !tr.done; });
        S.gap += dt;
        var need = trains.length === 0 || (S.score >= 6 && trains.length < 2 && trains[0].d > 0 && trains[0].seg !== segs.SA && S.gap > 200);
        if (need) { spawn(); S.gap = 0; }
        if (S.lives <= 0) {
          S.run = false; trains = [];
          var rec = S.score > best; if (rec) { best = S.score; store('elk-best-rail', String(best)); }
          showVeil(rec ? 'Новый рекорд!' : 'Подарки ждут', 'Доставлено подарков: <b>' + S.score + '</b>. Лучший результат: ' + best + '.', 'Ещё раз');
        }
        hud.textContent = 'Доставлено: ' + S.score + ' · ' + '♥'.repeat(Math.max(0, S.lives)) + ' · рекорд ' + best;
      },
      draw: function () {
        if (!bg || bg.width !== cv.width) drawBg();
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(bg, 0, 0); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        var t = performance.now();
        rails();
        for (var i = 0; i < 4; i++) house(i, t);
        puffs.forEach(function (p) { ctx.globalAlpha = p.life * .6; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill(); }); ctx.globalAlpha = 1;
        trains.forEach(train);
        ['A', 'B', 'C'].forEach(sw);
        pops.forEach(function (p) { ctx.globalAlpha = p.life; ctx.font = '600 18px Golos Text, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = p.ok ? '#1f6b4f' : '#9e2a35'; ctx.fillText(p.t, p.x, p.y); }); ctx.globalAlpha = 1;
        var v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .45, W / 2, H / 2, Math.max(W, H) * .8); v.addColorStop(0, 'rgba(10,20,36,0)'); v.addColorStop(1, 'rgba(10,20,36,.4)');
        ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
        fl.draw();
      }
    };
    build();
    showVeil('Довези подарки', 'На вагоне подарок с цветом и значком дома. Нажимайте на кружки-стрелки (или клавиши 1, 2, 3), чтобы поезд свернул куда надо. Три ошибки — и игра окончена.', 'Поехали');
    hud.textContent = 'рекорд ' + best;
    return api;
  }
})();
