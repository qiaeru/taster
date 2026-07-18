// SPDX-License-Identifier: MIT
// Category and status helpers shared by the admin routes and the JSON import.

import { getDb } from "../db/index.js";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "category";
}

export function uniqueSlug(name: string): string {
  const db = getDb();
  const base = slugify(name);
  let candidate = base;
  for (let i = 2; ; i++) {
    const taken = db.prepare("SELECT 1 FROM categories WHERE slug = ?").get(candidate);
    if (!taken) return candidate;
    candidate = `${base}-${i}`;
  }
}

/**
 * Returns null when the name is missing or too long; unknown icons and colors
 * fall back to the defaults.
 */
export function cleanCategoryFields(input: {
  name?: unknown;
  icon?: unknown;
  color?: unknown;
}): { name: string; icon: string; color: string } | null {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 100) return null;
  const icon = typeof input.icon === "string" && input.icon.length <= 50 ? input.icon : "tag";
  const color =
    typeof input.color === "string" && /^#[0-9a-fA-F]{6}$/.test(input.color)
      ? input.color
      : "#8b5cf6";
  return { name, icon, color };
}

/**
 * Replaces a category's status list with `statuses` (in order). Entries with
 * an id update the existing row, so tastes referencing it are untouched; the
 * rest are inserted, and statuses absent from the list are deleted (their
 * tastes' status_id nulls out via the FK). Runs its statements directly:
 * callers wrap it in their own transaction.
 */
export function replaceStatuses(
  categoryId: number,
  statuses: { id?: number; name: string }[]
): void {
  const db = getDb();
  const keptIds = statuses.filter((s) => s.id).map((s) => s.id as number);
  // Delete first (before inserts, so new rows survive the NOT IN clause).
  if (keptIds.length) {
    db.prepare(
      `DELETE FROM statuses WHERE category_id = ? AND id NOT IN (${keptIds.map(() => "?").join(",")})`
    ).run(categoryId, ...keptIds);
  } else {
    db.prepare("DELETE FROM statuses WHERE category_id = ?").run(categoryId);
  }
  const update = db.prepare(
    "UPDATE statuses SET name = ?, sort_order = ? WHERE id = ? AND category_id = ?"
  );
  const insert = db.prepare(
    "INSERT INTO statuses (category_id, name, sort_order) VALUES (?, ?, ?)"
  );
  statuses.forEach((status, i) => {
    const name = status.name.trim();
    if (!name) return;
    if (status.id) update.run(name, i, status.id, categoryId);
    else insert.run(categoryId, name, i);
  });
}

/**
 * Matches status names to the category's existing rows (JSON imports carry
 * names, not ids), so replaceStatuses keeps their ids and tastes referencing
 * them stay untouched.
 */
export function withExistingStatusIds(
  categoryId: number,
  names: string[]
): { id?: number; name: string }[] {
  const existing = getDb()
    .prepare("SELECT id, name FROM statuses WHERE category_id = ?")
    .all(categoryId) as { id: number; name: string }[];
  const byLowerName = new Map(existing.map((s) => [s.name.toLowerCase(), s.id]));
  return names.map((name) => ({ id: byLowerName.get(name.toLowerCase()), name }));
}
