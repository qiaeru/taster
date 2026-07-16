// SPDX-License-Identifier: MIT
// Liveness probe at /healthz. No auth, outside the rate limiter. Safe to
// expose externally; deliberately version-free (public reconnaissance).

import type { FastifyInstance } from "fastify";
import { getDb } from "../db/index.js";

export default async function healthRoutes(app: FastifyInstance) {
  app.get("/healthz", { config: { rateLimit: false } }, async (_request, reply) => {
    let dbOk: boolean;
    try {
      getDb().prepare("SELECT 1").get();
      dbOk = true;
    } catch {
      dbOk = false;
    }
    // A dead database must fail the probe: the Docker HEALTHCHECK and uptime
    // monitors only look at the status code.
    if (!dbOk) return reply.code(503).send({ status: "error", dbOk });
    return { status: "ok", dbOk };
  });
}
