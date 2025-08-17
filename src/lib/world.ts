// src/lib/world.ts
export type WorldState = {
  theme: "light";
  orbCount: number;       // 1..64
  orbColor: string;       // css color or #hex
  gridOpacity: number;    // 0..1
  fogLevel: number;       // 0..1 (0=clear, 1=thick)
};

export const defaultWorld: WorldState = {
  theme: "light",
  orbCount: 14,
  orbColor: "#ffffff",
  gridOpacity: 0.05,
  fogLevel: 0.02,
};

// small clamps so bad input never explodes
export function clampWorld(s: WorldState): WorldState {
  const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
  return {
    theme: "light",
    orbCount: Math.round(clamp(s.orbCount, 1, 64)),
    orbColor: s.orbColor || "#ffffff",
    gridOpacity: clamp(s.gridOpacity, 0, 1),
    fogLevel: clamp(s.fogLevel, 0, 1),
  };
}
