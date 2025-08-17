// src/lib/assistant.ts
import type { AssistantMessage, RemixSpec } from "../types";
import bus from "./bus";
import { getKey } from "./secureStore";

type AssistantCtx = {
  postId?: string | number;
  title?: string;
  text?: string;
} | null;

interface AskPayload {
  prompt: string;
  ctx?: AssistantCtx;
  model?: string;
}

interface AskResponseJson {
  text?: string;
  error?: string;
}

export async function askLLM(
  input: string,
  ctx?: AssistantCtx,
): Promise<{ ok: boolean; message?: AssistantMessage; error?: string }> {
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
      } catch {}
    }

    const payload: AskPayload = { prompt: input };
    if (ctx) payload.ctx = ctx;
    if (model) payload.model = model;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch("/api/assistant-reply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok) {
        let err: any = null;
        try {
          err = await res.json();
        } catch {}
        const msg = err?.error || (await res.text().catch(() => "request failed"));
        console.error("assistant request failed:", msg);
        bus.emit("toast", `Assistant request failed: ${msg}`);
        return { ok: false, error: msg };
      }
      const data = (await res.json()) as AskResponseJson;
      const text = typeof data.text === "string" ? data.text : undefined;
      if (text) {
        return {
          ok: true,
          message: {
            id: crypto.randomUUID(),
            role: "assistant",
            text,
            ts: Date.now(),
            postId: ctx?.postId ?? null,
          },
        };
      }
      const msg = data.error || "request failed";
      console.error("assistant request failed:", msg);
      bus.emit("toast", `Assistant request failed: ${msg}`);
      return { ok: false, error: msg };
    } finally {
      clearTimeout(timeout);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "network error";
    console.error("assistant request error:", msg);
    bus.emit("toast", `Assistant request failed: ${msg}`);
    return { ok: false, error: msg };
  }
}

interface VoicePayload {
  apiKey: string;
  prompt: string;
  ctx?: AssistantCtx;
}

const warned = new Set<string>();
function warnMissingKey(msg: string) {
  if (!warned.has(msg)) {
    warned.add(msg);
    console.warn(msg);
    bus.emit("toast", msg);
  }
}

export async function askLLMVoice(
  prompt: string,
  ctx?: AssistantCtx,
): Promise<{ ok: boolean; stream?: ReadableStream<Uint8Array>; error?: string }> {
  const apiKey = getKey("openai") || getKey("sn2177.apiKey");
  if (!apiKey) {
    warnMissingKey("OpenAI API key not set");
    return { ok: false, error: "missing api key" };
  }
  const payload: VoicePayload = { apiKey, prompt };
  if (ctx) payload.ctx = ctx;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch("/api/assistant-voice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      let err: any = null;
      try {
        err = await res.json();
      } catch {}
      const msg = err?.error || (await res.text().catch(() => "request failed"));
      console.error("assistant voice request failed:", msg);
      bus.emit("toast", `Assistant voice request failed: ${msg}`);
      return { ok: false, error: msg };
    }
    const ct = res.headers.get("content-type") || "";
    if (!ct.startsWith("audio/")) {
      const msg = "unexpected content-type";
      console.error("assistant voice request failed:", msg);
      bus.emit("toast", `Assistant voice request failed: ${msg}`);
      return { ok: false, error: msg };
    }
    const body = res.body;
    if (!body || !(body instanceof ReadableStream)) {
      const msg = "missing audio stream";
      console.error("assistant voice request failed:", msg);
      bus.emit("toast", `Assistant voice request failed: ${msg}`);
      return { ok: false, error: msg };
    }
    return { ok: true, stream: body };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "network error";
    console.error("assistant voice request error:", msg);
    bus.emit("toast", `Assistant voice request failed: ${msg}`);
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timeout);
  }
}

export async function imageToVideo(
  spec: RemixSpec
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
