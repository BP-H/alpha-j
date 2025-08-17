// /api/assistant-voice.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Readable } from "node:stream";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = (req.body ?? {}) as {
    apiKey?: string;
    prompt?: string;
    q?: string;
    model?: string;  // e.g. "gpt-4o-mini-tts"
    voice?: string;  // e.g. "alloy", "verse", "aria"
    speed?: number;  // optional: 0.25 - 4
    ctx?: {
      postId?: string | number;
      title?: string;
      text?: string;
      selection?: string;
      image?: string;
      post?: { id?: string | number; title?: string; text?: string };
    };
  };

  const headerKey =
    typeof req.headers.authorization === "string"
      ? req.headers.authorization.replace(/^Bearer\s+/i, "").trim()
      : "";

  const apiKey =
    (headerKey || (typeof body.apiKey === "string" ? body.apiKey.trim() : "")) ||
    (process.env.OPENAI_API_KEY || "");

  if (!apiKey) {
    return res.status(401).json({
      ok: false,
      error:
        "Unauthorized: missing OpenAI API key. Provide one in the request or set OPENAI_API_KEY on the server.",
    });
  }

  const raw =
    typeof body.prompt === "string"
      ? body.prompt
      : typeof body.q === "string"
        ? body.q
        : "";

  const prompt = (raw || "").trim().slice(0, 4000);
  if (!prompt) {
    return res.status(400).json({ ok: false, error: "Missing prompt" });
  }

  const ctx = body.ctx || {};
  const ctxPostId = ctx.postId ?? ctx.post?.id;
  const ctxTitle = ctx.title ?? ctx.post?.title;
  const ctxTextRaw = ctx.text ?? ctx.post?.text;
  const ctxSelectionRaw = ctx.selection;
  const ctxImageRaw = ctx.image;
  const ctxText = typeof ctxTextRaw === "string" ? ctxTextRaw.slice(0, 1000) : "";
  const ctxSelection =
    typeof ctxSelectionRaw === "string" ? ctxSelectionRaw.slice(0, 1000) : "";
  const ctxImage = typeof ctxImageRaw === "string" ? ctxImageRaw : "";
  let promptWithCtx = prompt;
  const parts: string[] = [];
  if (ctxPostId) parts.push(`ID ${ctxPostId}`);
  if (ctxTitle) parts.push(`title "${ctxTitle}"`);
  if (ctxText) parts.push(`content: ${ctxText}`);
  if (ctxSelection) parts.push(`selection: "${ctxSelection}"`);
  if (ctxImage) parts.push(`image: ${ctxImage}`);
  if (parts.length) {
    promptWithCtx = `Context — ${parts.join(" — ")}` + "\n\n" + prompt;
  }

  const model = (typeof body.model === "string" && body.model.trim()) || "gpt-4o-mini-tts";
  const voice = (typeof body.voice === "string" && body.voice.trim()) || "alloy";
  const speed =
    typeof body.speed === "number" && Number.isFinite(body.speed) ? body.speed : undefined;

  // Give TTS enough time to respond (Vercel Node functions allow longer than Edge)
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45_000);

  try {
    // This endpoint returns **binary audio** (not SSE), perfect for piping.
    const r = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Ask for mp3 back:
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        model,
        voice,
        input: promptWithCtx,
        ...(speed ? { speed } : {}),
      }),
      signal: ctrl.signal,
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      res.status(r.status);
      res.setHeader(
        "Content-Type",
        r.headers.get("content-type") || "application/json"
      );
      return res.send(errText || JSON.stringify({ ok: false, error: "Failed" }));
    }

    // Stream the audio through to the client
    res.status(200);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    if (r.body) {
      Readable.fromWeb(r.body as any).pipe(res);
    } else {
      res.end();
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Network error";
    return res.status(500).json({ ok: false, error: message });
  } finally {
    clearTimeout(timer);
  }
}