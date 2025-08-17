// /api/assistant-reply.ts
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
    // We accept both shapes:
    //  - { ctx: { postId?, title?, text? } }
    //  - { ctx: { post: { id?, title?, text? } } }
    ctx?: {
      postId?: string | number;
      title?: string;
      text?: string;
      post?: { id?: string | number; title?: string; text?: string };
    };
  };
  const headerKey =
    typeof req.headers.authorization === "string"
      ? req.headers.authorization.replace(/^Bearer\s+/i, "").trim()
      : "";
  // For local dev the client may supply an OpenAI key; production should set OPENAI_API_KEY on the server.
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

  // Accept either {prompt} or {q}
  const raw =
    typeof body.prompt === "string"
      ? body.prompt
      : typeof body.q === "string"
        ? body.q
        : "";
  const prompt = (raw || "").trim().slice(0, 2000);
  if (!prompt) {
    return res.status(400).json({ ok: false, error: "Missing prompt" });
  }

  const model =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : "gpt-4o-mini";

  const ctx = body.ctx || {};
  const ctxPostId = ctx.postId ?? ctx.post?.id;
  const ctxTitle = ctx.title ?? ctx.post?.title;
  const ctxTextRaw = ctx.text ?? ctx.post?.text;
  const ctxText = typeof ctxTextRaw === "string" ? ctxTextRaw.slice(0, 1000) : "";

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
    if (ctxTitle) parts.push(`title "${ctxTitle}"`);
    if (ctxText) parts.push(`content: ${ctxText}`);
    messages.push({
      role: "system",
      content: `Context from hovered post — ${parts.join(" — ")}`,
    });
  }

  messages.push({ role: "user", content: prompt });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, temperature: 0.3, messages }),
      signal: ctrl.signal,
    });

    const j = await r.json();
    if (!r.ok) {
      return res
        .status(r.status)
        .json({ ok: false, error: j?.error?.message || "Failed" });
    }

    const text = (j?.choices?.[0]?.message?.content || "").trim();
    return res.status(200).json({ ok: true, text });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Network error";
    return res.status(500).json({ ok: false, error: message });
  } finally {
    clearTimeout(timer);
  }
}
