(function () {
  'use strict';

  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  var elD = document.getElementById('c-days');
  var elU = document.getElementById('c-days-unit');
  var elH = document.getElementById('c-h');
  var elM = document.getElementById('c-m');
  var elS = document.getElementById('c-s');
  var elL = document.getElementById('count-label');

  function tick() {
    var now = new Date();
    if (now.getMonth() === 0 && now.getDate() === 1) {
      elL.textContent = 'Новый год наступил';
      elD.textContent = '';
      elU.textContent = 'С Новым годом!';
      elH.textContent = elM.textContent = elS.textContent = '00';
      return;
    }
    var target = new Date(now.getFullYear() + 1, 0, 1, 0, 0, 0);
    var diff = Math.max(0, Math.floor((target - now) / 1000));
    var d = Math.floor(diff / 86400);
    var h = Math.floor((diff % 86400) / 3600);
    var m = Math.floor((diff % 3600) / 60);
    var s = diff % 60;
    elL.textContent = plural(d, 'до Нового года остался', 'до Нового года осталось', 'до Нового года осталось');
    elD.textContent = d;
    elU.textContent = plural(d, 'день', 'дня', 'дней');
    elH.textContent = pad(h);
    elM.textContent = pad(m);
    elS.textContent = pad(s);
  }
  if (elD) { tick(); setInterval(tick, 1000); }

  // ближайший пост
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var leaves = document.querySelectorAll('.leaf[data-date]');
  var next = null;
  for (var i = 0; i < leaves.length; i++) {
    var p = leaves[i].getAttribute('data-date').split('-');
    var dt = new Date(+p[0], +p[1] - 1, +p[2]);
    if (dt < today) leaves[i].classList.add('is-past');
    else if (!next) next = leaves[i];
  }
  if (next) {
    next.classList.add('is-next');
    var strip = document.getElementById('strip');
    if (strip && strip.scrollWidth > strip.clientWidth && next.offsetLeft > 40) {
      strip.scrollLeft = next.offsetLeft - 16;
    }
  }

  // ссылки соцсетей, которых пока нет
  var toast = document.getElementById('toast');
  var todo = document.querySelectorAll('[data-todo]');
  for (var j = 0; j < todo.length; j++) {
    todo[j].addEventListener('click', function (e) {
      e.preventDefault();
      if (toast) { toast.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { toast.hidden = true; }, 2600); }
    });
  }

  // шапка при прокрутке
  var top = document.querySelector('.top');
  function onScroll() { top.classList.toggle('is-solid', window.scrollY > 40); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
