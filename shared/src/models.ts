// SPDX-License-Identifier: MIT
// Data models shared between the Taster client and server.
// These mirror the SQLite schema (server/migrations) and the API payloads.

/** Star rating: 1 poor, 2 bad, 3 average, 4 good, 5 excellent. */
export type Rating = 1 | 2 | 3 | 4 | 5;

/**
 * Reference date with flexible precision, encoded as a plain string:
 * "YYYY" (year), "YYYY-MM" (month) or "YYYY-MM-DD" (day).
 * Lexicographic order matches chronological order across precisions.
 */
export type PartialDate = string;

export interface Status {
  id: number;
  name: string;
  sortOrder: number;
}

export interface Category {
  id: number;
  /** Stable machine key used by JSON import/export (e.g. "video-games"). */
  slug: string;
  name: string;
  /** Heroicons icon name (e.g. "film", "tv", "puzzle-piece"). */
  icon: string;
  /** CSS color used as the category accent (e.g. "#7c6ff0"). */
  color: string;
  sortOrder: number;
  statuses: Status[];
}

export interface ReferenceLink {
  label: string;
  url: string;
}

export interface ReviewSection {
  /** Null for the single unnamed section of a simple review. */
  subtitle: string | null;
  rating: Rating | null;
  /** Markdown body. Supports the ||spoiler|| syntax. */
  text: string;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Focal point of the cover image, as fractions (0..1) of width and height. */
export interface ImageFocus {
  x: number;
  y: number;
}

/** Lightweight list payload returned by GET /api/tastes. */
export interface TasteSummary {
  id: string;
  title: string;
  categoryId: number;
  rating: Rating | null;
  statusId: number | null;
  tags: string[];
  /** Base filename under /uploads (display variant); thumb is derivable. */
  imageFile: string | null;
  /** Null = centered. Cards translate it to CSS object-position. */
  imageFocus: ImageFocus | null;
  /** Markdown synopsis (spoilers supported); also searched by the list. */
  description: string | null;
  refDate: PartialDate | null;
  favorite: boolean;
  createdAt: string;
}

/** Admin list payload also carries the draft flag. */
export interface AdminTasteSummary extends TasteSummary {
  published: boolean;
  updatedAt: string;
}

/** Full payload returned by GET /api/tastes/:id. */
export interface TasteDetail extends TasteSummary {
  /** Alt text / credits of the cover image; also the hover tooltip. */
  imageAlt: string | null;
  location: GeoPoint | null;
  externalReviewUrl: string | null;
  sections: ReviewSection[];
  links: ReferenceLink[];
  published: boolean;
  updatedAt: string;
}

/** Mutation payload accepted by POST/PUT /api/admin/tastes. */
export interface TasteInput {
  title: string;
  categoryId: number;
  rating?: Rating | null;
  statusId?: number | null;
  tags?: string[];
  description?: string | null;
  refDate?: PartialDate | null;
  location?: GeoPoint | null;
  imageFocus?: ImageFocus | null;
  imageAlt?: string | null;
  externalReviewUrl?: string | null;
  published?: boolean;
  favorite?: boolean;
  sections?: ReviewSection[];
  links?: ReferenceLink[];
}

export interface CategoryInput {
  name: string;
  slug?: string;
  icon?: string;
  color?: string;
}

export interface StatusesInput {
  statuses: { id?: number; name: string }[];
}

/** Instance-wide settings returned by GET /api/settings, editable by the admin. */
export interface AppSettings {
  /** Display name of the instance; "Taster" when the owner has not renamed it. */
  appName: string;
  /** Stylesheet name under DATA_DIR/themes, or "default" for the built-in theme. */
  theme: string;
  /** Locale served to first-time visitors; "auto" follows the browser language. */
  defaultLocale: "auto" | "fr" | "en";
}

export interface SessionInfo {
  authenticated: boolean;
  mustChangePassword: boolean;
}

/** Uniform error body: `code` is a stable machine key, translated client-side. */
export interface ApiError {
  statusCode: number;
  code: string;
  message?: string;
}
