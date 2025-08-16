// src/lib/bus.ts
type Handler = (payload?: any) => void;
const listeners = new Map<string, Set<Handler>>();

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
export function emit(
  event: string,
  payload?: any,
  onError?: (err: unknown) => void,
) {
  const handlers = listeners.get(event);
  if (!handlers) return;
  for (const fn of handlers) {
    try {
      fn(payload);
    } catch (e) {
      if (onError) onError(e);
      else throw e;
    }
  }
}
export default { on, off, emit };
