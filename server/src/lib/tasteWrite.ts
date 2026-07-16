// SPDX-License-Identifier: MIT
// Write-side logic for tastes: validation + transactional create/update/
// delete. Shared by the admin routes and the JSON import, so both enforce
// exactly the same rules.

import { randomUUID } from "node:crypto";
import type { TasteInput } from "@taster/shared";
import { getDb, bumpDataRevision, transaction } from "../db/index.js";
import { isValidPartialDate } from "./partialDate.js";
import { deleteImageFiles } from "./images.js";

export class TasteValidationError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

const MAX_TITLE = 300;
const MAX_TAG = 80;
const MAX_TAGS = 50;
const MAX_SECTIONS = 30;
const MAX_LINKS = 30;
const MAX_TEXT = 100_000;
const MAX_LABEL = 200;
const MAX_URL = 2000;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export interface CleanTaste {
  title: string;
  categoryId: number;
  rating: number | null;
  statusId: number | null;
  tags: string[];
  refDate: string | null;
  lat: number | null;
  lng: number | null;
  externalReviewUrl: string | null;
  published: boolean;
  favorite: boolean;
  sections: { subtitle: string | null; rating: number | null; text: string }[];
  links: { label: string; url: string }[];
}

/** Validates a TasteInput; throws TasteValidationError with a stable code. */
export function validateTasteInput(input: TasteInput): CleanTaste {
  const db = getDb();

  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title || title.length > MAX_TITLE) throw new TasteValidationError("TITLE_REQUIRED");

  const category = db
    .prepare("SELECT id FROM categories WHERE id = ?")
    .get(input.categoryId as number) as { id: number } | undefined;
  if (!category) throw new TasteValidationError("CATEGORY_UNKNOWN");

  let rating: number | null = null;
  if (input.rating !== undefined && input.rating !== null) {
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
      throw new TasteValidationError("INVALID_RATING");
    }
    rating = input.rating;
  }

  let statusId: number | null = null;
  if (input.statusId !== undefined && input.statusId !== null) {
    const status = db
      .prepare("SELECT id FROM statuses WHERE id = ? AND category_id = ?")
      .get(input.statusId, category.id) as { id: number } | undefined;
    if (!status) throw new TasteValidationError("STATUS_UNKNOWN");
    statusId = status.id;
  }

  const tags: string[] = [];
  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags) || input.tags.length > MAX_TAGS) {
      throw new TasteValidationError("INVALID_TAGS");
    }
    const seen = new Set<string>();
    for (const raw of input.tags) {
      if (typeof raw !== "string") throw new TasteValidationError("INVALID_TAGS");
      const tag = raw.trim();
      // Commas are reserved: the client's ?tags= filter is comma-separated,
      // and the tag input widget already refuses them.
      if (!tag || tag.length > MAX_TAG || tag.includes(",")) {
        throw new TasteValidationError("INVALID_TAGS");
      }
      const fold = tag.toLowerCase();
      if (!seen.has(fold)) {
        seen.add(fold);
        tags.push(tag);
      }
    }
  }

  let refDate: string | null = null;
  if (input.refDate !== undefined && input.refDate !== null && input.refDate !== "") {
    if (!isValidPartialDate(input.refDate)) throw new TasteValidationError("INVALID_DATE");
    refDate = input.refDate;
  }

  let lat: number | null = null;
  let lng: number | null = null;
  if (input.location !== undefined && input.location !== null) {
    const loc = input.location;
    if (
      typeof loc !== "object" ||
      typeof loc.lat !== "number" ||
      typeof loc.lng !== "number" ||
      !Number.isFinite(loc.lat) ||
      !Number.isFinite(loc.lng) ||
      loc.lat < -90 ||
      loc.lat > 90 ||
      loc.lng < -180 ||
      loc.lng > 180
    ) {
      throw new TasteValidationError("INVALID_LOCATION");
    }
    lat = loc.lat;
    lng = loc.lng;
  }

  let externalReviewUrl: string | null = null;
  if (
    input.externalReviewUrl !== undefined &&
    input.externalReviewUrl !== null &&
    input.externalReviewUrl !== ""
  ) {
    if (
      typeof input.externalReviewUrl !== "string" ||
      input.externalReviewUrl.length > MAX_URL ||
      !isHttpUrl(input.externalReviewUrl)
    ) {
      throw new TasteValidationError("INVALID_URL");
    }
    externalReviewUrl = input.externalReviewUrl;
  }

  const sections: CleanTaste["sections"] = [];
  if (input.sections !== undefined) {
    if (!Array.isArray(input.sections) || input.sections.length > MAX_SECTIONS) {
      throw new TasteValidationError("INVALID_SECTIONS");
    }
    for (const raw of input.sections) {
      if (typeof raw !== "object" || raw === null) throw new TasteValidationError("INVALID_SECTIONS");
      const subtitle =
        raw.subtitle === undefined || raw.subtitle === null || raw.subtitle === ""
          ? null
          : String(raw.subtitle).slice(0, MAX_LABEL);
      let sectionRating: number | null = null;
      if (raw.rating !== undefined && raw.rating !== null) {
        if (!Number.isInteger(raw.rating) || raw.rating < 1 || raw.rating > 5) {
          throw new TasteValidationError("INVALID_SECTIONS");
        }
        sectionRating = raw.rating;
      }
      const text = typeof raw.text === "string" ? raw.text : "";
      if (text.length > MAX_TEXT) throw new TasteValidationError("INVALID_SECTIONS");
      // Fully empty sections are dropped silently.
      if (subtitle === null && sectionRating === null && !text.trim()) continue;
      sections.push({ subtitle, rating: sectionRating, text });
    }
  }

  const links: CleanTaste["links"] = [];
  if (input.links !== undefined) {
    if (!Array.isArray(input.links) || input.links.length > MAX_LINKS) {
      throw new TasteValidationError("INVALID_LINKS");
    }
    for (const raw of input.links) {
      if (typeof raw !== "object" || raw === null) throw new TasteValidationError("INVALID_LINKS");
      const label = typeof raw.label === "string" ? raw.label.trim() : "";
      const url = typeof raw.url === "string" ? raw.url.trim() : "";
      if (!label && !url) continue;
      if (!label || label.length > MAX_LABEL) throw new TasteValidationError("INVALID_LINKS");
      if (!url || url.length > MAX_URL || !isHttpUrl(url)) {
        throw new TasteValidationError("INVALID_URL");
      }
      links.push({ label, url });
    }
  }

  return {
    title,
    categoryId: category.id,
    rating,
    statusId,
    tags,
    refDate,
    lat,
    lng,
    externalReviewUrl,
    published: input.published !== false,
    favorite: input.favorite === true,
    sections,
    links,
  };
}

