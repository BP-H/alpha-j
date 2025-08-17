const store: Record<string, string> = {};

function encode(val: string): string {
  try {
    if (typeof btoa === "function") return btoa(val);
    return Buffer.from(val, "utf-8").toString("base64");
  } catch {
    return val;
  }
}

function decode(val: string): string {
  try {
    if (typeof atob === "function") return atob(val);
    return Buffer.from(val, "base64").toString("utf-8");
  } catch {
    return val;
  }
}

export function getKey(name: string): string {
  if (store[name]) return store[name];
  if (typeof localStorage === "undefined") return "";
  try {
    const raw = localStorage.getItem(name);
    if (!raw) return "";
    const val = decode(raw);
    store[name] = val;
    return val;
  } catch {
    return "";
  }
}

export function setKey(name: string, value: string): void {
  store[name] = value;
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(name, encode(value));
  } catch {}
}

export function removeKey(name: string): void {
  delete store[name];
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(name);
  } catch {}
}

export function clearAll(): void {
  for (const k of Object.keys(store)) removeKey(k);
}
