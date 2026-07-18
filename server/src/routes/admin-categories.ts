// SPDX-License-Identifier: MIT
// Admin category management: create/update/delete categories and the ordered
// replacement of a category's status list (existing ids preserved so tastes
// keep their status).

import type { FastifyInstance } from "fastify";
import type { CategoryInput, StatusesInput } from "@taster/shared";
import { getDb, bumpDataRevision, isUniqueViolation, transaction } from "../db/index.js";
import { GENERIC_STATUSES, seededLocale } from "../db/seed.js";
import { listCategories } from "./categories.js";

const ID_PARAMS = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "integer", minimum: 1 } },
} as const;

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

function cleanCategoryInput(input: CategoryInput): { name: string; icon: string; color: string } {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 100) throw Object.assign(new Error("VALIDATION"), { statusCode: 400 });
  const icon = typeof input.icon === "string" && input.icon.length <= 50 ? input.icon : "tag";
  const color =
    typeof input.color === "string" && /^#[0-9a-fA-F]{6}$/.test(input.color)
      ? input.color
      : "#8b5cf6";
  return { name, icon, color };
}

export default async function adminCategoryRoutes(app: FastifyInstance) {
  app.post("/categories", async (request, reply) => {
    const db = getDb();
    const { name, icon, color } = cleanCategoryInput(request.body as CategoryInput);
    const slug = uniqueSlug(name);
    const maxOrder = (
      db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM categories").get() as { m: number }
    ).m;
    const id = transaction(() => {
      const info = db
        .prepare("INSERT INTO categories (slug, name, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)")
        .run(slug, name, icon, color, maxOrder + 1);
      // New categories start with the generic statuses of the seed locale.
      const statuses = GENERIC_STATUSES[seededLocale()] ?? GENERIC_STATUSES.en;
      const insert = db.prepare(
        "INSERT INTO statuses (category_id, name, sort_order) VALUES (?, ?, ?)"
      );
      statuses.forEach((status, i) => insert.run(info.lastInsertRowid, status, i));
      bumpDataRevision();
      return Number(info.lastInsertRowid);
    })();
    return reply.code(201).send(listCategories().find((c) => c.id === id));
  });

  // Persists a drag-and-drop reorder of the category cards: sort_order
  // becomes the index in the submitted id list; ids not listed keep theirs.
  app.put(
    "/categories/reorder",
    {
      schema: {
        body: {
          type: "object",
          required: ["ids"],
          additionalProperties: false,
          properties: {
            ids: {
              type: "array",
              minItems: 1,
              maxItems: 200,
              items: { type: "integer", minimum: 1 },
            },
          },
        },
      },
    },
    async (request) => {
      const db = getDb();
      const { ids } = request.body as { ids: number[] };
      transaction(() => {
        const update = db.prepare(
          "UPDATE categories SET sort_order = ?, updated_at = datetime('now') WHERE id = ?"
        );
        ids.forEach((id, index) => update.run(index, id));
        bumpDataRevision();
      })();
      return listCategories();
    }
  );

  app.put("/categories/:id", { schema: { params: ID_PARAMS } }, async (request, reply) => {
    const db = getDb();
    const { id } = request.params as { id: number };
    const { name, icon, color } = cleanCategoryInput(request.body as CategoryInput);
    const info = db
      .prepare(
        "UPDATE categories SET name = ?, icon = ?, color = ?, updated_at = datetime('now') WHERE id = ?"
      )
      .run(name, icon, color, id);
    if (info.changes === 0) return reply.code(404).send({ error: "NOT_FOUND" });
    bumpDataRevision();
    return listCategories().find((c) => c.id === id);
  });

  app.delete("/categories/:id", { schema: { params: ID_PARAMS } }, async (request, reply) => {
    const db = getDb();
    const { id } = request.params as { id: number };
    const used = db.prepare("SELECT 1 FROM tastes WHERE category_id = ? LIMIT 1").get(id);
    if (used) return reply.code(409).send({ error: "CATEGORY_IN_USE" });
    const info = db.prepare("DELETE FROM categories WHERE id = ?").run(id);
    if (info.changes === 0) return reply.code(404).send({ error: "NOT_FOUND" });
    bumpDataRevision();
    return { ok: true };
  });

  app.put(
    "/categories/:id/statuses",
    {
      schema: {
        params: ID_PARAMS,
        body: {
          type: "object",
          required: ["statuses"],
          additionalProperties: false,
          properties: {
            statuses: {
              type: "array",
              maxItems: 30,
              items: {
                type: "object",
                required: ["name"],
                additionalProperties: false,
                properties: {
                  id: { type: "integer", minimum: 1 },
                  name: { type: "string", minLength: 1, maxLength: 100 },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const db = getDb();
      const { id } = request.params as { id: number };
      const category = db.prepare("SELECT id FROM categories WHERE id = ?").get(id);
      if (!category) return reply.code(404).send({ error: "NOT_FOUND" });
      const { statuses } = request.body as StatusesInput;

      try {
        transaction(() => {
          const keptIds = statuses.filter((s) => s.id).map((s) => s.id as number);
          // Deleting a status sets referencing tastes' status_id to NULL (FK).
          if (keptIds.length) {
            db.prepare(
              `DELETE FROM statuses WHERE category_id = ? AND id NOT IN (${keptIds.map(() => "?").join(",")})`
            ).run(id, ...keptIds);
          } else {
            db.prepare("DELETE FROM statuses WHERE category_id = ?").run(id);
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
            if (status.id) update.run(name, i, status.id, id);
            else insert.run(id, name, i);
          });
          bumpDataRevision();
        })();
      } catch (err) {
        if (isUniqueViolation(err)) return reply.code(409).send({ error: "STATUS_DUPLICATE" });
        throw err;
      }
      return listCategories().find((c) => c.id === id);
    }
  );
}