function writeRelations(tasteId: string, clean: CleanTaste): void {
  const db = getDb();
  db.prepare("DELETE FROM sections WHERE taste_id = ?").run(tasteId);
  const insertSection = db.prepare(
    "INSERT INTO sections (taste_id, subtitle, rating, body_md, sort_order) VALUES (?, ?, ?, ?, ?)"
  );
  clean.sections.forEach((section, i) => {
    insertSection.run(tasteId, section.subtitle, section.rating, section.text, i);
  });

  db.prepare("DELETE FROM links WHERE taste_id = ?").run(tasteId);
  const insertLink = db.prepare(
    "INSERT INTO links (taste_id, label, url, sort_order) VALUES (?, ?, ?, ?)"
  );
  clean.links.forEach((link, i) => insertLink.run(tasteId, link.label, link.url, i));

  db.prepare("DELETE FROM taste_tags WHERE taste_id = ?").run(tasteId);
  const upsertTag = db.prepare(
    "INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO UPDATE SET name = name RETURNING id"
  );
  const linkTag = db.prepare("INSERT INTO taste_tags (taste_id, tag_id) VALUES (?, ?)");
  for (const tag of clean.tags) {
    const row = upsertTag.get(tag) as { id: number };
    linkTag.run(tasteId, row.id);
  }
}

// Autocomplete must never offer tags no taste uses anymore.
function gcOrphanTags(): void {
  getDb().exec("DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM taste_tags)");
}

// `createdAt` (SQLite UTC "YYYY-MM-DD HH:MM:SS") lets the JSON import restore
// a taste's original creation date, so a full export/import keeps the
// "recent" sort order and does not re-announce the catalog in the Atom feed.
export const createTaste = transaction(
  (clean: CleanTaste, id?: string, createdAt?: string): string => {
    const db = getDb();
    const tasteId = id ?? randomUUID();
    db.prepare(
      `INSERT INTO tastes (id, title, category_id, rating, status_id, ref_date, lat, lng,
                           external_review_url, published, favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`
    ).run(
      tasteId,
      clean.title,
      clean.categoryId,
      clean.rating,
      clean.statusId,
      clean.refDate,
      clean.lat,
      clean.lng,
      clean.externalReviewUrl,
      clean.published ? 1 : 0,
      clean.favorite ? 1 : 0,
      createdAt ?? null
    );
    writeRelations(tasteId, clean);
    gcOrphanTags();
    bumpDataRevision();
    return tasteId;
  }
);

export const updateTaste = transaction((tasteId: string, clean: CleanTaste): boolean => {
  const db = getDb();
  const info = db
    .prepare(
      `UPDATE tastes SET title = ?, category_id = ?, rating = ?, status_id = ?, ref_date = ?,
         lat = ?, lng = ?, external_review_url = ?, published = ?, favorite = ?,
         updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(
      clean.title,
      clean.categoryId,
      clean.rating,
      clean.statusId,
      clean.refDate,
      clean.lat,
      clean.lng,
      clean.externalReviewUrl,
      clean.published ? 1 : 0,
      clean.favorite ? 1 : 0,
      tasteId
    );
  if (info.changes === 0) return false;
  writeRelations(tasteId, clean);
  gcOrphanTags();
  bumpDataRevision();
  return true;
});

/** Deletes the taste and returns its image file (if any) for disk cleanup. */
export function deleteTaste(tasteId: string): boolean {
  const db = getDb();
  const row = db.prepare("SELECT image_file AS imageFile FROM tastes WHERE id = ?").get(tasteId) as
    | { imageFile: string | null }
    | undefined;
  if (!row) return false;
  transaction(() => {
    db.prepare("DELETE FROM tastes WHERE id = ?").run(tasteId);
    gcOrphanTags();
    bumpDataRevision();
  })();
  deleteImageFiles(row.imageFile);
  return true;
}

/** Swaps the stored image reference; deletes the previous files. */
export function setTasteImage(tasteId: string, imageFile: string | null): boolean {
  const db = getDb();
  const row = db.prepare("SELECT image_file AS imageFile FROM tastes WHERE id = ?").get(tasteId) as
    | { imageFile: string | null }
    | undefined;
  if (!row) return false;
  db.prepare("UPDATE tastes SET image_file = ?, updated_at = datetime('now') WHERE id = ?").run(
    imageFile,
    tasteId
  );
  bumpDataRevision();
  if (row.imageFile && row.imageFile !== imageFile) deleteImageFiles(row.imageFile);
  return true;
}
