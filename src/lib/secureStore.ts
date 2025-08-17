const PREFIX = "sn.secure.";
const SECRET = "nova";

function b64encode(str: string): string {
  if (typeof btoa === "function") return btoa(str);
  return Buffer.from(str, "utf8").toString("base64");
}

function b64decode(str: string): string {
  if (typeof atob === "function") return atob(str);
  return Buffer.from(str, "base64").toString("utf8");
}

function encode(value: string): string {
  const xored = value
    .split("")
    .map((ch, i) =>
      String.fromCharCode(ch.charCodeAt(0) ^ SECRET.charCodeAt(i % SECRET.length)),
    )
    .join("");
  return b64encode(xored);
}

function decode(value: string): string {
  try {
    const raw = b64decode(value);
    return raw
      .split("")
      .map((ch, i) =>
        String.fromCharCode(
          ch.charCodeAt(0) ^ SECRET.charCodeAt(i % SECRET.length),
        ),
      )
      .join("");
  } catch {
    return "";
  }
}

export function getKey(name: string): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(PREFIX + name);
    return raw ? decode(raw) : "";
  } catch {
    return "";
  }
}

export function setKey(name: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + name, encode(value));
  } catch {
    // ignore
  }
}

export function removeKey(name: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PREFIX + name);
  } catch {
    // ignore
  }
}

export function clearAll(): void {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    for (const k of keys) window.localStorage.removeItem(k);
  } catch {
    // ignore
  }
}
