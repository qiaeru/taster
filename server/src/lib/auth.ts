// SPDX-License-Identifier: MIT
// Session lookup + route guards. Taster has a single admin account: any
// authenticated session is the admin.

import type { FastifyReply, FastifyRequest } from "fastify";
import { getDb } from "../db/index.js";

export interface CurrentUser {
  id: number;
  username: string;
  mustChangePassword: boolean;
  sessionEpoch: number;
}

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: CurrentUser;
  }
}

declare module "@fastify/secure-session" {
  interface SessionData {
    user: { id: number; epoch: number };
  }
}

export function readSessionUser(request: FastifyRequest): CurrentUser | null {
  const session = request.session;
  if (!session) return null;
  const payload = session.get("user");
  if (!payload || typeof payload !== "object" || typeof payload.id !== "number") return null;

  const row = getDb()
    .prepare(
      `SELECT id, username, must_change_password AS mustChangePassword,
              session_epoch AS sessionEpoch
       FROM users WHERE id = ?`
    )
    .get(payload.id) as
    | { id: number; username: string; mustChangePassword: number; sessionEpoch: number }
    | undefined;
  if (!row) return null;
  if (row.sessionEpoch !== payload.epoch) return null;
  return {
    id: row.id,
    username: row.username,
    mustChangePassword: row.mustChangePassword === 1,
    sessionEpoch: row.sessionEpoch,
  };
}

export function writeSessionUser(
  request: FastifyRequest,
  user: { id: number; sessionEpoch: number }
): void {
  request.session.set("user", { id: user.id, epoch: user.sessionEpoch });
}

export function clearSession(request: FastifyRequest): void {
  request.session.delete();
}

// Must stay async: Fastify 5 silently stalls routes that mix sync and async
// preHandlers in the same chain.
export async function requireSession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = readSessionUser(request);
  if (!user) {
    return reply.code(401).send({ error: "UNAUTHENTICATED" });
  }
  request.currentUser = user;
}

// /api/auth/change-password uses requireSession directly so it stays reachable
// while must_change_password = 1; everything else admin goes through this.
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireSession(request, reply);
  if (reply.sent) return;
  if (request.currentUser?.mustChangePassword) {
    return reply.code(409).send({ error: "PASSWORD_CHANGE_REQUIRED" });
  }
}
