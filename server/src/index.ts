// SPDX-License-Identifier: MIT
// Fastify bootstrap: wires plugins, runs migrations + seed, mounts routes.

import Fastify, { type FastifyError } from "fastify";
import compressPlugin from "@fastify/compress";
import { config } from "./config.js";
import { runMigrations } from "./db/migrate.js";
import { runSeed, maybeResetAdmin } from "./db/seed.js";
import { closeDb } from "./db/index.js";

import securityHeadersPlugin from "./plugins/securityHeaders.js";
import sessionPlugin from "./plugins/session.js";
import csrfPlugin from "./plugins/csrf.js";
import rateLimitPlugin from "./plugins/rateLimit.js";
import staticPlugin from "./plugins/static.js";

import healthRoutes from "./routes/health.js";
import authRoutes from "./routes/auth.js";
import tasteRoutes from "./routes/tastes.js";
import categoryRoutes from "./routes/categories.js";
import uploadsPlugin from "./routes/uploads.js";
import seoRoutes from "./routes/seo.js";
import manifestRoutes from "./routes/manifest.js";

async function buildApp() {
  const app = Fastify({
    trustProxy: config.trustProxy,
    logger: {
      level: config.logLevel,
      redact: ["req.body.password", "req.body.newPassword", "req.body.currentPassword"],
    },
    bodyLimit: 512 * 1024,
    // Skip the per-request access log line in production: the serve cost of
    // static assets dwarfs their log encoding cost on a single-instance,
    // low-traffic deployment. Errors and auth failures still surface.
    disableRequestLogging: config.isProduction,
  });

  await app.register(compressPlugin, {
    global: true,
    threshold: 1024,
    encodings: ["br", "gzip"],
  });

  await app.register(securityHeadersPlugin);
  await app.register(rateLimitPlugin);
  await app.register(sessionPlugin);
  await app.register(csrfPlugin);

  // Must be set before the route plugins are registered: encapsulated scopes
  // inherit the error handler that exists at their creation, so a handler set
  // afterwards never applies to them and Fastify's default (which leaks the
  // technical error message in the response body) takes over.
  app.setErrorHandler((error: FastifyError, request, reply) => {
    // Client errors (validation, CSRF, bad input) are expected traffic: log
    // them as warnings so `error` stays reserved for actual server faults.
    if (error.validation) {
      request.log.warn({ err: error }, "request failed");
      return reply.code(400).send({ error: "VALIDATION_ERROR", details: error.validation });
    }
    if (error.statusCode && error.statusCode < 500) {
      request.log.warn({ err: error }, "request failed");
      return reply.code(error.statusCode).send({ error: error.code || "REQUEST_FAILED" });
    }
    request.log.error({ err: error }, "request failed");
    return reply.code(500).send({ error: "INTERNAL_ERROR" });
  });

  // Liveness probe and discovery endpoints at the root, outside the /api
  // rate-limit scope.
  await app.register(healthRoutes);
  await app.register(seoRoutes);
  await app.register(manifestRoutes);
  await app.register(uploadsPlugin);

  await app.register(
    async (scope) => {
      await scope.register(authRoutes);
      await scope.register(tasteRoutes);
      await scope.register(categoryRoutes);
    },
    { prefix: "/api" }
  );

  await app.register(staticPlugin);

  return app;
}

async function start() {
  runMigrations(console);
  await runSeed(console);
  await maybeResetAdmin(console);

  const app = await buildApp();
  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info({ port: config.port, host: config.host, env: config.env }, "server ready");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "shutting down");
    // Safety net: if close() hangs (stuck connection), still exit before the
    // orchestrator escalates to SIGKILL. unref() keeps the timer from holding
    // the process open on the normal path.
    setTimeout(() => process.exit(1), 5000).unref();
    try {
      await app.close();
      closeDb();
      process.exit(0);
    } catch (err) {
      app.log.error(err, "shutdown failed");
      process.exit(1);
    }
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

start();
