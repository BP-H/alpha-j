// src/lib/api.ts
import { getKey } from "./secureStore";
import bus from "./bus";

let warned = false;
function warnOnce(msg: string) {
  if (warned) return;
  warned = true;
  bus.emit("toast", { message: msg });
  console.warn(msg);
  bus.emit("notify", msg);
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
  const apiKey = getKey("openai");
  if (!apiKey) {
    warnOnce("Missing OpenAI API key");
    return { ok: false, error: "missing api key" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "You are the SuperNOVA assistant orb. Reply in one or two concise sentences. No markdown.",
          },
          { role: "user", content: prompt.slice(0, 2000) },
        ],
      }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = data?.error?.message || `HTTP ${res.status}`;
      return { ok: false, error: err };
    }
    const text = (data?.choices?.[0]?.message?.content || "").trim();
    return { ok: true, text };
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
      const message = "Failed to parse /api/players response";
      bus.emit("toast", { message });
      console.error(message, e);
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
    const message = "Failed to fetch players";
    bus.emit("toast", { message });
    console.error(message, e);
    return [];
  }
}

