// SPDX-License-Identifier: MIT
// Flexible-precision reference dates: "YYYY", "YYYY-MM" or "YYYY-MM-DD".
// Stored as-is; the string length encodes the precision and lexicographic
// order matches chronological order.

const RE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

export function isValidPartialDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = RE.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  if (year < 1 || year > 9999) return false;
  if (m[2] !== undefined) {
    const month = Number(m[2]);
    if (month < 1 || month > 12) return false;
    if (m[3] !== undefined) {
      const day = Number(m[3]);
      // new Date months are 0-based; day 0 of next month = last day of `month`.
      const daysInMonth = new Date(year, month, 0).getDate();
      if (day < 1 || day > daysInMonth) return false;
    }
  }
  return true;
}
