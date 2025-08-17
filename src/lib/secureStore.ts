const store: Record<string, string> = {};

export function getKey(name: string): string {
  return store[name] || "";
}

export function setKey(name: string, value: string): void {
  store[name] = value;
}

export function removeKey(name: string): void {
  delete store[name];
}

export function clearAll(): void {
  for (const k of Object.keys(store)) delete store[k];
}
