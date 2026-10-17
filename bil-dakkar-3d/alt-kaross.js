// ============================================================
// Alternativa karosser: färdiga modeller (glTF Binary) som läggs för hand i modeller/.
// Delas av index.html (delkartan) och kaross-test.html (förhandsvisningen).
// Filerna laddas först när de väljs, så att sidorna inte gör några anrop i onödan.
//
// Fält per post:
//   del, andring  - vilken del av modellen som används och vad som ändrats (krävs för CC BY-krediten)
//   nod           - nodens namn (bil) när filen innehåller flera bilar. Lämna tomt tills filen finns;
//                   nodnamnen på toppnivå loggas när filen laddas. ?nod=<namn> i testsidan provar ett namn.
//   finns         - true när filen ligger i modeller/. Delkartan listar bara sådana poster, eftersom
//                   den inte får göra anrop som misslyckas. Testsidan listar alla.
//   lack          - hur lacken färgas om till samma grå som den egna karossen (se forberedLack nedan):
//                   material = materialets namn (början räcker), mask = färgen i metallic-roughness-
//                   texturen som bara lackens pixlar har (R, G, B), tol = tillåten avvikelse per kanal.
// ============================================================
import { KAROSS_MATT } from './kaross.js';

const CC_BY = 'https://creativecommons.org/licenses/by/4.0/';
export const ALT_KAROSSER = [
  { id: 'comrade-wagon', namn: 'Generisk kombi', modell: 'Generic passenger car pack', del: ' (kombin)', fil: 'modeller/comrade-wagon.glb',
    upphovsperson: 'Comrade1280', licens: 'CC BY 4.0', licensLank: CC_BY, nod: '', finns: true,
    andring: 'bara kombin utplockad, skalad och omfärgad',
    lank: 'https://sketchfab.com/3d-models/generic-passenger-car-pack-20f9af9b8a404d5cb022ac6fe87f21f5',
    // Lacken delar basfärgstextur med lister, galler och gummi. Metallic-roughness-texturen har en egen
    // färg (255, 27, 0) för lackens yta, så den används som mask.
    lack: { material: 'Body', mask: [255, 27, 0], tol: [16, 14, 8] } },
  { id: 'han66st-wagon', namn: 'Lowpoly-kombi', modell: 'Lowpoly Sedan & Wagon', fil: 'modeller/han66st-wagon.glb',
    upphovsperson: 'Han66st', licens: 'CC BY 4.0', licensLank: CC_BY, nod: '',
    lank: 'https://sketchfab.com/3d-models/lowpoly-sedan-wagon-e11a46478c674b279fe9d299b2125c30' },
  { id: 'passat-anserkon', namn: 'Passat-kombi', modell: 'Generic USA/EU Station wagon', fil: 'modeller/passat-anserkon.glb',
    upphovsperson: 'Anserkon', licens: 'CC BY 4.0', licensLank: CC_BY, nod: '',
    lank: 'https://sketchfab.com/3d-models/generic-usaeu-station-wagon-c14f271c9d414b8e8d25e7cec3bb44f5' },
];

const LANGD = KAROSS_MATT.framX - KAROSS_MATT.bakX; // 4,52
const HJULBAS = KAROSS_MATT.axlar[0] - KAROSS_MATT.axlar[1]; // 2,76
const ARHJUL = /wheel|tire|tyre|rim|hjul|d[aä]ck|f[aä]lg|reifen|felge/i;
const ARGLAS = /glass|glas|window|windshield|windscreen|optics|lamp|light|lykt|head|tail|indicator|blinker|lens/i;

// Kreditraden som DOM-noder: titel, upphovsperson, licenslänk, källa och ändringen
export function kreditNoder(a) {
  const l = (href, text) => Object.assign(document.createElement('a'), { href, textContent: text, target: '_blank', rel: 'noopener' });
  return [`"${a.modell}"${a.del || ''} av ${a.upphovsperson}, `, l(a.licensLank, a.licens), ', ', l(a.lank, 'Sketchfab'), `, modifierad: ${a.andring || 'skalad'}.`];
}

