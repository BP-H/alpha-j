import { useSyncExternalStore } from "react";
import { load, save } from "./storage";

export type Theme = "dark" | "light";
const THEME_KEY = "sn.theme";

let currentTheme: Theme = load<Theme>(THEME_KEY, "dark");

if (typeof document !== "undefined") {
  document.documentElement.dataset.theme = currentTheme;
}

const listeners = new Set<() => void>();

function setTheme(t: Theme) {
  currentTheme = t;
  save(THEME_KEY, t);
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = t;
  }
  listeners.forEach(l => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => currentTheme);
  return [theme, setTheme] as const;
}
