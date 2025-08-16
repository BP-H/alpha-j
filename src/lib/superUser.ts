// superUser.ts
// Unified helpers for setting/getting/checking a Super User key.
// - Persists to localStorage under one stable key
// - Keeps an in-memory cache
// - Prefers env VITE_SUPER_USER_KEY when configured; otherwise falls back to a non-empty stored key (dev use)

export const STORAGE_KEY = "12345";

let superUserKeyMem = "";

/** Safely read from localStorage (SSRed/blocked environments safe). */
function readStored(): string {
  if (typeof localStorage === "undefined") return "";
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim() || "";
  } catch {
    return "";
  }
}

/** Current key (memory first, then storage). */
export function getSuperUserKey(): string {
  if (superUserKeyMem) return superUserKeyMem;
  superUserKeyMem = readStored();
  return superUserKeyMem;
}

/** Set & persist the key (empty string clears storage). */
export function setSuperUserKey(key: string) {
  const k = (key ?? "").trim();
  superUserKeyMem = k;
  if (typeof localStorage !== "undefined") {
    try {
      if (k) localStorage.setItem(STORAGE_KEY, k);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

/** Optional convenience to clear the key explicitly. */
export function clearSuperUserKey() {
  setSuperUserKey("");
}

/**
 * Check super-user status.
 * If VITE_SUPER_USER_KEY is set, the candidate must match it.
 * Otherwise (e.g., dev), any non-empty candidate key is treated as super.
 *
 * @param key Optional candidate to check; if omitted, uses the stored key.
 */
export function isSuperUser(key?: string | null): boolean {
  // NOTE: This matches typical Vite typing; adjust if your build system differs.
  const envKey = (import.meta.env.VITE_SUPER_USER_KEY || "").toString().trim();
  const candidate = (key ?? getSuperUserKey()).trim();

  if (envKey) {
    return candidate.length > 0 && candidate === envKey;
  }
  // Dev fallback when no env key is configured:
  return candidate.length > 0;
}
