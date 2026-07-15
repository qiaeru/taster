// SPDX-License-Identifier: MIT
// Theme management. A theme is a CSS file defining the custom-property
// contract (see styles/themes/default.css); the "default" theme ships light
// and dark schemes selected via data-theme on <html>. Adding a theme later =
// one more CSS file + one THEMES entry, no component changes.

import { Observable } from "./store.js";

export type Scheme = "light" | "dark";

export const THEMES = ["default"] as const;

const KEY = "taster:scheme";

export const scheme$ = new Observable<Scheme>("light");

function detect(): Scheme {
  try {
    const saved = localStorage.getItem(KEY) as Scheme | null;
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* ignore */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
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
  try {
    localStorage.setItem(KEY, scheme);
  } catch {
    /* ignore */
  }
  initialized = true;
}

export function initTheme(): void {
  scheme$.set(detect());
  scheme$.subscribe(apply);
}

export function toggleScheme(): void {
  scheme$.set(scheme$.get() === "dark" ? "light" : "dark");
}
