// src/lib/assistant.ts
import type { AssistantMessage, RemixSpec } from "../types";
import { getKey } from "./secureStore";

type AssistantCtx = {
  postId?: string | number;
  title?: string;
  text?: string;
} | null;

export async function askLLM(
  input: string,
  ctx?: AssistantCtx,
): Promise<{ ok: true; msg: AssistantMessage } | { ok: false; error: string }> {
  try {
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

    const payload: Record<string, unknown> = { prompt: input };
    if (ctx) payload.ctx = ctx;
    if (model) payload.model = model;

    const res = await fetch("/api/assistant-reply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        ok: true,
        msg: {
          id:
            globalThis.crypto?.randomUUID?.() ??
            Math.random().toString(36).slice(2),
          role: "assistant",
          text: data.text || "ok",
          ts: Date.now(),
          postId: ctx?.postId ?? null,
        },
      };
    }

    try {
      const err: any = await res.json().catch(() => null);
      const msg = err?.error || "request failed";
      console.error("assistant request failed:", msg);
      if (typeof window !== "undefined") {
        try {
          window.alert?.(`Assistant request failed: ${msg}`);
        } catch {
          // ignore alert errors
        }
      }
      return { ok: false, error: msg };
    } catch {
      console.error("assistant request failed: unknown error");
      return { ok: false, error: "request failed" };
    }
  } catch {
    // fall through to stub
  }

  return {
    ok: true,
    msg: {
      id:
        globalThis.crypto?.randomUUID?.() ??
        Math.random().toString(36).slice(2),
      role: "assistant",
      text: `💡 stub: “${input}”`,
      ts: Date.now(),
      postId: ctx?.postId ?? null,
    },
  };
}

export async function askLLMVoice(
  prompt: string,
  ctx?: AssistantCtx,
): Promise<{ ok: true; stream: ReadableStream<Uint8Array> } | { ok: false; error: string }> {
  const apiKey = getKey("sn2177.apiKey");

  try {
    const payload: Record<string, unknown> = { apiKey, prompt };
    if (ctx) payload.ctx = ctx;

    const res = await fetch("/api/assistant-voice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => "request failed");
      console.error("assistant voice request failed:", msg);
      if (typeof window !== "undefined") {
        try {
          window.alert?.(`Assistant voice request failed: ${msg}`);
        } catch {
          // ignore alert errors
        }
      }
      return { ok: false, error: msg };
    }

    return { ok: true, stream: res.body as ReadableStream<Uint8Array> };
  } catch {
    // fall through
  }
  return { ok: false, error: "voice request failed" };
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
