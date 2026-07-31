import * as rd from "./js/riksdagen.js";
import { NYCKELTAL } from "./js/scb.js";
import { getApiKey, setApiKey, fragaClaude } from "./js/claude.js";

// ── Hjälpare ────────────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children) {
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

function visaStatus(node, text, isError = false) {
  node.textContent = text;
  node.classList.toggle("error", isError);
  node.classList.toggle("hidden", !text);
}

function stripHtml(html) {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
}

// Minimal markdown → DOM (rubriker, fetstil, länkar, listor). All text
// escapas genom att byggas med textnoder — aldrig innerHTML på API-data.
function renderMarkdown(md, target) {
  target.textContent = "";
  const inline = (text, parent) => {
    // länkar [text](https://...) och **fetstil**
    const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) parent.append(text.slice(last, m.index));
      if (m[1]) parent.append(el("a", { href: m[2], target: "_blank", rel: "noopener" }, m[1]));
      else parent.append(el("strong", {}, m[3]));
      last = re.lastIndex;
    }
    if (last < text.length) parent.append(text.slice(last));
  };
  let lista = null;
  for (const rad of md.split(/\n/)) {
    const t = rad.trim();
    if (!t) { lista = null; continue; }
    if (/^#{1,4}\s/.test(t)) {
      lista = null;
      const h = el("h3");
      inline(t.replace(/^#{1,4}\s*/, ""), h);
      target.append(h);
    } else if (/^[-*•]\s/.test(t)) {
      if (!lista) { lista = el("ul"); target.append(lista); }
      const li = el("li");
      inline(t.replace(/^[-*•]\s*/, ""), li);
      lista.append(li);
    } else {
      lista = null;
      const p = el("p");
      inline(t, p);
      target.append(p);
    }
  }
}

// ── Flikar ──────────────────────────────────────────────────────────────────

for (const tab of document.querySelectorAll(".tab")) {
  tab.addEventListener("click", () => {
    for (const t of document.querySelectorAll(".tab")) {
      t.classList.toggle("active", t === tab);
      t.setAttribute("aria-selected", t === tab);
    }
    for (const p of document.querySelectorAll(".panel")) {
      const aktiv = p.id === tab.dataset.panel;
      p.classList.toggle("active", aktiv);
      p.toggleAttribute("hidden", !aktiv);
    }
    if (tab.dataset.panel === "panel-nyckeltal") laddaNyckeltal();
  });
}

// ── Fråga (AI) ──────────────────────────────────────────────────────────────

const askSetup = $("#ask-setup");
const askStatus = $("#ask-status");
const askAnswer = $("#ask-answer");
const askSources = $("#ask-sources");
const askSourcesList = $("#ask-sources-list");

function uppdateraNyckelUI() {
  askSetup.classList.toggle("hidden", Boolean(getApiKey()));
}
uppdateraNyckelUI();

$("#api-key-save").addEventListener("click", () => {
  const v = $("#api-key-input").value.trim();
  if (!v) return;
  setApiKey(v);
  $("#api-key-input").value = "";
  uppdateraNyckelUI();
});
$("#api-key-change").addEventListener("click", () => {
  setApiKey("");
  uppdateraNyckelUI();
});

for (const chip of document.querySelectorAll("#ask-suggestions .chip")) {
  chip.addEventListener("click", () => { $("#ask-input").value = chip.textContent; });
}

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["sokord", "doktyp", "behovs_scb"],
  properties: {
    sokord: { type: "string", description: "Sökfråga (2–5 ord, svenska) för riksdagens dokumentsökning" },
    doktyp: { type: "string", enum: ["", "mot", "prop", "bet", "ip", "fr", "sou"] },
    behovs_scb: { type: "boolean", description: "true om frågan rör statistik som inflation eller befolkning" },
  },
};

