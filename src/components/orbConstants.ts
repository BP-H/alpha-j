export const HOLD_MS = 280;

// Use viewport-based sizing for gesture tolerances so the orb feels
// consistent across devices. Fall back to sensible defaults when
// `window` is unavailable (SSR/tests).
const vw = typeof window === "undefined" ? 1000 : window.innerWidth;

// How far the pointer can move (in px) before a press is cancelled.
// Previously this was a hard-coded 8px.
export const MOVE_TOLERANCE = Math.max(6, vw * 0.01); // ≈1vw

// Padding from the screen edge when snapping the orb into place.
// Previously this was a hard-coded 12px.
export const SNAP_PADDING = Math.max(10, vw * 0.015); // ≈1.5vw
