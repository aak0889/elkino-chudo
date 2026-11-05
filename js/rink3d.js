/* «Каток» в снежном шаре: 3D на three.js r160 (ES-модули через importmap, jsDelivr).
   Дорогой стеклянный шар на полке → камера влетает сквозь стекло → мир внутри оказывается
   больше, чем казался: деревня, ярмарка, мостик, тропинка в лес, дальние огни за холмами.
   Прогулка от третьего лица, на льду — скольжение; по желанию мини-игра «собрать звёзды».
   Все модели процедурные (примитивы three.js), никаких скачанных ассетов. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const Q = new URLSearchParams(location.search);
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches || Q.get('rm') === '1';
const LOW = Q.get('q') === 'low' || (Q.get('q') !== 'high' && (matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600));
const TOUCH = matchMedia('(pointer: coarse)').matches;
const DEBUG = Q.has('rkshot');
const store = window.ElkStore || (() => null);

/* масштабы: шар в сцене радиусом 10; мир внутри строится в «своих» единицах и уменьшен в S раз */
const R = 10, GROUND_Y = -2.5, CORE = 55.2, S = Math.sqrt(R * R - GROUND_Y * GROUND_Y) / CORE;
const RINK = 7.5, GAME_TIME = 60, WALK_R = 45;

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const HDR = (r, g, b) => new THREE.Color(r, g, b);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));

/* ---------------- рельеф (локальные единицы) ---------------- */
const streamX = z => 19 + Math.sin(z * .09) * 3;
const PATH = [[-4.5, 9.5], [-10, 15], [-16, 21.5], [-21.5, 27.5], [-26, 32]];
function distPath(x, z) { let d = 1e9; for (let i = 0; i < PATH.length - 1; i++) { const [ax, az] = PATH[i], [bx, bz] = PATH[i + 1]; const vx = bx - ax, vz = bz - az; const t = clamp(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz), 0, 1); d = Math.min(d, Math.hypot(x - ax - vx * t, z - az - vz * t)); } return d; }
function hgt(x, z) {
  const r = Math.hypot(x, z);
  let n = Math.sin(x * .13 + 1.3) * Math.cos(z * .11 - .4) * .7 + Math.sin(x * .31 + z * .23) * .25 + Math.sin(x * .05 - z * .07) * .9;
  let h = n * smooth(10, 19, r) * (1 - .7 * (1 - smooth(1.5, 4, distPath(x, z))));
  const ds = Math.abs(x - streamX(z)); h -= .55 * (1 - smooth(1.6, 4.5, ds)) * (1 - smooth(44, 50, r));
  h += 2.2 * smooth(42, 53, r);
  if (r > 54) {
    const hn = Math.sin(x * .045 + 2) * Math.cos(z * .05) * .5 + .5 + Math.sin(x * .021 - z * .017) * .35;
    h += -1.2 * smooth(54, 64, r) + hn * 9 * smooth(62, 95, r) + 12 * smooth(110, 165, r);
  }
  return h;
}
const onIce = (x, z) => Math.hypot(x, z) < RINK - .05;

/* ---------------- текстуры ---------------- */
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const glowTex = () => canvasTex(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.18, 'rgba(255,255,255,.55)'); gr.addColorStop(.5, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
const bokehTex = () => canvasTex(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,.5)'); gr.addColorStop(.8, 'rgba(255,255,255,.68)'); gr.addColorStop(.9, 'rgba(255,255,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(w / 2, w / 2, w / 2, 0, 7); g.fill(); });
function woodTex(base, dark, light) {
  const t = canvasTex(1024, 256, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); for (let i = 0; i < 140; i++) { const y0 = rnd() * h, a = 2 + rnd() * 6, f = .002 + rnd() * .01, ph = rnd() * 6; g.strokeStyle = rnd() < .65 ? dark : light; g.globalAlpha = .08 + rnd() * .22; g.lineWidth = .6 + rnd() * 2.4; g.beginPath(); for (let x = 0; x <= w; x += 8) { const y = y0 + Math.sin(x * f + ph) * a + Math.sin(x * f * 3.1 + ph) * a * .3; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); } g.globalAlpha = 1; });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const windowTex = () => canvasTex(64, 64, (g, w) => { const gr = g.createRadialGradient(w / 2, w * .6, 2, w / 2, w / 2, w * .7); gr.addColorStop(0, '#fff3c9'); gr.addColorStop(.5, '#ffc062'); gr.addColorStop(1, '#c86a1e'); g.fillStyle = gr; g.fillRect(0, 0, w, w); g.fillStyle = '#3a2213'; g.fillRect(0, 0, w, 5); g.fillRect(0, w - 5, w, 5); g.fillRect(0, 0, 5, w); g.fillRect(w - 5, 0, 5, w); g.fillRect(w / 2 - 2, 0, 4, w); g.fillRect(0, w / 2 - 2, w, 4); });
const iceTex = () => canvasTex(1024, 1024, (g, w) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, w); g.strokeStyle = 'rgba(150,180,215,1)'; for (let i = 0; i < 110; i++) { const cx = w / 2 + (rnd() - .5) * w * .5, cy = w / 2 + (rnd() - .5) * w * .5, r = 60 + rnd() * 380, a = rnd() * 6.3; g.globalAlpha = .05 + rnd() * .12; g.lineWidth = .6 + rnd() * 1.2; g.beginPath(); g.arc(cx, cy, r, a, a + .4 + rnd() * 1.8); g.stroke(); } g.globalAlpha = 1; });
const awningTex = (a, b) => canvasTex(256, 64, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * w / 8, 0, w / 8, h); } g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, h - 6, w, 6); });