$("#ask-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fraga = $("#ask-input").value.trim();
  if (!fraga) return;
  if (!getApiKey()) { uppdateraNyckelUI(); askSetup.scrollIntoView({ behavior: "smooth" }); return; }

  const knapp = $("#ask-submit");
  knapp.disabled = true;
  askAnswer.classList.add("hidden");
  askSources.classList.add("hidden");
  try {
    // Steg 1 — låt Claude planera vilka källor som behövs (strukturerad output).
    visaStatus(askStatus, "Planerar sökning …");
    const planText = await fragaClaude({
      system: "Du hjälper till att slå upp svensk politik. Utifrån användarens fråga, föreslå en sökning i riksdagens dokumentdatabas och om SCB-statistik behövs. Svara enligt schemat.",
      messages: [{ role: "user", content: fraga }],
      schema: PLAN_SCHEMA,
      maxTokens: 2048,
    });
    const plan = JSON.parse(planText);

    // Steg 2 — hämta underlaget från öppna API:er.
    visaStatus(askStatus, `Hämtar underlag från riksdagen (”${plan.sokord}”) …`);
    const [dok, statistik] = await Promise.all([
      rd.dokument({ sok: plan.sokord, doktyp: plan.doktyp, sz: 12 }).catch(() => []),
      plan.behovs_scb ? hamtaNyckeltalForAI() : Promise.resolve([]),
    ]);

    const underlag = {
      riksdagsdokument: dok.map((d) => ({
        titel: d.titel,
        undertitel: d.undertitel || "",
        typ: d.doktyp,
        datum: d.datum,
        organ: d.organ || "",
        lank: rd.dokLank(d),
      })),
      scb: statistik,
    };

    // Steg 3 — låt Claude formulera ett källgrundat svar.
    visaStatus(askStatus, "Formulerar svar …");
    const svar = await fragaClaude({
      system: [
        "Du är en saklig, partipolitiskt neutral assistent för frågor om svensk politik.",
        "Svara kort på svenska utifrån UNDERLAGET nedan. Länka källor i markdown-format [titel](url).",
        "Om underlaget inte räcker för att besvara frågan: säg det tydligt i stället för att gissa.",
        "Skilj på fakta ur underlaget och din egen bakgrundskunskap; markera det senare som osäkert.",
      ].join(" "),
      messages: [{
        role: "user",
        content: `FRÅGA: ${fraga}\n\nUNDERLAG (JSON):\n${JSON.stringify(underlag, null, 1)}`,
      }],
    });

    visaStatus(askStatus, "");
    renderMarkdown(svar, askAnswer);
    askAnswer.classList.remove("hidden");

    askSourcesList.textContent = "";
    for (const d of underlag.riksdagsdokument.slice(0, 8)) {
      askSourcesList.append(el("li", {},
        el("div", { class: "meta" }, `${d.typ || "dokument"} · ${d.datum || ""} ${d.organ ? "· " + d.organ : ""}`),
        el("div", { class: "title" }, d.lank
          ? el("a", { href: d.lank, target: "_blank", rel: "noopener" }, d.titel)
          : d.titel),
        d.undertitel ? el("p", { class: "excerpt" }, d.undertitel) : "",
      ));
    }
    askSources.classList.toggle("hidden", underlag.riksdagsdokument.length === 0);
  } catch (err) {
    visaStatus(askStatus, `Något gick fel: ${err.message}`, true);
  } finally {
    knapp.disabled = false;
  }
});

async function hamtaNyckeltalForAI() {
  const ut = [];
  for (const kort of NYCKELTAL) {
    try {
      const { varde, period } = await kort.hamta();
      ut.push({ matt: kort.label, varde, period, kalla: kort.kalla });
    } catch { /* hoppa över kort som fallerar */ }
  }
  return ut;
}

// ── Anföranden ──────────────────────────────────────────────────────────────

const anfRm = $("#anf-rm");
const anfParti = $("#anf-parti");
for (const rm of rd.riksmoten()) anfRm.append(el("option", { value: rm }, rm));
for (const p of rd.PARTIER) anfParti.append(el("option", { value: p }, p));

let anfCache = [];

$("#anf-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = $("#anf-status");
  visaStatus(status, "Hämtar anföranden …");
  $("#anf-list").textContent = "";
  try {
    anfCache = await rd.anforanden({ rm: anfRm.value, parti: anfParti.value, sz: 50 });
    renderAnforanden();
    visaStatus(status, anfCache.length ? "" : "Inga anföranden hittades för valet.");
  } catch (err) {
    visaStatus(status, `Kunde inte hämta anföranden: ${err.message}`, true);
  }
});

$("#anf-filter").addEventListener("input", renderAnforanden);

function renderAnforanden() {
  const filter = $("#anf-filter").value.trim().toLowerCase();
  const list = $("#anf-list");
  list.textContent = "";
  let visade = 0;
  for (const a of anfCache) {
    const text = stripHtml(a.anforandetext);
    const rubrik = a.avsnittsrubrik || a.dok_titel || "Anförande";
    if (filter && !(rubrik + " " + text).toLowerCase().includes(filter)) continue;
    if (++visade > 30) break;
    const lank = a.protokoll_url_www || "";
    list.append(el("li", {},
      el("div", { class: "meta" },
        el("span", { class: "party-chip" }, a.parti || "–"),
        a.talare || "", " · ", a.dok_datum ? String(a.dok_datum).slice(0, 10) : ""),
      el("div", { class: "title" }, lank
        ? el("a", { href: lank, target: "_blank", rel: "noopener" }, rubrik)
        : rubrik),
      el("p", { class: "excerpt" }, text.slice(0, 240) + (text.length > 240 ? " …" : "")),
    ));
  }
  if (!visade && anfCache.length) {
    list.append(el("li", {}, "Inget anförande matchade filtret."));
  }
}

