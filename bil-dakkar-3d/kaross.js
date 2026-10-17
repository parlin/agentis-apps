// ============================================================
// Kaross: BMW E91 325xi Touring 2007 (pre-LCI) som subdivision-modell
//
// Metod: ett grovt kontrollnät (ca 750 fyrhörningar, halva bilen byggs och speglas kring z=0)
// släts ut med Catmull-Clark i två nivåer (egen kompakt implementation nedan, med skarpa och
// halvskarpa kanter). Kontrollpunkterna justeras först några varv så att den utslätade ytan går
// GENOM de uppmätta punkterna i stället för att krympa innanför dem.
// Rutor, svarta stolpar, lyktor, njurar m.m. är egna tunna ytor som projiceras ned på lacken
// via djupkartor (sida, topp, fram, bak, snett fram) och läggs några mm utanför den.
//
// Koordinater i meter: x längs bilen (+ fram), y höjd, z sidled (+ höger), origo på marken mitt
// mellan axlarna. Axlar x = +-1,38.
//
// Källor för proportionerna:
// - BMW:s måttskiss för E91 Touring 2007 (fram, sida, topp, bak), läst ur getoutlines.com
//   "2007 BMW 3 Series E91 Touring Wagon blueprints" (märkt Creative Commons),
//   https://getoutlines.com/blueprints/6702/2007-bmw-3-series-e91-touring-wagon-blueprints .
//   Skalad mot hjulbas 2 760 och längd 4 520. Endast mått är avlästa (profil-, topp- och
//   tvärsnittskurvor), ritningen är inte kopierad eller inbäddad.
//   Ur skissen: överhäng fram 755 och bak 1 005, bredd 1 817 (2 013 med speglar), höjd 1 418,
//   spårvidd 1 500 / 1 513.
// - BMW:s tekniska data för E91 (samma huvudmått).
// - Uppmätt på projektets bil (Bil-Dakkar, 31_falgar_och_dimensioner.md del 13 och 15):
//   hjulhusöppningens topp 670 mm fram och 665 mm bak över marken, öppningen 740 mm i längsled.
// ============================================================

export const KAROSS_MATT = {
  axlar: [1.38, -1.38],
  sparvidd: [1.500, 1.513],
  framX: 2.135, bakX: -2.385,
  hjulhus: [{ x: 1.38, cy: 0.300, r: 0.37 }, { x: -1.38, cy: 0.295, r: 0.37 }],
};

// ---------- Hjälpfunktioner ----------
const tab = (par) => {
  const p = par.slice().sort((a, b) => a[0] - b[0]);
  return (x) => {
    if (x <= p[0][0]) return p[0][1];
    for (let i = 1; i < p.length; i++) if (x <= p[i][0]) {
      const t = (x - p[i - 1][0]) / (p[i][0] - p[i - 1][0]);
      return p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t;
    }
    return p[p.length - 1][1];
  };
};
const lerp = (a, b, t) => a + (b - a) * t;
const klamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- Profiltabeller (avlästa ur måttskissen, z skalad till bredd 1 817) ----------
// Största halva bredd i planvy
const ZMAX = tab([[2.00, 0.70], [1.92, 0.79], [1.79, 0.857], [1.75, 0.866], [1.68, 0.878], [1.56, 0.885], [1.38, 0.893], [1.20, 0.90], [0.86, 0.905], [0.30, 0.908], [0, 0.9085], [-0.40, 0.9085], [-1.01, 0.906], [-1.38, 0.908], [-1.56, 0.905], [-1.68, 0.893], [-1.75, 0.885], [-1.79, 0.875], [-1.95, 0.845], [-2.12, 0.80], [-2.25, 0.72]]);
// Skärmens överkant fram, bältlinjen (rutornas underkant) bakom A-stolpen
const KANT = tab([[2.00, 0.70], [1.92, 0.72], [1.79, 0.745], [1.56, 0.78], [1.38, 0.815], [1.20, 0.84], [1.01, 0.862], [0.97, 0.868], [0.86, 0.885], [0.62, 0.905], [0.30, 0.92], [0, 0.94], [-0.40, 0.95], [-0.80, 0.958], [-1.38, 0.968], [-1.95, 0.975], [-2.12, 0.98], [-2.25, 0.985]]);
// Skulderlinjen (skarp karaktärslinje från strålkastaren till baklyktan, stiger bakåt)
const SKULDRA = tab([[2.00, 0.66], [1.92, 0.69], [1.79, 0.715], [1.56, 0.728], [1.38, 0.74], [1.20, 0.738], [1.01, 0.735], [0.86, 0.738], [0.62, 0.75], [0.30, 0.77], [0, 0.79], [-0.40, 0.808], [-0.80, 0.825], [-1.01, 0.832], [-1.38, 0.84], [-1.79, 0.847], [-1.95, 0.85], [-2.25, 0.85]]);
// Tröskellinjen (stiger bakåt) och underkanten
const TROSKEL = tab([[2.00, 0.30], [1.79, 0.30], [0.97, 0.30], [0, 0.33], [-0.97, 0.44], [-1.79, 0.42], [-2.12, 0.44], [-2.25, 0.42]]);
const BOTTEN = tab([[2.00, 0.19], [1.92, 0.185], [1.79, 0.18], [0.97, 0.175], [-0.97, 0.18], [-1.79, 0.23], [-1.95, 0.235], [-2.12, 0.245], [-2.25, 0.25]]);
// Motorhuv: mitthöjd, de två längsgående vecken och huvens skarv mot skärmen (halv bredd)
const HUV = tab([[2.00, 0.725], [1.92, 0.765], [1.79, 0.81], [1.68, 0.84], [1.56, 0.862], [1.38, 0.89], [1.20, 0.918], [1.01, 0.945], [0.97, 0.952]]);
const VECK = tab([[2.00, 0.40], [1.92, 0.47], [1.79, 0.53], [1.56, 0.59], [1.38, 0.635], [1.20, 0.675], [1.01, 0.705], [0.97, 0.71]]);
const FOG = tab([[2.00, 0.55], [1.92, 0.63], [1.79, 0.70], [1.56, 0.745], [1.38, 0.765], [1.20, 0.784], [1.01, 0.797], [0.97, 0.80]]);
// Tak: mitthöjd och takkant (rutornas överkant)
const TAK = tab([[0.0, 1.39], [-0.40, 1.416], [-0.80, 1.418], [-1.38, 1.412], [-1.56, 1.408], [-1.79, 1.40]]);
const DROPP_Y = tab([[0, 1.335], [-1.79, 1.33]]);
const DROPP_Z = tab([[0, 0.63], [-1.79, 0.625]]);
// A-stolpen: från huvens bakkant (x 0,84) till takets framkant (x 0)
const aStolpe = (x) => { const t = klamp((0.84 - x) / 0.84, 0, 1); return { t, y: 0.91 + 0.425 * t, z: 0.78 - 0.15 * t }; };
// Vindrutans mittlinje (lätt bombering)
const vindrutaY = (xc) => { const t = klamp((0.88 - xc) / 0.88, 0, 1); return 0.965 + 0.425 * t + 0.03 * Math.sin(Math.PI * t); };

