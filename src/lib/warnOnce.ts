// src/lib/warnOnce.ts
import bus from "./bus";

const WARN_KEY = "__snWarnedMissingKeys";
const warned: Set<string> =
  (globalThis as any)[WARN_KEY] || ((globalThis as any)[WARN_KEY] = new Set<string>());

export function warnMissingKey(name: string, message: string) {
  if (warned.has(name)) return;
  warned.add(name);
  console.warn(message);
  bus.emit?.("notify", message);
}