// Opacitet 0..1. Glas och lyktor hålls genomskinliga men synliga även i röntgenläge.
export function altOpacitet(res, v) {
  for (const { m, bas, glas } of res.material) {
    if (glas) { m.transparent = true; m.depthWrite = false; m.opacity = Math.min(bas, 0.15 + 0.6 * v); }
    else { const fast = v >= 0.999; m.transparent = !fast; m.depthWrite = fast; m.opacity = bas * v; }
    m.needsUpdate = true;
  }
  res.grupp.visible = v > 0.001;
}

// Laddar filen och normaliserar den. opts: nod (nodnamn), navY (navets höjd: modellen ställs så att
// dess hjulcentrum hamnar där i stället för på marken), doljHjul (modellens egna hjul döljs).
// Returnerar { grupp, material, kx, tema(farg) } där tema färgar om lacken (THREE.Color, linjär).
export async function laddaAltKaross(THREE, a, opts = {}) {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const gltf = await new GLTFLoader().loadAsync(new URL(a.fil, import.meta.url).href);
  const res = normalisera(THREE, a, gltf.scene, opts);
  res.tema = a.lack ? forberedLack(THREE, a, res) : () => {};
  return res;
}

// Normalisering: längden längs x, framaxeln åt +x, hjulen över axlarna, står på marken (eller navet på navY)
function normalisera(THREE, a, rot, opts) {
  const namn = (o) => o.name || '(namnlös)';
  // Toppnivån: gå igenom omslagsnoder med ett enda barn (Sketchfab_model, root, ...)
  let topp = rot; const kedja = [];
  while (topp.children.length === 1 && !topp.children[0].isMesh) { topp = topp.children[0]; kedja.push(namn(topp)); }
  console.log(`[alt-kaross] ${a.id}: noder på toppnivå (under ${kedja.join(' / ') || 'scenen'}):`, topp.children.map(namn));
  const nodNamn = opts.nod || a.nod;
  let modell = rot;
  if (nodNamn) {
    let hit = rot.getObjectByName(nodNamn);
    if (!hit) rot.traverse((o) => { if (!hit && o.name && o.name.toLowerCase().includes(nodNamn.toLowerCase())) hit = o; });
    if (hit) { modell = hit; console.log(`[alt-kaross] använder noden "${namn(hit)}"`); }
    else console.warn(`[alt-kaross] noden "${nodNamn}" finns inte, använder hela filen`);
  } else if (topp.children.filter((o) => !ARHJUL.test(o.name)).length > 1) {
    console.log('[alt-kaross] flera noder på toppnivå. Sätt fältet nod i ALT_KAROSSER (eller ?nod=) om filen innehåller flera bilar.');
  }
  rot.updateMatrixWorld(true);
  // Bygg om till en platt grupp med geometrin i världskoordinater (enklare att normalisera)
  const ut = new THREE.Group(), material = [], hjulMesher = [];
  ut.name = `alt-kaross-${a.id}`;
  modell.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
    const mats = (Array.isArray(o.material) ? o.material : [o.material]).map((m0) => {
      const m = m0.clone(); m.side = THREE.DoubleSide;
      const glas = ARGLAS.test(`${o.name} ${m0.name}`) || (m0.transparent && m0.opacity < 0.99) || m0.transmission > 0;
      material.push({ m, bas: m0.transparent ? m0.opacity : 1, glas });
      return m;
    });
    const mesh = new THREE.Mesh(g, Array.isArray(o.material) ? mats : mats[0]);
    mesh.name = o.name;
    ut.add(mesh);
    if (ARHJUL.test(`${o.name} ${o.parent && o.parent.name}`)) hjulMesher.push(mesh);
  });
  // Längden ska ligga längs x: huvudriktningen i planvy (PCA) ur hjulens centrum, annars ur alla punkter.
  // Bilar i paket står ofta snett och utanför origo.
  const plan = [];
  if (hjulMesher.length >= 4) for (const m of hjulMesher) { const c = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()); plan.push([c.x, c.z]); }
  else {
    // utan hjulnamn: de lägsta 12 % av höjden (däcken), annars alla punkter
    const b0 = new THREE.Box3().setFromObject(ut), grans = b0.min.y + 0.12 * (b0.max.y - b0.min.y);
    for (const lag of [true, false]) {
      for (const m of ut.children) { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) if (!lag || p.getY(i) < grans) plan.push([p.getX(i), p.getZ(i)]); }
      if (plan.length >= 8) break;
    }
  }
  const mx = plan.reduce((t, p) => t + p[0], 0) / plan.length, mz = plan.reduce((t, p) => t + p[1], 0) / plan.length;
  let cxx = 0, czz = 0, cxz = 0;
  for (const [x, z] of plan) { cxx += (x - mx) ** 2; czz += (z - mz) ** 2; cxz += (x - mx) * (z - mz); }
  const vinkel = 0.5 * Math.atan2(2 * cxz, cxx - czz);
  for (const m of ut.children) { m.geometry.translate(-mx, 0, -mz); m.geometry.rotateY(vinkel); }
  let box = new THREE.Box3().setFromObject(ut), size = box.getSize(new THREE.Vector3());
  // Fronten: antas vara änden med kortast överhäng (som på E91:an); knappen Vänd i testsidan rättar om det blev fel
  // Hjulens centrum i längsled: ur namngivna mesher, annars ur geometrin (de lägsta 12 % av höjden är nästan bara däck)
  const mitt = (box.min.x + box.max.x) / 2;
  let fram = [], bak = [], kalla;
  if (hjulMesher.length) {
    kalla = `${hjulMesher.length} mesher med hjulnamn (${[...new Set(hjulMesher.map((m) => m.name))].slice(0, 8).join(', ')})`;
    for (const m of hjulMesher) { const c = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()); (c.x > mitt ? fram : bak).push(c.x); }
  }
  if (!fram.length || !bak.length) {
    fram = []; bak = [];
    const grans = box.min.y + 0.12 * size.y, v = new THREE.Vector3();
    for (const m of ut.children) {
      const p = m.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); if (v.y < grans) (v.x > mitt ? fram : bak).push(v.x); }
    }
    kalla = `geometrin (${fram.length + bak.length} punkter i de lägsta 12 % av höjden)`;
  }
  const medel = (l) => l.reduce((s, x) => s + x, 0) / l.length;
  if (!fram.length || !bak.length) { fram = [box.max.x - 0.167 * size.x]; bak = [box.min.x + 0.222 * size.x]; kalla = 'inga hjul hittade, E91:ans överhäng antas'; }
  let xf = medel(fram), xb = medel(bak);
  if (box.max.x - xf > xb - box.min.x) {
    for (const m of ut.children) m.geometry.rotateY(Math.PI);
    [xf, xb] = [-xb, -xf]; box = new THREE.Box3().setFromObject(ut);
  }
  console.log(`[alt-kaross] ${a.id}: vriden ${(vinkel * 180 / Math.PI).toFixed(1)} grader så att längden ligger längs x (ur ${plan.length} punkter)`);
  // Uniform skala till E91:ans längd, sedan extra skala längs x så att hjulbasen blir exakt 2,76
  const s = LANGD / size.x, kx = HJULBAS / ((xf - xb) * s);
  const axelMitt = (xf + xb) / 2, zMitt = (box.min.z + box.max.z) / 2;
  for (const m of ut.children) {
    m.geometry.translate(-axelMitt, -box.min.y, -zMitt);
    m.geometry.scale(s * kx, s, s);
  }
  // Sidled: med fyra hjul skalas bredden så att modellens spårvidd blir E91:ans (medel av 1 500 och 1 513),
  // annars sticker verktygets hjul ut ur hjulhusen på en smalare modell
  let kz = 1;
  if (hjulMesher.length >= 4) {
    const zs = hjulMesher.map((m) => Math.abs(new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()).z));
    const spar = 2 * medel(zs), mal = (KAROSS_MATT.sparvidd[0] + KAROSS_MATT.sparvidd[1]) / 2;
    if (spar > 0.5) { kz = mal / spar; for (const m of ut.children) m.geometry.scale(1, 1, kz); }
  }
  // Höjd: med navY ställs modellen så att hjulens centrum ligger på navY, så att hjulhusen hamnar runt
  // verktygets egna hjul. Annars står modellen på marken.
  let hojd = 'står på marken';
  if (opts.navY != null && hjulMesher.length) {
    const hb = new THREE.Box3(); for (const m of hjulMesher) hb.expandByObject(m);
    const navY = (hb.min.y + hb.max.y) / 2, r = (hb.max.y - hb.min.y) / 2;
    for (const m of ut.children) m.geometry.translate(0, opts.navY - navY, 0);
    hojd = `hjulens centrum flyttat ${Math.round((opts.navY - navY) * 1000)} mm till navY ${opts.navY.toFixed(3)} (modellens hjulradie ${Math.round(r * 1000)} mm)`;
  }
  for (const m of ut.children) { m.geometry.computeBoundingBox(); m.geometry.computeBoundingSphere(); }
  if (opts.doljHjul) for (const m of hjulMesher) m.visible = false;
  box = new THREE.Box3().setFromObject(ut); size = box.getSize(new THREE.Vector3());
  console.log(`[alt-kaross] ${a.id}: hjulen ur ${kalla}. Hjulbas i filen ${((xf - xb)).toFixed(3)} (enheter), skala ${s.toFixed(4)}, extra längs x ${kx.toFixed(3)}, i sidled ${kz.toFixed(3)} (spårvidden). ` +
    `Resultat: längd ${size.x.toFixed(3)} m, bredd ${size.z.toFixed(3)} m, höjd ${size.y.toFixed(3)} m, axlar x = +-${(HJULBAS / 2).toFixed(2)}, ${hojd}.`);
  return { grupp: ut, material, kx };
}

