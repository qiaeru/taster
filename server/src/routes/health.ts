// SPDX-License-Identifier: MIT
// Liveness probe at /healthz. No auth, outside the rate limiter. Safe to
// expose externally; deliberately version-free (public reconnaissance).

import type { FastifyInstance } from "fastify";
import { getDb } from "../db/index.js";

export default async function healthRoutes(app: FastifyInstance) {
  app.get("/healthz", { config: { rateLimit: false } }, async () => {
    let dbOk = false;
    try {
      getDb().prepare("SELECT 1").get();
      dbOk = true;
    } catch {
      dbOk = false;
    }
    return { status: "ok", dbOk };
  });
}
