// SPDX-License-Identifier: MIT
// Auth routes: csrf, login, logout, session, change-password.

import type { FastifyInstance } from "fastify";
import { getDb } from "../db/index.js";
import { hashPassword, verifyPassword, validatePassword, POLICY } from "../lib/password.js";
import { readSessionUser, writeSessionUser, clearSession, requireSession } from "../lib/auth.js";

// Failed logins are tracked per source IP, in memory: a per-account lock
// would let any visitor lock the admin out at will. An IP that keeps failing
// only blocks itself; the admin signs in normally from their own address.
// Entries expire LOCKOUT_MINUTES after the last failure, so the map stays
// tiny and a legitimate typo streak clears itself.
const LOCKOUT_THRESHOLD = 10;
const LOCKOUT_MINUTES = 15;
const failedLogins = new Map<string, { count: number; resetAt: number }>();

function recordFailedLogin(ip: string, now: number): void {
  const entry = failedLogins.get(ip);
  const count = entry && entry.resetAt > now ? entry.count + 1 : 1;
  failedLogins.set(ip, { count, resetAt: now + LOCKOUT_MINUTES * 60_000 });
}

// Verified when the username does not exist, so unknown and known usernames
// take the same time to answer 401 (Argon2 runs either way); an immediate
// return would let response latency reveal the admin's username.
const decoyHash = hashPassword("taster-timing-decoy");

function lockedUntil(ip: string, now: number): number | null {
  if (failedLogins.size > 1000) {
    for (const [key, entry] of failedLogins) if (entry.resetAt <= now) failedLogins.delete(key);
  }
  const entry = failedLogins.get(ip);
  if (!entry || entry.resetAt <= now) return null;
  return entry.count >= LOCKOUT_THRESHOLD ? entry.resetAt : null;
}

// Only bound the size here: the full policy (including minimum length) runs
// in validatePassword so a short password gets its specific PASSWORD_TOO_SHORT
// code, which the client translates, instead of an opaque schema failure.
const newPasswordSchema = { type: "string", minLength: 1, maxLength: 200 };
// Login and `currentPassword` accept any non-empty value: the strength policy
// only applies to new passwords, and the seeded "changeme" must authenticate.
const currentPasswordSchema = { type: "string", minLength: 1, maxLength: 200 };
const usernameSchema = { type: "string", minLength: 1, maxLength: 64 };

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  must_change_password: number;
  session_epoch: number;
}

export default async function authRoutes(app: FastifyInstance) {
  // Token used by the frontend for the x-csrf-token header on mutating requests.
  app.get("/auth/csrf", async (_request, reply) => {
    const token = await reply.generateCsrf();
    return { token };
  });

  app.get("/auth/password-policy", async () => POLICY);

  app.post(
    "/auth/login",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
      schema: {
        body: {
          type: "object",
          required: ["username", "password"],
          additionalProperties: false,
          properties: { username: usernameSchema, password: currentPasswordSchema },
        },
      },
    },
    async (request, reply) => {
      const db = getDb();
      const body = request.body as { username: string; password: string };
      const username = body.username.trim().toLowerCase();

      const now = Date.now();
      const blockedUntil = lockedUntil(request.ip, now);
      if (blockedUntil !== null) {
        return reply.code(423).send({
          error: "TOO_MANY_ATTEMPTS",
          details: { unlockAt: new Date(blockedUntil).toISOString() },
        });
      }

      const row = db
        .prepare(
          `SELECT id, username, password_hash, must_change_password, session_epoch
           FROM users WHERE username = ?`
        )
        .get(username) as UserRow | undefined;

      if (!row) {
        // Generic message, do not leak which side failed.
        await verifyPassword(await decoyHash, body.password);
        recordFailedLogin(request.ip, now);
        return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
      }

      const ok = await verifyPassword(row.password_hash, body.password);
      if (!ok) {
        recordFailedLogin(request.ip, now);
        return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
      }

      failedLogins.delete(request.ip);
      db.prepare(
        "UPDATE users SET last_login_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
      ).run(row.id);

      writeSessionUser(request, { id: row.id, sessionEpoch: row.session_epoch });
      return {
        authenticated: true,
        username: row.username,
        mustChangePassword: row.must_change_password === 1,
      };
    }
  );

  app.post("/auth/logout", async (request) => {
    clearSession(request);
    return { ok: true };
  });

  app.get("/auth/session", async (request) => {
    const user = readSessionUser(request);
    if (!user) return { authenticated: false, mustChangePassword: false };
    return { authenticated: true, mustChangePassword: user.mustChangePassword };
  });

  app.post(
    "/auth/change-password",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 hour" } },
      preHandler: requireSession,
      schema: {
        body: {
          type: "object",
          required: ["currentPassword", "newPassword"],
          additionalProperties: false,
          properties: {
            currentPassword: currentPasswordSchema,
            newPassword: newPasswordSchema,
          },
        },
      },
    },
    async (request, reply) => {
      const db = getDb();
      const { currentPassword, newPassword } = request.body as {
        currentPassword: string;
        newPassword: string;
      };
      const userId = request.currentUser!.id;

      const row = db
        .prepare("SELECT username, password_hash FROM users WHERE id = ?")
        .get(userId) as { username: string; password_hash: string } | undefined;
      if (!row) return reply.code(401).send({ error: "UNAUTHENTICATED" });

      const ok = await verifyPassword(row.password_hash, currentPassword);
      if (!ok) return reply.code(401).send({ error: "INVALID_CREDENTIALS" });

      const check = validatePassword(newPassword, { userInputs: [row.username, "taster"] });
      if (!check.ok) {
        return reply
          .code(400)
          .send({ error: check.code, details: { score: check.score, feedback: check.feedback } });
      }

      const hash = await hashPassword(newPassword);
      db.prepare(
        `UPDATE users SET password_hash = ?, must_change_password = 0,
           session_epoch = session_epoch + 1,
           updated_at = datetime('now')
         WHERE id = ?`
      ).run(hash, userId);

      const updated = db.prepare("SELECT session_epoch FROM users WHERE id = ?").get(userId) as {
        session_epoch: number;
      };
      writeSessionUser(request, { id: userId, sessionEpoch: updated.session_epoch });
      return { ok: true };
    }
  );
}
