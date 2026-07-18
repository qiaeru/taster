// SPDX-License-Identifier: MIT
// Read-side repository for tastes: list summaries and full details.

import type { AdminTasteSummary, TasteDetail, TasteSummary, Rating } from "@taster/shared";
import { getDb } from "../db/index.js";

// Tags are aggregated with the ASCII unit separator: validation rejects
// commas in new tags, but rows written before that rule could contain them
// and GROUP_CONCAT's default comma separator would corrupt those.
const SEP = String.fromCharCode(31);

interface SummaryRow {
  id: string;
  title: string;
  categoryId: number;
  rating: number | null;
  statusId: number | null;
  imageFile: string | null;
  description: string | null;
  refDate: string | null;
  favorite: number;
  published: number;
  createdAt: string;
  updatedAt: string;
  tags: string | null;
  focusX: number | null;
  focusY: number | null;
}

const SUMMARY_SELECT = `
  SELECT t.id, t.title, t.category_id AS categoryId, t.rating, t.status_id AS statusId,
         t.image_file AS imageFile, t.focus_x AS focusX, t.focus_y AS focusY,
         t.description, t.ref_date AS refDate, t.favorite, t.published,
         t.created_at AS createdAt, t.updated_at AS updatedAt,
         (SELECT GROUP_CONCAT(tg.name, char(31)) FROM taste_tags tt
            JOIN tags tg ON tg.id = tt.tag_id WHERE tt.taste_id = t.id) AS tags
  FROM tastes t
`;

function toSummary(row: SummaryRow): TasteSummary {
  return {
    id: row.id,
    title: row.title,
    categoryId: row.categoryId,
    rating: (row.rating as Rating) ?? null,
    statusId: row.statusId,
    // Alphabetical: taste_tags iterates in tag-creation order, which reads as
    // random on cards; a stable order also keeps the edit form predictable.
    tags: row.tags
      ? row.tags.split(SEP).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
      : [],
    imageFile: row.imageFile,
    imageFocus:
      row.focusX !== null && row.focusY !== null ? { x: row.focusX, y: row.focusY } : null,
    description: row.description,
    refDate: row.refDate,
    favorite: row.favorite === 1,
    createdAt: row.createdAt,
  };
}

export function listPublicSummaries(): TasteSummary[] {
  const rows = getDb()
    .prepare(`${SUMMARY_SELECT} WHERE t.published = 1 ORDER BY t.created_at DESC, t.id`)
    .all() as unknown as SummaryRow[];
  return rows.map(toSummary);
}

export function listAdminSummaries(): AdminTasteSummary[] {
  const rows = getDb()
    .prepare(`${SUMMARY_SELECT} ORDER BY t.created_at DESC, t.id`)
    .all() as unknown as SummaryRow[];
  return rows.map((row) => ({
    ...toSummary(row),
    published: row.published === 1,
    updatedAt: row.updatedAt,
  }));
}

const DETAIL_SELECT = SUMMARY_SELECT.replace(
  "FROM tastes t",
  ", t.image_alt AS imageAlt, t.lat, t.lng, t.external_review_url AS externalReviewUrl\n  FROM tastes t"
);

export function getTasteDetail(id: string): TasteDetail | null {
  const db = getDb();
  const row = db.prepare(`${DETAIL_SELECT} WHERE t.id = ?`).get(id) as unknown as
    | (SummaryRow & {
        imageAlt: string | null;
        lat: number | null;
        lng: number | null;
        externalReviewUrl: string | null;
      })
    | undefined;
  if (!row) return null;
  const sections = db
    .prepare(
      "SELECT subtitle, rating, body_md AS text FROM sections WHERE taste_id = ? ORDER BY sort_order"
    )
    .all(id) as unknown as { subtitle: string | null; rating: Rating | null; text: string }[];
  const links = db
    .prepare("SELECT label, url FROM links WHERE taste_id = ? ORDER BY sort_order")
    .all(id) as unknown as { label: string; url: string }[];
  return {
    ...toSummary(row),
    imageAlt: row.imageAlt,
    location: row.lat !== null && row.lng !== null ? { lat: row.lat, lng: row.lng } : null,
    externalReviewUrl: row.externalReviewUrl,
    sections,
    links,
    published: row.published === 1,
    updatedAt: row.updatedAt,
  };
}
