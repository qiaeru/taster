// SPDX-License-Identifier: MIT
// JSON import/export endpoints (admin scope).

import type { FastifyInstance } from "fastify";
import {
  exportCategories,
  exportTastes,
  importCategories,
  importTastes,
  ImportFormatError,
} from "../lib/importExport.js";

// Base64 images inflate the payload well beyond the default 512 KB.
const IMPORT_BODY_LIMIT = 16 * 1024 * 1024;

export default async function adminImportRoutes(app: FastifyInstance) {
  // `?dry=1` runs the same validation without writing anything, so the client
  // can show a preview of what the import would do before committing.
  app.post("/import", { bodyLimit: IMPORT_BODY_LIMIT }, async (request, reply) => {
    try {
      return await importTastes(request.body, (request.query as { dry?: string }).dry === "1");
    } catch (err) {
      if (err instanceof ImportFormatError) {
        return reply.code(400).send({ error: "INVALID_FILE" });
      }
      throw err;
    }
  });

  // Categories travel in their own file: they are structure, not content, and
  // importing them first lets a tastes file resolve every category by slug.
  app.post("/import/categories", async (request, reply) => {
    try {
      return importCategories(request.body, (request.query as { dry?: string }).dry === "1");
    } catch (err) {
      if (err instanceof ImportFormatError) {
        return reply.code(400).send({ error: "INVALID_FILE" });
      }
      throw err;
    }
  });

  app.get("/export/categories", async (_request, reply) => {
    return reply
      .type("application/json; charset=utf-8")
      .header("Content-Disposition", 'attachment; filename="taster-categories.json"')
      .send(exportCategories());
  });

  app.get("/export", async (request, reply) => {
    const withImages = (request.query as { images?: string }).images === "1";
    const json = exportTastes(null, withImages);
    return reply
      .type("application/json; charset=utf-8")
      .header("Content-Disposition", 'attachment; filename="taster-tastes.json"')
      .send(json);
  });

  app.get(
    "/tastes/:id/export",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", pattern: "^[0-9a-fA-F-]{36}$" } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const withImages = (request.query as { images?: string }).images === "1";
      const json = exportTastes([id], withImages);
      return reply
        .type("application/json; charset=utf-8")
        .header("Content-Disposition", `attachment; filename="taster-${id.slice(0, 8)}.json"`)
        .send(json);
    }
  );
}
