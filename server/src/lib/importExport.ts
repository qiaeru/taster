// SPDX-License-Identifier: MIT
// JSON import/export. Export emits a human-editable file: pretty-printed,
// stable and logical key order, optional fields omitted rather than null.
// Import upserts by id, matches categories by slug then name and statuses by
// name within the category, and reports per-item errors without aborting the
// valid entries. Format documented in docs/json-import.md.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  ImportFile,
  ImportItemError,
  ImportResult,
  ImportTaste,
  TasteInput,
} from "@taster/shared";
import { getDb } from "../db/index.js";
import { getTasteDetail } from "./tastes.js";
import {
  validateTasteInput,
  createTaste,
  updateTaste,
  setTasteImage,
  TasteValidationError,
} from "./tasteWrite.js";
import { storeImage, ImageValidationError, MAX_IMAGE_BYTES } from "./images.js";
import { config } from "../config.js";

// ---- export ----

function orderedTaste(id: string, withImage: boolean): ImportTaste | null {
  const detail = getTasteDetail(id);
  if (!detail) return null;
  const db = getDb();
  const category = db
    .prepare("SELECT slug FROM categories WHERE id = ?")
    .get(detail.categoryId) as { slug: string };
  const status =
    detail.statusId !== null
      ? (db.prepare("SELECT name FROM statuses WHERE id = ?").get(detail.statusId) as {
          name: string;
        })
      : null;

  // Key order is part of the contract: title first, metadata, then content.
  const out: ImportTaste = { id: detail.id, title: detail.title, category: category.slug };
  if (detail.rating !== null) out.rating = detail.rating;
  if (status) out.status = status.name;
  if (detail.favorite) out.favorite = true;
  if (!detail.published) out.published = false;
  if (detail.tags.length) out.tags = detail.tags;
  if (detail.refDate) out.date = detail.refDate;
  if (detail.location) out.location = detail.location;
  if (detail.externalReviewUrl) out.externalReviewUrl = detail.externalReviewUrl;
  if (detail.sections.length) {
    out.sections = detail.sections.map((section) => {
      const s: NonNullable<ImportTaste["sections"]>[number] = { text: section.text };
      if (section.subtitle) s.subtitle = section.subtitle;
      if (section.rating !== null) s.rating = section.rating;
      // Key order: subtitle, rating, text.
      return { ...(s.subtitle ? { subtitle: s.subtitle } : {}), ...(s.rating ? { rating: s.rating } : {}), text: s.text };
    });
  }
  if (detail.links.length) out.links = detail.links;
  if (withImage && detail.imageFile) {
    try {
      const buf = readFileSync(resolve(config.uploadsDir, detail.imageFile));
      out.image = { mime: "image/webp", base64: buf.toString("base64") };
    } catch {
      /* image missing on disk: omit */
    }
  }
  out.createdAt = detail.createdAt;
  out.updatedAt = detail.updatedAt;
  return out;
}

export function exportTastes(ids: string[] | null, withImages: boolean): string {
  const db = getDb();
  const list =
    ids ??
    (
      db.prepare("SELECT id FROM tastes ORDER BY created_at, id").all() as { id: string }[]
    ).map((r) => r.id);
  const file: ImportFile = {
    app: "taster",
    version: 1,
    tastes: list
      .map((id) => orderedTaste(id, withImages))
      .filter((x): x is ImportTaste => x !== null),
  };
  return JSON.stringify(file, null, 2) + "\n";
}

// ---- import ----

export class ImportFormatError extends Error {}

function resolveCategory(ref: unknown): number | null {
  if (typeof ref !== "string" || !ref.trim()) return null;
  const db = getDb();
  const bySlug = db.prepare("SELECT id FROM categories WHERE slug = ?").get(ref.trim()) as
    | { id: number }
    | undefined;
  if (bySlug) return bySlug.id;
  const byName = db
    .prepare("SELECT id FROM categories WHERE name = ? COLLATE NOCASE")
    .get(ref.trim()) as { id: number } | undefined;
  return byName ? byName.id : null;
}

