/* Общий набор для 3D-шаров (globes v2): шум и хребты, пышные ели, снег с блеском, тёплая цветокоррекция,
   боке огней, «экскурсия» по точкам интереса, адаптивное качество, полка со стеклянным шаром,
   уютная комната (камин, ёлка, чай) и каркас для новых миров (createGlobe). Всё процедурное. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTex, glowTex, woodTex, windowTex, makeEnv, pointCloud, SNOW_V, SNOW_F, SHAKE_U, SHAKE_ICON, makeShake, bindShake, TW_V, TW_F, V3, HDR, clamp, smooth, ease, wrapA } from './rink3d.js';

export { THREE, mergeGeometries, RoundedBoxGeometry };

/* ---------------- качество ---------------- */
export function quality() {
  const q = new URLSearchParams(location.search).get('q');
  const coarse = matchMedia('(pointer: coarse)').matches, small = Math.min(innerWidth, innerHeight) < 600;
  const mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
  let tier = coarse || small ? 1 : 2;
  if ((coarse || small) && (mem <= 3 || cores <= 4)) tier = 0;
  if (q === 'low') tier = 0; else if (q === 'mid') tier = 1; else if (q === 'high') tier = 2;
  return { tier, LOW: tier < 2, bloom: tier > 0, dpr: Math.min(devicePixelRatio || 1, [1.25, 1.5, 1.75][tier]) };
}

/* ---------------- шум ---------------- */
const hash2 = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
export function noise2(x, y) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, oct = 5) { let s = 0, a = .5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); n += a; a *= .5; f *= 2.03; } return s / n; }
/* мягкие хребты: острые гребни сглажены, склоны пологие — заснеженные горы, а не пирамидки */
export function ridged(x, y, oct = 5) { let s = 0, a = .5, f = 1, n = 0, w = 1; for (let i = 0; i < oct; i++) { let r = 1 - Math.abs(noise2(x * f, y * f) * 2 - 1); r = r * r * (3 - 2 * r); s += a * r * w; w = clamp(r * 1.2, 0, 1); n += a; a *= .5; f *= 2.1; } return s / n; }

/* ---------------- пышная ель ---------------- */
function orient(g, up) { g.computeVertexNormals(); const n = g.attributes.normal; let sy = 0; for (let i = 0; i < n.count; i++) sy += n.getY(i); if ((sy < 0) === up) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); } return g; }
const mixA = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export function furFir({ tiers = 7, seg = 22, snow = .5, seed = 3, height = 2.6, radius = .9, dark = [.02, .075, .055], mid = [.05, .16, .11], tip = [.11, .27, .18], snowCol = [.92, .95, 1.02] } = {}) {
  let s = seed * 9301 + 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const parts = [];
  const tr = new THREE.CylinderGeometry(.05, .09, .55, 7, 1); tr.translate(0, .27, 0); tr.deleteAttribute('uv'); tr.deleteAttribute('normal');
  { const c = new Float32Array(tr.attributes.position.count * 3); for (let i = 0; i < c.length; i += 3) c.set([.18, .1, .06], i); tr.setAttribute('color', new THREE.BufferAttribute(c, 3)); tr.computeVertexNormals(); parts.push(tr); }
  for (let i = 0; i < tiers; i++) {
    const f = i / (tiers - 1), R = radius * (1 - f * .84) * (.92 + r() * .16), H = (height - .3) / tiers * 1.85 * (1 - f * .3);
    const y0 = .32 + f * (height - .3 - H * .9), top = y0 + H, ph = r() * 6.283, rows = 4;
    const pos = [0, top, 0], col = [...mixA(mid, snowCol, snow * .5)], idx = [];
    for (let k = 1; k <= rows; k++) {
      const t = k / rows;
      for (let j = 0; j < seg; j++) {
        const a = j / seg * 6.283 + ph, tipF = (j % 2 ? .4 : 1) * (.75 + r() * .5), tt = t * t;
        const rr = R * t * (1 + .2 * tipF * tt) * (1 + (noise2(a * 2 + i, k) - .5) * .12);
        const y = top - H * t - .26 * H * tipF * tt * t + (r() - .5) * .03;
        pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
        let c = mixA(dark, mid, Math.min(1, t * 1.3)); c = mixA(c, tip, tipF * tt * t * .9);
        const n = noise2(Math.cos(a) * 2.2 + i * 3.1, Math.sin(a) * 2.2 + k * .7);
        const sm = smooth(.5, .68, n * .75 + snow * .62 - (tipF * tt * t > .7 ? .18 : 0) + (1 - t) * .08);
        c = mixA(c, snowCol, sm * Math.min(1, snow * 2));
        col.push(...c);
      }
    }
    const A = (k, j) => k === 0 ? 0 : 1 + (k - 1) * seg + (j % seg);
    for (let j = 0; j < seg; j++) idx.push(0, A(1, j), A(1, j + 1));
    for (let k = 1; k < rows; k++) for (let j = 0; j < seg; j++) idx.push(A(k, j), A(k + 1, j), A(k, j + 1), A(k, j + 1), A(k + 1, j), A(k + 1, j + 1));
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); parts.push(orient(g, true));
    // испод яруса: тёмный, чтобы снизу ель не просвечивала
    const up = [], uc = [], ui = []; const base = rows * seg + 1; for (let j = 0; j < seg; j++) { up.push(pos[(1 + (rows - 1) * seg + j) * 3], pos[(1 + (rows - 1) * seg + j) * 3 + 1], pos[(1 + (rows - 1) * seg + j) * 3 + 2]); uc.push(...dark); } up.push(0, y0 + H * .3, 0); uc.push(dark[0] * .5, dark[1] * .5, dark[2] * .5);
    for (let j = 0; j < seg; j++) ui.push(seg, j, (j + 1) % seg); void base;
    const u = new THREE.BufferGeometry(); u.setAttribute('position', new THREE.Float32BufferAttribute(up, 3)); u.setAttribute('color', new THREE.Float32BufferAttribute(uc, 3)); u.setIndex(ui); parts.push(orient(u, false));
  }
  const g = mergeGeometries(parts); return g;
}
export const firMat = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .82, metalness: 0 });

/* ---------------- снег с лёгким блеском ---------------- */
let bumpT = null;
export function snowBump() {
  if (bumpT) return bumpT;
  // карта нормалей (а не bump: у bump на вырожденных uv бывают NaN и белые квадраты в bloom)
  const N = 256, hf = (x, y) => fbm(x / 22, y / 22, 4) * .7 + noise2(x / 5, y / 5) * .3;
  bumpT = canvasTex(N, N, (g, w, h) => { const d = g.createImageData(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dx = (hf((x + 1) % N, y) - hf((x + N - 1) % N, y)) * 6, dy = (hf(x, (y + 1) % N) - hf(x, (y + N - 1) % N)) * 6, l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4; d.data[i] = (-dx / l * .5 + .5) * 255; d.data[i + 1] = (-dy / l * .5 + .5) * 255; d.data[i + 2] = (1 / l * .5 + .5) * 255; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); }, false);
  bumpT.wrapS = bumpT.wrapT = THREE.RepeatWrapping; return bumpT;
}
export function sparkle(mat, scale = 40, gain = 3) {
  mat.onBeforeCompile = s => {
    s.uniforms.uSparkS = { value: scale }; s.uniforms.uSparkG = { value: gain }; mat.userData.sh = s;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSpW;').replace('#include <fog_vertex>', '#include <fog_vertex>\nvSpW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vSpW; uniform float uSparkS, uSparkG;').replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { vec3 sp = floor(vSpW * uSparkS); float hh = fract(sin(dot(sp, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        vec3 Vv = normalize(cameraPosition - vSpW); float tw = step(.982, hh) * pow(fract(hh * 91.7 + dot(Vv, vec3(3.1, 1.7, 2.3)) * 2.), 22.);
        totalEmissiveRadiance += vec3(1., .95, .86) * tw * uSparkG; }`);
  };
  return mat;
}
export function snowMaterial(opts = {}) {
  const m = new THREE.MeshStandardMaterial({ color: opts.color || 0xe9effc, roughness: .78, metalness: 0, vertexColors: !!opts.vertexColors });
  if (opts.repeat) { m.normalMap = snowBump().clone(); m.normalMap.repeat.set(opts.repeat, opts.repeat); m.normalMap.needsUpdate = true; m.normalScale.set(.5, .5); }
  return opts.spark === false ? m : sparkle(m, opts.sparkScale || 40, opts.sparkGain || 3);
}

/* ---------------- цветокоррекция: тёплые света, холодные тени, виньетка, зерно ---------------- */
export function gradePass(opts = {}) {
  return new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: opts.vig ?? .55 }, uGrain: { value: opts.grain ?? .022 }, uWarm: { value: opts.warm ?? 1 }, uLift: { value: opts.lift ?? 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uVig, uGrain, uWarm, uLift; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float l = dot(c, vec3(.299, .587, .114));
        c += mix(vec3(.004, .010, .032) * uLift, vec3(.045, .016, -.02), smoothstep(.12, .8, l)) * uWarm;
        c = mix(c, c * c * (3. - 2. * c), .14); c = mix(vec3(l), c, 1.07);
        vec2 q = (vUv - .5) * vec2(1.05, 1.2); c *= clamp(1. - dot(q, q) * uVig, 0., 1.);
        float n = fract(sin(dot(vUv * vec2(1931., 1087.) + fract(uTime) * 61.7, vec2(12.9898, 78.233))) * 43758.5453) - .5; c += n * uGrain;
        gl_FragColor = vec4(c, 1.); }`
  });
}

/* страховка перед bloom: NaN/бесконечности → 0, слишком яркое — придержать (иначе bloom рисует белые квадраты) */
export function sanitizePass() {
  return new ShaderPass({ uniforms: { tDiffuse: { value: null } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; bool bad(float x){ return (floatBitsToUint(x) & 0x7f800000u) == 0x7f800000u; } void main(){ vec4 c = texture2D(tDiffuse, vUv); if (bad(c.r) || bad(c.g) || bad(c.b)) c = vec4(0., 0., 0., 1.); gl_FragColor = vec4(clamp(c.rgb, 0., 24.), c.a); }' });
}
/* ---------------- боке: размытые огоньки у самой камеры ---------------- */
let bokT = null;
const bokTex = () => bokT || (bokT = canvasTex(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(.72, 'rgba(255,255,255,.7)'); gr.addColorStop(.86, 'rgba(255,255,255,.95)'); gr.addColorStop(.94, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); }));
export function makeBokeh(camera, { n = 18, colors = [0xffc27a, 0xffa860, 0xffe0a8, 0xff7a5a, 0x9fd0ff], opacity = .1, unit = 1 } = {}) {
  const g = new THREE.Group(), list = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: bokTex(), color: colors[i % colors.length], transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false }));
    m.renderOrder = 50; g.add(m); list.push({ m, u: Math.random(), v: Math.random() * .9 + .05, d: .5 + Math.random() * 1.6, s: .5 + Math.random(), ph: Math.random() * 6.3, sp: .006 + Math.random() * .012, o: opacity * (.4 + Math.random() * .8) });
  }
  camera.add(g);
  return {
    g, set visible(v) { g.visible = v; }, get visible() { return g.visible; }, level: 1, unit,
    update(dt, t, cam) {
      const th = Math.tan(cam.fov * Math.PI / 360);
      list.forEach(b => {
        b.v += b.sp * dt; b.u += Math.sin(t * .3 + b.ph) * .004 * dt; if (b.v > 1.08) { b.v = -.08; b.u = Math.random(); }
        const d = b.d * this.unit, y = (b.v * 2 - 1) * th * d, x = (b.u * 2 - 1) * th * cam.aspect * d;
        b.m.position.set(x, y, -d); const sz = d * th * .14 * b.s; b.m.scale.set(sz, sz, 1);
        const edge = Math.min(1, Math.min(b.u, 1 - b.u) * 4) * (.75 + .25 * Math.sin(t * .8 + b.ph));
        b.m.material.opacity = b.o * edge * this.level;
      });
    }
  };
}