// Stationer längs bilen (x vid sidan). Tätare kring hjulhusen: ax +-0,41 (hörn), 0,37, 0,22, 0.
const ST = [2.00, 1.92, 1.79, 1.75, 1.60, 1.38, 1.16, 1.01, 0.97, 0.86, 0.62, 0.30, 0.0, -0.40, -0.80, -0.97, -1.01, -1.16, -1.38, -1.60, -1.75, -1.79, -1.95, -2.12, -2.25];
const NI = ST.length - 1; // 24
const I_HUV = ST.indexOf(0.97), I_TAK = ST.indexOf(0.0), I_TAKSLUT = ST.indexOf(-1.95);

function hjulhus(x) {
  for (const h of KAROSS_MATT.hjulhus) {
    const d = Math.abs(x - h.x);
    if (d < h.r + 0.005) return { y: h.cy + Math.sqrt(Math.max(0, h.r * h.r - d * d)), hors: false };
    if (d < h.r + 0.05) return { y: null, hors: true }; // hörnet där öppningen möter tröskel/stötfångare
  }
  return null;
}

// Karossens tvärsnitt över taket/huven: k = 0 (mitt) .. 6 (bältlinjen / skärmkanten). Returnerar [x, y, z].
function takPunkt(i) {
  const xs = ST[i];
  const zb = ZMAX(xs) - (i <= I_HUV ? 0.045 : 0.09), yb = KANT(xs);
  const P = [];
  if (i <= I_HUV) { // motorhuv
    const yH = HUV(xs), cz = VECK(xs), sz = FOG(xs);
    const dxc = i === 0 ? 0.05 : i === 1 ? 0.02 : 0;
    const zy = [[0, yH], [cz * 0.5, yH - 0.003], [cz, yH - 0.017], [(cz + sz) / 2, yH - 0.03], [sz, yH - 0.04],
      [(sz + zb) / 2 + 0.008, yb + (yH - 0.04 - yb) * 0.75], [zb, yb]];
    for (const [z, y] of zy) P.push([xs + dxc * (1 - Math.pow(z / zb, 2.2)), y, z]);
  } else if (i < I_TAK) { // vindruta och A-stolpe
    const A = aStolpe(xs), xc = xs + 0.02, yc = vindrutaY(xc), d = yc - A.y;
    const zy = [[0, yc], [0.3 * A.z, yc - 0.08 * d], [0.58 * A.z, yc - 0.3 * d], [0.82 * A.z, yc - 0.62 * d], [A.z, A.y],
      [(A.z + zb) / 2 + 0.012, (A.y + yb) / 2], [zb, yb]];
    for (const [z, y] of zy) P.push([xs + 0.02 * Math.max(0, 1 - (z / A.z) ** 2), y, z]);
  } else if (i < I_TAKSLUT) { // tak
    const yc = TAK(xs), zT = DROPP_Z(xs), yT = DROPP_Y(xs);
    const zy = [[0, yc], [0.2, yc - 0.002], [0.40, yc - 0.01], [0.56, yc - 0.022], [zT, yT], [(zT + zb) / 2 + 0.012, (yT + yb) / 2], [zb, yb]];
    for (const [z, y] of zy) P.push([xs, y, z]);
  } else if (i === I_TAKSLUT) { // takets bakkant, bakluckans överkant
    const pk = [[-1.93, 1.355, 0], [-1.93, 1.353, 0.2], [-1.935, 1.348, 0.40], [-1.94, 1.335, 0.55], [-1.95, 1.305, 0.615]];
    for (const p of pk) P.push(p);
    P.push([-1.95, (1.305 + yb) / 2, (0.615 + zb) / 2 + 0.012], [-1.95, yb, zb]);
  } else if (i === NI - 1) { // bakrutan mitt, D-stolpen
    P.push([-2.10, 1.135, 0], [-2.10, 1.133, 0.2], [-2.095, 1.128, 0.38], [-2.09, 1.12, 0.50], [-2.085, 1.11, 0.59], [-2.10, 1.04, 0.66], [-2.12, yb, ZMAX(xs) - 0.07]);
  } else { // bakrutans underkant / bakre bältlinjen
    P.push([-2.255, 0.99, 0], [-2.255, 0.99, 0.2], [-2.252, 0.99, 0.38], [-2.25, 0.989, 0.50], [-2.248, 0.988, 0.57], [-2.248, 0.987, 0.62], [-2.25, yb, ZMAX(xs) - 0.06]);
  }
  return P;
}

// Sidans rader: j = 0 underkant/hjulhuskant, 1 tröskellinje/hjulhuslist, 2, 3, 4 skulderlinje (5 = bältet = takPunkt k6)
function sidPunkt(i) {
  const xs = ST[i], zm = ZMAX(xs), j4 = SKULDRA(xs), hh = hjulhus(xs);
  let y, z;
  if (hh && !hh.hors) {
    const a = hh.y;
    y = [a, a + Math.min(0.02, (j4 - a) * 0.25), a + (j4 - a) * 0.4, a + (j4 - a) * 0.7, j4];
    z = [zm - 0.01, zm + 0.006, zm - 0.004, zm, zm - 0.003];
  } else {
    const j1 = TROSKEL(xs), j3 = j4 - 0.12;
    y = [BOTTEN(xs), j1, (j1 + j3) / 2, j3, j4];
    z = [zm - 0.04, zm - 0.018, zm - 0.004, zm, zm - 0.003];
  }
  return y.map((yy, j) => [xs, yy, z[j]]);
}

