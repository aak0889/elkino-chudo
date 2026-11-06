/* «Сказочный олений лес» в снежном шаре (заготовка, откроется 15 декабря; для проверки ?open=1#igra-les):
   ночной ельник, северное сияние, светящийся олень и мини-игра «Найди оленя по следам» — одно касание на шаг. */
import { THREE, createGlobe, furFir, firMat, fbm, ridged, V3, HDR, clamp, smooth, ease } from './globe-kit.js';

const CORE = 30;
function hgt(x, z) {
  const r = Math.hypot(x, z);
  let h = (fbm(x * .06 + 11, z * .06, 3) - .5) * 2.6 * smooth(6, 16, r) + 2 * smooth(20, 30, r);
  if (r > 31) h += -1 * smooth(31, 36, r) + ridged(x * .02 + 3, z * .02 + 9, 5) * 34 * smooth(38, 72, r) + 6 * smooth(60, 100, r);
  return h;
}
const DEER = V3(-7.5, 0, -9.5);
const TRACK = [[1.5, 9], [.6, 6.6], [-.6, 4.3], [-2.2, 2.2], [-3.6, .1], [-4.8, -2.4], [-5.8, -5], [-6.8, -7.4]];

export async function open(btn) {
  if (document.getElementById('fr')) return;
  const t = document.createElement('canvas'); if (!(t.getContext('webgl2') || t.getContext('webgl'))) throw new Error('no webgl');
  return createGlobe({
    id: 'fr', debug: 'frshot', title: 'Олений лес', label: 'Олений лес', aria: 'Сказочный олений лес: снежный шар с северным сиянием и светящимся оленем',
    seed: 53, core: CORE, hgt, fog: 0x1c3048, aurora: 1, hemi: 0x6a9ac8, exposure: 1.05,
    ornaments: [[-15, 1.6, 4, 0x2f6b52], [-11.4, 1.1, 8, 0x9fc4e8], [14.5, 1.35, 6, 0xd6ae66]],
    groundColor: (x, z) => { const v = .93 + .07 * fbm(x * .25, z * .25, 2); return [v * .96, v, v * 1.05]; },
    build
  }, btn);
}

