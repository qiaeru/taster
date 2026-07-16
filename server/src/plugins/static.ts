// SPDX-License-Identifier: MIT
// Serves the built client bundle and implements the history-API fallback:
// any non-API GET that misses a real file answers index.html so /taste/xxx,
// /stats and /admin deep links work. The detail-page fallback also injects
// OpenGraph meta tags (see lib/html.ts).

import fp from "fastify-plugin";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../config.js";
import { renderIndexHtml } from "../lib/html.js";

export default fp(async function staticPlugin(app) {
  const hasBundle = existsSync(resolve(config.publicDir, "index.html"));
  if (!hasBundle) {
    app.log.warn(
      { publicDir: config.publicDir },
      "client bundle not found; serving API only (expected in dev, use the Vite dev server)"
    );
  } else {
    await app.register(fastifyStatic, {
      root: config.publicDir,
      prefix: "/",
      // index.html goes through renderIndexHtml (OG injection), never raw.
      index: false,
      setHeaders(res, path) {
        // @fastify/static v10 hands the Fastify reply wrapper, not the raw res.
        if (path.endsWith(".html")) {
          res.header("Cache-Control", "no-cache");
        } else if (path.includes("assets")) {
          // Vite emits content-hashed filenames under assets/.
          res.header("Cache-Control", "public, max-age=31536000, immutable");
        } else {
          res.header("Cache-Control", "public, max-age=3600");
        }
      },
    });
  }

  // @fastify/static answers 403 (not 404) on the bare directory request, so
  // "/" needs its own route to reach the OG-injecting template.
  if (hasBundle) {
    app.get("/", async (_request, reply) => {
      return reply
        .type("text/html; charset=utf-8")
        .header("Cache-Control", "no-cache")
        .send(renderIndexHtml("/"));
    });
  }

  // The fallback renders HTML with a DB lookup per request, so it gets the
  // same per-IP budget as regular routes (a not-found handler sits outside
  // the global limiter otherwise).
  app.setNotFoundHandler({ preHandler: app.rateLimit() }, async (request, reply) => {
    // API misses and missing uploaded images are real 404s, never index.html.
    if (request.url.startsWith("/api/") || request.url.startsWith("/uploads/")) {
      return reply.code(404).send({ error: "NOT_FOUND" });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return reply.code(404).send({ error: "NOT_FOUND" });
    }
    if (!hasBundle) {
      return reply.code(503).send({ error: "CLIENT_BUNDLE_MISSING" });
    }
    const html = renderIndexHtml(request.url);
    return reply.code(200).type("text/html; charset=utf-8").header("Cache-Control", "no-cache")
      .send(html);
  });
});
