// SPDX-License-Identifier: MIT
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Server-rendered endpoints are proxied to the Fastify dev server.
const backend = "http://localhost:3000";

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: backend, changeOrigin: true },
      "/uploads": { target: backend, changeOrigin: true },
      "/healthz": { target: backend, changeOrigin: true },
      "/feed.xml": { target: backend, changeOrigin: true },
      "/sitemap.xml": { target: backend, changeOrigin: true },
      "/robots.txt": { target: backend, changeOrigin: true },
      "/manifest.webmanifest": { target: backend, changeOrigin: true },
    },
  },
  build: {
    outDir: path.resolve(__dirname, "../server/dist/public"),
    emptyOutDir: true,
    target: "es2022",
  },
});
