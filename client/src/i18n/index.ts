// SPDX-License-Identifier: MIT
import { Observable } from "../lib/store.js";
import { detectLocale, type Locale } from "./detect.js";
import fr from "./locales/fr.json";
import en from "./locales/en.json";

export type { Locale };

type Dict = Record<string, string>;

const dicts: Record<Locale, Dict> = { fr, en };

export const SUPPORTED_LOCALES: ReadonlyArray<{ code: Locale; native: string }> = [
  { code: "en", native: "English" },
  { code: "fr", native: "Français" },
];

const LOCALE_CODES: readonly Locale[] = SUPPORTED_LOCALES.map((l) => l.code);
const STORAGE_KEY = "taster:locale";

const initial: Locale = (() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved && LOCALE_CODES.includes(saved)) return saved;
  } catch {
    /* ignore */
  }
  return detectLocale(LOCALE_CODES);
})();

export const locale$ = new Observable<Locale>(initial);

locale$.subscribe((l) => {
  document.documentElement.lang = l;
});

/** True when the visitor explicitly picked a language (via the switcher). */
export function hasStoredLocale(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    return saved !== null && LOCALE_CODES.includes(saved);
  } catch {
    return false;
  }
}

// Fallback chain: active locale → French (source of truth) → raw key.
export function t(key: string, params?: Record<string, string | number>): string {
  const dict = dicts[locale$.get()];
  const raw = dict[key] ?? dicts.fr[key] ?? key;
  if (!params) return raw;
  return raw.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => String(params[k] ?? `{{${k}}}`));
}

// Only an explicit pick persists: a remembered detection or admin default
// would freeze the visitor's language against later browser or instance
// setting changes.
export function setLocale(l: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, l);
  } catch {
    /* ignore */
  }
  locale$.set(l);
}

/** Admin-chosen visitor default; overrides detection but not a stored pick. */
export function applyDefaultLocale(l: Locale): void {
  locale$.set(l);
}
