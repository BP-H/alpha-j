// src/lib/api.ts
import { getKey } from "./secureStore";
import { notify } from "./notify";

interface AssistantReplyJson {
  ok: boolean;
  text?: string;
  error?: string;
}

interface AssistantReplyPayload {
  apiKey: string;
  prompt: string;
}

export interface Player {
  id: string;
  name: string;
  color: string;
}

interface PlayersJson {
  ok: boolean;
  players?: Player[];
  error?: string;
}

const warnedMissing = new Set<string>();
function getOpenAIKey(): string {
  const key = getKey("openai") || getKey("sn2177.apiKey");
  if (!key && !warnedMissing.has("openai")) {
    warnedMissing.add("openai");
    console.warn("OpenAI API key is missing");
    notify("OpenAI API key is missing");
  }
  return key;
}

export async function assistantReply(
  prompt: string,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const apiKey = getOpenAIKey();
  if (!apiKey) return { ok: false, error: "missing api key" };

  const payload: AssistantReplyPayload = { apiKey, prompt };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15_000);

  try {
    const r = await fetch("/api/assistant-reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    clearTimeout(t);

    if (!r.ok) {
      let msg = `HTTP ${r.status}`;
      try {
        const err = (await r.json()) as { error?: string };
        if (typeof err?.error === "string") msg = err.error;
      } catch {
        try {
          msg = (await r.text()) || msg;
        } catch {}
      }
      return { ok: false, error: msg };
    }

    let data: AssistantReplyJson;
    try {
      data = (await r.json()) as AssistantReplyJson;
    } catch {
      return { ok: false, error: "invalid json response" };
    }
    if (data.ok && typeof data.text === "string") {
      return { ok: true, text: data.text };
    }
    return { ok: false, error: data.error || "failed" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "network error";
    return { ok: false, error: msg };
  } finally {
    clearTimeout(t);
  }
}

export async function fetchPlayers(): Promise<Player[]> {
  try {
    const r = await fetch("/api/players");
    if (!r.ok) {
      return [];
    }
    let data: PlayersJson;
    try {
      data = (await r.json()) as PlayersJson;
    } catch (e: unknown) {
      console.error("Failed to parse /api/players response", e);
      return [];
    }
    if (data.ok && Array.isArray(data.players)) {
      return data.players.filter(
        (p): p is Player =>
          typeof p.id === "string" &&
          typeof p.name === "string" &&
          typeof p.color === "string",
      );
    }
    return [];
  } catch (e: unknown) {
    console.error("Failed to fetch players", e);
    return [];
  }
}
