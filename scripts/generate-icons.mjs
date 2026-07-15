// SPDX-License-Identifier: MIT
// Renders the SVG logo into the PNG favicon and PWA icons. Run manually after
// changing client/public/logo.svg: node scripts/generate-icons.mjs

import { readFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(resolve(root, "client/public/logo.svg"));
const outDir = resolve(root, "client/public/icons");
mkdirSync(outDir, { recursive: true });

const jobs = [
  { file: "favicon-32.png", size: 32, pad: 0 },
  { file: "pwa-192.png", size: 192, pad: 0 },
  { file: "pwa-512.png", size: 512, pad: 0 },
  // Maskable: the mark must sit inside the 80% safe zone on an opaque plate.
  { file: "pwa-maskable-512.png", size: 512, pad: 96, background: "#17131f" },
];

for (const job of jobs) {
  const inner = job.size - job.pad * 2;
  let img = sharp(svg, { density: 300 }).resize(inner, inner, { fit: "contain" });
  if (job.pad > 0) {
    img = img.extend({
      top: job.pad,
      bottom: job.pad,
      left: job.pad,
      right: job.pad,
      background: job.background,
    });
  }
  await img.png().toFile(resolve(outDir, job.file));
  console.log("wrote", job.file);
}
