"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

export type Theme = "light" | "dark";
const KEY = "doorcal-theme";

/**
 * Inline script for <head>: applies the saved theme before the first paint so there is no flash.
 * Light is the default; the choice is per browser (localStorage) and never leaves the device.
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(KEY)});document.documentElement.dataset.theme=t==="dark"?"dark":"light"}catch(e){document.documentElement.dataset.theme="light"}`;

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function current(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}
function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {}
  listeners.forEach((cb) => cb());
}

export function ThemeToggle({ className = "", iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  const theme = useSyncExternalStore(subscribe, current, () => "light" as Theme);
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => apply(next)}
      className={`btn-ghost gap-2 px-2.5 py-1.5 text-sm ${className}`}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      <span className={iconOnly ? "sr-only" : ""}>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
