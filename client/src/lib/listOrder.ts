// SPDX-License-Identifier: MIT
// The list page records the taste ids in the order it last displayed; the
// detail page reads them back to offer prev/next navigation. Session-scoped
// on purpose: a fresh tab starts from the default order.

const KEY = "taster:list-order";

export function rememberListOrder(ids: string[]): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export function readListOrder(): string[] {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
    // Guard the shape: JSON.parse("null") or a tampered value must not reach
    // callers as a non-array (they call .includes/.indexOf on it).
    return Array.isArray(parsed) && parsed.every((x) => typeof x === "string") ? parsed : [];
  } catch {
    return [];
  }
}
