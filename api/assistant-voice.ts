// /api/assistant-voice.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = (req.body ?? {}) as {
    apiKey?: string;
    prompt?: string;
    q?: string;
    model?: string; // e.g. "gpt-4o-mini-tts"
    voice?: string; // e.g. "alloy", "verse", "aria"
    speed?: number; // optional: 0.25 - 4
    ctx?: {
      postId?: string | number;
      title?: string;
      text?: string;
      selection?: string;
      images?: string[];
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

  const model = (typeof body.model === "string" && body.model.trim()) || "gpt-4o-mini-tts";
  const voice = (typeof body.voice === "string" && body.voice.trim()) || "alloy";
  const speed =
    typeof body.speed === "number" && Number.isFinite(body.speed) ? body.speed : undefined;

  const ctx = body.ctx || {};
  const ctxPostId = ctx.postId ?? ctx.post?.id;
  const ctxTitle = ctx.title ?? ctx.post?.title;
  const ctxTextRaw = ctx.text ?? ctx.post?.text;
  const ctxText = typeof ctxTextRaw === "string" ? ctxTextRaw.slice(0, 1000) : "";
  const ctxSelection =
    typeof ctx.selection === "string" ? ctx.selection.slice(0, 1000) : "";
  const ctxImages = Array.isArray(ctx.images)
    ? ctx.images.filter((u): u is string => typeof u === "string").slice(0, 5)
    : [];

  const messages: Array<{ role: "system" | "user"; content: string }> = [
    {
      role: "system",
      content:
        "You are the SuperNOVA assistant orb. Reply in one or two concise sentences. No markdown.",
    },
  ];

  if (ctxPostId || ctxTitle || ctxText) {
    const parts: string[] = [];
    if (ctxPostId) parts.push(`ID ${ctxPostId}`);
    if (ctxTitle) parts.push(`title \"${ctxTitle}\"`);
    if (ctxText) parts.push(`content: ${ctxText}`);
    messages.push({
      role: "system",
      content: `Context from hovered post — ${parts.join(" — ")}`,
    });
  }

  if (ctxSelection) {
    messages.push({ role: "system", content: `User selected text: ${ctxSelection}` });
  }

  if (ctxImages.length) {
    messages.push({ role: "system", content: `Image URLs: ${ctxImages.join(", ")}` });
  }

  messages.push({ role: "user", content: prompt });

  // Give time for the Responses API to stream audio back
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45_000);

  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        modalities: ["audio"],
        audio: { voice, format: "mp3", ...(speed ? { speed } : {}) },
        input: messages,
        stream: true,
      }),
      signal: ctrl.signal,
    });

    if (!r.ok || !r.body) {
      const errText = await r.text().catch(() => "");
      res.status(r.status);
      res.setHeader(
        "Content-Type",
        r.headers.get("content-type") || "application/json"
      );
      return res.send(errText || JSON.stringify({ ok: false, error: "Failed" }));
    }

    res.status(200);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");

    const reader = (r.body as ReadableStream<Uint8Array>).getReader();
    const textDecoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += textDecoder.decode(value, { stream: true });

      let idx;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        if (line.startsWith("data:")) {
          const data = line.slice(5).trim();
          if (data === "[DONE]") {
            reader.cancel();
            break;
          }
          try {
            const j = JSON.parse(data);
            if (j.type === "response.output_audio.delta" && j.delta) {
              const chunk = Buffer.from(j.delta, "base64");
              if (chunk.length) res.write(chunk);
            } else if (j.type === "response.completed") {
              reader.cancel();
              break;
            }
          } catch {}
        }
      }
    }
    res.end();
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Network error";
    return res.status(500).json({ ok: false, error: message });
  } finally {
    clearTimeout(timer);
  }
}