// Klient mot SCB:s statistikdatabas via PxWebApi v1
// (https://api.scb.se/OV0104/v1/doris/sv/ssd/...). v1 är CORS-öppet, fritt
// och stöds t.o.m. årsskiftet 2026/2027; byt BAS-URL till v2 vid migrering.
//
// Strategin är metadatadriven: vi läser tabellens variabler först och bygger
// frågan utifrån dem, i stället för att hårdkoda värdekoder som kan ändras.

const BASE = "https://api.scb.se/OV0104/v1/doris/sv/ssd";

export async function tabellMeta(path) {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`SCB-metadata svarade ${res.status}`);
  return res.json();
}

async function tabellData(path, query) {
  const res = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, response: { format: "json" } }),
  });
  if (!res.ok) throw new Error(`SCB-data svarade ${res.status}`);
  return res.json();
}

// Hämta de senaste `antalTid` värdena ur en tabell.
//  - contentsMatch: substräng som väljer rätt mått bland ContentsCode-värdena
//  - valda: { VariabelKod: "värdekod" } för variabler som ska låsas (t.ex. Region: "00")
// Övriga variabler: elimineras om tabellen tillåter det, annars första värdet.
export async function senasteVarden(path, { contentsMatch = "", valda = {}, antalTid = 1 } = {}) {
  const meta = await tabellMeta(path);
  const query = [];
  for (const v of meta.variables) {
    if (v.time) {
      query.push({ code: v.code, selection: { filter: "top", values: [String(antalTid)] } });
    } else if (valda[v.code] !== undefined) {
      query.push({ code: v.code, selection: { filter: "item", values: [valda[v.code]] } });
    } else if (v.code === "ContentsCode") {
      const i = contentsMatch
        ? v.valueTexts.findIndex((t) => t.toLowerCase().includes(contentsMatch.toLowerCase()))
        : 0;
      query.push({ code: v.code, selection: { filter: "item", values: [v.values[i >= 0 ? i : 0]] } });
    } else if (!v.elimination) {
      query.push({ code: v.code, selection: { filter: "item", values: [v.values[0]] } });
    }
    // variabler med elimination utelämnas → SCB aggregerar
  }
  const data = await tabellData(path, query);
  // data.data: [{key: [...], values: ["..."]}] — sortera på tidsnyckeln (sista i key).
  const rader = (data.data || [])
    .map((r) => ({ tid: r.key[r.key.length - 1], varde: parseFloat(r.values[0]) }))
    .filter((r) => Number.isFinite(r.varde))
    .sort((a, b) => a.tid.localeCompare(b.tid));
  return { titel: meta.title, rader };
}

const nf = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 });

// Nyckeltalskort. Varje kort definierar sin egen hämtning + presentation så
// att ett fel i en tabell inte fäller de andra.
export const NYCKELTAL = [
  {
    id: "befolkning",
    label: "Folkmängd i Sverige",
    kalla: "SCB, Befolkningsstatistik",
    async hamta() {
      const { rader } = await senasteVarden("START/BE/BE0101/BE0101A/BefolkningNy", {
        contentsMatch: "folkmängd",
        valda: { Region: "00" },
      });
      const sista = rader[rader.length - 1];
      return { varde: nf.format(sista.varde) + " personer", period: sista.tid };
    },
  },
  {
    id: "kpi",
    label: "Inflation (KPI, årstakt)",
    kalla: "SCB, Konsumentprisindex",
    async hamta() {
      const { rader } = await senasteVarden("START/PR/PR0101/PR0101A/KPItotM", {
        contentsMatch: "fastställda",
        antalTid: 13,
      });
      const sista = rader[rader.length - 1];
      const bas = rader.find((r) => samma12ManaderTidigare(r.tid, sista.tid));
      if (!bas) throw new Error("Hittade inte jämförelsemånad");
      const arstakt = (sista.varde / bas.varde - 1) * 100;
      return {
        varde: (arstakt >= 0 ? "+" : "") + nf.format(arstakt) + " %",
        period: `${sista.tid} (index ${nf.format(sista.varde)})`,
      };
    },
  },
  {
    id: "kpi-index",
    label: "KPI-index (1980=100)",
    kalla: "SCB, Konsumentprisindex",
    async hamta() {
      const { rader } = await senasteVarden("START/PR/PR0101/PR0101A/KPItotM", {
        contentsMatch: "fastställda",
      });
      const sista = rader[rader.length - 1];
      return { varde: nf.format(sista.varde), period: sista.tid };
    },
  },
];

function samma12ManaderTidigare(tid, ref) {
  // Tidkoder för månad: "2026M06". Jämför mot ref minus 12 månader.
  const m = ref.match(/^(\d{4})M(\d{2})$/);
  if (!m) return false;
  return tid === `${Number(m[1]) - 1}M${m[2]}`;
}
