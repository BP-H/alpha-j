import { emit } from "./bus";

let last = 0;

export function notify(message: string) {
  const now = Date.now();
  if (now - last < 60_000) return;
  last = now;
  emit("notify", message);
}
