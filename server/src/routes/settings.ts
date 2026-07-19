// SPDX-License-Identifier: MIT
// Public instance settings, fetched by the client before the first render.

import type { FastifyInstance } from "fastify";
import { readAppSettings } from "../lib/settings.js";

export default async function settingsRoutes(app: FastifyInstance) {
  app.get("/settings", async () => readAppSettings());
}
