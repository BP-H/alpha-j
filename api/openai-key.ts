import type { VercelRequest, VercelResponse } from "@vercel/node";

const COOKIE_NAME = "sn-openai-key";

export function getStoredOpenAIKey(req: VercelRequest): string {
  const cookie = req.headers.cookie;
  if (!cookie) return "";
  const match = cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return "";
  return decodeURIComponent(match.substring(COOKIE_NAME.length + 1));
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "POST") {
    const body = (req.body ?? {}) as { apiKey?: string };
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    if (!apiKey) {
      return res.status(400).json({ ok: false, error: "Missing apiKey" });
    }
    res.setHeader(
      "Set-Cookie",
      `${COOKIE_NAME}=${encodeURIComponent(apiKey)}; HttpOnly; Path=/; Max-Age=31536000; SameSite=Lax`
    );
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    res.setHeader(
      "Set-Cookie",
      `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
    );
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

