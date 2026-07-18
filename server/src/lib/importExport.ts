// SPDX-License-Identifier: MIT
// JSON import/export. Export emits a human-editable file: pretty-printed,
// stable and logical key order, optional fields omitted rather than null.
// Import upserts by id, matches categories by slug then name and statuses by
// name within the category, and reports per-item errors without aborting the
// valid entries. Format documented in docs/json-import.md.

import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import type {
  CategoriesFile,
  CategoriesImportItemError,
  CategoriesImportResult,
  ImportCategory,
  ImportFile,
  ImportItemError,
  ImportResult,
  ImportTaste,
  TasteInput,
} from "@taster/shared";
import { getDb, bumpDataRevision, transaction } from "../db/index.js";
import {
  cleanCategoryFields,
  replaceStatuses,
  uniqueSlug,
  withExistingStatusIds,
} from "./categories.js";
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

// UTF-8 BOM: harmless for UTF-8-aware tools, but without it several Windows
// programs (legacy Notepad, Excel) decode the file as ANSI and mangle accents.
const BOM = "\uFEFF";

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
  if (detail.description) out.description = detail.description;
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
  if (detail.imageFocus) out.imageFocus = detail.imageFocus;
  if (detail.imageAlt) out.imageAlt = detail.imageAlt;
  if (withImage && detail.imageFile) {
    try {
      // basename() mirrors deleteImageFiles: the column only ever holds
      // server-minted names, but keep the invariant local.
      const buf = readFileSync(resolve(config.uploadsDir, basename(detail.imageFile)));
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
  return BOM + JSON.stringify(file, null, 2) + "\n";
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

async function decodeImportImage(
  image: ImportTaste["image"],
  dryRun: boolean
): Promise<string | null> {
  if (image === undefined || image === null) return null;
  if (
    typeof image !== "object" ||
    typeof image.base64 !== "string" ||
    typeof image.mime !== "string" ||
    !["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"].includes(image.mime)
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
  // Dry run: shape and size were checked, but nothing touches the disk.
  if (dryRun) return null;
  return storeImage(buf);
}

// Exports carry createdAt; honoring it on create makes a full export/import
// restore lossless (stable "recent" sort, no feed re-announcement). Lenient:
// a missing or unparseable value falls back to "now", never an error.
function normalizeCreatedAt(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  // Export format is SQLite UTC "YYYY-MM-DD HH:MM:SS"; also accept ISO 8601.
  const iso = raw.includes("T") ? raw : raw.trim().replace(" ", "T") + "Z";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return undefined;
  return new Date(ms).toISOString().slice(0, 19).replace("T", " ");
}

// With dryRun, the same validation and category/status resolution run but
// nothing is written: the result predicts what a real import would do.
export async function importTastes(payload: unknown, dryRun = false): Promise<ImportResult> {
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
        description: item.description ?? null,
        refDate: item.date ?? null,
        location: item.location ?? null,
        imageFocus: item.imageFocus ?? null,
        imageAlt: item.imageAlt ?? null,
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
      const imageFile = await decodeImportImage(item.image, dryRun);

      const existing =
        typeof item.id === "string"
          ? (db.prepare("SELECT id FROM tastes WHERE id = ?").get(item.id) as
              | { id: string }
              | undefined)
          : undefined;

      if (existing) {
        if (!dryRun) {
          updateTaste(existing.id, clean);
          if (imageFile) setTasteImage(existing.id, imageFile);
        }
        updated++;
      } else {
        if (!dryRun) {
          // A syntactically valid unknown id is preserved so re-imports of
          // the same file stay idempotent.
          const id = createTaste(
            clean,
            typeof item.id === "string" && /^[0-9a-fA-F-]{36}$/.test(item.id)
              ? item.id
              : undefined,
            normalizeCreatedAt(item.createdAt)
          );
          if (imageFile) setTasteImage(id, imageFile);
        }
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

// ---- categories file ----

export function exportCategories(): string {
  const db = getDb();
  const categories = db
    .prepare("SELECT id, slug, name, icon, color FROM categories ORDER BY sort_order, id")
    .all() as { id: number; slug: string; name: string; icon: string; color: string }[];
  const statusStmt = db.prepare(
    "SELECT name FROM statuses WHERE category_id = ? ORDER BY sort_order, id"
  );
  const file: CategoriesFile = {
    app: "taster",
    version: 1,
    categories: categories.map((c) => ({
      slug: c.slug,
      name: c.name,
      icon: c.icon,
      color: c.color,
      statuses: (statusStmt.all(c.id) as { name: string }[]).map((s) => s.name),
    })),
  };
  return BOM + JSON.stringify(file, null, 2) + "\n";
}

export function importCategories(payload: unknown, dryRun = false): CategoriesImportResult {
  if (
    typeof payload !== "object" ||
    payload === null ||
    (payload as CategoriesFile).app !== "taster" ||
    (payload as CategoriesFile).version !== 1 ||
    !Array.isArray((payload as CategoriesFile).categories)
  ) {
    throw new ImportFormatError("INVALID_FILE");
  }
  const file = payload as CategoriesFile;
  const db = getDb();

  let imported = 0;
  let updated = 0;
  const errors: CategoriesImportItemError[] = [];

  transaction(() => {
    file.categories.forEach((item: ImportCategory, index: number) => {
      const clean = item ? cleanCategoryFields(item) : null;
      if (!clean) {
        errors.push({ index, code: "NAME_REQUIRED" });
        return;
      }
      const { name, icon, color } = clean;
      let statuses: string[] | null = null;
      if (item.statuses !== undefined) {
        if (
          !Array.isArray(item.statuses) ||
          item.statuses.length > 30 ||
          item.statuses.some(
            (s) => typeof s !== "string" || !s.trim() || s.length > 100
          )
        ) {
          errors.push({ index, code: "INVALID_STATUSES" });
          return;
        }
        statuses = item.statuses.map((s) => s.trim());
        // Duplicate names (statuses are unique per category, case-insensitive)
        // would hit the UNIQUE constraint and abort the whole import with a
        // 500; degrade to a per-item error instead.
        if (new Set(statuses.map((s) => s.toLowerCase())).size !== statuses.length) {
          errors.push({ index, code: "INVALID_STATUSES" });
          return;
        }
      }

      const slug = typeof item.slug === "string" ? item.slug.trim() : "";
      const existing = (
        slug
          ? db.prepare("SELECT id FROM categories WHERE slug = ?").get(slug)
          : db.prepare("SELECT id FROM categories WHERE name = ? COLLATE NOCASE").get(name)
      ) as { id: number } | undefined;

      if (existing) {
        if (!dryRun) {
          db.prepare(
            "UPDATE categories SET name = ?, icon = ?, color = ?, updated_at = datetime('now') WHERE id = ?"
          ).run(name, icon, color, existing.id);
          if (statuses) replaceStatuses(existing.id, withExistingStatusIds(existing.id, statuses));
        }
        updated++;
      } else {
        if (!dryRun) {
          const maxOrder = (
            db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM categories").get() as {
              m: number;
            }
          ).m;
          // A provided slug is honored when well-formed and free; anything else
          // falls back to a slug derived from the name.
          const finalSlug =
            slug && /^[a-z0-9-]{1,100}$/.test(slug) &&
            !db.prepare("SELECT 1 FROM categories WHERE slug = ?").get(slug)
              ? slug
              : uniqueSlug(name);
          const info = db
            .prepare(
              "INSERT INTO categories (slug, name, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)"
            )
            .run(finalSlug, name, icon, color, maxOrder + 1);
          if (statuses)
            replaceStatuses(
              Number(info.lastInsertRowid),
              statuses.map((name) => ({ name }))
            );
        }
        imported++;
      }
    });
    if (!dryRun) bumpDataRevision();
  })();

  return { imported, updated, errors };
}
