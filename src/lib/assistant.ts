// src/lib/assistant.ts
import type { AssistantMessage, RemixSpec } from "../types";
import { getKey } from "./secureStore";
import { notify } from "./notify";

export type AssistantCtx = {
  postId?: string | number;
  title?: string;
  text?: string;
} | null;

const warned = new Set<string>();
function getOpenAIKey(): string {
  const key = getKey("openai") || getKey("sn2177.apiKey");
  if (!key && !warned.has("openai")) {
    warned.add("openai");
    console.warn("OpenAI API key is missing");
    notify("OpenAI API key is missing");
  }
  return key;
}

interface AskLLMPayload {
  prompt: string;
  ctx?: AssistantCtx;
  model?: string;
}

interface AskLLMResponse {
  text?: string;
  error?: string;
}

export async function askLLM(
  input: string,
  ctx?: AssistantCtx,
): Promise<{ ok: true; message: AssistantMessage } | { ok: false; error: string }> {
  // Optional model picked in UI and saved to localStorage
  let model: string | undefined;
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem("sn.model.openai");
      if (raw) {
        try {
          model = String(JSON.parse(raw) ?? "").trim() || undefined;
        } catch {
          model = raw.trim() || undefined;
        }
      }
    } catch {
      // ignore
    }
  }

  const payload: AskLLMPayload = { prompt: input };
  if (ctx) payload.ctx = ctx;
  if (model) payload.model = model;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch("/api/assistant-reply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    clearTimeout(t);

    if (!res.ok) {
      let msg = "request failed";
      try {
        const j = (await res.json()) as { error?: string };
        if (j?.error) msg = j.error;
      } catch {
        try {
          msg = (await res.text()) || msg;
        } catch {}
      }
      console.error("assistant request failed:", msg);
      notify(`Assistant request failed: ${msg}`);
      return { ok: false, error: msg };
    }

    const data = (await res.json()) as AskLLMResponse;
    const text = typeof data.text === "string" ? data.text : "";
    return {
      ok: true,
      message: {
        id:
          globalThis.crypto?.randomUUID?.() ??
          Math.random().toString(36).slice(2),
        role: "assistant",
        text,
        ts: Date.now(),
        postId: ctx?.postId ?? null,
      },
    };
  } catch (e) {
    clearTimeout(t);
    const msg = e instanceof Error ? e.message : "network error";
    console.error("assistant request failed:", msg);
    notify(`Assistant request failed: ${msg}`);
    return { ok: false, error: msg };
  }
}

interface AskVoicePayload {
  apiKey: string;
  prompt: string;
  ctx?: AssistantCtx;
}

export async function askLLMVoice(
  prompt: string,
  ctx?: AssistantCtx,
): Promise<{ ok: true; stream: ReadableStream<Uint8Array> } | { ok: false; error: string }> {
  const apiKey = getOpenAIKey();
  if (!apiKey) return { ok: false, error: "missing api key" };

  const payload: AskVoicePayload = { apiKey, prompt };
  if (ctx) payload.ctx = ctx;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15_000);

  try {
    const res = await fetch("/api/assistant-voice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    clearTimeout(t);

    if (!res.ok) {
      let msg = "request failed";
      try {
        const j = (await res.json()) as { error?: string };
        if (j?.error) msg = j.error;
      } catch {
        try {
          msg = (await res.text()) || msg;
        } catch {}
      }
      console.error("assistant voice request failed:", msg);
      notify(`Assistant voice request failed: ${msg}`);
      return { ok: false, error: msg };
    }

    const type = res.headers.get("content-type") || "";
    if (!type.startsWith("audio/") || !res.body) {
      let msg = "invalid audio response";
      try {
        const j = (await res.json()) as { error?: string };
        if (j?.error) msg = j.error;
      } catch {
        try {
          msg = (await res.text()) || msg;
        } catch {}
      }
      return { ok: false, error: msg };
    }
    return { ok: true, stream: res.body };
  } catch (e) {
    clearTimeout(t);
    const msg = e instanceof Error ? e.message : "network error";
    console.error("assistant voice request failed:", msg);
    notify(`Assistant voice request failed: ${msg}`);
    return { ok: false, error: msg };
  }
}

export async function imageToVideo(
  spec: RemixSpec,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const res = await fetch("/api/image-to-video", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(spec),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return { ok: true, url: data.url };
  } catch (e: any) {
    return { ok: false, error: e?.message || "remix failed" };
  }
}