// ---------- Kontrollnätet ----------
function byggNat() {
  const V = [], nyckel = new Map();
  const ny = (k, p) => { nyckel.set(k, V.length); V.push(p); };
  const tak = [], sid = [];
  for (let i = 0; i <= NI; i++) { tak.push(takPunkt(i)); sid.push(sidPunkt(i)); }
  for (let i = 0; i <= NI; i++) for (let k = 0; k <= 6; k++) ny(`c${i},${k}`, tak[i][k]);
  for (let i = 0; i <= NI; i++) for (let j = 0; j < 5; j++) ny(`s${i},${j}`, sid[i][j]);
  // Front- och bakvägg: kolumner k = 0..5 över fronten, rader j = 0..4. Kolumn 6 = sidans hörnstation.
  const FY = [0.20, 0.30, 0.42, 0.54, 0.66], FX = [2.10, 2.13, 2.135, 2.125, 2.10];
  const BY = [0.25, 0.42, 0.60, 0.76, 0.90], BX = [-2.36, -2.385, -2.34, -2.285, -2.27];
  const vagg = (pre, i, YC, XC) => {
    const capZ6 = tak[i][6][2];
    for (let k = 0; k < 6; k++) for (let j = 0; j < 5; j++) {
      const hörn = sid[i][j], zc = hörn[2];
      const z = tak[i][k][2] / capZ6 * zc, s = z / zc;
      ny(`${pre}${k},${j}`, [XC[j] + (hörn[0] - XC[j]) * Math.pow(s, 2.2), lerp(YC[j], hörn[1], s * s), z]);
    }
  };
  vagg('f', 0, FY, FX);
  vagg('b', NI, BY, BX);

  const C = (i, k) => nyckel.get(`c${i},${k}`);
  const S = (i, j) => (j === 5 ? C(i, 6) : nyckel.get(`s${i},${j}`));
  const Fv = (k, j) => (k === 6 ? S(0, j) : j === 5 ? C(0, k) : nyckel.get(`f${k},${j}`));
  const Bv = (k, j) => (k === 6 ? S(NI, j) : j === 5 ? C(NI, k) : nyckel.get(`b${k},${j}`));
  const F = [];
  for (let i = 0; i < NI; i++) for (let k = 0; k < 6; k++) F.push([C(i, k), C(i + 1, k), C(i + 1, k + 1), C(i, k + 1)]);
  for (let i = 0; i < NI; i++) for (let j = 0; j < 5; j++) F.push([S(i, j), S(i, j + 1), S(i + 1, j + 1), S(i + 1, j)]);
  for (let k = 0; k < 6; k++) for (let j = 0; j < 5; j++) F.push([Fv(k, j), Fv(k, j + 1), Fv(k + 1, j + 1), Fv(k + 1, j)]);
  for (let k = 0; k < 6; k++) for (let j = 0; j < 5; j++) F.push([Bv(k, j), Bv(k + 1, j), Bv(k + 1, j + 1), Bv(k, j + 1)]);

  // Skarpa kanter (skärpa = antal nivåer kanten hålls skarp)
  const skarp = [];
  const kant = (a, b, s) => skarp.push([a, b, s]);
  for (let i = 0; i < NI; i++) kant(S(i, 4), S(i + 1, 4), 2);                  // skulderlinjen
  for (let i = 0; i < I_HUV; i++) kant(C(i, 2), C(i + 1, 2), 2);              // huvens veck
  for (let i = 2; i < NI - 3; i++) kant(S(i, 1), S(i + 1, 1), 1);             // tröskellinje och hjulhuslist
  for (let i = I_HUV; i < NI; i++) { kant(C(i, 6), C(i + 1, 6), 1); kant(C(i, 4), C(i + 1, 4), 1); } // bälte, A-stolpe/takkant
  for (let k = 0; k < 6; k++) { kant(C(0, k), C(0, k + 1), 1); kant(C(I_TAKSLUT, k), C(I_TAKSLUT, k + 1), 1); kant(C(NI, k), C(NI, k + 1), 1); }
  for (let k = 0; k < 6; k++) kant(Bv(k, 4), Bv(k + 1, 4), 1);                  // skulderlinjen fortsätter över bakpartiet
  const horn = [];
  ST.forEach((x, i) => { const h = hjulhus(x); if (h && h.hors) horn.push(S(i, 0)); });

  // Spegla till vänster sida och svetsa mittlinjen
  const n = V.length, spegel = new Array(n);
  for (let i = 0; i < n; i++) {
    if (Math.abs(V[i][2]) < 1e-6) { spegel[i] = i; V[i][2] = 0; }
    else { spegel[i] = V.length; V.push([V[i][0], V[i][1], -V[i][2]]); }
  }
  const nF = F.length;
  for (let f = 0; f < nF; f++) F.push(F[f].map((v) => spegel[v]).reverse());
  const nS = skarp.length;
  for (let s = 0; s < nS; s++) skarp.push([spegel[skarp[s][0]], spegel[skarp[s][1]], skarp[s][2]]);
  const H = new Set(horn); for (const h of horn) H.add(spegel[h]);
  const SK = new Map();
  for (const [a, b, s] of skarp) SK.set(a < b ? a * 1e6 + b : b * 1e6 + a, s);
  return { V, F, S: SK, H };
}

