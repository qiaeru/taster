// SPDX-License-Identifier: MIT
// Public statistics, aggregated client-side from the already-cached catalog:
// no dedicated endpoint. Simple accessible bar rows (no chart library).

import { loadCatalog, type Catalog } from "../api.js";
import { renderHeader } from "../components/Header.js";
import { icon } from "../components/Icon.js";
import { t, locale$ } from "../i18n/index.js";
import { appName } from "../lib/appSettings.js";

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
  color?: string,
  countText?: string
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
  // A zero count gets a truly empty bar; the 2% floor only keeps small
  // non-zero counts visible.
  fill.style.width = count > 0 && max > 0 ? `${Math.max(2, Math.round((count / max) * 100))}%` : "0";
  if (color) fill.style.setProperty("--bar-color", color);
  track.appendChild(fill);
  row.appendChild(track);
  const num = document.createElement("span");
  num.className = "bar-count muted";
  num.textContent = countText ?? String(count);
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
  document.title = `${t("stats.title")} · ${appName()}`;

  const boot = (force: boolean): void => {
    loadCatalog(force)
      .then((catalog: Catalog) => {
        if (disposed) return;
        build(catalog);
      })
      .catch(() => {
        if (disposed) return;
        const err = document.createElement("p");
        err.className = "error-box";
        err.textContent = t("error.network");
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "btn";
        retry.textContent = t("action.retry");
        retry.addEventListener("click", () => {
          err.remove();
          retry.remove();
          boot(true);
        });
        main.append(err, retry);
      });
  };
  boot(false);

  function build(catalog: Catalog): void {
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

    // Average rating per category (rated tastes only)
    const averages = categories
      .map((c) => {
        const rated = tastes.filter((x) => x.categoryId === c.id && x.rating !== null);
        const sum = rated.reduce((acc, x) => acc + (x.rating ?? 0), 0);
        return { c, n: rated.length, avg: rated.length ? sum / rated.length : 0 };
      })
      .filter((x) => x.n > 0)
      .sort((a, b) => b.avg - a.avg);
    if (averages.length) {
      const avgSection = section(t("stats.avgByCategory"));
      const format = new Intl.NumberFormat(locale$.get(), {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
      for (const { c, avg } of averages) {
        const label = document.createElement("span");
        label.className = "cat-badge";
        label.style.setProperty("--cat-color", c.color);
        label.appendChild(icon(c.icon, "icon icon-sm"));
        label.appendChild(document.createTextNode(c.name));
        avgSection.body.appendChild(
          barRow(label, avg, 5, `/?cat=${encodeURIComponent(c.slug)}`, c.color, `${format.format(avg)} ★`)
        );
      }
      main.appendChild(avgSection.wrap);
    }

    // Rating distribution; ratings no taste ever received are skipped.
    const ratingCounts = [5, 4, 3, 2, 1]
      .map((r) => ({ r, n: tastes.filter((x) => x.rating === r).length }))
      .filter((x) => x.n > 0);
    if (ratingCounts.length) {
      const byRating = section(t("stats.byRating"));
      const maxRating = Math.max(...ratingCounts.map((x) => x.n));
      for (const { r, n } of ratingCounts) {
        byRating.body.appendChild(barRow(`${"★".repeat(r)} ${t(`rating.${r}`)}`, n, maxRating, `/?r=${r}`));
      }
      main.appendChild(byRating.wrap);
    }

    // Additions per month: the 12 most recent months that actually saw an
    // addition, oldest first. Empty months are skipped rather than shown as
    // zero-width bars.
    const monthCounts = new Map<string, number>();
    for (const taste of tastes) {
      const key = taste.createdAt.slice(0, 7);
      monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
    }
    const monthFormat = new Intl.DateTimeFormat(locale$.get(), { month: "short", year: "numeric" });
    const months = [...monthCounts.entries()]
      // "YYYY-MM" keys: lexicographic order is chronological.
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([key, n]) => {
        const [year, month] = key.split("-").map(Number);
        return { key, label: monthFormat.format(new Date(year, month - 1, 1)), n };
      });
    if (months.length) {
      const monthSection = section(t("stats.byMonth"));
      const maxMonth = Math.max(...months.map((m) => m.n));
      for (const m of months)
        monthSection.body.appendChild(barRow(m.label, m.n, maxMonth, `/?m=${m.key}`));
      main.appendChild(monthSection.wrap);
    }

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
  }

  return () => {
    disposed = true;
    document.title = appName();
  };
}
