// SPDX-License-Identifier: MIT
// Serves normalized images from DATA_DIR/uploads. Filenames are random UUIDs
// minted per upload, so the content of a given URL never changes: cache hard.

import fp from "fastify-plugin";
import fastifyStatic from "@fastify/static";
import { mkdirSync } from "node:fs";
import { config } from "../config.js";

export default fp(async function uploadsPlugin(app) {
  mkdirSync(config.uploadsDir, { recursive: true });
  await app.register(fastifyStatic, {
    root: config.uploadsDir,
    prefix: "/uploads/",
    decorateReply: false,
    index: false,
    setHeaders(res) {
      res.header("Cache-Control", "public, max-age=31536000, immutable");
    },
  });
});
