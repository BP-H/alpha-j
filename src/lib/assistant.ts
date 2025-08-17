// src/lib/assistant.ts
import type { AssistantMessage, RemixSpec } from "../types";

type AssistantCtx = {
  postId?: string | number;
  title?: string;
  text?: string;
} | null;

export async function askLLM(
  input: string,
  ctx?: AssistantCtx,
): Promise<AssistantMessage> {
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
        id: crypto.randomUUID(),
        role: "assistant",
        text: data.text || "ok",
        ts: Date.now(),
        postId: ctx?.postId ?? null,
      };
    }

    // Handle non-OK responses so the caller knows the request failed
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
    } catch {
      console.error("assistant request failed: unknown error");
    }
  } catch {
    // fall through to stub
  }

  // offline stub so builds never fail
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    text: `💡 stub: “${input}”`,
    ts: Date.now(),
    postId: ctx?.postId ?? null,
  };
}

export async function askLLMVoice(
  prompt: string,
  ctx?: AssistantCtx,
): Promise<ReadableStream<Uint8Array> | null> {
  let apiKey = "";
  if (typeof window !== "undefined") {
    try {
      apiKey = window.localStorage.getItem("sn2177.apiKey") || "";
    } catch {
      apiKey = "";
    }
  }

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
      return null;
    }

    return res.body as ReadableStream<Uint8Array>;
  } catch {
    // fall through
  }
  return null;
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
