// SPDX-License-Identifier: MIT
// JSON import/export endpoints (admin scope).

import type { FastifyInstance } from "fastify";
import { exportTastes, importTastes, ImportFormatError } from "../lib/importExport.js";

// Base64 images inflate the payload well beyond the default 512 KB.
const IMPORT_BODY_LIMIT = 16 * 1024 * 1024;

export default async function adminImportRoutes(app: FastifyInstance) {
  app.post("/import", { bodyLimit: IMPORT_BODY_LIMIT }, async (request, reply) => {
    try {
      return await importTastes(request.body);
    } catch (err) {
      if (err instanceof ImportFormatError) {
        return reply.code(400).send({ error: "INVALID_FILE" });
      }
      throw err;
    }
  });

  app.get("/export", async (request, reply) => {
    const withImages = (request.query as { images?: string }).images === "1";
    const json = exportTastes(null, withImages);
    return reply
      .type("application/json; charset=utf-8")
      .header("Content-Disposition", 'attachment; filename="taster-export.json"')
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
