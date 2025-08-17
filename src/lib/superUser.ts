// superUser.ts
// Unified helpers for setting/getting/checking a Super User key.
// - Uses in-memory secure storage (no localStorage persistence)
// - Prefers env VITE_SUPER_USER_KEY when configured; otherwise falls back to a non-empty stored key (dev use)

export const STORAGE_KEY = "12345";

import { getKey, setKey, removeKey } from "./secureStore";

/** Current key. */
export function getSuperUserKey(): string {
  return getKey(STORAGE_KEY);
}

/** Set the key (empty string clears storage). */
export function setSuperUserKey(key: string) {
  const k = (key ?? "").trim();
  if (k) setKey(STORAGE_KEY, k);
  else removeKey(STORAGE_KEY);
}

/** Optional convenience to clear the key explicitly. */
export function clearSuperUserKey() {
  removeKey(STORAGE_KEY);
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
