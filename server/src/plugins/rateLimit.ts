// SPDX-License-Identifier: MIT
// Global rate limiting for everything that does per-request work (/api/*,
// feed, sitemap, the OG-injecting HTML fallback). Only true static assets are
// exempt so a page refresh doesn't burn the budget. Per-route stricter limits
// live where the routes are declared (5/min on login, 10/hour on
// change-password); /healthz opts out via its route config.

import fp from "fastify-plugin";
import rateLimit from "@fastify/rate-limit";

const STATIC_PREFIXES = ["/assets/", "/uploads/", "/icons/"];
const STATIC_FILES = new Set(["/favicon.ico", "/logo.svg"]);

export default fp(async function rateLimitPlugin(app) {
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute",
    allowList: (req) => {
      const path = req.url.split("?")[0];
      return STATIC_PREFIXES.some((p) => path.startsWith(p)) || STATIC_FILES.has(path);
    },
    // Must return a real Error with statusCode so setErrorHandler maps it to
    // a 429; a plain POJO would fall through to the 500 branch.
    errorResponseBuilder: () => {
      const err = new Error("Too many requests") as Error & { statusCode: number; code: string };
      err.statusCode = 429;
      err.code = "RATE_LIMITED";
      return err;
    },
  });
});
