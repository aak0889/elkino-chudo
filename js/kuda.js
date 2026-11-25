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
var CAT={katok:'Каток',elka:'Ёлка',show:'Спектакль и цирк',yarmarka:'Ярмарка',svet:'Огни города',muzey:'Музей',park:'Парк',usadba:'Усадьба и дворец',progulka:'Прогулка',master:'Мастер-класс',vid:'С видом',zagorod:'За город на день',razvl:'Развлечения'};
var CATF=[['','Всё'],['katok','Катки'],['elka','Ёлки и спектакли'],['yarmarka','Ярмарки'],['svet','Огни'],['muzey','Музеи'],['park','Парки и усадьбы'],['progulka','Прогулки'],['vid','С видом'],['zagorod','За город'],['razvl','Развлечения']];
var CATG={elka:['elka','show','master'],park:['park','usadba']};
var QUICK=[['qfree','Бесплатно'],['qkids','С детьми'],['qin','В помещении'],['qmetro','Рядом с метро']];
var ICO={"katok": "<path d=\"M5.905 5h3.418a1 1 0 0 1 .928 .629l1.143 2.856a3 3 0 0 0 2.207 1.83l4.717 .926a2.084 2.084 0 0 1 1.682 2.045v.714a1 1 0 0 1 -1 1h-13.895a1 1 0 0 1 -1 -1.1l.8 -8a1 1 0 0 1 1 -.9z\" /><path d=\"M3 19h17a1 1 0 0 0 1 -1\" /><path d=\"M9 15v4\" /><path d=\"M15 15v4\" />", "elka": "<path d=\"M12 3l4 4l-2 1l4 4l-3 1l4 4h-14l4 -4l-3 -1l4 -4l-2 -1z\" /><path d=\"M14 17v3a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1v-3\" />", "show": "<path d=\"M13.192 9h6.616a2 2 0 0 1 1.992 2.183l-.567 6.182a4 4 0 0 1 -3.983 3.635h-1.5a4 4 0 0 1 -3.983 -3.635l-.567 -6.182a2 2 0 0 1 1.992 -2.183z\" /><path d=\"M15 13h.01\" /><path d=\"M18 13h.01\" /><path d=\"M15 16.5c1 .667 2 .667 3 0\" /><path d=\"M8.632 15.982a4.037 4.037 0 0 1 -.382 .018h-1.5a4 4 0 0 1 -3.983 -3.635l-.567 -6.182a2 2 0 0 1 1.992 -2.183h6.616a2 2 0 0 1 2 2\" /><path d=\"M6 8h.01\" /><path d=\"M9 8h.01\" /><path d=\"M6 12c.764 -.51 1.528 -.63 2.291 -.36\" />", "yarmarka": "<path d=\"M11 14l4 6h6l-9 -16l-9 16h6l4 -6\" />", "svet": "<path d=\"M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6z\" />", "muzey": "<path d=\"M3 21l18 0\" /><path d=\"M3 10l18 0\" /><path d=\"M5 6l7 -3l7 3\" /><path d=\"M4 10l0 11\" /><path d=\"M20 10l0 11\" /><path d=\"M8 14l0 3\" /><path d=\"M12 14l0 3\" /><path d=\"M16 14l0 3\" />", "park": "<path d=\"M16 5l3 3l-2 1l4 4l-3 1l4 4h-9\" /><path d=\"M15 21l0 -3\" /><path d=\"M8 13l-2 -2\" /><path d=\"M8 12l2 -2\" /><path d=\"M8 21v-13\" /><path d=\"M5.824 16a3 3 0 0 1 -2.743 -3.69a3 3 0 0 1 .304 -4.833a3 3 0 0 1 4.615 -3.707a3 3 0 0 1 4.614 3.707a3 3 0 0 1 .305 4.833a3 3 0 0 1 -2.919 3.695h-4z\" />", "usadba": "<path d=\"M15 19v-2a3 3 0 0 0 -6 0v2a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-14h4v3h3v-3h4v3h3v-3h4v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z\" /><path d=\"M3 11l18 0\" />", "progulka": "<path d=\"M13 4m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" /><path d=\"M7 21l3 -4\" /><path d=\"M16 21l-2 -4l-3 -3l1 -6\" /><path d=\"M6 12l2 -3l4 -1l3 3l3 1\" />", "master": "<path d=\"M12 21a9 9 0 0 1 0 -18c4.97 0 9 3.582 9 8c0 1.06 -.474 2.078 -1.318 2.828c-.844 .75 -1.989 1.172 -3.182 1.172h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25\" /><path d=\"M8.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" /><path d=\"M12.5 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" /><path d=\"M16.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" />", "vid": "<path d=\"M7 16m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0\" /><path d=\"M17 16m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0\" /><path d=\"M16.346 9.17l-.729 -1.261c-.16 -.248 -1.056 -.203 -1.117 .091l-.177 1.38\" /><path d=\"M19.761 14.813l-2.84 -5.133c-.189 -.31 -.592 -.68 -1.421 -.68c-.828 0 -1.5 .448 -1.5 1v6\" /><path d=\"M7.654 9.17l.729 -1.261c.16 -.249 1.056 -.203 1.117 .091l.177 1.38\" /><path d=\"M4.239 14.813l2.84 -5.133c.189 -.31 .592 -.68 1.421 -.68c.828 0 1.5 .448 1.5 1v6\" /><rect width=\"4\" height=\"2\" x=\"10\" y=\"12\" />", "zagorod": "<path d=\"M21 13c0 -3.87 -3.37 -7 -10 -7h-8\" /><path d=\"M3 15h16a2 2 0 0 0 2 -2\" /><path d=\"M3 6v5h17.5\" /><path d=\"M3 10l0 4\" /><path d=\"M8 11l0 -5\" /><path d=\"M13 11l0 -4.5\" /><path d=\"M3 19l18 0\" />", "razvl": "<path d=\"M18.816 13.58c2.292 2.138 3.546 4 3.092 4.9c-.745 1.46 -5.783 -.259 -11.255 -3.838c-5.47 -3.579 -9.304 -7.664 -8.56 -9.123c.464 -.91 2.926 -.444 5.803 .805\" /><path d=\"M12 12m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0\" />"};
var DIST={msk:['ЦАО','Север','Юг','Запад','Восток','Зеленоград','Область'],spb:['Центр','Васильевский','Петроградка','Юг','Пригороды']};
var TNAME={'1h':'1 час','half':'полдня','day':'весь день','eve':'вечер'};
var PNAME=['бесплатно','до 1000 ₽','1000–3000 ₽','от 3000 ₽'];
var COORD={msk:[55.75,37.62],spb:[59.94,30.31]};
var st={city:'msk',who:'',age:'',mood:'',price:'',mode:'self',dist:'',time:'',cat:'',qfree:0,qkids:0,qin:0,qmetro:0,weather:'ok'};
var saved=[];
try{saved=JSON.parse(localStorage.getItem('kuda_day2')||'[]')}catch(e){}
function persist(){try{localStorage.setItem('kuda_day2',JSON.stringify(saved))}catch(e){}}
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
  var cats=CATF.filter(function(c){return !c[0]||P.some(function(p){return p.c===st.city&&inCat(p,c[0])})});
  chips($('#kd-cat'),cats,'cat',renderResults);
  var q=$('#kd-quick');
  q.innerHTML=QUICK.map(function(it){return '<button type="button" class="kd-chip kd-q'+(st[it[0]]?' on':'')+'" data-k="'+it[0]+'" aria-pressed="'+!!st[it[0]]+'">'+esc(it[1])+'</button>'}).join('');
  $$('button',q).forEach(function(b){b.onclick=function(){var k=b.getAttribute('data-k');st[k]=st[k]?0:1;renderSteps();renderResults()}});
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
function inCat(p,c){return (CATG[c]||[c]).indexOf(p.k)>=0}
function kids(p){return p.f.indexOf('kids')>=0||p.w.some(function(x){return x[0]==='k'})}
function nearMetro(p){return !!p.m&&p.mm!=null&&p.mm<=10}
function match(p){
  if(p.c!==st.city)return false;
  if(st.cat&&!inCat(p,st.cat))return false;
  if(st.qfree&&!p.fr&&p.b!==0)return false;
  if(st.qkids&&!kids(p))return false;
  if(st.qin&&p.i==='out')return false;
  if(st.qmetro&&!nearMetro(p))return false;
  if(st.who){
    if(st.who==='k'){ if(!p.w.some(function(x){return x[0]==='k'}))return false; if(st.age&&p.w.indexOf(st.age)<0)return false }
    else if(p.w.indexOf(st.who)<0)return false;
    if(st.who!=='k'&&st.mood&&p.mo.indexOf(st.mood)<0)return false;
  }
  if(st.price!==''&&p.b!==+st.price)return false;
  if(st.dist&&p.d!==st.dist)return false;
  if(st.time&&p.tm!==st.time)return false;
  return true;
}
function planB(p){
  var c=P.filter(function(x){return x.c===p.c&&x.i==='in'&&x.id!==p.id&&(!st.who||st.who==='k'?x.w.some(function(w){return w[0]==='k'})===p.w.some(function(w){return w[0]==='k'}):x.w.indexOf(st.who)>=0)});
  var same=c.filter(function(x){return x.d===p.d});
  return (same[0]||c[0]);
}
function forWhom(p){
  var A={k0:'0–3',k4:'4–7',k8:'8–12',k13:'13+'},ages=p.w.filter(function(x){return A[x]}).map(function(x){return A[x]});
  var out=[];
  if(ages.length)out.push('детям '+(ages.length===4?'любого возраста':ages.join(', ')+' лет'));
  if(p.f.indexOf('family')>=0)out.push('семьям');
  if(p.f.indexOf('adults')>=0||p.w.some(function(x){return x==='pair'||x==='crew'||x==='solo'}))out.push('взрослым');
  var t=out.join(', ');return t?t[0].toUpperCase()+t.slice(1):'';
}
function mapUrl(p){
  var city=p.c==='msk'?'Москва':'Санкт-Петербург',q=(p.d==='Область'||p.d==='Пригороды')?p.n+', '+p.a:city+', '+p.a;
  return 'https://yandex.ru/maps/?text='+encodeURIComponent(q);
}
function host(u){try{return new URL(u).hostname.replace(/^www\./,'')}catch(e){return ''}}
function row(lbl,val,src){return val?'<div class="kd-r"><dt>'+lbl+'</dt><dd>'+val+(src?' <a class="kd-src" href="'+esc(src)+'" target="_blank" rel="noopener">источник: '+esc(host(src))+'</a>':'')+'</dd></div>':''}
function card(p){
  var sv=saved.indexOf(p.id)>=0;
  var badges=(p.fr?'<span class="kd-bd free">Бесплатно</span>':'')+(nearMetro(p)?'<span class="kd-bd">'+p.mm+' мин от метро</span>':'')+'<span class="kd-bd">'+(p.i==='in'?'В помещении':p.i==='out'?'На улице':'Улица и помещение')+'</span>';
  var art='<div class="kd-art kd-c-'+p.k+'" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">'+(ICO[p.k]||'')+'</svg><span>'+esc(CAT[p.k]||'')+'</span></div>';
  var where=esc(p.a)+(p.m?'<br><span class="kd-m">м. '+esc(p.m)+(p.mm!=null?', '+p.mm+' мин пешком':'')+'</span>':'')+(p.tr?'<br><span class="kd-m">'+esc(p.tr)+'</span>':'');
  var price='<span class="kd-p'+(p.pc?' '+p.pc:'')+'">'+esc(p.p)+'</span>';
  var hours=p.h?esc(p.h):'<span class="kd-p warn">Смотрите на сайте площадки</span>';
  var b='';
  if(p.i!=='in'&&(st.weather!=='ok')){var pb=planB(p);if(pb)b='<p class="kd-planb">План Б на такую погоду: <button type="button" class="kd-pb" data-id="'+pb.id+'">'+esc(pb.n)+'</button></p>'}
  var site=p.s?'<a class="kd-go" href="'+esc(p.s)+'" target="_blank" rel="noopener">'+(p.source_only?'Источник адреса':'На сайт')+'</a>':'';
  var photo=p.ph?'<figure class="kd-photo"><img loading="lazy" src="'+esc(p.ph)+'" alt="Фото: '+esc(p.n)+'" onerror="this.closest(\'.kd-photo\').hidden=true"><figcaption>Фото: <a href="'+esc(p.cl)+'" target="_blank" rel="noopener">'+esc(p.cr)+'</a></figcaption></figure>':'';
  return '<article class="kd-card" id="'+p.id+'">'+photo+art+'<div class="kd-body"><div class="kd-bds">'+badges+'</div><h3>'+esc(p.n)+'</h3><p class="kd-t">'+esc(p.t)+'</p><dl class="kd-dl2">'+
  row('Где',where)+row('Цена',price,p.ps)+row('Часы',hours,p.h?p.hs:'')+row('Сезон',esc(p.se))+row('Кому',esc(forWhom(p)))+'</dl>'+b+
  (p.nt?'<p class="kd-note">'+esc(p.nt)+'</p>':'')+
  (p.ss&&!(p.ss>=200&&p.ss<400)?'<p class="kd-note">Сайт площадки не открылся при нашей проверке 13.11.2026, попробуйте позже.</p>':'')+
  '<div class="kd-act">'+site+'<a class="kd-way" href="'+mapUrl(p)+'" target="_blank" rel="noopener">Как добраться</a><button type="button" class="kd-save'+(sv?' on':'')+'" data-id="'+p.id+'" aria-pressed="'+sv+'">'+(sv?'В моём дне ✓':'+ В мой день')+'</button></div></div></article>';
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
    var s=Object.assign({},st);st.price='';st.time='';st.dist='';st.cat='';st.qfree=st.qkids=st.qin=st.qmetro=0;
    list=P.filter(match);Object.assign(st,s);
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
  $$('.kd-pb').forEach(function(b){b.onclick=function(){var el=document.getElementById(b.getAttribute('data-id'));if(el)el.scrollIntoView({behavior:'smooth',block:'center'});else{st.qin=1;st.cat='';st.qfree=st.qkids=st.qmetro=0;st.price='';st.time='';st.dist='';renderAll();setTimeout(function(){var e=document.getElementById(b.getAttribute('data-id'));if(e)e.scrollIntoView({behavior:'smooth',block:'center'})},60)}}});
}
function dayText(){
  var l=saved.map(byId).filter(Boolean).filter(function(p){return p.c===st.city});
  return 'Мой день ('+(st.city==='msk'?'Москва':'Санкт-Петербург')+'):\n'+l.map(function(p,i){return (i+1)+'. '+p.n+', '+p.a+(p.m?' (м. '+p.m+')':'')}).join('\n')+'\nСобрано на елкино-чудо.рф';
}
function renderDay(){
  var l=saved.map(byId).filter(Boolean).filter(function(p){return p.c===st.city});
  var box=$('#kd-day');
  $('#kd-day-n').textContent=l.length;
  if(!l.length){box.innerHTML='<p class="kd-empty">Отметьте 2–3 места кнопкой «+ В мой день» для этого города. Здесь появится ваш день с общим временем.</p>';$('#kd-share').hidden=true;return}
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
