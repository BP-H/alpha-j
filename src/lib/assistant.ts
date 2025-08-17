// src/lib/assistant.ts
import type { AssistantMessage, RemixSpec } from "../types";
import bus from "./bus";
import { getKey } from "./secureStore";

type AssistantCtx = {
  postId?: string | number;
  title?: string;
  text?: string;
} | null;

export type AskPayload = {
  prompt: string;
  ctx?: AssistantCtx;
  model?: string;
};

export type AskResult =
  | { ok: true; message: AssistantMessage }
  | { ok: false; error: string };

export type AskVoiceResult =
  | { ok: true; stream: ReadableStream<Uint8Array>; type: string }
  | { ok: false; error: string };

const warnOnce = (() => {
  let warned = false;
  return (msg: string) => {
    if (!warned) {
      warned = true;
      bus.emit?.("notify", msg);
    }
  };
})();

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return (
      (data && (data.error || data.message)) ||
      (typeof data === "string" ? data : JSON.stringify(data)) ||
      "request failed"
    );
  } catch {
    try {
      return (await res.text()) || "request failed";
    } catch {
      return "request failed";
    }
  }
}

export async function askLLM(
  input: string,
  ctx?: AssistantCtx,
): Promise<AskResult> {
  const apiKey = getKey("openai");
  if (!apiKey) {
    warnOnce("Missing OpenAI API key");
    return { ok: false, error: "missing api key" };
  }

  // Optional model picked in UI and saved to localStorage
  let model: string | undefined;
  if (typeof window !== "undefined") {
    const raw = (() => {
      try {
        return window.localStorage.getItem("sn.model.openai");
      } catch {
        return null;
      }
    })();
    if (raw) {
      try {
        model = String(JSON.parse(raw) ?? "").trim() || undefined;
      } catch {
        model = raw.trim() || undefined;
      }
    }
  }

  const messages: Array<{ role: "system" | "user"; content: string }> = [
    {
      role: "system",
      content:
        "You are the SuperNOVA assistant orb. Reply in one or two concise sentences. No markdown.",
    },
  ];
  if (ctx?.postId || ctx?.title || ctx?.text) {
    const parts: string[] = [];
    if (ctx.postId) parts.push(`ID ${ctx.postId}`);
    if (ctx.title) parts.push(`title "${ctx.title}"`);
    if (ctx.text) parts.push(`content: ${ctx.text}`);
    messages.push({
      role: "system",
      content: `Context from hovered post — ${parts.join(" — ")}`,
    });
  }
  messages.push({ role: "user", content: input.slice(0, 2000) });

  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 15_000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "gpt-4o-mini",
        temperature: 0.3,
        messages,
      }),
      signal: ac.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const msg = await parseError(res);
      const toast = `Assistant request failed: ${msg}`;
      bus.emit?.("toast", { message: toast });
      console.error("assistant request failed:", msg);
      bus.emit?.("notify", toast);
      return { ok: false, error: msg };
    }

    const data = await res.json();
    const text = (data?.choices?.[0]?.message?.content || "").trim() || "ok";
    const message: AssistantMessage = {
      id:
        globalThis.crypto?.randomUUID?.() ??
        Math.random().toString(36).slice(2),
      role: "assistant",
      text,
      ts: Date.now(),
      postId: ctx?.postId ?? null,
    };
    return { ok: true, message };
  } catch (e: any) {
    clearTimeout(timeout);
    const msg = e?.message || "request failed";
    const toast = `Assistant request failed: ${msg}`;
    bus.emit?.("toast", { message: toast });
    console.error("assistant request failed:", msg);
    bus.emit?.("notify", toast);
    return { ok: false, error: msg };
  }
}

export async function askLLMVoice(
  prompt: string,
  ctx?: AssistantCtx,
): Promise<AskVoiceResult> {
  const apiKey = getKey("openai");
  if (!apiKey) {
    warnOnce("Missing OpenAI API key");
    return { ok: false, error: "missing api key" };
  }

  const payload = {
    model: "gpt-4o-mini-tts",
    voice: "alloy",
    input: prompt,
  };

  const retries = 2;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 15_000);
    try {
      const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Accept: "audio/mpeg",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: ac.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const msg = await parseError(res);
        const toast = `Assistant voice request failed: ${msg}`;
        bus.emit?.("toast", { message: toast });
        console.error("assistant voice request failed:", msg);
        bus.emit?.("notify", toast);
        return { ok: false, error: msg };
      }

      const type = res.headers.get("content-type") || "";
      if (!type.startsWith("audio/")) {
        const msg = await parseError(res);
        const toast = `Assistant voice request failed: ${msg}`;
        bus.emit?.("toast", { message: toast });
        console.error("assistant voice request failed:", msg);
        bus.emit?.("notify", toast);
        return { ok: false, error: msg || "invalid content type" };
      }

      const body = res.body as ReadableStream<Uint8Array> | null;
      if (!body || typeof (body as any).getReader !== "function") {
        const msg = "invalid response body";
        const toast = `Assistant voice request failed: ${msg}`;
        bus.emit?.("toast", { message: toast });
        console.error("assistant voice request failed:", msg);
        bus.emit?.("notify", toast);
        return { ok: false, error: msg };
      }

      return { ok: true, stream: body, type };
    } catch (e: any) {
      clearTimeout(timeout);
      const rawMsg = e?.message || "request failed";
      const msg = /network/i.test(rawMsg)
        ? "network error, please check your connection"
        : rawMsg;
      if (attempt < retries) {
        console.warn(
          `assistant voice request failed (attempt ${attempt + 1}): ${msg}`,
        );
        continue;
      }
      const toast = `Assistant voice request failed: ${msg}`;
      bus.emit?.("toast", { message: toast });
      console.error("assistant voice request failed:", msg);
      bus.emit?.("notify", toast);
      return { ok: false, error: msg };
    }
  }

  return { ok: false, error: "request failed" };
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
