/* «Железная дорога» в снежном шаре: 3D на three.js r160 (как js/rink3d.js, общие части берём оттуда).
   Шар на полке → камера влетает сквозь стекло к игрушечному поезду → через окно вагона попадаем внутрь,
   а там поезд настоящий: четыре вагона, переходы дверями, за окнами вечерние горы, ели и огни деревень.
   В каждом вагоне своя спокойная мини-игра. Всё процедурное: примитивы и canvas-текстуры. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTex, glowTex, woodTex, makeEnv, pointCloud, SNOW_V, SNOW_F, SHAKE_U, SHAKE_ICON, makeShake, bindShake, V3, HDR, clamp, smooth, ease, wrapA } from './rink3d.js';
import { quality, furFir, gradePass, sanitizePass, makeBokeh, makeTour } from './globe-kit.js';

const Q = new URLSearchParams(location.search);
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches || Q.get('rm') === '1';
const QL = quality(), LOW = QL.LOW;
const TOUCH = matchMedia('(pointer: coarse)').matches;
const DEBUG = Q.has('rlshot');
const store = window.ElkStore || (() => null);

const R = 10, GROUND_Y = -2.5;                       // шар как у катка
const CAR_N = 4, PITCH = 18, HALF = 8, IN_W = 1.45, EYE = 1.6, PLAYER_R = .26;
const V_TRAIN = REDUCE ? 4 : 12, TRACK_Y = -1.15, MID_X = -27;
const carX = k => -k * PITCH;                        // поезд идёт к +x, первый вагон сразу за локомотивом
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mod = (a, n) => ((a % n) + n) % n;

const CARS = [
  { id: 'lounge', name: 'Вагон-гостиная', text: 'Ёлка, мягкие диваны и пять игрушек, которые кто-то спрятал', big: false },
  { id: 'dining', name: 'Вагон-ресторан', text: 'Чай в подстаканниках и мандарины, которые катаются по столу', big: false },
  { id: 'music', name: 'Музыкальный вагон', text: 'Под хвойной аркой висят колокольчики, они помнят старые мелодии', big: false },
  { id: 'view', name: 'Смотровой вагон', text: 'Большие окна, горы до самого неба и одно запотевшее стекло', big: true },
];

/* ---------------- текстуры ---------------- */
const velvetTex = (base, dark, light) => { const t = canvasTex(256, 256, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { g.fillStyle = rnd() < .5 ? dark : light; g.globalAlpha = .05 + rnd() * .08; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 3 + rnd() * 9); } g.globalAlpha = .35; g.strokeStyle = dark; g.lineWidth = 2; for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) { const ox = (y / 64) % 2 ? 32 : 0; g.beginPath(); g.moveTo(x + ox, y); g.lineTo(x + ox + 32, y + 32); g.lineTo(x + ox, y + 64); g.lineTo(x + ox - 32, y + 32); g.closePath(); g.stroke(); g.fillStyle = light; g.globalAlpha = .5; g.beginPath(); g.arc(x + ox, y, 3, 0, 7); g.fill(); g.globalAlpha = .35; } g.globalAlpha = 1; }); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
const carpetTex = () => { const t = canvasTex(256, 512, (g, w, h) => { g.fillStyle = '#5a1018'; g.fillRect(0, 0, w, h); g.fillStyle = '#c9a160'; g.fillRect(10, 0, 6, h); g.fillRect(w - 16, 0, 6, h); g.fillStyle = '#2a0609'; g.fillRect(22, 0, 4, h); g.fillRect(w - 26, 0, 4, h); g.strokeStyle = 'rgba(214,174,102,.55)'; g.lineWidth = 3; for (let y = 0; y < h; y += 128) { g.beginPath(); g.moveTo(w / 2, y + 14); g.lineTo(w - 50, y + 64); g.lineTo(w / 2, y + 114); g.lineTo(50, y + 64); g.closePath(); g.stroke(); g.fillStyle = 'rgba(214,174,102,.4)'; g.beginPath(); g.arc(w / 2, y + 64, 9, 0, 7); g.fill(); } for (let i = 0; i < 2000; i++) { g.fillStyle = 'rgba(0,0,0,' + (rnd() * .12) + ')'; g.fillRect(rnd() * w, rnd() * h, 2, 2); } }); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
const creamTex = () => { const t = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#efe2c6'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(176,132,64,.22)'; g.lineWidth = 1.2; for (let y = 0; y <= h; y += 32) for (let x = 0; x <= w; x += 32) { const ox = (y / 32) % 2 ? 16 : 0; g.beginPath(); g.moveTo(x + ox, y - 7); g.lineTo(x + ox + 5, y); g.lineTo(x + ox, y + 7); g.lineTo(x + ox - 5, y); g.closePath(); g.stroke(); } }); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
const ceilTex = () => { const t = canvasTex(512, 256, (g, w, h) => { g.fillStyle = '#f2e7cf'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(184,140,70,.6)'; g.lineWidth = 3; g.strokeRect(16, 22, w - 32, h - 44); g.lineWidth = 1.2; g.strokeRect(26, 32, w - 52, h - 64); g.strokeStyle = 'rgba(184,140,70,.45)'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.beginPath(); g.ellipse(w / 2 + Math.cos(a) * 26, h / 2 + Math.sin(a) * 26, 18, 7, a, 0, 7); g.stroke(); } g.beginPath(); g.arc(w / 2, h / 2, 10, 0, 7); g.stroke(); }); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
const needleTex = () => { const t = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#1d5238'; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { const x = rnd() * w, y = rnd() * h, a = (rnd() - .5) * 1.6 + (y < h / 2 ? -.6 : .6), l = 6 + rnd() * 9; g.strokeStyle = ['#2f7a52', '#3d8a5c', '#174a32', '#58a06e'][i % 4]; g.lineWidth = 1 + rnd(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); } for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(240,246,255,.5)'; g.fillRect(rnd() * w, rnd() * h * .3, 3, 2); } }); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
const frostEdgeTex = () => canvasTex(256, 256, (g, w, h) => { g.clearRect(0, 0, w, h); const gr = g.createRadialGradient(w / 2, h / 2, w * .4, w / 2, h / 2, w * .75); gr.addColorStop(0, 'rgba(220,235,255,0)'); gr.addColorStop(1, 'rgba(225,238,255,.3)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(240,248,255,.22)'; g.lineWidth = 1; for (let i = 0; i < 40; i++) { const c = [[0, 0], [w, 0], [0, h], [w, h]][i % 4]; let x = c[0] + (rnd() - .5) * 40, y = c[1] + (rnd() - .5) * 40; const a0 = Math.atan2(h / 2 - y, w / 2 - x) + (rnd() - .5) * 1.4; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { const a = a0 + (rnd() - .5) * .9, l = 6 + rnd() * 12; x += Math.cos(a) * l; y += Math.sin(a) * l; g.lineTo(x, y); } g.stroke(); } });
const snowTex = () => { const t = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); for (let i = 0; i < 380; i++) { g.fillStyle = 'rgba(150,170,210,' + (.05 + rnd() * .12) + ')'; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 4 + rnd() * 22, 2 + rnd() * 6, 0, 0, 7); g.fill(); } }); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
const clothTex = () => canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#f7f1e6'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(190,160,110,.5)'; g.lineWidth = 1.2; for (let i = 0; i < 2; i++) g.strokeRect(10 + i * 8, 10 + i * 8, w - 20 - i * 16, h - 20 - i * 16); for (let x = 22; x < w - 20; x += 14) { g.beginPath(); g.arc(x, 14, 4, 0, Math.PI); g.stroke(); g.beginPath(); g.arc(x, h - 14, 4, Math.PI, 0); g.stroke(); } });
const bellowsTex = () => { const t = canvasTex(256, 64, (g, w, h) => { for (let x = 0; x < w; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, '#15120f'); gr.addColorStop(.5, '#3a332b'); gr.addColorStop(1, '#15120f'); g.fillStyle = gr; g.fillRect(x, 0, 16, h); } }); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
function plaqueTex(text, sub) { return canvasTex(512, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#7a5626'); gr.addColorStop(.45, '#f0d79c'); gr.addColorStop(.6, '#d6ae66'); gr.addColorStop(1, '#6e4c20'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(60,35,10,.7)'; g.lineWidth = 4; g.strokeRect(9, 9, w - 18, h - 18); g.fillStyle = '#3b2410'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '600 ' + (sub ? 50 : 60) + 'px Cormorant, Georgia, serif'; g.fillText(text, w / 2, sub ? h / 2 - 12 : h / 2 + 3); if (sub) { g.font = '500 26px Cormorant, Georgia, serif'; g.fillText(sub, w / 2, h / 2 + 30); } }); }

/* ---------------- геометрия ---------------- */
function paint(g, col) { g = g.index ? g.toNonIndexed() : g; if (g.attributes.uv) g.deleteAttribute('uv'); if (g.attributes.normal) g.deleteAttribute('normal'); const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
function firGeo(tiers, seg) { return furFir({ tiers: tiers + 3, seg: Math.max(10, seg * 2 + 4), snow: .5, seed: tiers * 7 + seg }); }
const prism = (r, len) => { const g = new THREE.CylinderGeometry(r, r, len, 3, 1); g.rotateZ(Math.PI / 2); g.rotateX(-Math.PI / 2); return g; };
const M4 = new THREE.Matrix4(), QT = new THREE.Quaternion(), EU = new THREE.Euler(), SC = new THREE.Vector3();
function bake(geo, list) { // list: [x,y,z,s,rotY,(sy)]
  const out = list.map(([x, y, z, s, ry, sy]) => { const g = geo.clone(); M4.compose(V3(x, y, z), QT.setFromEuler(EU.set(0, ry || 0, 0)), SC.set(s, s * (sy || 1), s)); g.applyMatrix4(M4); return g; });
  const m = mergeGeometries(out); m.computeVertexNormals(); return m;
}
/* периодический шум по x (чтобы полосы пейзажа бесшовно повторялись) */
function pnoise(L, n, amp0) { const H = []; for (let k = 1; k <= n; k++) H.push([k, rnd() * 6.283, amp0 / Math.pow(k, .9), rnd() * .02]); return (x, z) => { let s = 0; for (const [k, ph, a, kz] of H) s += Math.sin(x * k * 6.2832 / L + ph + z * kz) * a; return s; }; }

/* ================================================================= */
export async function open(btn) {
  if (document.getElementById('rl')) return;
  const t = document.createElement('canvas'); if (!(t.getContext('webgl2') || t.getContext('webgl'))) throw new Error('no webgl');
  return build(btn);
}

async function build(btn) {
  seed = 11;
  /* ---------- DOM ---------- */
  const el = document.createElement('div'); el.className = 'rk rl tour' + (TOUCH ? ' touch' : ''); el.id = 'rl';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Железная дорога: снежный шар, внутри которого идёт поезд');
  const arr = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  el.innerHTML = `
  <canvas class="rk-cv" tabindex="0" aria-label="Поезд внутри снежного шара"></canvas>
  <div class="rk-vign" aria-hidden="true"></div>
  <div class="rk-flash" aria-hidden="true"></div>
  <header class="rk-bar">
    <h2 class="rk-title"><small>Снежный шар</small>Железная дорога</h2>
    <p class="rk-hud" aria-live="polite"><span class="rl-hud"></span></p>
    <button class="rk-btn rk-shake" type="button" aria-label="Встряхнуть шар">${SHAKE_ICON}<span>Встряхнуть</span></button>
    <button class="rk-btn rk-snd" type="button" aria-pressed="false" aria-label="Звук: включить"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path class="on" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path class="off" d="M16.5 9.5l5 5M21.5 9.5l-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
    <button class="rk-btn rk-close" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Выйти из шара</span></button>
  </header>
  <p class="rk-place" aria-live="polite"><b></b><span></span></p>
  <p class="rk-hint" aria-live="polite"></p>
  <nav class="rl-cars" aria-label="Вагоны"><button class="rk-btn rl-prev" type="button" aria-label="Пройти в вагон ближе к локомотиву">${arr('M15 5l-7 7 7 7')}</button><button class="rl-car" type="button" title="Подойти к игре в этом вагоне">Вагон 1 из 4</button><button class="rk-btn rl-next" type="button" aria-label="Пройти в следующий вагон">${arr('M9 5l7 7-7 7')}</button></nav>
  <div class="rl-acts"><button class="rk-stars rl-act" type="button" hidden></button><button class="rk-out rl-act2" type="button" hidden></button></div>
  <div class="rl-quiz" hidden></div>
  <div class="rl-pad" role="group" aria-label="Ходьба">
    <button class="rk-btn" type="button" data-k="tl" aria-label="Повернуть налево">${arr('M9 7H5V3M5.6 7A8 8 0 1 1 4 12')}</button>
    <button class="rk-btn" type="button" data-k="fw" aria-label="Идти вперёд">${arr('M12 19V5M6 11l6-6 6 6')}</button>
    <button class="rk-btn" type="button" data-k="tr" aria-label="Повернуть направо">${arr('M15 7h4V3M18.4 7A8 8 0 1 0 20 12')}</button>
    <button class="rk-btn" type="button" data-k="bk" aria-label="Идти назад">${arr('M12 5v14M6 13l6 6 6-6')}</button>
  </div>
  <div class="rk-pops" aria-hidden="true"></div>
  <div class="rk-joy" aria-hidden="true"><i></i></div>
  <button class="gk-free" type="button" hidden>Свободная прогулка</button>
  <div class="rk-card" hidden><div class="rk-card-in"><svg class="rk-mark" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 0c.6 5.4 4.6 9.4 10 10-5.4.6-9.4 4.6-10 10-.6-5.4-4.6-9.4-10-10C5.4 9.4 9.4 5.4 10 0Z"/></svg><h3></h3><p></p><div class="rk-acts"><button class="rk-go" type="button"></button><button class="rk-out rl-cout" type="button">Гулять дальше</button></div></div></div>
  <div class="rk-load"><span>Снимаем шар с полки…</span></div>`;
  document.body.appendChild(el); document.body.style.overflow = 'hidden';
  const $ = s => el.querySelector(s);
  const cv = $('.rk-cv'), flash = $('.rk-flash'), card = $('.rk-card'), pops = $('.rk-pops'), hint = $('.rk-hint'), placeEl = $('.rk-place');
  const actBtn = $('.rl-act'), act2Btn = $('.rl-act2'), quizEl = $('.rl-quiz'), hudEl = $('.rl-hud'), carLbl = $('.rl-car');
  requestAnimationFrame(() => el.classList.add('on'));

  /* ---------- renderer ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: DEBUG });
  const DPR = QL.dpr; renderer.setPixelRatio(DPR);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .01, 600);
  const FOG_COL = new THREE.Color(0x3a4572); scene.fog = new THREE.FogExp2(FOG_COL, 0);
  const pmrem = new THREE.PMREMGenerator(renderer); const envMap = makeEnv(pmrem);
  const T_GLOW = glowTex();
  await (document.fonts && document.fonts.load ? document.fonts.load('600 60px Cormorant').catch(() => 0) : 0);

  /* ===== СНАРУЖИ: комната, полка, подставка, стекло (как у катка) ===== */
  const globe = new THREE.Group(); scene.add(globe);
  const bg = new THREE.Mesh(new THREE.SphereGeometry(200, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `varying vec3 vP; void main(){ vec3 d = normalize(vP); float h = d.y;
      vec3 room = mix(vec3(.016,.012,.012), vec3(.010,.016,.036), smoothstep(-.35,.55,h));
      room += vec3(.20,.11,.045) * pow(max(0., dot(d, normalize(vec3(.1,-.05,-1.)))), 7.) * .45;
      room += vec3(.05,.07,.14) * pow(max(0., dot(d, normalize(vec3(-.8,.4,-.6)))), 3.) * .5;
      for (int i = 0; i < 16; i++) { float fi = float(i); float az = -1.2 + fi * .16 + sin(fi * 7.3) * .05; float el = -.14 + .1 * sin(fi * 2.1) + .05 * cos(fi * 5.7); if (abs(az) < .3) el += .22;
        vec3 bd = normalize(vec3(sin(az), el, -cos(az))); float rad = .018 + .012 * fract(sin(fi * 12.9) * 43758.5); float dd = acos(clamp(dot(d, bd), -1., 1.));
        vec3 bc = mix(vec3(1.,.7,.35), vec3(.55,1.,.6), step(.75, fract(fi * .37))); float k = smoothstep(rad, rad * .86, dd) * (.55 + .45 * smoothstep(rad * .6, rad * .95, dd));
        room += bc * k * (.035 + .03 * fract(fi * .61)); }
      gl_FragColor = vec4(room, 1.); }`
  })); bg.renderOrder = -10; globe.add(bg);
  const gl1 = new THREE.HemisphereLight(0x6f86c0, 0x1a1210, .3); globe.add(gl1);
  const gKey = new THREE.DirectionalLight(0xffcf98, 1.4); gKey.position.set(-22, 16, 26); globe.add(gKey);
  const gRim = new THREE.DirectionalLight(0x8fb2ff, .8); gRim.position.set(24, 10, -18); globe.add(gRim);
  const gMoon = new THREE.DirectionalLight(0xb9c9ff, .7); gMoon.position.set(-5, 14, 7); globe.add(gMoon);
  const shelfMat = new THREE.MeshPhysicalMaterial({ map: woodTex('#4a2e1b', '#2a170c', '#6b4429'), roughness: .5, clearcoat: .5, clearcoatRoughness: .35, envMap, envMapIntensity: .5 }); shelfMat.map.repeat.set(3, 1);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(110, 1.6, 30), shelfMat); shelf.position.set(0, -13.3, 2); globe.add(shelf);
  const baseMat = new THREE.MeshPhysicalMaterial({ map: woodTex('#173a2e', '#0a1f18', '#2b5a49'), roughness: .3, clearcoat: 1, clearcoatRoughness: .1, envMap, envMapIntensity: 1 }); baseMat.map.repeat.set(2, 1);
  const prof = [[0, -12.5], [8.5, -12.5], [8.85, -12.35], [8.9, -11.75], [8.55, -11.45], [7.9, -10.6], [7.3, -9.5], [6.85, -8.55], [6.95, -8.2], [6.95, -7.75], [6.3, -7.6], [0, -7.6]].map(p => new THREE.Vector2(p[0], p[1]));
  globe.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 96), baseMat));
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9b26a, metalness: 1, roughness: .22, envMap, envMapIntensity: 1.6 });
  [[8.62, -11.5, .13], [7.0, -7.95, .11], [8.15, -10.9, .05]].forEach(([r, y, t]) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 12, 128), gold); m.rotation.x = Math.PI / 2; m.position.y = y; globe.add(m); });
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.15), new THREE.MeshStandardMaterial({ map: plaqueTex('Железная дорога'), metalness: .85, roughness: .3, envMap, envMapIntensity: 1.4 }));
  plaque.position.set(0, -10.05, 7.66); plaque.rotation.x = -.43; plaque.scale.set(.85, .85, 1); globe.add(plaque);
  [[-15, 1.6, 4, 0x1f5a45], [-11.4, 1.1, 8, 0xd6ae66], [14.5, 1.35, 6, 0xb33a44]].forEach(([x, r, z, c]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), new THREE.MeshPhysicalMaterial({ color: c, metalness: .7, roughness: .14, clearcoat: 1, envMap, envMapIntensity: 1.8 })); m.position.set(x, -12.5 + r, z); globe.add(m);
    const cp = new THREE.Mesh(new THREE.CylinderGeometry(r * .22, r * .26, r * .3, 20), gold); cp.position.set(x + r * .6, -12.5 + r * 1.45, z); cp.rotation.z = -1.0; globe.add(cp);
  });
  const caustic = new THREE.Mesh(new THREE.PlaneGeometry(34, 22), new THREE.MeshBasicMaterial({ map: T_GLOW, color: HDR(.5, .4, .22), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); caustic.rotation.x = -Math.PI / 2; caustic.position.set(0, -12.48, 6); globe.add(caustic);
  { const side = []; for (let y = -7.8; y <= GROUND_Y + .45; y += .25) side.push(new THREE.Vector2(Math.sqrt(Math.max(0, 9.92 * 9.92 - y * y)), y)); globe.add(new THREE.Mesh(new THREE.LatheGeometry(side, 96), new THREE.MeshStandardMaterial({ color: 0xaab6d0, roughness: .9 }))); }
  const gSnowU = { uTime: { value: 0 }, uScale: { value: 300 }, uSpin: { value: 0 }, uFloor: { value: GROUND_Y - .1 }, uTop: { value: 9.8 }, uBox: { value: 1 }, uMode: { value: 0 }, uC: { value: V3() }, uOpacity: { value: 1 }, ...SHAKE_U() };
  { const n = LOW ? 800 : 2100, p = [], s = []; for (let i = 0; i < n; i++) { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 9.4; p.push(Math.cos(a) * r, rnd() * 20, Math.sin(a) * r); s.push(rnd(), rnd(), .22 + rnd() * .45, .05 + rnd() * rnd() * .1); } const sn = pointCloud(p, s, gSnowU, SNOW_F, SNOW_V); sn.renderOrder = 5; globe.add(sn); }
  const glassMat = LOW
    ? new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .03, transparent: true, opacity: .12, envMap, envMapIntensity: 1.4, specularIntensity: 0, depthWrite: false })
    : new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0, transmission: 1, thickness: 1.2, ior: 1.42, envMap, envMapIntensity: .8, specularIntensity: 0, depthWrite: false });
  const glass = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), glassMat); glass.renderOrder = 4; globe.add(glass);
  const rimMesh = new THREE.Mesh(new THREE.SphereGeometry(R + .02, 96, 64), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ float f = pow(1. - abs(dot(vN, vV)), 3.2);
      vec3 col = mix(vec3(.45,.6,1.), vec3(1.,.82,.55), smoothstep(-.3,.7,vN.y));
      vec3 hv = normalize(vN + vV * .0); float st = pow(max(0., dot(hv, normalize(vec3(-.5,.5,.7)))), 90.) * .75 + pow(max(0., dot(hv, normalize(vec3(.62,.3,.72)))), 160.) * .45 + smoothstep(.985, .995, dot(hv, normalize(vec3(-.42,.62,.66)))) * .25;
      float a = (f * .55 + st) * smoothstep(-8.5, -6.5, vW.y); gl_FragColor = vec4(col * a, a); }`
  })); rimMesh.renderOrder = 6; globe.add(rimMesh);

  /* ---- игрушечный мир в шаре: овал рельсов, деревня, горы, маленький поезд ---- */
  const toy = new THREE.Group(); toy.position.y = GROUND_Y; globe.add(toy);
  const RX = 6.2, RZ = 3.4, CZ = .4;
  const hToy = (x, z) => { const e = Math.hypot(x / RX, (z - CZ) / RZ); let h = .06 * Math.sin(x * 1.3) * Math.cos(z * 1.1); h += smooth(1.15, 1.6, e) * (z < CZ ? 1 : .25) * (0.4 + .3 * Math.sin(x * .9 + 1)); h += Math.max(0, -z - 3.6) * .55 * smooth(1.2, 1.5, e); return Math.max(h, 0) * (1 - (1 - smooth(.06, .18, Math.abs(e - 1))) ); };
  {
    const pos = [], idx = [], col = [], N = LOW ? 70 : 110, RR = 9.72;
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { let x = (i / N * 2 - 1) * RR, z = (j / N * 2 - 1) * RR; const r = Math.hypot(x, z); if (r > RR) { x *= RR / r; z *= RR / r; } pos.push(x, hToy(x, z), z); const v = .93 + .07 * Math.sin(x * 3 + z * 2); col.push(v, v, v + .04); }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + N + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    toy.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xe4ebf8, roughness: .85, vertexColors: true })));
  }
  // горы позади
  const rockSnow = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, flatShading: true });
  { const parts = []; [[-5.2, -6.6, 2.6, 4.8], [-1.6, -7.6, 3.4, 6.6], [2.6, -7.0, 2.9, 5.4], [5.6, -5.6, 2.2, 3.8], [-7.2, -3.6, 1.6, 2.6], [7.3, -3.0, 1.5, 2.4], [0.6, -5.4, 1.8, 3.2]].forEach(([x, z, r, h]) => { const c = new THREE.ConeGeometry(r, h, 7, 3); const p = c.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > -h / 2 + .01 && y < h / 2 - .01) { p.setX(i, p.getX(i) * (1 + (rnd() - .5) * .25)); p.setZ(i, p.getZ(i) * (1 + (rnd() - .5) * .25)); } } c.translate(x, h / 2 - .3, z); const g = c.toNonIndexed(); const cc = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < g.attributes.position.count; i++) { const y = g.attributes.position.getY(i) + .3; const s = y > h * .45 ? 1 : .35; cc.set(s > .5 ? [.95, .97, 1] : [.32, .36, .5], i * 3); } g.setAttribute('color', new THREE.BufferAttribute(cc, 3)); g.deleteAttribute('uv'); parts.push(g); }); const m = new THREE.Mesh(mergeGeometries(parts), rockSnow); m.geometry.computeVertexNormals(); toy.add(m); }
  // ёлки
  const fir = firGeo(3, 6), firMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 });
  { const L = []; for (let i = 0; i < (LOW ? 70 : 120); i++) { const a = rnd() * 6.283, r = 2 + Math.sqrt(rnd()) * 7.4, x = Math.cos(a) * r, z = Math.sin(a) * r; const e = Math.hypot(x / RX, (z - CZ) / RZ); if (Math.abs(e - 1) < .14 || (e < .55 && Math.abs(x) < 2.4) || r > 9.2) continue; L.push([x, hToy(x, z), z, .22 + rnd() * .22, rnd() * 6]); } toy.add(new THREE.Mesh(bake(fir, L), firMat)); }
  // рельсы-овал
  const LUT = []; let PER = 0; { let px = 0, pz = CZ + RZ; for (let i = 0; i <= 720; i++) { const a = i / 720 * Math.PI * 2, x = RX * Math.sin(a), z = CZ + RZ * Math.cos(a); if (i) PER += Math.hypot(x - px, z - pz); LUT.push([PER, x, z, a]); px = x; pz = z; } }
  function ovalAt(s) { s = mod(s, PER); let lo = 0, hi = LUT.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (LUT[m][0] < s) lo = m; else hi = m; } const A = LUT[lo], B = LUT[hi], t = (s - A[0]) / (B[0] - A[0] || 1); const a = A[3] + (B[3] - A[3]) * t; return { x: RX * Math.sin(a), z: CZ + RZ * Math.cos(a), dir: Math.atan2(RX * Math.cos(a), -RZ * Math.sin(a)) }; }
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa3b4, metalness: .9, roughness: .3, envMap });
  { [-.07, .07].forEach(o => { const pts = []; for (let i = 0; i <= 160; i++) { const a = i / 160 * Math.PI * 2; pts.push(V3((RX + o) * Math.sin(a), .045, CZ + (RZ + o) * Math.cos(a))); } toy.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 240, .012, 4, true), steel)); });
    const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(.05, .02, .24), new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: .9 }), 140); const d = new THREE.Object3D(); for (let i = 0; i < 140; i++) { const p = ovalAt(i / 140 * PER); d.position.set(p.x, .025, p.z); d.rotation.set(0, p.dir + Math.PI / 2, 0); d.updateMatrix(); sl.setMatrixAt(i, d.matrix); } toy.add(sl); }
  // деревня в овале
  const winMatT = new THREE.MeshBasicMaterial({ color: HDR(3, 1.9, .8) });
  const houseCols = [0x7a2a24, 0x2c4a6a, 0x6b4a2a, 0x2f5a46, 0x8a6a3a];
  const roofSnow = new THREE.MeshStandardMaterial({ color: 0xf4f7ff, roughness: .7, flatShading: true });
  const toyBulbs = [];
  [[-3.2, -.4, .5], [-1.8, 1.2, -.3], [2.2, -.6, .4], [3.4, .9, -.6], [-.2, -1.4, .1], [1.1, 1.6, .9]].forEach(([x, z, ry], i) => {
    const h = new THREE.Group(); h.position.set(x, hToy(x, z), z); h.rotation.y = ry; toy.add(h);
    const w = .5 + (i % 2) * .14, d = .42;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, .36, d), new THREE.MeshStandardMaterial({ color: houseCols[i % 5], roughness: .8 })); b.position.y = .18; h.add(b);
    const rf = new THREE.Mesh(prism(d * .62, w + .1), roofSnow); rf.position.y = .46; rf.scale.set(1, .75, 1); h.add(rf);
    [-1, 1].forEach(s => { const wn = new THREE.Mesh(new THREE.PlaneGeometry(.09, .1), winMatT); wn.position.set(s * w * .22, .2, d / 2 + .002); h.add(wn); const wb = wn.clone(); wb.position.z = -d / 2 - .002; wb.rotation.y = Math.PI; h.add(wb); });
  });
  { const tg = new THREE.Mesh(fir, firMat); tg.position.set(.4, hToy(.4, .2), .2); tg.scale.setScalar(.55); toy.add(tg); for (let i = 0; i < 26; i++) { const k = i / 26, y = .3 + k * 1.1, r = (1 - k) * .42 + .03, a = k * 6.283 * 4; toyBulbs.push(V3(.4 + Math.cos(a) * r, tg.position.y + y, .2 + Math.sin(a) * r)); } }
  const toyBulbMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(.022, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }), toyBulbs.length + 40); toyBulbMesh.frustumCulled = false; toy.add(toyBulbMesh);
  // станция: платформа и фонарь
  { const pl = new THREE.Mesh(new THREE.BoxGeometry(2.4, .08, .5), new THREE.MeshStandardMaterial({ color: 0x6a5a4a, roughness: .9 })); pl.position.set(-2.6, .04, CZ + RZ + .55); pl.rotation.y = .32; toy.add(pl); const lp = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), new THREE.MeshBasicMaterial({ color: HDR(4, 2.8, 1.3) })); lp.position.set(-2.1, .6, CZ + RZ + .75); toy.add(lp); const post = new THREE.Mesh(new THREE.CylinderGeometry(.012, .016, .58, 5), new THREE.MeshStandardMaterial({ color: 0x1c2232 })); post.position.set(-2.1, .29, CZ + RZ + .75); toy.add(post); const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: T_GLOW, color: 0xffc77a, transparent: true, opacity: .6, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.set(.7, .7, 1); gl.position.copy(lp.position); toy.add(gl); }
  // маленький поезд
  const trainCars = [], LOCO_L = .95, CAR_LEN = .8, GAP = .07;
  const bodyRed = new THREE.MeshPhysicalMaterial({ color: 0x6e1620, roughness: .35, clearcoat: 1, clearcoatRoughness: .15, envMap, envMapIntensity: 1 });
  const bodyGreen = new THREE.MeshPhysicalMaterial({ color: 0x163a2e, roughness: .35, clearcoat: 1, clearcoatRoughness: .15, envMap, envMapIntensity: 1 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: .6 });
  const winStrip = new THREE.MeshBasicMaterial({ color: HDR(2.6, 1.7, .8) });
  const darkM = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: .6, metalness: .4 });
  function miniCar() { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(CAR_LEN, .2, .3), bodyRed); b.position.y = .17; g.add(b); const u = new THREE.Mesh(new THREE.BoxGeometry(CAR_LEN, .1, .3), cream); u.position.y = .31; g.add(u); const rg = new THREE.CylinderGeometry(.17, .17, CAR_LEN + .02, 12, 1, false, -1.1, 2.2); rg.rotateX(-Math.PI / 2); rg.rotateY(Math.PI / 2); const rf = new THREE.Mesh(rg, roofSnow); rf.position.y = .2; g.add(rf); [-1, 1].forEach(s => { const w = new THREE.Mesh(new THREE.PlaneGeometry(CAR_LEN * .86, .075), winStrip); w.position.set(0, .22, s * .152); if (s < 0) w.rotation.y = Math.PI; g.add(w); }); [-1, 1].forEach(s => { const wh = new THREE.Mesh(new THREE.BoxGeometry(.22, .06, .26), darkM); wh.position.set(s * CAR_LEN * .3, .05, 0); g.add(wh); }); return g; }
  { const loco = new THREE.Group(); const boiler = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, .6, 16), bodyGreen); boiler.rotation.z = Math.PI / 2; boiler.position.set(.14, .2, 0); loco.add(boiler); const cab = new THREE.Mesh(new THREE.BoxGeometry(.32, .32, .3), bodyGreen); cab.position.set(-.26, .25, 0); loco.add(cab); const cr = new THREE.Mesh(new THREE.BoxGeometry(.38, .04, .34), cream); cr.position.set(-.26, .43, 0); loco.add(cr); const ch = new THREE.Mesh(new THREE.CylinderGeometry(.045, .03, .16, 10), darkM); ch.position.set(.32, .38, 0); loco.add(ch); const lamp = new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 6), new THREE.MeshBasicMaterial({ color: HDR(5, 4, 2.4) })); lamp.position.set(.45, .24, 0); loco.add(lamp); const bnd = new THREE.Mesh(new THREE.TorusGeometry(.122, .008, 6, 24), gold); bnd.rotation.y = Math.PI / 2; bnd.position.set(.0, .2, 0); loco.add(bnd); const bnd2 = bnd.clone(); bnd2.position.x = .3; loco.add(bnd2); const wr = new THREE.Mesh(new THREE.TorusGeometry(.06, .02, 6, 16), new THREE.MeshStandardMaterial({ color: 0x1f5a3e, roughness: .8 })); wr.position.set(.44, .22, 0); wr.rotation.y = Math.PI / 2; loco.add(wr); const wh = new THREE.Mesh(new THREE.BoxGeometry(.7, .08, .26), darkM); wh.position.set(0, .05, 0); loco.add(wh); const cw = new THREE.Mesh(new THREE.PlaneGeometry(.12, .1), winStrip); cw.position.set(-.26, .3, .152); loco.add(cw); toy.add(loco); trainCars.push({ g: loco, off: 0 }); }
  for (let j = 0; j < 4; j++) { const c = miniCar(); toy.add(c); trainCars.push({ g: c, off: LOCO_L / 2 + GAP + CAR_LEN / 2 + j * (CAR_LEN + GAP) }); }
  const smoke = []; for (let i = 0; i < 10; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: T_GLOW, color: 0xdfe6f5, transparent: true, opacity: 0, depthWrite: false })); s.userData.t = i / 10; toy.add(s); smoke.push(s); }
  const CAR0_OFF = trainCars[1].off; let trainS = CAR0_OFF + 3;
  function placeTrain(t) {
    trainCars.forEach(c => { const p = ovalAt(trainS - c.off); c.g.position.set(p.x, .04, p.z); c.g.rotation.y = p.dir - Math.PI / 2; });
    const L = trainCars[0].g; smoke.forEach(s => { s.userData.t = (s.userData.t + .004) % 1; const k = s.userData.t; if (k < .01) { const p = V3(.32, .5, 0).applyMatrix4(L.matrixWorld); s.userData.p = p.sub(V3(0, GROUND_Y, 0)); } if (s.userData.p) { s.position.copy(s.userData.p).add(V3(0, k * 1.1, 0)); s.scale.setScalar(.08 + k * .3); s.material.opacity = .22 * smooth(0, .1, k) * (1 - k); } });
    let n = 0; const d = new THREE.Object3D(); toyBulbs.forEach(p => { d.position.copy(p); d.updateMatrix(); toyBulbMesh.setMatrixAt(n, d.matrix); toyBulbMesh.setColorAt(n, [HDR(3, 2, .7), HDR(3, .8, .6), HDR(1, 2.4, 1.2), HDR(3, 2.6, 1.8)][n % 4].clone().multiplyScalar(.7 + .3 * Math.sin(t * 2 + n))); n++; });
    trainCars.slice(1).forEach((c, j) => { for (let k = 0; k < 8; k++) { d.position.set(-CAR_LEN / 2 + (k + .5) * CAR_LEN / 8, .36, (k % 2 ? 1 : -1) * .14).applyMatrix4(c.g.matrix); d.updateMatrix(); toyBulbMesh.setMatrixAt(n, d.matrix); toyBulbMesh.setColorAt(n, (k + j) % 3 ? HDR(3, 2, .7) : HDR(3, .9, .5)); n++; } });
    toyBulbMesh.count = n; toyBulbMesh.instanceMatrix.needsUpdate = true; if (toyBulbMesh.instanceColor) toyBulbMesh.instanceColor.needsUpdate = true;
  }

  /* ===== ВНУТРИ: настоящий поезд и пейзаж ===== */
  const inside = new THREE.Group(); inside.visible = false; scene.add(inside);
  const land = new THREE.Group(); inside.add(land);
  const layers = [];
  function layer(L, buildTile) { const g = new THREE.Group(), tile = new THREE.Group(); buildTile(tile); [-1, 0, 1].forEach(o => { const c = o ? tile.clone() : tile; c.position.x = o * L; g.add(c); }); land.add(g); layers.push({ g, L }); return g; }
  // небо: вечер, догорающая заря над горами, луна над деревнями
  const skyU = { uTime: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1900, 48, 24), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `varying vec3 vP; void main(){ vec3 d = normalize(vP); float h = d.y;
      vec3 top = vec3(.012,.02,.065), mid = vec3(.07,.085,.2), hor = vec3(.22,.2,.34);
      vec3 c = mix(hor, mid, smoothstep(-.02,.16,h)); c = mix(c, top, smoothstep(.14,.7,h));
      float glow = pow(max(0., dot(normalize(vec3(d.x*.35, 0., d.z)), vec3(0.,0.,-1.))), 3.) * (1. - smoothstep(-.02,.32,h));
      c += vec3(.75,.36,.22) * glow * .55 + vec3(.5,.28,.35) * glow * smoothstep(.3,.05,h) * .3;
      c += vec3(.12,.14,.25) * pow(max(0., dot(d, normalize(vec3(.3,.55,.8)))), 6.) * .6;
      gl_FragColor = vec4(c, 1.); }`
  })); sky.renderOrder = -9; inside.add(sky);
  const starU = { uTime: { value: 0 }, uScale: { value: 300 }, uOpacity: { value: 1 }, uGain: { value: 1.6 }, uColor: { value: HDR(1, .95, .88) } };
  let stars; { const n = LOW ? 500 : 1200, p = [], s = []; for (let i = 0; i < n; i++) { const u = rnd() * Math.PI * 2, y = .12 + Math.pow(rnd(), .7) * .88, rr = Math.sqrt(1 - y * y); p.push(Math.cos(u) * rr * 1700, y * 1700, Math.sin(u) * rr * 1700); s.push(.6 + rnd() * 2.2, rnd() * 6.3, 1 + rnd() * 3, rnd() < .05 ? 5 : 1.4 + rnd() * 2); } stars = pointCloud(p, s, starU); stars.renderOrder = -8; inside.add(stars); }
  const moonSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: T_GLOW, color: 0xcfdcff, transparent: true, opacity: .8, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); moonSp.scale.set(420, 420, 1); inside.add(moonSp);
  const moonD = new THREE.Mesh(new THREE.CircleGeometry(38, 32), new THREE.MeshBasicMaterial({ color: HDR(2.2, 2.25, 2.4), fog: false })); inside.add(moonD);
  const MOON_DIR = V3(.28, .42, .86).normalize();
  const hemi = new THREE.HemisphereLight(0x8a9ad0, 0x2a2232, .6); inside.add(hemi);
  const moonL = new THREE.DirectionalLight(0xbfd0ff, .75); moonL.position.set(30, 60, 100); inside.add(moonL);
  const duskL = new THREE.DirectionalLight(0xff9f80, .55); duskL.position.set(-10, 12, -100); inside.add(duskL);
  // земля: снег, текстура плывёт назад — поезд едет
  const groundTex = snowTex(); groundTex.repeat.set(500, 500);
  const groundM = new THREE.MeshStandardMaterial({ color: 0xc2cbe2, map: groundTex, roughness: .95 });
  const groundP = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), groundM); groundP.rotation.x = -Math.PI / 2; groundP.position.set(MID_X, TRACK_Y - .05, 0); inside.add(groundP);
  const landMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92 });
  const firFar = firGeo(2, 5, '#0f2e24', '#143829'), firNear = firGeo(4, 7);
  // полоса гор (дальний план)
  function ridge(L, z0, z1, NX, NZ, hmax, side) {
    const nA = pnoise(L, 7, 1), nB = pnoise(L, 13, .35); const pos = [], idx = [];
    for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { const x = i / NX * L, t = j / NZ, z = side * (z0 + (z1 - z0) * t); const pk = .45 + .15 * Math.sin(x * 6.283 * 3 / L); const env = Math.pow(Math.max(0, Math.sin(Math.PI * clamp((t - .02) / .96, 0, 1))), .8) * (1 - .55 * Math.abs(t - pk)); const b = nB(x, z), n = .55 + nA(x, z * .3) * .6 + Math.sqrt(b * b + .004) * .45; pos.push(x, TRACK_Y + Math.max(0, env * n) * hmax * (t < .03 ? 0 : 1), z); }
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + NX + 1; if (side < 0) idx.push(a, a + 1, b, b, a + 1, b + 1); else idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const Pp = g.attributes.position, Nn = g.attributes.normal, c = new Float32Array(Pp.count * 3);
    for (let i = 0; i < Pp.count; i++) { const y = Pp.getY(i) - TRACK_Y, ny = Nn.getY(i); const rock = smooth(.72, .45, ny) * smooth(hmax * .05, hmax * .15, y) * .8; const s = .86 + .14 * smooth(0, hmax * .35, y); c.set([s * .95 + (.3 - s * .95) * rock, s * .97 + (.33 - s * .97) * rock, s * 1.03 + (.46 - s * 1.03) * rock], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
  }
  const FAR_L = 2400, MIDL = 600, NEAR_L = 240;
  const villU = { uTime: { value: 0 }, uScale: { value: 300 }, uOpacity: { value: 1 }, uGain: { value: 2.6 }, uColor: { value: HDR(1, .72, .38) } };
  const treeLU = { uTime: { value: 0 }, uScale: { value: 300 }, uOpacity: { value: 1 }, uGain: { value: 3 }, uColor: { value: HDR(1, .8, .5) } };
  layer(FAR_L, t => {
    t.add(new THREE.Mesh(ridge(FAR_L, 230, 1000, LOW ? 140 : 220, LOW ? 10 : 16, 380, -1), landMat));
    t.add(new THREE.Mesh(ridge(FAR_L, 320, 1150, LOW ? 120 : 180, LOW ? 8 : 12, 300, 1), landMat));
    // огни далёких деревень у подножий: мерцающие точки
    const p = [], s = []; for (let v = 0; v < 9; v++) { const cx = rnd() * FAR_L, cz = (v % 3 ? 1 : -1) * (300 + rnd() * 160), n = 14 + Math.floor(rnd() * 22); for (let i = 0; i < n; i++) { p.push(cx + (rnd() - .5) * 90, TRACK_Y + 2 + rnd() * 8, cz + (rnd() - .5) * 50); s.push(.4 + rnd() * 1.4, rnd() * 6.3, 2 + rnd() * 3, 9 + rnd() * 14); } }
    t.add(pointCloud(p, s, villU));
  });
  // средний план: холмы с лесом, деревни с окнами
  const houseGeo = (() => { const b = paint(new THREE.BoxGeometry(6, 4, 5), '#6a3a2a'); b.translate(0, 2, 0); const rf = paint(prism(3.6, 7), '#f2f5ff'); rf.scale(1, .8, 1); rf.translate(0, 5.3, 0); return mergeGeometries([b, rf]); })();
  const winGeo = (() => { const parts = []; [[-1.5, 1.7], [1.5, 1.7]].forEach(([x, y]) => { const p = new THREE.PlaneGeometry(1.1, 1.3); p.translate(x, y, 2.52); parts.push(p); const q = p.clone(); q.rotateY(Math.PI); parts.push(q); }); return mergeGeometries(parts); })();
  const winMatL = new THREE.MeshBasicMaterial({ color: HDR(2.6, 1.55, .6), fog: true });
  const glowM = new THREE.SpriteMaterial({ map: T_GLOW, color: 0xffb060, transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending });
  layer(MIDL, t => {
    [-1, 1].forEach(side => {
      const hN = pnoise(MIDL, 6, 1); const NX = LOW ? 90 : 140, NZ = 18, z0 = 26, z1 = 200; const pos = [], idx = [], col = [];
      const hf = (x, z) => { const d = Math.abs(z); return smooth(z0, z0 + 50, d) * (5 + 10 * (hN(x, z * .5) * .5 + .5)) + smooth(120, 200, d) * 8; };
      for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { const x = i / NX * MIDL, z = side * (z0 + (z1 - z0) * Math.pow(j / NZ, 1.3)); pos.push(x, TRACK_Y + hf(x, z), z); const v = .88 + .08 * Math.sin(x * .05 + z * .03); col.push(v, v + .02, v + .07); }
      for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + NX + 1; if (side < 0) idx.push(a, a + 1, b, b, a + 1, b + 1); else idx.push(a, b, a + 1, a + 1, b, b + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); t.add(new THREE.Mesh(g, landMat));
      // лес
      const L = []; for (let i = 0; i < (LOW ? 260 : 460); i++) { const x = rnd() * MIDL, z = side * (z0 + 6 + rnd() * 150); if (Math.sin(x * .021 + side) > .3 && Math.abs(z) < 110) continue; L.push([x, TRACK_Y + hf(x, z) - .3, z, 4 + rnd() * 4.5, rnd() * 6]); } t.add(new THREE.Mesh(bake(firFar, L), landMat));
      // деревни
      const H = [], Wn = []; const villages = side > 0 ? [[90, 48], [330, 62], [500, 40]] : [[220, 70]];
      villages.forEach(([vx, vz]) => { for (let i = 0; i < 9; i++) { const x = vx + (rnd() - .5) * 60, z = side * (vz + (rnd() - .5) * 22); const y = TRACK_Y + hf(x, z) - 1.2, ry = (rnd() - .5) * .8, s = .9 + rnd() * .4; H.push([x, y, z, s, ry]); Wn.push([x, y, z, s, ry]); if (i % 3 === 0) { const sp = new THREE.Sprite(glowM); sp.position.set(x, y + 3, z + side * 3.2); sp.scale.set(16, 16, 1); t.add(sp); } } const tx = vx, tz = side * vz, ty = TRACK_Y + hf(tx, tz); const tree = new THREE.Mesh(firNear, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 })); tree.position.set(tx, ty, tz); tree.scale.setScalar(4.2); t.add(tree); const p = [], s = []; for (let k = 0; k < 40; k++) { const kk = k / 40, y = 1 + kk * 8.5, r = (1 - kk) * 3.1 + .2, a = kk * 6.283 * 5; p.push(tx + Math.cos(a) * r, ty + y, tz + Math.sin(a) * r); s.push(1 + rnd() * 2, rnd() * 6.3, 2, 6 + rnd() * 4); } t.add(pointCloud(p, s, treeLU)); });
      if (H.length) { t.add(new THREE.Mesh(bake(houseGeo, H), landMat)); t.add(new THREE.Mesh(bake(winGeo, Wn), winMatL)); }
    });
  });
  // ближний план: ели, столбы с проводами, сугробы
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: .9 });
  layer(NEAR_L, t => {
    [-1, 1].forEach(side => {
      const L = []; for (let i = 0; i < (LOW ? 45 : 70); i++) { const x = rnd() * NEAR_L; if (Math.sin(x * .045 + side * 2) > .2) continue; const z = side * (8 + Math.pow(rnd(), .7) * 22); L.push([x, TRACK_Y - .1, z, 1.1 + rnd() * 1.9, rnd() * 6]); } t.add(new THREE.Mesh(bake(firNear, L), landMat));
      const mounds = []; for (let i = 0; i < 40; i++) mounds.push([rnd() * NEAR_L, TRACK_Y - .25, side * (3 + rnd() * 6), .6 + rnd() * 1.2, rnd() * 6, .35]); { const mg = new THREE.SphereGeometry(1, 16, 8, 0, 6.3, 0, 1.6); mg.deleteAttribute('uv'); const cc = new Float32Array(mg.attributes.position.count * 3).fill(.93); mg.setAttribute('color', new THREE.BufferAttribute(cc, 3)); t.add(new THREE.Mesh(bake(mg, mounds), landMat)); }
    });
    // телеграфные столбы со стороны деревень
    const poles = []; for (let x = 0; x < NEAR_L; x += 40) poles.push(x);
    poles.forEach(x => { const p = new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, 7, 6), poleMat); p.position.set(x, TRACK_Y + 3.5, 4.4); t.add(p); const cb = new THREE.Mesh(new THREE.BoxGeometry(.12, .12, 1.4), poleMat); cb.position.set(x, TRACK_Y + 6.6, 4.4); t.add(cb); });
    const wm = new THREE.LineBasicMaterial({ color: 0x141a24, transparent: true, opacity: .8 });
    [-.55, .55].forEach(o => { const pts = []; poles.concat([NEAR_L]).forEach((x, i, a) => { if (!i) return; const x0 = a[i - 1]; for (let k = 0; k <= 12; k++) { const tt = k / 12; pts.push(V3(x0 + (x - x0) * tt, TRACK_Y + 6.7 - Math.sin(tt * Math.PI) * .7, 4.4 + o)); } }); t.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wm)); });
  });
  // пути: шпалы бегут (видно из заднего окна и вниз из боковых)
  const sleeperGeo = new THREE.BoxGeometry(.25, .12, 2.6);
  layer(30, t => { const L = []; for (let x = 0; x < 30; x += .75) L.push([x, TRACK_Y + .02, 0, 1, 0]); for (let x = 0; x < 30; x += .75) L.push([x, TRACK_Y + .02, -4.6, 1, 0]); t.add(new THREE.Mesh(bake(paint(sleeperGeo, '#3d2c22'), L), landMat)); });
  [-.72, .72, -3.88, -5.32].forEach(z => { const r = new THREE.Mesh(new THREE.BoxGeometry(2400, .12, .08), steel); r.position.set(MID_X - 1000, TRACK_Y + .14, z); inside.add(r); });
  // снег за окнами: летит назад и вниз
  const outSnowU = { uTime: { value: 0 }, uScale: { value: 300 }, uV: { value: V_TRAIN }, uOpacity: { value: 1 }, ...SHAKE_U() };
  {
    const n = LOW ? 1800 : 4500, p = [], s = []; for (let i = 0; i < n; i++) { p.push(rnd() * 120, rnd() * 12, (rnd() < .5 ? -1 : 1) * (1.7 + Math.pow(rnd(), 1.4) * 28)); s.push(rnd(), rnd(), .6 + rnd() * .8, .03 + rnd() * .05); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('aSeed', new THREE.Float32BufferAttribute(s, 4));
    const m = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: outSnowU, transparent: true, depthWrite: false, fog: false,
      vertexShader: `uniform float uTime, uScale, uV, uFall, uLift, uShake; attribute vec4 aSeed; varying float vA; void main(){ vec3 p = position; float dens = fract(aSeed.x * 7.31 + aSeed.y * 3.17), turb = 1. + 3.2 * uShake; p.x = mod(p.x - uTime * uV * (.7 + aSeed.x * .3), 120.) - 87.; p.y = mod(p.y - uFall * aSeed.z * 1.3 + uLift * (.45 + aSeed.y * 1.1) * .8, 12.) - 1.6; p.y = mix(p.y, 1.9 + (p.y - 4.4) * .3, uShake * .7); p.z += sin(uTime * (.8 + uShake) + aSeed.y * 9.) * .3 * turb; p.x += cos(uTime * (.7 + uShake) + aSeed.x * 11.) * .25 * turb * uShake; p.z = sign(p.z) * max(1.7, abs(p.z) * mix(1., .3, uShake)); vec4 mv = modelViewMatrix * vec4(p, 1.); vA = smoothstep(0., 1.5, -mv.z) * (1. - smoothstep(18., 30., -mv.z)) * clamp((.78 + .22 * uShake - dens) * 20., 0., 1.); gl_PointSize = aSeed.w * uScale * (1. + .9 * uShake) / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uOpacity; varying float vA; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .1, d) * vA * uOpacity * .85; if (a < .01) discard; gl_FragColor = vec4(vec3(1., .97, .95) * 1.1, a); }` }));
    m.frustumCulled = false; m.renderOrder = 3; inside.add(m);
  }

  /* ---- вагоны ---- */
  const train = new THREE.Group(); inside.add(train);
  const woodPanel = new THREE.MeshStandardMaterial({ map: woodTex('#5a2416', '#2e0f08', '#7d3c22'), roughness: .42, metalness: .05, envMap, envMapIntensity: .35 }); woodPanel.map.repeat.set(4, 1);
  const woodDark = new THREE.MeshStandardMaterial({ map: woodTex('#3a1a10', '#1a0905', '#5a2a18'), roughness: .5, envMap, envMapIntensity: .25 });
  const creamM = new THREE.MeshStandardMaterial({ map: creamTex(), roughness: .8 }); creamM.map.repeat.set(16, 1.4);
  const ceilM = new THREE.MeshStandardMaterial({ map: ceilTex(), roughness: .85, side: THREE.DoubleSide, emissive: 0x2a1a0a, emissiveIntensity: .12 }); ceilM.map.repeat.set(5, 1);
  const carpetM = new THREE.MeshStandardMaterial({ map: carpetTex(), roughness: .95 }); carpetM.map.repeat.set(1, 10);
  const floorM = new THREE.MeshStandardMaterial({ map: woodTex('#3b2414', '#1e1008', '#5a3820'), roughness: .55, envMap, envMapIntensity: .3 }); floorM.map.repeat.set(6, 3);
  const velvetR = new THREE.MeshStandardMaterial({ map: velvetTex('#5e1520', '#3a0a10', '#7a2530'), roughness: .9 });
  const velvetG = new THREE.MeshStandardMaterial({ map: velvetTex('#173f33', '#0b241c', '#245a48'), roughness: .9 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xd2a860, metalness: 1, roughness: .28, envMap, envMapIntensity: 1.4 });
  const frostGlass = new THREE.MeshBasicMaterial({ map: frostEdgeTex(), transparent: true, depthWrite: false, color: 0xdfe9ff, side: THREE.DoubleSide });
  const curtainGeo = (() => { const g = new THREE.PlaneGeometry(.34, 1.3, 14, 6); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); const tie = 1 - .45 * Math.exp(-Math.pow((y + .2) / .12, 2)); p.setX(i, x * tie); p.setZ(i, Math.sin((x + .17) * Math.PI * 2 / .085) * .028 * tie + .04 * (1 - tie)); } g.computeVertexNormals(); return g; })();
  const curtainM = new THREE.MeshStandardMaterial({ color: 0x6a1420, roughness: .85, side: THREE.DoubleSide, map: velvetR.map });
  const curtainList = [], sconceList = [], lampList = [];
  const needles = needleTex(); needles.repeat.set(40, 1);
  const hvoyaM = new THREE.MeshStandardMaterial({ map: needles, roughness: .85, color: 0xffffff, emissive: 0x0c2416, emissiveIntensity: .6 });
  const ballMs = [0xb33a44, 0xd6ae66, 0x2c5f8a, 0xe9e2d0, 0x1f5a45].map(c => new THREE.MeshPhysicalMaterial({ color: c, metalness: .6, roughness: .16, clearcoat: 1, envMap, envMapIntensity: 1.7 }));
  const BULB_MAX = 900, bulbData = []; const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), BULB_MAX); bulbs.count = 0; bulbs.frustumCulled = false; train.add(bulbs);
  const PAL = [HDR(2.6, 1.7, .62), HDR(2.7, 1.95, .95), HDR(2.5, 1.1, .32), HDR(2.4, .62, .58), HDR(1.2, 2.2, 1.1)];
  const dm = new THREE.Object3D();
  function bulb(p, size, col, order, car) { if (bulbs.count >= BULB_MAX) return; const i = bulbs.count++; dm.position.copy(p); dm.scale.setScalar(size); dm.rotation.set(0, 0, 0); dm.updateMatrix(); bulbs.setMatrixAt(i, dm.matrix); bulbData.push({ c: col.clone(), order, car, ph: rnd() * 6.3 }); bulbs.setColorAt(i, col); }
  const obst = [];                                  // [x0,x1,z0,z1] в мировых координатах
  const swingers = [];                              // всё, что качается от хода поезда
  const carGroups = [], wake = CARS.map(() => ({ lv: 0, tg: 0 })), stations = [], clickables = [];
  function add(parent, geo, mat, x, y, z, ry) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (ry) m.rotation.y = ry; parent.add(m); return m; }
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  function garlandHvoya(cg, cx, z, y, x0, x1, nSag, k, sag = .14) {
    const pts = []; const N = nSag * 8; for (let i = 0; i <= N; i++) { const t = i / N, x = x0 + (x1 - x0) * t, ph = (t * nSag) % 1; pts.push(V3(x, y - Math.sin(ph * Math.PI) * sag, z)); }
    const curve = new THREE.CatmullRomCurve3(pts); add(cg, new THREE.TubeGeometry(curve, N * 3, .055, 6), hvoyaM, 0, 0, 0);
    const c2 = new THREE.CatmullRomCurve3(pts.map((p, i) => p.clone().add(V3(0, Math.sin(i * 1.7) * .02, Math.cos(i * 1.3) * .02)))); add(cg, new THREE.TubeGeometry(c2, N * 3, .045, 5), hvoyaM, 0, 0, 0);
    for (let i = 0; i < nSag; i++) { const t = (i + .5) / nSag, p = curve.getPoint(t); const b = add(cg, new THREE.SphereGeometry(.05, 14, 10), ballMs[(i + k) % 5], p.x, p.y - .09, p.z); swingers.push({ m: b, base: b.position.clone(), len: .09, ph: rnd() * 6 }); }
    for (let i = 0; i <= nSag * 4; i++) { const t = i / (nSag * 4), p = curve.getPoint(t); bulb(V3(p.x + cx, p.y - .03, p.z + (rnd() - .5) * .06), .022, PAL[(i + k) % 5], t, carGroups.indexOf(cg)); }
  }
  function makeCar(k) {
    const def = CARS[k], cx = carX(k), cg = new THREE.Group(); cg.position.x = cx; train.add(cg); carGroups.push(cg);
    const big = def.big, wy0 = big ? .62 : .9, wy1 = big ? 2.1 : 1.85, ww = big ? 1.72 : 1.25, WXS = [-6, -4, -2, 0, 2, 4, 6];
    add(cg, B(16, .06, 2.9), floorM, 0, -.03, 0);
    const cp = add(cg, new THREE.PlaneGeometry(1.05, 15.8), carpetM, 0, .003, 0); cp.rotation.x = -Math.PI / 2; cp.rotation.z = Math.PI / 2;
    [-1, 1].forEach(s => {
      const z = s * (IN_W + .05);
      add(cg, B(16, wy0, .1), woodPanel, 0, wy0 / 2, z);
      add(cg, B(16, 2.34 - wy1, .1), creamM, 0, (wy1 + 2.34) / 2, z);
      const edges = [-8]; WXS.forEach(x => { edges.push(x - ww / 2, x + ww / 2); }); edges.push(8);
      for (let i = 0; i < edges.length; i += 2) { const a = edges[i], b = edges[i + 1]; add(cg, B(b - a, wy1 - wy0, .1), woodPanel, (a + b) / 2, (wy0 + wy1) / 2, z); }
      add(cg, B(16, .05, .14), brass, 0, 2.34, s * (IN_W - .02));
      add(cg, B(16, .07, .12), woodDark, 0, .06, s * (IN_W - .02));
      WXS.forEach((x, wi) => {
        const gl = add(cg, new THREE.PlaneGeometry(ww, wy1 - wy0), frostGlass, x, (wy0 + wy1) / 2, s * (IN_W + .02)); gl.rotation.y = s > 0 ? Math.PI : 0; gl.renderOrder = 2;
        add(cg, B(ww + .12, .045, .16), woodDark, x, wy0 - .01, s * (IN_W - .03));
        [[0, wy1 + .015, ww + .06, .03], [0, wy0 + .015, ww + .06, .03]].forEach(([ox, oy, w, h]) => add(cg, B(w, h, .03), brass, x + ox, oy, s * (IN_W - .015)));
        [-1, 1].forEach(e => { add(cg, B(.03, wy1 - wy0, .03), brass, x + e * (ww / 2 + .015), (wy0 + wy1) / 2, s * (IN_W - .015)); curtainList.push([cx + x + e * (ww / 2 + .1), wy0 + .02 + .65 + (big ? .1 : 0), s * (IN_W - .07), s > 0 ? Math.PI : 0]); });
        if (wi < WXS.length - 1) sconceList.push([cx + x + 1, 1.98 + (big ? .14 : 0), s * (IN_W - .1)]);
      });
      // багажная полка
      if (!big) { [IN_W - .12, IN_W - .42].forEach(zz => { const r = add(cg, new THREE.CylinderGeometry(.015, .015, 15.6, 6), brass, 0, 2.12, s * zz); r.rotation.z = Math.PI / 2; }); for (let x = -7; x <= 7; x += 2) add(cg, B(.02, .1, .34), brass, x, 2.17, s * (IN_W - .27)); }
      garlandHvoya(cg, cx, s * (IN_W - .1), 2.27, -7.8, 7.8, 8, k + (s > 0 ? 2 : 0));
    });
    // потолок-арка
    { const r = 2.56, c = .19, a0 = Math.asin(1.5 / r), N = 18, pos = [], uv = [], idx = []; for (let i = 0; i <= N; i++) { const a = -a0 + 2 * a0 * i / N; [-8, 8].forEach((x, j) => { pos.push(x, c + r * Math.cos(a), r * Math.sin(a)); uv.push(j, i / N); }); } for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); add(cg, g, ceilM, 0, 0, 0); }
    [-6, -2, 2, 6].forEach(x => { lampList.push([cx + x, 2.6]); add(cg, new THREE.CylinderGeometry(.16, .2, .04, 16), brass, x, 2.7, 0); });
    // торцы с дверями
    [-1, 1].forEach(e => {
      const x = e * (HALF - .03);
      const rearPanorama = k === CAR_N - 1 && e < 0, toLoco = k === 0 && e > 0;
      if (rearPanorama) {
        add(cg, B(.1, .62, 2.9), woodPanel, x, .31, 0); add(cg, B(.1, .7, 2.9), creamM, x, 2.45, 0);
        [-1, 1].forEach(s => add(cg, B(.1, 1.48, .35), woodPanel, x, 1.36, s * 1.28));
        const gl = add(cg, new THREE.PlaneGeometry(2.2, 1.48), frostGlass, x - .03, 1.36, 0); gl.rotation.y = Math.PI / 2; gl.renderOrder = 2;
        add(cg, B(.03, .03, 2.25), brass, x + .05, 2.11, 0); add(cg, B(.03, .03, 2.25), brass, x + .05, .62, 0);
        return;
      }
      [-1, 1].forEach(s => add(cg, B(.1, 2.8, 1.05), woodPanel, x, 1.4, s * .98));
      add(cg, B(.1, .75, .9), creamM, x, 2.43, 0);
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(.9, .22), new THREE.MeshStandardMaterial({ map: plaqueTex(toLoco ? 'Локомотив' : (e > 0 ? CARS[k - 1].name : CARS[k + 1].name), toLoco ? '' : ('вагон ' + (e > 0 ? k : k + 2))), metalness: .8, roughness: .3, envMap, envMapIntensity: 1.3 }));
      pl.position.set(x - e * .06, 2.24, 0); pl.rotation.y = -e * Math.PI / 2; cg.add(pl);
      // дверь: дерево снизу, стекло сверху, венок
      const door = new THREE.Group(); door.position.set(x - e * .07, 0, 0); cg.add(door);
      add(door, B(.05, 1.0, .82), woodPanel, 0, .5, 0); add(door, B(.05, .2, .82), woodPanel, 0, 1.95, 0);
      [-1, 1].forEach(s => add(door, B(.05, .85, .1), woodPanel, 0, 1.42, s * .36));
      const dg = add(door, new THREE.PlaneGeometry(.62, .85), frostGlass, 0, 1.42, 0); dg.rotation.y = Math.PI / 2;
      const hd = add(door, new THREE.CylinderGeometry(.015, .015, .18, 6), brass, -e * .05, 1.02, .3);
      const wr = add(door, new THREE.TorusGeometry(.16, .045, 8, 24), hvoyaM, -e * .04, 1.45, 0); wr.rotation.y = Math.PI / 2;
      const bow = add(door, new THREE.SphereGeometry(.045, 10, 8), ballMs[0], -e * .07, 1.3, 0); bow.scale.set(.6, .8, 1.5);
      for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; bulb(V3(cx + x - e * .11, 1.45 + Math.sin(a) * .16, Math.cos(a) * .16), .016, PAL[i % 5], i / 10, k); }
      if (!toLoco) { const gi = e > 0 ? k - 1 : k; (doors[gi] = doors[gi] || []).push(door); }
    });
    // гармошка-переход к следующему вагону
    if (k < CAR_N - 1) { const gx = cx - 9; const bt = bellowsTex(); bt.repeat.set(3, 1); const bm = new THREE.MeshStandardMaterial({ map: bt, roughness: .9 }); add(train, B(2.1, .06, 1.2), woodDark, gx, -.03, 0); [-1, 1].forEach(s => add(train, B(2.1, 2.3, .05), bm, gx, 1.15, s * .6)); add(train, B(2.1, .05, 1.2), bm, gx, 2.3, 0); const lp = add(train, new THREE.SphereGeometry(.06, 10, 8), new THREE.MeshBasicMaterial({ color: HDR(3, 2, 1) }), gx, 2.18, 0); }
    return { cg, cx };
  }
  const doors = [];
  for (let k = 0; k < CAR_N; k++) makeCar(k);
  // занавески, бра, потолочные лампы — инстансами
  { const im = new THREE.InstancedMesh(curtainGeo, curtainM, curtainList.length); curtainList.forEach(([x, y, z, ry], i) => { dm.position.set(x, y, z); dm.rotation.set(0, ry, 0); dm.scale.set(1, 1, 1); dm.updateMatrix(); im.setMatrixAt(i, dm.matrix); }); train.add(im);
    const sg = new THREE.InstancedMesh(new THREE.SphereGeometry(.06, 12, 8), new THREE.MeshBasicMaterial({ color: HDR(2.2, 1.5, .8) }), sconceList.length); sconceList.forEach(([x, y, z], i) => { dm.position.set(x, y, z); dm.rotation.set(0, 0, 0); dm.updateMatrix(); sg.setMatrixAt(i, dm.matrix); }); train.add(sg);
    const sb = new THREE.InstancedMesh(new THREE.CylinderGeometry(.02, .04, .16, 8), brass, sconceList.length); sconceList.forEach(([x, y, z], i) => { dm.position.set(x, y - .1, z); dm.updateMatrix(); sb.setMatrixAt(i, dm.matrix); }); train.add(sb);
    const lg = new THREE.InstancedMesh(new THREE.SphereGeometry(.15, 16, 10, 0, 6.3, 0, 1.9), new THREE.MeshBasicMaterial({ color: HDR(1.7, 1.4, 1.0) }), lampList.length); lampList.forEach(([x, y], i) => { dm.position.set(x, y, 0); dm.rotation.set(Math.PI, 0, 0); dm.updateMatrix(); lg.setMatrixAt(i, dm.matrix); }); train.add(lg);
    const glS = new THREE.SpriteMaterial({ map: T_GLOW, color: 0xffc888, transparent: true, opacity: .22, depthWrite: false, blending: THREE.AdditiveBlending });
    lampList.forEach(([x, y]) => { const s = new THREE.Sprite(glS); s.position.set(x, y - .05, 0); s.scale.set(1.3, 1.3, 1); train.add(s); });
    sconceList.forEach(([x, y, z]) => { const s = new THREE.Sprite(glS); s.position.set(x, y, z); s.scale.set(.55, .55, 1); train.add(s); });
  }
  const lampOn = new THREE.MeshBasicMaterial({ color: HDR(3, 1.8, .9) });
  function sofa(cg, cx, x, s, len, mat) { add(cg, B(len, .42, .6), mat, x, .21, s * (IN_W - .38)); add(cg, B(len, .62, .16), mat, x, .66, s * (IN_W - .12)); [-1, 1].forEach(e => add(cg, B(.14, .58, .62), woodDark, x + e * (len / 2 + .07), .29, s * (IN_W - .37))); add(cg, B(len, .06, .1), brass, x, .98, s * (IN_W - .1)); obst.push([cx + x - len / 2 - .15, cx + x + len / 2 + .15, s > 0 ? IN_W - .7 : -IN_W, s > 0 ? IN_W : -IN_W + .7]); }
  function decoTree(cg, cx, x, z, sc, k, withGifts) {
    const t = add(cg, furFir({ tiers: 7, seg: 20, snow: 0, seed: 77 }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .75 }), x, 0, z); t.scale.setScalar(sc);
    const H = 2.5 * sc; for (let i = 0; i < 70; i++) { const kk = i / 70, y = .45 * sc + kk * (H - .6 * sc), r = (1 - (y - .3 * sc) / H) * .8 * sc + .03, a = kk * 6.283 * 6; bulb(V3(cx + x + Math.cos(a) * r, y, z + Math.sin(a) * r), .02 + sc * .004, PAL[i % 3 === 0 ? 4 : (i % 5 === 0 ? 2 : 0)], .2 + kk * .8, k); }
    for (let i = 0; i < 16; i++) { const y = .5 * sc + rnd() * (H - .9 * sc), r = (1 - (y - .3 * sc) / H) * .78 * sc, a = rnd() * 6.3; add(cg, new THREE.SphereGeometry(.035 + sc * .012, 12, 8), ballMs[i % 5], x + Math.cos(a) * r, y, z + Math.sin(a) * r); }
    const st = new THREE.Mesh(starGeo, new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb347, emissiveIntensity: 1.2, metalness: .6, roughness: .3 })); st.position.set(x, H + .1 * sc, z); st.scale.setScalar(sc * .5); cg.add(st);
    if (withGifts) [[.4, .3, 0xb33a44], [-.35, .45, 0x1f5a45], [.1, -.4, 0xd6ae66], [-.5, -.2, 0x2c5f8a]].forEach(([ox, oz, c], i) => { const s = .18 + (i % 2) * .08; add(cg, B(s, s * .8, s), new THREE.MeshStandardMaterial({ color: c, roughness: .5 }), x + ox, s * .4, z + oz, i * .4); add(cg, B(s + .01, s * .8 + .01, .03), gold, x + ox, s * .4, z + oz, i * .4); });
    obst.push([cx + x - .7 * sc, cx + x + .7 * sc, z - .7 * sc, z + .7 * sc]); return { t, H };
  }
  const starShape = (n, ro, ri) => { const s = new THREE.Shape(); for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, a = i / (n * 2) * Math.PI * 2 + Math.PI / 2; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } return s; };
  var starGeo = new THREE.ExtrudeGeometry(starShape(5, .3, .13), { depth: .06, bevelEnabled: true, bevelThickness: .03, bevelSize: .03, bevelSegments: 2 }); starGeo.center();
  function tableLamp(cg, x, y, z, k) { add(cg, new THREE.CylinderGeometry(.015, .03, .22, 8), brass, x, y + .11, z); const sh = add(cg, new THREE.CylinderGeometry(.05, .1, .1, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0x8a1f28, emissive: 0x8a2a10, emissiveIntensity: .9, side: THREE.DoubleSide, roughness: .7 }), x, y + .26, z); add(cg, new THREE.SphereGeometry(.03, 8, 6), lampOn, x, y + .22, z); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: T_GLOW, color: 0xffa860, transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending })); s.position.set(x + cg.position.x, y + .22, z); s.scale.set(.6, .6, 1); train.add(s); }

  /* --- вагон 1: гостиная, ёлка и спрятанные игрушки --- */
  const TOYS = [];
  {
    const k = 0, cx = carX(k), cg = carGroups[k];
    sofa(cg, cx, -3.2, -1, 2.6, velvetG); sofa(cg, cx, 2.0, -1, 2.2, velvetG); sofa(cg, cx, 2.6, 1, 2.4, velvetG);
    [[-4.2, 1], [-2.3, 1]].forEach(([x, s]) => { add(cg, B(.62, .4, .6), velvetR, x, .2, s * (IN_W - .4)); add(cg, B(.62, .5, .14), velvetR, x, .6, s * (IN_W - .12)); obst.push([cx + x - .4, cx + x + .4, IN_W - .75, IN_W]); });
    add(cg, new THREE.CylinderGeometry(.3, .3, .04, 24), woodDark, -3.25, .55, IN_W - .45); add(cg, new THREE.CylinderGeometry(.03, .05, .55, 8), brass, -3.25, .27, IN_W - .45); obst.push([cx - 3.6, cx - 2.9, IN_W - .8, IN_W]);
    tableLamp(cg, -3.25, .57, IN_W - .45, k);
    const tr = decoTree(cg, cx, 6.2, -.75, .78, k, true); TOYS.tree = tr; TOYS.treeX = cx + 6.2; TOYS.treeZ = -.75;
    // чемоданы на полках
    [[-5.2, -1, 0x5a3a22, .5], [-4.6, -1, 0x7a2a24, .35], [4.4, 1, 0x2a3a4a, .45], [.4, 1, 0x6b4a2a, .55]].forEach(([x, s, c, w]) => add(cg, B(w, .22, .3), new THREE.MeshStandardMaterial({ color: c, roughness: .6 }), x, 2.28, s * (IN_W - .27)));
    // самовар-чайник на столике
    stations.push({ id: 'toys', car: k, x: cx + 4.9, z: -.1, r: 1.8, label: 'Найти 5 спрятанных игрушек' });
    const defs = [
      { n: 'стеклянный шар', h: 'Наверху, на багажной полке слева, между чемоданами', p: [-3.9, 2.25, -(IN_W - .27)], mk: () => new THREE.Mesh(new THREE.SphereGeometry(.07, 16, 12), ballMs[0]) },
      { n: 'золотая звезда', h: 'На полу под круглым столиком у кресел', p: [-3.25, .06, IN_W - .45], mk: () => { const m = new THREE.Mesh(starGeo, new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0x6a4000, metalness: .8, roughness: .25, envMap })); m.scale.setScalar(.3); m.rotation.x = -Math.PI / 2; return m; } },
      { n: 'снежинка', h: 'В складках шторы справа, у второго окна', p: [1.27, 1.45, IN_W - .1], mk: () => { const m = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape(6, .32, .09), { depth: .04, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0xe8f3ff, emissive: 0x3060a0, emissiveIntensity: .6, metalness: .5, roughness: .2, envMap })); m.scale.setScalar(.25); return m; } },
      { n: 'колокольчик', h: 'Висит под потолочной лампой в середине вагона', p: [2, 2.42, 0], mk: () => { const m = new THREE.Mesh(bellGeo, brass); m.scale.setScalar(.45); return m; } },
      { n: 'шишка', h: 'Среди подарков под ёлкой', p: [6.75, .08, -.25], mk: () => { const m = new THREE.Mesh(new THREE.ConeGeometry(.045, .13, 8, 3), new THREE.MeshStandardMaterial({ color: 0xc89048, metalness: .7, roughness: .35, envMap, flatShading: true })); m.rotation.z = 1.3; return m; } },
    ];
    TOYS.defs = defs;
  }
  /* --- вагон 2: ресторан, мандарины --- */
  const MAND = { list: [], table: null };
  {
    const k = 1, cx = carX(k), cg = carGroups[k];
    const cloth = new THREE.MeshStandardMaterial({ map: clothTex(), roughness: .85 });
    [-4, 0, 4].forEach((x, ti) => [-1, 1].forEach(s => {
      const z = s * (IN_W - .38); add(cg, B(.95, .04, .66), cloth, x, .76, z); add(cg, B(.9, .03, .02), brass, x, .79, z - s * .33); add(cg, new THREE.CylinderGeometry(.04, .06, .74, 8), brass, x, .37, z);
      [-1, 1].forEach(e => { add(cg, B(.36, .44, .74), velvetR, x + e * .72, .22, s * (IN_W - .37)); add(cg, B(.12, .72, .74), velvetR, x + e * .92, .66, s * (IN_W - .37)); });
      obst.push([cx + x - 1.0, cx + x + 1.0, s > 0 ? IN_W - .78 : -IN_W, s > 0 ? IN_W : -IN_W + .78]);
      const game = ti === 1 && s > 0; if (game) return;
      tableLamp(cg, x - .3, .78, z + s * .18, k);
      // подстаканники
      [-.12, .14].forEach((o, i) => { add(cg, new THREE.CylinderGeometry(.032, .028, .1, 12), brass, x + .26 + o * .4, .83, z - s * .12 + o); add(cg, new THREE.CylinderGeometry(.027, .027, .02, 12), new THREE.MeshStandardMaterial({ color: 0x5a2a0a, roughness: .2 }), x + .26 + o * .4, .87, z - s * .12 + o); });
      add(cg, new THREE.ConeGeometry(.05, .16, 6), hvoyaM, x - .05, .86, z);
    }));
    // буфет
    add(cg, B(1.3, .95, .55), woodPanel, -6.9, .48, -(IN_W - .3)); add(cg, B(1.34, .04, .6), brass, -6.9, .97, -(IN_W - .3)); obst.push([cx - 7.8, cx - 6.1, -IN_W, -IN_W + .6]);
    const kettle = add(cg, new THREE.SphereGeometry(.13, 16, 12), brass, -7.1, 1.11, -(IN_W - .32)); kettle.scale.y = 1.2; add(cg, new THREE.CylinderGeometry(.03, .05, .12, 8), brass, -7.1, 1.3, -(IN_W - .32));
    for (let i = 0; i < 4; i++) add(cg, new THREE.SphereGeometry(.045, 12, 10), new THREE.MeshStandardMaterial({ color: 0xff8a1a, roughness: .55 }), -6.6 + (i % 2) * .08, 1.03 + Math.floor(i / 2) * .07, -(IN_W - .3) + (i % 2 ? .05 : -.04));
    decoTree(cg, cx, 7.2, -(IN_W - .45), .45, k, false);
    // игровой стол: средний справа
    const tz = IN_W - .38; MAND.table = { x: cx, z: tz, y: .78 + .02 };
    add(cg, B(.95, .03, .02), brass, 0, .81, tz + .33); [-1, 1].forEach(e => add(cg, B(.02, .03, .66), brass, e * .475, .81, tz));
    const bowl = add(cg, new THREE.LatheGeometry([[0, 0], [.06, 0], [.1, .03], [.13, .07], [.135, .075]].map(p => new THREE.Vector2(p[0], p[1])), 24), new THREE.MeshPhysicalMaterial({ color: 0x2c4a7a, roughness: .2, clearcoat: 1, side: THREE.DoubleSide, envMap, envMapIntensity: .8 }), 0, .79, tz); const brim = add(cg, new THREE.TorusGeometry(.135, .007, 6, 40), gold, 0, .865, tz); brim.rotation.x = Math.PI / 2; tableLamp(cg, -.5, .78, tz + .45, k);
    MAND.bowl = V3(cx, .8, tz);
    const mm = new THREE.MeshStandardMaterial({ color: 0xff7f12, roughness: .55, emissive: 0x401400, emissiveIntensity: .4 });
    const leaf = new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: .6 });
    for (let i = 0; i < 8; i++) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(.042, 16, 12), mm); b.scale.y = .86; g.add(b); const lf = new THREE.Mesh(new THREE.SphereGeometry(.018, 6, 4), leaf); lf.scale.set(1.6, .3, .8); lf.position.y = .036; g.add(lf); const hit = new THREE.Mesh(new THREE.SphereGeometry(.08, 6, 4), new THREE.MeshBasicMaterial({ visible: false })); g.add(hit); cg.add(g); const a = i / 8 * 6.283; const m = { g, hit, u: Math.cos(a) * .3, w: Math.sin(a) * .17, vu: 0, vw: 0, done: false, fly: 0 }; hit.userData.mand = m; MAND.list.push(m); }
    stations.push({ id: 'mand', car: k, x: cx, z: .35, r: 1.3, label: 'Собрать мандарины со стола' });
  }
  /* --- вагон 3: музыкальный, колокольчики --- */
  var bellGeo = new THREE.LatheGeometry([[0, .32], [.05, .31], [.09, .26], [.11, .14], [.14, .04], [.19, -.02], [.2, -.05], [.17, -.04], [0, -.03]].map(p => new THREE.Vector2(p[0], p[1])), 24);
  const BELLS = [];
  {
    const k = 2, cx = carX(k), cg = carGroups[k];
    sofa(cg, cx, -4.6, -1, 2.6, velvetR); sofa(cg, cx, -4.6, 1, 2.6, velvetR); sofa(cg, cx, 4.4, -1, 2.4, velvetG); sofa(cg, cx, 4.4, 1, 2.4, velvetG);
    // хвойная арка
    const pts = []; for (let i = 0; i <= 24; i++) { const a = Math.PI * i / 24; pts.push(V3(.3, .02 + Math.sin(a) * 2.42 * (i ? 1 : 1), -Math.cos(a) * 1.3)); }
    const arc = new THREE.CatmullRomCurve3(pts); add(cg, new THREE.TubeGeometry(arc, 60, .09, 8), hvoyaM, 0, 0, 0); add(cg, new THREE.TubeGeometry(arc, 60, .075, 6), hvoyaM, .05, .02, .02);
    for (let i = 0; i <= 30; i++) { const p = arc.getPoint(i / 30); bulb(V3(cx + p.x - .05, p.y, p.z), .022, PAL[i % 5], i / 30, k); }
    const NOTES = [1047, 1175, 1319, 1568, 1760];
    [-.7, -.35, 0, .35, .7].forEach((z, i) => {
      const pivot = new THREE.Group(); pivot.position.set(.3, .02 + 2.42 * Math.sqrt(1 - (z / 1.3) ** 2) - .06, z); cg.add(pivot);
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .3, 4), new THREE.MeshStandardMaterial({ color: 0x8a1f28 })); rope.scale.y = .6; rope.position.y = -.09; pivot.add(rope);
      const bell = new THREE.Mesh(bellGeo, brass); bell.position.y = -.32; bell.scale.setScalar(.48 - i * .035); pivot.add(bell);
      const bow = new THREE.Mesh(new THREE.TorusGeometry(.03, .012, 6, 12), new THREE.MeshStandardMaterial({ color: 0xa0202c, roughness: .5 })); bow.position.y = -.19; pivot.add(bow);
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: T_GLOW, color: 0xffd28a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); gl.position.y = -.35; gl.scale.set(.6, .6, 1); pivot.add(gl);
      const hit = new THREE.Mesh(new THREE.SphereGeometry(.16, 6, 4), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = -.32; pivot.add(hit);
      const b = { pivot, gl, f: NOTES[i], i, sw: 0, sv: 0, lit: 0 }; hit.userData.bell = b; BELLS.push(b);
    });
    // пюпитр с нотами
    add(cg, new THREE.CylinderGeometry(.015, .03, 1.1, 6), brass, -1.4, .55, -.95); const sheet = add(cg, new THREE.PlaneGeometry(.42, .3), new THREE.MeshStandardMaterial({ map: canvasTex(256, 180, (g, w, h) => { g.fillStyle = '#f3ead6'; g.fillRect(0, 0, w, h); g.strokeStyle = '#3b2410'; g.lineWidth = 1; for (let s = 0; s < 3; s++) for (let l = 0; l < 5; l++) { const y = 26 + s * 52 + l * 6; g.beginPath(); g.moveTo(14, y); g.lineTo(w - 14, y); g.stroke(); } g.fillStyle = '#3b2410'; for (let i = 0; i < 26; i++) { const s = i % 3; g.beginPath(); g.ellipse(24 + (i * 37) % (w - 40), 26 + s * 52 + Math.floor(rnd() * 8) * 3, 3.5, 2.6, -.4, 0, 7); g.fill(); } }), roughness: .9, side: THREE.DoubleSide }), -1.4, 1.15, -.95); sheet.rotation.set(-.4, .5, 0);
    decoTree(cg, cx, -7.1, IN_W - .5, .42, k, false); decoTree(cg, cx, 7.1, -(IN_W - .5), .42, k, false);
    stations.push({ id: 'bells', car: k, x: cx - 1.1, z: 0, r: 1.5, label: 'Угадать мелодию по колокольчикам' });
  }
  /* --- вагон 4: смотровой, запотевшее окно --- */
  const FROST = {};
  {
    const k = 3, cx = carX(k), cg = carGroups[k];
    // скамья спинка к спинке посередине
    [-1, 1].forEach(s => { add(cg, B(5, .42, .36), velvetG, -.5, .21, s * .2); add(cg, B(5, .55, .08), velvetG, -.5, .7, s * .04); });
    add(cg, B(5.1, .06, .1), brass, -.5, .99, 0); obst.push([cx - 3.05, cx + 2.05, -.4, .4]);
    decoTree(cg, cx, -7.2, IN_W - .5, .5, k, true); decoTree(cg, cx, -7.2, -(IN_W - .5), .5, k, false);
    // подзорная труба у заднего окна
    const tg = new THREE.Group(); tg.position.set(-6.9, 0, -.95); cg.add(tg); [0, 2.1, 4.2].forEach(a => { const l = new THREE.Mesh(new THREE.CylinderGeometry(.012, .016, 1.25, 6), woodDark); l.position.set(Math.cos(a) * .2, .6, Math.sin(a) * .2); l.rotation.set(Math.sin(a) * .3, 0, -Math.cos(a) * .3); tg.add(l); }); const tube = new THREE.Mesh(new THREE.CylinderGeometry(.04, .06, .7, 14), brass); tube.position.set(-.1, 1.28, .05); tube.rotation.set(.35, 0, 1.25); tg.add(tube); obst.push([cx - 7.2, cx - 6.6, -1.3, -.65]);
    // запотевшее окно: справа, у второго окна от двери
    const FW = 1.72, FH = 1.48, FX = 4, fc = document.createElement('canvas'); fc.width = 512; fc.height = Math.round(512 * FH / FW); const fctx = fc.getContext('2d');
    const ftex = new THREE.CanvasTexture(fc); ftex.colorSpace = THREE.SRGBColorSpace;
    const fplane = add(cg, new THREE.PlaneGeometry(FW, FH), new THREE.MeshBasicMaterial({ map: ftex, transparent: true, depthWrite: false }), FX, (.62 + 2.1) / 2, IN_W - .005); fplane.rotation.y = Math.PI; fplane.renderOrder = 3;
    Object.assign(FROST, { c: fc, ctx: fctx, tex: ftex, plane: fplane, W: fc.width, H: fc.height, x: cx + FX, y: (.62 + 2.1) / 2, z: IN_W, cur: { u: .5, v: .5 }, last: null });
    stations.push({ id: 'frost', car: k, x: cx + FX, z: .75, r: 1.2, label: 'Нарисовать узор на запотевшем окне' });
  }
  function fogUp(full) { const g = FROST.ctx, w = FROST.W, h = FROST.H; g.globalCompositeOperation = 'source-over'; if (full) { g.clearRect(0, 0, w, h); const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(196,210,234,.55)'); gr.addColorStop(1, 'rgba(218,228,246,.72)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); for (let i = 0; i < 160; i++) { g.fillStyle = 'rgba(255,255,255,' + (.05 + rnd() * .12) + ')'; g.beginPath(); g.arc(rnd() * w, rnd() * h, 1 + rnd() * 3.5, 0, 7); g.fill(); } } else { g.fillStyle = 'rgba(222,232,246,.012)'; g.fillRect(0, 0, w, h); } FROST.tex.needsUpdate = true; }
  fogUp(true);
  function frostDraw(u, v, from) { const g = FROST.ctx, x = u * FROST.W, y = (1 - v) * FROST.H; g.globalCompositeOperation = 'destination-out'; g.lineCap = g.lineJoin = 'round'; g.strokeStyle = 'rgba(0,0,0,.92)'; g.lineWidth = 14; g.beginPath(); if (from) g.moveTo(from.u * FROST.W, (1 - from.v) * FROST.H); else g.moveTo(x - .1, y); g.lineTo(x, y); g.stroke(); g.globalCompositeOperation = 'source-over'; if (rnd() < .3) { g.fillStyle = 'rgba(235,242,252,.6)'; g.beginPath(); g.arc(x + (rnd() - .5) * 10, y + 8 + rnd() * 6, 1.6, 0, 7); g.fill(); } FROST.tex.needsUpdate = true; FROST.drawn = (FROST.drawn || 0) + 1; }

  // игрушки (после того как bellGeo готов)
  TOYS.list = TOYS.defs.map((d, i) => { const m = d.mk(); m.position.set(carX(0) + d.p[0], d.p[1], d.p[2]); train.add(m); const hit = new THREE.Mesh(new THREE.SphereGeometry(.22, 6, 4), new THREE.MeshBasicMaterial({ visible: false })); hit.position.copy(m.position); train.add(hit); const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: T_GLOW, color: 0xffd9a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); gl.position.copy(m.position); gl.scale.set(.5, .5, 1); train.add(gl); const t = { ...d, m, hit, gl, found: false, hl: 0, fly: 0 }; hit.userData.toy = t; return t; });
  const TREE_SLOTS = [[.35, 1.05, .25], [-.3, 1.3, .35], [.15, 1.55, -.3], [-.25, .8, -.4], [.05, 1.75, .2]];

  /* ---- пост-обработка ---- */
  const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: LOW ? 0 : 4 });
  const composer = new EffectComposer(renderer, rt); composer.addPass(new RenderPass(scene, camera));
  composer.addPass(sanitizePass()); const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .6, .45, .86); bloom.enabled = QL.bloom; composer.addPass(bloom); composer.addPass(new OutputPass()); const grade = gradePass({ vig: .5 }); composer.addPass(grade);
  scene.add(camera); const bokeh = makeBokeh(camera, { n: LOW ? 8 : 14, unit: 1.2 }); bokeh.visible = false;
  // свет в вагоне: две лампы идут за пассажиром
  const pl1 = new THREE.PointLight(0xffc890, 2.4, 9, 1.2), pl2 = new THREE.PointLight(0xffc890, 2.4, 9, 1.2), pl3 = new THREE.PointLight(0xffb070, 1.6, 7, 1.2); inside.add(pl1, pl2, pl3);

  /* ---------- камера ---------- */
  let W = 1, Hh = 1, aspect = 1;
  const PORTRAIT = () => aspect < .8;
  function outsidePose() { const fov = 30, t = Math.tan(fov * Math.PI / 360); const dist = Math.max(46, 12.5 / (t * aspect), 15.5 / t); return { p: V3(0, 13, dist), l: V3(0, -3.2, 0), fov }; }
  const P = { x: carX(0) + .2, z: .45, yaw: Math.PI + .5, pitch: -.02, vx: 0, vz: 0, bob: 0, goto: null, turn: 0 };
  const walkFov = () => PORTRAIT() ? 74 : 62;
  const cam = { p: V3(), l: V3(), fov: 30 };
  function fpPose() { const cp = Math.cos(P.pitch); return { p: V3(P.x, EYE, P.z), l: V3(P.x + Math.cos(P.yaw) * cp, EYE + Math.sin(P.pitch), P.z + Math.sin(P.yaw) * cp), fov: walkFov() }; }
  function fitPose(c, dir, w, h, fovL = 50, fovP = 62) { const fov = PORTRAIT() ? fovP : fovL, t = Math.tan(fov * Math.PI / 360); const d = Math.max(h / 2 / t, w / 2 / (t * aspect)) * 1.12; return { p: c.clone().add(dir.clone().normalize().multiplyScalar(d)), l: c.clone(), fov, d }; }
  function resize() {
    W = innerWidth; Hh = innerHeight; aspect = W / Hh;
    renderer.setSize(W, Hh, false); composer.setSize(W, Hh);
    bloom.resolution.set(W * DPR * (LOW ? .4 : .6), Hh * DPR * (LOW ? .4 : .6));
  }
  resize(); addEventListener('resize', resize); addEventListener('resize', () => setCarLbl && setCarLbl());

  /* ---------- звук ---------- */
  let AC = null, sndOn = store('elk-music') === '1', rumbleG = null;
  const sndBtn = $('.rk-snd'), siteBtn = document.getElementById('music');
  const noiseBuf = () => { const b = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; l = (l + .02 * w) / 1.02; d[i] = i % 2 ? w : l * 3.5; } return b; };
  let NB = null;
  function initAudio() {
    if (AC) return; try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    NB = noiseBuf(); const src = AC.createBufferSource(); src.buffer = NB; src.loop = true; const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160; rumbleG = AC.createGain(); rumbleG.gain.value = 0; src.connect(lp); lp.connect(rumbleG); rumbleG.connect(AC.destination); src.start();
  }
  function bellTone(f, vol = .06, dur = 2.2, at = 0) { if (!sndOn || !AC) return; const t0 = AC.currentTime + at; [[1, 1], [2.01, .45], [2.76, .3], [5.4, .12]].forEach(([m, a]) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.value = f * m; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol * a, t0 + .006); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur / Math.sqrt(m)); o.connect(g); g.connect(AC.destination); o.start(t0); o.stop(t0 + dur + .05); }); }
  function chime(freqs, vol = .045, dur = 1.4, gap = .08) { freqs.forEach((f, i) => bellTone(f, vol, dur, i * gap)); }
  function clack(at, v = 1) { if (!sndOn || !AC || !NB) return; const t0 = AC.currentTime + at; const n = AC.createBufferSource(); n.buffer = NB; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 520 + Math.random() * 120; f.Q.value = 1.4; const g = AC.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.16 * v, t0 + .004); g.gain.exponentialRampToValueAtTime(.0001, t0 + .09); n.connect(f); f.connect(g); g.connect(AC.destination); n.start(t0, Math.random()); n.stop(t0 + .12); const o = AC.createOscillator(), og = AC.createGain(); o.frequency.setValueAtTime(95, t0); o.frequency.exponentialRampToValueAtTime(45, t0 + .1); og.gain.setValueAtTime(.12 * v, t0); og.gain.exponentialRampToValueAtTime(.0001, t0 + .12); o.connect(og); og.connect(AC.destination); o.start(t0); o.stop(t0 + .14); }
  function hiss(dur = .7, f0 = 900, vol = .05) { if (!sndOn || !AC || !NB) return; const t0 = AC.currentTime, n = AC.createBufferSource(); n.buffer = NB; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(f0 * 2.2, t0 + dur); const g = AC.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + dur * .3); g.gain.linearRampToValueAtTime(0, t0 + dur); n.connect(f); f.connect(g); g.connect(AC.destination); n.start(t0); n.stop(t0 + dur + .05); }
  function setSound(on) {
    sndOn = on; sndBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); sndBtn.setAttribute('aria-label', on ? 'Звук: выключить' : 'Звук: включить');
    if (on) { initAudio(); AC && AC.resume(); } else if (rumbleG) rumbleG.gain.value = 0;
    if (siteBtn && (siteBtn.getAttribute('aria-pressed') === 'true') !== on) siteBtn.click();
  }
  sndBtn.setAttribute('aria-pressed', sndOn ? 'true' : 'false'); sndBtn.setAttribute('aria-label', sndOn ? 'Звук: выключить' : 'Звук: включить'); sndBtn.addEventListener('click', () => setSound(!sndOn));

  /* ---------- состояние и ввод ---------- */
  const G = { mode: 'load', game: null, cur: -1, D: 0, nextJoint: 0 };
  const keys = {}, padHeld = {}; let drag = null, joy = null;
  const KEYS = { arrowup: 'fw', w: 'fw', 'ц': 'fw', arrowdown: 'bk', s: 'bk', 'ы': 'bk', a: 'sl', 'ф': 'sl', d: 'sr', 'в': 'sr', arrowleft: 'tl', arrowright: 'tr', q: 'tl', e: 'tr', 'й': 'tl', 'у': 'tr' };
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function rayFrom(e) { const r = cv.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, camera); }
  const floorPick = []; carGroups.forEach(cg => floorPick.push(cg.children[0]));
  const joyEl = $('.rk-joy'), knob = joyEl.querySelector('i');
  const walking = () => G.mode === 'walk' && !closeUp();
  const closeUp = () => G.game === 'mand' || G.game === 'bells' || G.game === 'frost';
  cv.addEventListener('pointerdown', e => {
    if (AC && sndOn) AC.resume();
    if (G.mode !== 'walk') return;
    if (G.game === 'frost') { rayFrom(e); const h = ray.intersectObject(FROST.plane)[0]; if (h) { FROST.last = { u: h.uv.x, v: h.uv.y }; frostDraw(h.uv.x, h.uv.y); drag = { id: e.pointerId, frost: true }; cv.setPointerCapture && cv.setPointerCapture(e.pointerId); } return; }
    if (G.free && e.pointerType === 'touch' && !closeUp() && e.clientX < W * .45 && e.clientY > Hh * .4) { joy = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px'; joyEl.classList.add('on'); knob.style.transform = ''; }
    else drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
    cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', e => {
    if (joy && e.pointerId === joy.id) { let dx = e.clientX - joy.x, dy = e.clientY - joy.y; const l = Math.hypot(dx, dy), m = 46; if (l > m) { dx *= m / l; dy *= m / l; } joy.dx = dx / m; joy.dy = dy / m; knob.style.transform = `translate(${dx}px,${dy}px)`; return; }
    if (drag && e.pointerId === drag.id) {
      if (drag.frost) { rayFrom(e); const h = ray.intersectObject(FROST.plane)[0]; if (h) { const p = { u: h.uv.x, v: h.uv.y }; frostDraw(p.u, p.v, FROST.last); FROST.last = p; } return; }
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
      if (!closeUp() && (G.free || e.pointerType !== 'touch')) { P.tour = null; P.yaw -= dx * .0055; P.pitch = clamp(P.pitch + dy * .004, -.75, .6); P.goto = null; }
    }
  });
  const up = e => {
    if (joy && e.pointerId === joy.id) { joy = null; joyEl.classList.remove('on'); return; }
    if (drag && e.pointerId === drag.id) { if (!drag.frost && !drag.moved) tap(e); drag = null; FROST.last = null; }
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  function tap(e) {
    rayFrom(e);
    if (G.game === 'mand') { const h = ray.intersectObjects(MAND.list.filter(m => !m.done).map(m => m.hit), false)[0]; if (h) pickMand(h.object.userData.mand); return; }
    if (G.game === 'bells') { const h = ray.intersectObjects(BELLS.map(b => b.pivot.children[4]), false)[0]; if (h) ringBell(h.object.userData.bell, h.object.userData.bell.f, true); return; }
    if (G.game === 'toys') { const h = ray.intersectObjects(TOYS.list.filter(t => !t.found).map(t => t.hit), false)[0]; if (h && h.distance < (G.free ? 6 : 14)) { foundToy(h.object.userData.toy); return; } }
    if (!G.free) return;
    const fh = ray.intersectObjects(floorPick, false)[0]; if (fh && fh.distance < 14) P.goto = { x: fh.point.x, z: clamp(fh.point.z, -1.05, 1.05) };
  }
  function onKey(e, down) {
    if (e.target && e.target.closest && e.target.closest('button') && (e.key === 'Enter' || e.key === ' ')) return;
    if (down && e.key === 'Escape') { if (!card.hidden) hideCard(); else if (G.game) endGame(true); else exit(); return; }
    const k = e.key.toLowerCase();
    if (G.game === 'frost' && G.mode === 'walk') { if (down && FKEY[k]) { e.preventDefault(); const [du, dv] = FKEY[k], c = FROST.cur, from = { u: c.u, v: c.v }; c.u = clamp(c.u + du * .025, .02, .98); c.v = clamp(c.v + dv * .03, .02, .98); frostDraw(c.u, c.v, from); } return; }
    if (G.game === 'mand' && down) { if (k === 'arrowleft' || k === 'arrowright') { e.preventDefault(); cycleMand(k === 'arrowright' ? 1 : -1); return; } if (k === 'enter' || k === ' ') { e.preventDefault(); const m = MAND.list[MAND.sel]; if (m && !m.done) pickMand(m); return; } }
    if (G.game === 'bells' && down && '12345'.includes(k) && k.length === 1) { ringBell(BELLS[+k - 1], BELLS[+k - 1].f, true); return; }
    if (down && (k === 'enter' || k === ' ') && document.activeElement === cv) { e.preventDefault(); if (!actBtn.hidden) actBtn.click(); return; }
    if (!G.free) { if (down && G.mode === 'walk' && !G.game) { if (k === 'arrowright') { e.preventDefault(); tour.next(); } if (k === 'arrowleft') { e.preventDefault(); tour.prev(); } } return; }
    if (KEYS[k]) { keys[KEYS[k]] = down; e.preventDefault(); P.goto = null; }
  }
  const FKEY = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, 1], arrowdown: [0, -1], a: [-1, 0], d: [1, 0], w: [0, 1], s: [0, -1] };
  const kd = e => onKey(e, true), ku = e => onKey(e, false); addEventListener('keydown', kd); addEventListener('keyup', ku);
  el.querySelectorAll('.rl-pad [data-k]').forEach(b => { const k = b.dataset.k; const on = e => { e.preventDefault(); padHeld[k] = true; P.goto = null; if (AC && sndOn) AC.resume(); }, off = () => { padHeld[k] = false; }; b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off); b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { padHeld[k] = true; P.goto = null; } }); b.addEventListener('keyup', e => { if (e.key === 'Enter' || e.key === ' ') padHeld[k] = false; }); b.addEventListener('contextmenu', e => e.preventDefault()); });
  $('.rk-close').addEventListener('click', () => exit());
  $('.rl-cout').addEventListener('click', () => { hideCard(); if (G.game) endGame(true); cv.focus({ preventScroll: true }); });
  $('.rk-go').addEventListener('click', () => { const f = card._go; hideCard(); f && f(); });
  $('.rl-prev').addEventListener('click', () => goCar(G.cur - 1)); carLbl.addEventListener('click', () => goCar(Math.max(0, G.cur))); $('.rl-next').addEventListener('click', () => goCar(G.cur + 1));
  actBtn.addEventListener('click', () => actBtn._f && actBtn._f()); act2Btn.addEventListener('click', () => act2Btn._f && act2Btn._f());
  function setAct(btnEl, label, f) { if (!label) { btnEl.hidden = true; btnEl._f = null; btnEl._l = ''; return; } if (btnEl._l !== label) { btnEl.textContent = label; btnEl._l = label; } btnEl._f = f; btnEl.hidden = false; }
  function goCar(k) { if (!G.free && k >= 0 && k < CAR_N) { tour.go(k); return; } if (!walking() || k < 0 || k >= CAR_N) return; const s = stations.find(s => s.car === k); P.goto = { x: s.x, z: s.z, car: k }; setHint('Идём в ' + (k + 1) + '-й вагон: ' + CARS[k].name.toLowerCase(), 2500); }

  const TOURP = [
    { car: 0, st: 'toys', x: -6.5, z: .55, yaw: .12, pitch: -.05 },
    { car: 1, st: 'mand', x: -18 + 6.4, z: 0, yaw: Math.PI, pitch: -.06 },
    { car: 2, st: 'bells', x: -36 - 4, z: 0, yaw: 0, pitch: .1 },
    { car: 3, st: 'frost', x: -54 + .5, z: .75, yaw: Math.PI / 2 + .15, pitch: .06 },
    { car: 3, x: -54 - 5.5, z: 0, yaw: Math.PI, pitch: -.04, name: 'Заднее окно', text: 'Рельсы убегают в метель, позади огни деревни' },
  ];
  G.free = false;
  const tour = makeTour(el, cv, { count: () => TOURP.length, label: i => TOURP[Math.max(0, i)].name || CARS[TOURP[Math.max(0, i)].car].name, onGo: i => tourGo(i) });
  tour.nav.classList.add('off');
  const freeBtn = $('.gk-free');
  function tourGo(i) {
    if (G.mode !== 'walk' || G.free) return; if (G.game) endGame(true); hideCard();
    const t = TOURP[i]; G.tourSt = null; P.goto = null;
    P.tour = { x0: P.x, z0: P.z, y0: P.yaw, p0: P.pitch, t, k: 0, dur: clamp(Math.abs(t.x - P.x) / 6 + 1.2, 1.4, 7), dir: t.x > P.x ? 0 : Math.PI };
  }
  function setFree(on) { G.free = on; el.classList.toggle('free', on); freeBtn.textContent = on ? 'Экскурсия' : 'Свободная прогулка'; P.tour = null; G.tourSt = null; if (on) setHint(TOUCH ? 'Левый палец — идти, правый — осмотреться, касание пола — пойти туда' : 'W/S или стрелки — идти, мышью — осмотреться, клик по полу — пойти туда', 6000); else tour.go(clamp(Math.round(-P.x / PITCH), 0, 3)); }
  freeBtn.addEventListener('click', () => setFree(!G.free));
  function tourStep(dt) {
    const T = P.tour; T.k += dt / T.dur; const e = ease(clamp(T.k, 0, 1)), far = Math.abs(T.t.x - T.x0) > 1.5;
    P.x = T.x0 + (T.t.x - T.x0) * e;
    P.z = far ? T.z0 * (1 - smooth(0, .25, e)) + T.t.z * smooth(.75, 1, e) : T.z0 + (T.t.z - T.z0) * e;
    const yw = far ? (e < .5 ? T.y0 + wrapA(T.dir - T.y0) * smooth(0, .22, e) : T.dir + wrapA(T.t.yaw - T.dir) * smooth(.72, 1, e)) : T.y0 + wrapA(T.t.yaw - T.y0) * e;
    P.yaw = yw; P.pitch = T.p0 + (T.t.pitch - T.p0) * e; P.vx = P.vz = 0; if (!REDUCE) P.bob += (far ? 1.9 : .6) * dt * 5.5 * Math.sin(Math.PI * e);
    if (T.k >= 1) { P.tour = null; G.tourSt = T.t.st || null; if (T.t.name) showPlace(T.t.name, T.t.text); }
  }
  function showCard(h, p, go, f, outLabel) { card.querySelector('h3').textContent = h; card.querySelector('p').innerHTML = p; $('.rk-go').textContent = go; card._go = f; $('.rl-cout').textContent = outLabel || 'Гулять дальше'; card.hidden = false; requestAnimationFrame(() => card.classList.add('on')); setTimeout(() => $('.rk-go').focus({ preventScroll: true }), 50); }
  function hideCard() { card.classList.remove('on'); setTimeout(() => { card.hidden = true; }, 350); }
  function showPlace(name, text) { placeEl.querySelector('b').textContent = name; placeEl.querySelector('span').textContent = text; placeEl.classList.remove('on'); void placeEl.offsetWidth; placeEl.classList.add('on'); clearTimeout(showPlace.t); showPlace.t = setTimeout(() => placeEl.classList.remove('on'), 4600); }
  function setHint(t, ms) { hint.textContent = t; hint.classList.add('on'); clearTimeout(setHint.t); if (ms) setHint.t = setTimeout(() => hint.classList.remove('on'), ms); }
  function pop(text, p, cls) { const v = p.clone().project(camera); const d = document.createElement('span'); d.className = 'rk-pop ' + (cls || ''); d.textContent = text; d.style.left = ((v.x + 1) / 2 * 100) + '%'; d.style.top = ((1 - v.y) / 2 * 100) + '%'; pops.appendChild(d); setTimeout(() => d.remove(), 1300); }
  function setHud(t) { hudEl.textContent = t; el.classList.toggle('playing', !!t); }

  /* ---------- искры ---------- */
  const SP = 300, spPos = new Float32Array(SP * 3), spVel = new Float32Array(SP * 3), spLife = new Float32Array(SP), spSeed = new Float32Array(SP * 4); let spI = 0;
  for (let i = 0; i < SP; i++) spSeed.set([3 + rnd() * 4, rnd() * 6, 1, 0], i * 4);
  const spU = { uTime: { value: 0 }, uScale: { value: 300 }, uOpacity: { value: 1 }, uGain: { value: 2.4 }, uColor: { value: HDR(1, .85, .55) } };
  const spPts = pointCloud(Array.from(spPos), Array.from(spSeed), spU); const spGeo = spPts.geometry; spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3)); spGeo.setAttribute('aSeed', new THREE.BufferAttribute(spSeed, 4)); spPts.renderOrder = 7; inside.add(spPts);
  function burst(p, n, sp = 1, up = 1) { for (let k = 0; k < n; k++) { const i = spI++ % SP; spPos.set([p.x, p.y, p.z], i * 3); const a = rnd() * 6.283, b = rnd() * 3.14; spVel.set([Math.cos(a) * Math.sin(b) * sp, Math.abs(Math.cos(b)) * sp * up + .3, Math.sin(a) * Math.sin(b) * sp], i * 3); spLife[i] = .6 + rnd() * .8; } }

  /* ---------- мини-игры ---------- */
  function stationAct(s) {
    if (s.id === 'toys') showCard('Пять игрушек', 'Кто-то спрятал в гостиной пять ёлочных игрушек: шар, звезду, снежинку, колокольчик и шишку. Найдите их и коснитесь каждой. Если трудно, есть подсказка.', 'Искать', () => startGame('toys'));
    if (s.id === 'mand') showCard('Мандарины на столике', 'Поезд покачивается, и мандарины катаются по скатерти. Коснитесь каждого, чтобы он прыгнул в вазу. С клавиатуры: стрелки выбирают, Enter кладёт.', 'Собирать', () => startGame('mand'));
    if (s.id === 'bells') showCard('Угадай мелодию', 'Колокольчики сыграют начало знакомой песни, а вы выберите название. Три мелодии подряд. Для этой игры нужен звук.', sndOn ? 'Слушать' : 'Включить звук и слушать', () => { if (!sndOn) setSound(true); startGame('bells'); });
    if (s.id === 'frost') showCard('Запотевшее окно', 'Проведите пальцем или мышью по стеклу и нарисуйте узор. С клавиатуры кисть водят стрелки. Сквозь узор будут видны горы.', 'Рисовать', () => startGame('frost'));
  }
  function startGame(id) {
    if (G.mode !== 'walk') return; hideCard(); placeEl.classList.remove('on'); P.goto = null; G.game = id; el.classList.toggle('closeup', closeUp());
    if (sndOn) { initAudio(); AC && AC.resume(); }
    if (id === 'toys') { G.toysT = time; setHud(TOYS.list.filter(t => t.found).length + ' из 5 игрушек'); setHint(TOUCH ? 'Осматривайтесь и касайтесь игрушек. Подсказка — кнопка внизу' : 'Осматривайтесь и щёлкайте по игрушкам. Enter — взять ближнюю', 5000); }
    if (id === 'mand') { MAND.list.forEach((m, i) => { const a = i / 8 * 6.283 + rnd(); m.done = false; m.fly = 0; m.u = Math.cos(a) * .3; m.w = Math.sin(a) * .17; m.vu = (rnd() - .5) * .2; m.vw = (rnd() - .5) * .2; m.g.visible = true; }); MAND.n = 0; MAND.t0 = time; MAND.sel = 0; setHud('0 из 8 · 0 с'); setHint(TOUCH ? 'Коснитесь мандарина' : 'Щёлкните по мандарину или выберите стрелками и нажмите Enter', 4000); }
    if (id === 'bells') { G.quiz = { round: 0, score: 0, order: shuffle(MELODIES.slice()).slice(0, 3) }; setHud('Мелодия 1 из 3'); setTimeout(playRound, 900); }
    if (id === 'frost') { FROST.drawn = 0; setHud('Рисуйте на стекле'); setHint(TOUCH ? 'Ведите пальцем по стеклу' : 'Ведите мышью с нажатой кнопкой или стрелками', 4000); }
    updateActs(true); cv.focus({ preventScroll: true });
  }
  function endGame(silent) { const id = G.game; G.game = null; el.classList.remove('closeup'); setHud(''); quizEl.hidden = true; quizEl.innerHTML = ''; clearTimeout(G.qT); if (id === 'mand') MAND.list.forEach(m => { if (!m.done) m.g.visible = true; }); updateActs(true); if (!silent) chime([1319, 1568, 2093], .04, 1.6, .1); }
  // игрушки
  function foundToy(t) {
    if (t.found) return; t.found = true; t.fly = .001; t.from = t.m.position.clone(); const n = TOYS.list.filter(x => x.found).length;
    const sl = TREE_SLOTS[n - 1]; t.to = V3(TOYS.treeX + sl[0] * .78, sl[1] * .78 + .2, TOYS.treeZ + sl[2] * .78);
    burst(t.m.position, 26, .8); pop('Нашлась: ' + t.n, t.m.position.clone().add(V3(0, .25, 0)), ''); chime([1568 * Math.pow(1.122, n - 1), 2093 * Math.pow(1.122, n - 1)], .045, 1.2, .06);
    setHud(n + ' из 5 игрушек');
    if (n === 5) { const sec = Math.round(time - G.toysT); const best = +(store('elk-best-rail-toys') || 0), rec = !best || sec < best; if (rec) store('elk-best-rail-toys', String(sec)); setTimeout(() => { endGame(true); wake[0].tg = 2; chime([784, 988, 1175, 1568, 1976], .05, 2.4, .14); showCard('Все игрушки на ёлке', `Вы нашли все пять за <b>${sec}</b> с. ${rec ? 'Это лучший результат на этом устройстве.' : 'Рекорд: ' + best + ' с.'} Ёлка в гостиной стала наряднее.`, 'Дальше по вагонам', () => goCar(1), 'Остаться'); }, 1300); }
  }
  function toyHint() { const left = TOYS.list.filter(t => !t.found); if (!left.length) return; const t = left.sort((a, b) => a.m.position.distanceTo(V3(P.x, EYE, P.z)) - b.m.position.distanceTo(V3(P.x, EYE, P.z)))[0]; t.hl = 4; setHint('Подсказка: ' + t.h, 4500); }
  // мандарины
  function cycleMand(d) { const left = MAND.list.map((m, i) => m.done ? -1 : i).filter(i => i >= 0); if (!left.length) return; let j = left.indexOf(MAND.sel); j = j < 0 ? 0 : (j + d + left.length) % left.length; MAND.sel = left[j]; }
  function pickMand(m) { if (m.done) return; m.done = true; m.fly = .001; m.from = m.g.position.clone(); const n = MAND.n++; const slot = [[0, 0], [.04, .03], [-.04, .03], [.03, -.04], [-.035, -.035], [0, .045], [.045, 0], [-.045, 0]][n]; m.to = V3(slot[0], .06 + (n > 4 ? .04 : 0) + (n > 0 ? .02 : 0), slot[1]); burst(m.g.position.clone().add(V3(carX(1), 0, 0)), 10, .4); chime([1175 + n * 90], .035, .7); cycleMand(1); setHud(MAND.n + ' из 8 · ' + Math.floor(time - MAND.t0) + ' с'); if (MAND.n === 8) { const sec = Math.round((time - MAND.t0) * 10) / 10; const best = +(store('elk-best-rail-mand') || 0), rec = !best || sec < best; if (rec) store('elk-best-rail-mand', String(sec)); setTimeout(() => { endGame(true); chime([1047, 1319, 1568, 2093], .05, 1.8, .1); showCard(rec ? 'Новый рекорд!' : 'Все мандарины в вазе', `Восемь мандаринов за <b>${String(sec).replace('.', ',')}</b> с. ${rec ? 'Лучше на этом устройстве ещё не получалось.' : 'Рекорд: ' + String(best).replace('.', ',') + ' с.'}`, 'Ещё раз', () => startGame('mand'), 'В вагон'); }, 900); } }
  // колокольчики
  const N_ = n => 440 * Math.pow(2, (n - 69) / 12);
  const MELODIES = [
    { t: '«В лесу родилась ёлочка»', n: [[72, .38], [81, .38], [81, .38], [79, .38], [81, .38], [77, .38], [72, .38], [72, .38], [72, .38], [81, .38], [81, .38], [82, .38], [79, .38], [84, .9]] },
    { t: '«Бубенчики» (Jingle Bells)', n: [[76, .25], [76, .25], [76, .5], [76, .25], [76, .25], [76, .5], [76, .25], [79, .25], [72, .37], [74, .13], [76, 1]] },
    { t: '«Тихая ночь»', n: [[79, .6], [81, .2], [79, .4], [76, 1], [79, .6], [81, .2], [79, .4], [76, 1], [86, .8], [86, .4], [83, 1]] },
    { t: '«Во поле берёза стояла»', n: [[81, .36], [81, .36], [81, .36], [81, .36], [79, .36], [77, .36], [77, .36], [76, .36], [74, .8]] },
  ];
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function ringBell(b, f, user) { b.sv += user ? .9 : .7; b.lit = 1; bellTone(f, .06, 2.4); if (user && G.quiz && G.quiz.wait) { /* свободная игра между раундами */ } }
  function playMelody(m, done) {
    const uniq = [...new Set(m.n.map(x => x[0]))].sort((a, b) => a - b); let t = 0;
    m.n.forEach(([note, d]) => { const bi = Math.min(4, Math.floor(uniq.indexOf(note) * 5 / uniq.length)); const at = t; G.qTs = G.qTs || []; G.qTs.push(setTimeout(() => { if (G.game === 'bells') ringBell(BELLS[bi], N_(note), false); }, at * 1000)); t += d * 1.05; });
    G.qTs.push(setTimeout(() => done && G.game === 'bells' && done(), t * 1000 + 300));
  }
  function playRound() {
    const q = G.quiz; if (!q || G.game !== 'bells') return; const m = q.order[q.round]; setHud('Мелодия ' + (q.round + 1) + ' из 3'); quizEl.hidden = true; setHint('Слушайте…', 0);
    playMelody(m, () => {
      const opts = shuffle([m].concat(shuffle(MELODIES.filter(x => x !== m)).slice(0, 2)));
      quizEl.innerHTML = '<p>Что это за мелодия?</p>' + opts.map((o, i) => `<button class="rk-out" type="button" data-i="${i}">${o.t}</button>`).join('') + '<button class="rk-out rl-again" type="button">Послушать ещё раз</button>';
      quizEl.hidden = false; hint.classList.remove('on');
      quizEl.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => answer(opts[+b.dataset.i] === m, m)));
      quizEl.querySelector('.rl-again').addEventListener('click', () => { quizEl.hidden = true; playMelody(m, () => { quizEl.hidden = false; quizEl.querySelector('button').focus({ preventScroll: true }); }); });
      setTimeout(() => { const b = quizEl.querySelector('button'); b && b.focus({ preventScroll: true }); }, 30);
    });
  }
  function answer(ok, m) {
    const q = G.quiz; quizEl.hidden = true; if (ok) { q.score++; chime([1568, 2093, 2637], .045, 1.2, .07); BELLS.forEach(b => { b.lit = 1; b.sv += .3; }); setHint('Верно: ' + m.t, 2200); } else setHint('Это было ' + m.t, 2600);
    q.round++; if (q.round >= 3) { G.qT = setTimeout(() => { const s = q.score; endGame(true); const best = +(store('elk-best-rail-bells') || 0); if (s > best) store('elk-best-rail-bells', String(s)); showCard(s === 3 ? 'Абсолютный слух!' : 'Колокольчики довольны', `Вы угадали <b>${s}</b> из 3. ${s === 3 ? 'Все мелодии узнаны с первого раза.' : 'Можно сыграть ещё: мелодии каждый раз в другом порядке.'}`, 'Ещё раз', () => startGame('bells'), 'В вагон'); }, 2400); }
    else G.qT = setTimeout(playRound, 2300);
  }
  // окно
  function snowflakeDraw() { const cu = .5, cv_ = .52, strokes = []; for (let a = 0; a < 6; a++) { const ang = a * Math.PI / 3 + Math.PI / 2, ca = Math.cos(ang), sa = Math.sin(ang) * aspectF(); strokes.push([[cu, cv_], [cu + ca * .3, cv_ + sa * .3]]); [.12, .2].forEach((r, j) => { const bx = cu + ca * r, by = cv_ + sa * r, L = j ? .06 : .08; [-1, 1].forEach(s => { const b2 = ang + s * .7; strokes.push([[bx, by], [bx + Math.cos(b2) * L, by + Math.sin(b2) * L * aspectF()]]); }); }); } let i = 0; const step = () => { if (G.game !== 'frost' || i >= strokes.length) return; const [[u0, v0], [u1, v1]] = strokes[i++]; for (let k = 0; k <= 10; k++) { const t = k / 10, t0 = Math.max(0, (k - 1) / 10); frostDraw(u0 + (u1 - u0) * t, v0 + (v1 - v0) * t, { u: u0 + (u1 - u0) * t0, v: v0 + (v1 - v0) * t0 }); } setTimeout(step, REDUCE ? 20 : 70); }; step(); }
  const aspectF = () => FROST.W / FROST.H;
  function frostDone() { const p = V3(FROST.x, FROST.y, FROST.z - .1); for (let i = 0; i < 5; i++) burst(p.clone().add(V3((rnd() - .5) * 1.2, (rnd() - .5) * .9, 0)), 10, .5); chime([1319, 1760, 2349], .04, 2, .12); endGame(true); showCard('Узор готов', 'Стекло запомнит ваш рисунок, пока поезд идёт. Потом снова запотеет, и можно нарисовать новый.', 'Нарисовать ещё', () => { fogUp(true); startGame('frost'); }, 'В вагон'); }

  /* ---------- пролёт ---------- */
  let fly = null;
  function makeFlight(rev) {
    const o = outsidePose(), fz = CZ + RZ, wy = GROUND_Y + .23;
    const Pp = [o.p, V3(0, 4.4, 15.5), V3(0, .8, 9.3), V3(1.6, -1.1, 7.2), V3(.4, -2.05, 5.0), V3(0, wy, fz + .32)];
    const Ll = [o.l, V3(0, -2.6, 0), V3(0, -2.3, 3.2), V3(.2, -2.3, 3.8), V3(0, wy - .02, fz), V3(0, wy, fz - .2)];
    return { pc: new THREE.CatmullRomCurve3(Pp, false, 'centripetal'), lc: new THREE.CatmullRomCurve3(Ll, false, 'centripetal'), f0: o.fov, f1: 48, t: rev ? 1 : 0, dur: 4.6, rev };
  }
  function setInside(on) {
    if (inside.visible === on) return; inside.visible = on; globe.visible = !on;
    scene.fog.density = on ? .0007 : 0; camera.far = on ? 2200 : 600; camera.near = on ? .03 : .01; camera.updateProjectionMatrix();
    bloom.strength = on ? .5 : .75; bloom.threshold = on ? .88 : .88; bokeh.visible = on && !REDUCE;
    if (!REDUCE) { flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go'); }
  }
  function enter() {
    G.mode = 'flyin';
    if (REDUCE) { el.classList.add('fade'); setTimeout(() => { setInside(true); Object.assign(cam, fpPose()); el.classList.remove('fade'); arrive(); }, 450); return; }
    hiss(2.4, 300, .05); fly = makeFlight(false);
  }
  function arrive() {
    G.mode = 'walk'; el.classList.add('walk'); setInside(true); wake[0].tg = 1.2; G.cur = -1;
    chime([1047, 1319, 1568, 2093], .035, 2.2, .14);
    tour.nav.classList.remove('off'); freeBtn.hidden = false; tour.go(0);
    setTimeout(() => setHint(TOUCH ? 'Стрелки внизу или свайп — следующий вагон' : 'Стрелки ‹ › внизу или на клавиатуре — следующий вагон', 6500), 900);
  }
  let exiting = false;
  function exit() {
    if (exiting) return; exiting = true; tour.nav.classList.add('off'); freeBtn.hidden = true; P.tour = null; if (G.game) endGame(true); hideCard(); el.classList.remove('walk'); setAct(actBtn); setAct(act2Btn); rumbleG && (rumbleG.gain.value = 0);
    if (REDUCE || G.mode === 'load' || G.mode === 'outside') return finish();
    if (G.mode === 'walk') { trainS = CAR0_OFF; setInside(false); }
    G.mode = 'flyout'; hiss(2.4, 900, .05); if (fly && !fly.rev) fly.rev = true; else fly = makeFlight(true);
  }
  function finish() {
    el.classList.remove('on'); setTimeout(() => {
      cancelAnimationFrame(raf); removeEventListener('resize', resize); removeEventListener('keydown', kd); removeEventListener('keyup', ku); unShake();
      (G.qTs || []).forEach(clearTimeout);
      scene.traverse(o => { o.geometry && o.geometry.dispose(); }); renderer.dispose(); pmrem.dispose(); rt.dispose();
      el.remove(); document.body.style.overflow = ''; AC && AC.close(); if (btn) btn.focus({ preventScroll: true });
    }, 520);
  }

  /* ---------- кадр ---------- */
  let raf = 0, last = performance.now(), time = 0, spinV = 0;
  const tmpC = new THREE.Color();
  const SH = makeShake(REDUCE);
  const unShake = bindShake($('.rk-shake'), p => { SH.kick(p); if (!REDUCE) spinV += 2.2 * p; chime([2093, 2637, 3136, 2349], .03, 1.6, .07); });
  const Q_ = { n: 0, acc: 0, step: 0 };
  function adapt(ms) { if (G.mode !== 'walk' || Q_.step >= 2) return; if (Q_.step === 1 && Q_.n === 89) bloom.enabled = false; Q_.acc += ms; if (++Q_.n < 90) return; const avg = Q_.acc / Q_.n; Q_.n = 0; Q_.acc = 0; if (avg < 21) return; Q_.step++; const pr = Q_.step === 1 ? Math.max(1, DPR * .75) : 1; renderer.setPixelRatio(pr); composer.setPixelRatio(pr); if (Q_.step === 2) bloom.resolution.multiplyScalar(.6); resize(); }
  function frame(now) { raf = requestAnimationFrame(frame); const ms = now - last, dt = Math.min(.05, ms / 1000); last = now; adapt(ms); tick(dt); composer.render(); }
  let sway = { roll: 0, y: 0, z: 0, bump: 0 };
  function tick(dt) {
    time += dt;
    // игрушечный поезд в шаре
    if (fly && !fly.rev) trainS = CAR0_OFF + .9 * (clamp(fly.t, 0, 1) - 1) * fly.dur; else trainS += .9 * dt;
    if (globe.visible) { toy.updateMatrixWorld(); placeTrain(time); }
    if (fly) {
      fly.t += (fly.rev ? -dt : dt) / fly.dur; const k = clamp(fly.t, 0, 1), e = ease(k);
      cam.p.copy(fly.pc.getPoint(e)); cam.l.copy(fly.lc.getPoint(e)); cam.fov = fly.f0 + (fly.f1 - fly.f0) * smooth(.3, 1, e);
      if (!fly.rev && fly.t >= 1) { fly = null; Object.assign(cam, fpPose()); arrive(); }
      else if (fly && fly.rev && fly.t <= 0) { fly = null; G.mode = 'shelf'; setTimeout(finish, 700); }
    } else if (G.mode === 'outside' || G.mode === 'shelf' || G.mode === 'load') {
      const o = outsidePose(); cam.p.copy(o.p).add(V3(Math.sin(time * .25) * .8, Math.sin(time * .2) * .3, 0)); cam.l.copy(o.l); cam.fov = o.fov;
    } else if (G.mode === 'walk') {
      updatePlayer(dt);
      let tp;
      if (G.game === 'mand') tp = fitPose(V3(MAND.table.x, MAND.table.y, MAND.table.z), V3(0, 1.1, -.62), 1.0, .7, 44, 58);
      else if (G.game === 'bells') tp = fitPose(V3(carX(2) + .3, 1.92, 0), V3(-1, -.05, 0), 1.9, 1.0, 46, 60);
      else if (G.game === 'frost') { tp = fitPose(V3(FROST.x, FROST.y, FROST.z), V3(0, 0, -1), 1.75, 1.5, 50, 64); tp.p.z = Math.max(tp.p.z, -1.2); }
      else tp = fpPose();
      const kk = closeUp() || G.wasClose ? 1 - Math.pow(.02, dt) : 1; G.wasClose = closeUp() || (G.wasClose && cam.p.distanceTo(tp.p) > .05);
      cam.p.lerp(tp.p, kk); cam.l.lerp(tp.l, kk); cam.fov += (tp.fov - cam.fov) * (1 - Math.pow(.01, dt));
    }
    // поезд едет: пейзаж и шпалы
    if (inside.visible) {
      G.D += V_TRAIN * dt; layers.forEach(l => { l.g.position.x = MID_X + l.L / 2 - mod(G.D, l.L); }); groundTex.offset.x = (G.D / 10) % 1;
      sky.position.copy(camera.position); stars.position.copy(camera.position);
      moonSp.position.copy(camera.position).addScaledVector(MOON_DIR, 1500); moonD.position.copy(moonSp.position); moonD.lookAt(camera.position);
      // стыки рельсов: «ту-тук… ту-тук»
      if (G.D >= G.nextJoint) { G.nextJoint += 25; const a = .2 * 12 / V_TRAIN; clack(0, 1); clack(a, .8); clack(1.05 * 12 / V_TRAIN, .9); clack(1.05 * 12 / V_TRAIN + a, .75); if (!REDUCE) { sway.bump = 1; setTimeout(() => { sway.bump = .7; }, 1050 * 12 / V_TRAIN); } }
      if (rumbleG && sndOn) rumbleG.gain.value += (.09 - rumbleG.gain.value) * .05;
      if (!REDUCE) { sway.roll = Math.sin(time * 1.25) * .005 + Math.sin(time * .53 + 1) * .004; sway.z = Math.sin(time * .9) * .012; sway.bump *= Math.pow(.002, dt); sway.y = Math.sin(time * 30) * .006 * sway.bump - .004 * sway.bump; }
      // свет за пассажиром
      const cx = carX(clamp(Math.round(-P.x / PITCH), 0, 3)); pl1.position.set(cx + 4, 1.85, 0); pl2.position.set(cx - 4, 1.85, 0); pl3.position.set(P.x + Math.cos(P.yaw) * 1.6, 1.9, clamp(P.z + Math.sin(P.yaw) * 1.6, -.6, .6));
      carGroups.forEach((cg, k) => { cg.visible = Math.abs(k - G.cur) <= 1 || G.cur < 0; });
    }
    applyCam();
    // оживание вагонов
    wake.forEach(w => { w.lv += clamp(w.tg - w.lv, -dt * .7, dt * .7); });
    for (let i = 0; i < bulbData.length; i++) { const b = bulbData[i], L = wake[b.car].lv; let lv = smooth(b.order, b.order + .15, L); lv = .12 + lv * (.85 + .15 * Math.sin(time * 2.2 + b.ph)); bulbs.setColorAt(i, tmpC.copy(b.c).multiplyScalar(lv)); }
    if (bulbs.instanceColor) bulbs.instanceColor.needsUpdate = true;
    // качание шаров и колокольчиков
    const sw = REDUCE ? 0 : Math.sin(time * 1.25) * .06 + sway.bump * .05 * Math.sin(time * 14);
    swingers.forEach(s => { s.m.position.x = s.base.x + Math.sin(time * 1.1 + s.ph) * .004; s.m.position.z = s.base.z + sw * s.len * .5; });
    BELLS.forEach(b => { b.sv += (-b.sw * 40 - b.sv * 2.4) * dt; b.sw += b.sv * dt; b.pivot.rotation.x = b.sw * .5 + sw * .3; b.lit *= Math.pow(.15, dt); b.gl.material.opacity = b.lit * .9; });
    // игрушки
    TOYS.list.forEach((t, i) => {
      if (t.fly > 0 && t.fly < 1) { t.fly = Math.min(1, t.fly + dt / 1.1); const e = ease(t.fly); t.m.position.lerpVectors(t.from, t.to, e); t.m.position.y += Math.sin(e * Math.PI) * .5; t.m.rotation.y += dt * 6; }
      t.hl = Math.max(0, t.hl - dt); const glow = (G.game === 'toys' && !t.found ? .1 + .08 * Math.sin(time * 3 + i) : 0) + (t.hl > 0 ? .6 + .3 * Math.sin(time * 8) : 0); t.gl.material.opacity = glow; t.gl.position.copy(t.m.position);
    });
    // мандарины
    if (MAND.table) {
      const tb = MAND.table, live = G.game === 'mand';
      const aw = REDUCE ? 0 : (Math.sin(time * 1.25) * .5 + Math.sin(time * .53 + 1) * .35) * (live ? 1.0 : .2), au = sway.bump * (live ? 1.2 : .1) * Math.sin(time * 9);
      MAND.list.forEach((m, i) => {
        if (m.done) { if (m.fly < 1) { m.fly = Math.min(1, m.fly + dt / .55); const e = ease(m.fly), to = V3(MAND.bowl.x - carX(1), MAND.bowl.y, MAND.bowl.z).add(m.to); m.g.position.lerpVectors(m.from, to, e); m.g.position.y += Math.sin(e * Math.PI) * .25; } return; }
        m.vu += (au + Math.sin(time * 2.3 + i * 1.7) * (live ? .25 : 0)) * dt; m.vw += (aw + Math.cos(time * 1.9 + i * 2.3) * (live ? .25 : 0)) * dt; const fr = Math.pow(.35, dt); m.vu *= fr; m.vw *= fr; m.u += m.vu * dt; m.w += m.vw * dt;
        if (Math.abs(m.u) > .42) { m.u = Math.sign(m.u) * .42; m.vu *= -.5; } if (Math.abs(m.w) > .27) { m.w = Math.sign(m.w) * .27; m.vw *= -.5; }
        const d = Math.hypot(m.u, m.w); if (d < .19) { const nx = m.u / (d || 1), nz = m.w / (d || 1); m.u = nx * .19; m.w = nz * .19; const vn = m.vu * nx + m.vw * nz; if (vn < 0) { m.vu -= 1.5 * vn * nx; m.vw -= 1.5 * vn * nz; } }
        MAND.list.forEach((o, j) => { if (j <= i || o.done) return; const dx = o.u - m.u, dz = o.w - m.w, dd = Math.hypot(dx, dz); if (dd < .085 && dd > 1e-4) { const p = (.085 - dd) / 2, nx = dx / dd, nz = dz / dd; m.u -= nx * p; m.w -= nz * p; o.u += nx * p; o.w += nz * p; } });
        m.g.position.set(m.u, tb.y + .036, tb.z + m.w); m.g.rotation.x += m.vw * dt / .042; m.g.rotation.z -= m.vu * dt / .042;
        m.g.scale.setScalar(live && MAND.sel === i && !TOUCH ? 1.18 + .05 * Math.sin(time * 8) : 1);
      });
      if (live) { const s = Math.floor(time - MAND.t0); if (s !== MAND.lastS) { MAND.lastS = s; setHud(MAND.n + ' из 8 · ' + s + ' с'); } }
    }
    if (G.game === 'frost' && (Math.floor(time * 2) !== Math.floor((time - dt) * 2))) fogUp(false);
    else if (!G.game && FROST.drawn && Math.floor(time) !== Math.floor(time - dt)) fogUp(false);
    // искры
    for (let i = 0; i < SP; i++) { if (spLife[i] > 0) { spLife[i] -= dt; spVel[i * 3 + 1] -= 1.6 * dt; spPos[i * 3] += spVel[i * 3] * dt; spPos[i * 3 + 1] += spVel[i * 3 + 1] * dt; spPos[i * 3 + 2] += spVel[i * 3 + 2] * dt; spSeed[i * 4 + 3] = Math.max(0, spLife[i]) * .03; } else spSeed[i * 4 + 3] = 0; }
    spGeo.attributes.position.needsUpdate = spGeo.attributes.aSeed.needsUpdate = true;
    const sc = Hh * renderer.getPixelRatio() / (2 * Math.tan(camera.fov * Math.PI / 360));
    spinV *= Math.pow(.6, dt); gSnowU.uTime.value = time * (REDUCE ? .5 : 1); gSnowU.uScale.value = sc; gSnowU.uSpin.value += spinV * dt + dt * .05;
    SH.step(dt, REDUCE ? .5 : 1); SH.apply(gSnowU); SH.apply(outSnowU);
    outSnowU.uTime.value = time; outSnowU.uScale.value = sc; starU.uTime.value = villU.uTime.value = treeLU.uTime.value = spU.uTime.value = time;
    starU.uScale.value = sc * 4; villU.uScale.value = sc * .14; treeLU.uScale.value = sc * .04; spU.uScale.value = sc * .6;
    if (G.mode === 'walk') { checkCar(); updateActs(); }
  }
  function applyCam() {
    bokeh.update(1 / 60, time, camera); grade.uniforms.uTime.value = time;
    camera.position.copy(cam.p); camera.up.set(0, 1, 0);
    if (inside.visible && G.mode === 'walk') { camera.position.y += sway.y; camera.position.z += sway.z; }
    camera.lookAt(cam.l); if (inside.visible && G.mode === 'walk') camera.rotateZ(sway.roll);
    camera.fov = cam.fov; camera.aspect = aspect; camera.updateProjectionMatrix();
  }
  /* ---------- ходьба по вагонам ---------- */
  function gapOf(x) { const k = Math.round(-x / PITCH), lx = x - carX(k); if (Math.abs(lx) <= HALF - .25) return { car: k, gap: -1 }; return { car: k, gap: lx < 0 ? k : k - 1 }; }
  const doorOpen = [0, 0, 0];
  function free(x, z) {
    if (x > carX(0) + HALF - .3 - PLAYER_R || x < carX(CAR_N - 1) - HALF + .3 + PLAYER_R) return false;
    const k = Math.round(-x / PITCH), lx = x - carX(k);
    if (Math.abs(lx) > HALF - .3 - PLAYER_R) { const g = lx < 0 ? k : k - 1; if (g < 0 || g > 2) return false; if (Math.abs(z) > .36 - PLAYER_R * .4) return false; return doorOpen[g] > .7; }
    if (Math.abs(z) > IN_W - .2 - PLAYER_R) return false;
    for (const o of obst) if (x > o[0] - PLAYER_R && x < o[1] + PLAYER_R && z > o[2] - PLAYER_R && z < o[3] + PLAYER_R) return false;
    return true;
  }
  function updatePlayer(dt) {
    if (P.tour) { tourStep(dt); doorsStep(dt); return; }
    const can = !closeUp();
    let fw = 0, st = 0, tr = 0;
    if (can) {
      if (keys.fw || padHeld.fw) fw += 1; if (keys.bk || padHeld.bk) fw -= 1; if (keys.sl) st -= 1; if (keys.sr) st += 1; if (keys.tl || padHeld.tl) tr -= 1; if (keys.tr || padHeld.tr) tr += 1;
      if (joy) { fw -= joy.dy; tr += joy.dx * .9; }
    }
    P.yaw += tr * 1.7 * dt;
    let mx = 0, mz = 0; const cy = Math.cos(P.yaw), sy = Math.sin(P.yaw);
    if (fw || st) { P.goto = null; mx = cy * fw - sy * st; mz = sy * fw + cy * st; }
    else if (P.goto && can) {
      let tx = P.goto.x, tz = P.goto.z; const dx = tx - P.x;
      if (Math.abs(dx) > 1.2 && Math.abs(P.z) > .25) { tx = P.x + Math.sign(dx) * .9; tz = 0; }
      const ddx = tx - P.x, ddz = tz - P.z, d = Math.hypot(ddx, ddz);
      if (d < .2 && tx === P.goto.x) { P.goto = null; }
      else { const f = Math.min(1, d / .8); mx = ddx / d * f; mz = ddz / d * f; const want = Math.atan2(mz, mx); if (Math.abs(dx) > .6 || P.goto.car !== undefined) P.yaw += wrapA(want - P.yaw) * (1 - Math.pow(.05, dt)); }
    }
    const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
    const SPD = 1.9; P.vx += (mx * SPD - P.vx) * (1 - Math.pow(.002, dt)); P.vz += (mz * SPD - P.vz) * (1 - Math.pow(.002, dt));
    const nx = P.x + P.vx * dt, nz = P.z + P.vz * dt;
    if (free(nx, P.z)) P.x = nx; else { P.vx = 0; if (P.goto && Math.abs(P.z) > .2) P.goto.z = 0; }
    if (free(P.x, nz)) P.z = nz; else P.vz = 0;
    if (P.goto && Math.hypot(P.vx, P.vz) < .02 && !free(P.x + Math.sign(P.goto.x - P.x) * .3, P.z) && Math.abs(P.z) < .25) { const g = gapOf(P.x + Math.sign(P.goto.x - P.x) * 1.5).gap; if (g < 0) P.goto = null; }
    const sp = Math.hypot(P.vx, P.vz); if (!REDUCE) P.bob += sp * dt * 5.5;
    // двери открываются сами, когда подходишь
    doorsStep(dt);
  }
  function doorsStep(dt) {
    for (let g = 0; g < 3; g++) { const gx = carX(g) - 9, near = Math.abs(P.x - gx) < 2.3 && Math.abs(P.z) < 1.1; const before = doorOpen[g]; doorOpen[g] += clamp((near ? 1 : 0) - doorOpen[g], -dt * 1.6, dt * 1.8); if (before < .05 && doorOpen[g] >= .05) hiss(.6, 700, .035); (doors[g] || []).forEach(d => { d.position.z = ease(clamp(doorOpen[g], 0, 1)) * .86; }); }
  }
  function checkCar() {
    const k = clamp(Math.round(-P.x / PITCH), 0, CAR_N - 1); const inGap = Math.abs(P.x - carX(k)) > HALF - .2;
    if (k !== G.cur && !inGap) {
      const first = !wake[k].seen; G.cur = k; wake[k].tg = Math.max(wake[k].tg, 1.2); wake[k].seen = true; setCarLbl();
      $('.rl-prev').disabled = k === 0; $('.rl-next').disabled = k === CAR_N - 1;
      if (first || time - (wake[k].lastT || 0) > 25) { wake[k].lastT = time; showPlace(CARS[k].name, CARS[k].text); chime([[1047, 1319, 1568], [988, 1245, 1480], [880, 1109, 1319, 1760], [784, 988, 1175, 1568]][k], .035, 1.8, .12); }
    }
  }
  function setCarLbl() { const k = Math.max(0, G.cur); carLbl.textContent = (innerWidth < 720 ? '' : 'Вагон ') + (k + 1) + ' из 4'; }
  function updateActs(force) {
    if (G.mode !== 'walk') return;
    let a = null, b = null;
    if (G.game === 'toys') { const near = TOYS.list.filter(t => !t.found && t.m.position.distanceTo(V3(P.x, EYE * .8, P.z)) < 1.7)[0]; a = near ? ['Взять: ' + near.n, () => foundToy(near)] : ['Подсказка', toyHint]; b = ['Закончить поиск', () => endGame(true)]; }
    else if (G.game === 'mand') { b = ['Назад в вагон', () => endGame(true)]; }
    else if (G.game === 'bells') { b = ['Назад в вагон', () => endGame(true)]; }
    else if (G.game === 'frost') { a = ['Нарисовать снежинку', snowflakeDraw]; b = [FROST.drawn > 20 ? 'Готово' : 'Назад в вагон', () => FROST.drawn > 20 ? frostDone() : endGame(true)]; }
    else if (!G.free) { const s = stations.find(s => s.id === G.tourSt); if (s) a = [s.label, () => stationAct(s)]; }
    else { const s = stations.find(s => Math.hypot(P.x - s.x, P.z - s.z) < s.r); if (s) a = [s.label, () => stationAct(s)]; else { const g = gapOf(P.x).gap; if (g >= 0 || (doorOpen.some(d => d > .5))) { /* у двери ничего не нужно: открывается сама */ } } }
    setAct(actBtn, a && a[0], a && a[1]); setAct(act2Btn, b && b[0], b && b[1]);
  }

  /* ---------- старт ---------- */
  G.mode = 'outside'; Object.assign(cam, outsidePose()); applyCam(); placeTrain(0);
  try { renderer.compile(scene, camera); } catch (e) { }
  $('.rk-load').classList.add('off');
  raf = requestAnimationFrame(frame);
  const api = { exit, shake: () => $('.rk-shake').click() };
  if (DEBUG) {
    cancelAnimationFrame(raf);
    Object.assign(api, {
      G, P, wake, scene, camera, TOYS, MAND, BELLS, FROST, doorOpen,
      tick: (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) tick(dt); composer.render(); },
      enter, arrive, startGame, endGame, stationAct, snowflakeDraw, frostDraw, playRound, setInside,
      flyAt: e => { G.mode = 'flyin'; fly = makeFlight(false); fly.t = e; fly.dur = 1e9; },
      spot: i => { const t = TOURP[i]; fly = null; setInside(true); G.mode = 'walk'; el.classList.add('walk'); P.x = t.x; P.z = t.z; P.yaw = t.yaw; P.pitch = t.pitch; P.tour = null; G.tourSt = t.st || null; tour.nav.classList.remove('off'); freeBtn.hidden = false; tour.i = i; tour.draw(); Object.assign(cam, fpPose()); }, tour,
      walkAt: (x, z, yaw, pitch = 0) => { fly = null; setInside(true); G.mode = 'walk'; el.classList.add('walk'); P.x = x; P.z = z; P.yaw = yaw; P.pitch = pitch; P.vx = P.vz = 0; Object.assign(cam, fpPose()); },
      wakeAll: () => wake.forEach(w => { w.tg = w.lv = 1.25; }),
    });
    window.__rl = api;
    if (Q.get("hide")) Q.get("hide").split(",").forEach(i => { const [gi, ci] = i.split("."); const g = scene.children[+gi]; (ci === undefined ? g : g.children[+ci]).visible = false; });
    const sc = Q.get('rlshot'); if (sc) runShot(api, sc);
    return api;
  }
  setTimeout(enter, REDUCE ? 900 : 1600);
  return api;
}

/* сценарии для скриншотов: ?rlshot=имя */
function runShot(a, name) {
  const done = () => { document.documentElement.dataset.shot = 'ready'; };
  const W = (x, z, yaw, pitch, n = 40) => { a.walkAt(x, z, yaw, pitch); a.wakeAll(); a.tick(n); };
  const S = {
    shelf: () => a.tick(30),
    shake: () => { a.tick(30); a.shake(); a.tick(24); },
    windowshake: () => { W(-54 + .5, .75, Math.PI / 2 + .15, .06); a.shake(); a.tick(30); },
    fly1: () => { a.flyAt(.42); a.tick(2); },
    fly2: () => { a.flyAt(.8); a.tick(2); },
    car1: () => W(-6.5, .55, .12, -.05),
    car1b: () => W(6.0, .1, Math.PI - .2, -.02),
    car2: () => W(-18 + 6.4, 0, Math.PI, -.06),
    car3: () => W(-36 - 4, 0, 0, .12),
    car4: () => W(-54 + 6.8, -.3, Math.PI - .05, -.02),
    window: () => W(-54 + .5, .75, Math.PI / 2 + .15, .06),
    rear: () => W(-54 - 5.5, 0, Math.PI, -.04),
    sky: () => W(-54 + 1, .2, -Math.PI / 2, .3),
    skyp: () => W(-54 + 1, -.5, Math.PI / 2, .25),
    door: () => { W(-18 - 6.9, 0, Math.PI, .02, 50); },
    toys: () => { W(-1.5, -.2, .35, .05); a.startGame('toys'); a.TOYS.list[0].hl = 3; a.tick(10); },
    mand: () => { W(-18, .3, Math.PI / 2, -.4); a.startGame('mand'); a.tick(50); },
    bells: () => { W(-36 - 1.1, 0, 0, .1); a.startGame('bells'); a.tick(45); a.BELLS[1].lit = 1; a.BELLS[1].sv = 1; a.BELLS[3].lit = .6; a.tick(3); },
    frost: () => { W(-54 + 4, .7, Math.PI / 2, 0); a.startGame('frost'); a.tick(40); a.snowflakeDraw(); },
  };
  (S[name] || S.shelf)();
  if (name === 'frost') { let i = 0; const iv = setInterval(() => { a.tick(1); if (++i > 30) { clearInterval(iv); a.tick(4); done(); } }, 80); return; }
  done();
}
