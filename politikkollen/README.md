# Politikkollen v0 — statisk webbapp

Snabba, källgrundade svar om svensk politik. Helt statisk (ingen backend) —
all datahämtning sker i webbläsaren, direkt mot öppna API:er.

Koncept och analys: se `my_documents/outputs/svensk_politik_app/koncept_politikkollen.md` i repot [parlin/agentis](https://github.com/parlin/agentis). Källkoden utvecklas där (`docs/`) och speglas hit för publicering.

## Funktioner

| Flik | Datakälla | Beskrivning |
|---|---|---|
| **Fråga (AI)** | Anthropic API (egen nyckel) + riksdagen + SCB | Tvåstegsflöde: Claude planerar sökningen (strukturerad output) → appen hämtar dokument/statistik → Claude formulerar ett källänkat svar |
| **Anföranden** | `data.riksdagen.se/anforandelista` | Senaste kammaranföranden, filtrerbara på riksmöte/parti/fritext |
| **Voteringar** | `data.riksdagen.se/voteringlista` | Röstresultat per betänkandepunkt, aggregerat per parti, med tillgänglighetsvaliderade staplar |
| **Nyckeltal** | SCB PxWebApi v1 | Folkmängd, inflation (KPI årstakt beräknas ur indexserien) |

## Hosting

Mappen är byggd för **GitHub Pages**: aktivera Pages i repo-inställningarna med
källa `main`-branchen och mappen `/docs`. Ingen build behövs (ren HTML/CSS/ES-moduler).
Fungerar även lokalt: `python3 -m http.server` i denna mapp (moduler kräver http, inte `file://`).

## Arkitektur

```
index.html / style.css / app.js   UI, flikar, rendering
js/riksdagen.js                   Riksdagens öppna data (fetch + JSONP-fallback)
js/scb.js                         SCB PxWebApi v1, metadatadriven frågebyggare
js/claude.js                      Anthropic Messages API (BYOK, direct browser access)
```

- **Gemensamt layoutsystem:** mobil-först med tre brytpunkter (640 / 960 / 1280 px)
  styrda via delade CSS-tokens (`--wrap-max`, `--space`, radier, skuggor). Typografi:
  Google-fonterna **Bricolage Grotesque** (rubriker) och **Instrument Sans** (brödtext).
- **BYOK (bring your own key):** AI-fliken kräver att användaren klistrar in sin egen
  Anthropic-nyckel. Den sparas i `localStorage` och skickas bara till `api.anthropic.com`
  (headern `anthropic-dangerous-direct-browser-access` krävs för browseranrop).
- **Defensiv rendering:** all API-data renderas via textnoder (aldrig `innerHTML`),
  och AI-svarets markdown tolkas av en minimal egen renderare.
- **Metadatadriven SCB-hämtning:** frågor byggs utifrån tabellens metadata
  (ContentsCode matchas på titel, tid via `filter: top`) i stället för hårdkodade
  värdekoder, så att kolumnändringar hos SCB inte knäcker appen i onödan.

## Kända begränsningar / att verifiera

Utvecklingsmiljön saknade nätåtkomst till `data.riksdagen.se` och `api.scb.se`,
så följande är byggt mot dokumenterade API-former men **inte liveprovat**:

- CORS-headrar från riksdagens API (JSONP-fallback finns om fetch blockeras).
- Exakta SCB-tabellsökvägar (`BE0101A/BefolkningNy`, `PR0101A/KPItotM`) — korten
  felhanteras individuellt och visar tydligt om en tabell inte kan hämtas.
- Fältnamn i `anforandelista`/`voteringlista`-svaren (normalisering av
  objekt-vs-array är hanterad; enstaka fält kan behöva justeras).

Första körningen i en riktig webbläsare bör börja med flikarna Anföranden och
Nyckeltal (kräver ingen nyckel) och devtools-konsolen öppen.

## Nästa steg (v1+)

- Klistra-in-ett-påstående → faktakort (claim-pipelinen ur konceptdokumentet).
- Fler SCB-nyckeltal (arbetslöshet AKU, BNP) — lägg till kort i `NYCKELTAL` i `js/scb.js`.
- Migrera SCB-klienten till PxWebApi v2 (v1 stängs årsskiftet 2026/2027).
- Streaming av AI-svaret (SSE) för bättre upplevd latens.
