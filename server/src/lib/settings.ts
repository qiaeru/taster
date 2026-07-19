// SPDX-License-Identifier: MIT
// Instance settings (name, theme, default visitor locale) stored in the
// settings table. Unset keys fall back to the shipped defaults, so a fresh
// database behaves exactly like before the feature existed.

import { readdirSync } from "node:fs";
import type { AppSettings } from "@taster/shared";
import { getSetting, setSetting } from "../db/index.js";
import { config } from "../config.js";

export const DEFAULT_APP_NAME = "Taster";

// Theme files are addressed by bare name in a URL (/themes/<name>.css); the
// allowlist keeps traversal characters out and skips editor droppings.
const THEME_NAME = /^[a-z0-9][a-z0-9_-]{0,59}$/i;

/** Names of the CSS files dropped in DATA_DIR/themes, without extension. */
export function listThemeFiles(): string[] {
  let files: string[];
  try {
    files = readdirSync(config.themesDir);
  } catch {
    return [];
  }
  return files
    .filter((f) => f.endsWith(".css"))
    .map((f) => f.slice(0, -4))
    .filter((name) => THEME_NAME.test(name))
    .sort((a, b) => a.localeCompare(b));
}

export function isKnownTheme(name: string): boolean {
  return name === "default" || listThemeFiles().includes(name);
}

export function readAppSettings(): AppSettings {
  const locale = getSetting("default_locale");
  return {
    appName: getSetting("app_name") || DEFAULT_APP_NAME,
    theme: getSetting("theme") || "default",
    defaultLocale: locale === "fr" || locale === "en" ? locale : "auto",
  };
}

export function writeAppSettings(input: AppSettings): void {
  setSetting("app_name", input.appName === DEFAULT_APP_NAME ? "" : input.appName);
  setSetting("theme", input.theme === "default" ? "" : input.theme);
  setSetting("default_locale", input.defaultLocale === "auto" ? "" : input.defaultLocale);
}
