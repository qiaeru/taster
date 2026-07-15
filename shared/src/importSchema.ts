// SPDX-License-Identifier: MIT
// JSON import/export file format. Documented for humans (and AI generators)
// in docs/json-import.md; keep both in sync.

import type { GeoPoint, PartialDate, Rating } from "./models.js";

export const IMPORT_APP = "taster";
export const IMPORT_VERSION = 1;

export interface ImportSection {
  subtitle?: string | null;
  rating?: Rating | null;
  text: string;
}

export interface ImportLink {
  label: string;
  url: string;
}

export interface ImportImage {
  /** image/jpeg, image/png or image/webp. */
  mime: string;
  /** Base64-encoded image data, max 5 MB decoded. Normalized server-side. */
  base64: string;
}

export interface ImportTaste {
  /** Present on exports; a known id updates the existing taste (upsert). */
  id?: string;
  title: string;
  /** Category slug, or its display name (case-insensitive). Never auto-created. */
  category: string;
  rating?: Rating | null;
  /** Status name within the category (case-insensitive). */
  status?: string | null;
  favorite?: boolean;
  published?: boolean;
  tags?: string[];
  date?: PartialDate | null;
  location?: GeoPoint | null;
  externalReviewUrl?: string | null;
  sections?: ImportSection[];
  links?: ImportLink[];
  image?: ImportImage | null;
  /** Export metadata; ignored on import. */
  createdAt?: string;
  updatedAt?: string;
}

export interface ImportFile {
  app: typeof IMPORT_APP;
  version: number;
  tastes: ImportTaste[];
}

/** Stable per-item error codes reported by POST /api/admin/import. */
export type ImportErrorCode =
  | "TITLE_REQUIRED"
  | "CATEGORY_REQUIRED"
  | "CATEGORY_UNKNOWN"
  | "STATUS_UNKNOWN"
  | "INVALID_RATING"
  | "INVALID_DATE"
  | "INVALID_LOCATION"
  | "INVALID_URL"
  | "INVALID_IMAGE"
  | "IMAGE_TOO_LARGE"
  | "INVALID_SECTIONS"
  | "INVALID_LINKS"
  | "INVALID_TAGS";

export interface ImportItemError {
  /** Index of the failing taste in the `tastes` array. */
  index: number;
  code: ImportErrorCode;
}

export interface ImportResult {
  imported: number;
  updated: number;
  errors: ImportItemError[];
}
