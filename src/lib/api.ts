// src/lib/api.ts
import bus from "./bus";
import { getKey } from "./secureStore";

interface AssistantReplyJson {
  ok: boolean;
  text?: string;
  error?: string;
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

interface AssistantReplyPayload {
  apiKey: string;
  prompt: string;
}

const warned = { openai: false };
function getOpenAIKey(): string | undefined {
  const key = getKey("openai") || getKey("sn2177.apiKey");
  if (!key && !warned.openai) {
    warned.openai = true;
    console.warn("Missing OpenAI key");
    bus.emit?.("toast", "Missing OpenAI key");
  }
  return key || undefined;
}

export async function assistantReply(
  prompt: string,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const apiKey = getOpenAIKey();
  if (!apiKey) return { ok: false, error: "missing api key" };
  const payload: AssistantReplyPayload = { apiKey, prompt };
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const r = await fetch("/api/assistant-reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    clearTimeout(to);
    if (!r.ok) {
      let msg = `HTTP ${r.status}`;
      try {
        const err = (await r.json()) as { error?: string };
        if (err?.error) msg = err.error;
      } catch {
        try { msg = await r.text(); } catch {}
      }
      return { ok: false, error: msg || "request failed" };
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
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? "request timeout" : e?.message || "network error";
    return { ok: false, error: msg };
  } finally {
    clearTimeout(to);
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
