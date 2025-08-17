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
    model?: string;
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
  const prompt = (raw || "").trim().slice(0, 2000);
  if (!prompt) {
    return res.status(400).json({ ok: false, error: "Missing prompt" });
  }

  const model =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : "gpt-4o-mini-tts";

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);

  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: prompt,
        response_format: "mp3",
        stream: true,
      }),
      signal: ctrl.signal,
    });

    if (!r.ok) {
      const errText = await r.text();
      res.status(r.status);
      res.setHeader("Content-Type", r.headers.get("content-type") || "application/json");
      return res.send(errText);
    }

    res.status(200);
    res.setHeader("Content-Type", "audio/mpeg");
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

