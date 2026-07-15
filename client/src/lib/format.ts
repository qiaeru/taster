// SPDX-License-Identifier: MIT
// Formatting helpers: partial dates and accent-insensitive search folding.

import { locale$ } from "../i18n/index.js";

/** Formats "YYYY", "YYYY-MM" or "YYYY-MM-DD" respecting its precision. */
export function formatPartialDate(value: string): string {
  const locale = locale$.get();
  const parts = value.split("-").map(Number);
  if (parts.length === 1) return String(parts[0]);
  const date = new Date(parts[0], (parts[1] ?? 1) - 1, parts[2] ?? 1);
  if (parts.length === 2) {
    return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" }).format(date);
  }
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatDateTime(sqliteUtc: string): string {
  const date = new Date(sqliteUtc.replace(" ", "T") + "Z");
  return new Intl.DateTimeFormat(locale$.get(), { dateStyle: "long" }).format(date);
}

/** Lowercase + strip diacritics, so "chihiro" matches "Chihirô". */
export function searchFold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
