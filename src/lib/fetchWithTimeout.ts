export interface FetchTimeoutOptions extends RequestInit {
  timeout?: number;
}

const DEFAULT_TIMEOUT = 15_000;

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  { timeout = DEFAULT_TIMEOUT, ...init }: FetchTimeoutOptions = {}
): Promise<Response | null> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") {
      return null;
    }
    throw e;
  } finally {
    clearTimeout(id);
  }
}
