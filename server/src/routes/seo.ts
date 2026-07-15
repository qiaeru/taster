// SPDX-License-Identifier: MIT
// Public discovery endpoints: Atom feed, sitemap and robots.txt. All URLs are
// absolute when PUBLIC_URL is configured; the feed and sitemap fall back to
// the request host otherwise so LAN deployments still validate.

import type { FastifyInstance, FastifyRequest } from "fastify";
import { getDb } from "../db/index.js";
import { config } from "../config.js";

const FEED_LIMIT = 50;

function baseUrl(request: FastifyRequest): string {
  if (config.publicUrl) return config.publicUrl;
  return `${request.protocol}://${request.host}`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

// SQLite datetime('now') strings are UTC without a zone marker.
function toIso(sqliteUtc: string): string {
  return new Date(sqliteUtc.replace(" ", "T") + "Z").toISOString();
}

interface FeedRow {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export default async function seoRoutes(app: FastifyInstance) {
  app.get("/feed.xml", async (request, reply) => {
    const base = baseUrl(request);
    const rows = getDb()
      .prepare(
        `SELECT id, title, created_at AS createdAt, updated_at AS updatedAt
         FROM tastes WHERE published = 1
         ORDER BY created_at DESC, id LIMIT ?`
      )
      .all(FEED_LIMIT) as unknown as FeedRow[];

    const feedUpdated = rows.length > 0 ? toIso(rows[0].updatedAt) : new Date().toISOString();
    const entries = rows
      .map((row) => {
        const url = `${base}/taste/${row.id}`;
        return `  <entry>
    <id>urn:uuid:${row.id}</id>
    <title>${escapeXml(row.title)}</title>
    <link href="${escapeXml(url)}"/>
    <published>${toIso(row.createdAt)}</published>
    <updated>${toIso(row.updatedAt)}</updated>
  </entry>`;
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${escapeXml(base)}/</id>
  <title>Taster</title>
  <subtitle>Latest tastes</subtitle>
  <link href="${escapeXml(base)}/"/>
  <link rel="self" href="${escapeXml(base)}/feed.xml"/>
  <updated>${feedUpdated}</updated>
  <author><name>Taster</name></author>
${entries}
</feed>
`;
    return reply.type("application/atom+xml; charset=utf-8").send(xml);
  });

  app.get("/sitemap.xml", async (request, reply) => {
    const base = baseUrl(request);
    const rows = getDb()
      .prepare(
        `SELECT id, updated_at AS updatedAt FROM tastes WHERE published = 1
         ORDER BY created_at DESC, id`
      )
      .all() as unknown as { id: string; updatedAt: string }[];

    const urls = [
      `  <url><loc>${escapeXml(base)}/</loc></url>`,
      `  <url><loc>${escapeXml(base)}/stats</loc></url>`,
      ...rows.map(
        (row) =>
          `  <url><loc>${escapeXml(`${base}/taste/${row.id}`)}</loc>` +
          `<lastmod>${toIso(row.updatedAt).slice(0, 10)}</lastmod></url>`
      ),
    ].join("\n");

    const xml = `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
    return reply.type("application/xml; charset=utf-8").send(xml);
  });

  app.get("/robots.txt", async (request, reply) => {
    const base = baseUrl(request);
    const body = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/

Sitemap: ${base}/sitemap.xml
`;
    return reply.type("text/plain; charset=utf-8").send(body);
  });
}