// ---------- Catmull-Clark med skarpa kanter ----------
function catmullClark({ V, F, S, H }) {
  const nV = V.length, ek = (a, b) => (a < b ? a * 1e6 + b : b * 1e6 + a);
  const kanter = new Map(), E = [];
  F.forEach((f, fi) => {
    for (let c = 0; c < f.length; c++) {
      const a = f[c], b = f[(c + 1) % f.length], k = ek(a, b);
      let e = kanter.get(k);
      if (!e) { e = { a, b, f: [], s: S.get(k) || 0, i: E.length }; kanter.set(k, e); E.push(e); }
      e.f.push(fi);
    }
  });
  const medel = (pts) => { const m = [0, 0, 0]; for (const p of pts) { m[0] += p[0]; m[1] += p[1]; m[2] += p[2]; } return m.map((v) => v / pts.length); };
  const FP = F.map((f) => medel(f.map((i) => V[i])));
  const arSkarp = (e) => e.f.length < 2 || e.s > 0;
  const EP = E.map((e) => (arSkarp(e) ? medel([V[e.a], V[e.b]]) : medel([V[e.a], V[e.b], FP[e.f[0]], FP[e.f[1]]])));
  const vE = Array.from({ length: nV }, () => []), vF = Array.from({ length: nV }, () => []);
  for (const e of E) { vE[e.a].push(e); vE[e.b].push(e); }
  F.forEach((f, fi) => { for (const v of f) vF[v].push(fi); });
  const VP = V.map((p, i) => {
    const es = vE[i]; if (!es.length) return p.slice();
    const sk = es.filter(arSkarp);
    if (H.has(i) || sk.length > 2) return p.slice();
    if (sk.length === 2) {
      const o1 = V[sk[0].a === i ? sk[0].b : sk[0].a], o2 = V[sk[1].a === i ? sk[1].b : sk[1].a];
      return [0, 1, 2].map((d) => (o1[d] + 6 * p[d] + o2[d]) / 8);
    }
    const n = es.length, Fm = medel(vF[i].map((f) => FP[f])), Rm = medel(es.map((e) => medel([V[e.a], V[e.b]])));
    return [0, 1, 2].map((d) => (Fm[d] + 2 * Rm[d] + (n - 3) * p[d]) / n);
  });
  const nyV = VP.concat(EP, FP), nE = E.length, nyF = [], nyS = new Map();
  F.forEach((f, fi) => {
    const m = f.length;
    for (let c = 0; c < m; c++) {
      const e1 = kanter.get(ek(f[c], f[(c + 1) % m])), e0 = kanter.get(ek(f[(c + m - 1) % m], f[c]));
      nyF.push([f[c], nV + e1.i, nV + nE + fi, nV + e0.i]);
    }
  });
  for (const e of E) if (e.s > 1) { nyS.set(ek(e.a, nV + e.i), e.s - 1); nyS.set(ek(nV + e.i, e.b), e.s - 1); }
  return { V: nyV, F: nyF, S: nyS, H };
}

// Låt den utslätade ytan gå genom målpunkterna: flytta kontrollpunkterna med felet några varv.
function interpolera(nat, varv = 3) {
  const mal = nat.V.map((p) => p.slice());
  let V = nat.V.map((p) => p.slice());
  for (let it = 0; it < varv; it++) {
    const R = catmullClark(catmullClark({ ...nat, V }));
    V = V.map((p, i) => [0, 1, 2].map((d) => p[d] + (mal[i][d] - R.V[i][d])));
  }
  return { ...nat, V };
}

// ---------- Djupkarta: projicera punkter ned på lacken längs en riktning ----------
function djupkarta(THREE, pos, nor, index, u, v, w, a0, a1, b0, b1, h = 0.01) {
  const W = Math.ceil((a1 - a0) / h) + 1, Hh = Math.ceil((b1 - b0) / h) + 1;
  const D = new Float32Array(W * Hh).fill(-1e9), N = new Float32Array(W * Hh * 3);
  const n = pos.length / 3, A = new Float32Array(n), B = new Float32Array(n), Dd = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    A[i] = x * u[0] + y * u[1] + z * u[2]; B[i] = x * v[0] + y * v[1] + z * v[2]; Dd[i] = x * w[0] + y * w[1] + z * w[2];
  }
  for (let t = 0; t < index.length; t += 3) {
    const i0 = index[t], i1 = index[t + 1], i2 = index[t + 2];
    const ax = A[i0], ay = B[i0], bx = A[i1], by = B[i1], cx = A[i2], cy = B[i2];
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(den) < 1e-14) continue;
    const ia0 = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - a0) / h)), ia1 = Math.min(W - 1, Math.floor((Math.max(ax, bx, cx) - a0) / h));
    const ib0 = Math.max(0, Math.ceil((Math.min(ay, by, cy) - b0) / h)), ib1 = Math.min(Hh - 1, Math.floor((Math.max(ay, by, cy) - b0) / h));
    for (let ib = ib0; ib <= ib1; ib++) for (let ia = ia0; ia <= ia1; ia++) {
      const pa = a0 + ia * h, pb = b0 + ib * h;
      const l0 = ((by - cy) * (pa - cx) + (cx - bx) * (pb - cy)) / den;
      const l1 = ((cy - ay) * (pa - cx) + (ax - cx) * (pb - cy)) / den;
      const l2 = 1 - l0 - l1;
      if (l0 < -1e-5 || l1 < -1e-5 || l2 < -1e-5) continue;
      const d = l0 * Dd[i0] + l1 * Dd[i1] + l2 * Dd[i2], c = ib * W + ia;
      if (d > D[c]) {
        D[c] = d;
        for (let k = 0; k < 3; k++) N[c * 3 + k] = l0 * nor[i0 * 3 + k] + l1 * nor[i1 * 3 + k] + l2 * nor[i2 * 3 + k];
      }
    }
  }
  const U = new THREE.Vector3(...u), Vv = new THREE.Vector3(...v), Wv = new THREE.Vector3(...w);
  return {
    // Returnerar { p, n } på lacken för kartkoordinaterna (a, b), eller null utanför bilen
    prov(a, b) {
      const fa = (a - a0) / h, fb = (b - b0) / h, ia = Math.floor(fa), ib = Math.floor(fb), ta = fa - ia, tb = fb - ib;
      let sw = 0, d = 0; const nn = new THREE.Vector3();
      for (const [da, db, wt] of [[0, 0, (1 - ta) * (1 - tb)], [1, 0, ta * (1 - tb)], [0, 1, (1 - ta) * tb], [1, 1, ta * tb]]) {
        const x = ia + da, y = ib + db; if (x < 0 || y < 0 || x >= W || y >= Hh) continue;
        const c = y * W + x; if (D[c] < -1e8 || wt <= 0) continue;
        sw += wt; d += wt * D[c]; nn.x += wt * N[c * 3]; nn.y += wt * N[c * 3 + 1]; nn.z += wt * N[c * 3 + 2];
      }
      if (sw < 1e-6) return null;
      const p = U.clone().multiplyScalar(a).addScaledVector(Vv, b).addScaledVector(Wv, d / sw);
      return { p, n: nn.normalize() };
    },
  };
}

