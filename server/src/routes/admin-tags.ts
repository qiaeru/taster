// SPDX-License-Identifier: MIT
// Admin tag management: list with usage counts, rename (which merges into an
// existing tag of the same name), delete. Tags are shared across tastes, so
// these act catalog-wide.

import type { FastifyInstance } from "fastify";
import { getDb, bumpDataRevision, transaction } from "../db/index.js";

const ID_PARAMS = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "integer", minimum: 1 } },
} as const;

export default async function adminTagRoutes(app: FastifyInstance) {
  // Unlike public /api/tags, drafts count too: the admin manages all of them.
  app.get("/tags", async () => {
    return getDb()
      .prepare(
        `SELECT tg.id, tg.name, COUNT(tt.taste_id) AS count
         FROM tags tg LEFT JOIN taste_tags tt ON tt.tag_id = tg.id
         GROUP BY tg.id ORDER BY tg.name COLLATE NOCASE`
      )
      .all();
  });

  // Rename. When another tag already carries the target name (case-insensitive)
  // the two merge: every taste of the renamed tag moves onto the existing one.
  // The client asks for confirmation first (merge=true), otherwise 409.
  app.put(
    "/tags/:id",
    {
      schema: {
        params: ID_PARAMS,
        body: {
          type: "object",
          required: ["name"],
          additionalProperties: false,
          properties: {
            name: { type: "string", minLength: 1, maxLength: 80 },
            merge: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      const db = getDb();
      const { id } = request.params as { id: number };
      const body = request.body as { name: string; merge?: boolean };
      const name = body.name.trim();
      // Same reservation as the taste form: commas separate tags in filter URLs.
      if (!name || name.includes(",")) return reply.code(400).send({ error: "INVALID_TAGS" });

      const tag = db.prepare("SELECT id, name FROM tags WHERE id = ?").get(id) as
        | { id: number; name: string }
        | undefined;
      if (!tag) return reply.code(404).send({ error: "NOT_FOUND" });

      const existing = db
        .prepare("SELECT id, name FROM tags WHERE name = ? COLLATE NOCASE AND id != ?")
        .get(name, id) as { id: number; name: string } | undefined;

      if (existing && !body.merge) {
        return reply.code(409).send({ error: "TAG_EXISTS", details: { name: existing.name } });
      }

      transaction(() => {
        if (existing) {
          // OR IGNORE: a taste carrying both tags would violate the PK.
          db.prepare(
            "INSERT OR IGNORE INTO taste_tags (taste_id, tag_id) SELECT taste_id, ? FROM taste_tags WHERE tag_id = ?"
          ).run(existing.id, id);
          db.prepare("DELETE FROM tags WHERE id = ?").run(id);
          // The surviving tag adopts the submitted spelling (case tweaks).
          db.prepare("UPDATE tags SET name = ? WHERE id = ?").run(name, existing.id);
        } else {
          db.prepare("UPDATE tags SET name = ? WHERE id = ?").run(name, id);
        }
        bumpDataRevision();
      })();
      return { ok: true, merged: Boolean(existing) };
    }
  );

  // Removes the tag from every taste (taste_tags rows cascade with the tag).
  app.delete("/tags/:id", { schema: { params: ID_PARAMS } }, async (request, reply) => {
    const { id } = request.params as { id: number };
    const info = getDb().prepare("DELETE FROM tags WHERE id = ?").run(id);
    if (info.changes === 0) return reply.code(404).send({ error: "NOT_FOUND" });
    bumpDataRevision();
    return { ok: true };
  });
}
