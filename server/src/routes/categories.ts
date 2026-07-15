// SPDX-License-Identifier: MIT
// Public read API: categories (with their ordered statuses) and tags.

import type { FastifyInstance } from "fastify";
import type { Category, Status } from "@taster/shared";
import { getDb } from "../db/index.js";

export function listCategories(): Category[] {
  const db = getDb();
  const categories = db
    .prepare(
      `SELECT id, slug, name, icon, color, sort_order AS sortOrder
       FROM categories ORDER BY sort_order, id`
    )
    .all() as unknown as Omit<Category, "statuses">[];
  const statuses = db
    .prepare(
      `SELECT id, category_id AS categoryId, name, sort_order AS sortOrder
       FROM statuses ORDER BY sort_order, id`
    )
    .all() as unknown as (Status & { categoryId: number })[];
  const byCategory = new Map<number, Status[]>();
  for (const s of statuses) {
    const list = byCategory.get(s.categoryId) ?? [];
    list.push({ id: s.id, name: s.name, sortOrder: s.sortOrder });
    byCategory.set(s.categoryId, list);
  }
  return categories.map((c) => ({ ...c, statuses: byCategory.get(c.id) ?? [] }));
}

export default async function categoryRoutes(app: FastifyInstance) {
  app.get("/categories", async () => listCategories());

  // Tags of published tastes only: the filter bar and the admin autocomplete
  // both use it, and draft-only tags must not leak to visitors.
  app.get("/tags", async () => {
    return getDb()
      .prepare(
        `SELECT DISTINCT tg.id, tg.name FROM tags tg
         JOIN taste_tags tt ON tt.tag_id = tg.id
         JOIN tastes t ON t.id = tt.taste_id AND t.published = 1
         ORDER BY tg.name COLLATE NOCASE`
      )
      .all();
  });
}
