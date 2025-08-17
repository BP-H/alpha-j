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

export type AssistantError = {
  type: "aborted" | "network" | "openai" | "unknown";
  message: string;
  status?: number;
};

export type AskResult =
  | { ok: true; message: AssistantMessage }
  | { ok: false; error: AssistantError };

export type AskVoiceResult =
  | {
      ok: true;
      audio: Uint8Array;
      url: string;
      type: string;
      text?: string;
    }
  | { ok: false; error: AssistantError };

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
    if (typeof data === "string") return data;
    if (typeof data?.error === "string") return data.error;
    if (typeof data?.error?.message === "string") return data.error.message;
    if (typeof data?.message === "string") return data.message;
    return JSON.stringify(data) || "request failed";
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
      return {
        ok: false,
        error: { type: "openai", message: msg, status: res.status },
      };
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
    let err: AssistantError;
    if (e?.name === "AbortError") {
      err = { type: "aborted", message: "request timed out" };
    } else if (/network/i.test(msg) || /fetch/i.test(msg)) {
      err = { type: "network", message: "network error, please check your connection" };
    } else {
      err = { type: "unknown", message: msg };
    }
    const toast = `Assistant request failed: ${err.message}`;
    bus.emit?.("toast", { message: toast });
    console.error("assistant request failed:", err.message);
    bus.emit?.("notify", toast);
    return { ok: false, error: err };
  }
}

export async function askLLMVoice(
  command: string,
  ctx?: AssistantCtx,
): Promise<AskVoiceResult> {
  const apiKey = getKey("openai");
  if (!apiKey) {
    warnOnce("Missing OpenAI API key");
    return { ok: false, error: { type: "openai", message: "missing api key" } };
  }

  const payload: { prompt: string; ctx?: AssistantCtx } = {
    prompt: command,
  };
  if (ctx) payload.ctx = ctx;

  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 15_000);
  try {
    const res = await fetch("/api/assistant-voice", {
      method: "POST",
      headers: {
        "content-type": "application/json",
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
      return {
        ok: false,
        error: { type: "openai", message: msg, status: res.status },
      };
    }

    const data: { audio: string; text?: string; type?: string } =
      await res.json();
    const type = data.type || "audio/mpeg";
    const bytes = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0));
    const arrayBuffer = bytes.buffer as ArrayBuffer;
    const blob = new Blob([arrayBuffer], { type });
    const url = URL.createObjectURL(blob);
    return { ok: true, audio: bytes, url, type, text: data.text };
  } catch (e: any) {
    clearTimeout(timeout);
    const rawMsg = e?.message || "request failed";
    let err: AssistantError;
    if (e?.name === "AbortError") {
      err = { type: "aborted", message: "request timed out" };
    } else if (/network/i.test(rawMsg) || /fetch/i.test(rawMsg)) {
      err = { type: "network", message: "network error, please check your connection" };
    } else {
      err = { type: "unknown", message: rawMsg };
    }
    const toast = `Assistant voice request failed: ${err.message}`;
    bus.emit?.("toast", { message: toast });
    console.error("assistant voice request failed:", err.message);
    bus.emit?.("notify", toast);
    return { ok: false, error: err };
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
