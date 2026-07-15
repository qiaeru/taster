// SPDX-License-Identifier: MIT
// First-boot seed: default categories with their per-category statuses, and
// the admin account (taster/changeme, forced password change).

import { getDb, setSetting, transaction } from "./index.js";
import { hashPassword } from "../lib/password.js";
import { config } from "../config.js";

interface MinimalLogger {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
}

// Slugs are locale-neutral so JSON import files and the demo data work on any
// instance regardless of SEED_LOCALE; only display names are localized.
interface SeedCategory {
  slug: string;
  icon: string;
  color: string;
  name: Record<string, string>;
  statuses: Record<string, string[]>;
}

const SEED_CATEGORIES: SeedCategory[] = [
  {
    slug: "films",
    icon: "film",
    color: "#e35d6a",
    name: { fr: "Films", en: "Films" },
    statuses: {
      fr: ["Vu", "En cours", "À voir"],
      en: ["Watched", "Watching", "To watch"],
    },
  },
  {
    slug: "series",
    icon: "tv",
    color: "#8b5cf6",
    name: { fr: "Séries", en: "Series" },
    statuses: {
      fr: ["Vu", "En cours", "À voir"],
      en: ["Watched", "Watching", "To watch"],
    },
  },
  {
    slug: "video-games",
    icon: "puzzle-piece",
    color: "#3b82f6",
    name: { fr: "Jeux vidéo", en: "Video games" },
    statuses: {
      fr: ["Terminé", "En cours", "Abandonné", "À jouer"],
      en: ["Finished", "Playing", "Dropped", "To play"],
    },
  },
  {
    slug: "food",
    icon: "cake",
    color: "#f59e0b",
    name: { fr: "Cuisine", en: "Food" },
    statuses: {
      fr: ["Testé", "À tester"],
      en: ["Tested", "To test"],
    },
  },
  {
    slug: "books",
    icon: "book-open",
    color: "#10b981",
    name: { fr: "Livres", en: "Books" },
    statuses: {
      fr: ["Lu", "En cours", "À lire"],
      en: ["Read", "Reading", "To read"],
    },
  },
  {
    slug: "music",
    icon: "musical-note",
    color: "#ec4899",
    name: { fr: "Musique", en: "Music" },
    statuses: {
      fr: ["Écouté", "À écouter"],
      en: ["Listened", "To listen"],
    },
  },
];

// Statuses applied to categories the admin creates later.
export const GENERIC_STATUSES: Record<string, string[]> = {
  fr: ["Terminé", "En cours", "À faire"],
  en: ["Done", "In progress", "To do"],
};

export function seededLocale(): string {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'seed_locale'").get() as
    | { value: string }
    | undefined;
  return row?.value === "en" ? "en" : "fr";
}

const DEFAULT_ADMIN_USERNAME = "taster";
const DEFAULT_ADMIN_PASSWORD = "changeme";

export async function runSeed(logger?: MinimalLogger): Promise<void> {
  const db = getDb();
  const locale = config.seedLocale === "en" ? "en" : "fr";

  const hasCategories =
    (db.prepare("SELECT COUNT(*) AS n FROM categories").get() as { n: number }).n > 0;
  if (!hasCategories) {
    transaction(() => {
      setSetting("seed_locale", locale);
      setSetting("data_revision", "1");
      const insertCategory = db.prepare(
        "INSERT INTO categories (slug, name, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)"
      );
      const insertStatus = db.prepare(
        "INSERT INTO statuses (category_id, name, sort_order) VALUES (?, ?, ?)"
      );
      SEED_CATEGORIES.forEach((cat, i) => {
        const info = insertCategory.run(cat.slug, cat.name[locale], cat.icon, cat.color, i);
        (cat.statuses[locale] ?? []).forEach((status, j) => {
          insertStatus.run(info.lastInsertRowid, status, j);
        });
      });
    })();
    logger?.info({ locale, categories: SEED_CATEGORIES.length }, "seeded default categories");
  }

  const hasAdmin = (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n > 0;
  if (!hasAdmin) {
    const hash = await hashPassword(DEFAULT_ADMIN_PASSWORD);
    db.prepare(
      "INSERT INTO users (username, password_hash, must_change_password) VALUES (?, ?, 1)"
    ).run(DEFAULT_ADMIN_USERNAME, hash);
    logger?.warn(
      { username: DEFAULT_ADMIN_USERNAME },
      "seeded admin account with the default password; it must be changed at first login"
    );
  }
}

// ADMIN_RESET=1 restores taster/changeme (forced change) and invalidates every
// existing session via the epoch bump. The operator removes the flag afterward.
export async function maybeResetAdmin(logger?: MinimalLogger): Promise<void> {
  if (!config.adminReset) return;
  const db = getDb();
  const hash = await hashPassword(DEFAULT_ADMIN_PASSWORD);
  const admin = db.prepare("SELECT id FROM users ORDER BY id LIMIT 1").get() as
    | { id: number }
    | undefined;
  if (!admin) return;
  db.prepare(
    `UPDATE users SET username = ?, password_hash = ?, must_change_password = 1,
       session_epoch = session_epoch + 1, failed_attempts = 0, locked_until = NULL,
       updated_at = datetime('now')
     WHERE id = ?`
  ).run(DEFAULT_ADMIN_USERNAME, hash, admin.id);
  logger?.warn(
    { username: DEFAULT_ADMIN_USERNAME },
    "ADMIN_RESET=1: admin account reset to the default password; remove the flag now"
  );
}
