// src/lib/api.ts
import { getKey } from "./secureStore";
import bus from "./bus";

let warned = false;
function warnOnce(msg: string) {
  if (warned) return;
  warned = true;
  console.warn(msg);
  bus.emit("notify", msg);
}

interface AssistantReplyPayload {
  prompt: string;
  apiKey?: string;
}

export type AssistantReplyResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

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

export async function assistantReply(
  prompt: string,
): Promise<AssistantReplyResult> {
  const apiKey = getKey("openai") || getKey("sn2177.apiKey");
  if (!apiKey) warnOnce("Missing OpenAI API key");

  const payload: AssistantReplyPayload = { prompt };
  if (apiKey) payload.apiKey = apiKey;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch("/api/assistant-reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      let err = `HTTP ${res.status}`;
      try {
        const data = (await res.json()) as { error?: string };
        if (typeof data.error === "string") err = data.error;
      } catch {
        try {
          const text = await res.text();
          if (text) err = text;
        } catch {
          // ignore
        }
      }
      return { ok: false, error: err };
    }
    const data = (await res.json()) as AssistantReplyResult;
    if (data.ok && typeof (data as any).text === "string") {
      return { ok: true, text: (data as any).text };
    }
    const error =
      typeof (data as any).error === "string" ? (data as any).error : "Failed";
    return { ok: false, error };
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : "Network error";
    return { ok: false, error };
  } finally {
    clearTimeout(timeout);
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

