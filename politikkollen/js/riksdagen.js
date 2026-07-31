// Klient mot Riksdagens öppna data (https://data.riksdagen.se).
// Fritt REST-API utan nyckel. Alla anrop görs från webbläsaren; om ett
// vanligt fetch stoppas (CORS/nät) faller vi tillbaka till JSONP, som
// API:et stödjer via utformat=jsonp&callback=.

const BASE = "https://data.riksdagen.se";

// API:et returnerar objekt i stället för array vid en enda träff.
export function toArray(x) {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

let jsonpCounter = 0;
function jsonp(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const cb = `__rd_jsonp_${Date.now()}_${jsonpCounter++}`;
    const script = document.createElement("script");
    const timer = setTimeout(() => { cleanup(); reject(new Error("JSONP timeout")); }, timeoutMs);
    function cleanup() {
      clearTimeout(timer);
      delete window[cb];
      script.remove();
    }
    window[cb] = (data) => { cleanup(); resolve(data); };
    script.onerror = () => { cleanup(); reject(new Error("JSONP-anropet misslyckades")); };
    script.src = `${url}&utformat=jsonp&callback=${cb}`;
    document.head.appendChild(script);
  });
}

async function get(path, params) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, v);
  }
  const urlBase = `${BASE}/${path}/?${qs.toString()}`;
  try {
    const res = await fetch(`${urlBase}&utformat=json`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Riksdagens API svarade ${res.status}`);
    return await res.json();
  } catch (err) {
    // CORS-/nätverksfel dyker upp som TypeError — prova JSONP innan vi ger upp.
    if (err instanceof TypeError) return jsonp(urlBase);
    throw err;
  }
}

// Anföranden i kammaren. Filter: rm ("2025/26"), parti ("S"), antal (sz).
export async function anforanden({ rm, parti, sz = 30 } = {}) {
  const data = await get("anforandelista", { rm, parti, sz });
  return toArray(data?.anforandelista?.anforande);
}

// Fritextsökning bland dokument (motioner, propositioner, betänkanden ...).
export async function dokument({ sok, doktyp, rm, parti, sz = 15 } = {}) {
  const data = await get("dokumentlista", {
    sok, doktyp, rm, parti, sz,
    sort: "rel", sortorder: "desc",
  });
  return toArray(data?.dokumentlista?.dokument);
}

// Voteringar: en rad per ledamot och röst. Filtreras på riksmöte + beteckning.
export async function voteringar({ rm, bet, sz = 5000 } = {}) {
  const data = await get("voteringlista", { rm, bet, sz });
  return toArray(data?.voteringlista?.votering);
}

// Aggregera ledamotsrader till en sammanställning per votering(spunkt).
export function aggregeraVoteringar(rader) {
  const ROSTER = ["Ja", "Nej", "Avstår", "Frånvarande"];
  const grupper = new Map();
  for (const rad of rader) {
    const key = rad.votering_id || `${rad.beteckning}-${rad.punkt}`;
    if (!grupper.has(key)) {
      grupper.set(key, {
        id: key,
        rm: rad.rm,
        beteckning: rad.beteckning,
        punkt: rad.punkt,
        avser: rad.avser || "",
        datum: rad.systemdatum ? String(rad.systemdatum).slice(0, 10) : "",
        totalt: { Ja: 0, Nej: 0, "Avstår": 0, "Frånvarande": 0 },
        partier: new Map(),
      });
    }
    const g = grupper.get(key);
    const rost = ROSTER.includes(rad.rost) ? rad.rost : null;
    if (!rost) continue;
    g.totalt[rost]++;
    const parti = (rad.parti || "?").toUpperCase();
    if (!g.partier.has(parti)) g.partier.set(parti, { Ja: 0, Nej: 0, "Avstår": 0, "Frånvarande": 0 });
    g.partier.get(parti)[rost]++;
  }
  return [...grupper.values()].sort((a, b) =>
    String(a.punkt).localeCompare(String(b.punkt), "sv", { numeric: true }));
}

// Länk till dokument — API:et ger ofta protokollrelativa URL:er ("//data...").
export function dokLank(d) {
  const url = d.dokument_url_html || d.dokument_url_text || "";
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("http")) return url;
  if (d.id || d.dok_id) return `https://www.riksdagen.se/sv/sok/?q=${encodeURIComponent(d.id || d.dok_id)}`;
  return "";
}

// Riksmöten att välja bland (nyaste först).
export function riksmoten(antal = 6) {
  const now = new Date();
  // Riksmötet börjar i september: 2026-07 tillhör 2025/26.
  let startAr = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const lista = [];
  for (let i = 0; i < antal; i++) {
    const ar = startAr - i;
    lista.push(`${ar}/${String((ar + 1) % 100).padStart(2, "0")}`);
  }
  return lista;
}

export const PARTIER = ["S", "M", "SD", "C", "V", "KD", "L", "MP"];