/* ---------------- точки: снег, мерцание ---------------- */
function pointsMat(frag, vert, uniforms) { return new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, fog: false }); }
const SNOW_V = `
uniform float uTime, uScale, uSpin, uFloor, uTop, uBox, uMode; uniform vec3 uC;
attribute vec4 aSeed; varying float vA;
void main(){
  vec3 p;
  if (uMode < .5) {                       // снаружи: снег во всём шаре
    float H = uTop - uFloor; float y = uFloor + mod(position.y - uTime * aSeed.z, H);
    p = vec3(position.x, y, position.z);
    float a = uSpin * (1.25 - length(p.xz) / 12.0) + sin(uTime * .35 + aSeed.x * 6.28) * .18;
    float c = cos(a), s = sin(a); p.xz = mat2(c, -s, s, c) * p.xz;
    p.x += sin(uTime * .7 + aSeed.y * 12.0) * .22; p.z += cos(uTime * .6 + aSeed.x * 9.0) * .22;
    vA = smoothstep(9.85, 9.2, length(p)) * smoothstep(uFloor, uFloor + .5, y);
  } else {                                // внутри: снег вокруг камеры (локальные единицы)
    vec3 q = position * (uBox / 20.0);
    q.y -= uTime * aSeed.z * 3.0; q.x += sin(uTime * .6 + aSeed.y * 12.0) * 1.2; q.z += cos(uTime * .5 + aSeed.x * 9.0) * 1.2;
    p = uC + mod(q - uC + uBox * .5, uBox) - uBox * .5;
    vA = 1.0 - smoothstep(uBox * .3, uBox * .5, length(p - uC));
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = aSeed.w * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const SNOW_F = `uniform float uOpacity; varying float vA;
void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .12, d) * vA * uOpacity; if (a < .01) discard; gl_FragColor = vec4(vec3(1.0, .97, .93) * 1.2, a); }`;
const TW_V = `uniform float uTime, uScale; attribute vec4 aSeed; varying float vB;
void main(){ vB = pow(.5 + .5 * sin(uTime * aSeed.x + aSeed.y), aSeed.z); vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSeed.w * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`;
const TW_F = `uniform float uOpacity, uGain; uniform vec3 uColor; varying float vB;
void main(){ vec2 c = gl_PointCoord - .5; float d = length(c);
  float a = smoothstep(.5, 0.0, d) + max(0.0, 1.0 - abs(c.x) * 18.0) * smoothstep(.5, .0, abs(c.y)) * .45 + max(0.0, 1.0 - abs(c.y) * 18.0) * smoothstep(.5, .0, abs(c.x)) * .45;
  a *= vB * uOpacity; if (a < .01) discard; gl_FragColor = vec4(uColor * uGain, a); }`;
function pointCloud(pos, seeds, u, F = TW_F, Vs = TW_V) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 4));
  const p = new THREE.Points(g, pointsMat(F, Vs, u)); p.frustumCulled = false; return p;
}

function upFacing(pos, idx) { let g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); if (g.attributes.normal.getY(0) < 0) { const r = []; for (let i = 0; i < idx.length; i += 3) r.push(idx[i], idx[i + 2], idx[i + 1]); g.setIndex(r); g.computeVertexNormals(); } return g; }
/* ================================================================= */
export async function open(btn) {
  if (document.getElementById('rk')) return;
  const t = document.createElement('canvas'); if (!(t.getContext('webgl2') || t.getContext('webgl'))) throw new Error('no webgl');
  return build(btn);
}

async function build(btn) {
  seed = 7;
  /* ---------- DOM ---------- */
  const el = document.createElement('div'); el.className = 'rk' + (TOUCH ? ' touch' : ''); el.id = 'rk';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Каток: снежный шар, внутри которого можно гулять');
  el.innerHTML = `
  <canvas class="rk-cv" tabindex="0" aria-label="Мир внутри снежного шара"></canvas>
  <div class="rk-vign" aria-hidden="true"></div>
  <div class="rk-flash" aria-hidden="true"></div>
  <header class="rk-bar">
    <h2 class="rk-title"><small>Снежный шар</small>Каток</h2>
    <p class="rk-hud" aria-live="polite"><span class="rk-sc"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1l2.6 5.6 6.1.7-4.5 4.2 1.2 6L10 14.5 4.6 17.5l1.2-6L1.3 7.3l6.1-.7z"/></svg><b>0</b></span><span class="rk-tm"><b>60</b> с</span><span class="rk-best">рекорд <b>0</b></span></p>
    <button class="rk-btn rk-snd" type="button" aria-pressed="false" aria-label="Звук: включить"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path class="on" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path class="off" d="M16.5 9.5l5 5M21.5 9.5l-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
    <button class="rk-btn rk-close" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Выйти из шара</span></button>
  </header>
  <p class="rk-place" aria-live="polite"><b></b><span></span></p>
  <p class="rk-hint"></p>
  <button class="rk-stars" type="button" hidden><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1l2.6 5.6 6.1.7-4.5 4.2 1.2 6L10 14.5 4.6 17.5l1.2-6L1.3 7.3l6.1-.7z"/></svg>Собрать звёзды</button>
  <div class="rk-combo" aria-hidden="true"></div>
  <div class="rk-pops" aria-hidden="true"></div>
  <div class="rk-joy" aria-hidden="true"><i></i></div>
  <div class="rk-card" hidden><div class="rk-card-in"><svg class="rk-mark" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 0c.6 5.4 4.6 9.4 10 10-5.4.6-9.4 4.6-10 10-.6-5.4-4.6-9.4-10-10C5.4 9.4 9.4 5.4 10 0Z"/></svg><h3></h3><p></p><div class="rk-acts"><button class="rk-go" type="button"></button><button class="rk-out" type="button">Гулять дальше</button></div></div></div>
  <div class="rk-load"><span>Снимаем шар с полки…</span></div>`;
  document.body.appendChild(el); document.body.style.overflow = 'hidden';
  const $ = s => el.querySelector(s);
  const cv = $('.rk-cv'), flash = $('.rk-flash'), card = $('.rk-card'), pops = $('.rk-pops'), comboEl = $('.rk-combo'), hint = $('.rk-hint'), placeEl = $('.rk-place'), starsBtn = $('.rk-stars');
  const hudSc = $('.rk-sc b'), hudTm = $('.rk-tm b'), hudBest = $('.rk-best b');
  let best = +(store('elk-best-rink') || 0); hudBest.textContent = best;
  requestAnimationFrame(() => el.classList.add('on'));

  /* ---------- renderer ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: DEBUG });
  const DPR = Math.min(devicePixelRatio || 1, LOW ? 1.5 : 1.75); renderer.setPixelRatio(DPR);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
  renderer.shadowMap.enabled = !LOW; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .01, 600);
  const FOG_COL = new THREE.Color(0x2a3c68);
  scene.fog = new THREE.FogExp2(FOG_COL, 0);
  const pmrem = new THREE.PMREMGenerator(renderer); const envMap = makeEnv(pmrem);
  const T_GLOW = glowTex(), T_BOKEH = bokehTex(), T_WIN = windowTex();

  /* ===== СНАРУЖИ: комната, полка, подставка, стекло ===== */
  const outside = new THREE.Group(); scene.add(outside);
  const bgU = { uIn: { value: 0 }, uBok: { value: 1 } };
  const bg = new THREE.Mesh(new THREE.SphereGeometry(200, 48, 24), new THREE.ShaderMaterial({
    uniforms: bgU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform float uIn, uBok; varying vec3 vP; void main(){ vec3 d = normalize(vP); float h = d.y;
      vec3 room = mix(vec3(.016,.012,.012), vec3(.010,.016,.036), smoothstep(-.35,.55,h));
      room += vec3(.20,.11,.045) * pow(max(0., dot(d, normalize(vec3(.1,-.05,-1.)))), 7.) * .45;
      room += vec3(.05,.07,.14) * pow(max(0., dot(d, normalize(vec3(-.8,.4,-.6)))), 3.) * .5;
      for (int i = 0; i < 16; i++) { float fi = float(i); float az = -1.2 + fi * .16 + sin(fi * 7.3) * .05; float el = -.14 + .1 * sin(fi * 2.1) + .05 * cos(fi * 5.7); if (abs(az) < .3) el += .22;
        vec3 bd = normalize(vec3(sin(az), el, -cos(az))); float rad = .018 + .012 * fract(sin(fi * 12.9) * 43758.5); float dd = acos(clamp(dot(d, bd), -1., 1.));
        vec3 bc = mix(vec3(1.,.7,.35), vec3(1.,.45,.4), step(.75, fract(fi * .37))); float k = smoothstep(rad, rad * .86, dd) * (.55 + .45 * smoothstep(rad * .6, rad * .95, dd));
        room += bc * k * (.035 + .03 * fract(fi * .61)) * uBok; }
      gl_FragColor = vec4(room * (1. - uIn), 1.); }`
  }));
  bg.renderOrder = -10; outside.add(bg);
  const hemi = new THREE.HemisphereLight(0x6f86c0, 0x1a1210, .22); scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xb9c9ff, .5); moon.position.set(-5, 14, 7); scene.add(moon); scene.add(moon.target);
  moon.castShadow = !LOW; moon.shadow.mapSize.set(2048, 2048); moon.shadow.bias = -.0003; moon.shadow.normalBias = .01; moon.shadow.radius = 3;
  const key = new THREE.DirectionalLight(0xffcf98, 1.6); key.position.set(-22, 16, 26); scene.add(key);
  const rimL = new THREE.DirectionalLight(0x8fb2ff, .9); rimL.position.set(24, 10, -18); scene.add(rimL);

  const shelfMat = new THREE.MeshPhysicalMaterial({ map: woodTex('#4a2e1b', '#2a170c', '#6b4429'), roughness: .5, clearcoat: .5, clearcoatRoughness: .35, envMap, envMapIntensity: .5 }); shelfMat.map.repeat.set(3, 1);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(110, 1.6, 30), shelfMat); shelf.position.set(0, -13.3, 2); outside.add(shelf);
  const baseMat = new THREE.MeshPhysicalMaterial({ map: woodTex('#3b1f12', '#1d0e06', '#5b3220'), roughness: .32, clearcoat: 1, clearcoatRoughness: .12, envMap, envMapIntensity: 1 }); baseMat.map.repeat.set(2, 1);
  const prof = [[0, -12.5], [8.5, -12.5], [8.85, -12.35], [8.9, -11.75], [8.55, -11.45], [7.9, -10.6], [7.3, -9.5], [6.85, -8.55], [6.95, -8.2], [6.95, -7.75], [6.3, -7.6], [0, -7.6]].map(p => new THREE.Vector2(p[0], p[1]));
  outside.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 96), baseMat));
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9b26a, metalness: 1, roughness: .22, envMap, envMapIntensity: 1.6 });
  [[8.62, -11.5, .13], [7.0, -7.95, .11], [8.15, -10.9, .05]].forEach(([r, y, t]) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 12, 128), gold); m.rotation.x = Math.PI / 2; m.position.y = y; outside.add(m); });
  await (document.fonts && document.fonts.load ? document.fonts.load('600 80px Cormorant').catch(() => 0) : 0);
  const plaqueTex = canvasTex(512, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#8a6630'); gr.addColorStop(.45, '#f3dca2'); gr.addColorStop(.6, '#d6ae66'); gr.addColorStop(1, '#7a5626'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(60,35,10,.7)'; g.lineWidth = 4; g.strokeRect(10, 10, w - 20, h - 20); g.fillStyle = '#3b2410'; g.font = '600 72px Cormorant, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Каток', w / 2, h / 2 + 4); });
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(3.6, .9), new THREE.MeshStandardMaterial({ map: plaqueTex, metalness: .85, roughness: .3, envMap, envMapIntensity: 1.4 }));
  plaque.position.set(0, -10.05, 7.66); plaque.rotation.x = -.43; outside.add(plaque);
  [[-15, 1.6, 4, 0xb33a44], [-11.4, 1.1, 8, 0xd6ae66], [14.5, 1.35, 6, 0x1f4f6a]].forEach(([x, r, z, c]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), new THREE.MeshPhysicalMaterial({ color: c, metalness: .7, roughness: .14, clearcoat: 1, envMap, envMapIntensity: 1.8 })); m.position.set(x, -12.5 + r, z); outside.add(m);
    const cp = new THREE.Mesh(new THREE.CylinderGeometry(r * .22, r * .26, r * .3, 20), gold); cp.position.set(x + r * .6, -12.5 + r * 1.45, z); cp.rotation.z = -1.0; outside.add(cp);
  });
  const caustic = new THREE.Mesh(new THREE.PlaneGeometry(34, 22), new THREE.MeshBasicMaterial({ map: T_GLOW, color: HDR(.55, .38, .2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); caustic.rotation.x = -Math.PI / 2; caustic.position.set(0, -12.48, 6); outside.add(caustic);
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xdfe7f6, roughness: .85 });
  { const side = []; for (let y = -7.8; y <= GROUND_Y + .45; y += .25) side.push(new THREE.Vector2(Math.sqrt(Math.max(0, 9.92 * 9.92 - y * y)), y)); outside.add(new THREE.Mesh(new THREE.LatheGeometry(side, 96), new THREE.MeshStandardMaterial({ color: 0xaab6d0, roughness: .9 }))); }
  // снег в шаре (виден снаружи)
  const gSnowU = { uTime: { value: 0 }, uScale: { value: 300 }, uSpin: { value: 0 }, uFloor: { value: GROUND_Y - .1 }, uTop: { value: 9.8 }, uBox: { value: 1 }, uMode: { value: 0 }, uC: { value: V3() }, uOpacity: { value: 1 } };
  { const n = LOW ? 600 : 1500, p = [], s = []; for (let i = 0; i < n; i++) { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 9.4; p.push(Math.cos(a) * r, rnd() * 20, Math.sin(a) * r); s.push(rnd(), rnd(), .22 + rnd() * .45, .05 + rnd() * rnd() * .1); } const sn = pointCloud(p, s, gSnowU, SNOW_F, SNOW_V); sn.renderOrder = 5; outside.add(sn); }
  const glassMat = LOW
    ? new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .03, transparent: true, opacity: .12, envMap, envMapIntensity: 1.4, specularIntensity: 0, depthWrite: false })
    : new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0, transmission: 1, thickness: 1.2, ior: 1.42, envMap, envMapIntensity: .8, specularIntensity: 0, depthWrite: false });
  const glass = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), glassMat); glass.renderOrder = 4; outside.add(glass);
  const rimMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ float f = pow(1. - abs(dot(vN, vV)), 3.2);
      vec3 col = mix(vec3(.45,.6,1.), vec3(1.,.82,.55), smoothstep(-.3,.7,vN.y));
      vec3 hv = normalize(vN + vV * .0); float st = pow(max(0., dot(hv, normalize(vec3(-.5,.5,.7)))), 90.) * .75 + pow(max(0., dot(hv, normalize(vec3(.62,.3,.72)))), 160.) * .45 + smoothstep(.985, .995, dot(hv, normalize(vec3(-.42,.62,.66)))) * .25;
      float a = (f * .55 + st) * smoothstep(-8.5, -6.5, vW.y); gl_FragColor = vec4(col * a, a); }`
  });
  const rimMesh = new THREE.Mesh(new THREE.SphereGeometry(R + .02, 96, 64), rimMat); rimMesh.renderOrder = 6; outside.add(rimMesh);

  /* ===== ВНУТРИ: мир в локальных единицах ===== */
  const world = new THREE.Group(); world.position.y = GROUND_Y; world.scale.setScalar(S); scene.add(world);
  const beyond = new THREE.Group(); world.add(beyond); beyond.visible = false;   // то, что видно только изнутри
  const inner = new THREE.Group(); world.add(inner); inner.visible = false;       // небо-купол, ближний снег
  // небо-купол «как стекло высоко над головой»
  const skyU = { uTime: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(190, 64, 32), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `varying vec3 vP; void main(){ vec3 d = normalize(vP); float h = d.y;
      vec3 c = mix(vec3(.075,.11,.22), vec3(.006,.012,.04), smoothstep(-.02,.55,h));
      c += vec3(.30,.19,.09) * pow(max(0., 1. - abs(h - .02) * 5.), 3.) * .35;
      // блики стекла купола: дуги и мягкое отражение комнаты
      float arc1 = exp(-pow((dot(d, normalize(vec3(.6,.2,-.77))) ) * 30., 2.)) * smoothstep(.25,.75,h);
      float arc2 = exp(-pow((dot(d, normalize(vec3(-.8,.1,.4))) ) * 45., 2.)) * smoothstep(.35,.85,h);
      c += vec3(.55,.62,.85) * arc1 * .16 + vec3(.9,.7,.45) * arc2 * .1;
      c += vec3(.5,.36,.2) * pow(max(0., dot(d, normalize(vec3(-.3,.85,.4)))), 30.) * .25;
      gl_FragColor = vec4(c, 1.); }`
  }));
  sky.renderOrder = -9; inner.add(sky);
  const starU = { uTime: { value: 0 }, uScale: { value: 300 }, uOpacity: { value: 1 }, uGain: { value: 1.5 }, uColor: { value: HDR(1, .95, .85) } };
  { const n = LOW ? 450 : 1100, p = [], s = []; for (let i = 0; i < n; i++) { const u = rnd() * Math.PI * 2, y = .07 + Math.pow(rnd(), .8) * .93, rr = Math.sqrt(1 - y * y); p.push(Math.cos(u) * rr * 180, y * 180, Math.sin(u) * rr * 180); s.push(.6 + rnd() * 2.2, rnd() * 6.3, 1 + rnd() * 3, rnd() < .06 ? 3.6 : 1 + rnd() * 1.6); } const st = pointCloud(p, s, starU); st.renderOrder = -8; inner.add(st); }
  const moonSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: T_GLOW, color: 0xdfe8ff, transparent: true, opacity: .9, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); moonSp.position.set(-70, 110, -110); moonSp.scale.set(40, 40, 1); inner.add(moonSp);
  const moonD = new THREE.Mesh(new THREE.CircleGeometry(4.2, 32), new THREE.MeshBasicMaterial({ color: HDR(2.2, 2.25, 2.4), fog: false })); moonD.position.copy(moonSp.position); moonD.lookAt(0, 0, 0); inner.add(moonD);
  const lSnowU = { uTime: { value: 0 }, uScale: { value: 300 }, uSpin: { value: 0 }, uFloor: { value: 0 }, uTop: { value: 0 }, uBox: { value: 34 }, uMode: { value: 1 }, uC: { value: V3() }, uOpacity: { value: 1 } };
  { const n = LOW ? 700 : 2200, p = [], s = []; for (let i = 0; i < n; i++) { p.push((rnd() - .5) * 20, (rnd() - .5) * 20, (rnd() - .5) * 20); s.push(rnd(), rnd(), .25 + rnd() * .4, .018 + rnd() * rnd() * .04); } const sn = pointCloud(p, s, lSnowU, SNOW_F, SNOW_V); sn.renderOrder = 5; inner.add(sn); }

  // земля (ядро, видно и снаружи)
  function terrainRing(r0, r1, segT, segR, pow) {
    const pos = [], idx = [], col = [];
    for (let j = 0; j <= segR; j++) { const r = r0 + (r1 - r0) * Math.pow(j / segR, pow); for (let i = 0; i <= segT; i++) { const a = i / segT * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r; pos.push(x, hgt(x, z), z); const p = (1 - smooth(.5, 1.7, distPath(x, z))) * (r < 44 ? 1 : 0), v = .96 + .04 * Math.sin(x * 2.1 + z * 1.7); col.push(v - p * .2, v - p * .17, v - p * .1); } }
    for (let j = 0; j < segR; j++) for (let i = 0; i < segT; i++) { const a = j * (segT + 1) + i, b = a + segT + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  const ground = new THREE.Mesh(terrainRing(.01, CORE, LOW ? 120 : 200, LOW ? 60 : 96, 1.15), new THREE.MeshStandardMaterial({ color: 0xdfe7f6, roughness: .85, vertexColors: true })); ground.receiveShadow = true; world.add(ground);
  const far = new THREE.Mesh(terrainRing(CORE - .6, 185, LOW ? 90 : 160, LOW ? 30 : 50, 1.4), new THREE.MeshStandardMaterial({ color: 0xe6ecf8, roughness: .9 })); beyond.add(far);

  // лёд катка
  let reflector = null;
  if (!LOW) { reflector = new Reflector(new THREE.CircleGeometry(RINK + .05, 96), { clipBias: .003, textureWidth: 1024, textureHeight: 1024, color: 0x8796ad }); reflector.rotation.x = -Math.PI / 2; reflector.position.y = .02; world.add(reflector); }
  const iceMat = new THREE.MeshPhysicalMaterial({ color: 0xd4e6fb, map: iceTex(), roughness: .12, clearcoat: 1, clearcoatRoughness: .05, envMap, envMapIntensity: .35, transparent: true, opacity: reflector ? .42 : .92 });
  const ice = new THREE.Mesh(new THREE.CircleGeometry(RINK + .05, 96), iceMat); ice.rotation.x = -Math.PI / 2; ice.position.y = .03; ice.receiveShadow = true; world.add(ice);
  const bank = new THREE.Mesh(new THREE.TorusGeometry(RINK + .2, .32, 10, 140), snowMat); bank.rotation.x = Math.PI / 2; bank.scale.z = .42; bank.position.y = .04; bank.castShadow = bank.receiveShadow = true; world.add(bank);
  const TS = LOW ? 512 : 1024, trailC = document.createElement('canvas'); trailC.width = trailC.height = TS; const tctx = trailC.getContext('2d'); const trailT = new THREE.CanvasTexture(trailC);
  const trail = new THREE.Mesh(new THREE.CircleGeometry(RINK, 96), new THREE.MeshBasicMaterial({ map: trailT, transparent: true, depthWrite: false, color: 0xeaf4ff, opacity: .8 })); trail.rotation.x = -Math.PI / 2; trail.position.y = .04; world.add(trail);
  const toTrail = (x, z) => [(x / RINK + 1) / 2 * TS, (z / RINK + 1) / 2 * TS];
  // замёрзший ручей
  {
    const pos = [], idx = []; let n = 0;
    for (let z = -40; z <= 40; z += 1) { const x = streamX(z), w = 1.7 + Math.sin(z * .3) * .3; [x - w, x + w].forEach(xx => pos.push(xx, hgt(xx, z) + .06, z)); if (n) { const a = (n - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } n++; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    // сгладим высоту по ширине (лёд ровный)
    const p = g.attributes.position; for (let i = 0; i < p.count; i += 2) { const y = Math.min(p.getY(i), p.getY(i + 1)); p.setY(i, y); p.setY(i + 1, y); } g.computeVertexNormals();
    const st = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color: 0x9fbfe6, roughness: .08, clearcoat: 1, envMap, envMapIntensity: .9 })); st.receiveShadow = true; world.add(st);
  }

  /* ---- общие материалы и инстанс-меш огоньков ---- */
  const dm = new THREE.Object3D();
  const BULB_MAX = 1100, bulbData = [];
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), BULB_MAX); bulbs.count = 0; bulbs.frustumCulled = false; world.add(bulbs);
  const PAL = [HDR(2.6, 1.7, .62), HDR(2.7, 1.95, .95), HDR(2.5, 1.1, .32), HDR(2.4, .62, .58), HDR(2.6, 2.25, 1.75)];
  function bulb(p, size, col, order, group) { if (bulbs.count >= BULB_MAX) return; const i = bulbs.count++; dm.position.copy(p); dm.scale.setScalar(size); dm.rotation.set(0, 0, 0); dm.updateMatrix(); bulbs.setMatrixAt(i, dm.matrix); bulbData.push({ c: col.clone(), order, group, ph: rnd() * 6.3 }); bulbs.setColorAt(i, col); }
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x1c2232, metalness: .7, roughness: .4, envMap, envMapIntensity: .6 });
  const woodM = new THREE.MeshStandardMaterial({ map: woodTex('#7a4a2a', '#4a2a16', '#a06a40'), roughness: .7 });
  const wood2 = new THREE.MeshStandardMaterial({ color: 0x6b3f24, roughness: .75 });
  const winMat = new THREE.MeshBasicMaterial({ map: T_WIN, color: HDR(1.6, 1.35, 1.1) });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xf6f8ff, roughness: .7, flatShading: true });
  const colliders = [];                          // [x, z, r]
  const groups = {};                             // уровни «оживания» по местам
  const G_ = (g, v = 0) => (groups[g] = groups[g] || { lv: v, tg: v });
  const pools = [];
  function pool(x, z, s, col, g, y) { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: T_GLOW, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.rotation.x = -Math.PI / 2; m.position.set(x, (y !== undefined ? y : hgt(x, z)) + .07, z); m.userData.g = g; world.add(m); pools.push(m); return m; }
  const lamps = [];                              // {head, glow, g}
  const lights = [];                             // {light, g}
  function lamp(x, z, g, h = 3.2, withLight = false) {
    const y0 = hgt(x, z), lg = new THREE.Group(); lg.position.set(x, y0, z); world.add(lg);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.06, .1, h, 8), ironMat); post.position.y = h / 2; post.castShadow = true; lg.add(post);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(.16, .2, .3, 10), ironMat); foot.position.y = .15; lg.add(foot);
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(.2, .14, .42, 6, 1, true), new THREE.MeshStandardMaterial({ color: 0x1c2232, metalness: .7, roughness: .4, wireframe: true })); cage.position.y = h + .18; lg.add(cage);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(.28, .26, 6), ironMat); cap.position.y = h + .5; lg.add(cap);
    const sc = new THREE.Mesh(new THREE.SphereGeometry(.22, 10, 6, 0, 6.3, 0, 1.2), snowMat); sc.position.y = h + .53; lg.add(sc);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.13, 12, 10), new THREE.MeshBasicMaterial({ color: HDR(4, 2.7, 1.3) })); head.position.y = h + .17; lg.add(head);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: T_GLOW, color: 0xffc77a, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.set(2.2, 2.2, 1); gl.position.y = h + .17; lg.add(gl);
    lamps.push({ head, gl, g }); G_(g); colliders.push([x, z, .3]);
    if (withLight) { const pl = new THREE.PointLight(0xffb867, 0, 14 * S, 1.6); pl.position.set(x * S, GROUND_Y + (y0 + h) * S, z * S); scene.add(pl); lights.push({ light: pl, g }); }
    pool(x, z, 5.5, HDR(.4, .26, .1), g);
    return V3(x, y0 + h + .35, z);
  }
  const wireMat = new THREE.LineBasicMaterial({ color: 0x141a24, transparent: true, opacity: .75 });
  function garland(A, B, sag, n, o0, o1, g, size = .07) {
    const pts = []; for (let k = 0; k <= 24; k++) { const t = k / 24; pts.push(A.clone().lerp(B, t).add(V3(0, -sag * 4 * t * (1 - t), 0))); }
    world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
    for (let k = 1; k < n; k++) { const t = k / n; bulb(A.clone().lerp(B, t).add(V3(0, -sag * 4 * t * (1 - t) - .07, 0)), size, PAL[k % 7 === 3 ? 3 : (k % 4 === 0 ? 2 : (k % 3 ? 0 : 4))], o0 + (o1 - o0) * t, g); }
  }

  /* ---- ёлки ---- */
  function treeGeometry(tiers, seg) {
    const parts = []; const add = (g, col) => { g = g.toNonIndexed(); g.deleteAttribute('uv'); const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('normal'); parts.push(g); };
    const tr = new THREE.CylinderGeometry(.09, .12, .45, 6); tr.translate(0, .22, 0); add(tr, '#5a3a22');
    for (let i = 0; i < tiers; i++) { const r = .78 - i * (.64 / tiers), h = .85 - i * .08, yc = .55 + i * (2 / tiers); const c = new THREE.ConeGeometry(r, h, seg, 1); c.rotateY(i * .5); c.translate(0, yc, 0); add(c, i % 2 ? '#1d5a45' : '#174a39'); const sh = h * .5, sr = r * .5 * 1.07; const sn = new THREE.ConeGeometry(sr, sh, seg, 1); sn.rotateY(i * .5); sn.translate(0, yc + h / 2 - sh / 2 + .015, 0); add(sn, '#f4f7ff'); }
    const g = mergeGeometries(parts); g.computeVertexNormals(); return g;
  }
  const treeGeo = treeGeometry(4, 9), farTreeGeo = treeGeometry(2, 6);
  const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .75, flatShading: true });
  const placeFree = (x, z, rad) => !colliders.some(c => Math.hypot(c[0] - x, c[1] - z) < c[2] + rad);

  /* ---- места ---- */
  const places = [];
  // 1) каток: фонари и гирлянды над льдом
  const NL = 6, lampTops = [];
  for (let i = 0; i < NL; i++) { const a = (i / NL) * Math.PI * 2, r = RINK + .9; lampTops.push(lamp(Math.cos(a) * r, Math.sin(a) * r, 'rink', 3.6, i % 3 === 0)); }
  for (let i = 0; i < NL; i++) garland(lampTops[i], lampTops[(i + 1) % NL], .6, 14, .05 + i * .1, .15 + i * .1, 'rink');
  garland(lampTops[1], lampTops[4], 1.3, 30, .55, .75, 'rink'); garland(lampTops[2], lampTops[5], 1.3, 30, .6, .85, 'rink');
  places.push({ id: 'rink', name: 'Каток', text: 'Лёд скользкий: разгонитесь и катитесь', x: 0, z: 0, r: RINK + 1.2 });
  // 2) главная ёлка
  const TREE_P = [0, -16];
  {
    const tg = new THREE.Group(); const y0 = hgt(...TREE_P); tg.position.set(TREE_P[0], y0, TREE_P[1]); world.add(tg);
    const t = new THREE.Mesh(treeGeo, treeMat); t.scale.set(3.6, 4.0, 3.6); t.castShadow = t.receiveShadow = true; tg.add(t);
    const H = 4.0 * 2.35;
    for (let i = 0; i < 150; i++) { const k = i / 150, y = .9 + k * (H - 1.6), rr = (1 - (y - .4) / H) * 2.95 + .1, a = k * Math.PI * 2 * 7; bulb(V3(Math.cos(a) * rr, y, Math.sin(a) * rr).add(tg.position), .085, PAL[i % 3 === 0 ? 4 : (i % 5 === 0 ? 2 : 0)], k, 'tree'); }
    const bm = [0xb33a44, 0xd6ae66, 0x2c5f8a, 0xe9843a].map(c => new THREE.MeshPhysicalMaterial({ color: c, metalness: .55, roughness: .18, clearcoat: 1, envMap, envMapIntensity: 1.6 }));
    for (let i = 0; i < 28; i++) { const y = 1 + rnd() * (H - 2.4), rr = (1 - (y - .4) / H) * 2.9 + .05, a = rnd() * 6.3; const m = new THREE.Mesh(new THREE.SphereGeometry(.17, 16, 12), bm[i % 4]); m.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr); tg.add(m); }
    const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? .2 : .5, a = i / 10 * Math.PI * 2 + Math.PI / 2; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const sg = new THREE.ExtrudeGeometry(sh, { depth: .1, bevelEnabled: true, bevelThickness: .05, bevelSize: .05, bevelSegments: 2 }); sg.center();
    const star = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb347, emissiveIntensity: .6, metalness: .6, roughness: .3 })); star.position.y = H + .25; tg.add(star);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: T_GLOW, color: 0xffcf7a, transparent: true, opacity: .4, depthWrite: false, blending: THREE.AdditiveBlending })); sp.scale.set(4, 4, 1); sp.position.y = H + .25; tg.add(sp);
    G_('tree'); places.push({ id: 'tree', name: 'Главная ёлка', text: 'Загорелась от вашего шага', x: TREE_P[0], z: TREE_P[1] + 3.5, r: 5.5, star, sp, top: V3(TREE_P[0], y0 + H + .25, TREE_P[1]) });
    colliders.push([TREE_P[0], TREE_P[1], 3.1]);
    pool(TREE_P[0], TREE_P[1] + 1, 11, HDR(.45, .3, .12), 'tree');
    const pl = new THREE.PointLight(0xffc070, 0, 18 * S, 1.6); pl.position.set(TREE_P[0] * S, GROUND_Y + (y0 + 4) * S, (TREE_P[1] + 3.2) * S); scene.add(pl); lights.push({ light: pl, g: 'tree' });
  }
  // 3) ярмарка
  {
    const stalls = [[-17, -3, '#b33a44', '#f4ead8'], [-15.5, -10, '#2c5f8a', '#f4ead8'], [-10.5, -15.5, '#2f6b52', '#f0d9a4']];
    stalls.forEach(([x, z, a, b], i) => {
      const sg = new THREE.Group(), y0 = hgt(x, z); sg.position.set(x, y0, z); world.add(sg); sg.lookAt(0, y0, 0);
      const back = new THREE.Mesh(new THREE.BoxGeometry(3, 2.3, .15), woodM); back.position.set(0, 1.15, -1); back.castShadow = true; sg.add(back);
      const cnt = new THREE.Mesh(new THREE.BoxGeometry(3, 1, .7), woodM); cnt.position.set(0, .5, .35); cnt.castShadow = true; sg.add(cnt);
      const top = new THREE.Mesh(new THREE.BoxGeometry(3.1, .08, .8), wood2); top.position.set(0, 1.02, .35); sg.add(top);
      [-1.45, 1.45].forEach(px => { const p = new THREE.Mesh(new THREE.BoxGeometry(.12, 2.6, .12), wood2); p.position.set(px, 1.3, .6); sg.add(p); });
      const aw = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 1.5), new THREE.MeshStandardMaterial({ map: awningTex(a, b), roughness: .7, side: THREE.DoubleSide })); aw.position.set(0, 2.55, -.15); aw.rotation.x = -1.05; aw.castShadow = true; sg.add(aw);
      const awS = new THREE.Mesh(new THREE.BoxGeometry(3.3, .1, 1.5), roofMat); awS.position.set(0, 2.62, -.2); awS.rotation.x = -1.05 + Math.PI / 2; awS.scale.y = .7; sg.add(awS);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(3.3, .2, 1.1), roofMat); roof.position.set(0, 2.45, -.9); roof.rotation.x = -.35; sg.add(roof);
      const gm = [0xb33a44, 0xd6ae66, 0xe9843a, 0x2c5f8a, 0xf4ead8].map(c => new THREE.MeshPhysicalMaterial({ color: c, metalness: .4, roughness: .25, clearcoat: 1, envMap }));
      for (let k = 0; k < 9; k++) { const m = new THREE.Mesh(new THREE.SphereGeometry(.12 + rnd() * .06, 12, 10), gm[(k + i) % 5]); m.position.set(-1.2 + k * .3, 1.18, .25 + (k % 2) * .2); sg.add(m); }
      if (i === 1) { const sam = new THREE.Mesh(new THREE.CylinderGeometry(.22, .28, .55, 16), gold); sam.position.set(.9, 1.33, .3); sg.add(sam); }
      const hs = new THREE.Mesh(new THREE.PlaneGeometry(.9, .7), winMat); hs.position.set(0, 1.7, -.92); sg.add(hs);
      sg.updateMatrixWorld(true);
      const L = V3(-1.6, 2.15, .75).applyMatrix4(sg.matrix), Rr = V3(1.6, 2.15, .75).applyMatrix4(sg.matrix);
      garland(L, Rr, .25, 16, i * .3, i * .3 + .3, 'fair', .065);
      const c = V3(0, 0, 1.6).applyMatrix4(sg.matrix); pool(c.x, c.z, 5, HDR(.42, .28, .1), 'fair');
      colliders.push([x, z, 1.7]);
    });
    lamp(-19, -9.5, 'fair', 3.2, true);
    const c = V3(-14.5, 0, -9);
    G_('fair'); places.push({ id: 'fair', name: 'Ярмарка', text: 'Огни ярмарки зажглись — слышите колокольчики?', x: c.x, z: c.z, r: 6.5 });
  }
  // 4) мостик через ручей
  {
    const z0 = -2, x0 = streamX(z0), gy = hgt(x0 + 4, z0);
    const bg = new THREE.Group(); bg.position.set(x0, 0, z0); world.add(bg);
    const L = 7.5, N = 14, arcH = 1.0;
    for (let i = 0; i < N; i++) { const t = (i + .5) / N, x = -L / 2 + t * L, y = gy + Math.sin(t * Math.PI) * arcH; const pl = new THREE.Mesh(new THREE.BoxGeometry(L / N + .02, .14, 2.1), woodM); pl.position.set(x, y, 0); pl.rotation.z = Math.cos(t * Math.PI) * arcH * Math.PI / L; pl.castShadow = pl.receiveShadow = true; bg.add(pl); }
    const railPts = [-1, 1].map(s => { const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(V3(-L / 2 + t * L, gy + Math.sin(t * Math.PI) * arcH + .95, s * 1.0)); } return pts; });
    railPts.forEach(pts => { const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, .05, 6); bg.add(new THREE.Mesh(g, wood2)); pts.forEach((p, i) => { if (i % 2) return; const post = new THREE.Mesh(new THREE.BoxGeometry(.09, .95, .09), wood2); post.position.set(p.x, p.y - .47, p.z); bg.add(post); }); });
    bg.updateMatrixWorld(true);
    railPts.forEach((pts, s) => { for (let i = 0; i < pts.length - 1; i++) garland(pts[i].clone().add(bg.position), pts[i + 1].clone().add(bg.position), .05, 3, i / 16, (i + 1) / 16, 'bridge', .05); });
    lamp(x0 - L / 2 - .8, z0 + 1.6, 'bridge', 3, true); lamp(x0 + L / 2 + .8, z0 - 1.6, 'bridge', 3);
    G_('bridge'); places.push({ id: 'bridge', name: 'Мостик через ручей', text: 'Под мостом — лёд, а в нём огоньки', x: x0, z: z0, r: 5.5, bridge: { x0, z0, L, gy, arcH } });
  }
  // 5) скамейка, фонарь и снеговик у тропинки
  {
    const bx = -9.2, bz = 13.6, by = hgt(bx, bz);
    const bg = new THREE.Group(); bg.position.set(bx, by, bz); bg.lookAt(-4.5, by, 9.5); world.add(bg);
    for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(new THREE.BoxGeometry(2.2, .07, .18), woodM); s.position.set(0, .55, -.12 + k * .2); s.castShadow = true; bg.add(s); }
    for (let k = 0; k < 2; k++) { const s = new THREE.Mesh(new THREE.BoxGeometry(2.2, .16, .06), woodM); s.position.set(0, .8 + k * .22, -.25); s.rotation.x = -.15; bg.add(s); }
    [-.95, .95].forEach(x => { const l = new THREE.Mesh(new THREE.BoxGeometry(.08, .55, .55), ironMat); l.position.set(x, .28, 0); bg.add(l); });
    const sn = new THREE.Mesh(new THREE.BoxGeometry(2.1, .06, .55), snowMat); sn.position.set(0, .6, .05); bg.add(sn);
    colliders.push([bx, bz, 1.1]);
    lamp(bx - 1.9, bz - .4, 'bench', 3.3, true);
    const sx = bx + 2.6, sz = bz + .6, sy = hgt(sx, sz), sg = new THREE.Group(); sg.position.set(sx, sy, sz); world.add(sg);
    [[.62, .55], [.46, 1.48], [.33, 2.15]].forEach(([r, y]) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), snowMat); m.position.y = y; m.castShadow = true; sg.add(m); });
    const nose = new THREE.Mesh(new THREE.ConeGeometry(.06, .34, 8), new THREE.MeshStandardMaterial({ color: 0xe9843a, roughness: .5 })); nose.rotation.x = Math.PI / 2; nose.position.set(0, 2.15, .45); sg.add(nose);
    const coal = new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: .4 });
    [[-.11, 2.27, .29], [.11, 2.27, .29], [0, 1.6, .44], [0, 1.36, .45]].forEach(([x, y, z]) => { const m = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), coal); m.position.set(x, y, z); sg.add(m); });
    const sc = new THREE.Mesh(new THREE.TorusGeometry(.36, .08, 8, 24), new THREE.MeshStandardMaterial({ color: 0xb33a44, roughness: .7 })); sc.rotation.x = Math.PI / 2; sc.position.y = 1.85; sg.add(sc);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(.21, .23, .34, 16), coal); hat.position.y = 2.55; sg.add(hat);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .04, 20), coal); brim.position.y = 2.39; sg.add(brim);
    sg.lookAt(-4.5, sy, 9.5); colliders.push([sx, sz, .7]);
    G_('bench'); places.push({ id: 'bench', name: 'Скамейка у фонаря', text: 'Снеговик подмигнул. Тропинка ведёт в лес', x: bx + 1, z: bz, r: 4.5 });
  }
  // 6) тропинка в лес с фонариками и смотровая площадка
  {
    const pts = []; for (let i = 0; i < PATH.length - 1; i++) for (let k = 0; k < 10; k++) { const t = k / 10; pts.push([PATH[i][0] + (PATH[i + 1][0] - PATH[i][0]) * t, PATH[i][1] + (PATH[i + 1][1] - PATH[i][1]) * t]); }
    pts.push(PATH[PATH.length - 1]);
    for (let i = 1; i <= 5; i++) { const t = i / 5.6, k = Math.floor(t * (pts.length - 1)); const [x, z] = pts[k]; const side = i % 2 ? 1.4 : -1.4; const [x2, z2] = pts[Math.min(k + 1, pts.length - 1)]; const dx = x2 - x, dz = z2 - z, l = Math.hypot(dx, dz) || 1; lamp(x - dz / l * side, z + dx / l * side, 'path' + i, 2.4); G_('path' + i); places.push({ id: 'path' + i, silent: true, x, z, r: 4.2 }); }
    // смотровая: перила и вид на огни деревни за холмами
    const [ex, ez] = PATH[PATH.length - 1], ey = hgt(ex, ez);
    for (let k = -3; k <= 3; k++) { const p = new THREE.Mesh(new THREE.BoxGeometry(.1, 1, .1), wood2); const a = Math.atan2(ez, ex) + k * .05; p.position.set(Math.cos(a) * (Math.hypot(ex, ez) + 1.4), hgt(ex, ez) + .5, Math.sin(a) * (Math.hypot(ex, ez) + 1.4)); world.add(p); }
    const r0 = Math.hypot(ex, ez) + 1.4, a0 = Math.atan2(ez, ex); const rp = []; for (let k = -3; k <= 3; k++) rp.push(V3(Math.cos(a0 + k * .05) * r0, ey + .95, Math.sin(a0 + k * .05) * r0));
    world.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rp), 20, .05, 6), wood2));
    G_('look'); places.push({ id: 'look', name: 'Край леса', text: 'Там, за холмами, — ещё деревни. Мир в шаре больше, чем казалось', x: ex, z: ez, r: 5 });
  }
  // домики деревушки
  const houseSpots = [[-4, -29], [7, -28], [-23, -19], [27, -13], [28, 6], [11, 25], [-30, 6], [31, -24]];
  const houseCols = [0xe9d6b8, 0xbd6a46, 0x9fb6cf, 0xe3c68f, 0xc98a7a, 0xd8c7a0, 0x8fa7a0, 0xe0b48a];
  houseSpots.forEach(([x, z], i) => {
    const y0 = hgt(x, z), hg = new THREE.Group(); hg.position.set(x, y0 - .1, z);
    const w = 3 + (i % 2) * .6, d = 2.6, h = 2.1 + (i % 3) * .5;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: houseCols[i], roughness: .6 })); body.position.y = h / 2; body.castShadow = body.receiveShadow = true; hg.add(body);
    const rs = new THREE.Shape(); rs.moveTo(-w / 2 - .35, 0); rs.lineTo(0, 1.6); rs.lineTo(w / 2 + .35, 0); rs.lineTo(-w / 2 - .35, 0);
    const rg = new THREE.ExtrudeGeometry(rs, { depth: d + .6, bevelEnabled: true, bevelThickness: .1, bevelSize: .12, bevelSegments: 2 }); rg.translate(0, 0, -(d + .6) / 2);
    const roof = new THREE.Mesh(rg, roofMat); roof.position.y = h; roof.castShadow = true; hg.add(roof);
    const ch = new THREE.Mesh(new THREE.BoxGeometry(.4, .9, .4), new THREE.MeshStandardMaterial({ color: 0x7a3f2a, roughness: .8 })); ch.position.set(w * .25, h + 1.1, -.3); hg.add(ch);
    const nW = w > 3.2 ? 2 : 1;
    for (let k = 0; k < nW; k++) { const wm = new THREE.Mesh(new THREE.PlaneGeometry(.64, .72), winMat); wm.position.set(nW === 1 ? -w * .22 : (k ? w * .28 : -w * .28), h * .58, d / 2 + .01); hg.add(wm); }
    const door = new THREE.Mesh(new THREE.PlaneGeometry(.6, 1.05), new THREE.MeshStandardMaterial({ color: 0x4a2a18, roughness: .6 })); door.position.set(nW === 1 ? w * .22 : 0, .52, d / 2 + .01); hg.add(door);
    const up = new THREE.Mesh(new THREE.PlaneGeometry(.52, .52), winMat); up.position.set(0, h + .6, d / 2 + .32); hg.add(up);
    hg.lookAt(0, y0, 0); world.add(hg); hg.updateMatrixWorld(true);
    for (let k = 0; k <= 11; k++) { const t = k / 11, lx = -w / 2 - .3 + t * (w + .6), ly = h + (1 - Math.abs(t - .5) * 2) * 1.55 + .05; bulb(V3(lx, ly, d / 2 + .42).applyMatrix4(hg.matrix), .06, PAL[(k + i) % 5], .3 + t * .4, 'house'); }
    const fp = V3(0, 0, d / 2 + 1.8).applyMatrix4(hg.matrix); pool(fp.x, fp.z, 5.2, HDR(.5, .32, .12), 'house');
    colliders.push([x, z, Math.max(w, d) * .62]);
  });
  G_('house', .7);

  // лес ядра (виден и снаружи)
  const coreTrees = [];
  for (let i = 0; i < 2600 && coreTrees.length < (LOW ? 110 : 170); i++) {
    const a = rnd() * Math.PI * 2, r = 12 + Math.pow(rnd(), .7) * 41, x = Math.cos(a) * r, z = Math.sin(a) * r;
    const s = 1.4 + rnd() * 1.9 + smooth(25, 50, r) * 1.2;
    if (r < 26 && rnd() < .75) continue; if (z > 0 && rnd() < .6) continue;
    if (distPath(x, z) < 3.2 || Math.abs(x - streamX(z)) < 3.2) continue;
    if (Math.hypot(x - TREE_P[0], z - TREE_P[1]) < 6 || Math.hypot(x + 14.5, z + 9) < 7 || (Math.hypot(x - 19, z + 2) < 6)) continue;
    if (z > 8 && Math.abs(x) < 9 + (z - 8) * .5 && r < 30) continue;
    if (r > 26 && Math.abs(wrapA(Math.atan2(z, x) - Math.atan2(32, -26))) < .2 + 4 / r) continue;   // просека: вид со смотровой   // открытый вид на каток спереди
    const top = hgt(x, z) + 2.6 * s; if ((r * S) ** 2 + (GROUND_Y + top * S) ** 2 > 9.75 * 9.75) continue;
    if (!placeFree(x, z, .8)) continue;
    coreTrees.push([x, z, s]); colliders.push([x, z, .45 * s * .7]);
  }
  const trees = new THREE.InstancedMesh(treeGeo, treeMat, coreTrees.length);
  coreTrees.forEach(([x, z, s], i) => { dm.position.set(x, hgt(x, z) - .05, z); dm.scale.set(s, s * (.9 + rnd() * .3), s); dm.rotation.set(0, rnd() * 6, 0); dm.updateMatrix(); trees.setMatrixAt(i, dm.matrix); });
  trees.castShadow = trees.receiveShadow = true; world.add(trees);
  // дальний лес и деревни за холмами (только изнутри)
  {
    const villages = [[2.25, 92], [1.95, 125], [2.6, 140], [.6, 115], [-1.9, 105], [-.9, 150]];
    const n = LOW ? 450 : 1300, ft = new THREE.InstancedMesh(farTreeGeo, treeMat, n); let c = 0;
    for (let i = 0; i < n * 3 && c < n; i++) { const a = rnd() * Math.PI * 2, r = 57 + Math.pow(rnd(), .8) * 110, x = Math.cos(a) * r, z = Math.sin(a) * r; if (villages.some(([va, vr]) => Math.hypot(x - Math.cos(va) * vr, z - Math.sin(va) * vr) < 13)) continue; if (Math.abs(wrapA(a - 2.25)) < .1 && r < 90) continue; const s = 3 + rnd() * 4; dm.position.set(x, hgt(x, z) - .2, z); dm.scale.set(s, s * 1.2, s); dm.rotation.set(0, rnd() * 6, 0); dm.updateMatrix(); ft.setMatrixAt(c++, dm.matrix); }
    ft.count = c; beyond.add(ft);
    const vp = [], vs = [];
    villages.forEach(([a, r]) => { for (let k = 0; k < 40; k++) { const aa = a + (rnd() - .5) * .16, rr = r + (rnd() - .5) * 14, x = Math.cos(aa) * rr, z = Math.sin(aa) * rr; vp.push(x, hgt(x, z) + .8 + rnd() * 1.5, z); vs.push(.4 + rnd() * 1.2, rnd() * 6, 1 + rnd() * 2, .5 + rnd() * .7); } });
    const vU = { uTime: { value: 0 }, uScale: { value: 300 }, uOpacity: { value: .7 }, uGain: { value: 2.2 }, uColor: { value: HDR(1, .72, .38) } };
    const vill = pointCloud(vp, vs, vU); beyond.add(vill); beyond.userData.vU = vU;
    villages.forEach(([a, r]) => { const x = Math.cos(a) * r, z = Math.sin(a) * r; const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: T_GLOW, color: 0xffa860, transparent: true, opacity: .35, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); g.position.set(x, hgt(x, z) + 3, z); g.scale.set(30, 16, 1); beyond.add(g); });
    // домики вдали — силуэты с тёплыми окнами
    const hb = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 1.8, 2.2), new THREE.MeshStandardMaterial({ color: 0x2a2f45, emissive: 0xffa040, emissiveIntensity: .22, roughness: .8 }), 60);
    for (let i = 0; i < 60; i++) { const [a, r] = villages[i % villages.length]; const aa = a + (rnd() - .5) * .14, rr = r + (rnd() - .5) * 12, x = Math.cos(aa) * rr, z = Math.sin(aa) * rr; dm.position.set(x, hgt(x, z) + .7, z); dm.scale.setScalar(.8 + rnd() * .6); dm.rotation.set(0, rnd() * 6, 0); dm.updateMatrix(); hb.setMatrixAt(i, dm.matrix); }
    beyond.add(hb);
  }
  // блёстки на снегу
  const glitU = { uTime: { value: 0 }, uScale: { value: 300 }, uOpacity: { value: 1 }, uGain: { value: 2.4 }, uColor: { value: HDR(1, .95, .85) } };
  { const n = LOW ? 500 : 1500, p = [], s = []; for (let i = 0; i < n; i++) { const a = rnd() * 6.283, r = 8.6 + Math.sqrt(rnd()) * 42, x = Math.cos(a) * r, z = Math.sin(a) * r; p.push(x, hgt(x, z) + .05, z); s.push(.5 + rnd() * 2.5, rnd() * 6.3, 10 + rnd() * 20, .012 + rnd() * .012); } world.add(pointCloud(p, s, glitU)); }
  // светлячки-искры для «оживания»
  const SP = 320, spPos = new Float32Array(SP * 3), spVel = new Float32Array(SP * 3), spLife = new Float32Array(SP), spSeed = new Float32Array(SP * 4); let spI = 0;
  for (let i = 0; i < SP; i++) spSeed.set([18, rnd() * 6, 1, 0], i * 4);
  const spU = { uTime: { value: 0 }, uScale: { value: 300 }, uOpacity: { value: 1 }, uGain: { value: 3 }, uColor: { value: HDR(1, .8, .45) } };
  const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3)); spGeo.setAttribute('aSeed', new THREE.BufferAttribute(spSeed, 4));
  const sparks = new THREE.Points(spGeo, pointsMat(TW_F, TW_V, spU)); sparks.frustumCulled = false; sparks.renderOrder = 7; world.add(sparks);
  function burst(x, y, z, n, sp = 3, up = 1) { for (let k = 0; k < n; k++) { const i = spI++ % SP; spPos.set([x, y, z], i * 3); const a = rnd() * 6.283, b = rnd() * 3.14; spVel.set([Math.cos(a) * Math.sin(b) * sp, Math.abs(Math.cos(b)) * sp * up + .6, Math.sin(a) * Math.sin(b) * sp], i * 3); spLife[i] = .8 + rnd() * .9; } }

  /* ---- фигурки ---- */
  const skin = new THREE.MeshPhysicalMaterial({ color: 0xf7dcc8, roughness: .35, clearcoat: .8, clearcoatRoughness: .2, envMap, envMapIntensity: .5 });
  const cheekMat = new THREE.MeshStandardMaterial({ color: 0xe88b8b, roughness: .6 }), eyeMat = new THREE.MeshStandardMaterial({ color: 0x1b1716, roughness: .2 });
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xdfe6ef, metalness: 1, roughness: .2, envMap, envMapIntensity: 1.4 });
  const porcelain = c => new THREE.MeshPhysicalMaterial({ color: c, roughness: .32, clearcoat: 1, clearcoatRoughness: .12, envMap, envMapIntensity: .7 });
  function makeSkater(o) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const coat = porcelain(o.coat), scarf = porcelain(o.scarf), hatM = porcelain(o.hat), tights = porcelain(o.legs || 0x2b2f45), boot = porcelain(0xf5efe6), fur = new THREE.MeshStandardMaterial({ color: 0xfbf6ee, roughness: .9 });
    const legs = [];
    [-1, 1].forEach(s => { const hip = new THREE.Group(); hip.position.set(s * .07, .42, 0); body.add(hip); const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.05, .24, 4, 10), tights); leg.position.y = -.17; hip.add(leg); const b = new THREE.Mesh(new THREE.CapsuleGeometry(.062, .07, 4, 10), boot); b.rotation.x = Math.PI / 2; b.position.set(0, -.34, .03); hip.add(b); const bl = new THREE.Mesh(new THREE.BoxGeometry(.016, .02, .27), bladeMat); bl.position.set(0, -.4, .03); hip.add(bl); leg.castShadow = b.castShadow = true; legs.push(hip); });
    const pr = [[0, .38], [.21, .38], [.2, .43], [.16, .58], [.125, .72], [.105, .8], [.07, .85], [0, .86]].map(p => new THREE.Vector2(p[0], p[1]));
    const torso = new THREE.Mesh(new THREE.LatheGeometry(pr, 28), coat); torso.castShadow = true; body.add(torso);
    const hem = new THREE.Mesh(new THREE.TorusGeometry(.205, .03, 8, 28), fur); hem.rotation.x = Math.PI / 2; hem.position.y = .39; body.add(hem);
    [.7, .6, .5].forEach(y => { const bt = new THREE.Mesh(new THREE.SphereGeometry(.018, 8, 6), gold); bt.position.set(0, y, .15 - (y - .5) * .15 + (.72 - y) * .12); body.add(bt); });
    const head = new THREE.Group(); head.position.y = 1.0; body.add(head);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(.16, 28, 20), skin); hd.scale.set(1, .97, .96); hd.castShadow = true; head.add(hd);
    if (o.hair) { const hr = new THREE.Mesh(new THREE.SphereGeometry(.168, 24, 16, 0, Math.PI * 2, 0, Math.PI * .62), porcelain(o.hair)); hr.rotation.x = -.35; head.add(hr); [-1, 1].forEach(s => { const br = new THREE.Mesh(new THREE.CapsuleGeometry(.035, .12, 4, 8), porcelain(o.hair)); br.position.set(s * .14, -.12, -.06); br.rotation.z = s * .25; head.add(br); }); }
    [-1, 1].forEach(s => { const ck = new THREE.Mesh(new THREE.SphereGeometry(.03, 10, 8), cheekMat); ck.scale.set(1, .7, .4); ck.position.set(s * .085, -.035, .135); head.add(ck); const e = new THREE.Mesh(new THREE.SphereGeometry(.018, 10, 8), eyeMat); e.position.set(s * .055, .02, .148); head.add(e); });
    const hat = new THREE.Mesh(new THREE.SphereGeometry(.172, 24, 14, 0, Math.PI * 2, 0, Math.PI * .5), hatM); hat.position.y = .02; hat.rotation.x = -.12; head.add(hat);
    const hrim = new THREE.Mesh(new THREE.TorusGeometry(.165, .035, 8, 28), fur); hrim.rotation.x = Math.PI / 2 - .12; hrim.position.y = .03; head.add(hrim);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(.065, 14, 10), fur); pom.position.set(0, .2, -.03); head.add(pom);
    const sc = new THREE.Mesh(new THREE.TorusGeometry(.085, .035, 8, 20), scarf); sc.rotation.x = Math.PI / 2; sc.position.y = .86; body.add(sc);
    const tailP = new THREE.Group(); tailP.position.set(.05, .86, -.07); body.add(tailP);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(.075, .26, .025), scarf); tail.position.y = -.12; tail.castShadow = true; tailP.add(tail);
    const tail2 = new THREE.Mesh(new THREE.BoxGeometry(.075, .2, .025), scarf); tail2.position.set(-.07, -.1, 0); tail2.rotation.z = .12; tailP.add(tail2);
    const arms = [];
    [-1, 1].forEach(s => { const sh = new THREE.Group(); sh.position.set(s * .1, .8, 0); body.add(sh); const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.04, .22, 4, 8), coat); arm.position.y = -.14; sh.add(arm); const mit = new THREE.Mesh(new THREE.SphereGeometry(.045, 10, 8), scarf); mit.position.y = -.29; sh.add(mit); sh.rotation.z = s * .9; arm.castShadow = true; arms.push(sh); });
    g.scale.setScalar(o.scale || 1); g.userData = { body, legs, arms, tailP, head, phase: rnd() * 6 };
    return g;
  }
  function poseSkater(sk, t, speed, lean, stride, walk) {
    const u = sk.userData, p = u.phase + stride;
    if (walk) {
      u.legs[0].rotation.set(Math.sin(p) * .55 * speed, 0, -.03); u.legs[1].rotation.set(-Math.sin(p) * .55 * speed, 0, .03);
      u.arms[0].rotation.set(-Math.sin(p) * .5 * speed, 0, -.35); u.arms[1].rotation.set(Math.sin(p) * .5 * speed, 0, .35);
      u.body.rotation.set(.05 * speed, 0, 0); u.body.position.y = Math.abs(Math.cos(p)) * .035 * speed; u.tailP.rotation.x = .15 + speed * .35 + Math.sin(p * 2) * .05; u.head.rotation.z = 0; return;
    }
    u.legs[0].rotation.set(Math.sin(p) * .35 * speed, 0, -.05 - Math.max(0, Math.sin(p)) * .25 * speed); u.legs[1].rotation.set(-Math.sin(p) * .35 * speed, 0, .05 + Math.max(0, -Math.sin(p)) * .25 * speed);
    u.arms[0].rotation.set(-.15, 0, -1 - Math.sin(p) * .2 * speed); u.arms[1].rotation.set(-.15, 0, 1 - Math.sin(p) * .2 * speed);
    u.body.rotation.set(.12 * speed, 0, lean); u.body.position.y = Math.abs(Math.sin(p)) * .02 * speed;
    u.tailP.rotation.x = .25 + speed * .9 + Math.sin(t * 9 + u.phase) * .12 * speed; u.head.rotation.z = -lean * .5;
  }
  const hero = makeSkater({ coat: 0xb02f3c, scarf: 0xe2a63e, hat: 0xf4ead8, hair: 0x6b3e22, scale: 1.2 }); world.add(hero);
  const heroShadow = new THREE.Mesh(new THREE.CircleGeometry(.45, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .25, depthWrite: false })); heroShadow.rotation.x = -Math.PI / 2; if (LOW) world.add(heroShadow);
  const npcs = [
    { sk: makeSkater({ coat: 0x2c4a7a, scarf: 0xf4ead8, hat: 0xb33a44, scale: 1.1 }), r: 5.6, w: .2, a: 1.3 },
    { sk: makeSkater({ coat: 0x2f6b52, scarf: 0xe9843a, hat: 0xf4ead8, hair: 0xd9a35a, scale: 1.05 }), r: 5.6, w: .2, a: 1.62 },
    { sk: makeSkater({ coat: 0xefe3cc, scarf: 0xb33a44, hat: 0x2c4a7a, hair: 0x2a1a12, scale: 1.08 }), r: 3.4, w: -.3, a: 4.2 },
  ];
  npcs.forEach(n => world.add(n.sk));

  /* ---- звёздочки (мини-игра на льду) ---- */
  const starShape = (n, ro, ri) => { const s = new THREE.Shape(); for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, a = i / (n * 2) * Math.PI * 2 + Math.PI / 2; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } return s; };
  const gStar = new THREE.ExtrudeGeometry(starShape(5, .3, .13), { depth: .07, bevelEnabled: true, bevelThickness: .035, bevelSize: .03, bevelSegments: 2 }); gStar.center();
  const gFlake = new THREE.ExtrudeGeometry(starShape(6, .32, .09), { depth: .05, bevelEnabled: true, bevelThickness: .02, bevelSize: .02, bevelSegments: 1 }); gFlake.center();
  const mStar = new THREE.MeshStandardMaterial({ color: 0xffd889, emissive: 0xffa630, emissiveIntensity: 1.6, metalness: .5, roughness: .25, envMap });
  const mFlake = new THREE.MeshStandardMaterial({ color: 0xe8f3ff, emissive: 0x9cc8ff, emissiveIntensity: 1.9, metalness: .3, roughness: .2, envMap });
  const pickups = [];
  function spawn(bonus) {
    let x, z, n = 0; do { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * (RINK - 1); x = Math.cos(a) * r; z = Math.sin(a) * r; n++; } while (n < 30 && (Math.hypot(x - H.x, z - H.z) < 2 || pickups.some(p => Math.hypot(p.x - x, p.z - z) < 1.4)));
    const m = new THREE.Mesh(bonus ? gFlake : gStar, bonus ? mFlake : mStar);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: T_GLOW, color: bonus ? 0xa8d4ff : 0xffc35a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.set(1.6, 1.6, 1);
    const ring = pool(x, z, 1.4, bonus ? HDR(.25, .45, .8) : HDR(.7, .45, .15), 'pick', .02); ring.material.opacity = 0;
    world.add(m); world.add(gl); pickups.push({ m, gl, ring, x, z, t: 0, life: bonus ? 7 : 9.5, bonus, y: 6 });
  }
  function killPickup(p) { world.remove(p.m); world.remove(p.gl); world.remove(p.ring); p.gl.material.dispose(); p.ring.material.dispose(); pools.splice(pools.indexOf(p.ring), 1); pickups.splice(pickups.indexOf(p), 1); }

  /* ---------- пост-обработка ---------- */
  const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: LOW ? 0 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .6, .42, .85); composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ---------- камера ---------- */
  let W = 1, Hh = 1, aspect = 1;
  const toScene = v => V3(v.x * S, GROUND_Y + v.y * S, v.z * S);
  const toLocal = v => V3(v.x / S, (v.y - GROUND_Y) / S, v.z / S);
  function outsidePose() { const fov = 30, t = Math.tan(fov * Math.PI / 360); const dist = Math.max(46, 12.5 / (t * aspect), 15.5 / t); return { p: V3(0, 13, dist), l: V3(0, -3.2, 0), fov }; }
  const PORTRAIT = () => aspect < .8;
  const camS = { yaw: 0, pitch: .2, dist: 5.8 };
  function thirdPerson() {
    const d = camS.dist * (PORTRAIT() ? 1.25 : 1), cp = Math.cos(camS.pitch);
    const tx = H.x, tz = H.z, ty = H.y + 1.1;
    let px = tx + Math.sin(camS.yaw) * d * cp, pz = tz + Math.cos(camS.yaw) * d * cp, py = ty + Math.sin(camS.pitch) * d;
    { const vx = px - tx, vz = pz - tz, L = Math.hypot(vx, vz); let k = 1; for (const c of colliders) { const t = ((c[0] - tx) * vx + (c[1] - tz) * vz) / (L * L); if (t <= .05 || t >= 1) continue; const dd = Math.hypot(tx + vx * t - c[0], tz + vz * t - c[1]); if (dd < c[2] * 1.8 + .4) k = Math.min(k, t - (c[2] * 1.8 + .5) / L); } k = Math.max(.35, k); if (k < 1) { px = tx + vx * k; pz = tz + vz * k; py = ty + (py - ty) * k + (1 - k) * .4; } }
    py = Math.max(py, hgt(px, pz) + .6);
    return { p: V3(px, py, pz), l: V3(tx - Math.sin(camS.yaw) * 3, ty + .35, tz - Math.cos(camS.yaw) * 3), fov: PORTRAIT() ? 64 : 54 };
  }
  const cam = { p: V3(), l: V3(), fov: 30 };   // в координатах сцены (снаружи) или мира (внутри) — см. camLocal
  let camLocal = false;
  function applyCam() {
    if (camLocal) { camera.position.copy(toScene(cam.p)); camera.lookAt(toScene(cam.l)); }
    else { camera.position.copy(cam.p); camera.lookAt(cam.l); }
    camera.fov = cam.fov; camera.aspect = aspect; camera.updateProjectionMatrix();
  }
  function resize() {
    W = innerWidth; Hh = innerHeight; aspect = W / Hh;
    renderer.setSize(W, Hh, false); composer.setSize(W, Hh);
    bloom.resolution.set(W * DPR * (LOW ? .4 : .6), Hh * DPR * (LOW ? .4 : .6));
    if (reflector) { const s = Math.min(1024, Math.round(Math.max(W, Hh) * DPR * .6)); reflector.getRenderTarget().setSize(s, s); }
  }
  resize(); addEventListener('resize', resize);

  /* ---------- звук ---------- */
  let AC = null, sndOn = store('elk-music') === '1', hissG = null;
  const sndBtn = $('.rk-snd'), siteBtn = document.getElementById('music');
  const noiseBuf = () => { const b = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; };
  function initAudio() {
    if (AC) return; try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const src = AC.createBufferSource(); src.buffer = noiseBuf(); src.loop = true; const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = .7;
    hissG = AC.createGain(); hissG.gain.value = 0; src.connect(bp); bp.connect(hissG); hissG.connect(AC.destination); src.start();
  }
  function chime(freqs, vol = .05, dur = 1.2, gap = .06) { if (!sndOn || !AC) return; const t0 = AC.currentTime; freqs.forEach((f, i) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t0 + i * gap); g.gain.linearRampToValueAtTime(vol, t0 + i * gap + .01); g.gain.exponentialRampToValueAtTime(.0001, t0 + i * gap + dur); o.connect(g); g.connect(AC.destination); o.start(t0 + i * gap); o.stop(t0 + i * gap + dur + .05); }); }
  function crunch() { if (!sndOn || !AC) return; const t0 = AC.currentTime, n = AC.createBufferSource(); n.buffer = noiseBuf(); const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900 + Math.random() * 500; const g = AC.createGain(); g.gain.setValueAtTime(.05, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + .14); n.connect(f); f.connect(g); g.connect(AC.destination); n.start(t0, Math.random()); n.stop(t0 + .16); }
  function whoosh(up) { if (!sndOn || !AC) return; const t0 = AC.currentTime, n = AC.createBufferSource(); n.buffer = noiseBuf(); n.loop = true; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(up ? 300 : 2400, t0); f.frequency.exponentialRampToValueAtTime(up ? 2400 : 300, t0 + 2.6); const g = AC.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.07, t0 + 1.3); g.gain.linearRampToValueAtTime(0, t0 + 3.2); n.connect(f); f.connect(g); g.connect(AC.destination); n.start(t0); n.stop(t0 + 3.3); }
  function setSound(on) {
    sndOn = on; sndBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); sndBtn.setAttribute('aria-label', on ? 'Звук: выключить' : 'Звук: включить');
    if (on) { initAudio(); AC && AC.resume(); } else if (hissG) hissG.gain.value = 0;
    if (siteBtn && (siteBtn.getAttribute('aria-pressed') === 'true') !== on) siteBtn.click();
  }
  sndBtn.setAttribute('aria-pressed', sndOn ? 'true' : 'false'); sndBtn.addEventListener('click', () => setSound(!sndOn));

  /* ---------- состояние ---------- */
  const H = { x: 0, z: 10.8, y: 0, vx: 0, vz: 0, head: Math.PI, stride: 0, spin: 0, lean: 0, step: 0, ice: false, goto: null };
  const G = { mode: 'load', phase: 0, alive: 0, play: false, score: 0, left: GAME_TIME, combo: 0, lastPick: -9, spawnT: 0 };
  const keys = {}; let drag = null, joy = null;
  const KEYS = { arrowleft: [-1, 0], a: [-1, 0], 'ф': [-1, 0], arrowright: [1, 0], d: [1, 0], 'в': [1, 0], arrowup: [0, 1], w: [0, 1], 'ц': [0, 1], arrowdown: [0, -1], s: [0, -1], 'ы': [0, -1] };
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function groundPoint(e) {
    const r = cv.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([ground, ice], false); if (!hits.length) return null; const p = toLocal(hits[0].point); return { x: p.x, z: p.z };
  }
  const joyEl = $('.rk-joy'), knob = joyEl.querySelector('i');
  cv.addEventListener('pointerdown', e => {
    if (!walking()) return; if (AC && sndOn) AC.resume();
    if (e.pointerType === 'touch' && e.clientX < W * .45 && e.clientY > Hh * .35) { joy = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px'; joyEl.classList.add('on'); knob.style.transform = ''; }
    else drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
    cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', e => {
    if (joy && e.pointerId === joy.id) { let dx = e.clientX - joy.x, dy = e.clientY - joy.y; const l = Math.hypot(dx, dy), m = 46; if (l > m) { dx *= m / l; dy *= m / l; } joy.dx = dx / m; joy.dy = dy / m; knob.style.transform = `translate(${dx}px,${dy}px)`; return; }
    if (drag && e.pointerId === drag.id) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true; camS.yaw -= dx * .006; camS.pitch = clamp(camS.pitch + dy * .004, .12, .9); camS.manual = 1.6; }
  });
  const up = e => {
    if (joy && e.pointerId === joy.id) { joy = null; joyEl.classList.remove('on'); return; }
    if (drag && e.pointerId === drag.id) { if (!drag.moved) { const p = groundPoint(e); if (p) H.goto = p; } drag = null; }
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  function onKey(e, down) {
    if (down && e.key === 'Escape') { if (!card.hidden) hideCard(); else exit(); return; }
    const k = e.key.toLowerCase(); if (KEYS[k]) { keys[k] = down; e.preventDefault(); H.goto = null; }
  }
  const kd = e => onKey(e, true), ku = e => onKey(e, false); addEventListener('keydown', kd); addEventListener('keyup', ku);
  $('.rk-close').addEventListener('click', () => exit());
  $('.rk-out').addEventListener('click', () => { hideCard(); cv.focus({ preventScroll: true }); });
  $('.rk-go').addEventListener('click', () => startGame());
  starsBtn.addEventListener('click', () => startGame());
  const walking = () => G.mode === 'walk';

  function showCard(h, p, go, outLabel) { card.querySelector('h3').textContent = h; card.querySelector('p').innerHTML = p; $('.rk-go').textContent = go; $('.rk-out').textContent = outLabel || 'Гулять дальше'; card.hidden = false; requestAnimationFrame(() => card.classList.add('on')); setTimeout(() => $('.rk-go').focus({ preventScroll: true }), 50); }
  function hideCard() { card.classList.remove('on'); setTimeout(() => { card.hidden = true; }, 350); }
  function showPlace(name, text) { placeEl.querySelector('b').textContent = name; placeEl.querySelector('span').textContent = text; placeEl.classList.remove('on'); void placeEl.offsetWidth; placeEl.classList.add('on'); clearTimeout(showPlace.t); showPlace.t = setTimeout(() => placeEl.classList.remove('on'), 4200); }
  function setHint(t, ms) { hint.textContent = t; hint.classList.add('on'); clearTimeout(setHint.t); if (ms) setHint.t = setTimeout(() => hint.classList.remove('on'), ms); }
  function pop(text, x, y, z, cls) { const v = toScene(V3(x, y, z)).project(camera); const d = document.createElement('span'); d.className = 'rk-pop ' + (cls || ''); d.textContent = text; d.style.left = ((v.x + 1) / 2 * 100) + '%'; d.style.top = ((1 - v.y) / 2 * 100) + '%'; pops.appendChild(d); setTimeout(() => d.remove(), 1300); }

  function startGame() {
    if (G.mode !== 'walk') return;
    hideCard(); placeEl.classList.remove('on'); if (sndOn) { initAudio(); AC && AC.resume(); }
    pickups.slice().forEach(killPickup);
    Object.assign(G, { score: 0, left: GAME_TIME, combo: 0, lastPick: -9, spawnT: .2, play: true });
    hudSc.textContent = '0'; hudTm.textContent = GAME_TIME; el.classList.add('playing'); starsBtn.hidden = true; cv.focus({ preventScroll: true });
    if (!onIce(H.x, H.z)) H.goto = { x: 0, z: 2 };
    setHint('Звёзды падают на лёд. Две подряд — комбо, круг без остановки — пируэт', 3800);
    for (let i = 0; i < 3; i++) spawn(false);
  }
  function endGame(silent) {
    G.play = false; el.classList.remove('playing', 'hurry'); pickups.slice().forEach(killPickup); if (silent) return;
    const rec = G.score > best; if (rec) { best = G.score; store('elk-best-rink', String(best)); hudBest.textContent = best; }
    chime(rec ? [784, 988, 1175, 1568] : [659, 784, 988], .05, 1.6, .12);
    const w = n => n % 10 === 1 && n % 100 !== 11 ? 'звезда' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'звезды' : 'звёзд');
    showCard(rec ? 'Новый рекорд!' : 'Звездопад закончился', `Вы собрали <b>${G.score}</b> ${w(G.score)}. ${rec ? 'Это лучший результат на этом устройстве.' : 'Рекорд: ' + best + '.'}`, 'Ещё раз');
  }

  /* ---------- пролёт ---------- */
  let fly = null;
  function makeFlight(rev) {
    // путь в локальных координатах мира: снаружи → перед стеклом → сквозь стекло → над деревней → за спину героя
    const o = outsidePose(), tp = thirdPerson();
    const P = [toLocal(o.p), toLocal(V3(0, 5.2, 14)), toLocal(V3(0, 1.6, 8.6)), V3(0, 17, 30), V3(tp.p.x * .6, tp.p.y + 5, tp.p.z + 6), tp.p];
    const L = [toLocal(o.l), toLocal(V3(0, -2.4, 0)), V3(0, 0, -4), V3(0, 1, -2), V3(H.x, H.y + 1, H.z - 2), tp.l];
    return { pc: new THREE.CatmullRomCurve3(P, false, 'centripetal'), lc: new THREE.CatmullRomCurve3(L, false, 'centripetal'), f0: o.fov, f1: tp.fov, t: rev ? 1 : 0, dur: 4.2, rev };
  }
  function enter() {
    G.mode = 'flyin'; camLocal = true;
    if (REDUCE) { el.classList.add('fade'); setTimeout(() => { G.phase = 1; G.alive = 1; Object.assign(cam, thirdPerson()); el.classList.remove('fade'); arrive(); }, 450); return; }
    whoosh(true); fly = makeFlight(false);
  }
  function arrive() {
    G.mode = 'walk'; groups.rink.tg = 1.2; groups.house.tg = 1.2;
    chime([1047, 1319, 1568, 2093], .035, 2.2, .14);
    setTimeout(() => setHint(TOUCH ? 'Левый палец — идти, правый — осмотреться, касание — пойти туда' : 'WASD или стрелки — идти, мышью — осмотреться, клик — пойти туда', 7000), 600);
    setTimeout(() => showPlace('Внутри шара', 'Погуляйте: тут каток, ярмарка, мостик и тропинка в лес'), 200);
  }
  let exiting = false;
  function exit() {
    if (exiting) return; exiting = true; endGame(true); hideCard(); starsBtn.hidden = true; hissG && (hissG.gain.value = 0);
    if (REDUCE || G.mode === 'load' || G.mode === 'outside') return finish();
    G.mode = 'flyout'; whoosh(false); camLocal = true; if (fly && !fly.rev) fly.rev = true; else fly = makeFlight(true);
  }
  function finish() {
    el.classList.remove('on'); setTimeout(() => {
      cancelAnimationFrame(raf); removeEventListener('resize', resize); removeEventListener('keydown', kd); removeEventListener('keyup', ku);
      scene.traverse(o => { o.geometry && o.geometry.dispose(); }); renderer.dispose(); pmrem.dispose(); rt.dispose();
      el.remove(); document.body.style.overflow = ''; AC && AC.close(); if (btn) btn.focus({ preventScroll: true });
    }, 520);
  }

  /* ---------- кадр ---------- */
  let raf = 0, last = performance.now(), time = 0, spinV = 2.6, trailTick = 0;
  const tmpC = new THREE.Color();
  // адаптивное качество: если кадр долгий — снижаем разрешение, затем убираем отражения и тени
  const Q_ = { n: 0, acc: 0, step: 0, noRefl: false, frame: 0 };
  function adapt(ms) {
    if (G.mode !== 'walk' || Q_.step >= 3) return; Q_.acc += ms; if (++Q_.n < 90) return; const avg = Q_.acc / Q_.n; Q_.n = 0; Q_.acc = 0;
    if (avg < 21) return; Q_.step++;
    if (Q_.step === 1) { renderer.setPixelRatio(Math.max(1, DPR * .75)); composer.setPixelRatio(Math.max(1, DPR * .75)); resize(); }
    else if (Q_.step === 2) { Q_.noRefl = true; bloom.resolution.multiplyScalar(.6); }
    else { renderer.shadowMap.enabled = false; moon.castShadow = false; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); renderer.setPixelRatio(1); composer.setPixelRatio(1); resize(); }
  }
  function frame(now) { raf = requestAnimationFrame(frame); const ms = now - last, dt = Math.min(.05, ms / 1000); last = now; adapt(ms); if (renderer.shadowMap.enabled) { renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = (++Q_.frame % 2 === 0); } tick(dt); composer.render(); }
  function tick(dt) {
    time += dt;
    if (fly) {
      fly.t += (fly.rev ? -dt : dt) / fly.dur; const k = clamp(fly.t, 0, 1), e = ease(k);
      cam.p.copy(fly.pc.getPoint(e)); cam.l.copy(fly.lc.getPoint(e)); cam.fov = fly.f0 + (fly.f1 - fly.f0) * smooth(.3, 1, e); G.phase = e;
      if (!fly.rev && fly.t >= 1) { fly = null; arrive(); }
      else if (fly && fly.rev && fly.t <= 0) { fly = null; G.mode = 'shelf'; camLocal = false; setTimeout(finish, 700); }
    } else if (!camLocal) {
      const o = outsidePose(); cam.p.copy(o.p).add(V3(Math.sin(time * .25) * .8, Math.sin(time * .2) * .3, 0)); cam.l.copy(o.l); cam.fov = o.fov;
    } else if (G.mode === 'walk') {
      const tp = thirdPerson(), k = 1 - Math.pow(.004, dt); cam.p.lerp(tp.p, k); cam.l.lerp(tp.l, 1 - Math.pow(.0005, dt)); cam.fov += (tp.fov - cam.fov) * k;
    }
    applyCam();
    // снаружи/внутри
    const inside = camera.position.length() < R - .05;
    const camL = camLocal ? cam.p : toLocal(camera.position);
    if (outside.visible === inside) { outside.visible = !inside; beyond.visible = inner.visible = inside; if (!REDUCE) { flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go'); } }
    const nearRink = inside && Math.hypot(camL.x, camL.z) < 30 && camL.y < 30; if (reflector) reflector.visible = nearRink && !Q_.noRefl; iceMat.opacity = reflector && reflector.visible ? .42 : .9;
    const low = inside ? smooth(40, 4, camL.y) : 0;              // насколько опустились к земле
    scene.fog.density = inside ? (.003 + .0075 * low) / S : 0;
    bgU.uIn.value = inside ? 1 : 0;
    key.intensity = inside ? .1 : 1.1; rimL.intensity = inside ? .12 : .7;
    bloom.strength = inside ? .52 : .75; bloom.threshold = inside ? .86 : .88;
    // тень луны следует за героем
    if (moon.castShadow) { const c = toScene(V3(H.x, 0, H.z)); moon.target.position.copy(c); moon.position.copy(c).add(V3(-5, 14, 7).multiplyScalar(.5)); const e = (inside ? 22 : 60) * S; const sc = moon.shadow.camera; if (sc.right !== e) { sc.left = -e; sc.right = e; sc.top = e; sc.bottom = -e; sc.near = .1; sc.far = 30; sc.updateProjectionMatrix(); } }
    // уровни мест (волна огоньков)
    for (const g in groups) { const q = groups[g]; q.lv += clamp(q.tg - q.lv, -dt * .7, dt * .7); }
    for (let i = 0; i < bulbData.length; i++) { const b = bulbData[i], L = groups[b.group].lv; let lv = smooth(b.order, b.order + .12, L); lv = (inside ? .14 : .42) + lv * (.85 + .15 * Math.sin(time * 2.2 + b.ph)); bulbs.setColorAt(i, tmpC.copy(b.c).multiplyScalar(lv)); }
    bulbs.instanceColor.needsUpdate = true;
    lamps.forEach((l, i) => { const k = .25 + .75 * smooth(0, .3, groups[l.g].lv); l.head.material.color.setRGB(4 * k, 2.7 * k, 1.3 * k); l.gl.material.opacity = .15 + .45 * k + Math.sin(time * 3 + i) * .03; });
    lights.forEach(o => { o.light.intensity = 1.5 * smooth(0, .3, groups[o.g].lv); });
    pools.forEach(p => { if (p.userData.g !== 'pick') p.material.opacity = .15 + .85 * smooth(0, .3, (groups[p.userData.g] || { lv: 1 }).lv); });
    const tp = places.find(p => p.id === 'tree'); const tl = groups.tree.lv; tp.star.material.emissiveIntensity = .6 + 2.2 * smooth(.6, 1, tl); tp.sp.material.opacity = .3 + .6 * smooth(.6, 1, tl); tp.star.rotation.y = time * .6;
    if (beyond.userData.vU) beyond.userData.vU.uOpacity.value = .55 + .45 * smooth(0, 1, groups.look.lv);
    // частицы
    spinV *= Math.pow(.6, dt); gSnowU.uSpin.value += spinV * dt + dt * .05;
    const sc = Hh * DPR / (2 * Math.tan(camera.fov * Math.PI / 360));
    gSnowU.uTime.value = lSnowU.uTime.value = time * (REDUCE ? .5 : 1); starU.uTime.value = glitU.uTime.value = spU.uTime.value = skyU.uTime.value = time;
    gSnowU.uScale.value = sc; lSnowU.uScale.value = glitU.uScale.value = spU.uScale.value = sc * S; starU.uScale.value = sc * S * .5;
    if (beyond.userData.vU) { beyond.userData.vU.uTime.value = time; beyond.userData.vU.uScale.value = sc * S; }
    lSnowU.uC.value.copy(camL);
    for (let i = 0; i < SP; i++) { if (spLife[i] > 0) { spLife[i] -= dt; spVel[i * 3 + 1] -= 2.2 * dt; spPos[i * 3] += spVel[i * 3] * dt; spPos[i * 3 + 1] += spVel[i * 3 + 1] * dt; spPos[i * 3 + 2] += spVel[i * 3 + 2] * dt; spSeed[i * 4 + 3] = Math.max(0, spLife[i]) * .05; } else spSeed[i * 4 + 3] = 0; }
    spGeo.attributes.position.needsUpdate = spGeo.attributes.aSeed.needsUpdate = true;
    // фигуристы на катке
    const npcMove = G.mode === 'outside' || G.mode === 'shelf' || G.mode === 'load' ? .15 : 1;
    npcs.forEach((n, i) => { n.a += n.w * dt * npcMove; const r = n.r + Math.sin(time * .5 + i) * .25; n.sk.position.set(Math.cos(n.a) * r, .03, Math.sin(n.a) * r); n.sk.rotation.y = -n.a + (n.w > 0 ? Math.PI : 0) + (i === 2 ? Math.sin(time * 1.1) * .4 : 0); poseSkater(n.sk, time, .3 + .7 * npcMove, (n.w > 0 ? .18 : -.2), time * 3.2 * npcMove + i); });
    updateHero(dt);
    checkPlaces();
    if (G.play) gameTick(dt);
    pickups.slice().forEach(p => {
      p.t += dt; const land = .75 + Math.sin(time * 2.4 + p.x) * .08; p.y += (land - p.y) * (1 - Math.pow(.12, dt)); p.m.position.set(p.x, p.y, p.z); p.m.rotation.set(0, time * 1.8 + p.x, 0);
      const fi = smooth(0, .6, p.t), fo = 1 - smooth(p.life - 1.2, p.life, p.t); p.m.scale.setScalar(fi * fo * (1 + Math.sin(time * 6) * .04));
      p.gl.position.copy(p.m.position); p.gl.material.opacity = .8 * fi * fo; p.ring.material.opacity = .9 * smooth(3, .4, p.y) * fo;
      if (p.t > p.life) killPickup(p);
    });
    if (G.mode === 'walk' && !G.play) { const show = onIce(H.x, H.z) || Math.hypot(H.x, H.z) < RINK + 1.5; if (starsBtn.hidden === show) starsBtn.hidden = !show; }
  }
  function moveInput() {
    let fx = 0, fz = 0;
    Object.keys(keys).forEach(k => { if (keys[k]) { fx += KEYS[k][0]; fz += KEYS[k][1]; } });
    if (joy) { fx += joy.dx; fz -= joy.dy; }
    if (fx || fz) { H.goto = null; const l = Math.max(1, Math.hypot(fx, fz)); fx /= l; fz /= l; const s = Math.sin(camS.yaw), c = Math.cos(camS.yaw); return [fx * c - fz * s, -fx * s - fz * c]; }
    if (H.goto) { const dx = H.goto.x - H.x, dz = H.goto.z - H.z, d = Math.hypot(dx, dz); if (d < .4) { H.goto = null; return [0, 0]; } const f = Math.min(1, d / 1.2); return [dx / d * f, dz / d * f]; }
    return [0, 0];
  }
  function updateHero(dt) {
    if (G.mode !== 'walk') { H.y = hgt(H.x, H.z); hero.position.set(H.x, onIce(H.x, H.z) ? .03 : H.y, H.z); hero.rotation.y = H.head; poseSkater(hero, time, .2, 0, 0, true); return; }
    const [ix, iz] = moveInput(); const ice = onIce(H.x, H.z); H.ice = ice;
    if (ice) { H.vx += ix * 7.5 * dt; H.vz += iz * 7.5 * dt; const fr = Math.pow(.55, dt); H.vx *= fr; H.vz *= fr; const MAX = 5.2, sp = Math.hypot(H.vx, H.vz); if (sp > MAX) { H.vx *= MAX / sp; H.vz *= MAX / sp; } }
    else { const tx = ix * 3.4, tz = iz * 3.4, k = 1 - Math.pow(.0005, dt); H.vx += (tx - H.vx) * k; H.vz += (tz - H.vz) * k; }
    let nx = H.x + H.vx * dt, nz = H.z + H.vz * dt;
    // мягкая граница мира
    const r = Math.hypot(nx, nz); if (r > WALK_R) { nx *= WALK_R / r; nz *= WALK_R / r; const vn = (H.vx * nx + H.vz * nz) / WALK_R; if (vn > 0) { H.vx -= vn * nx / WALK_R; H.vz -= vn * nz / WALK_R; } if (!H.edgeT || time - H.edgeT > 6) { H.edgeT = time; showPlace('Дальше — глубокие сугробы', 'Мир шара тянется за холмы, но туда только смотреть'); } }
    for (const c of colliders) { const dx = nx - c[0], dz = nz - c[1], d = Math.hypot(dx, dz), m = c[2] + .3; if (d < m && d > 1e-4) { nx = c[0] + dx / d * m; nz = c[1] + dz / d * m; } }
    H.x = nx; H.z = nz;
    const sp = Math.hypot(H.vx, H.vz);
    // высота: лёд, мост, снег
    let y = hgt(H.x, H.z); if (onIce(H.x, H.z)) y = .03;
    const bp = places.find(p => p.id === 'bridge').bridge; const bx = H.x - bp.x0, bz = H.z - bp.z0; if (Math.abs(bz) < 1 && Math.abs(bx) < bp.L / 2) y = Math.max(y, bp.gy + Math.sin((bx / bp.L + .5) * Math.PI) * bp.arcH + .07);
    H.y += (y - H.y) * (1 - Math.pow(.0001, dt));
    if (sp > .15) { const target = Math.atan2(H.vx, H.vz); const dh = wrapA(target - H.head); const step = dh * (1 - Math.pow(ice ? .01 : .0005, dt)); H.head += step; H.lean = ice ? clamp(-step / Math.max(dt, .001) * .09 * Math.min(1, sp / 3), -.45, .45) : 0;
      if (G.play && ice) { if (sp > 1.6) { if (Math.sign(step) !== Math.sign(H.spin) && Math.abs(H.spin) > .3) H.spin *= .4; H.spin += step; } else H.spin *= Math.pow(.2, dt); if (Math.abs(H.spin) > Math.PI * 2) { H.spin = 0; pirouette(); } }
      // камера мягко заходит за спину
      if ((camS.manual || 0) <= 0 && (ix || iz || H.goto)) { const want = H.head + Math.PI; camS.yaw += wrapA(want - camS.yaw) * (1 - Math.pow(.5, dt)) * (fwdness(ix, iz) > -.3 ? 1 : 0); }
    } else H.lean *= .9;
    camS.manual = Math.max(0, (camS.manual || 0) - dt);
    H.stride += sp * dt * (ice ? 1.6 : 3.4);
    hero.position.set(H.x, H.y, H.z); hero.rotation.y = H.head;
    poseSkater(hero, time, ice ? clamp(sp / 3.2, .15, 1) : clamp(sp / 3.4, 0, 1), H.lean, H.stride, !ice);
    if (heroShadow.parent) heroShadow.position.set(H.x, H.y + .05, H.z);
    if (!ice && sp > .5) { const st = Math.floor(H.stride / Math.PI); if (st !== H.step) { H.step = st; crunch(); } }
    // след коньков
    if (ice && sp > .5) {
      const px = -Math.cos(H.head) * .06, pz = Math.sin(H.head) * .06;
      if (H.lt) { tctx.strokeStyle = 'rgba(255,255,255,.75)'; tctx.lineWidth = LOW ? 1.2 : 2; tctx.lineCap = 'round'; [1, -1].forEach(s => { const a = toTrail(H.lt[0] + px * s, H.lt[1] + pz * s), b = toTrail(H.x + px * s, H.z + pz * s); tctx.beginPath(); tctx.moveTo(a[0], a[1]); tctx.lineTo(b[0], b[1]); tctx.stroke(); }); }
      H.lt = [H.x, H.z];
    } else H.lt = null;
    if (++trailTick % 5 === 0) { tctx.globalCompositeOperation = 'destination-out'; tctx.fillStyle = 'rgba(0,0,0,.03)'; tctx.fillRect(0, 0, TS, TS); tctx.globalCompositeOperation = 'source-over'; trailT.needsUpdate = true; }
    if (hissG && sndOn) hissG.gain.value += ((ice ? Math.min(.045, sp * .01) : 0) - hissG.gain.value) * .1;
  }
  const fwdness = (ix, iz) => { const fx = -Math.sin(camS.yaw), fz = -Math.cos(camS.yaw); return ix * fx + iz * fz; };
  function checkPlaces() {
    if (G.mode !== 'walk') return;
    places.forEach(p => {
      const d = Math.hypot(H.x - p.x, H.z - p.z);
      if (d < p.r && !p.near) {
        p.near = true; const g = groups[p.id]; const first = !p.seen; p.seen = true;
        if (g) g.tg = 1.25;
        if (p.silent) { chime([1568 + p.id.slice(-1) * 110], .025, .9); burst(p.x, hgt(p.x, p.z) + 2.4, p.z, 10, 1.2); return; }
        if (first || time - (p.lastT || 0) > 20) { p.lastT = time; showPlace(p.name, p.text); }
        if (p.id === 'tree') { chime([784, 988, 1175, 1568, 1976], .04, 2, .12); setTimeout(() => burst(p.top.x, p.top.y, p.top.z, 70, 3.2, 1.3), 1200); }
        else if (p.id === 'fair') { chime([1319, 1661, 1319, 1661, 1976], .03, .8, .09); burst(p.x, 3, p.z, 30, 2); }
        else if (p.id === 'bridge') { chime([1175, 1397, 1760], .035, 1.6, .15); for (let k = 0; k < 6; k++) burst(streamX(p.z - 9 + k * 3.5), hgt(streamX(p.z), p.z) + .3, p.z - 9 + k * 3.5, 8, 1.2, 1.4); }
        else if (p.id === 'bench') { chime([988, 1319, 1568], .035, 1.4, .18); burst(p.x - 2.6, 1.5, p.z, 40, 1.4, 1.6); }
        else if (p.id === 'look') { chime([659, 880, 1047, 1319, 1760], .03, 2.6, .25); }
        else if (p.id === 'rink' && first) { chime([1319, 1976], .03, 1); }
      } else if (d > p.r + 2) p.near = false;
    });
  }
  function pirouette() {
    G.score += 3; hudSc.textContent = G.score; burst(H.x, .5, H.z, 40, 2.6); pop('Пируэт! +3', H.x, 2.2, H.z, 'big'); chime([1319, 1568, 1976, 2637], .04, 1.4, .07);
    const ring = pool(H.x, H.z, 4, HDR(.8, .6, .3), 'pick', .02); let k = 1; const fade = () => { k -= .03; ring.material.opacity = Math.max(0, k); ring.scale.setScalar(1 + (1 - k) * 1.2); if (k > 0) requestAnimationFrame(fade); else { world.remove(ring); pools.splice(pools.indexOf(ring), 1); } }; fade();
  }
  function gameTick(dt) {
    G.left -= dt; const sec = Math.max(0, Math.ceil(G.left)); if (hudTm.textContent !== String(sec)) { hudTm.textContent = sec; el.classList.toggle('hurry', sec <= 10); }
    G.spawnT -= dt; if (G.spawnT <= 0 && pickups.length < 7) { spawn(rnd() < .14); G.spawnT = .9 + rnd() * .9; }
    pickups.slice().forEach(p => {
      if (p.t < .4 || Math.hypot(p.x - H.x, p.z - H.z) > .85 || p.y > 2.2) return;
      G.combo = time - G.lastPick < 2.4 ? Math.min(5, G.combo + 1) : 1; G.lastPick = time;
      const pts = (p.bonus ? 3 : 1) * (G.combo >= 3 ? 2 : 1); G.score += pts; hudSc.textContent = G.score;
      burst(p.x, p.y, p.z, p.bonus ? 34 : 22); pop('+' + pts, p.x, p.y + .7, p.z, p.bonus ? 'blue' : '');
      if (G.combo >= 2) { comboEl.textContent = 'Комбо ×' + G.combo; comboEl.classList.remove('on'); void comboEl.offsetWidth; comboEl.classList.add('on'); }
      chime(p.bonus ? [1568, 2093, 2637] : [1319 * Math.pow(1.06, G.combo - 1), 1976 * Math.pow(1.06, G.combo - 1)], .05, 1, .05);
      killPickup(p);
    });
    if (G.left <= 0) endGame();
  }

  /* ---------- старт ---------- */
  H.y = hgt(H.x, H.z); G.mode = 'outside'; Object.assign(cam, outsidePose()); applyCam();
  try { renderer.compile(scene, camera); } catch (e) { }
  $('.rk-load').classList.add('off');
  raf = requestAnimationFrame(frame);
  const api = { exit };
  if (DEBUG) {
    cancelAnimationFrame(raf);
    Object.assign(api, {
      G, H, groups, camS, places, world, THREE, bgU, glass, scene, bloom,
      tick: (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) tick(dt); composer.render(); },
      enter, arrive, startGame, spawn,
      flyAt: e => { camLocal = true; G.mode = 'flyin'; fly = makeFlight(false); fly.t = e; fly.dur = 1e9; },
      walkAt: (x, z, yaw, head) => { fly = null; camLocal = true; G.mode = 'walk'; H.x = x; H.z = z; H.y = hgt(x, z); camS.yaw = yaw; H.head = head === undefined ? yaw + Math.PI : head; Object.assign(cam, thirdPerson()); },
      wakeAll: () => { for (const g in groups) { groups[g].tg = 1.25; groups[g].lv = 1.25; } },
    });
    window.__rk = api; return api;
  }
  setTimeout(enter, REDUCE ? 900 : 1600);
  return api;
}

/* окружение для бликов на стекле и лаке: тёмная комната с тёплыми софтбоксами */
function makeEnv(pmrem) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ color: 0x0a0f1c, side: THREE.BackSide })));
  const panel = (w, h, c, x, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); };
  panel(2.6, 30, HDR(2.4, 1.7, .95), -24, 10, 30); panel(1.6, 24, HDR(.8, 1.05, 1.7), 32, 6, 16); panel(24, 3, HDR(.5, .36, .2), 0, -20, 30);
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; const m = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), new THREE.MeshBasicMaterial({ color: HDR(5, 3.4, 1.4) })); m.position.set(Math.cos(a) * 40, 6 + Math.sin(i * 1.7) * 6, Math.sin(a) * 40); s.add(m); }
  return pmrem.fromScene(s, .02).texture;
}

/* общие части для других 3D-шаров (js/rail3d.js) */
export { canvasTex, glowTex, woodTex, windowTex, makeEnv, pointCloud, SNOW_V, SNOW_F, TW_V, TW_F, V3, HDR, clamp, smooth, ease, wrapA };
