// SPDX-License-Identifier: MIT
// Admin instance settings: rename the app, pick a theme, choose the default
// visitor locale. Sits behind requireAdmin (wired by the /api/admin scope).

import type { FastifyInstance } from "fastify";
import type { AppSettings } from "@taster/shared";
import {
  DEFAULT_APP_NAME,
  isKnownTheme,
  listThemeFiles,
  readAppSettings,
  writeAppSettings,
} from "../lib/settings.js";

export default async function adminSettingsRoutes(app: FastifyInstance) {
  app.get("/settings/themes", async () => ({ themes: ["default", ...listThemeFiles()] }));

  app.put(
    "/settings",
    {
      schema: {
        body: {
          type: "object",
          required: ["appName", "theme", "defaultLocale"],
          additionalProperties: false,
          properties: {
            appName: { type: "string", maxLength: 60 },
            theme: { type: "string", minLength: 1, maxLength: 64 },
            defaultLocale: { type: "string", enum: ["auto", "fr", "en"] },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as AppSettings;
      if (!isKnownTheme(body.theme)) {
        return reply.code(400).send({ error: "THEME_UNKNOWN" });
      }
      writeAppSettings({
        appName: body.appName.trim() || DEFAULT_APP_NAME,
        theme: body.theme,
        defaultLocale: body.defaultLocale,
      });
      return readAppSettings();
    }
  );
}
