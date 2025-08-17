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

interface AssistantReplyPayload {
  prompt: string;
  apiKey?: string;
  model?: string;
  voice?: string;
  ctx?: {
    postId?: string | number;
    title?: string;
    text?: string;
    selection?: string;
    images?: string[];
  };
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
  if (!apiKey) warnOnce("Missing OpenAI API key");

  const payload: AssistantReplyPayload = { prompt };
  if (apiKey) payload.apiKey = apiKey;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch("/api/assistant", {
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

    const { text } = await readAssistantStream(res);
    return { ok: true, text };
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : "Network error";
    return { ok: false, error };
  } finally {
    clearTimeout(timeout);
  }
}

async function readAssistantStream(res: Response): Promise<{ text: string; audio: string }> {
  const reader = res.body?.getReader();
  if (!reader) return { text: "", audio: "" };
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let audio = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      let event = "";
      let data = "";
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (event === "text") text += JSON.parse(data);
      else if (event === "audio") audio += data;
    }
  }
  return { text, audio };
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