async function build(c) {
  const { world, beyond, rnd, dm, T_GLOW, LOW, S } = c;
  // ельник
  {
    const fir = furFir({ seed: 17, snow: .5, tiers: LOW ? 6 : 8, seg: LOW ? 16 : 22, height: 2.8 }), pts = [];
    const clear = (x, z) => Math.hypot(x, z) < 6.5 || TRACK.some(([a, b]) => Math.hypot(x - a, z - b) < 2) || Math.hypot(x - DEER.x, z - DEER.z) < 3.4 || (Math.abs(x) < 3.5 && z > 8) || [[3, 14.5], [1, 5], [2.8, 12.4], [-3.4, -4.4], [-5.4, -6.9], [-1, 1.5]].some(([a, b]) => Math.hypot(x - a, z - b) < 3.2);
    for (let i = 0; i < 4000 && pts.length < (LOW ? 110 : 190); i++) {
      const a = rnd() * Math.PI * 2, r = 5 + Math.pow(rnd(), .7) * 24, x = Math.cos(a) * r, z = Math.sin(a) * r, s = 1.1 + rnd() * 1.7 + smooth(16, 28, r) * .8;
      if (clear(x, z)) continue; const top = hgt(x, z) + 2.8 * s; if ((r * S) ** 2 + (-2.5 + top * S) ** 2 > 9.7 * 9.7) continue;
      if (pts.some(p => Math.hypot(p[0] - x, p[1] - z) < 1.2)) continue; pts.push([x, z, s]);
    }
    const im = new THREE.InstancedMesh(fir, firMat(), pts.length); pts.forEach(([x, z, s], i) => { dm.position.set(x, hgt(x, z) - .05, z); dm.rotation.set(0, rnd() * 6, 0); dm.scale.set(s, s * (.9 + rnd() * .3), s); dm.updateMatrix(); im.setMatrixAt(i, dm.matrix); }); im.castShadow = im.receiveShadow = true; world.add(im);
    const far = furFir({ seed: 18, snow: .65, tiers: 4, seg: 10 }), n = LOW ? 400 : 1000, fi = new THREE.InstancedMesh(far, firMat(), n); let k = 0;
    for (let i = 0; i < n * 3 && k < n; i++) { const a = rnd() * Math.PI * 2, r = 33 + Math.pow(rnd(), .7) * 55, x = Math.cos(a) * r, z = Math.sin(a) * r; if (hgt(x, z) > 16) continue; const s = 2 + rnd() * 2.6; dm.position.set(x, hgt(x, z) - .2, z); dm.rotation.set(0, rnd() * 6, 0); dm.scale.set(s, s * 1.15, s); dm.updateMatrix(); fi.setMatrixAt(k++, dm.matrix); }
    fi.count = k; beyond.add(fi);
  }
  // светлячки-огоньки между елями
  const orbU = { uTime: { value: 0 }, uScale: { value: 300 }, uOpacity: { value: 1 }, uGain: { value: 2.6 }, uColor: { value: HDR(.7, .9, 1.2) } };
  { const p = [], s = []; for (let i = 0; i < (LOW ? 90 : 200); i++) { const a = rnd() * 6.283, r = 3 + rnd() * 22, x = Math.cos(a) * r, z = Math.sin(a) * r; p.push(x, hgt(x, z) + .6 + rnd() * 3, z); s.push(.4 + rnd() * 1.2, rnd() * 6.3, 2 + rnd() * 3, .06 + rnd() * .08); } world.add(c.pointCloud(p, s, orbU)); }
  // замёрзший ручеёк с камнями и пара фонариков у поляны
  const lantern = (x, z) => { const y = hgt(x, z), g = new THREE.Group(); g.position.set(x, y, z); world.add(g); const post = new THREE.Mesh(new THREE.CylinderGeometry(.05, .07, 1.4, 6), c.ironMat); post.position.y = .7; g.add(post); const b = new THREE.Mesh(new THREE.SphereGeometry(.16, 12, 10), new THREE.MeshBasicMaterial({ color: HDR(3.6, 2.4, 1.1) })); b.position.y = 1.55; g.add(b); const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: T_GLOW, color: 0xffb867, transparent: true, opacity: .6, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.set(2, 2, 1); gl.position.y = 1.55; g.add(gl); c.pool(x, z, 4.5, HDR(.45, .28, .1)); };
  lantern(3.2, 7.5); lantern(-2.8, 6.2);
  // олень
  const glowM = new THREE.MeshStandardMaterial({ color: 0xd8ecff, emissive: 0x8cc4ff, emissiveIntensity: .7, roughness: .5 });
  const antM = new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffc070, emissiveIntensity: 1.6, roughness: .4 });
  const deer = new THREE.Group(); deer.position.set(DEER.x, hgt(DEER.x, DEER.z), DEER.z); deer.rotation.y = .9; deer.scale.setScalar(1.25); world.add(deer);
  { const add = (g, m, x, y, z, rx = 0, rz = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.set(rx, 0, rz); deer.add(o); return o; };
    const body = add(new THREE.CapsuleGeometry(.36, 1.05, 6, 16), glowM, 0, 1.3, 0, 0, Math.PI / 2); body.scale.set(1, 1, .9);
    add(new THREE.CapsuleGeometry(.16, .55, 4, 12), glowM, .72, 1.75, 0, 0, -.7);
    const head = add(new THREE.CapsuleGeometry(.15, .3, 4, 12), glowM, 1.0, 2.12, 0, 0, -1.25);
    add(new THREE.SphereGeometry(.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0x0c1220 }), 1.27, 2.0, 0);
    [[.5, .22], [.5, -.22], [-.5, .22], [-.5, -.22]].forEach(([x, z]) => add(new THREE.CylinderGeometry(.06, .045, 1.05, 8), glowM, x, .55, z));
    [-1, 1].forEach(s => { add(new THREE.ConeGeometry(.07, .2, 8), glowM, .95, 2.32, s * .12, s * .5, -.3); const pts = [V3(.98, 2.25, s * .08), V3(.9, 2.6, s * .2), V3(.75, 2.95, s * .35), V3(.62, 3.2, s * .32)]; deer.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, .03, 6), antM)); [[1, .5, .25], [2, .55, .3]].forEach(([k, len, up]) => { const p0 = pts[k], p1 = p0.clone().add(V3(.18, up, s * len * .4)); deer.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p0, p0.clone().lerp(p1, .5).add(V3(0, .05, 0)), p1]), 6, .022, 5), antM)); }); });
    add(new THREE.SphereGeometry(.12, 10, 8), glowM, -.72, 1.45, 0);
    void head;
  }
  const deerGl = new THREE.Sprite(new THREE.SpriteMaterial({ map: T_GLOW, color: 0x9cc8ff, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending })); deerGl.scale.set(6, 5, 1); deerGl.position.set(0, 1.6, 0); deer.add(deerGl);
  const deerPool = c.pool(DEER.x, DEER.z, 7, HDR(.2, .35, .6));
  const dl = new THREE.PointLight(0x9cc8ff, 2, 10 * S, 1.6); dl.position.copy(c.toScene(V3(DEER.x, hgt(DEER.x, DEER.z) + 2, DEER.z + 1))); c.scene.add(dl);
  const dust = { uTime: { value: 0 }, uScale: { value: 300 }, uOpacity: { value: 1 }, uGain: { value: 3 }, uColor: { value: HDR(.8, .95, 1.2) } };
  { const p = [], s = []; for (let i = 0; i < 60; i++) { p.push(DEER.x + (rnd() - .5) * 3, hgt(DEER.x, DEER.z) + rnd() * 3.5, DEER.z + (rnd() - .5) * 3); s.push(1 + rnd() * 2, rnd() * 6.3, 2, .05 + rnd() * .06); } const pc = c.pointCloud(p, s, dust); world.add(pc); c.deerDust = pc; }
  // следы копыт
  const printM = new THREE.MeshBasicMaterial({ color: 0x31405e, transparent: true, opacity: .55, depthWrite: false });
  const prints = TRACK.map(([x, z], i) => { const g = new THREE.Group(); const nx = TRACK[Math.min(i + 1, TRACK.length - 1)], ang = Math.atan2(nx[0] - x, nx[1] - z) || 0; g.position.set(x, hgt(x, z) + .03, z); g.rotation.y = ang; world.add(g); [-.18, .18].forEach((o, k) => { const m = new THREE.Mesh(new THREE.CircleGeometry(.11, 12), printM); m.rotation.x = -Math.PI / 2; m.scale.set(.8, 1.3, 1); m.position.set(o, 0, k * .3); g.add(m); }); const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: T_GLOW, color: 0xbfe0ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.set(1.6, 1.6, 1); gl.position.set(x, hgt(x, z) + .3, z); world.add(gl); return { g, gl, x, z }; });
  const TG = { on: false, i: 0, found: false };
  prints.forEach((p, i) => c.taps.push({ on: () => TG.on && TG.i === i, pos: () => c.toScene(V3(p.x, hgt(p.x, p.z) + .2, p.z)), r: 110, f: () => step(i) }));
  function step(i) {
    TG.i++; c.A.chime([880 + i * 70, 1320 + i * 70], .035, .9); c.burst(V3(prints[i].x, hgt(prints[i].x, prints[i].z) + .3, prints[i].z), 10, 1, .6);
    const nx = prints[Math.min(TG.i, prints.length - 1)];
    c.camTo({ p: V3(prints[i].x + .8, hgt(prints[i].x, prints[i].z) + 2.6, prints[i].z + 3.4), l: V3(nx.x, hgt(nx.x, nx.z) + .3, nx.z), fov: c.camera.aspect < .8 ? 66 : 50 }, 1.2);
    c.setHud('Следы: ' + TG.i + ' из ' + prints.length);
    if (TG.i >= prints.length) { TG.on = false; TG.found = true; c.setHud(''); setTimeout(() => { c.camTo({ p: V3(-3.4, 2.6, -4.4), l: V3(DEER.x, hgt(DEER.x, DEER.z) + 1.8, DEER.z), fov: c.camera.aspect < .8 ? 64 : 48 }, 1.8); c.A.chime([659, 880, 1047, 1319, 1760], .04, 2.6, .2); setTimeout(() => c.showCard('Вы нашли оленя!', 'Он светится, потому что всю ночь носил звёзды для северного сияния. Говорят, кто его увидит, тому весь год будет везти.', 'Ещё раз по следам', startTracks, 'Гулять дальше'), 2200); }, 900); }
  }
  function startTracks() { c.hideCard(); TG.on = true; TG.i = 0; TG.found = false; c.setHud('Следы: 0 из ' + prints.length); c.setHint('Олень убежал. Касайтесь светящегося следа — и идите за ним', 4500); const p = prints[0]; c.camTo({ p: V3(p.x + 1, hgt(p.x, p.z) + 3, p.z + 4.5), l: V3(p.x - 1, hgt(p.x, p.z), p.z - 3), fov: c.camera.aspect < .8 ? 66 : 50 }, 1.4); }

  const tour = [
    { id: 'glade', name: 'Поляна', text: 'Тихо, только снег скрипит. Где-то рядом бродит светящийся олень', cam: { p: V3(3, 3.4, 14.5), l: V3(-2, 2.2, -4), fov: 48, fovP: 70, backP: .2 } },
    { id: 'sky', name: 'Северное сияние', text: 'Зелёные и сиреневые ленты над елями', cam: { p: V3(1, 2, 5), l: V3(-4, 14, -18), fov: 58, fovP: 78 } },
    { id: 'tracks', name: 'Следы на снегу', text: 'Свежие, с искорками. Это его следы', cam: { p: V3(2.8, 2.6, 12.4), l: V3(.4, .2, 5.8), fov: 48, fovP: 68 }, act: ['Найти оленя по следам', () => startTracks()] },
    { id: 'deer', name: 'Олень', text: 'Подойдите тихонько, он не боится', cam: { p: V3(-3.4, 2.6, -4.4), l: V3(DEER.x, 1.8, DEER.z), fov: 48, fovP: 66 } },
  ];
  return {
    tour,
    endGame() { TG.on = false; c.setHud(''); },
    update(dt, t, st) {
      orbU.uTime.value = dust.uTime.value = t; orbU.uScale.value = dust.uScale.value = st.sc * S;
      const vis = !TG.on || TG.found; deer.visible = vis; deerPool.visible = vis; c.deerDust.visible = vis;
      deer.position.y = hgt(DEER.x, DEER.z) + Math.sin(t * 1.2) * .03; deer.children[2].rotation.z = -1.25 + Math.sin(t * .7) * .08;
      glowM.emissiveIntensity = .65 + .15 * Math.sin(t * 1.6); deerGl.material.opacity = .3 + .1 * Math.sin(t * 1.6);
      prints.forEach((p, i) => { p.gl.material.opacity = TG.on && TG.i === i ? .55 + .35 * Math.sin(t * 4) : 0; });
    }
  };
}
