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
      selection?: string;
      imageUrl?: string;
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

  let prompt = (raw || "").trim().slice(0, 4000);
  if (!prompt) {
    return res.status(400).json({ ok: false, error: "Missing prompt" });
  }

  const model = (typeof body.model === "string" && body.model.trim()) || "gpt-4o-mini-tts";
  const voice = (typeof body.voice === "string" && body.voice.trim()) || "alloy";
  const speed =
    typeof body.speed === "number" && Number.isFinite(body.speed) ? body.speed : undefined;

  // If context provided, generate text via chat completion first
  if (body.ctx && (body.ctx.postId || body.ctx.selection || body.ctx.imageUrl)) {
    const ctxSelection =
      typeof body.ctx.selection === "string" ? body.ctx.selection.slice(0, 1000) : "";
    const messages: Array<{ role: "system" | "user"; content: string }> = [
      {
        role: "system",
        content:
          "You are the SuperNOVA assistant orb. Reply in one or two concise sentences. No markdown.",
      },
    ];
    const ctxParts: string[] = [];
    if (body.ctx.postId) ctxParts.push(`ID ${body.ctx.postId}`);
    if (ctxSelection) ctxParts.push(`selection: ${ctxSelection}`);
    if (body.ctx.imageUrl) ctxParts.push(`image ${body.ctx.imageUrl}`);
    if (ctxParts.length) {
      messages.push({ role: "system", content: `Context — ${ctxParts.join(" — ")}` });
    }
    messages.push({ role: "user", content: prompt });

    const cc = new AbortController();
    const ccTimer = setTimeout(() => cc.abort(), 10_000);
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0.3, messages }),
        signal: cc.signal,
      });
      const j = await r.json();
      if (!r.ok) {
        return res
          .status(r.status)
          .json({ ok: false, error: j?.error?.message || "Failed" });
      }
      const text = (j?.choices?.[0]?.message?.content || "").trim();
      if (text) prompt = text;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Network error";
      return res.status(500).json({ ok: false, error: message });
    } finally {
      clearTimeout(ccTimer);
    }
  }

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
        input: prompt,
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