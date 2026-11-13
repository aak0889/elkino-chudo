/* «Куда пойти»: сортировщик в три шага, маршруты, «Мой день», погода. Без серверной части. */
(function(){
'use strict';
var P=window.KUDA_PLACES||[],R=window.KUDA_ROUTES||[];
var $=function(s,r){return (r||document).querySelector(s)},$$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var WHO=[['k','С детьми','Парки, музеи, ёлки'],['pair','Парой','Вдвоём и не скучно'],['crew','Компанией','Игры, катки, бары'],['solo','Один / одна','Для себя']];
var AGES=[['k0','0–3 года','коляска, тепло'],['k4','4–7 лет',''],['k8','8–12 лет',''],['k13','13+','']];
var MOODS=[['walk','Погулять'],['laugh','Посмеяться'],['dance','Потанцевать'],['meet','Познакомиться'],['cult','Культурно']];
var PRICE=[['','Любая'],['0','Бесплатно'],['1','До 1000 ₽'],['2','1000–3000 ₽'],['3','3000+ ₽']];
var TIME=[['','Любое'],['1h','1 час'],['half','Полдня'],['day','Весь день'],['eve','Вечер']];
var IN=[['','Любое'],['in','Крытое'],['out','На улице']];
var DIST={msk:['ЦАО','Север','Юг','Запад','Восток'],spb:['Центр','Васильевский','Петроградка','Пригороды']};
var TNAME={'1h':'1 час','half':'полдня','day':'весь день','eve':'вечер'};
var PNAME=['бесплатно','до 1000 ₽','1000–3000 ₽','от 3000 ₽'];
var COORD={msk:[55.75,37.62],spb:[59.94,30.31]};
var st={city:'msk',who:'',age:'',mood:'',price:'',mode:'self',dist:'',time:'',ind:'',weather:'ok'};
var saved=[];
try{saved=JSON.parse(localStorage.getItem('kuda_saved')||'[]')}catch(e){}
function persist(){try{localStorage.setItem('kuda_saved',JSON.stringify(saved))}catch(e){}}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function byId(id){for(var i=0;i<P.length;i++)if(P[i].id===id)return P[i]}

function chips(box,items,key,cb){
  box.innerHTML=items.map(function(it){return '<button type="button" class="kd-chip'+(st[key]===it[0]?' on':'')+'" data-v="'+it[0]+'" aria-pressed="'+(st[key]===it[0])+'">'+esc(it[1])+'</button>'}).join('');
  $$('button',box).forEach(function(b){b.onclick=function(){st[key]=b.getAttribute('data-v');cb()}});
}
function renderSteps(){
  var tiles=$('#kd-who');
  tiles.innerHTML=WHO.map(function(w){return '<button type="button" class="kd-tile'+(st.who===w[0]?' on':'')+'" data-w="'+w[0]+'" aria-pressed="'+(st.who===w[0])+'"><b>'+w[1]+'</b><small>'+w[2]+'</small></button>'}).join('');
  $$('button',tiles).forEach(function(b){b.onclick=function(){var v=b.getAttribute('data-w');st.who=st.who===v?'':v;st.age='';st.mood='';renderAll()}});
  var s2=$('#kd-step2');
  if(!st.who){s2.hidden=true}else{
    s2.hidden=false;
    if(st.who==='k'){$('#kd-s2t').textContent='Сколько лет ребёнку?';chips($('#kd-s2c'),[['','Любой возраст']].concat(AGES.map(function(a){return [a[0],a[1]]})),'age',renderAll)}
    else{$('#kd-s2t').textContent='Какое настроение?';chips($('#kd-s2c'),[['','Любое']].concat(MOODS),'mood',renderAll)}
  }
  chips($('#kd-price'),PRICE,'price',renderResults);
  chips($('#kd-time'),TIME,'time',renderResults);
  chips($('#kd-in'),IN,'ind',renderResults);
  chips($('#kd-dist'),[['','Любой']].concat(DIST[st.city].map(function(d){return [d,d]})),'dist',renderResults);
  chips($('#kd-mode'),[['self','Места самостоятельно'],['route','Готовый маршрут']],'mode',renderAll);
}
function weatherPenalty(p){
  var w=st.weather;
  if(w==='red'&&p.i==='out')return -5;
  if((w==='cold'||w==='wet'||w==='thaw')&&p.i==='out')return -2;
  if((w==='cold'||w==='wet'||w==='red')&&p.i==='in')return 2;
  return 0;
}
function match(p){
  if(p.c!==st.city)return false;
  if(st.who){
    if(st.who==='k'){ if(!p.w.some(function(x){return x[0]==='k'}))return false; if(st.age&&p.w.indexOf(st.age)<0)return false }
    else if(p.w.indexOf(st.who)<0)return false;
    if(st.who!=='k'&&st.mood&&p.mo.indexOf(st.mood)<0)return false;
  }
  if(st.price!==''&&p.b!==+st.price)return false;
  if(st.dist&&p.d!==st.dist)return false;
  if(st.time&&p.tm!==st.time)return false;
  if(st.ind==='in'&&p.i==='out')return false;
  if(st.ind==='out'&&p.i==='in')return false;
  return true;
}
function planB(p){
  var c=P.filter(function(x){return x.c===p.c&&x.i==='in'&&x.id!==p.id&&(!st.who||st.who==='k'?x.w.some(function(w){return w[0]==='k'})===p.w.some(function(w){return w[0]==='k'}):x.w.indexOf(st.who)>=0)});
  var same=c.filter(function(x){return x.d===p.d});
  return (same[0]||c[0]);
}
function card(p){
  var sv=saved.indexOf(p.id)>=0;
  var tags=['<span class="kd-tg">'+(p.i==='in'?'крытое':p.i==='out'?'на улице':'улица и крытое')+'</span>','<span class="kd-tg">'+PNAME[p.b]+'</span>','<span class="kd-tg">'+TNAME[p.tm]+'</span>','<span class="kd-tg">'+esc(p.d)+'</span>'].join('');
  var site=p.s?'<a class="kd-lnk" href="'+esc(p.s)+'" target="_blank" rel="noopener">Официальный сайт</a>':'<a class="kd-lnk" href="https://yandex.ru/search/?text='+encodeURIComponent(p.n+(p.c==='msk'?' Москва':' Санкт-Петербург')+' официальный сайт')+'" target="_blank" rel="noopener">Найти сайт</a>';
  var b='';
  if(p.i!=='in'&&(st.weather!=='ok')){var pb=planB(p);if(pb)b='<p class="kd-planb">План Б на такую погоду: <button type="button" class="kd-pb" data-id="'+pb.id+'">'+esc(pb.n)+'</button></p>'}
  return '<article class="kd-card" id="'+p.id+'"><div class="kd-tgs">'+tags+'</div><h3>'+esc(p.n)+'</h3><p class="kd-t">'+esc(p.t)+'</p>'+
  '<p class="kd-ad">'+esc(p.a)+(p.m?' · м. '+esc(p.m):'')+'</p><p class="kd-pr">'+esc(p.p)+'</p><p class="kd-h'+(p.v?'':' warn')+'">'+esc(p.h)+(p.s?'':' Часы и цены уточняйте на сайте площадки.')+'</p>'+b+
  '<div class="kd-act"><button type="button" class="kd-save'+(sv?' on':'')+'" data-id="'+p.id+'" aria-pressed="'+sv+'">'+(sv?'В маршруте':'Сохранить в маршрут')+'</button>'+site+'</div></article>';
}
function renderResults(){
  var box=$('#kd-res'),head=$('#kd-count');
  if(st.mode==='route'){
    var rs=R.filter(function(r){return r.c===st.city&&(st.price===''||r.b.indexOf(+st.price)>=0)});
    head.textContent='Готовые маршруты: '+rs.length;
    box.className='kd-routes';
    if(!rs.length){rs=R.filter(function(r){return r.c===st.city});head.textContent='Маршрутов с таким бюджетом нет, показываем все: '+rs.length}
    box.innerHTML=rs.map(routeCard).join('');
    bind();return;
  }
  var list=P.filter(match);
  list.sort(function(a,b){return weatherPenalty(b)-weatherPenalty(a)});
  var relaxed=false;
  if(!list.length){
    relaxed=true;
    var s=Object.assign({},st);st.price='';st.time='';st.dist='';st.ind='';
    list=P.filter(match);st.price=s.price;st.time=s.time;st.dist=s.dist;st.ind=s.ind;
  }
  head.textContent=(relaxed?'С такими фильтрами пусто. Показываем подходящее по «с кем»: ':'Найдено: ')+list.length;
  box.className='kd-grid';
  box.innerHTML=list.length?list.map(card).join(''):'<p class="kd-empty">Для такого сочетания у нас пока ничего нет. Попробуйте другой возраст или настроение.</p>';
  bind();
}
function routeCard(r){
  return '<article class="kd-route"><p class="kd-rk">'+esc(r.len)+' · '+esc(r.pr)+'</p><h3>'+esc(r.n)+'</h3><div class="kd-tgs">'+r.tags.map(function(t){return '<span class="kd-tg">'+esc(t)+'</span>'}).join('')+'</div><p class="kd-ad">Старт: '+esc(r.start)+'</p><ol>'+r.steps.map(function(s){return '<li>'+esc(s)+'</li>'}).join('')+'</ol>'+(r.tip?'<p class="kd-tip">'+esc(r.tip)+'</p>':'')+(r.check?'<p class="kd-h warn">Уточняйте: '+esc(r.check)+'</p>':'')+'</article>';
}
function bind(){
  $$('.kd-save').forEach(function(b){b.onclick=function(){var id=b.getAttribute('data-id'),i=saved.indexOf(id);if(i>=0)saved.splice(i,1);else saved.push(id);persist();renderResults();renderDay()}});
  $$('.kd-pb').forEach(function(b){b.onclick=function(){var el=document.getElementById(b.getAttribute('data-id'));if(el)el.scrollIntoView({behavior:'smooth',block:'center'});else{st.ind='in';st.price='';st.time='';st.dist='';renderAll();setTimeout(function(){var e=document.getElementById(b.getAttribute('data-id'));if(e)e.scrollIntoView({behavior:'smooth',block:'center'})},60)}}});
}
function dayText(){
  var l=saved.map(byId).filter(Boolean).filter(function(p){return p.c===st.city});
  return 'Мой день ('+(st.city==='msk'?'Москва':'Санкт-Петербург')+'):\n'+l.map(function(p,i){return (i+1)+'. '+p.n+', '+p.a}).join('\n')+'\nСобрано на елкино-чудо.рф';
}
function renderDay(){
  var l=saved.map(byId).filter(Boolean).filter(function(p){return p.c===st.city});
  var box=$('#kd-day');
  $('#kd-day-n').textContent=l.length;
  if(!l.length){box.innerHTML='<p class="kd-empty">Отметьте 2–3 места кнопкой «Сохранить в маршрут» для этого города. Здесь появится ваш день с общим временем.</p>';$('#kd-share').hidden=true;return}
  var hrs={ '1h':1,'half':3,'day':6,'eve':3};var t=l.reduce(function(a,p){return a+hrs[p.tm]},0);
  box.innerHTML='<ol class="kd-dl">'+l.map(function(p){return '<li><span><b>'+esc(p.n)+'</b><small>'+esc(p.a)+'</small></span><button type="button" class="kd-x" data-id="'+p.id+'" aria-label="Убрать '+esc(p.n)+'">×</button></li>'}).join('')+'</ol><p class="kd-tot">Примерно '+t+' ч на всё. Дорогу между местами добавьте сами: открывайте адреса в картах.</p>';
  $$('.kd-x',box).forEach(function(b){b.onclick=function(){saved.splice(saved.indexOf(b.getAttribute('data-id')),1);persist();renderResults();renderDay()}});
  $('#kd-share').hidden=false;
  $('#kd-tg').href='https://t.me/share/url?url='+encodeURIComponent('https://xn----htbkheohc7b0b5g.xn--p1ai/kuda-poyti.html')+'&text='+encodeURIComponent(dayText());
}
function copy(){var t=dayText(),b=$('#kd-copy');function ok(){b.textContent='Скопировано';setTimeout(function(){b.textContent='Скопировать'},1800)}
  if(navigator.clipboard)navigator.clipboard.writeText(t).then(ok,function(){});else{var a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();try{document.execCommand('copy');ok()}catch(e){}a.remove()}}
function weather(){
  var c=COORD[st.city],ban=$('#kd-wx');
  st.weather='ok';ban.hidden=true;
  if(!window.fetch)return;
  fetch('https://api.open-meteo.com/v1/forecast?latitude='+c[0]+'&longitude='+c[1]+'&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&wind_speed_unit=ms&timezone=auto')
  .then(function(r){return r.json()}).then(function(j){
    var k=j.current,t=k.apparent_temperature,tt=k.temperature_2m,w=k.wind_speed_10m,pr=k.precipitation>0||(k.weather_code>=51&&k.weather_code<=86),msg='',m='ok';
    if(t<=-20||w>17){m='red';msg='Сегодня ощущается '+Math.round(t)+'°C. Лучше остаться в тепле: показали крытые места.'}
    else if(pr&&tt>-3){m='wet';msg='Сейчас мокро и '+Math.round(tt)+'°C. Крытые места поднялись выше.'}
    else if(t<=-12){m='cold';msg='Сейчас ощущается '+Math.round(t)+'°C. Улицу показываем, но крытые места выше. На улице комфортно 30–40 минут.'}
    else if(tt>2){m='thaw';msg='Оттепель, '+Math.round(tt)+'°C. Натуральный лёд может не работать: проверьте каток перед выходом.'}
    if(m!=='ok'){st.weather=m;ban.textContent=msg;ban.hidden=false;renderResults()}
  }).catch(function(){});
}
function renderAll(){chips($('#kd-city'),[['msk','Москва'],['spb','Санкт-Петербург']],'city',function(){st.dist='';renderAll();weather()});renderSteps();renderResults();renderDay()}
function init(){
  $('#kd-copy').onclick=copy;
  var q=location.hash.replace('#','');if(q==='spb'||q==='msk')st.city=q;
  chips($('#kd-city'),[['msk','Москва'],['spb','Санкт-Петербург']],'city',function(){st.dist='';renderAll();weather()});
  renderAll();weather();
}
if(document.readyState!=='loading')init();else document.addEventListener('DOMContentLoaded',init);
})();