/* ---------------- экскурсия: ‹ точка › , свайп, стрелки ---------------- */
const ARR = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export function makeTour(root, surface, { onGo, count, label }) {
  const nav = document.createElement('nav'); nav.className = 'gk-tour'; nav.setAttribute('aria-label', 'Экскурсия по шару');
  nav.innerHTML = `<button class="rk-btn gk-prev" type="button" aria-label="Предыдущее место">${ARR('M15 5l-7 7 7 7')}</button><p class="gk-name" aria-live="polite"><b></b><small></small></p><button class="rk-btn gk-next" type="button" aria-label="Следующее место">${ARR('M9 5l7 7-7 7')}</button>`;
  root.appendChild(nav);
  const T = { i: -1, n: count, enabled: true,
    go(i, user) { if (!T.enabled) return; const n = T.n(); i = (i + n) % n; T.i = i; T.draw(); onGo(i, user); },
    draw() { const n = T.n(), L = label(T.i); nav.querySelector('b').textContent = L; nav.querySelector('small').textContent = (T.i + 1) + ' из ' + n; },
    next() { T.go(T.i + 1, true); }, prev() { T.go(T.i - 1, true); }, nav };
  nav.querySelector('.gk-prev').addEventListener('click', () => T.prev());
  nav.querySelector('.gk-next').addEventListener('click', () => T.next());
  // свайп по сцене: влево — дальше, вправо — назад
  let sw = null;
  surface.addEventListener('pointerdown', e => { sw = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; });
  surface.addEventListener('pointerup', e => { if (!sw || sw.id !== e.pointerId) return; const dx = e.clientX - sw.x, dy = e.clientY - sw.y; if (T.enabled && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4 && performance.now() - sw.t < 700) { T.swiped = performance.now(); dx < 0 ? T.next() : T.prev(); } sw = null; });
  return T;
}

/* ---------------- звук: мягкие колокольчики ---------------- */
export function makeAudio(store, btn) {
  const A = { ctx: null, on: store('elk-music') === '1' };
  const siteBtn = document.getElementById('music');
  A.init = () => { if (A.ctx) return; try { A.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } };
  A.chime = (fs, vol = .045, dur = 1.4, gap = .08) => { if (!A.on || !A.ctx) return; const t0 = A.ctx.currentTime; fs.forEach((f, i) => [[1, 1], [2.01, .4], [2.76, .22]].forEach(([m, a]) => { const o = A.ctx.createOscillator(), g = A.ctx.createGain(); o.type = 'sine'; o.frequency.value = f * m; g.gain.setValueAtTime(0, t0 + i * gap); g.gain.linearRampToValueAtTime(vol * a, t0 + i * gap + .008); g.gain.exponentialRampToValueAtTime(.0001, t0 + i * gap + dur / Math.sqrt(m)); o.connect(g); g.connect(A.ctx.destination); o.start(t0 + i * gap); o.stop(t0 + i * gap + dur + .05); })); };
  A.whoosh = up => { if (!A.on || !A.ctx) return; const c = A.ctx, t0 = c.currentTime, b = c.createBuffer(1, c.sampleRate * 3, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const n = c.createBufferSource(); n.buffer = b; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(up ? 300 : 2400, t0); f.frequency.exponentialRampToValueAtTime(up ? 2400 : 300, t0 + 2.6); const g = c.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.06, t0 + 1.3); g.gain.linearRampToValueAtTime(0, t0 + 3); n.connect(f); f.connect(g); g.connect(c.destination); n.start(t0); n.stop(t0 + 3); };
  A.set = on => { A.on = on; btn.setAttribute('aria-pressed', on ? 'true' : 'false'); btn.setAttribute('aria-label', on ? 'Звук: выключить' : 'Звук: включить'); if (on) { A.init(); A.ctx && A.ctx.resume(); } if (siteBtn && (siteBtn.getAttribute('aria-pressed') === 'true') !== on) siteBtn.click(); };
  btn.setAttribute('aria-pressed', A.on ? 'true' : 'false'); btn.addEventListener('click', () => A.set(!A.on));
  return A;
}

/* ---------------- полка, подставка и стеклянный шар (снаружи) ---------------- */
export const R = 10, GROUND_Y = -2.5;
export async function buildShelf(scene, envMap, { label, LOW, T_GLOW, rnd, baseCol = '#3b1f12', ornaments }) {
  const outside = new THREE.Group(); scene.add(outside);
  const bgU = { uIn: { value: 0 }, uBok: { value: 1 } };
  const bg = new THREE.Mesh(new THREE.SphereGeometry(200, 48, 24), new THREE.ShaderMaterial({
    uniforms: bgU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform float uIn, uBok; varying vec3 vP; void main(){ vec3 d = normalize(vP); float h = d.y;
      vec3 room = mix(vec3(.02,.014,.012), vec3(.012,.016,.034), smoothstep(-.35,.55,h));
      room += vec3(.22,.12,.05) * pow(max(0., dot(d, normalize(vec3(.1,-.05,-1.)))), 6.) * .5;
      for (int i = 0; i < 16; i++) { float fi = float(i); float az = -1.2 + fi * .16 + sin(fi * 7.3) * .05; float el = -.14 + .1 * sin(fi * 2.1) + .05 * cos(fi * 5.7); if (abs(az) < .3) el += .22;
        vec3 bd = normalize(vec3(sin(az), el, -cos(az))); float rad = .018 + .012 * fract(sin(fi * 12.9) * 43758.5); float dd = acos(clamp(dot(d, bd), -1., 1.));
        vec3 bc = mix(vec3(1.,.7,.35), vec3(1.,.45,.4), step(.75, fract(fi * .37))); float k = smoothstep(rad, rad * .86, dd) * (.55 + .45 * smoothstep(rad * .6, rad * .95, dd));
        room += bc * k * (.035 + .03 * fract(fi * .61)) * uBok; }
      gl_FragColor = vec4(room * (1. - uIn), 1.); }`
  })); bg.renderOrder = -10; outside.add(bg);
  const key = new THREE.DirectionalLight(0xffcf98, 1.6); key.position.set(-22, 16, 26); scene.add(key);
  const rimL = new THREE.DirectionalLight(0x8fb2ff, .9); rimL.position.set(24, 10, -18); scene.add(rimL);
  const shelfMat = new THREE.MeshPhysicalMaterial({ map: woodTex('#4a2e1b', '#2a170c', '#6b4429'), roughness: .5, clearcoat: .5, clearcoatRoughness: .35, envMap, envMapIntensity: .5 }); shelfMat.map.repeat.set(3, 1);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(110, 1.6, 30), shelfMat); shelf.position.set(0, -13.3, 2); outside.add(shelf);
  const baseMat = new THREE.MeshPhysicalMaterial({ map: woodTex(baseCol, '#1d0e06', '#5b3220'), roughness: .32, clearcoat: 1, clearcoatRoughness: .12, envMap, envMapIntensity: 1 }); baseMat.map.repeat.set(2, 1);
  const prof = [[0, -12.5], [8.5, -12.5], [8.85, -12.35], [8.9, -11.75], [8.55, -11.45], [7.9, -10.6], [7.3, -9.5], [6.85, -8.55], [6.95, -8.2], [6.95, -7.75], [6.3, -7.6], [0, -7.6]].map(p => new THREE.Vector2(p[0], p[1]));
  outside.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 96), baseMat));
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9b26a, metalness: 1, roughness: .22, envMap, envMapIntensity: 1.6 });
  [[8.62, -11.5, .13], [7.0, -7.95, .11], [8.15, -10.9, .05]].forEach(([r, y, t]) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 12, 128), gold); m.rotation.x = Math.PI / 2; m.position.y = y; outside.add(m); });
  await (document.fonts && document.fonts.load ? document.fonts.load('600 80px Cormorant').catch(() => 0) : 0);
  const plaqueTex = canvasTex(640, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#8a6630'); gr.addColorStop(.45, '#f3dca2'); gr.addColorStop(.6, '#d6ae66'); gr.addColorStop(1, '#7a5626'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(60,35,10,.7)'; g.lineWidth = 4; g.strokeRect(10, 10, w - 20, h - 20); g.fillStyle = '#3b2410'; g.font = '600 62px Cormorant, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, w / 2, h / 2 + 4); });
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(4.5, .9), new THREE.MeshStandardMaterial({ map: plaqueTex, metalness: .85, roughness: .3, envMap, envMapIntensity: 1.4 }));
  plaque.position.set(0, -10.05, 7.66); plaque.rotation.x = -.43; outside.add(plaque);
  (ornaments || [[-15, 1.6, 4, 0xb33a44], [-11.4, 1.1, 8, 0xd6ae66], [14.5, 1.35, 6, 0x1f4f6a]]).forEach(([x, r, z, c]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), new THREE.MeshPhysicalMaterial({ color: c, metalness: .7, roughness: .14, clearcoat: 1, envMap, envMapIntensity: 1.8 })); m.position.set(x, -12.5 + r, z); outside.add(m);
    const cp = new THREE.Mesh(new THREE.CylinderGeometry(r * .22, r * .26, r * .3, 20), gold); cp.position.set(x + r * .6, -12.5 + r * 1.45, z); cp.rotation.z = -1.0; outside.add(cp);
  });
  const caustic = new THREE.Mesh(new THREE.PlaneGeometry(34, 22), new THREE.MeshBasicMaterial({ map: T_GLOW, color: HDR(.55, .38, .2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); caustic.rotation.x = -Math.PI / 2; caustic.position.set(0, -12.48, 6); outside.add(caustic);
  { const side = []; for (let y = -7.8; y <= GROUND_Y + .45; y += .25) side.push(new THREE.Vector2(Math.sqrt(Math.max(0, 9.92 * 9.92 - y * y)), y)); outside.add(new THREE.Mesh(new THREE.LatheGeometry(side, 96), new THREE.MeshStandardMaterial({ color: 0xaab6d0, roughness: .9 }))); }
  const gSnowU = { uTime: { value: 0 }, uScale: { value: 300 }, uSpin: { value: 0 }, uFloor: { value: GROUND_Y - .1 }, uTop: { value: 9.8 }, uBox: { value: 1 }, uMode: { value: 0 }, uC: { value: V3() }, uOpacity: { value: 1 }, ...SHAKE_U() };
  { const n = LOW ? 900 : 2300, p = [], s = []; for (let i = 0; i < n; i++) { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 9.4; p.push(Math.cos(a) * r, rnd() * 20, Math.sin(a) * r); s.push(rnd(), rnd(), .22 + rnd() * .45, .05 + rnd() * rnd() * .1); } const sn = pointCloud(p, s, gSnowU, SNOW_F, SNOW_V); sn.renderOrder = 5; outside.add(sn); }
  const glassMat = LOW
    ? new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .03, transparent: true, opacity: .12, envMap, envMapIntensity: 1.4, specularIntensity: 0, depthWrite: false })
    : new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0, transmission: 1, thickness: 1.2, ior: 1.42, envMap, envMapIntensity: .8, specularIntensity: 0, depthWrite: false });
  const glass = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), glassMat); glass.renderOrder = 4; outside.add(glass);
  const rimMesh = new THREE.Mesh(new THREE.SphereGeometry(R + .02, 96, 64), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ float f = pow(1. - abs(dot(vN, vV)), 3.2);
      vec3 col = mix(vec3(.45,.6,1.), vec3(1.,.82,.55), smoothstep(-.3,.7,vN.y));
      float st = pow(max(0., dot(vN, normalize(vec3(-.5,.5,.7)))), 90.) * .75 + pow(max(0., dot(vN, normalize(vec3(.62,.3,.72)))), 160.) * .45;
      float a = (f * .55 + st) * smoothstep(-8.5, -6.5, vW.y); gl_FragColor = vec4(col * a, a); }`
  })); rimMesh.renderOrder = 6; outside.add(rimMesh);
  return { outside, bgU, gSnowU, key, rimL, gold };
}

