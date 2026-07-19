// SPDX-License-Identifier: MIT
// Instance settings (name, theme, default visitor locale), fetched once
// before the first render; the shipped defaults cover a failed fetch so the
// app still boots when the API is unreachable.

import type { AppSettings } from "@taster/shared";
import { api } from "../api.js";

const DEFAULTS: AppSettings = { appName: "Taster", theme: "default", defaultLocale: "auto" };

let current: AppSettings = DEFAULTS;

export function appSettings(): AppSettings {
  return current;
}

export function appName(): string {
  return current.appName;
}

export async function initAppSettings(): Promise<void> {
  try {
    current = await api.get<AppSettings>("/api/settings");
  } catch {
    current = DEFAULTS;
  }
  applyTheme(current.theme);
  document.title = current.appName;
}

/** Applies freshly saved settings live (header brand and theme stylesheet). */
export function applyAppSettings(next: AppSettings): void {
  current = next;
  applyTheme(next.theme);
  const brand = document.querySelector(".brand-name");
  if (brand) brand.textContent = next.appName;
}

// Extra themes ship as standalone stylesheets under /themes; loading one after
// the bundle lets it override the default theme's custom properties.
function applyTheme(theme: string): void {
  const existing = document.getElementById("theme-css") as HTMLLinkElement | null;
  if (theme === "default") {
    existing?.remove();
    return;
  }
  const href = `/themes/${encodeURIComponent(theme)}.css`;
  if (existing) {
    if (existing.getAttribute("href") !== href) existing.href = href;
    return;
  }
  const link = document.createElement("link");
  link.id = "theme-css";
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}
