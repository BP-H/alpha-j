const STORAGE_KEY = "sn2177.superKey";

export function getSuperUserKey(): string {
  if (typeof localStorage === "undefined") return "";
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim() || "";
  } catch {
    return "";
  }
}

export function setSuperUserKey(key: string) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, key.trim());
  } catch {}
}

export function isSuperUser(key?: string | null): boolean {
  const stored = getSuperUserKey();
  return !!key && key === stored && stored.length > 0;
}
