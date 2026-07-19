// SPDX-License-Identifier: MIT
// Admin category management: create/update/delete categories and the ordered
// replacement of a category's status list (existing ids preserved so tastes
// keep their status).

import type { FastifyInstance } from "fastify";
import type { CategoryInput, StatusesInput } from "@taster/shared";
import { getDb, bumpDataRevision, isUniqueViolation, transaction } from "../db/index.js";
import { GENERIC_STATUSES, seededLocale } from "../db/seed.js";
import { cleanCategoryFields, replaceStatuses, uniqueSlug } from "../lib/categories.js";
import { listCategories } from "./categories.js";

const ID_PARAMS = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "integer", minimum: 1 } },
} as const;

function cleanCategoryInput(input: CategoryInput): { name: string; icon: string; color: string } {
  const clean = cleanCategoryFields(input);
  if (!clean) throw Object.assign(new Error("VALIDATION"), { statusCode: 400 });
  return clean;
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

  // Full wipe from the Application tab. Same guard as the single delete:
  // tastes reference categories (ON DELETE RESTRICT), so the tastes must go
  // first; statuses cascade with their category.
  app.delete("/categories", async (_request, reply) => {
    const db = getDb();
    const used = db.prepare("SELECT 1 FROM tastes LIMIT 1").get();
    if (used) return reply.code(409).send({ error: "CATEGORY_IN_USE" });
    const info = db.prepare("DELETE FROM categories").run();
    bumpDataRevision();
    return { affected: info.changes };
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
          replaceStatuses(id, statuses);
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