// ---------- Lacken: omfärgning till den egna karossens grå ----------
// Lacken ligger i samma basfärgstextur som lister, galler och gummi, så materialets färg kan inte
// bara bytas (då färgas allt). I stället väljs lackens pixlar ut med masken i metallic-roughness-
// texturen, och för dem räknas den inbakade skuggningen fram som ljushet (linjär luminans) relativt
// lackens typiska ljushet, uppmjukad (se nedan). Ny pixel = vald grå x skuggningen, i linjärt ljus.
// Övriga pixlar (lister, galler, gummi, däck) lämnas orörda.
// tema(farg) skriver om texturen med en ny grå (THREE.Color, linjära värden) vid temaväxling.
function forberedLack(THREE, a, res) {
  const cfg = a.lack;
  const post = res.material.find(({ m }) => (m.name || '').startsWith(cfg.material) && m.map);
  if (!post) { console.warn(`[alt-kaross] ${a.id}: hittar inget lackmaterial "${cfg.material}" med textur`); return () => {}; }
  const m = post.m, karta = m.map, maskKarta = m.metalnessMap || m.roughnessMap;
  const pixlar = (bild) => {
    const c = document.createElement('canvas'); c.width = bild.width; c.height = bild.height;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bild, 0, 0);
    return { c, x, d: x.getImageData(0, 0, c.width, c.height) };
  };
  const bas = pixlar(karta.image);
  const w = bas.c.width, h = bas.c.height;
  let mask = null;
  if (maskKarta && maskKarta.image && maskKarta.image.width === w && maskKarta.image.height === h) mask = pixlar(maskKarta.image).d.data;
  else console.warn(`[alt-kaross] ${a.id}: ingen mask i samma storlek, all färgad yta räknas som lack`);
  const src = bas.d.data;
  const tillLin = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const c = i / 255; tillLin[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
  const tillSrgb = new Uint8ClampedArray(4096);
  for (let i = 0; i < 4096; i++) { const c = i / 4095; tillSrgb[i] = Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)); }
  const idx = [], lum = [];
  const [mr, mg, mb] = cfg.mask, [tr, tg, tb] = cfg.tol;
  for (let i = 0; i < src.length; i += 4) {
    const ok = mask ? Math.abs(mask[i] - mr) <= tr && Math.abs(mask[i + 1] - mg) <= tg && Math.abs(mask[i + 2] - mb) <= tb
      : Math.max(src[i], src[i + 1], src[i + 2]) - Math.min(src[i], src[i + 1], src[i + 2]) > 20;
    if (!ok) continue;
    idx.push(i);
    lum.push(0.2126 * tillLin[src[i]] + 0.7152 * tillLin[src[i + 1]] + 0.0722 * tillLin[src[i + 2]]);
  }
  // Referens: 75:e percentilen av lackens kulörta pixlar (den ljusa, oskuggade lacken) blir skuggning 1
  const kulort = [];
  for (let k = 0; k < idx.length; k++) { const i = idx[k]; if (Math.max(src[i], src[i + 1], src[i + 2]) - Math.min(src[i], src[i + 1], src[i + 2]) > 20) kulort.push(lum[k]); }
  kulort.sort((x, y) => x - y);
  const ref = kulort.length ? kulort[Math.floor(kulort.length * 0.75)] : 1;
  // Den inbakade skuggningen är kraftig (sidorna är mycket mörkare än taket i texturen), så den mjukas upp
  // med exponenten 0,3 för kulörta pixlar (en sida på 35 % blir 73 %, ett hjulhus på 5 % blir 41 %).
  // Neutrala pixlar inom masken (svarta fogar, skuggade skarvar) behåller sin ljushet och blir inte grå.
  const skugga = Float32Array.from(lum, (l, k) => {
    const i = idx[k], kroma = Math.max(src[i], src[i + 1], src[i + 2]) - Math.min(src[i], src[i + 1], src[i + 2]);
    const s = l / ref, w = Math.max(0, Math.min(1, (kroma - 8) / 24));
    return Math.min(1.1, s + w * (s ** 0.3 - s));
  });
  console.log(`[alt-kaross] ${a.id}: lacken omfärgas, ${idx.length} pixlar av ${w * h} (${Math.round(100 * idx.length / (w * h))} %) i materialet ${m.name}`);
  const ut = new ImageData(new Uint8ClampedArray(src), w, h), d = ut.data;
  const tex = new THREE.CanvasTexture(bas.c);
  for (const k of ['flipY', 'wrapS', 'wrapT', 'channel', 'magFilter', 'minFilter', 'anisotropy', 'offset', 'repeat', 'rotation', 'center']) {
    if (karta[k] && karta[k].isVector2) tex[k].copy(karta[k]); else if (k in karta) tex[k] = karta[k];
  }
  tex.colorSpace = THREE.SRGBColorSpace;
  m.map = tex; m.color.set(0xffffff); m.needsUpdate = true;
  return (farg) => {
    const r = farg.r * 4095, g = farg.g * 4095, b = farg.b * 4095;
    for (let k = 0; k < idx.length; k++) {
      const i = idx[k], s = skugga[k];
      d[i] = tillSrgb[Math.min(4095, r * s) | 0]; d[i + 1] = tillSrgb[Math.min(4095, g * s) | 0]; d[i + 2] = tillSrgb[Math.min(4095, b * s) | 0];
    }
    bas.x.putImageData(ut, 0, 0);
    tex.needsUpdate = true;
  };
}
