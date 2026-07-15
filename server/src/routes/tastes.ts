// SPDX-License-Identifier: MIT
// Public read API: the full list of published taste summaries (client-side
// filtering; a personal catalog is hundreds of rows) and the taste detail.

import type { FastifyInstance } from "fastify";
import { getDataRevision } from "../db/index.js";
import { listPublicSummaries, getTasteDetail } from "../lib/tastes.js";
import { readSessionUser } from "../lib/auth.js";

const UUID_RE = "^[0-9a-fA-F-]{36}$";

export default async function tasteRoutes(app: FastifyInstance) {
  app.get("/tastes", async (request, reply) => {
    // The revision counter bumps on every content mutation, so an unchanged
    // catalog answers 304 without touching the content tables.
    const etag = `"rev-${getDataRevision()}"`;
    reply.header("etag", etag);
    if (request.headers["if-none-match"] === etag) {
      return reply.code(304).send();
    }
    return listPublicSummaries();
  });

  app.get(
    "/tastes/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", pattern: UUID_RE } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const detail = getTasteDetail(id);
      // Drafts are indistinguishable from missing tastes for the public.
      if (!detail || (!detail.published && !readSessionUser(request))) {
        return reply.code(404).send({ error: "NOT_FOUND" });
      }
      return detail;
    }
  );
}
