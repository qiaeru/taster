// SPDX-License-Identifier: MIT
// Serves the owner's optional theme stylesheets from DATA_DIR/themes. Unlike
// uploads, these files can be edited in place, so cache briefly instead of
// forever.

import fp from "fastify-plugin";
import fastifyStatic from "@fastify/static";
import { mkdirSync } from "node:fs";
import { config } from "../config.js";

export default fp(async function themesPlugin(app) {
  mkdirSync(config.themesDir, { recursive: true });
  await app.register(fastifyStatic, {
    root: config.themesDir,
    prefix: "/themes/",
    decorateReply: false,
    index: false,
    setHeaders(res) {
      res.header("Cache-Control", "public, max-age=300");
    },
  });
});
