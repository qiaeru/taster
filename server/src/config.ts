// SPDX-License-Identifier: MIT
// Environment parsing and runtime configuration.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

function bool(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  return raw === "1" || raw.toLowerCase() === "true";
}

function int(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) throw new Error(`Environment variable ${name} must be an integer`);
  return n;
}

const NODE_ENV = process.env.NODE_ENV || "development";

// The throwaway key is public (it ships in the repo), so anyone could forge an
// admin cookie with it. Allow it only under `npm run dev` (npm exposes the
// running script name); `npm start` or a bare `node dist/index.js` without a
// real SESSION_SECRET must fail loudly instead of serving with the public key.
const isDevRun = process.env.npm_lifecycle_event === "dev";
const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim() !== ""
    ? process.env.SESSION_SECRET
    : isDevRun && NODE_ENV !== "production"
      ? "dev-secret-change-me-0123456789abcdef0123456789abcdef"
      : required("SESSION_SECRET");

// @fastify/secure-session requires an exactly 32-byte key. Truncate in bytes,
// not characters: a multi-byte (accented) character inside the first 32
// characters would otherwise yield an oversized buffer and crash the boot.
function sessionKey(secret: string): Buffer {
  if (secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return Buffer.from(secret, "utf8").subarray(0, 32);
}

const DATA_DIR = process.env.DATA_DIR || resolve(process.cwd(), "var");

// No trailing slash; empty string means "unset" (relative URLs where possible).
function publicUrl(): string {
  const raw = (process.env.PUBLIC_URL || "").trim();
  return raw.replace(/\/+$/, "");
}

function readPackageVersion(): string {
  try {
    const pkgPath = new URL("../package.json", import.meta.url);
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const here = dirname(fileURLToPath(import.meta.url));

export const config = {
  env: NODE_ENV,
  isProduction: NODE_ENV === "production",
  port: int("PORT", 3000),
  host: process.env.HOST || "0.0.0.0",
  dataDir: DATA_DIR,
  dbPath: process.env.DB_PATH || resolve(DATA_DIR, "taster.db"),
  uploadsDir: resolve(DATA_DIR, "uploads"),
  sessionSecret: SESSION_SECRET,
  sessionKey: sessionKey(SESSION_SECRET),
  cookieSecure: bool("COOKIE_SECURE", NODE_ENV === "production"),
  trustProxy: bool("TRUST_PROXY", false),
  seedLocale: (process.env.SEED_LOCALE || "").slice(0, 2).toLowerCase() || null,
  adminReset: bool("ADMIN_RESET", false),
  publicUrl: publicUrl(),
  logLevel: process.env.LOG_LEVEL || (NODE_ENV === "production" ? "info" : "debug"),
  version: readPackageVersion(),
  // Built client bundle; sits next to the compiled server (dist/public).
  publicDir: process.env.PUBLIC_DIR || resolve(here, "public"),
};
