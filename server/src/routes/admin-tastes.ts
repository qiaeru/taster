// SPDX-License-Identifier: MIT
// Admin taste CRUD + image upload. All routes sit behind requireAdmin (wired
// by the /api/admin scope in index.ts).

import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import type { TasteInput } from "@taster/shared";
import { listAdminSummaries, getTasteDetail } from "../lib/tastes.js";
import {
  validateTasteInput,
  createTaste,
  updateTaste,
  deleteTaste,
  setTasteImage,
  TasteValidationError,
} from "../lib/tasteWrite.js";
import { storeImage, deleteImageFiles, ImageValidationError, MAX_IMAGE_BYTES } from "../lib/images.js";
import { getDb } from "../db/index.js";

const UUID_PARAMS = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "string", pattern: "^[0-9a-fA-F-]{36}$" } },
} as const;

// A fully valid taste can exceed the 512 KB global bodyLimit (30 sections of
// 100k characters); align with the import limit so anything the import
// accepts stays editable afterward.
const TASTE_BODY_LIMIT = 16 * 1024 * 1024;

export default async function adminTasteRoutes(app: FastifyInstance) {
  await app.register(multipart, {
    limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0 },
  });

  app.get("/tastes", async () => listAdminSummaries());

  app.post("/tastes", { bodyLimit: TASTE_BODY_LIMIT }, async (request, reply) => {
    try {
      const clean = validateTasteInput(request.body as TasteInput);
      const id = createTaste(clean);
      return reply.code(201).send(getTasteDetail(id));
    } catch (err) {
      if (err instanceof TasteValidationError) {
        return reply.code(400).send({ error: err.code });
      }
      throw err;
    }
  });

  app.put(
    "/tastes/:id",
    { bodyLimit: TASTE_BODY_LIMIT, schema: { params: UUID_PARAMS } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const clean = validateTasteInput(request.body as TasteInput);
        if (!updateTaste(id, clean)) return reply.code(404).send({ error: "NOT_FOUND" });
        return getTasteDetail(id);
      } catch (err) {
        if (err instanceof TasteValidationError) {
          return reply.code(400).send({ error: err.code });
        }
        throw err;
      }
    }
  );

  app.delete("/tastes/:id", { schema: { params: UUID_PARAMS } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!deleteTaste(id)) return reply.code(404).send({ error: "NOT_FOUND" });
    return { ok: true };
  });

  app.put("/tastes/:id/image", { schema: { params: UUID_PARAMS } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const exists = getDb().prepare("SELECT 1 FROM tastes WHERE id = ?").get(id);
    if (!exists) return reply.code(404).send({ error: "NOT_FOUND" });

    const file = await request.file();
    if (!file) return reply.code(400).send({ error: "INVALID_IMAGE" });
    let buf: Buffer;
    try {
      buf = await file.toBuffer();
    } catch {
      // Multipart aborts with its own error once the size limit is hit.
      return reply.code(413).send({ error: "IMAGE_TOO_LARGE" });
    }
    try {
      const imageFile = await storeImage(buf);
      if (!setTasteImage(id, imageFile)) {
        // Taste deleted while the upload was in flight (second tab): drop the
        // freshly written variants instead of leaving them orphaned.
        deleteImageFiles(imageFile);
        return reply.code(404).send({ error: "NOT_FOUND" });
      }
      return { imageFile };
    } catch (err) {
      if (err instanceof ImageValidationError) {
        return reply.code(err.code === "IMAGE_TOO_LARGE" ? 413 : 400).send({ error: err.code });
      }
      throw err;
    }
  });

  app.delete("/tastes/:id/image", { schema: { params: UUID_PARAMS } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = getDb()
      .prepare("SELECT image_file AS imageFile FROM tastes WHERE id = ?")
      .get(id) as { imageFile: string | null } | undefined;
    if (!row) return reply.code(404).send({ error: "NOT_FOUND" });
    setTasteImage(id, null);
    deleteImageFiles(row.imageFile);
    return { ok: true };
  });
}
