// /api/assistant.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = (req.body ?? {}) as {
    apiKey?: string;
    prompt?: string;
    q?: string;
    model?: string;
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

  const model =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : "gpt-4.1-mini";

  const ctx = body.ctx || {};
  const ctxPostId = ctx.postId ?? ctx.post?.id;
  const ctxTitle = ctx.title ?? ctx.post?.title;
  const ctxTextRaw = ctx.text ?? ctx.post?.text;
  const ctxText = typeof ctxTextRaw === "string" ? ctxTextRaw.slice(0, 1000) : "";
  const ctxSelection =
    typeof ctx.selection === "string" ? ctx.selection.slice(0, 1000) : "";
  const ctxImages = Array.isArray(ctx.images)
    ? ctx.images
        .filter((u): u is string => typeof u === "string")
        .filter((u) => /^https?:\/\//i.test(u) || /^data:image\/[a-zA-Z]+;base64,/i.test(u))
        .slice(0, 5)
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

  messages.push({ role: "user", content: prompt });

  const input = messages.map((m) => ({
    role: m.role,
    content: [{ type: "text", text: m.content }],
  }));

  if (ctxImages.length) {
    input.push({
      role: "user",
      content: ctxImages.map((url) => ({ type: "input_image", image_url: url })),
    });
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);

  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, input, temperature: 0.3 }),
      signal: ctrl.signal,
    });

    const data = await r.json();
    if (!r.ok) {
      const message = data?.error?.message || "Failed";
      return res.status(r.status).json({ ok: false, error: message });
    }

    const output = data?.output || [];
    let text = "";
    for (const part of output) {
      if (Array.isArray(part?.content)) {
        for (const c of part.content) {
          if (c.type === "text" && typeof c.text === "string") {
            text += c.text;
          }
        }
      }
    }

    return res.status(200).json({ ok: true, text });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Network error";
    return res.status(500).json({ ok: false, error: message });
  } finally {
    clearTimeout(timer);
  }
}
