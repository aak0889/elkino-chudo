/* Лента «Каждый день»: прошедшие дни открываются целым постом из канала (данные — js/days-data.js). */
(function () {
  var D = window.ELK_DAYS || {}, strip = document.getElementById('strip');
  if (!strip) return;
  var t = new Date(), today = t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2);
  var leaves = strip.querySelectorAll('.leaf[data-date]');
  for (var i = 0; i < leaves.length; i++) {
    var lf = leaves[i], k = lf.getAttribute('data-date');
    if (!D[k] || k > today) continue;
    lf.classList.add('is-open');
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'leaf-open'; b.setAttribute('data-k', k);
    b.innerHTML = '<span>Читать пост</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    b.setAttribute('aria-label', 'Читать пост за ' + D[k].date + ': ' + D[k].h);
    lf.querySelector('.leaf-body').appendChild(b);
  }

  var dlg = document.createElement('dialog');
  dlg.className = 'day-dlg'; dlg.setAttribute('aria-labelledby', 'day-dlg-h');
  document.body.appendChild(dlg);
  var last = null;
  function close() { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }
  function open(k, from) {
    var p = D[k]; last = from;
    dlg.innerHTML = '<button type="button" class="dlg-x" aria-label="Закрыть">×</button>' +
      '<img class="day-img" src="' + p.img + '" alt="' + p.alt + '" width="720" height="900">' +
      '<div class="day-txt"><p class="day-top"><b>' + p.n + '</b> ' + plural(p.n) + ' до Нового года · ' + p.date + '</p>' +
      '<h3 id="day-dlg-h">' + p.h + '</h3>' + p.body +
      '<p class="day-more"><a class="day-tg" href="https://t.me/elkinochudo" target="_blank" rel="noopener">Обсудить в канале</a></p></div>';
    if (dlg.showModal) { try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); } } else dlg.setAttribute('open', '');
    dlg.scrollTop = 0;
  }
  function plural(n) { var a = n % 100, b = n % 10; return a > 10 && a < 20 ? 'дней' : b === 1 ? 'день' : b > 1 && b < 5 ? 'дня' : 'дней'; }
  strip.addEventListener('click', function (e) {
    var lf = e.target.closest('.leaf.is-open'); if (!lf) return;
    open(lf.getAttribute('data-date'), lf.querySelector('.leaf-open'));
  });
  dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.closest('.dlg-x')) close(); });
  dlg.addEventListener('close', function () { if (last) last.focus({ preventScroll: true }); });
})();