/* ---------------- текстуры комнаты ---------------- */
const stoneTex = () => { const t = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#3b3430'; g.fillRect(0, 0, w, h); let y = 0, row = 0; while (y < h) { const rh = 44 + Math.random() * 26; let x = row % 2 ? -30 : 0; while (x < w) { const rw = 60 + Math.random() * 70, c = 88 + Math.random() * 50, wv = Math.random() * 14; g.fillStyle = `rgb(${c + wv},${c - 4},${c - 12 - wv})`; g.beginPath(); g.roundRect(x + 4, y + 4, rw - 8, rh - 8, 16); g.fill(); g.fillStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.roundRect(x + 8, y + 6, rw - 20, (rh - 8) * .35, 10); g.fill(); x += rw; } y += rh; row++; } }); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
const rugTex = () => canvasTex(512, 512, (g, w) => { const c = w / 2; const rings = ['#7a1f26', '#a8323a', '#e8cf9a', '#7a1f26', '#2f5a48', '#e8cf9a', '#a8323a', '#7a1f26']; rings.forEach((col, i) => { g.fillStyle = col; g.beginPath(); g.arc(c, c, c * (1 - i * .11), 0, 7); g.fill(); }); g.strokeStyle = '#f3e2b8'; g.lineWidth = 3; for (let i = 0; i < 24; i++) { const a = i / 24 * 6.283; g.beginPath(); g.arc(c + Math.cos(a) * c * .62, c + Math.sin(a) * c * .62, 10, 0, 7); g.stroke(); } });
const checkTex = (a, b) => { const t = canvasTex(256, 256, (g, w) => { g.fillStyle = a; g.fillRect(0, 0, w, w); g.fillStyle = b; for (let i = 0; i < 8; i += 2) { g.globalAlpha = .55; g.fillRect(i * 32, 0, 18, w); g.fillRect(0, i * 32, w, 18); } g.globalAlpha = 1; }); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
const plankTex = () => { const t = canvasTex(512, 512, (g, w, h) => { for (let i = 0; i < 8; i++) { const c = 70 + Math.random() * 25; g.fillStyle = `rgb(${c + 30},${c - 2},${c - 30})`; g.fillRect(0, i * 64, w, 64); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, i * 64, w, 2); for (let k = 0; k < 30; k++) { g.strokeStyle = `rgba(40,20,8,${.05 + Math.random() * .12})`; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); const yy = i * 64 + Math.random() * 64; g.moveTo(0, yy); g.bezierCurveTo(w * .3, yy + Math.random() * 6 - 3, w * .6, yy + Math.random() * 6 - 3, w, yy); g.stroke(); } g.fillRect(((i * 197) % 400) + 40, i * 64, 2, 64); } }); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
const FLAME_V = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }';
const FLAME_F = `uniform float uTime, uSeed, uGain; varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
  void main(){ vec2 uv = vUv; float t = uTime * 1.7 + uSeed;
    float fb = n(vec2(uv.x * 4. + uSeed, uv.y * 3. - t * 2.2)) * .55 + n(vec2(uv.x * 9., uv.y * 7. - t * 3.6)) * .3;
    float w = (1. - uv.y) * .42 + .04; float dx = abs(uv.x - .5 + (fb - .45) * .3 * uv.y);
    float body = smoothstep(w, w * .25, dx) * smoothstep(1., .15, uv.y + fb * .42) * smoothstep(0., .1, uv.y);
    vec3 col = mix(vec3(1., .22, .02), vec3(1., .66, .22), smoothstep(.15, .8, body)); col = mix(col, vec3(1., .93, .75), smoothstep(.75, 1., body));
    gl_FragColor = vec4(col * body * uGain, body); }`;

