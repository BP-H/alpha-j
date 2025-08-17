// /api/assistant.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = (req.body ?? {}) as {
    apiKey?: string;
    prompt?: string;
    model?: string;
    voice?: string;
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
      : "";

  const prompt = (raw || "").trim().slice(0, 4000);
  if (!prompt) {
    return res.status(400).json({ ok: false, error: "Missing prompt" });
  }

  const model =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : "gpt-4o-mini-tts";
  const voice =
    typeof body.voice === "string" && body.voice.trim()
      ? body.voice.trim()
      : "alloy";

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

  try {
    const openai = new OpenAI({ apiKey });
    const input = messages.map((m) => ({
      role: m.role,
      content: [{ type: "text", text: m.content }],
    }));

    const result = await openai.responses.create({
      model,
      input,
      modalities: ["text", "audio"],
      audio: { voice, format: "mp3" },
      temperature: 0.3,
    });

    const output = result.output || [];
    const textParts = Array.isArray(output[0]?.content) ? output[0].content : [];
    let text = "";
    for (const part of textParts) {
      if (part?.type === "output_text" && typeof part.text === "string") {
        text += part.text;
      }
    }
    const audioB64 =
      output?.[1]?.content?.[0]?.audio?.data && typeof output[1].content[0].audio.data === "string"
        ? output[1].content[0].audio.data
        : "";

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    res.write(`event: text\ndata: ${JSON.stringify(text)}\n\n`);
    if (audioB64) {
      res.write(`event: audio\ndata: ${audioB64}\n\n`);
    }
    res.write(`event: end\ndata: end\n\n`);
    return res.end();
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Network error";
    return res.status(500).json({ ok: false, error: message });
  }
}

