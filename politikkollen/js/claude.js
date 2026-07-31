// Klient mot Anthropics Messages API, direkt från webbläsaren (BYOK).
// Kräver headern anthropic-dangerous-direct-browser-access — användarens egen
// nyckel lagras enbart i localStorage och skickas aldrig till någon server
// utom Anthropics.

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-opus-5";
const KEY_STORAGE = "politikkollen_api_key";

export function getApiKey() {
  return localStorage.getItem(KEY_STORAGE) || "";
}
export function setApiKey(key) {
  if (key) localStorage.setItem(KEY_STORAGE, key.trim());
  else localStorage.removeItem(KEY_STORAGE);
}

export async function fragaClaude({ system, messages, schema, maxTokens = 16000 }) {
  const key = getApiKey();
  if (!key) throw new Error("Ingen API-nyckel sparad");

  const body = {
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages,
  };
  if (schema) body.output_config = { format: { type: "json_schema", schema } };

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detalj = "";
    try { detalj = (await res.json())?.error?.message || ""; } catch { /* ignorera */ }
    if (res.status === 401) throw new Error("API-nyckeln avvisades — kontrollera att den stämmer.");
    if (res.status === 429) throw new Error("För många anrop just nu (rate limit) — vänta en stund och försök igen.");
    throw new Error(`Anthropic-API:et svarade ${res.status}${detalj ? `: ${detalj}` : ""}`);
  }

  const data = await res.json();
  if (data.stop_reason === "refusal") {
    throw new Error("Modellen avböjde att svara på den här frågan.");
  }
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  if (data.stop_reason === "max_tokens") {
    return text + "\n\n_(Svaret kapades — ställ gärna en mer avgränsad fråga.)_";
  }
  return text;
}
