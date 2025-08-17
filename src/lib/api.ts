// src/lib/api.ts
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

export async function assistantReply(
  prompt: string,
): Promise<{ ok: boolean; text?: string; error?: string }> {
  const apiKey = getKey("sn2177.apiKey");
  try {
    const r = await fetch("/api/assistant-reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, prompt }), // — 'prompt' shape
    });
    if (!r.ok) {
      return { ok: false, error: `HTTP ${r.status}` };
    }
    let data: AssistantReplyJson;
    try {
      data = (await r.json()) as AssistantReplyJson;
    } catch (e: unknown) {
      console.error("Failed to parse /api/assistant-reply response", e);
      return { ok: false, error: "Invalid JSON response" };
    }
    if (data.ok && typeof data.text === "string") {
      return { ok: true, text: data.text };
    }
    return { ok: false, error: typeof data.error === "string" ? data.error : "Failed" };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Network error";
    return { ok: false, error: message };
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

