import { fetchWithTimeout } from "./fetchWithTimeout";

export async function logError(error: unknown, info?: unknown) {
  try {
    await fetchWithTimeout('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: String(error), info }),
      timeout: 5_000,
    });
  } catch {
    // ignore logging errors
  }
}
