/* «Дом Деда Мороза» в снежном шаре: терем во дворе, сани с подарками, снеговик, которого можно слепить,
   а внутри — мастерская: камин, ёлка, письма детей. Управление: экскурсия ‹ › и одно касание. */
import { THREE, createGlobe, buildRoom, furFir, firMat, fbm, ridged, RoundedBoxGeometry, V3, HDR, clamp, smooth, ease, canvasTex, woodTex, windowTex } from './globe-kit.js';

const CORE = 30;
function hgt(x, z) {
  const r = Math.hypot(x, z);
  let h = (fbm(x * .07 + 3, z * .07, 3) - .5) * 2.2 * smooth(9, 20, r) + 2.4 * smooth(21, 30, r);
  if (r > 31) h += -1 * smooth(31, 36, r) + ridged(x * .018 + 7, z * .018, 5) * 30 * smooth(38, 70, r) + 6 * smooth(60, 100, r);
  return h;
}
const SN = V3(4.6, 0, 2.6);          // где лепим снеговика
const LETTERS = [
  'Дедушка Мороз! Я весь год чистила зубы и почти не спорила с братом. Можно мне коньки с белыми шнурками? <i>Маша, 7 лет</i>',
  'Здравствуй, Дедушка Мороз. Подари, пожалуйста, бабушке тёплые варежки, а то она всё время отдаёт мне свои. <i>Тимофей</i>',
  'Дорогой Дедушка Мороз! Я научилась кататься на коньках и читать по слогам. Хочу набор красок и щенка. Щенка можно потом. <i>Соня</i>',
  'Дед Мороз, я нарисовал тебе оленя, он в конверте. А ещё хочу, чтобы мы всей семьёй слепили большого снеговика. <i>Лёва, 6 лет</i>',
  'Дедушка, привет! Пусть у всех на Новый год будет снег, а у меня железная дорога. Можно маленькую. <i>Артём, 8 лет</i>',
];

export async function open(btn) {
  if (document.getElementById('sn')) return;
  const t = document.createElement('canvas'); if (!(t.getContext('webgl2') || t.getContext('webgl'))) throw new Error('no webgl');
  return createGlobe({
    id: 'sn', debug: 'snshot', title: 'Дом Деда Мороза', label: 'Дом Деда Мороза', aria: 'Дом Деда Мороза: снежный шар с теремом, санями и мастерской',
    seed: 29, core: CORE, hgt, fog: 0x283458, aurora: .35, exposure: 1.02,
    ornaments: [[-15, 1.6, 4, 0x2c5f8a], [-11.4, 1.1, 8, 0xd6ae66], [14.5, 1.35, 6, 0xb33a44]],
    groundColor: (x, z) => { const p = Math.abs(x) < 1.6 && z > -2 && z < 16 ? 1 - smooth(1, 1.6, Math.abs(x)) : 0; const v = .95 + .05 * fbm(x * .3, z * .3, 2); return [v - p * .1, v - p * .1, v - p * .05]; },
    build
  }, btn);
}

