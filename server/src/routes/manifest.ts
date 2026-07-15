// SPDX-License-Identifier: MIT
// PWA manifest, content-negotiated per locale (Accept-Language). Install-only:
// no service worker, no offline mode.

import type { FastifyInstance } from "fastify";

const MANIFESTS: Record<string, { name: string; description: string }> = {
  fr: {
    name: "Taster",
    description:
      "Une vitrine de goûts personnels : films, séries, jeux vidéo, cuisine, livres, musique et plus.",
  },
  en: {
    name: "Taster",
    description:
      "A showcase of personal tastes: films, series, video games, food, books, music and more.",
  },
};

export default async function manifestRoutes(app: FastifyInstance) {
  app.get("/manifest.webmanifest", async (request, reply) => {
    const accept = String(request.headers["accept-language"] || "");
    const locale = accept.toLowerCase().startsWith("fr") ? "fr" : "en";
    const meta = MANIFESTS[locale];
    reply.header("Vary", "Accept-Language");
    return reply.type("application/manifest+json; charset=utf-8").send({
      name: meta.name,
      short_name: "Taster",
      description: meta.description,
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