/* ---------------- уютная комната: камин, ёлка, чай, окно в снег ---------------- */
export function buildRoom({ envMap, T_GLOW, rnd, LOW, santa = false }) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x070504);
  scene.fog = new THREE.Fog(0x120a06, 7, 16);
  const W = 8, D = 6, HT = 3.1;
  const logMat = new THREE.MeshStandardMaterial({ map: woodTex('#6b4024', '#3a1f0f', '#8a5a36'), roughness: .72, envMap, envMapIntensity: .25 }); logMat.map.repeat.set(2, 1);
  const darkWood = new THREE.MeshStandardMaterial({ map: woodTex('#4a2a16', '#25130a', '#6a4024'), roughness: .55, envMap, envMapIntensity: .35 });
  // пол, потолок, балки
  const pt = plankTex(); pt.repeat.set(2, 1.5); pt.rotation = Math.PI / 2;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: pt, roughness: .45, envMap, envMapIntensity: .3 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: pt, color: 0x8a6a50, roughness: .8 })); ceil.rotation.x = Math.PI / 2; ceil.position.y = HT; scene.add(ceil);
  for (let i = -3; i <= 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(.22, .24, D), darkWood); b.position.set(i * 1.25, HT - .12, 0); scene.add(b); }
  // бревенчатые стены (окно в задней стене справа)
  const logs = [], lg = new THREE.CylinderGeometry(.15, .15, 1, 14); lg.rotateZ(Math.PI / 2);
  const WIN = { x0: 1.55, x1: 3.15, y0: .95, y1: 2.3 };
  const logRow = (x0, x1, y, z, rotY) => logs.push({ x0, x1, y, z, rotY });
  for (let y = .15; y < HT; y += .28) {
    if (y > WIN.y0 - .1 && y < WIN.y1 + .1) { logRow(-W / 2, WIN.x0, y, -D / 2, 0); logRow(WIN.x1, W / 2, y, -D / 2, 0); } else logRow(-W / 2, W / 2, y, -D / 2, 0);
    logRow(-D / 2, D / 2, y, -W / 2, 1); logRow(-D / 2, D / 2, y, W / 2, -1);
  }
  const logIM = new THREE.InstancedMesh(lg, logMat, logs.length); const dm = new THREE.Object3D();
  logs.forEach((l, i) => { const len = l.x1 - l.x0, c = (l.x0 + l.x1) / 2; if (l.rotY) { dm.position.set(l.z, l.y, c); dm.rotation.set(0, Math.PI / 2, 0); } else { dm.position.set(c, l.y, l.z); dm.rotation.set(0, 0, 0); } dm.scale.set(len, 1 + (rnd() - .5) * .06, 1 + (rnd() - .5) * .06); dm.updateMatrix(); logIM.setMatrixAt(i, dm.matrix); });
  scene.add(logIM);
  // окно: рама, стекло с инеем, за ним ночь, ели и снег
  const frame = new THREE.Group(); scene.add(frame);
  const fw = WIN.x1 - WIN.x0, fh = WIN.y1 - WIN.y0, fx = (WIN.x0 + WIN.x1) / 2, fy = (WIN.y0 + WIN.y1) / 2;
  [[fw + .2, .12, fx, WIN.y0 - .02], [fw + .2, .12, fx, WIN.y1 + .02], [.06, fh, fx, fy]].forEach(([w, h, x, y]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, .22), darkWood); m.position.set(x, y, -D / 2 + .02); frame.add(m); });
  [WIN.x0 - .05, WIN.x1 + .05].forEach(x => { const m = new THREE.Mesh(new THREE.BoxGeometry(.12, fh + .2, .22), darkWood); m.position.set(x, fy, -D / 2 + .02); frame.add(m); });
  const sill = new THREE.Mesh(new THREE.BoxGeometry(fw + .5, .06, .4), darkWood); sill.position.set(fx, WIN.y0 - .08, -D / 2 + .16); scene.add(sill);
  const frost = canvasTex(256, 256, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, w * .25, w / 2, h / 2, w * .75); gr.addColorStop(0, 'rgba(230,240,255,0)'); gr.addColorStop(1, 'rgba(230,240,255,.75)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(240,248,255,.35)'; for (let i = 0; i < 70; i++) { const x = rnd() < .5 ? rnd() * w * .25 : w - rnd() * w * .25, y = rnd() * h; g.lineWidth = .6 + rnd(); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) g.lineTo(x + (rnd() - .5) * 40, y + (rnd() - .5) * 40); g.stroke(); } });
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), new THREE.MeshBasicMaterial({ map: frost, transparent: true, depthWrite: false, opacity: .8 })); pane.position.set(fx, fy, -D / 2 + .03); scene.add(pane);
  const outU = { uTime: { value: 0 } };
  const night = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.ShaderMaterial({ uniforms: outU, fog: false, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }', fragmentShader: 'varying vec2 vUv; void main(){ vec3 c = mix(vec3(.12,.16,.32), vec3(.015,.025,.07), smoothstep(.2,.95,vUv.y)); c += vec3(.25,.3,.5) * exp(-pow(length((vUv - vec2(.62,.72)) * vec2(1.6,1.)) * 6., 2.)) * .8; gl_FragColor = vec4(c, 1.); }' }));
  night.position.set(fx, 2, -D / 2 - 4); scene.add(night);
  const outG = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), snowMaterial({ color: 0x9fb2dc, spark: false })); outG.rotation.x = -Math.PI / 2; outG.position.set(fx, -.1, -D / 2 - 2.5); scene.add(outG);
  const outFir = new THREE.InstancedMesh(furFir({ seed: 5, snow: .7, tiers: 6, seg: 16 }), firMat(), 6); [[-1.2, -4.2, 1.2], [1.1, -5.2, 1.5], [2.6, -4.0, 1], [4.2, -5.5, 1.7], [.2, -6.3, 1.9], [3.4, -6.9, 2.2]].forEach(([x, z, s], i) => { dm.position.set(fx + x, -.1, z); dm.rotation.set(0, i, 0); dm.scale.setScalar(s); dm.updateMatrix(); outFir.setMatrixAt(i, dm.matrix); }); scene.add(outFir);
  const moonL = new THREE.DirectionalLight(0x9fb8ff, .9); moonL.position.set(fx + 3, 6, -10); moonL.target.position.set(fx, 0, -4); scene.add(moonL, moonL.target);
  const owU = { uTime: { value: 0 }, uScale: { value: 300 }, uSpin: { value: 0 }, uFloor: { value: 0 }, uTop: { value: 0 }, uBox: { value: 6 }, uMode: { value: 1 }, uC: { value: V3(fx, 1.6, -D / 2 - 2.2) }, uOpacity: { value: .9 }, ...SHAKE_U() };
  { const p = [], s = []; for (let i = 0; i < 500; i++) { p.push((rnd() - .5) * 20, (rnd() - .5) * 20, (rnd() - .5) * 20); s.push(rnd(), rnd(), .3 + rnd() * .4, .02 + rnd() * .03); } scene.add(pointCloud(p, s, owU, SNOW_F, SNOW_V)); }
  // камин
  const st = stoneTex(); st.repeat.set(1.4, 1.4);
  const stone = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map: st, bumpMap: st, bumpScale: 2, roughness: .9 }));
  const FX = -.7, FZ = -D / 2 + .38;
  const box = (w, h, d, x, y, z, m = stone.material) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); scene.add(b); return b; };
  box(.42, 1.35, .7, FX - .9, .675, FZ); box(.42, 1.35, .7, FX + .9, .675, FZ); box(2.24, .35, .7, FX, 1.18, FZ); box(1.4, 1.1, .1, FX, .55, FZ - .3, new THREE.MeshStandardMaterial({ color: 0x120a07, roughness: 1 }));
  box(1.7, HT - 1.35, .55, FX, 1.35 + (HT - 1.35) / 2, FZ - .07); box(2.6, .14, .9, FX, .07, FZ + .12);
  box(2.5, .1, .5, FX, 1.4, FZ + .08, darkWood);
  // дрова и огонь
  [[-.25, .14, .2], [.22, .14, -.25], [0, .3, 0]].forEach(([x, y, r]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(.08, .09, .9, 10), logMat); l.rotation.z = Math.PI / 2; l.rotation.y = r; l.position.set(FX + x * .5, y, FZ - .02); scene.add(l); });
  const flames = []; for (let i = 0; i < 4; i++) { const u = { uTime: { value: 0 }, uSeed: { value: i * 3.7 }, uGain: { value: 3.2 } }; const f = new THREE.Mesh(new THREE.PlaneGeometry(.75 - i * .08, .85 - i * .06), new THREE.ShaderMaterial({ uniforms: u, vertexShader: FLAME_V, fragmentShader: FLAME_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })); f.position.set(FX + (i - 1.5) * .12, .62 - i * .02, FZ - .02 + (i % 2 ? .05 : -.05)); f.rotation.y = (i - 1.5) * .5; scene.add(f); flames.push(u); }
  const fireGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: T_GLOW, color: 0xff8a3a, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending })); fireGlow.position.set(FX, .55, FZ + .1); fireGlow.scale.set(2.4, 1.8, 1); scene.add(fireGlow);
  const fireL = new THREE.PointLight(0xff9a4a, 9, 11, 1.7); fireL.position.set(FX, .7, FZ + .55); scene.add(fireL);
  const floorGlow = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 3.4), new THREE.MeshBasicMaterial({ map: T_GLOW, color: HDR(.55, .26, .08), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); floorGlow.rotation.x = -Math.PI / 2; floorGlow.position.set(FX, .02, FZ + 1.3); scene.add(floorGlow);
  // носки на камине и свечи
  const red = new THREE.MeshStandardMaterial({ color: 0xa82a33, roughness: .85 }), cream = new THREE.MeshStandardMaterial({ color: 0xf4ead8, roughness: .9 }), green = new THREE.MeshStandardMaterial({ color: 0x2f6b52, roughness: .85 });
  [-.75, 0, .75].forEach((x, i) => { const g = new THREE.Group(); g.position.set(FX + x, 1.3, FZ + .36); const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.075, .26, 4, 10), i === 1 ? green : red); leg.position.y = -.2; g.add(leg); const foot = new THREE.Mesh(new THREE.CapsuleGeometry(.07, .12, 4, 10), i === 1 ? green : red); foot.rotation.z = Math.PI / 2; foot.position.set(.08, -.36, 0); g.add(foot); const cuff = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .08, 14), cream); cuff.position.y = -.02; g.add(cuff); scene.add(g); });
  const candles = []; const candleM = new THREE.MeshStandardMaterial({ color: 0xf3e6cc, roughness: .5, emissive: 0x402510, emissiveIntensity: .4 });
  const candle = (x, y, z, h = .2) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(.035, .038, h, 14), candleM); c.position.set(x, y + h / 2, z); scene.add(c); const fl = new THREE.Mesh(new THREE.SphereGeometry(.018, 8, 8), new THREE.MeshBasicMaterial({ color: HDR(4, 2.4, 1) })); fl.scale.y = 1.8; fl.position.set(x, y + h + .03, z); scene.add(fl); const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: T_GLOW, color: 0xffb060, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending })); gl.position.copy(fl.position); gl.scale.set(.5, .5, 1); scene.add(gl); candles.push({ fl, gl, ph: rnd() * 6 }); };
  candle(FX - 1.05, 1.45, FZ + .1, .26); candle(FX - .9, 1.45, FZ + .12, .18); candle(FX + 1.0, 1.45, FZ + .1, .22);
  // гирлянда-лапник на полке камина
  const BULB = 260, bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), BULB); bulbs.count = 0; scene.add(bulbs); const bulbData = [];
  const PAL = [HDR(2.6, 1.7, .62), HDR(2.7, 1.95, .95), HDR(2.5, 1.1, .32), HDR(2.4, .62, .58), HDR(2.6, 2.25, 1.75)];
  const bulb = (p, s, c, grp) => { const i = bulbs.count++; dm.position.copy(p); dm.scale.setScalar(s); dm.rotation.set(0, 0, 0); dm.updateMatrix(); bulbs.setMatrixAt(i, dm.matrix); bulbs.setColorAt(i, c); bulbData.push({ c: c.clone(), ph: rnd() * 6.3, grp }); };
  const garlandFir = furFir({ seed: 9, snow: 0, tiers: 3, seg: 10, height: .5, radius: .2 });
  const gfIM = new THREE.InstancedMesh(garlandFir, firMat(), 14); for (let i = 0; i < 14; i++) { const t = i / 13; dm.position.set(FX - 1.15 + t * 2.3, 1.46, FZ + .26); dm.rotation.set(Math.PI / 2 - .3, 0, (rnd() - .5)); dm.scale.setScalar(.9 + rnd() * .4); dm.updateMatrix(); gfIM.setMatrixAt(i, dm.matrix); } scene.add(gfIM);
  for (let i = 0; i < 22; i++) bulb(V3(FX - 1.15 + i / 21 * 2.3, 1.42 - Math.sin(i / 21 * Math.PI * 3) * .03, FZ + .4), .022, PAL[i % 5], 'mantel');
  // окно: гирлянда по раме
  for (let i = 0; i < 26; i++) { const t = i / 25; bulb(V3(WIN.x0 - .1 + t * (fw + .2), WIN.y1 + .12 - Math.sin(t * Math.PI) * .12, -D / 2 + .16), .02, PAL[(i + 2) % 5], 'win'); }
  // ёлка в углу
  const TREE = V3(-3.0, 0, -1.9);
  const tree = new THREE.Mesh(furFir({ seed: 21, snow: 0, tiers: 9, seg: 26, height: 2.75, radius: 1.05, mid: [.06, .19, .13], tip: [.13, .32, .21] }), firMat()); tree.position.copy(TREE); scene.add(tree);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(.32, .38, .3, 20), new THREE.MeshStandardMaterial({ map: checkTex('#9a2a30', '#f1e3c4'), roughness: .8 })); stand.position.set(TREE.x, .15, TREE.z); scene.add(stand);
  const treeLights = []; for (let i = 0; i < 120; i++) { const k = i / 120, y = .45 + k * 2.2, rr = (1 - (y - .3) / 2.65) * 1.05 + .06, a = k * Math.PI * 2 * 8 + .4; bulb(V3(TREE.x + Math.cos(a) * rr, y, TREE.z + Math.sin(a) * rr), .028, PAL[i % 3 === 0 ? 4 : (i % 5 === 0 ? 2 : 0)], 'tree'); treeLights.push(bulbs.count - 1); }
  const starM = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb347, emissiveIntensity: .2, metalness: .6, roughness: .3, envMap });
  const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? .07 : .17, a = i / 10 * Math.PI * 2 + Math.PI / 2; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const sg = new THREE.ExtrudeGeometry(sh, { depth: .04, bevelEnabled: true, bevelThickness: .02, bevelSize: .02, bevelSegments: 2 }); sg.center();
  const star = new THREE.Mesh(sg, starM); star.position.set(TREE.x, 2.86, TREE.z); star.rotation.y = .6; scene.add(star);
  const starGl = new THREE.Sprite(new THREE.SpriteMaterial({ map: T_GLOW, color: 0xffcf7a, transparent: true, opacity: .1, depthWrite: false, blending: THREE.AdditiveBlending })); starGl.position.copy(star.position); starGl.scale.set(1.2, 1.2, 1); scene.add(starGl);
  // игрушки для «Укрась ёлку»: корзинка и места на ёлке
  const ornM = [0xb33a44, 0xd6ae66, 0x2c5f8a, 0xe9843a, 0xf4ead8, 0x2f6b52, 0xc04a7a, 0x9fc4e8].map(c => new THREE.MeshPhysicalMaterial({ color: c, metalness: .55, roughness: .16, clearcoat: 1, envMap, envMapIntensity: 1.8 }));
  const ornGeo = [new THREE.SphereGeometry(.085, 20, 14), new THREE.ConeGeometry(.06, .2, 12), new THREE.IcosahedronGeometry(.085, 0), new THREE.SphereGeometry(.075, 20, 14), new THREE.CapsuleGeometry(.045, .09, 4, 10), new THREE.OctahedronGeometry(.09), new THREE.SphereGeometry(.08, 20, 14), new THREE.ConeGeometry(.05, .24, 10)];
  const basket = new THREE.Mesh(new THREE.CylinderGeometry(.34, .26, .26, 20, 1, true), new THREE.MeshStandardMaterial({ map: checkTex('#a07a48', '#6a4a26'), roughness: .9, side: THREE.DoubleSide })); basket.position.set(TREE.x + 1.25, .13, TREE.z + 1.05); scene.add(basket);
  const SLOTS = [[.15, .7, .92], [-.5, .95, .72], [.62, 1.15, .5], [-.1, 1.35, .72], [.45, 1.6, .38], [-.42, 1.75, .38], [.1, 2.0, .38], [-.18, 2.25, .22]].map(([a, y, k]) => { const rr = (1 - (y - .3) / 2.65) * 1.05 * (k > .5 ? 1 : 1.05) + .02, ang = a * 1.6 + .9; return V3(TREE.x + Math.cos(ang) * rr, y, TREE.z + Math.sin(ang) * rr); });
  const orns = SLOTS.map((p, i) => { const m = new THREE.Mesh(ornGeo[i], ornM[i]); const home = V3(basket.position.x + (rnd() - .5) * .3, .26 + rnd() * .05, basket.position.z + (rnd() - .5) * .3); m.position.copy(home); m.rotation.set(rnd(), rnd(), rnd()); scene.add(m); const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: T_GLOW, color: 0xffe2a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); ring.position.copy(p).add(V3(0, 0, 0)); ring.scale.set(.32, .32, 1); scene.add(ring); return { m, home, slot: p, ring, done: false, fly: 0 }; });
  // столик с чаем
  const TX = .95, TZ = -.35;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, .05, 32), darkWood); top.position.set(TX, .68, TZ); scene.add(top);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(.05, .08, .66, 12), darkWood); leg.position.set(TX, .33, TZ); scene.add(leg);
  const cloth = new THREE.Mesh(new THREE.CylinderGeometry(.6, .66, .14, 32, 1, true), new THREE.MeshStandardMaterial({ map: checkTex('#f4ead8', '#b33a44'), roughness: .85, side: THREE.DoubleSide })); cloth.position.set(TX, .64, TZ); scene.add(cloth);
  const clothTop = new THREE.Mesh(new THREE.CircleGeometry(.6, 32), cloth.material); clothTop.rotation.x = -Math.PI / 2; clothTop.position.set(TX, .707, TZ); scene.add(clothTop);
  const porc = new THREE.MeshPhysicalMaterial({ color: 0xf6f1ea, roughness: .18, clearcoat: 1, envMap, envMapIntensity: 1 }), blue = new THREE.MeshPhysicalMaterial({ color: 0x2c4f8a, roughness: .2, clearcoat: 1, envMap });
  const pot = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [.07, 0], [.11, .03], [.125, .08], [.115, .13], [.08, .16], [.05, .17], [0, .17]].map(p => new THREE.Vector2(p[0], p[1])), 28), porc); pot.position.set(TX - .12, .71, TZ - .1); scene.add(pot);
  const band = new THREE.Mesh(new THREE.TorusGeometry(.124, .008, 6, 32), blue); band.rotation.x = Math.PI / 2; band.position.set(TX - .12, .79, TZ - .1); scene.add(band);
  const lid = new THREE.Mesh(new THREE.SphereGeometry(.05, 16, 8, 0, 6.3, 0, 1.4), blue); lid.position.set(TX - .12, .88, TZ - .1); scene.add(lid);
  const spout = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(.1, .06, 0), V3(.17, .1, 0), V3(.2, .16, 0)]), 8, .016, 8), porc); spout.position.set(TX - .12, .71, TZ - .1); scene.add(spout);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(.05, .012, 8, 16, Math.PI * 1.2), porc); handle.position.set(TX - .25, .8, TZ - .1); handle.rotation.z = Math.PI * .4; scene.add(handle);
  const steam = [];
  [[TX + .2, TZ + .08], [TX + .02, TZ + .25]].forEach(([x, z]) => { const cup = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [.035, 0], [.05, .01], [.055, .07], [.052, .07], [.045, .012], [0, .012]].map(p => new THREE.Vector2(p[0], p[1])), 24), porc); cup.position.set(x, .71, z); scene.add(cup); const tea = new THREE.Mesh(new THREE.CircleGeometry(.047, 20), new THREE.MeshStandardMaterial({ color: 0x6a2c0c, roughness: .1 })); tea.rotation.x = -Math.PI / 2; tea.position.set(x, .77, z); scene.add(tea); const sau = new THREE.Mesh(new THREE.CylinderGeometry(.08, .06, .01, 24), porc); sau.position.set(x, .712, z); scene.add(sau); for (let k = 0; k < 3; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: T_GLOW, color: 0xfff2e2, transparent: true, opacity: 0, depthWrite: false })); s.position.set(x, .8, z); s.scale.set(.12, .12, 1); scene.add(s); steam.push({ s, x, z, t: k / 3 }); } });
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(.13, .1, .015, 24), porc); plate.position.set(TX + .2, .715, TZ - .2); scene.add(plate);
  const mandM = new THREE.MeshStandardMaterial({ color: 0xf08a24, roughness: .55 }), cookieM = new THREE.MeshStandardMaterial({ color: 0xb06a32, roughness: .8 });
  [[.03, -.02], [-.05, .03], [.06, .05]].forEach(([x, z]) => { const m = new THREE.Mesh(new THREE.SphereGeometry(.042, 16, 12), mandM); m.scale.y = .86; m.position.set(TX + .2 + x, .758, TZ - .2 + z); scene.add(m); });
  [[-.06, -.06], [.0, -.09]].forEach(([x, z]) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .012, 16), cookieM); c.position.set(TX + .2 + x, .73, TZ - .2 + z); scene.add(c); });
  candle(TX - .3, .71, TZ + .2, .16);
  // кресло с пледом и ковёр
  const velvet = new THREE.MeshStandardMaterial({ color: 0x7a1e26, roughness: .9 });
  const chair = new THREE.Group(); chair.position.set(2.35, 0, -.7); chair.rotation.y = -.75; scene.add(chair);
  const rb = (w, h, d, x, y, z, m = velvet) => { const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(w, h, d) * .3), m); b.position.set(x, y, z); chair.add(b); return b; };
  rb(.9, .22, .8, 0, .42, 0); rb(.9, .75, .2, 0, .82, -.36); rb(.18, .45, .8, -.45, .55, 0); rb(.18, .45, .8, .45, .55, 0); rb(.82, .3, .7, 0, .16, 0, darkWood);
  rb(.6, .06, .55, .05, .56, .05, new THREE.MeshStandardMaterial({ map: checkTex('#2f5a48', '#e8cf9a'), roughness: .95 }));
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.5, 48), new THREE.MeshStandardMaterial({ map: rugTex(), roughness: .95 })); rug.rotation.x = -Math.PI / 2; rug.position.set(FX + .2, .012, FZ + 1.9); rug.scale.set(1.25, 1, 1); scene.add(rug);
  // свет комнаты
  scene.add(new THREE.HemisphereLight(0x6a5a70, 0x3a1e10, .6));
  const lampL = new THREE.PointLight(0xffc489, 2.2, 7, 1.6); lampL.position.set(TX, 2.1, TZ + .3); scene.add(lampL);
  const treeL = new THREE.PointLight(0xffb867, 2.2, 5, 1.8); treeL.position.set(TREE.x + .9, 1.4, TREE.z + .9); scene.add(treeL);
  // подвесной абажур
  const shade = new THREE.Mesh(new THREE.ConeGeometry(.32, .26, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xe8c48a, emissive: 0xffaa55, emissiveIntensity: .8, side: THREE.DoubleSide, roughness: .8 })); shade.position.set(TX, 2.35, TZ + .3); scene.add(shade);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .62, 6), darkWood); cord.position.set(TX, 2.79, TZ + .3); scene.add(cord);
  const lampB = new THREE.Mesh(new THREE.SphereGeometry(.06, 12, 10), new THREE.MeshBasicMaterial({ color: HDR(4, 3, 1.8) })); lampB.position.set(TX, 2.26, TZ + .3); scene.add(lampB);
  // мастерская Деда Мороза: верстак, игрушки, письма
  const letters = [];
  if (santa) {
    const wl = new THREE.PointLight(0xffc27a, 4, 6, 1.5); wl.position.set(2.6, 2.2, 1.0); scene.add(wl);
    const wb = new THREE.Mesh(new THREE.ConeGeometry(.22, .2, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0x2f6b52, emissive: 0xffaa55, emissiveIntensity: .25, side: THREE.DoubleSide })); wb.position.set(3.0, 2.35, 1.0); scene.add(wb); const wbb = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), new THREE.MeshBasicMaterial({ color: HDR(4, 3, 1.8) })); wbb.position.set(3.0, 2.27, 1.0); scene.add(wbb);
    const bench = new THREE.Group(); bench.position.set(3.35, 0, 1.0); bench.rotation.y = -Math.PI / 2; scene.add(bench);
    const bb = (w, h, d, x, y, z, m = darkWood) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); bench.add(b); return b; };
    bb(2.2, .08, .7, 0, .86, 0, logMat); [[-1, -.28], [1, -.28], [-1, .28], [1, .28]].forEach(([x, z]) => bb(.08, .86, .08, x, .43, z));
    bb(2.2, .05, .6, 0, .25, 0);
    const toyC = [0xb33a44, 0x2c5f8a, 0xd6ae66, 0x2f6b52, 0xe9843a];
    for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new RoundedBoxGeometry(.13, .13, .13, 2, .02), new THREE.MeshStandardMaterial({ color: toyC[i % 5], roughness: .5 })); c.position.set(-.8 + (i % 3) * .15, .97 + Math.floor(i / 3) * .14, .1 + (i % 2) * .03); c.rotation.y = rnd() * .5; bench.add(c); }
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .2, 24), new THREE.MeshStandardMaterial({ color: 0xb33a44, roughness: .4 })); drum.position.set(.1, 1.0, 0); bench.add(drum);
    [-.1, .1].forEach(y => { const r = new THREE.Mesh(new THREE.TorusGeometry(.162, .012, 6, 28), new THREE.MeshStandardMaterial({ color: 0xd6ae66, metalness: .8, roughness: .3 })); r.rotation.x = Math.PI / 2; r.position.set(.1, 1.0 + y, 0); bench.add(r); });
    const horse = new THREE.Group(); horse.position.set(.7, .9, .05); bench.add(horse); const hm = new THREE.MeshStandardMaterial({ color: 0xe9d2a8, roughness: .6 });
    const hb = new THREE.Mesh(new RoundedBoxGeometry(.32, .14, .12, 2, .04), hm); hb.position.y = .22; horse.add(hb); const hh = new THREE.Mesh(new RoundedBoxGeometry(.1, .2, .1, 2, .03), hm); hh.position.set(.17, .34, 0); hh.rotation.z = -.4; horse.add(hh);
    [[-.11, -.04], [.11, -.04], [-.11, .04], [.11, .04]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .16, 8), hm); l.position.set(x, .1, z); horse.add(l); });
    const rock = new THREE.Mesh(new THREE.TorusGeometry(.3, .02, 6, 24, Math.PI * .6), new THREE.MeshStandardMaterial({ color: 0xb33a44 })); rock.rotation.z = Math.PI * 1.2; rock.position.y = .3; horse.add(rock);
    // мешок с письмами
    const sack = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [.3, .02], [.38, .2], [.36, .45], [.24, .6], [.16, .66], [.2, .72], [0, .72]].map(p => new THREE.Vector2(p[0], p[1])), 24), new THREE.MeshStandardMaterial({ color: 0x9a7a52, roughness: 1 })); sack.position.set(2.7, 0, 2.0); scene.add(sack);
    const envT = canvasTex(128, 88, (g, w, h) => { g.fillStyle = '#f6efe0'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c9b48a'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(w / 2, h * .55); g.lineTo(w, 0); g.stroke(); g.fillStyle = '#b33a44'; g.beginPath(); g.arc(w / 2, h * .55, 9, 0, 7); g.fill(); g.fillStyle = '#5a7ab0'; g.fillRect(w - 26, 8, 16, 20); });
    const envM = new THREE.MeshStandardMaterial({ map: envT, roughness: .8, side: THREE.DoubleSide });
    for (let i = 0; i < 9; i++) { const e = new THREE.Mesh(new THREE.PlaneGeometry(.2, .14), envM); e.position.set(2.7 + (rnd() - .5) * .3, .62 + rnd() * .12, 2.0 + (rnd() - .5) * .3); e.rotation.set(-.6 + rnd() * .4, rnd() * 3, (rnd() - .5) * .8); scene.add(e); }
    // письма на столике — их можно читать
    for (let i = 0; i < 5; i++) { const e = new THREE.Mesh(new THREE.PlaneGeometry(.2, .14), envM); e.rotation.x = -Math.PI / 2; e.rotation.z = (rnd() - .5) * .9; e.position.set(TX - .25 + (i % 3) * .2, .713 + i * .002, TZ + .05 + Math.floor(i / 3) * .2 - .1); scene.add(e); const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: T_GLOW, color: 0xffd890, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); gl.position.copy(e.position).add(V3(0, .03, 0)); gl.scale.set(.32, .32, 1); scene.add(gl); letters.push({ m: e, gl, read: false }); }
    // очки и колпак Деда Мороза на кресле
    const hat = new THREE.Mesh(new THREE.ConeGeometry(.16, .4, 20), new THREE.MeshStandardMaterial({ color: 0xb02f3c, roughness: .8 })); hat.position.set(.05, .68, .05); hat.rotation.z = 1.1; chair.add(hat);
    const fur = new THREE.Mesh(new THREE.TorusGeometry(.15, .045, 8, 20), new THREE.MeshStandardMaterial({ color: 0xfbf6ee, roughness: 1 })); fur.position.set(-.13, .6, .05); fur.rotation.y = Math.PI / 2; fur.rotation.x = .45; chair.add(fur);
  }
  // позы камеры (в координатах комнаты)
  const poses = {
    room: { p: V3(.4, 1.62, 2.75), l: V3(-.5, 1.15, -1.6), fov: 56, fovP: 74 },
    fire: { p: V3(-.45, 1.2, 1.1), l: V3(-.7, .85, -2.6), fov: 50, fovP: 70 },
    tree: { p: V3(-1.35, 1.45, .75), l: V3(-3.0, 1.35, -1.9), fov: 52, fovP: 72 },
    table: { p: V3(1.75, 1.42, .95), l: V3(.92, .72, -.38), fov: 46, fovP: 66 },
    window: { p: V3(1.35, 1.55, .35), l: V3(2.35, 1.55, -3), fov: 52, fovP: 70 },
    bench: { p: V3(1.35, 1.55, 1.6), l: V3(3.3, .95, 1.0), fov: 52, fovP: 70 },
  };
  const tmpC = new THREE.Color(); let lit = 0;
  return {
    scene, poses, orns, letters, star, starGl, treeLights, bulbs, TREE,
    setLit(v) { lit = v; },
    update(dt, t) {
      flames.forEach(u => { u.uTime.value = t; });
      const fl = .82 + .1 * Math.sin(t * 11) + .07 * Math.sin(t * 23.3 + 1) + .05 * Math.sin(t * 5.1);
      fireL.intensity = 9 * fl; fireGlow.material.opacity = .45 * fl; floorGlow.material.color.setRGB(.55 * fl, .26 * fl, .08 * fl);
      candles.forEach(c => { const k = .85 + .15 * Math.sin(t * 9 + c.ph) * Math.sin(t * 3.3 + c.ph); c.gl.material.opacity = .5 * k; c.fl.scale.set(1, 1.8 * k, 1); });
      steam.forEach(s => { s.t = (s.t + dt * .25) % 1; s.s.position.set(s.x + Math.sin(t * 1.3 + s.t * 6) * .02, .8 + s.t * .35, s.z); s.s.material.opacity = Math.sin(s.t * Math.PI) * .16; const k = .1 + s.t * .16; s.s.scale.set(k, k, 1); });
      outU.uTime.value = t; owU.uTime.value = t; owU.uFall.value = t * .9; owU.uScale.value = 900;
      for (let i = 0; i < bulbData.length; i++) { const b = bulbData[i]; let lv = .85 + .15 * Math.sin(t * 2.2 + b.ph); if (b.grp === 'tree') lv *= .55 + .45 * lit; bulbs.setColorAt(i, tmpC.copy(b.c).multiplyScalar(lv)); }
      bulbs.instanceColor.needsUpdate = true;
      starM.emissiveIntensity = .2 + lit * 2.4; starGl.material.opacity = .08 + lit * .6; star.rotation.y = .6 + t * .5 * lit;
      orns.forEach(o => { if (o.fly > 0 && o.fly < 1) { o.fly = Math.min(1, o.fly + dt / .9); const e = ease(o.fly); o.m.position.lerpVectors(o.home, o.slot, e); o.m.position.y += Math.sin(e * Math.PI) * .45; o.m.rotation.y += dt * 8; } });
    }
  };
}

