// SPDX-License-Identifier: MIT
// index.html template rendering for the history-API fallback. For /taste/:id
// the <!--og:head--> placeholder is replaced with OpenGraph meta tags so
// shared links unfurl into preview cards; every other route gets the default
// site meta. The template is read once and cached.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../config.js";
import { getDb } from "./../db/index.js";

let template: string | null = null;

function getTemplate(): string {
  if (template === null) {
    template = readFileSync(resolve(config.publicDir, "index.html"), "utf8");
  }
  return template;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function absoluteUrl(path: string): string {
  return config.publicUrl ? `${config.publicUrl}${path}` : path;
}

interface OgData {
  title: string;
  description: string;
  imagePath: string | null;
  urlPath: string;
}

function metaTags(og: OgData): string {
  const title = escapeHtml(og.title);
  const description = escapeHtml(og.description);
  const lines = [
    `<meta name="description" content="${description}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Taster" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${escapeHtml(absoluteUrl(og.urlPath))}" />`,
  ];
  if (og.imagePath) {
    lines.push(`<meta property="og:image" content="${escapeHtml(absoluteUrl(og.imagePath))}" />`);
    lines.push(`<meta name="twitter:card" content="summary_large_image" />`);
  } else {
    lines.push(`<meta name="twitter:card" content="summary" />`);
  }
  return lines.join("\n    ");
}

// First plain-text-ish excerpt of a taste's review, for og:description.
function excerptFor(tasteId: string): string | null {
  const row = getDb()
    .prepare(
      `SELECT body_md FROM sections WHERE taste_id = ? AND body_md != ''
       ORDER BY sort_order LIMIT 1`
    )
    .get(tasteId) as { body_md: string } | undefined;
  if (!row) return null;
  const text = row.body_md
    .replace(/\|\|[^|]*\|\|/g, "") // never leak spoilers into previews
    .replace(/[#*_`>[\]()!-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, 200) : null;
}

const TASTE_PATH = /^\/taste\/([0-9a-f-]{36})(?:\?.*)?$/i;

export function renderIndexHtml(url: string): string {
  const tpl = getTemplate();
  const defaultDescription =
    "A self-hosted showcase of personal tastes: movies, TV shows, video games, restaurants, books, music and more.";

  const match = TASTE_PATH.exec(url);
  if (match) {
    const row = getDb()
      .prepare(
        "SELECT id, title, image_file AS imageFile FROM tastes WHERE id = ? AND published = 1"
      )
      .get(match[1]) as { id: string; title: string; imageFile: string | null } | undefined;
    if (row) {
      const og = metaTags({
        title: `${row.title} · Taster`,
        description: excerptFor(row.id) || defaultDescription,
        imagePath: row.imageFile ? `/uploads/${row.imageFile}` : null,
        urlPath: `/taste/${row.id}`,
      });
      // Function replacements: a plain string would expand `$&` / `$'`
      // patterns coming from the taste title into template fragments.
      return tpl
        .replace("<!--og:head-->", () => og)
        .replace("<title>Taster</title>", () => `<title>${escapeHtml(row.title)} · Taster</title>`);
    }
  }

  const og = metaTags({
    title: "Taster",
    description: defaultDescription,
    imagePath: null,
    urlPath: "/",
  });
  return tpl.replace("<!--og:head-->", () => og);
}
