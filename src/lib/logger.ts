export async function logError(error: unknown, info?: unknown) {
  try {
    await fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: String(error), info }),
    });
  } catch {
    // ignore logging errors
  }
}
