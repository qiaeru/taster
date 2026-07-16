// SPDX-License-Identifier: MIT
// Public statistics, aggregated client-side from the already-cached catalog:
// no dedicated endpoint. Simple accessible bar rows (no chart library).

import { loadCatalog, type Catalog } from "../api.js";
import { renderHeader } from "../components/Header.js";
import { icon } from "../components/Icon.js";
import { t } from "../i18n/index.js";

function statTile(value: string, label: string, href: string): HTMLElement {
  const tile = document.createElement("a");
  tile.className = "stat-tile";
  tile.href = href;
  const v = document.createElement("span");
  v.className = "stat-value";
  v.textContent = value;
  const l = document.createElement("span");
  l.className = "stat-label muted";
  l.textContent = label;
  tile.append(v, l);
  return tile;
}

// Each row links to the public list with the matching filter applied.
function barRow(
  label: HTMLElement | string,
  count: number,
  max: number,
  href: string,
  color?: string
): HTMLElement {
  const row = document.createElement("a");
  row.className = "bar-row";
  row.href = href;
  const lab = document.createElement("span");
  lab.className = "bar-label";
  if (typeof label === "string") lab.textContent = label;
  else lab.appendChild(label);
  row.appendChild(lab);
  const track = document.createElement("div");
  track.className = "bar-track";
  const fill = document.createElement("div");
  fill.className = "bar-fill";
  fill.style.width = max > 0 ? `${Math.max(2, Math.round((count / max) * 100))}%` : "0";
  if (color) fill.style.setProperty("--bar-color", color);
  track.appendChild(fill);
  row.appendChild(track);
  const num = document.createElement("span");
  num.className = "bar-count muted";
  num.textContent = String(count);
  row.appendChild(num);
  return row;
}

function section(title: string): { wrap: HTMLElement; body: HTMLElement } {
  const wrap = document.createElement("section");
  wrap.className = "stats-section";
  const h2 = document.createElement("h2");
  h2.className = "detail-subhead";
  h2.textContent = title;
  wrap.appendChild(h2);
  const body = document.createElement("div");
  body.className = "stats-body";
  wrap.appendChild(body);
  return { wrap, body };
}

export function renderStats(root: HTMLElement): () => void {
  let disposed = false;
  root.appendChild(renderHeader());
  const main = document.createElement("main");
  main.className = "stats-page";
  root.appendChild(main);

  const h1 = document.createElement("h1");
  h1.className = "page-title";
  h1.textContent = t("stats.title");
  main.appendChild(h1);
  document.title = `${t("stats.title")} · Taster`;

  void loadCatalog().then((catalog: Catalog) => {
    if (disposed) return;
    const { tastes, categories } = catalog;

    if (!tastes.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = t("stats.empty");
      main.appendChild(empty);
      return;
    }

    const tiles = document.createElement("div");
    tiles.className = "stat-tiles";
    tiles.appendChild(statTile(String(tastes.length), t("stats.total"), "/"));
    tiles.appendChild(
      statTile(String(tastes.filter((x) => x.favorite).length), t("stats.favorites"), "/?fav=1")
    );
    tiles.appendChild(
      statTile(String(tastes.filter((x) => x.rating !== null).length), t("stats.rated"), "/?min=1")
    );
    main.appendChild(tiles);

    // Per category
    const byCat = section(t("stats.byCategory"));
    const counts = categories
      .map((c) => ({ c, n: tastes.filter((x) => x.categoryId === c.id).length }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n);
    const maxCat = Math.max(...counts.map((x) => x.n), 0);
    for (const { c, n } of counts) {
      const label = document.createElement("span");
      label.className = "cat-badge";
      label.style.setProperty("--cat-color", c.color);
      label.appendChild(icon(c.icon, "icon icon-sm"));
      label.appendChild(document.createTextNode(c.name));
      byCat.body.appendChild(barRow(label, n, maxCat, `/?cat=${encodeURIComponent(c.slug)}`, c.color));
    }
    main.appendChild(byCat.wrap);

    // Rating distribution
    const byRating = section(t("stats.byRating"));
    const ratingCounts = [5, 4, 3, 2, 1].map((r) => ({
      r,
      n: tastes.filter((x) => x.rating === r).length,
    }));
    const maxRating = Math.max(...ratingCounts.map((x) => x.n), 0);
    for (const { r, n } of ratingCounts) {
      byRating.body.appendChild(barRow(`${"★".repeat(r)} ${t(`rating.${r}`)}`, n, maxRating, `/?r=${r}`));
    }
    main.appendChild(byRating.wrap);

    // Top tags
    const tagCounts = new Map<string, number>();
    for (const taste of tastes)
      for (const tag of taste.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    const topTags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 10);
    if (topTags.length) {
      const tagsSection = section(t("stats.topTags"));
      const maxTag = topTags[0][1];
      for (const [name, n] of topTags)
        tagsSection.body.appendChild(barRow(name, n, maxTag, `/?tags=${encodeURIComponent(name)}`));
      main.appendChild(tagsSection.wrap);
    }
  });

  return () => {
    disposed = true;
    document.title = "Taster";
  };
}