function resolveStatus(categoryId: number, ref: string): number | null {
  const row = getDb()
    .prepare("SELECT id FROM statuses WHERE category_id = ? AND name = ? COLLATE NOCASE")
    .get(categoryId, ref.trim()) as { id: number } | undefined;
  return row ? row.id : null;
}

async function decodeImportImage(image: ImportTaste["image"]): Promise<string | null> {
  if (image === undefined || image === null) return null;
  if (
    typeof image !== "object" ||
    typeof image.base64 !== "string" ||
    typeof image.mime !== "string" ||
    !["image/jpeg", "image/png", "image/webp"].includes(image.mime)
  ) {
    throw new ImageValidationError("INVALID_IMAGE");
  }
  // Quick size gate before decoding: base64 inflates by ~4/3.
  if (image.base64.length > (MAX_IMAGE_BYTES * 4) / 3 + 1024) {
    throw new ImageValidationError("IMAGE_TOO_LARGE");
  }
  let buf: Buffer;
  try {
    buf = Buffer.from(image.base64, "base64");
  } catch {
    throw new ImageValidationError("INVALID_IMAGE");
  }
  return storeImage(buf);
}

export async function importTastes(payload: unknown): Promise<ImportResult> {
  if (
    typeof payload !== "object" ||
    payload === null ||
    (payload as ImportFile).app !== "taster" ||
    (payload as ImportFile).version !== 1 ||
    !Array.isArray((payload as ImportFile).tastes)
  ) {
    throw new ImportFormatError("INVALID_FILE");
  }
  const file = payload as ImportFile;
  const db = getDb();

  let imported = 0;
  let updated = 0;
  const errors: ImportItemError[] = [];

  for (let index = 0; index < file.tastes.length; index++) {
    const item = file.tastes[index];
    try {
      if (typeof item !== "object" || item === null || typeof item.title !== "string") {
        errors.push({ index, code: "TITLE_REQUIRED" });
        continue;
      }
      if (item.category === undefined) {
        errors.push({ index, code: "CATEGORY_REQUIRED" });
        continue;
      }
      const categoryId = resolveCategory(item.category);
      if (categoryId === null) {
        errors.push({ index, code: "CATEGORY_UNKNOWN" });
        continue;
      }
      let statusId: number | null = null;
      if (item.status !== undefined && item.status !== null && String(item.status).trim() !== "") {
        statusId = resolveStatus(categoryId, String(item.status));
        if (statusId === null) {
          errors.push({ index, code: "STATUS_UNKNOWN" });
          continue;
        }
      }

      const input: TasteInput = {
        title: item.title,
        categoryId,
        rating: item.rating ?? null,
        statusId,
        tags: item.tags,
        refDate: item.date ?? null,
        location: item.location ?? null,
        externalReviewUrl: item.externalReviewUrl ?? null,
        published: item.published,
        favorite: item.favorite,
        sections: item.sections?.map((s) => ({
          subtitle: s.subtitle ?? null,
          rating: s.rating ?? null,
          text: s.text ?? "",
        })),
        links: item.links,
      };
      const clean = validateTasteInput(input);

      // Image first: a broken image must fail the item before any write.
      const imageFile = await decodeImportImage(item.image);

      const existing =
        typeof item.id === "string"
          ? (db.prepare("SELECT id FROM tastes WHERE id = ?").get(item.id) as
              | { id: string }
              | undefined)
          : undefined;

      if (existing) {
        updateTaste(existing.id, clean);
        if (imageFile) setTasteImage(existing.id, imageFile);
        updated++;
      } else {
        // A syntactically valid unknown id is preserved so re-imports of the
        // same file stay idempotent.
        const id = createTaste(
          clean,
          typeof item.id === "string" && /^[0-9a-fA-F-]{36}$/.test(item.id) ? item.id : undefined
        );
        if (imageFile) setTasteImage(id, imageFile);
        imported++;
      }
    } catch (err) {
      if (err instanceof TasteValidationError) {
        errors.push({ index, code: err.code as ImportItemError["code"] });
      } else if (err instanceof ImageValidationError) {
        errors.push({ index, code: err.code });
      } else {
        throw err;
      }
    }
  }
  return { imported, updated, errors };
}
