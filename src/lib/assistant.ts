// src/lib/assistant.ts
import type { AssistantMessage, RemixSpec } from "../types";
import bus from "./bus";
import { getKey } from "./secureStore";

type AssistantCtx = {
  postId?: string | number;
  title?: string;
  text?: string;
  selection?: string;
  images?: string[];
} | null;

export type AskPayload = {
  prompt: string;
  ctx?: AssistantCtx;
  model?: string;
  apiKey?: string;
};

export type AskResult =
  | { ok: true; message: AssistantMessage }
  | { ok: false; error: string };

export type AskVoiceResult =
  | { ok: true; audio: Uint8Array; type: string; text?: string }
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

  const apiKey = getKey("openai");
  if (!apiKey) warnOnce("Missing OpenAI API key");

  const payload: AskPayload = { prompt: input };
  if (ctx) payload.ctx = ctx;
  if (model) payload.model = model;
  if (apiKey) payload.apiKey = apiKey;

  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 15_000);
  try {
    const res = await fetch("/api/assistant-reply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
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
    const message: AssistantMessage = {
      id:
        globalThis.crypto?.randomUUID?.() ??
        Math.random().toString(36).slice(2),
      role: "assistant",
      text: data.text || "ok",
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
  command: string,
  ctx?: AssistantCtx,
): Promise<AskVoiceResult> {
  const apiKey = getKey("openai");
  if (!apiKey) {
    warnOnce("Missing OpenAI API key");
    return { ok: false, error: "missing api key" };
  }

  const payload: { apiKey: string; prompt: string; ctx?: AssistantCtx } = {
    apiKey,
    prompt: command,
  };
  if (ctx) payload.ctx = ctx;

  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 15_000);
  try {
    const res = await fetch("/api/assistant-voice", {
      method: "POST",
      headers: { "content-type": "application/json" },
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

    const data = await res.json();
    const type = data?.type || "audio/mpeg";
    const b64 = data?.audio;
    if (!b64 || typeof b64 !== "string") {
      const msg = data?.error || "invalid response";
      const toast = `Assistant voice request failed: ${msg}`;
      bus.emit?.("toast", { message: toast });
      console.error("assistant voice request failed:", msg);
      bus.emit?.("notify", toast);
      return { ok: false, error: msg };
    }

    const binaryString = atob(b64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);

    return { ok: true, audio: bytes, type, text: data?.text };
  } catch (e: any) {
    clearTimeout(timeout);
    const rawMsg = e?.message || "request failed";
    const msg = /network/i.test(rawMsg)
      ? "network error, please check your connection"
      : rawMsg;
    const toast = `Assistant voice request failed: ${msg}`;
    bus.emit?.("toast", { message: toast });
    console.error("assistant voice request failed:", msg);
    bus.emit?.("notify", toast);
    return { ok: false, error: msg };
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
