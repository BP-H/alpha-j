let superUserKey = "";

export function setSuperUserKey(key: string) {
  superUserKey = key.trim();
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("superUserKey", superUserKey);
    }
  } catch {
    /* ignore */
  }
}

export function isSuperUser(): boolean {
  const envKey = (import.meta.env.VITE_SUPER_USER_KEY || "").trim();
  return (
    superUserKey.length > 0 &&
    envKey.length > 0 &&
    superUserKey === envKey
  );
}