async function build(c) {
  const { world, beyond, rnd, dm, envMap, T_GLOW, LOW, S } = c;
  const wood = new THREE.MeshStandardMaterial({ map: woodTex('#7a4a2a', '#4a2a16', '#a06a40'), roughness: .7, envMap, envMapIntensity: .25 }); wood.map.repeat.set(2, 1);
  const darkWood = new THREE.MeshStandardMaterial({ map: woodTex('#4a2a16', '#25130a', '#6a4024'), roughness: .6 });
  const snowM = c.shelfSnow, cream = new THREE.MeshStandardMaterial({ color: 0xf4ead8, roughness: .6 }), green = new THREE.MeshStandardMaterial({ color: 0x24584a, roughness: .7 });
  const red = new THREE.MeshPhysicalMaterial({ color: 0xa8222e, roughness: .25, clearcoat: 1, clearcoatRoughness: .1, envMap, envMapIntensity: 1.2 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9b26a, metalness: 1, roughness: .25, envMap, envMapIntensity: 1.5 });
  const winMat = new THREE.MeshBasicMaterial({ map: windowTex(), color: HDR(1.7, 1.4, 1.1) });
  const box = (w, h, d, m, x, y, z, g = world) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; g.add(b); return b; };

  /* ---- терем ---- */
  const HX = 0, HZ = -6, HW = 7.2, HD = 5.2, HH = 3.4;
  const house = new THREE.Group(); house.position.set(HX, hgt(HX, HZ) - .05, HZ); world.add(house);
  { // бревенчатые стены с выпусками на углах
    const lg = new THREE.CylinderGeometry(.2, .2, 1, 12); lg.rotateZ(Math.PI / 2); const L = [];
    for (let y = .2, k = 0; y < HH; y += .36, k++) { const o = k % 2 ? .18 : 0; L.push([0, y + o, HD / 2, HW + .9, 0], [0, y + o, -HD / 2, HW + .9, 0], [HW / 2, y + .18 - o, 0, HD + .9, 1], [-HW / 2, y + .18 - o, 0, HD + .9, 1]); }
    const im = new THREE.InstancedMesh(lg, wood, L.length); L.forEach(([x, y, z, len, r], i) => { dm.position.set(x, y, z); dm.rotation.set(0, r ? Math.PI / 2 : 0, 0); dm.scale.set(len, 1, 1); dm.updateMatrix(); im.setMatrixAt(i, dm.matrix); }); im.castShadow = im.receiveShadow = true; house.add(im);
    const core = box(HW - .3, HH, HD - .3, darkWood, 0, HH / 2, 0, house); core.castShadow = false;
  }
  { // крыша: крутые скаты, толстый снег, сосульки
    const RH = 2.6, half = HW / 2 + .7, slope = Math.hypot(HD / 2 + .7, RH), ang = Math.atan2(RH, HD / 2 + .7);
    [-1, 1].forEach(s => {
      const r = new THREE.Mesh(new THREE.BoxGeometry(half * 2, .16, slope), darkWood); r.position.set(0, HH + RH / 2, s * (HD / 2 + .7) / 2); r.rotation.x = s * ang; r.castShadow = true; house.add(r);
      const sn = new THREE.Mesh(new RoundedBoxGeometry(half * 2 + .2, .34, slope + .1, 3, .14), snowM); sn.position.set(0, HH + RH / 2 + .2, s * (HD / 2 + .7) / 2 + s * .06); sn.rotation.x = s * ang; sn.castShadow = true; house.add(sn);
    });
    const gs = new THREE.Shape(); gs.moveTo(-HD / 2 - .2, 0); gs.lineTo(0, RH); gs.lineTo(HD / 2 + .2, 0); gs.lineTo(-HD / 2 - .2, 0);
    [-1, 1].forEach(s => { const g = new THREE.Mesh(new THREE.ExtrudeGeometry(gs, { depth: .2, bevelEnabled: false }), wood); g.rotation.y = Math.PI / 2; g.position.set(s * (HW / 2 + .1) - .1, HH, 0); house.add(g); const w = new THREE.Mesh(new THREE.CircleGeometry(.4, 24), winMat); w.position.set(s * (HW / 2 + .32), HH + 1, 0); w.rotation.y = s * Math.PI / 2; house.add(w); });
    // резной конёк
    const ridge = box(HW + 1.6, .14, .14, cream, 0, HH + RH + .32, 0, house);
    const ic = new THREE.InstancedMesh(new THREE.ConeGeometry(.05, 1, 6), new THREE.MeshStandardMaterial({ color: 0xdff0ff, roughness: .08, metalness: .1, transparent: true, opacity: .8, envMap, envMapIntensity: 1.4 }), 46);
    for (let i = 0; i < 46; i++) { const s = i % 2 ? 1 : -1, x = -half + (Math.floor(i / 2) / 22) * half * 2, l = .2 + rnd() * .45; dm.position.set(x, HH - .05 - l / 2, s * (HD / 2 + .75)); dm.rotation.set(Math.PI, 0, 0); dm.scale.set(1, l, 1); dm.updateMatrix(); ic.setMatrixAt(i, dm.matrix); }
    house.add(ic); void ridge;
    // гирлянда по краю крыши
    house.updateMatrixWorld(true);
    for (let k = 0; k <= 30; k++) { const t = k / 30, x = -half + t * half * 2; c.bulb(V3(x, HH - .12 - Math.sin(t * Math.PI * 6) * .06, HD / 2 + .82).applyMatrix4(house.matrix), .07, c.PAL[k % 5]); }
  }
  { // окна с наличниками и ставнями, дверь, крыльцо
    const z = HD / 2 + .22;
    [[-2.3, 1.9], [2.3, 1.9]].forEach(([x, y]) => {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.2), winMat); w.position.set(x, y, z); house.add(w);
      box(1.4, .14, .12, cream, x, y + .7, z + .02, house); box(1.3, .12, .2, cream, x, y - .66, z + .06, house);
      const crown = new THREE.Shape(); crown.moveTo(-.75, 0); crown.quadraticCurveTo(0, .55, .75, 0); crown.lineTo(-.75, 0);
      const cr = new THREE.Mesh(new THREE.ExtrudeGeometry(crown, { depth: .08, bevelEnabled: false }), cream); cr.position.set(x, y + .77, z); house.add(cr);
      [-1, 1].forEach(s => box(.42, 1.3, .06, green, x + s * .8, y, z + .02, house));
      box(1.25, .14, .3, snowM, x, y - .56, z + .14, house);
      c.pool(HX + x, HZ + z + 2.2, 4.5, HDR(.5, .32, .12));
    });
    box(1.3, 2.2, .1, new THREE.MeshStandardMaterial({ map: woodTex('#5a2a18', '#2a1208', '#7a4024'), roughness: .5 }), 0, 1.1, z, house);
    const wr = new THREE.Mesh(new THREE.TorusGeometry(.3, .09, 10, 24), green); wr.position.set(0, 1.6, z + .1); house.add(wr);
    const bow = new THREE.Mesh(new THREE.SphereGeometry(.08, 10, 8), red); bow.position.set(0, 1.3, z + .16); house.add(bow);
    for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; c.bulb(V3(Math.cos(a) * .3, 1.6 + Math.sin(a) * .3, z + .2).add(house.position), .035, c.PAL[(i * 2) % 5]); }
    [-1, 1].forEach(s => { box(.18, 2.6, .18, wood, s * 1.05, 1.3, z + 1.1, house); });
    const pr = new THREE.Mesh(new RoundedBoxGeometry(2.6, .26, 1.6, 3, .1), snowM); pr.position.set(0, 2.72, z + .8); pr.rotation.x = .25; house.add(pr);
    box(2.6, .25, 1.4, wood, 0, .12, z + .7, house);
    [-1, 1].forEach(s => { const lt = new THREE.Mesh(new THREE.SphereGeometry(.14, 12, 10), new THREE.MeshBasicMaterial({ color: HDR(4, 2.6, 1.2) })); lt.position.set(s * 1.05, 2.25, z + 1.3); house.add(lt); const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: T_GLOW, color: 0xffb867, transparent: true, opacity: .6, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.set(1.8, 1.8, 1); gl.position.copy(lt.position); house.add(gl); });
    const pl = new THREE.PointLight(0xffb070, 2.2, 10 * S, 1.6); pl.position.copy(c.toScene(V3(HX, 2.2, HZ + z + 1.6))); c.scene.add(pl);
    c.pool(HX, HZ + z + 2.6, 6, HDR(.55, .35, .13));
  }
  { // башенка-терем со звездой
    const tg = new THREE.Group(); tg.position.set(HW / 2 - .2, 0, -HD / 2 + .4); house.add(tg);
    const tw = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, HH + 2.2, 20), wood); tw.position.y = (HH + 2.2) / 2; tw.castShadow = true; tg.add(tw);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.55, 2.6, 20), new THREE.MeshStandardMaterial({ color: 0x2a5a4a, roughness: .6 })); roof.position.y = HH + 2.2 + 1.3; tg.add(roof);
    const rs = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.3, 20, 1, true), snowM); rs.position.y = HH + 2.2 + 1.95; rs.scale.set(.82, 1, .82); tg.add(rs);
    const tw1 = new THREE.Mesh(new THREE.PlaneGeometry(.6, .8), winMat); tw1.position.set(0, HH + 1.2, 1.18); tg.add(tw1);
    const st = new THREE.Mesh(new THREE.OctahedronGeometry(.28), new THREE.MeshBasicMaterial({ color: HDR(4, 3, 1.4) })); st.position.y = HH + 2.2 + 2.85; tg.add(st);
    const sg = new THREE.Sprite(new THREE.SpriteMaterial({ map: T_GLOW, color: 0xffd27a, transparent: true, opacity: .75, depthWrite: false, blending: THREE.AdditiveBlending })); sg.scale.set(3, 3, 1); sg.position.copy(st.position); tg.add(sg); c.towerStar = st;
  }
  // труба и дым
  box(.8, 1.8, .8, new THREE.MeshStandardMaterial({ color: 0x6a4a40, roughness: .9 }), -1.8, HH + 2.4, -.8, house);
  const smoke = []; for (let i = 0; i < 9; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: T_GLOW, color: 0x8a96b8, transparent: true, opacity: 0, depthWrite: false })); house.add(s); smoke.push({ s, t: i / 9 }); }
  c.colliders = [];

  /* ---- сани с подарками ---- */
  {
    const g = new THREE.Group(); const x = -6.4, z = .8; g.position.set(x, hgt(x, z) + .05, z); g.rotation.y = .55; world.add(g);
    const sh = new THREE.Shape(); sh.moveTo(-1.5, .35); sh.lineTo(1.1, .35); sh.quadraticCurveTo(1.7, .4, 1.8, 1.25); sh.quadraticCurveTo(1.35, 1.0, 1.0, 1.0); sh.lineTo(-.9, 1.0); sh.quadraticCurveTo(-1.5, 1.05, -1.6, 1.8); sh.quadraticCurveTo(-1.85, 1.1, -1.5, .35);
    const side = new THREE.ExtrudeGeometry(sh, { depth: .12, bevelEnabled: true, bevelThickness: .03, bevelSize: .03, bevelSegments: 2 });
    [-.6, .48].forEach(zz => { const m = new THREE.Mesh(side, red); m.position.z = zz; m.castShadow = true; g.add(m); });
    box(2.6, .12, 1.1, red, -.2, .45, 0, g); box(.14, .7, 1.1, red, -1.45, .8, 0, g);
    const seat = new THREE.Mesh(new RoundedBoxGeometry(.9, .22, 1.0, 3, .08), new THREE.MeshStandardMaterial({ color: 0x2c4a7a, roughness: .9 })); seat.position.set(-1.0, .62, 0); g.add(seat);
    [-.62, .62].forEach(zz => { const rp = [V3(-1.7, .3, zz), V3(-1.2, .02, zz), V3(1.2, .02, zz), V3(1.9, .25, zz), V3(2.05, .55, zz), V3(1.85, .7, zz)]; g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rp), 40, .05, 8), gold)); [-.9, .2, 1.0].forEach(px => box(.06, .35, .06, gold, px, .2, zz, g)); });
    const sack = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [.42, .03], [.55, .3], [.5, .7], [.3, .95], [.18, 1.02], [.25, 1.1], [0, 1.1]].map(p => new THREE.Vector2(p[0], p[1])), 24), new THREE.MeshStandardMaterial({ color: 0x8a2a2e, roughness: .9 })); sack.position.set(.45, .5, 0); sack.rotation.z = -.15; sack.castShadow = true; g.add(sack);
    [[.95, .62, .3, 0x2c5f8a], [1.0, .6, -.32, 0xd6ae66], [-.3, .66, .25, 0x2f6b52]].forEach(([px, py, pz, col]) => { const gb = new THREE.Mesh(new RoundedBoxGeometry(.38, .34, .38, 2, .03), new THREE.MeshStandardMaterial({ color: col, roughness: .4 })); gb.position.set(px, py, pz); gb.rotation.y = rnd(); g.add(gb); const rib = box(.4, .36, .07, gold, px, py, pz, g); rib.rotation.y = gb.rotation.y; });
    for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.07, 12, 10), gold); b.position.set(1.5 - k * .4, .9, .66); g.add(b); }
    c.sleigh = g;
  }
  /* ---- большая ёлка во дворе ---- */
  const BIG = V3(-5.2, 0, 7.2); BIG.y = hgt(BIG.x, BIG.z);
  {
    const t = new THREE.Mesh(furFir({ seed: 41, snow: .35, tiers: 9, seg: 28 }), firMat()); t.position.copy(BIG); t.scale.set(2.3, 2.5, 2.3); t.castShadow = t.receiveShadow = true; world.add(t);
    const H = 2.6 * 2.5; for (let i = 0; i < 170; i++) { const k = i / 170, y = .8 + k * (H - 1.4), rr = (1 - (y - .5) / H) * 2.25 + .12, a = k * Math.PI * 2 * 8; c.bulb(V3(BIG.x + Math.cos(a) * rr, BIG.y + y, BIG.z + Math.sin(a) * rr), .075, c.PAL[i % 3 === 0 ? 4 : (i % 5 === 0 ? 2 : 0)]); }
    const st = new THREE.Mesh(new THREE.OctahedronGeometry(.32), new THREE.MeshBasicMaterial({ color: HDR(4, 3, 1.4) })); st.position.set(BIG.x, BIG.y + H + .2, BIG.z); world.add(st);
    const sg = new THREE.Sprite(new THREE.SpriteMaterial({ map: T_GLOW, color: 0xffcf7a, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending })); sg.scale.set(3.6, 3.6, 1); sg.position.copy(st.position); world.add(sg);
    c.pool(BIG.x, BIG.z + .6, 9, HDR(.45, .3, .12));
    const pl = new THREE.PointLight(0xffc070, 1.6, 14 * S, 1.6); pl.position.copy(c.toScene(V3(BIG.x + 1, BIG.y + 3, BIG.z + 2.6))); c.scene.add(pl);
  }
  /* ---- почтовый ящик, фонари, забор ---- */
  {
    const x = 2.8, z = 10.2, y = hgt(x, z), g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = -.3; world.add(g);
    box(.12, 1.1, .12, darkWood, 0, .55, 0, g);
    const mb = new THREE.Mesh(new RoundedBoxGeometry(.7, .6, .45, 3, .08), new THREE.MeshPhysicalMaterial({ color: 0x24508a, roughness: .3, clearcoat: 1, envMap })); mb.position.y = 1.35; g.add(mb);
    const lbl = canvasTex(256, 64, (gg, w, h) => { gg.fillStyle = '#24508a'; gg.fillRect(0, 0, w, h); gg.fillStyle = '#f3dca2'; gg.font = '600 40px Cormorant, Georgia, serif'; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText('ПОЧТА', w / 2, h / 2 + 2); });
    const lp = new THREE.Mesh(new THREE.PlaneGeometry(.56, .14), new THREE.MeshBasicMaterial({ map: lbl })); lp.position.set(0, 1.45, .231); g.add(lp);
    const sc = new THREE.Mesh(new RoundedBoxGeometry(.76, .12, .5, 2, .05), snowM); sc.position.y = 1.7; g.add(sc);
  }
  [[-1.9, 4], [1.9, 7.5], [-1.9, 11], [1.9, 14.5]].forEach(([x, z], i) => c.lamp(x, z, 2.8, i % 2 === 0));
  {
    const pk = [], R0 = 13.5; for (let a = -Math.PI; a < Math.PI; a += .055) { if (Math.abs(a - Math.PI / 2) < .16) continue; const x = Math.cos(a) * R0, z = Math.sin(a) * R0; pk.push([x, z, a]); }
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(.14, 1.1, .06), wood, pk.length), cap = new THREE.InstancedMesh(new THREE.SphereGeometry(.1, 8, 6, 0, 6.3, 0, 1.4), snowM, pk.length);
    pk.forEach(([x, z, a], i) => { const y = hgt(x, z); dm.position.set(x, y + .5, z); dm.rotation.set(0, -a + Math.PI / 2, 0); dm.scale.set(1, .9 + rnd() * .2, 1); dm.updateMatrix(); im.setMatrixAt(i, dm.matrix); dm.position.y = y + 1.05; dm.scale.set(.9, .6, .9); dm.updateMatrix(); cap.setMatrixAt(i, dm.matrix); });
    im.castShadow = true; world.add(im, cap);
  }
  /* ---- лес вокруг и дальние ели ---- */
  {
    const fir = furFir({ seed: 7, snow: .42, tiers: LOW ? 6 : 7, seg: LOW ? 16 : 22 }), pts = [];
    for (let i = 0; i < 3000 && pts.length < (LOW ? 90 : 150); i++) {
      const a = rnd() * Math.PI * 2, r = 14.5 + Math.pow(rnd(), .8) * 15, x = Math.cos(a) * r, z = Math.sin(a) * r, s = 1.2 + rnd() * 1.6 + smooth(18, 28, r);
      if (Math.abs(x) < 4 && z > 10) continue; if (z > 9 && Math.abs(x) < 9 && rnd() < .7) continue;
      const top = hgt(x, z) + 2.6 * s; if ((r * S) ** 2 + (-2.5 + top * S) ** 2 > 9.7 * 9.7) continue;
      if (pts.some(p => Math.hypot(p[0] - x, p[1] - z) < 1.3)) continue; pts.push([x, z, s]);
    }
    [[-8.5, 3, 1.6], [-9.5, -3, 2], [8.5, -2, 1.8], [9.6, 4.5, 1.5], [-7.6, -9.5, 2.1], [7.5, -10.5, 2.2]].forEach(p => pts.push(p));
    const im = new THREE.InstancedMesh(fir, firMat(), pts.length); pts.forEach(([x, z, s], i) => { dm.position.set(x, hgt(x, z) - .05, z); dm.rotation.set(0, rnd() * 6, 0); dm.scale.set(s, s * (.9 + rnd() * .3), s); dm.updateMatrix(); im.setMatrixAt(i, dm.matrix); }); im.castShadow = im.receiveShadow = true; world.add(im);
    const far = furFir({ seed: 8, snow: .7, tiers: 4, seg: 10 }), n = LOW ? 400 : 900, fi = new THREE.InstancedMesh(far, firMat(), n); let k = 0;
    for (let i = 0; i < n * 3 && k < n; i++) { const a = rnd() * Math.PI * 2, r = 33 + Math.pow(rnd(), .7) * 55, x = Math.cos(a) * r, z = Math.sin(a) * r; if (hgt(x, z) > 14) continue; const s = 2 + rnd() * 2.5; dm.position.set(x, hgt(x, z) - .2, z); dm.rotation.set(0, rnd() * 6, 0); dm.scale.set(s, s * 1.15, s); dm.updateMatrix(); fi.setMatrixAt(k++, dm.matrix); }
    fi.count = k; beyond.add(fi);
  }
  // блёстки на снегу
  { const p = [], s = []; for (let i = 0; i < (LOW ? 500 : 1300); i++) { const a = rnd() * 6.283, r = 2 + Math.sqrt(rnd()) * 26, x = Math.cos(a) * r, z = Math.sin(a) * r; p.push(x, hgt(x, z) + .05, z); s.push(.5 + rnd() * 2.5, rnd() * 6.3, 10 + rnd() * 20, .012 + rnd() * .012); } const u = { uTime: { value: 0 }, uScale: { value: 300 }, uOpacity: { value: 1 }, uGain: { value: 2.4 }, uColor: { value: HDR(1, .95, .85) } }; world.add(c.pointCloud ? c.pointCloud(p, s, u) : new THREE.Object3D()); c.glitU = u; }

  /* ---- снеговик: лепим по шагам ---- */
  const snowman = new THREE.Group(); snowman.position.set(SN.x, hgt(SN.x, SN.z), SN.z); snowman.rotation.y = .25; snowman.scale.setScalar(1.35); world.add(snowman);
  const pile = new THREE.Mesh(new THREE.SphereGeometry(.9, 20, 10, 0, 6.3, 0, 1.2), snowM); pile.scale.y = .35; snowman.add(pile);
  const BALLS = [[.62, .55], [.46, 1.45], [.33, 2.1]].map(([r, y]) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), snowM); m.position.y = y; m.scale.setScalar(.001); m.castShadow = true; snowman.add(m); return { m, r, k: 0, tg: 0 }; });
  const coal = new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: .35 });
  const parts = {};
  const mk = (name, build) => { const g = new THREE.Group(); build(g); g.visible = false; g.scale.setScalar(.001); snowman.add(g); parts[name] = g; return g; };
  mk('eyes-coal', g => [[-.11, 2.2, .29], [.11, 2.2, .29], [0, 1.58, .45], [0, 1.36, .46]].forEach(([x, y, z]) => { const m = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), coal); m.position.set(x, y, z); g.add(m); }));
  mk('eyes-btn', g => { const bm = new THREE.MeshPhysicalMaterial({ color: 0x2c5f8a, roughness: .2, clearcoat: 1 }); [[-.11, 2.2, .29], [.11, 2.2, .29], [0, 1.58, .45], [0, 1.36, .46]].forEach(([x, y, z], i) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(i < 2 ? .055 : .07, i < 2 ? .055 : .07, .03, 16), i < 2 ? bm : red); m.rotation.x = Math.PI / 2 - .3; m.position.set(x, y, z); g.add(m); }); });
  mk('nose-carrot', g => { const n = new THREE.Mesh(new THREE.ConeGeometry(.065, .42, 10), new THREE.MeshStandardMaterial({ color: 0xe9843a, roughness: .5 })); n.rotation.x = Math.PI / 2; n.position.set(0, 2.1, .5); g.add(n); });
  mk('nose-cone', g => { const n = new THREE.Mesh(new THREE.ConeGeometry(.08, .22, 10), new THREE.MeshStandardMaterial({ color: 0x7a4a24, roughness: .9 })); n.rotation.x = Math.PI / 2; n.position.set(0, 2.1, .4); g.add(n); });
  const scarf = (col, col2) => g => { const m = new THREE.MeshStandardMaterial({ color: col, roughness: .85 }); const t = new THREE.Mesh(new THREE.TorusGeometry(.36, .085, 10, 28), m); t.rotation.x = Math.PI / 2; t.position.y = 1.83; g.add(t); const tail = new THREE.Mesh(new RoundedBoxGeometry(.16, .5, .05, 2, .02), col2 ? new THREE.MeshStandardMaterial({ color: col2, roughness: .85 }) : m); tail.position.set(.22, 1.6, .33); tail.rotation.z = .25; g.add(tail); };
  mk('scarf-red', scarf(0xb02f3c)); mk('scarf-blue', scarf(0x2c4f8a, 0xf4ead8)); mk('scarf-green', scarf(0x2f6b52));
  mk('hat-bucket', g => { const b = new THREE.Mesh(new THREE.CylinderGeometry(.24, .2, .36, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0x8a96a8, metalness: .8, roughness: .35, envMap, side: THREE.DoubleSide })); b.position.y = 2.5; b.rotation.z = .15; g.add(b); });
  mk('hat-top', g => { const h = new THREE.Mesh(new THREE.CylinderGeometry(.21, .23, .36, 20), coal); h.position.y = 2.6; g.add(h); const br = new THREE.Mesh(new THREE.CylinderGeometry(.36, .36, .04, 24), coal); br.position.y = 2.42; g.add(br); const rb = new THREE.Mesh(new THREE.CylinderGeometry(.235, .235, .07, 20), red); rb.position.y = 2.5; g.add(rb); });
  mk('hat-knit', g => { const h = new THREE.Mesh(new THREE.SphereGeometry(.3, 20, 14, 0, 6.3, 0, 1.6), new THREE.MeshStandardMaterial({ color: 0xb02f3c, roughness: .95 })); h.position.y = 2.22; h.scale.y = 1.1; g.add(h); const rim = new THREE.Mesh(new THREE.TorusGeometry(.3, .06, 8, 24), cream); rim.rotation.x = Math.PI / 2; rim.position.y = 2.25; g.add(rim); const pom = new THREE.Mesh(new THREE.SphereGeometry(.1, 12, 10), cream); pom.position.y = 2.58; g.add(pom); });
  mk('arms', g => { const bm = new THREE.MeshStandardMaterial({ color: 0x4a2c18, roughness: .9 }); [-1, 1].forEach(s => { const a = new THREE.Mesh(new THREE.CylinderGeometry(.02, .03, .8, 6), bm); a.position.set(s * .7, 1.62, 0); a.rotation.z = s * -1.0; g.add(a); const f = new THREE.Mesh(new THREE.CylinderGeometry(.012, .015, .22, 5), bm); f.position.set(s * 1.0, 1.9, 0); f.rotation.z = s * -.3; g.add(f); }); });
  const SM = { step: -1, n: 0 };
  const show = (name, on) => { const p = parts[name]; p.visible = on; p.userData.k = on ? 0 : 1; if (on) p.scale.setScalar(.001); };
  const group = pre => Object.keys(parts).filter(k => k.startsWith(pre)).forEach(k => { parts[k].visible = false; });
  function snowReset() { BALLS.forEach(b => { b.tg = 0; b.k = 0; b.m.scale.setScalar(.001); }); Object.keys(parts).forEach(k => { parts[k].visible = false; }); SM.n = 0; SM.wave = 0; }
  const STEPS = [
    { t: 'Шаг 2 из 5 · Глазки и пуговицы', o: [['Угольки', 'eyes-coal', '#1b1b20'], ['Синие пуговки', 'eyes-btn', '#2c5f8a']] },
    { t: 'Шаг 3 из 5 · Нос', o: [['Морковка', 'nose-carrot', '#e9843a'], ['Шишка', 'nose-cone', '#7a4a24']] },
    { t: 'Шаг 4 из 5 · Шарф', o: [['Красный', 'scarf-red', '#b02f3c'], ['Синий', 'scarf-blue', '#2c4f8a'], ['Зелёный', 'scarf-green', '#2f6b52']] },
    { t: 'Шаг 5 из 5 · Шапка', o: [['Ведро', 'hat-bucket', '#8a96a8'], ['Цилиндр', 'hat-top', '#1b1b20'], ['Вязаная', 'hat-knit', '#b02f3c']] },
  ];
  const sp = () => c.toScene(V3(SN.x, hgt(SN.x, SN.z) + 2.4, SN.z));
  function snowStep() {
    if (SM.step === 0) { c.choices('Шаг 1 из 5 · Скатайте три кома: ' + SM.n + ' из 3', [{ label: SM.n === 0 ? 'Скатать большой ком' : (SM.n === 1 ? 'Скатать ком поменьше' : 'Скатать голову'), f: roll }]); return; }
    const S_ = STEPS[SM.step - 1]; if (!S_) return snowDone();
    c.choices(S_.t, S_.o.map(([label, part, sw]) => ({ label, sw, f: () => { group(part.split('-')[0]); show(part, true); c.A.chime([1319 + SM.step * 90, 1760 + SM.step * 90], .04, 1); c.burst(sp(), 14, .02, .5); SM.step++; setTimeout(snowStep, 350); } })));
  }
  function roll() { const b = BALLS[SM.n]; if (!b) return; b.tg = 1; SM.n++; c.A.chime([784 + SM.n * 110], .04, .8); if (SM.n >= 3) { show('arms', true); SM.step = 1; setTimeout(snowStep, 500); } else snowStep(); }
  function snowDone() { c.choices(null); SM.step = -1; SM.wave = 1; c.setHud(''); c.A.chime([784, 988, 1175, 1568, 1976], .05, 2.2, .12); for (let i = 0; i < 4; i++) setTimeout(() => c.burst(sp(), 30, .04, 1.2), i * 160); setTimeout(() => c.showCard('Снеговик готов!', 'Он будет сторожить двор Деда Мороза до самой весны. Можно слепить ещё одного, с другой шапкой и шарфом.', 'Слепить заново', startSnow, 'Гулять дальше'), 1300); }
  function startSnow() { c.hideCard(); snowReset(); SM.step = 0; c.setHud('Лепим снеговика'); c.setHint('Нажимайте кнопки внизу — снеговик сразу всё наденет', 4500); snowStep(); }

  /* ---- комната-мастерская ---- */
  const room = c.addRoom('work', buildRoom({ envMap, T_GLOW, rnd, LOW, santa: true }));
  const RP = room.poses;
  // письма
  const LT = { on: false, n: 0 };
  room.letters.forEach((l, i) => c.taps.push({ on: () => LT.on && !l.read, pos: () => l.m.position, r: 80, f: () => readLetter(i) }));
  function readLetter(i) { const l = room.letters[i]; if (!l || l.read) return; c.A.chime([1175, 1568], .035, 1.2); c.showCard('Письмо ' + (LT.n + 1) + ' из 5', LETTERS[i], 'Поставить печать «Исполнить»', () => { l.read = true; LT.n++; l.gl.material.opacity = 0; c.A.chime([988, 1319, 1760], .045, 1.4, .1); c.pop('Исполнить!', l.m.position.clone().add(V3(0, .15, 0)), 'big'); c.setHud('Письма: ' + LT.n + ' из 5'); if (LT.n >= 5) setTimeout(() => { LT.on = false; c.setHud(''); c.showCard('Все письма прочитаны', 'Дед Мороз поставил печати на все пять писем. Теперь их отнесут в мастерскую, а подарки поедут в санях.', 'К ёлке', () => c.goTo('tree'), 'Остаться'); }, 900); }, 'Отложить'); }
  function startLetters() { LT.on = true; c.setHud('Письма: ' + LT.n + ' из 5'); c.setHint('Коснитесь светящегося конверта', 4000); }
  // ёлка
  const DT = { on: false, n: 0 };
  c.taps.push({ on: () => DT.on, pos: () => V3(room.TREE.x, 1.45, room.TREE.z), r: 220, f: hang });
  function hang() { const o = room.orns.find(o => !o.done); if (!o) return; o.done = true; o.fly = .001; DT.n++; c.A.chime([1047 * Math.pow(1.06, DT.n), 1568 * Math.pow(1.06, DT.n)], .04, 1); c.setHud('Игрушки: ' + DT.n + ' из 8'); if (DT.n >= 8) { DT.on = false; setTimeout(() => { DT.lit = 1; c.A.chime([784, 988, 1175, 1568, 1976], .05, 2.4, .14); c.setHud(''); c.showCard('Ёлка наряжена!', 'Все восемь игрушек на ветках, звезда зажглась. В тереме стало совсем по-праздничному.', 'Посидеть у камина', () => c.goTo('fire'), 'Остаться'); }, 1000); } }
  function startDecor() { if (DT.n >= 8) { room.orns.forEach(o => { o.done = false; o.fly = 0; o.m.position.copy(o.home); }); DT.n = 0; DT.lit = 0; } DT.on = true; c.setHud('Игрушки: 0 из 8'); c.setHint('Касайтесь ёлки — каждая игрушка сама найдёт свою ветку', 4500); }

  const tour = [
    { id: 'yard', name: 'Двор Деда Мороза', text: 'Терем, ёлка и сани с подарками. Здесь всё готово к празднику', cam: { p: V3(0, 4.6, 17.5), l: V3(0, 2.6, -4), fov: 46, fovP: 70, backP: .25 } },
    { id: 'sleigh', name: 'Сани', text: 'Мешок подарков уже в санях, колокольчики начищены', cam: { p: V3(-2.4, 2.4, 6.6), l: V3(-6.2, .9, .6), fov: 46, fovP: 66 } },
    { id: 'snowman', name: 'Снеговик', text: 'Сугроб уже есть. Слепим из него снеговика?', cam: { p: V3(4.4, 2.6, 9.6), l: V3(4.6, 1.7, 2.6), fov: 44, fovP: 64 }, act: ['Слепить снеговика', () => startSnow()] },
    { id: 'work', room: 'work', name: 'Мастерская', text: 'Верстак, лошадки и барабаны: подарки делают здесь', cam: RP.bench },
    { id: 'letters', room: 'work', name: 'Письма', text: 'На столике письма от детей. Дед Мороз читает каждое', cam: RP.table, act: ['Читать письма', () => startLetters()], onArrive: () => startLetters() },
    { id: 'tree', room: 'work', name: 'Ёлка в тереме', text: 'Корзинка с игрушками ждёт', cam: RP.tree, act: ['Нарядить ёлку', () => startDecor()] },
    { id: 'fire', room: 'work', name: 'У камина', text: 'Тепло, трещат дрова, пахнет мандаринами', cam: RP.fire },
  ];
  let snowT = 0;
  return {
    tour,
    endGame() { if (SM.step >= 0) { SM.step = -1; c.choices(null); } LT.on = false; DT.on = false; c.setHud(''); },
    update(dt, t, st) {
      room.setLit(DT.lit ? Math.min(1, (room._l = (room._l || 0) + dt)) : 0);
      BALLS.forEach(b => { b.k += (b.tg - b.k) * (1 - Math.pow(.02, dt)); b.m.scale.setScalar(Math.max(.001, ease(clamp(b.k, 0, 1)))); });
      Object.values(parts).forEach(p => { if (p.visible && p.userData.k < 1) { p.userData.k = Math.min(1, p.userData.k + dt * 3); const e = p.userData.k; p.scale.setScalar(Math.max(.001, e < .7 ? e / .7 * 1.15 : 1.15 - (e - .7) / .3 * .15)); } });
      if (SM.wave) { snowman.rotation.z = Math.sin(t * 3) * .04; parts.arms.rotation.z = Math.sin(t * 6) * .08; } else snowman.rotation.z = 0;
      pile.scale.set(1 - BALLS[0].k * .5, .35 * (1 - BALLS[2].k * .6), 1 - BALLS[0].k * .5);
      smoke.forEach(s => { s.t = (s.t + dt * .09) % 1; s.s.position.set(-1.8 + Math.sin(t * .4 + s.t * 4) * .4 * s.t, HH + 3.4 + s.t * 5, -.8 - s.t * 1.2); const k = .6 + s.t * 2.6; s.s.scale.set(k, k, 1); s.s.material.opacity = Math.sin(s.t * Math.PI) * .16; });
      room.letters.forEach((l, i) => { l.gl.material.opacity = LT.on && !l.read ? .35 + .25 * Math.sin(t * 3 + i) : 0; });
      room.orns.forEach((o, i) => { o.ring.material.opacity = DT.on && !o.done ? .35 + .25 * Math.sin(t * 3 + i) : 0; });
      if (c.towerStar) c.towerStar.rotation.y = t * .6;
      if (c.glitU) { c.glitU.uTime.value = t; c.glitU.uScale.value = st.sc * S; }
      snowT += dt;
    }
  };
}
