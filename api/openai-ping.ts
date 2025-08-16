// /api/openai-ping.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const body = (req.body || {}) as { apiKey?: string };
  const headerKey =
    typeof req.headers.authorization === "string"
      ? req.headers.authorization.replace(/^Bearer\s+/i, "")
      : undefined;
  const localKey = (() => {
    try {
      const raw =
        typeof globalThis !== "undefined" &&
        (globalThis as any).localStorage?.getItem("sn.keys.openai");
      return raw ? JSON.parse(raw) : undefined;
    } catch {
      return undefined;
    }
  })();
  const apiKey =
    body.apiKey || headerKey || localKey || process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(400).json({ ok: false, error: "Missing apiKey" });

  try {
    const r = await fetch("https://api.openai.com/v1/models?limit=1", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json({ ok: false, error: data?.error?.message || "Failed" });
    return res.status(200).json({ ok: true, sampleModel: data?.data?.[0]?.id || "ok" });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Network error";
    return res.status(500).json({ ok: false, error: message });
  }
}
