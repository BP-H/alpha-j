// src/lib/bus.ts
import { logError } from "./logger";

type Handler = (payload?: any) => void;
const listeners = new Map<string, Set<Handler>>();

export const ERROR_EVENT = "__error__";

export function on(event: string, handler: Handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(handler);
  return () => off(event, handler);
}
export function off(event: string, handler: Handler) {
  const handlers = listeners.get(event);
  handlers?.delete(handler);
  if (handlers && handlers.size === 0) listeners.delete(event);
}
export function emit(event: string, payload?: any) {
  const handlers = listeners.get(event);
  if (!handlers) return;
  for (const fn of handlers) {
    try {
      fn(payload);
    } catch (e) {
      void logError(e);
      if (event !== ERROR_EVENT)
        emit(ERROR_EVENT, { event, payload, error: e });
    }
  }
}
export default { on, off, emit, ERROR_EVENT };
