// SPDX-License-Identifier: MIT
// Renders the SVG logo into the PNG favicon and PWA icons. Run manually after
// changing client/public/logo.svg: node scripts/generate-icons.mjs
// client/public/favicon.ico is NOT covered (sharp cannot write .ico); rebuild
// it with https://realfavicongenerator.net/ when the logo changes.

import { readFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(resolve(root, "client/public/logo.svg"));
const outDir = resolve(root, "client/public/icons");
mkdirSync(outDir, { recursive: true });

const jobs = [
  { file: "favicon-96.png", size: 96, pad: 0 },
  { file: "apple-touch-icon.png", size: 180, pad: 0 },
  { file: "pwa-192.png", size: 192, pad: 0 },
  { file: "pwa-512.png", size: 512, pad: 0 },
  // Maskable: the mark must sit inside the 80% safe zone on an opaque plate.
  { file: "pwa-maskable-512.png", size: 512, pad: 96, background: "#17131f" },
];

for (const job of jobs) {
  const inner = job.size - job.pad * 2;
  // The logo viewBox is not exactly square; letterbox with transparency, not
  // sharp's default opaque black (flatten() recolors it for maskable).
  let img = sharp(svg, { density: 300 }).resize(inner, inner, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  if (job.pad > 0) {
    img = img
      .extend({
        top: job.pad,
        bottom: job.pad,
        left: job.pad,
        right: job.pad,
        background: job.background,
      })
      // extend() only paints the added border; flatten() fills the logo's own
      // transparent backdrop too, as a maskable icon must be fully opaque.
      .flatten({ background: job.background });
  }
  await img.png().toFile(resolve(outDir, job.file));
  console.log("wrote", job.file);
}
