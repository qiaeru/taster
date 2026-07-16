// SPDX-License-Identifier: MIT
// SQLite connection built on Node's built-in `node:sqlite` module (stable
// since Node 24). Zero native compilation.

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "../config.js";

let instance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (instance) return instance;
  mkdirSync(dirname(config.dbPath), { recursive: true });
  const db = new DatabaseSync(config.dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA synchronous = NORMAL");
  instance = db;
  return db;
}

export function closeDb(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}

// Reads a value from the generic `settings` key/value table. Returns null when
// the key is absent.
function getSetting(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string | null }
    | undefined;
  return row ? row.value : null;
}

export function setSetting(key: string, value: string): void {
  getDb().prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
}

// Monotonic counter bumped by every content mutation; feeds the public list
// ETag so unchanged catalogs answer 304 without touching the tables.
export function getDataRevision(): number {
  return Number.parseInt(getSetting("data_revision") || "0", 10) || 0;
}

export function bumpDataRevision(): void {
  setSetting("data_revision", String(getDataRevision() + 1));
}

// node:sqlite surfaces a UNIQUE violation as an Error with code
// 'ERR_SQLITE_ERROR' and the extended result code 2067 (errcode), not the
// 'SQLITE_CONSTRAINT_UNIQUE' string some drivers use. Match either; never
// the message text, which varies across SQLite builds and locales.
export function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; errcode?: number };
  return e.code === "SQLITE_CONSTRAINT_UNIQUE" || e.errcode === 2067;
}

// Wraps `fn` inside an explicit BEGIN/COMMIT transaction. Mirrors the
// ergonomics of better-sqlite3's `db.transaction(fn)` helper.
export function transaction<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  return (...args: A): R => {
    const db = getDb();
    db.exec("BEGIN");
    try {
      const result = fn(...args);
      db.exec("COMMIT");
      return result;
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  };
}