// ── Voteringar ──────────────────────────────────────────────────────────────

const VOTE_FARGER = {
  Ja: "var(--ja)", Nej: "var(--nej)", "Avstår": "var(--avstar)", "Frånvarande": "var(--franv)",
};
const votRm = $("#vot-rm");
for (const rm of rd.riksmoten()) votRm.append(el("option", { value: rm }, rm));

$("#vot-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = $("#vot-status");
  const listNode = $("#vot-list");
  const legend = $("#vot-legend");
  visaStatus(status, "Hämtar voteringar …");
  listNode.textContent = "";
  legend.classList.add("hidden");
  try {
    const rader = await rd.voteringar({ rm: votRm.value, bet: $("#vot-bet").value.trim() });
    const grupper = rd.aggregeraVoteringar(rader);
    if (!grupper.length) {
      visaStatus(status, "Inga voteringar hittades — kontrollera riksmöte och beteckning.");
      return;
    }
    visaStatus(status, "");
    legend.textContent = "";
    for (const [namn, farg] of Object.entries(VOTE_FARGER)) {
      legend.append(el("span", { class: "key" },
        el("span", { class: "swatch", style: `background:${farg}` }), namn));
    }
    legend.classList.remove("hidden");
    for (const g of grupper) listNode.append(renderVotering(g));
  } catch (err) {
    visaStatus(status, `Kunde inte hämta voteringar: ${err.message}`, true);
  }
});

function renderVotering(g) {
  const totalRoster = Object.values(g.totalt).reduce((a, b) => a + b, 0) || 1;
  const bar = el("div", { class: "vote-bar", role: "img",
    "aria-label": `Ja ${g.totalt.Ja}, Nej ${g.totalt.Nej}, Avstår ${g.totalt["Avstår"]}, Frånvarande ${g.totalt["Frånvarande"]}` });
  const counts = el("div", { class: "vote-counts" });
  for (const [namn, farg] of Object.entries(VOTE_FARGER)) {
    const n = g.totalt[namn];
    if (n > 0) {
      bar.append(el("div", { class: "seg", style: `width:${(n / totalRoster) * 100}%;background:${farg}`,
        title: `${namn}: ${n}` }));
    }
    counts.append(el("span", { class: "key" },
      el("span", { class: "swatch", style: `background:${farg}` }), `${namn} ${n}`));
  }

  const tabell = el("table", { class: "party-table" },
    el("thead", {}, el("tr", {},
      el("th", {}, "Parti"), el("th", {}, "Ja"), el("th", {}, "Nej"),
      el("th", {}, "Avstår"), el("th", {}, "Frånv."))));
  const tbody = el("tbody");
  const partier = [...g.partier.entries()].sort((a, b) => a[0].localeCompare(b[0], "sv"));
  for (const [parti, r] of partier) {
    tbody.append(el("tr", {},
      el("td", {}, parti), el("td", {}, r.Ja), el("td", {}, r.Nej),
      el("td", {}, r["Avstår"]), el("td", {}, r["Frånvarande"])));
  }
  tabell.append(tbody);

  return el("div", { class: "vote-item" },
    el("div", { class: "vote-head" },
      el("span", { class: "lbl" }, `${g.rm}:${g.beteckning} · punkt ${g.punkt}`),
      el("span", {}, g.datum)),
    g.avser ? el("div", { class: "hint" }, g.avser) : "",
    bar, counts,
    el("details", {}, el("summary", {}, "Per parti"), tabell));
}

// ── Nyckeltal (SCB) ─────────────────────────────────────────────────────────

let nyckeltalLaddade = false;

async function laddaNyckeltal() {
  if (nyckeltalLaddade) return;
  nyckeltalLaddade = true;
  const grid = $("#stat-cards");
  grid.textContent = "";
  for (const kort of NYCKELTAL) {
    const card = el("div", { class: "stat-card" },
      el("div", { class: "stat-label" }, kort.label),
      el("div", { class: "stat-value" }, "…"),
      el("div", { class: "stat-meta" }, kort.kalla));
    grid.append(card);
    kort.hamta().then(({ varde, period }) => {
      card.querySelector(".stat-value").textContent = varde;
      card.querySelector(".stat-meta").textContent = `${period} · ${kort.kalla}`;
    }).catch((err) => {
      card.classList.add("error");
      card.querySelector(".stat-value").textContent = `Kunde inte hämtas (${err.message})`;
    });
  }
}
