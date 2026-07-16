// SPDX-License-Identifier: MIT
// Theme management. A theme is a CSS file defining the custom-property
// contract (see styles/themes/default.css); the "default" theme ships light
// and dark schemes selected via data-theme on <html>. Adding a theme later =
// one more CSS file, no component changes.

import { Observable } from "./store.js";

export type Scheme = "light" | "dark";

const KEY = "taster:scheme";

export const scheme$ = new Observable<Scheme>("light");

function savedScheme(): Scheme | null {
  try {
    const saved = localStorage.getItem(KEY) as Scheme | null;
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* ignore */
  }
  return null;
}

function detect(): Scheme {
  return (
    savedScheme() ??
    (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light")
  );
}

let initialized = false;
let transitionTimer: number | null = null;

function apply(scheme: Scheme): void {
  // Skip the cross-fade on the very first apply so the initial paint matches
  // the saved scheme instantly instead of fading in from the default.
  if (initialized) {
    const root = document.documentElement;
    root.classList.add("theme-transitioning");
    if (transitionTimer !== null) window.clearTimeout(transitionTimer);
    transitionTimer = window.setTimeout(() => {
      root.classList.remove("theme-transitioning");
      transitionTimer = null;
    }, 250);
  }
  document.documentElement.setAttribute("data-theme", scheme);
  initialized = true;
}

export function initTheme(): void {
  scheme$.set(detect());
  scheme$.subscribe(apply);
  // Follow live system-preference changes as long as the visitor never chose
  // manually; a manual toggle persists and wins from then on.
  window
    .matchMedia?.("(prefers-color-scheme: dark)")
    .addEventListener("change", (e: MediaQueryListEvent) => {
      if (savedScheme() === null) scheme$.set(e.matches ? "dark" : "light");
    });
}

export function toggleScheme(): void {
  const next: Scheme = scheme$.get() === "dark" ? "light" : "dark";
  // Only a manual toggle persists; plain detection must keep following the
  // system preference across visits.
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* ignore */
  }
  scheme$.set(next);
}
