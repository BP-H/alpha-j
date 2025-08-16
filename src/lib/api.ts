// src/lib/api.ts
export async function assistantReply(prompt: string): Promise<{ ok: boolean; text?: string; error?: string }> {
  let apiKey = "";
  if (typeof window !== "undefined") {
    try {
      apiKey = localStorage.getItem("sn2177.apiKey") || "";
    } catch {
      apiKey = "";
    }
  }
  try {
    const r = await fetch("/api/assistant-reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, prompt }), // <— 'prompt' shape
    });
    let j: any;
    try {
      j = await r.json();
    } catch (e: unknown) {
      console.error("Failed to parse /api/assistant-reply response", e);
      return { ok: false, error: "Invalid JSON response" };
    }
    return j?.ok ? { ok: true, text: j.text || "" } : { ok: false, error: j?.error || "Failed" };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Network error";
    return { ok: false, error: message };
  }
}

export async function fetchPlayers(): Promise<{ id: string; name: string; color: string }[]> {
  try {
    const r = await fetch("/api/players");
    let j: any;
    try {
      j = await r.json();
    } catch (e: unknown) {
      console.error("Failed to parse /api/players response", e);
      return [];
    }
    return j?.ok ? (j.players || []) : [];
  } catch (e: unknown) {
    console.error("Failed to fetch players", e);
    return [];
  }
}
