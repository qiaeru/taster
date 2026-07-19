// SPDX-License-Identifier: MIT
// PWA manifest, content-negotiated per locale (Accept-Language). Install-only:
// no service worker, no offline mode.

import type { FastifyInstance } from "fastify";
import { readAppSettings } from "../lib/settings.js";

const DESCRIPTIONS: Record<string, string> = {
  fr: "Une vitrine de goûts personnels : films, séries, jeux vidéo, restaurants, livres, musique et plus.",
  en: "A showcase of personal tastes: movies, TV shows, video games, restaurants, books, music and more.",
};

export default async function manifestRoutes(app: FastifyInstance) {
  app.get("/manifest.webmanifest", async (request, reply) => {
    const accept = String(request.headers["accept-language"] || "");
    const locale = accept.toLowerCase().startsWith("fr") ? "fr" : "en";
    const appName = readAppSettings().appName;
    reply.header("Vary", "Accept-Language");
    return reply.type("application/manifest+json; charset=utf-8").send({
      name: appName,
      short_name: appName,
      description: DESCRIPTIONS[locale],
      lang: locale,
      start_url: "/",
      display: "standalone",
      background_color: "#111015",
      theme_color: "#111015",
      icons: [
        { src: "/icons/pwa-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/pwa-512.png", sizes: "512x512", type: "image/png" },
        {
          src: "/icons/pwa-maskable-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    });
  });
}