/* ================================================================= */
/* Каркас нового мира в шаре: полка → пролёт сквозь стекло → экскурсия по точкам → мини-игры */
export async function createGlobe(cfg, btn) {
  const Q = new URLSearchParams(location.search);
  const QL = quality(), LOW = QL.LOW, REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches || Q.get('rm') === '1';
  const TOUCH = matchMedia('(pointer: coarse)').matches, DEBUG = Q.has(cfg.debug);
  const store = window.ElkStore || (() => null);
  let seed = cfg.seed || 13; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const CORE = cfg.core, S = Math.sqrt(R * R - GROUND_Y * GROUND_Y) / CORE, hgt = cfg.hgt;

  /* ---------- DOM ---------- */
  const el = document.createElement('div'); el.className = 'rk gk' + (TOUCH ? ' touch' : ''); el.id = cfg.id;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', cfg.aria);
  el.innerHTML = `
  <canvas class="rk-cv" tabindex="0" aria-label="${cfg.aria}"></canvas>
  <div class="rk-vign" aria-hidden="true"></div>
  <div class="rk-flash" aria-hidden="true"></div>
  <header class="rk-bar">
    <h2 class="rk-title"><small>Снежный шар</small>${cfg.title}</h2>
    <p class="rk-hud" aria-live="polite"><span class="gk-hud"></span></p>
    <button class="rk-btn rk-shake" type="button" aria-label="Встряхнуть шар">${SHAKE_ICON}<span>Встряхнуть</span></button>
    <button class="rk-btn rk-snd" type="button" aria-pressed="false" aria-label="Звук: включить"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path class="on" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path class="off" d="M16.5 9.5l5 5M21.5 9.5l-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
    <button class="rk-btn rk-close" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Выйти из шара</span></button>
  </header>
  <p class="rk-place" aria-live="polite"><b></b><span></span></p>
  <p class="rk-hint" aria-live="polite"></p>
  <div class="gk-acts"><button class="rk-stars gk-act" type="button" hidden></button><button class="rk-out gk-act2" type="button" hidden></button></div>
  <div class="gk-choices" hidden><p></p><div></div></div>
  <div class="rk-pops" aria-hidden="true"></div>
  <div class="rk-card" hidden><div class="rk-card-in"><svg class="rk-mark" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 0c.6 5.4 4.6 9.4 10 10-5.4.6-9.4 4.6-10 10-.6-5.4-4.6-9.4-10-10C5.4 9.4 9.4 5.4 10 0Z"/></svg><h3></h3><p></p><div class="rk-acts"><button class="rk-go" type="button"></button><button class="rk-out gk-cout" type="button">Гулять дальше</button></div></div></div>
  <div class="rk-load"><span>Снимаем шар с полки…</span></div>`;
  document.body.appendChild(el); document.body.style.overflow = 'hidden';
  const $ = s => el.querySelector(s);
  const cv = $('.rk-cv'), flash = $('.rk-flash'), card = $('.rk-card'), pops = $('.rk-pops'), hint = $('.rk-hint'), placeEl = $('.rk-place'), hudEl = $('.gk-hud');
  const actBtn = $('.gk-act'), act2Btn = $('.gk-act2'), choicesEl = $('.gk-choices');
  requestAnimationFrame(() => el.classList.add('on'));

  /* ---------- renderer ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: DEBUG });
  let DPR = QL.dpr; renderer.setPixelRatio(DPR);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = cfg.exposure || 1;
  renderer.shadowMap.enabled = !LOW; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, .01, 600); scene.add(camera);
  const FOG_COL = new THREE.Color(cfg.fog || 0x2a3358); scene.fog = new THREE.FogExp2(FOG_COL, 0);
  const pmrem = new THREE.PMREMGenerator(renderer); const envMap = makeEnv(pmrem);
  const T_GLOW = glowTex();
  const shelf = await buildShelf(scene, envMap, { label: cfg.label, LOW, T_GLOW, rnd, ornaments: cfg.ornaments });
  const hemi = new THREE.HemisphereLight(cfg.hemi || 0x7084c0, 0x1a1210, .3); scene.add(hemi);
  const moon = new THREE.DirectionalLight(cfg.moonCol || 0xb9c9ff, .55); moon.position.set(-5, 14, 7); scene.add(moon, moon.target);
  moon.castShadow = !LOW; moon.shadow.mapSize.set(2048, 2048); moon.shadow.bias = -.0003; moon.shadow.normalBias = .01; moon.shadow.radius = 3;

  /* ---------- мир внутри ---------- */
  const world = new THREE.Group(); world.position.y = GROUND_Y; world.scale.setScalar(S); scene.add(world);
  const beyond = new THREE.Group(); world.add(beyond); beyond.visible = false;
  const inner = new THREE.Group(); world.add(inner); inner.visible = false;
  const skyU = { uTime: { value: 0 }, uAur: { value: cfg.aurora || 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(CORE * 3.4, 64, 32), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform float uTime, uAur; varying vec3 vP;
      float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float nn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }
      void main(){ vec3 d = normalize(vP); float h = d.y;
        vec3 c = mix(vec3(.085,.11,.22), vec3(.008,.014,.045), smoothstep(-.02,.6,h));
        c += vec3(.34,.2,.1) * pow(max(0., 1. - abs(h - .02) * 5.), 3.) * .3;
        c += vec3(.5,.36,.2) * pow(max(0., dot(d, normalize(vec3(-.3,.85,.4)))), 30.) * .2;
        if (uAur > 0.) { vec2 p = d.xz / (h + .3); float a = 0.;
          for (int i = 0; i < 3; i++) { float fi = float(i); float y = p.y * 1.1 + sin(p.x * 1.2 + uTime * .12 + fi * 2.1) * .55 + fi * .55 - .9; float cur = .55 + .45 * nn(vec2(p.x * 14. + fi * 7., uTime * .3)); a += exp(-y * y * 7.) * cur * (.6 + .4 * sin(p.x * 3. + uTime * .35 + fi)); }
          a *= smoothstep(.04, .25, h) * smoothstep(.98, .45, h);
          c += mix(vec3(.12, 1., .58), vec3(.55, .32, 1.), smoothstep(.25, .75, h)) * a * .32 * uAur; }
        gl_FragColor = vec4(c, 1.); }`
  })); sky.renderOrder = -9; inner.add(sky);
  const starU = { uTime: { value: 0 }, uScale: { value: 300 }, uOpacity: { value: 1 }, uGain: { value: 1.5 }, uColor: { value: HDR(1, .95, .85) } };
  { const n = LOW ? 450 : 1100, p = [], s = [], Rs = CORE * 3.2; for (let i = 0; i < n; i++) { const u = rnd() * Math.PI * 2, y = .07 + Math.pow(rnd(), .8) * .93, rr = Math.sqrt(1 - y * y); p.push(Math.cos(u) * rr * Rs, y * Rs, Math.sin(u) * rr * Rs); s.push(.6 + rnd() * 2.2, rnd() * 6.3, 1 + rnd() * 3, rnd() < .06 ? 3.6 : 1 + rnd() * 1.6); } const st = pointCloud(p, s, starU); st.renderOrder = -8; inner.add(st); }
  const moonPos = V3(-.37, .58, -.58).multiplyScalar(CORE * 3);
  const moonSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: T_GLOW, color: 0xdfe8ff, transparent: true, opacity: .85, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); moonSp.position.copy(moonPos); moonSp.scale.setScalar(CORE * .7); inner.add(moonSp);
  const moonD = new THREE.Mesh(new THREE.CircleGeometry(CORE * .075, 32), new THREE.MeshBasicMaterial({ color: HDR(2.2, 2.25, 2.4), fog: false })); moonD.position.copy(moonPos); moonD.lookAt(0, 0, 0); inner.add(moonD);
  const lSnowU = { uTime: { value: 0 }, uScale: { value: 300 }, uSpin: { value: 0 }, uFloor: { value: 0 }, uTop: { value: 0 }, uBox: { value: 34 }, uMode: { value: 1 }, uC: { value: V3() }, uOpacity: { value: 1 }, ...SHAKE_U() };
  { const n = LOW ? 1000 : 2600, p = [], s = []; for (let i = 0; i < n; i++) { p.push((rnd() - .5) * 20, (rnd() - .5) * 20, (rnd() - .5) * 20); s.push(rnd(), rnd(), .25 + rnd() * .4, .016 + rnd() * rnd() * .05); } const sn = pointCloud(p, s, lSnowU, SNOW_F, SNOW_V); sn.renderOrder = 5; inner.add(sn); }
  // земля ядра (видна и снаружи) и дальние холмы (только изнутри)
  function terrainRing(r0, r1, segT, segR, pw, colorFn) {
    const pos = [], idx = [], col = [], uv = [];
    for (let j = 0; j <= segR; j++) { const r = r0 + (r1 - r0) * Math.pow(j / segR, pw); for (let i = 0; i <= segT; i++) { const a = i / segT * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r; pos.push(x, hgt(x, z), z); uv.push(x * .08, z * .08); col.push(...(colorFn ? colorFn(x, z) : [1, 1, 1])); } }
    for (let j = 0; j < segR; j++) for (let i = 0; i < segT; i++) { const a = j * (segT + 1) + i, b = a + segT + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return orient(g, true);
  }
  const groundMat = snowMaterial({ vertexColors: true, sparkScale: 40, repeat: 6 });
  const ground = new THREE.Mesh(terrainRing(.01, CORE, LOW ? 120 : 200, LOW ? 50 : 80, 1.15, cfg.groundColor), groundMat); ground.receiveShadow = true; world.add(ground);
  const far = new THREE.Mesh(terrainRing(CORE - .6, CORE * 3.3, LOW ? 120 : 220, LOW ? 34 : 60, 1.4, (x, z) => { const v = .92 + .08 * fbm(x * .05, z * .05, 3); return [v * .94, v * .97, v * 1.04]; }), snowMaterial({ vertexColors: true, spark: false, color: 0xe2e9f8 })); beyond.add(far);
  // общие помощники
  const dm = new THREE.Object3D();
  const BULB_MAX = 1400, bulbData = [];
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), BULB_MAX); bulbs.count = 0; bulbs.frustumCulled = false; world.add(bulbs);
  const PAL = [HDR(2.6, 1.7, .62), HDR(2.7, 1.95, .95), HDR(2.5, 1.1, .32), HDR(2.4, .62, .58), HDR(2.6, 2.25, 1.75)];
  const bulb = (p, size, col) => { if (bulbs.count >= BULB_MAX) return; const i = bulbs.count++; dm.position.copy(p); dm.scale.setScalar(size); dm.rotation.set(0, 0, 0); dm.updateMatrix(); bulbs.setMatrixAt(i, dm.matrix); bulbs.setColorAt(i, col); bulbData.push({ c: col.clone(), ph: rnd() * 6.3 }); };
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x1c2232, metalness: .7, roughness: .4, envMap, envMapIntensity: .6 });
  const lamps = [];
  function pool(x, z, s, col, y) { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: T_GLOW, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.rotation.x = -Math.PI / 2; m.position.set(x, (y !== undefined ? y : hgt(x, z)) + .07, z); world.add(m); return m; }
  function lamp(x, z, h = 3.2, withLight = false) {
    const y0 = hgt(x, z), lg = new THREE.Group(); lg.position.set(x, y0, z); world.add(lg);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.06, .1, h, 8), ironMat); post.position.y = h / 2; post.castShadow = true; lg.add(post);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(.28, .26, 6), ironMat); cap.position.y = h + .5; lg.add(cap);
    const sc = new THREE.Mesh(new THREE.SphereGeometry(.22, 10, 6, 0, 6.3, 0, 1.2), shelfSnow); sc.position.y = h + .53; lg.add(sc);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.15, 12, 10), new THREE.MeshBasicMaterial({ color: HDR(4, 2.7, 1.3) })); head.position.y = h + .2; lg.add(head);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: T_GLOW, color: 0xffc77a, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.set(2.4, 2.4, 1); gl.position.y = h + .2; lg.add(gl); lamps.push(gl);
    if (withLight) { const pl = new THREE.PointLight(0xffb867, 1.6, 14 * S, 1.6); pl.position.set(x * S, GROUND_Y + (y0 + h) * S, z * S); scene.add(pl); }
    pool(x, z, 6, HDR(.42, .27, .1)); return V3(x, y0 + h + .35, z);
  }
  const shelfSnow = snowMaterial({ spark: false });
  const wireMat = new THREE.LineBasicMaterial({ color: 0x141a24, transparent: true, opacity: .75 });
  function garland(A, B, sag, n, size = .07) { const pts = []; for (let k = 0; k <= 20; k++) { const t = k / 20; pts.push(A.clone().lerp(B, t).add(V3(0, -sag * 4 * t * (1 - t), 0))); } world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat)); for (let k = 1; k < n; k++) { const t = k / n; bulb(A.clone().lerp(B, t).add(V3(0, -sag * 4 * t * (1 - t) - .07, 0)), size, PAL[k % 7 === 3 ? 3 : (k % 4 === 0 ? 2 : (k % 3 ? 0 : 4))]); } }
  // искры
  const SP = 320, spPos = new Float32Array(SP * 3), spVel = new Float32Array(SP * 3), spLife = new Float32Array(SP), spSeed = new Float32Array(SP * 4); let spI = 0;
  for (let i = 0; i < SP; i++) spSeed.set([18, rnd() * 6, 1, 0], i * 4);
  const spU = { uTime: { value: 0 }, uScale: { value: 300 }, uOpacity: { value: 1 }, uGain: { value: 3 }, uColor: { value: HDR(1, .8, .45) } };
  const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3)); spGeo.setAttribute('aSeed', new THREE.BufferAttribute(spSeed, 4));
  const sparks = new THREE.Points(spGeo, new THREE.ShaderMaterial({ uniforms: spU, vertexShader: TW_V, fragmentShader: TW_F, transparent: true, depthWrite: false, fog: false })); sparks.frustumCulled = false; sparks.renderOrder = 7;
  function burst(p, n, sp = 3, up = 1) { for (let k = 0; k < n; k++) { const i = spI++ % SP; spPos.set([p.x, p.y, p.z], i * 3); const a = rnd() * 6.283, b = rnd() * 3.14; spVel.set([Math.cos(a) * Math.sin(b) * sp, Math.abs(Math.cos(b)) * sp * up + .6, Math.sin(a) * Math.sin(b) * sp], i * 3); spLife[i] = .8 + rnd() * .9; } }

  /* ---------- пост-обработка ---------- */
  const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: LOW ? 0 : 4 });
  const composer = new EffectComposer(renderer, rt); const rpass = new RenderPass(scene, camera); composer.addPass(rpass);
  composer.addPass(sanitizePass()); const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .6, .5, .85); bloom.enabled = QL.bloom; composer.addPass(bloom);
  composer.addPass(new OutputPass()); const grade = gradePass(); composer.addPass(grade);
  const bokeh = makeBokeh(camera, { n: LOW ? 10 : 18, unit: S * 6 }); bokeh.visible = false;

  /* ---------- звук ---------- */
  const A = makeAudio(store, $('.rk-snd'));

  /* ---------- UI ---------- */
  function showCard(h, p, go, f, outLabel, outF) { card.querySelector('h3').textContent = h; card.querySelector('p').innerHTML = p; $('.rk-go').textContent = go; card._go = f; card._out = outF; $('.gk-cout').textContent = outLabel || 'Гулять дальше'; card.hidden = false; requestAnimationFrame(() => card.classList.add('on')); setTimeout(() => $('.rk-go').focus({ preventScroll: true }), 50); }
  function hideCard() { card.classList.remove('on'); setTimeout(() => { card.hidden = true; }, 350); }
  $('.rk-go').addEventListener('click', () => { const f = card._go; hideCard(); f && f(); });
  $('.gk-cout').addEventListener('click', () => { const f = card._out; hideCard(); f && f(); });
  function showPlace(name, text) { placeEl.querySelector('b').textContent = name; placeEl.querySelector('span').textContent = text; placeEl.classList.remove('on'); void placeEl.offsetWidth; placeEl.classList.add('on'); clearTimeout(showPlace.t); showPlace.t = setTimeout(() => placeEl.classList.remove('on'), 4600); }
  function setHint(t, ms) { hint.textContent = t; hint.classList.toggle('on', !!t); clearTimeout(setHint.t); if (ms) setHint.t = setTimeout(() => hint.classList.remove('on'), ms); }
  function pop(text, p, cls) { const v = p.clone().project(camera); const d = document.createElement('span'); d.className = 'rk-pop ' + (cls || ''); d.textContent = text; d.style.left = ((v.x + 1) / 2 * 100) + '%'; d.style.top = ((1 - v.y) / 2 * 100) + '%'; pops.appendChild(d); setTimeout(() => d.remove(), 1300); }
  function setAct(b, label, f) { if (!label) { b.hidden = true; b._f = null; return; } b.textContent = label; b._f = f; b.hidden = false; }
  actBtn.addEventListener('click', () => actBtn._f && actBtn._f()); act2Btn.addEventListener('click', () => act2Btn._f && act2Btn._f());
  function choices(title, opts) { if (!opts) { choicesEl.hidden = true; el.classList.remove('choosing'); return; } choicesEl.querySelector('p').textContent = title; const box = choicesEl.querySelector('div'); box.innerHTML = ''; opts.forEach(o => { const b = document.createElement('button'); b.type = 'button'; b.className = 'gk-ch'; b.innerHTML = (o.sw ? `<i style="background:${o.sw}"></i>` : '') + o.label; b.addEventListener('click', () => { A.init(); o.f(); }); box.appendChild(b); }); choicesEl.hidden = false; el.classList.add('choosing'); }
  const setHud = t => { hudEl.textContent = t || ''; el.classList.toggle('playing', !!t); };

  /* ---------- камера, экскурсия ---------- */
  let W = 1, Hh = 1, aspect = 1;
  const PORTRAIT = () => aspect < .8;
  const toScene = v => V3(v.x * S, GROUND_Y + v.y * S, v.z * S), toLocal = v => V3(v.x / S, (v.y - GROUND_Y) / S, v.z / S);
  function outsidePose() { const fov = 30, t = Math.tan(fov * Math.PI / 360); const dist = Math.max(46, 12.5 / (t * aspect), 15.5 / t); return { p: V3(0, 13, dist), l: V3(0, -3.2, 0), fov }; }
  const cam = { p: V3(), l: V3(), fov: 30 }; let space = 'shelf';      // shelf | world | room
  const ctx = { THREE, pointCloud, scene, world, beyond, inner, envMap, T_GLOW, LOW, QL, S, CORE, hgt, rnd, dm, bulb, PAL, lamp, garland, pool, burst, ironMat, shelfSnow, snowMaterial, furFir, firMat, camera, el, $, A, showCard, hideCard, showPlace, setHint, pop, setAct, actBtn, act2Btn, choices, setHud, toScene, toLocal, store, TOUCH, REDUCE, taps: [], time: 0, rooms: {}, groundMat };
  ctx.addRoom = (name, room) => { ctx.rooms[name] = room; room.scene.add(new THREE.Object3D()); return room; };
  ctx.poseOf = (pt) => { const c = pt.cam; const fov = PORTRAIT() ? (c.fovP || c.fov * 1.3 || 70) : (c.fov || 50); let p = c.p.clone(), l = c.l.clone(); if (PORTRAIT() && c.backP) p.add(p.clone().sub(l).multiplyScalar(c.backP)); return { p, l, fov }; };
  const built = await cfg.build(ctx);
  const TOUR = built.tour;
  world.add(sparks);
  let glide = null, drift = { x: 0, y: 0 }, look = { yaw: 0, pitch: 0, ty: 0, tp: 0 };
  function setSpace(s) {
    if (space === s) return; space = s;
    const room = s.startsWith('room:') ? ctx.rooms[s.slice(5)] : null;
    rpass.scene = room ? room.scene : scene; (room ? room.scene : scene).add(camera);
    camera.near = room ? .03 : .01; camera.far = room ? 60 : 600;
    bokeh.unit = room ? 1 : S * 6;
  }
  const tour = makeTour(el, cv, { count: () => TOUR.length, label: i => TOUR[Math.max(0, i)].name, onGo: (i, user) => goPoint(i, user) });
  tour.nav.classList.add('off');
  function goPoint(i, user) {
    const pt = TOUR[i]; if (G.mode !== 'tour') return; A.init();
    endGameIf(); setAct(actBtn); setAct(act2Btn); choices(null);
    const target = ctx.poseOf(pt), sp = pt.room ? 'room:' + pt.room : 'world';
    look.ty = look.tp = 0;
    if (sp !== space || REDUCE) { // в другое пространство — мягкая смена кадра
      el.classList.add('fade'); A.chime([988, 1319], .03, 1);
      setTimeout(() => { setSpace(sp); Object.assign(cam, { p: target.p.clone(), l: target.l.clone(), fov: target.fov }); glide = null; el.classList.remove('fade'); arriveAt(pt); }, 420);
      return;
    }
    const from = { p: cam.p.clone(), l: cam.l.clone(), fov: cam.fov }, d = from.p.distanceTo(target.p);
    const mid = from.p.clone().lerp(target.p, .5); mid.y += d * (pt.room ? .05 : .22);
    glide = { from, to: target, mid, t: 0, dur: clamp(1.6 + d / (pt.room ? 2.5 : 14), 1.8, 4.2), pt };
    if (user) A.chime([1319 + i * 40], .025, .9);
  }
  function arriveAt(pt) {
    if (pt.name && !pt.quiet) showPlace(pt.name, pt.text || '');
    if (pt.act) setAct(actBtn, pt.act[0], pt.act[1]); else setAct(actBtn);
    if (pt.act2) setAct(act2Btn, pt.act2[0], pt.act2[1]); else setAct(act2Btn);
    pt.onArrive && pt.onArrive();
  }
  ctx.tour = tour; ctx.goTo = id => { const i = TOUR.findIndex(p => p.id === id); if (i >= 0) tour.go(i); };
  ctx.camTo = (pose, dur = 1.6) => { glide = { from: { p: cam.p.clone(), l: cam.l.clone(), fov: cam.fov }, to: pose, mid: cam.p.clone().lerp(pose.p, .5), t: 0, dur, pt: null }; };
  ctx.inRoom = () => space.startsWith('room:');
  let endGameIf = () => { built.endGame && built.endGame(true); };

  /* ---------- ввод: касание — по целям, лёгкий осмотр перетаскиванием ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); ctx.ray = ray;
  let drag = null;
  cv.addEventListener('pointerdown', e => { A.init(); if (A.on && A.ctx) A.ctx.resume(); drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, id: e.pointerId }; });
  cv.addEventListener('pointermove', e => { if (!drag || drag.id !== e.pointerId) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 8) drag.moved = true; if (drag.moved && e.pointerType !== 'touch') { look.ty = clamp(look.ty - dx * .003, -.5, .5); look.tp = clamp(look.tp + dy * .002, -.25, .25); } });
  cv.addEventListener('pointerup', e => { if (!drag || drag.id !== e.pointerId) return; const moved = drag.moved; drag = null; if (moved || (tour.swiped && performance.now() - tour.swiped < 50)) return; tapAt(e.clientX, e.clientY); });
  function tapAt(x, y) {
    if (G.mode !== 'tour') return;
    const r = cv.getBoundingClientRect(); ndc.set((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, camera);
    // крупные цели: ближайшая к пальцу в радиусе ~70 px
    let best = null, bd = 1e9;
    ctx.taps.forEach(t => { if (!t.on || !t.on()) return; const v = t.pos().clone().project(camera); if (v.z > 1) return; const sx = (v.x + 1) / 2 * r.width, sy = (1 - v.y) / 2 * r.height, d = Math.hypot(sx - (x - r.left), sy - (y - r.top)); const lim = (t.r || 70) * (TOUCH ? 1.15 : 1); if (d < lim && d < bd) { bd = d; best = t; } });
    if (best) best.f(); else built.tap && built.tap(ray);
  }
  addEventListener('keydown', kd); function kd(e) { if (e.key === 'Escape') { if (!card.hidden) hideCard(); else exit(); return; } if (G.mode !== 'tour' || (e.target && e.target.closest && e.target.closest('button') && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return; if (e.key === 'ArrowRight') { e.preventDefault(); tour.next(); } if (e.key === 'ArrowLeft') { e.preventDefault(); tour.prev(); } }
  $('.rk-close').addEventListener('click', () => exit());
  const SH = makeShake(REDUCE); let spinV = 2.6;
  const unShake = bindShake($('.rk-shake'), p => { SH.kick(p); if (!REDUCE) spinV += 2.2 * p; A.chime([2093, 2637, 3136, 2349], .03, 1.6, .07); built.onShake && built.onShake(p); });

  /* ---------- пролёт ---------- */
  const G = { mode: 'load' }; ctx.G = G;
  let fly = null;
  function makeFlight(rev) {
    const o = outsidePose(), t0 = ctx.poseOf(TOUR[0]);
    const P = [toLocal(o.p), toLocal(V3(0, 5.2, 14)), toLocal(V3(0, 1.6, 8.6)), V3(0, CORE * .32, CORE * .62), t0.p.clone().add(V3(0, CORE * .08, CORE * .12)), t0.p];
    const L = [toLocal(o.l), toLocal(V3(0, -2.4, 0)), V3(0, 0, -CORE * .1), V3(0, 1, -CORE * .05), t0.l.clone().lerp(t0.p, .3), t0.l];
    return { pc: new THREE.CatmullRomCurve3(P, false, 'centripetal'), lc: new THREE.CatmullRomCurve3(L, false, 'centripetal'), f0: o.fov, f1: t0.fov, t: rev ? 1 : 0, dur: 4.4, rev };
  }
  function enter() { G.mode = 'fly'; space = 'world'; if (REDUCE) { el.classList.add('fade'); setTimeout(() => { Object.assign(cam, ctx.poseOf(TOUR[0])); el.classList.remove('fade'); arrive(); }, 450); return; } A.whoosh(true); fly = makeFlight(false); }
  function arrive() { G.mode = 'tour'; el.classList.add('touring'); tour.nav.classList.remove('off'); tour.i = 0; tour.draw(); arriveAt(TOUR[0]); A.chime([1047, 1319, 1568, 2093], .035, 2.2, .14); setTimeout(() => setHint(TOUCH ? 'Стрелки внизу или свайп — следующее место. Касание — играть' : 'Стрелки ‹ › внизу или на клавиатуре — следующее место. Клик — играть', 6500), 1400); built.onArrive && built.onArrive(); }
  let exiting = false;
  function exit() {
    if (exiting) return; exiting = true; endGameIf(); hideCard(); choices(null); setAct(actBtn); setAct(act2Btn); el.classList.remove('touring'); tour.nav.classList.add('off');
    if (REDUCE || G.mode === 'load' || G.mode === 'outside') return finish();
    if (space !== 'world') setSpace('world');
    G.mode = 'fly'; A.whoosh(false); fly = makeFlight(true); fly.p0 = cam.p.clone();
  }
  function finish() { el.classList.remove('on'); setTimeout(() => { cancelAnimationFrame(raf); removeEventListener('resize', resize); removeEventListener('keydown', kd); unShake(); scene.traverse(o => { o.geometry && o.geometry.dispose(); }); Object.values(ctx.rooms).forEach(r => r.scene.traverse(o => { o.geometry && o.geometry.dispose(); })); renderer.dispose(); pmrem.dispose(); rt.dispose(); el.remove(); document.body.style.overflow = ''; A.ctx && A.ctx.close(); if (btn) btn.focus({ preventScroll: true }); }, 520); }

  function resize() { W = innerWidth; Hh = innerHeight; aspect = W / Hh; renderer.setSize(W, Hh, false); composer.setSize(W, Hh); bloom.resolution.set(W * DPR * (LOW ? .4 : .6), Hh * DPR * (LOW ? .4 : .6)); if (G.mode === 'tour' && !glide && tour.i >= 0) { const t = ctx.poseOf(TOUR[tour.i]); Object.assign(cam, { p: t.p, l: t.l, fov: t.fov }); } }
  resize(); addEventListener('resize', resize);

  /* ---------- кадр ---------- */
  let raf = 0, last = performance.now(), time = 0; const tmpC = new THREE.Color();
  const Q_ = { n: 0, acc: 0, step: 0 };
  function adapt(ms) { if (G.mode !== 'tour' || Q_.step >= 3) return; Q_.acc += ms; if (++Q_.n < 90) return; const avg = Q_.acc / Q_.n; Q_.n = 0; Q_.acc = 0; if (avg < 21) return; Q_.step++; if (Q_.step === 1) { DPR = Math.max(1, DPR * .75); } else if (Q_.step === 2) { renderer.shadowMap.enabled = false; moon.castShadow = false; bloom.resolution.multiplyScalar(.6); } else { DPR = 1; bloom.enabled = false; } renderer.setPixelRatio(DPR); composer.setPixelRatio(DPR); resize(); }
  function frame(now) { raf = requestAnimationFrame(frame); const ms = now - last, dt = Math.min(.05, ms / 1000); last = now; adapt(ms); tick(dt); composer.render(); }
  const camT = { p: V3(), l: V3() };
  function tick(dt) {
    time += dt; ctx.time = time;
    if (fly) {
      fly.t += (fly.rev ? -dt : dt) / fly.dur; const k = clamp(fly.t, 0, 1), e = ease(k);
      cam.p.copy(fly.pc.getPoint(e)); cam.l.copy(fly.lc.getPoint(e)); cam.fov = fly.f0 + (fly.f1 - fly.f0) * smooth(.3, 1, e);
      if (fly.rev && fly.p0) cam.p.lerp(fly.p0, smooth(.8, 1, k) * 0);
      if (!fly.rev && fly.t >= 1) { fly = null; arrive(); } else if (fly && fly.rev && fly.t <= 0) { fly = null; G.mode = 'shelf'; setTimeout(finish, 700); }
    } else if (G.mode === 'outside' || G.mode === 'shelf' || G.mode === 'load') { const o = outsidePose(); cam.p.copy(o.p).add(V3(Math.sin(time * .25) * .8, Math.sin(time * .2) * .3, 0)); cam.l.copy(o.l); cam.fov = o.fov; }
    else if (glide) {
      glide.t += dt / glide.dur; const e = ease(clamp(glide.t, 0, 1)), u = 1 - e;
      cam.p.copy(glide.from.p).multiplyScalar(u * u).addScaledVector(glide.mid, 2 * u * e).addScaledVector(glide.to.p, e * e);
      cam.l.lerpVectors(glide.from.l, glide.to.l, e); cam.fov = glide.from.fov + (glide.to.fov - glide.from.fov) * e;
      if (glide.t >= 1) { const pt = glide.pt; glide = null; if (pt) arriveAt(pt); }
    }
    // «дыхание» камеры и лёгкий осмотр
    look.yaw += (look.ty - look.yaw) * (1 - Math.pow(.02, dt)); look.pitch += (look.tp - look.pitch) * (1 - Math.pow(.02, dt));
    camT.p.copy(cam.p); camT.l.copy(cam.l);
    if (G.mode === 'tour' && !REDUCE) { const s = space === 'world' ? CORE * .004 : .03; camT.p.x += Math.sin(time * .31) * s; camT.p.y += Math.sin(time * .23) * s * .5; }
    if (look.yaw || look.pitch) { const d = camT.l.clone().sub(camT.p); d.applyAxisAngle(V3(0, 1, 0), look.yaw); d.y += look.pitch * d.length(); camT.l.copy(camT.p).add(d); }
    const room = space.startsWith('room:');
    if (room) { camera.position.copy(camT.p); camera.lookAt(camT.l); }
    else if (space === 'world' && G.mode !== 'shelf' && G.mode !== 'load' && G.mode !== 'outside') { camera.position.copy(toScene(camT.p)); camera.lookAt(toScene(camT.l)); }
    else { camera.position.copy(camT.p); camera.lookAt(camT.l); }
    camera.fov = cam.fov; camera.aspect = aspect; camera.updateProjectionMatrix();
    const inside = !room && camera.position.length() < R - .05, camL = toLocal(camera.position);
    if (shelf.outside.visible === inside) { shelf.outside.visible = !inside; beyond.visible = inner.visible = inside; if (!REDUCE) { flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go'); } }
    const low = inside ? smooth(CORE * .7, CORE * .07, camL.y) : 0;
    scene.fog.density = inside ? (.0024 + .0042 * low) * 55 / CORE / S : 0;
    shelf.bgU.uIn.value = inside ? 1 : 0; shelf.key.intensity = inside ? .1 : 1.1; shelf.rimL.intensity = inside ? .12 : .7;
    bloom.strength = room ? .55 : (inside ? .6 : .75); bloom.threshold = room ? .82 : (inside ? .84 : .88);
    bokeh.visible = (inside || room) && !REDUCE; bokeh.level = room ? .55 : 1; bokeh.update(dt, time, camera);
    grade.uniforms.uTime.value = time; grade.uniforms.uVig.value = inside || room ? .6 : .35;
    if (moon.castShadow) { const c = toScene(V3(camL.x, 0, camL.z)); moon.target.position.copy(c); moon.position.copy(c).add(V3(-5, 14, 7).multiplyScalar(.5)); const e = (inside ? CORE * .45 : CORE * 1.1) * S; const sc = moon.shadow.camera; if (sc.right !== e) { sc.left = -e; sc.right = e; sc.top = e; sc.bottom = -e; sc.near = .1; sc.far = 30; sc.updateProjectionMatrix(); } }
    for (let i = 0; i < bulbData.length; i++) { const b = bulbData[i]; bulbs.setColorAt(i, tmpC.copy(b.c).multiplyScalar((inside ? .72 : .5) * (.85 + .15 * Math.sin(time * 2.2 + b.ph)))); } if (bulbs.instanceColor) bulbs.instanceColor.needsUpdate = true;
    lamps.forEach((l, i) => { l.material.opacity = .5 + Math.sin(time * 3 + i) * .04; });
    spinV *= Math.pow(.6, dt); shelf.gSnowU.uSpin.value += spinV * dt + dt * .05;
    SH.step(dt, REDUCE ? .5 : 1); SH.apply(shelf.gSnowU); SH.apply(lSnowU);
    const sc = Hh * renderer.getPixelRatio() / (2 * Math.tan(camera.fov * Math.PI / 360));
    shelf.gSnowU.uTime.value = lSnowU.uTime.value = time * (REDUCE ? .5 : 1); starU.uTime.value = spU.uTime.value = skyU.uTime.value = time;
    shelf.gSnowU.uScale.value = sc; lSnowU.uScale.value = spU.uScale.value = sc * S; starU.uScale.value = sc * S * .5; lSnowU.uC.value.copy(camL); lSnowU.uBox.value = CORE * .62;
    for (let i = 0; i < SP; i++) { if (spLife[i] > 0) { spLife[i] -= dt; spVel[i * 3 + 1] -= 2.2 * dt; spPos[i * 3] += spVel[i * 3] * dt; spPos[i * 3 + 1] += spVel[i * 3 + 1] * dt; spPos[i * 3 + 2] += spVel[i * 3 + 2] * dt; spSeed[i * 4 + 3] = Math.max(0, spLife[i]) * .05; } else spSeed[i * 4 + 3] = 0; }
    spGeo.attributes.position.needsUpdate = spGeo.attributes.aSeed.needsUpdate = true;
    Object.values(ctx.rooms).forEach(r => r.update && r.update(dt, time));
    built.update && built.update(dt, time, { inside, room, sc });
  }

  /* ---------- старт ---------- */
  G.mode = 'outside'; Object.assign(cam, outsidePose());
  try { renderer.compile(scene, camera); } catch (e) { }
  $('.rk-load').classList.add('off');
  raf = requestAnimationFrame(frame);
  const api = { exit, shake: () => $('.rk-shake').click() };
  if (DEBUG) {
    cancelAnimationFrame(raf);
    Object.assign(api, {
      ctx, G, tour, TOUR, built, scene, bloom,
      tick: (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) tick(dt); composer.render(); },
      flyAt: e => { space = 'world'; G.mode = 'fly'; fly = makeFlight(false); fly.t = e; fly.dur = 1e9; },
      at: (i) => { fly = null; G.mode = 'tour'; el.classList.add('touring'); tour.nav.classList.remove('off'); const pt = TOUR[i]; setSpace(pt.room ? 'room:' + pt.room : 'world'); tour.i = i; tour.draw(); Object.assign(cam, ctx.poseOf(pt)); arriveAt(pt); },
      tap: (x, y) => tapAt(x, y),
    });
    window['__' + cfg.id] = api; document.documentElement.dataset.shot = 'ready'; return api;
  }
  setTimeout(enter, REDUCE ? 900 : 1600);
  return api;
}
export { V3, HDR, clamp, smooth, ease, wrapA, canvasTex, woodTex, windowTex, glowTex, pointCloud, TW_V, TW_F, SNOW_V, SNOW_F };
