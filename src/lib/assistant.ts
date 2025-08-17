// src/lib/assistant.ts
import bus from "./bus";
import type { AssistantMessage, RemixSpec } from "../types";
import { getKey } from "./secureStore";

export type AssistantCtx = {
  postId?: string | number;
  title?: string;
  text?: string;
} | null;

interface AskPayload {
  prompt: string;
  ctx?: AssistantCtx;
  model?: string;
}

interface VoicePayload {
  apiKey: string;
  prompt: string;
  ctx?: AssistantCtx;
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

export async function askLLM(
  input: string,
  ctx?: AssistantCtx,
): Promise<{ ok: true; message: AssistantMessage } | { ok: false; error: string }> {
  try {
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
        /* ignore */
      }
    }

    const payload: AskPayload = { prompt: input };
    if (ctx) payload.ctx = ctx;
    if (model) payload.model = model;

    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 15_000);
    const res = await fetch("/api/assistant-reply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    clearTimeout(to);
    if (!res.ok) {
      let msg = "request failed";
      try {
        const err = await res.json();
        if (err?.error) msg = err.error;
      } catch {
        try { msg = await res.text(); } catch {}
      }
      return { ok: false, error: msg };
    }
    const data = await res.json().catch(() => null);
    if (!data || typeof data.text !== "string") {
      return { ok: false, error: "invalid response" };
    }
    const message: AssistantMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      text: data.text,
      ts: Date.now(),
      postId: ctx?.postId ?? null,
    };
    return { ok: true, message };
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? "request timeout" : e?.message || "network error";
    return { ok: false, error: msg };
  }
}

export async function askLLMVoice(
  prompt: string,
  ctx?: AssistantCtx,
): Promise<{ ok: true; stream: ReadableStream<Uint8Array> } | { ok: false; error: string }> {
  const apiKey = getOpenAIKey();
  if (!apiKey) return { ok: false, error: "missing api key" };
  try {
    const payload: VoicePayload = { apiKey, prompt };
    if (ctx) payload.ctx = ctx;

    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 15_000);
    const res = await fetch("/api/assistant-voice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    clearTimeout(to);
    if (!res.ok) {
      let msg = "request failed";
      try {
        const err = await res.json();
        if (err?.error) msg = err.error;
      } catch {
        try { msg = await res.text(); } catch {}
      }
      return { ok: false, error: msg };
    }
    const ct = res.headers.get("content-type") || "";
    if (!ct.startsWith("audio/")) {
      const msg = await res.text().catch(() => "invalid content-type");
      return { ok: false, error: msg };
    }
    if (!res.body || typeof (res.body as any).getReader !== "function") {
      return { ok: false, error: "no audio stream" };
    }
    return { ok: true, stream: res.body as ReadableStream<Uint8Array> };
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? "request timeout" : e?.message || "network error";
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