export function byggKaross(THREE, opts = {}) {
  // ---------- Material ----------
  const std = (o) => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, transparent: true, ...o });
  const M = {
    lack: opts.lack || std({ color: 0x9aa3ad, roughness: 0.38, metalness: 0.25 }),
    glas: opts.glas || std({ color: 0x24303c, roughness: 0.05, metalness: 0.4, opacity: 0.82, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    svart: std({ color: 0x0f1012, roughness: 0.55, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    innerskarm: std({ color: 0x0c0d0f, roughness: 0.9 }),
    lyse: std({ color: 0x59636e, roughness: 0.15, metalness: 0.7, emissive: 0x15181c, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    bak: std({ color: 0xa3121c, roughness: 0.2, metalness: 0.1, emissive: 0x3a0306, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    bryn: std({ color: 0xf2f2f0, roughness: 0.2, emissive: 0x6a6a68, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    krom: std({ color: 0xc9ced4, roughness: 0.2, metalness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    alu: std({ color: 0xa9aeb5, roughness: 0.35, metalness: 0.7 }),
    skylt: std({ color: 0xf1f1ee, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  };
  M.lack.side = THREE.DoubleSide;
  const fog = new THREE.LineBasicMaterial({ color: 0x2b2f35, transparent: true, opacity: 0.8 });
  for (const m of Object.values(M)) m.userData.bas = m.opacity;
  fog.userData.bas = 0.8;

  // ---------- Lacken ----------
  let nat = interpolera(byggNat(), 3);
  nat = catmullClark(catmullClark(nat));
  const pos = new Float32Array(nat.V.length * 3);
  nat.V.forEach((p, i) => pos.set(p, i * 3));
  const ind = [];
  for (const f of nat.F) ind.push(f[0], f[1], f[2], f[0], f[2], f[3]);
  const lackGeo = new THREE.BufferGeometry();
  lackGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  lackGeo.setIndex(ind);
  lackGeo.computeVertexNormals();
  const lack = new THREE.Mesh(lackGeo, M.lack);
  lack.name = 'lack';
  lack.renderOrder = 10;

  const nor = lackGeo.attributes.normal.array;
  const karta = (u, v, w, a0, a1, b0, b1) => djupkarta(THREE, pos, nor, ind, u, v, w, a0, a1, b0, b1);
  const SIDA = karta([1, 0, 0], [0, 1, 0], [0, 0, 1], -2.45, 2.2, 0.1, 1.5);   // (x, y) höger sida
  const TOPP = karta([1, 0, 0], [0, 0, 1], [0, 1, 0], -2.45, 2.2, -1.0, 1.0);  // (x, z) uppifrån
  const FRAM = karta([0, 0, 1], [0, 1, 0], [1, 0, 0], -1.0, 1.0, 0.1, 1.0);    // (z, y) framifrån
  const BAK = karta([0, 0, 1], [0, 1, 0], [-1, 0, 0], -1.0, 1.0, 0.1, 1.45);   // (z, y) bakifrån
  const s45 = Math.SQRT1_2;
  const DIAG = karta([s45, 0, -s45], [0, 1, 0], [s45, 0, s45], 0.3, 1.7, 0.3, 1.0);   // snett fram höger
  const DIAGB = karta([s45, 0, s45], [0, 1, 0], [-s45, 0, s45], -2.0, -0.8, 0.5, 1.2); // snett bak höger

  // Lapp: linjerad yta mellan polylinjerna A och B (lika många punkter, kartkoordinater), offset mm utåt
  function lapp(K, A, B, nv, off) {
    const p = [], idx = [], nu = A.length;
    let senast = null;
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const t = j / (nv - 1), s = K.prov(lerp(A[i][0], B[i][0], t), lerp(A[i][1], B[i][1], t));
      const q = s ? s.p.addScaledVector(s.n, off) : senast;
      senast = q; p.push(q.x, q.y, q.z);
    }
    for (let i = 0; i < nu - 1; i++) for (let j = 0; j < nv - 1; j++) {
      const a = i * nv + j, b = a + nv;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  const spegla = (g) => {
    const s = g.clone(); s.scale(1, 1, -1);
    const ix = s.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    s.computeVertexNormals(); return s;
  };
  const prov = (n, f) => Array.from({ length: n }, (_, i) => f(i / (n - 1)));
  // Superellips (rundad rektangel) som undre och övre halva, båda från vänster till höger
  const rundRekt = (ca, cb, ha, hb, e = 4, n = 24) => [
    prov(n, (t) => { const f = Math.PI + Math.PI * t; return [ca + ha * Math.sign(Math.cos(f)) * Math.abs(Math.cos(f)) ** (2 / e), cb - hb * Math.abs(Math.sin(f)) ** (2 / e)]; }),
    prov(n, (t) => { const f = Math.PI - Math.PI * t; return [ca + ha * Math.sign(Math.cos(f)) * Math.abs(Math.cos(f)) ** (2 / e), cb + hb * Math.abs(Math.sin(f)) ** (2 / e)]; }),
  ];

  const grupp = (namn) => { const g = new THREE.Group(); g.name = namn; return g; };
  const glas = grupp('glas'), svart = grupp('svart'), lyktor = grupp('lyktor'), detaljer = grupp('detaljer');
  const mesh = (g, mat, gr, ro = 12, parvis = false) => {
    const m = new THREE.Mesh(g, mat); m.renderOrder = ro; gr.add(m);
    if (parvis) { const s = new THREE.Mesh(spegla(g), mat); s.renderOrder = ro; gr.add(s); }
    return m;
  };

  // ---------- Sidorutor och svarta B/C-stolpar ----------
  const balte = (x) => KANT(x);
  const takkant = (x) => DROPP_Y(Math.min(0, x));
  // Överkant på rutorna: A-stolpens bakkant fram, takkanten, D-stolpen bak
  const dloTopp = (x) => {
    let y = Math.min(takkant(x) - 0.012, 0.92 + (0.62 - x) * 0.613);
    if (x < -1.45) y = Math.min(y, tab([[-1.45, 1.323], [-1.6, 1.27], [-1.7, 1.232], [-1.8, 1.178], [-1.85, 1.125], [-1.90, 1.065], [-1.935, 1.025]])(x));
    return y;
  };
  // Underkant: bältet, med Hofmeister-knicken som drar upp rutans bakre hörn
  const dloBotten = (x) => balte(x) + (x < -1.80 ? 0.05 * Math.min(1, ((-1.80 - x) / 0.135)) ** 1.6 : 0);
  const sidRuta = (x0, x1, inset, off, mat, gr, ro) => {
    const n = Math.max(6, Math.round((x0 - x1) / 0.05));
    const A = [], B = [];
    for (let i = 0; i < n; i++) {
      const x = lerp(x0, x1, i / (n - 1)), lo = dloBotten(x) + inset, hi = Math.max(lo, dloTopp(x) - inset + 0.012);
      A.push([x, lo]); B.push([x, hi]);
    }
    mesh(lapp(SIDA, A, B, 5, off), mat, gr, ro, true);
  };
  sidRuta(0.66, -1.945, -0.004, 0.003, M.svart, svart, 11);         // svart ram, B- och C-stolpar
  for (const [x0, x1] of [[0.60, -0.265], [-0.415, -1.045], [-1.095, -1.30], [-1.335, -1.915]]) sidRuta(x0, x1, 0.014, 0.006, M.glas, glas, 12);

  // ---------- Vindruta och bakruta ----------
  {
    const A = prov(20, (t) => { const z = lerp(-0.74, 0.74, t); return [0.875 - 0.06 * (z / 0.74) ** 2, z]; });
    const B = prov(20, (t) => { const z = lerp(-0.57, 0.57, t); return [0.0 + 0.03 * (z / 0.57) ** 2, z]; });
    const Ar = prov(20, (t) => { const z = lerp(-0.775, 0.775, t); return [0.90 - 0.065 * (z / 0.775) ** 2, z]; });
    const Br = prov(20, (t) => { const z = lerp(-0.605, 0.605, t); return [-0.03 + 0.03 * (z / 0.605) ** 2, z]; });
    mesh(lapp(TOPP, Ar, Br, 10, 0.003), M.svart, svart, 11);
    mesh(lapp(TOPP, A, B, 10, 0.006), M.glas, glas, 12);
    const C = prov(16, (t) => [lerp(-0.44, 0.44, t), 1.045]), D = prov(16, (t) => [lerp(-0.50, 0.50, t), 1.30]);
    const Cr = prov(16, (t) => [lerp(-0.475, 0.475, t), 1.02]), Dr = prov(16, (t) => [lerp(-0.535, 0.535, t), 1.325]);
    mesh(lapp(BAK, Cr, Dr, 8, 0.003), M.svart, svart, 11);
    mesh(lapp(BAK, C, D, 8, 0.006), M.glas, glas, 12);
  }

  // ---------- Strålkastare (snett framifrån) med ögonbryn och två ringar ----------
  {
    const dk = (x, z, y) => [(x - z) * s45, y]; // (x, z, y) -> diagonalkartans (a, b)
    const ovre = [[2.09, 0.34, 0.688], [2.065, 0.48, 0.692], [2.03, 0.60, 0.695], [1.97, 0.71, 0.697], [1.89, 0.79, 0.70], [1.81, 0.835, 0.70]];
    const undre = [[2.11, 0.36, 0.60], [2.085, 0.50, 0.582], [2.045, 0.62, 0.575], [1.975, 0.73, 0.585], [1.885, 0.805, 0.62], [1.81, 0.835, 0.68]];
    const A = ovre.map((p) => dk(...p)), B = undre.map((p) => dk(...p));
    const res = (P, n) => { const o = []; for (let i = 0; i < n; i++) { const t = i / (n - 1) * (P.length - 1), k = Math.min(P.length - 2, Math.floor(t)), f = t - k; o.push([lerp(P[k][0], P[k + 1][0], f), lerp(P[k][1], P[k + 1][1], f)]); } return o; };
    const Ar = res(A, 16), Br = res(B, 16);
    mesh(lapp(DIAG, Ar, Br, 6, 0.004), M.lyse, lyktor, 12, true);
    const bryn = Ar.map(([a, b]) => [a, b - 0.016]);
    mesh(lapp(DIAG, bryn, Ar.map(([a, b]) => [a, b + 0.002]), 2, 0.006), M.bryn, lyktor, 13, true);
    for (const [x, z, y] of [[2.075, 0.45, 0.648], [2.03, 0.585, 0.645]]) {
      const [ca, cb] = dk(x, z, y);
      const ut = prov(28, (t) => [ca + 0.046 * Math.cos(t * 2 * Math.PI), cb + 0.046 * Math.sin(t * 2 * Math.PI)]);
      const inn = prov(28, (t) => [ca + 0.034 * Math.cos(t * 2 * Math.PI), cb + 0.034 * Math.sin(t * 2 * Math.PI)]);
      mesh(lapp(DIAG, ut, inn, 2, 0.007), M.bryn, lyktor, 13, true);
    }
  }

  // ---------- Njurar, nedre stötfångare, dimljus, registreringsskylt fram ----------
  for (const s of [-1, 1]) {
    const [Ar, Br] = rundRekt(s * 0.168, 0.636, 0.142, 0.058, 4);
    mesh(lapp(FRAM, Ar, Br, 8, 0.003), M.krom, detaljer, 12);
    const [A, B] = rundRekt(s * 0.168, 0.636, 0.128, 0.046, 4);
    mesh(lapp(FRAM, A, B, 8, 0.006), M.svart, svart, 13);
  }
  {
    const A = prov(16, (t) => [lerp(-0.66, 0.66, t), 0.205]);
    const B = prov(16, (t) => { const z = lerp(-0.66, 0.66, t); return [z, 0.365 - 0.09 * klamp((Math.abs(z) - 0.50) / 0.16, 0, 1)]; });
    mesh(lapp(FRAM, A, B, 4, 0.003), M.svart, svart, 11);
    for (const s of [-1, 1]) {
      const [Ar, Br] = rundRekt(s * 0.60, 0.315, 0.04, 0.032, 2.4);
      mesh(lapp(FRAM, Ar, Br, 6, 0.006), M.lyse, lyktor, 12);
    }
    const [Sa, Sb] = rundRekt(0, 0.485, 0.26, 0.056, 8);
    mesh(lapp(FRAM, Sa, Sb, 6, 0.005), M.skylt, detaljer, 12);
    // bak: nedre svart del och skylt
    const C = prov(16, (t) => [lerp(-0.66, 0.66, t), 0.255]), D = prov(16, (t) => [lerp(-0.66, 0.66, t), 0.33]);
    mesh(lapp(BAK, C, D, 3, 0.003), M.svart, svart, 11);
    const [Ta, Tb] = rundRekt(0, 0.755, 0.26, 0.056, 8);
    mesh(lapp(BAK, Ta, Tb, 6, 0.005), M.skylt, detaljer, 12);
  }

  // ---------- Baklyktor: L-formade, delade mellan kaross (yttre) och baklucka (inre) ----------
  {
    // yttre delen sitter på karosshörnet och viker runt mot sidan: projiceras snett bakifrån
    const db = (x, z, y) => [(x + z) * s45, y];
    const res = (P, n) => { const o = []; for (let i = 0; i < n; i++) { const t = i / (n - 1) * (P.length - 1), k = Math.min(P.length - 2, Math.floor(t)), f = t - k; o.push([lerp(P[k][0], P[k + 1][0], f), lerp(P[k][1], P[k + 1][1], f)]); } return o; };
    const ovre = [[-2.272, 0.565, 0.94], [-2.262, 0.64, 0.945], [-2.22, 0.71, 0.948], [-2.14, 0.765, 0.945], [-2.04, 0.795, 0.935]].map((p) => db(...p));
    const undre = [[-2.285, 0.565, 0.875], [-2.275, 0.62, 0.84], [-2.25, 0.675, 0.80], [-2.19, 0.73, 0.79], [-2.11, 0.775, 0.83], [-2.04, 0.795, 0.905]].map((p) => db(...p));
    mesh(lapp(DIAGB, res(ovre, 14), res(undre, 14), 5, 0.009), M.bak, lyktor, 12, true);
    const inre = [prov(14, (t) => [lerp(0.40, 0.545, t), 0.872]), prov(14, (t) => [lerp(0.40, 0.545, t), 0.94])];
    mesh(lapp(BAK, inre[0], inre[1], 5, 0.008), M.bak, lyktor, 12, true);
  }

  // ---------- Tröskelns nedre svarta list ----------
  {
    const A = prov(16, (t) => [lerp(0.92, -0.93, t), 0.18]), B = prov(16, (t) => [lerp(0.92, -0.93, t), 0.225 + 0.02 * t]);
    mesh(lapp(SIDA, A, B, 3, 0.003), M.svart, svart, 11, true);
  }

  // ---------- Fogar (tunna linjer) ----------
  const linje = (K, pts, off = 0.002, parvis = true) => {
    const P = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const n = Math.max(2, Math.ceil(Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) / 0.01));
      for (let k = 0; k < n; k++) { const t = k / n, s = K.prov(lerp(pts[i][0], pts[i + 1][0], t), lerp(pts[i][1], pts[i + 1][1], t)); if (s) P.push(s.p.addScaledVector(s.n, off)); }
    }
    const g = new THREE.BufferGeometry().setFromPoints(P);
    const l = new THREE.Line(g, fog); l.renderOrder = 13; detaljer.add(l);
    if (parvis) { const m = new THREE.Line(g.clone().scale(1, 1, -1), fog); m.renderOrder = 13; detaljer.add(m); }
  };
  linje(SIDA, [[0.775, 0.19], [0.775, 0.60], [0.765, 0.80], [0.74, balte(0.74) - 0.005]]);       // framdörrens framkant
  linje(SIDA, [[-0.30, 0.185], [-0.30, balte(-0.30) - 0.004]]);                                  // B-stolpen
  {
    const hb = KAROSS_MATT.hjulhus[1], r = hb.r + 0.055, p = [[-1.32, balte(-1.32) - 0.004], [-1.31, 0.72]];
    for (let k = 0; k <= 10; k++) { const f = 1.40 * (1 - k / 10); p.push([hb.x + r * Math.cos(f), hb.cy + r * Math.sin(f)]); }
    p.push([hb.x + r, 0.20]);
    linje(SIDA, p);                                                                             // bakdörrens bakkant runt hjulhuset
  }
  linje(TOPP, prov(16, (t) => { const x = lerp(1.96, 0.95, t); return [x, FOG(x) + 0.01]; }));   // huvens skarv mot skärmen
  linje(TOPP, prov(20, (t) => { const z = lerp(-0.80, 0.80, t); return [0.945 - 0.02 * (z / 0.8) ** 2, z]; }), 0.002, false); // huvens bakkant
  linje(BAK, [[0.555, 0.60], [0.555, 0.985]]);                                                   // bakluckans skarvar
  linje(BAK, [[-0.555, 0.60], [0.555, 0.60]], 0.002, false);
  linje(SIDA, prov(25, (t) => [-1.60 + 0.058 * Math.cos(t * 2 * Math.PI), 0.80 + 0.058 * Math.sin(t * 2 * Math.PI)]), 0.002, false); // tanklock (höger)

  // ---------- Takspoiler som följer takets bakkant ----------
  // Kilformad förlängning av taket: börjar i takytan, översidan ligger alltid över taket och
  // spetsen sticker ut över bakrutan. Undersidan går tillbaka in i bakluckan, så inget flyter.
  {
    const nz = 30, prof = 8, P = [], idx = [];
    const tak = (x, z) => TOPP.prov(x, z).p.y;
    for (let s = 0; s <= nz; s++) {
      const z = lerp(-0.60, 0.60, s / nz), u = Math.abs(z) / 0.60;
      const f = Math.max(0.05, Math.sqrt(Math.max(0, 1 - u ** 6)));         // smalnar av mot ändarna
      const xb = -1.62 - 0.03 * u * u, xt = -1.975 + 0.05 * u * u;
      const xe = -1.90 + 0.04 * u * u, ye = tak(xe, z);
      const yt = ye - 0.03 * f;
      const ovre = (t) => { const x = lerp(xb, xt, t); return [x, Math.max(lerp(tak(xb, z), yt, t), tak(Math.max(x, xe), z)) + (0.004 + 0.012 * Math.sin(Math.PI * Math.min(1, t * 1.2))) * f]; };
      const pts = [[xb + 0.01, tak(xb + 0.01, z) - 0.01], ovre(0.02), ovre(0.35), ovre(0.7), ovre(1),
        [xt + 0.008, yt - 0.012 * f], [lerp(xt, xe, 0.4), yt - 0.028 * f], [xe + 0.02, ye - 0.06]];
      for (const [x, y] of pts) P.push(x, y, z);
    }
    for (let s = 0; s < nz; s++) for (let k = 0; k < prof; k++) {
      const a = s * prof + k, b = s * prof + (k + 1) % prof;
      idx.push(a, b, a + prof, b, b + prof, a + prof);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, M.lack); m.renderOrder = 10; m.name = 'takspoiler'; detaljer.add(m);
  }

  // ---------- Takrails med fötter ----------
  for (const s of [-1, 1]) {
    const z = s * 0.50, pts = [];
    for (let k = 0; k <= 30; k++) {
      const x = lerp(-0.12, -1.52, k / 30), y = TOPP.prov(x, z).p.y;
      const h = 0.010 + 0.032 * Math.min(1, Math.min(x - -1.52, -0.12 - x) / 0.12) ** 0.7;
      pts.push(new THREE.Vector3(x, y + h, z));
    }
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.011, 6);
    const m = new THREE.Mesh(g, M.alu); m.renderOrder = 12; detaljer.add(m);
    const fot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.018), M.svart);
    fot.position.set(-0.82, TOPP.prov(-0.82, z).p.y + 0.02, z); detaljer.add(fot);
  }

  // ---------- Backspeglar: rundad låda (samma Catmull-Clark), platt spegelglas bakåt ----------
  {
    const lada = (x0, x1, y0, y1, z0, z1) => {
      const V = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
      const F = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [3, 7, 6, 2], [0, 4, 7, 3], [1, 2, 6, 5]];
      const S = new Map(); for (const [a, b] of [[0, 3], [3, 7], [7, 4], [4, 0]]) S.set(a < b ? a * 1e6 + b : b * 1e6 + a, 2);
      for (const [a, b] of [[1, 2], [2, 6], [6, 5], [5, 1], [0, 1], [3, 2], [4, 5], [7, 6]]) S.set(a < b ? a * 1e6 + b : b * 1e6 + a, 1);
      const r = catmullClark(catmullClark({ V, F, S, H: new Set() }));
      const p = [], ix = []; r.V.forEach((v) => p.push(...v)); r.F.forEach((f) => ix.push(f[0], f[1], f[2], f[0], f[2], f[3]));
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(ix); g.computeVertexNormals();
      return g;
    };
    const bas = SIDA.prov(0.46, 0.96), zb = bas ? bas.p.z : 0.83;
    const hus = lada(-0.05, 0.08, -0.07, 0.07, 0, 0.20);
    const glasYta = new THREE.CircleGeometry(1, 20); glasYta.rotateY(-Math.PI / 2); glasYta.scale(1, 0.058, 0.088);
    const fot = lada(-0.04, 0.06, -0.03, 0.03, -0.03, 0.09);
    for (const s of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(0.44, 1.0, s * (zb - 0.01)); g.scale.set(1, 1, s);
      const h = new THREE.Mesh(hus, M.lack); h.position.z = 0.07; h.renderOrder = 10; g.add(h);
      const gl = new THREE.Mesh(glasYta, M.svart); gl.position.set(-0.045, 0, 0.175); g.add(gl);
      const f = new THREE.Mesh(fot, M.svart); f.position.y = -0.04; g.add(f);
      detaljer.add(g);
    }
  }

  // ---------- Dörrhandtag ----------
  for (const x of [-0.17, -1.07]) {
    const pt = SIDA.prov(x, SKULDRA(x) - 0.016);
    if (!pt) continue;
    for (const s of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.12, 2, 8), M.lack);
      h.rotation.z = Math.PI / 2; h.scale.set(1, 1, 0.7);
      h.position.set(x, pt.p.y, s * (pt.p.z + 0.008));
      h.renderOrder = 10; detaljer.add(h);
    }
  }

  // ---------- Avgasrör (vänster, 325i) ----------
  for (const z of [-0.565, -0.495]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.10, 16, 1, true), M.krom);
    r.rotation.z = Math.PI / 2; r.position.set(-2.33, 0.245, z); detaljer.add(r);
  }

  // ---------- Hjulhus: svart innerskärm så att man inte ser in i karossen ----------
  for (const hh of KAROSS_MATT.hjulhus) {
    const r = hh.r + 0.012, n = 28, prof = [];
    prof.push([hh.x + r, hh.cy - 0.06]);
    for (let k = 0; k <= n; k++) { const f = Math.PI * k / n; prof.push([hh.x + r * Math.cos(f), hh.cy + r * Math.sin(f)]); }
    prof.push([hh.x - r, hh.cy - 0.06]);
    const zo = ZMAX(hh.x) - 0.03, zi = 0.42;
    for (const s of [-1, 1]) {
      const P = [], idx = [];
      for (const [x, y] of prof) P.push(x, y, s * zo, x, y, s * zi);
      for (let k = 0; k < prof.length - 1; k++) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(idx); g.computeVertexNormals();
      mesh(g, M.innerskarm, svart, 9);
      const form = new THREE.Shape(prof.map(([x, y]) => new THREE.Vector2(x, y)));
      const vagg = new THREE.ShapeGeometry(form, 12); vagg.translate(0, 0, s * zi);
      mesh(vagg, M.innerskarm, svart, 9);
    }
  }
  // Underrede: platt svart botten så att karossen inte ser ihålig ut underifrån
  {
    const kontur = [];
    for (let k = 0; k <= 40; k++) { const x = lerp(2.0, -2.25, k / 40); kontur.push(new THREE.Vector2(x, ZMAX(x) - 0.06)); }
    for (let k = 40; k >= 0; k--) { const x = lerp(2.0, -2.25, k / 40); kontur.push(new THREE.Vector2(x, -(ZMAX(x) - 0.06))); }
    const g = new THREE.ShapeGeometry(new THREE.Shape(kontur)); g.rotateX(Math.PI / 2); g.translate(0, 0.19, 0);
    mesh(g, M.innerskarm, svart, 9);
  }

  // ---------- Sammanställning ----------
  const kaross = new THREE.Group();
  kaross.name = 'kaross';
  kaross.add(lack, glas, svart, lyktor, detaljer);
  let tri = 0;
  kaross.traverse((o) => { if (o.isMesh) tri += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  kaross.userData.trianglar = Math.round(tri);
  kaross.userData.lackTrianglar = ind.length / 3;
  kaross.userData.material = { ...M, fog };

  // Opacitet 0..1: lacken följer reglaget, glaset hålls synligt även i röntgenläge
  kaross.userData.opacitet = (v) => {
    kaross.visible = v > 0.001;
    const satt = (m, o) => { m.opacity = o; const fast = o >= 0.999; m.transparent = !fast; m.depthWrite = fast; m.needsUpdate = true; };
    satt(M.lack, v);
    for (const k of ['svart', 'innerskarm', 'alu', 'krom', 'skylt']) satt(M[k], v);
    for (const k of ['lyse', 'bak', 'bryn']) satt(M[k], Math.max(0.3, v));
    M.glas.opacity = Math.min(M.glas.userData.bas, 0.12 + 0.7 * v); M.glas.transparent = true; M.glas.depthWrite = false;
    fog.opacity = Math.min(0.8, 0.15 + v);
  };
  kaross.userData.tema = (mork) => {
    M.lack.color.set(mork ? 0xaab3bd : 0x8f99a4);
    fog.color.set(mork ? 0x23262b : 0x2b2f35);
  };
  return kaross;
}
