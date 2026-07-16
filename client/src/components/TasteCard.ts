// SPDX-License-Identifier: MIT
// The list card, in two densities: rich card (grid/tiers) and compact row.
// Cards load the thumb variant only; width/height attributes prevent layout
// shift and loading=lazy keeps long lists cheap, except the first above-the-
// fold cards which load eagerly at high priority so the top of the page does
// not pop in as one late batch (HTTP/1.1 queues thumbs ~6 at a time).

import type { Category, Status, TasteSummary } from "@taster/shared";
import { displayUrl, thumbUrl } from "../api.js";
import { icon } from "./Icon.js";
import { tip } from "./Tooltip.js";
import { starDisplay } from "./StarRating.js";
import { t } from "../i18n/index.js";

export interface CardContext {
  categories: Map<number, Category>;
  statuses: Map<number, Status>;
  /** Extra badge for the admin table ("draft"). */
  draft?: boolean;
  /** Compact rows: date to display for the active sort (null = none). */
  rowDate?: (taste: TasteSummary) => string | null;
}

function categoryBadge(category: Category | undefined): HTMLElement {
  const badge = document.createElement("span");
  badge.className = "cat-badge";
  if (category) {
    badge.style.setProperty("--cat-color", category.color);
    badge.appendChild(icon(category.icon, "icon icon-sm"));
    badge.appendChild(document.createTextNode(category.name));
  }
  return badge;
}

function media(taste: TasteSummary, category: Category | undefined, eager: boolean): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "card-media";
  if (category) wrap.style.setProperty("--cat-color", category.color);
  if (taste.imageFile) {
    const img = document.createElement("img");
    img.src = thumbUrl(taste.imageFile);
    // High-density screens get the display variant, keeping covers sharp.
    img.srcset = `${thumbUrl(taste.imageFile)} 1x, ${displayUrl(taste.imageFile)} 2x`;
    img.alt = "";
    img.loading = eager ? "eager" : "lazy";
    if (eager) img.setAttribute("fetchpriority", "high");
    img.decoding = "async";
    img.width = 480;
    img.height = 320;
    if (taste.imageFocus) {
      img.style.objectPosition = `${taste.imageFocus.x * 100}% ${taste.imageFocus.y * 100}%`;
    }
    wrap.appendChild(img);
  } else {
    wrap.classList.add("card-media-placeholder");
    wrap.appendChild(icon(category?.icon ?? "tag", "icon icon-xl"));
  }
  if (taste.favorite) {
    const heart = document.createElement("span");
    heart.className = "card-heart";
    heart.setAttribute("aria-label", t("card.favorite"));
    // Downward, right-aligned: the card clips overflow and the badge sits in
    // its top-right corner.
    tip(heart, t("card.favorite"), "bottom", "end");
    heart.appendChild(icon("heart-solid-20", "icon icon-sm"));
    wrap.appendChild(heart);
  }
  return wrap;
}

export function tasteCard(taste: TasteSummary, ctx: CardContext, eager = false): HTMLElement {
  const category = ctx.categories.get(taste.categoryId);
  const status = taste.statusId !== null ? ctx.statuses.get(taste.statusId) : undefined;

  const card = document.createElement("a");
  card.className = "taste-card";
  card.href = `/taste/${taste.id}`;

  card.appendChild(media(taste, category, eager));

  const body = document.createElement("div");
  body.className = "card-body";

  const title = document.createElement("h3");
  title.className = "card-title";
  title.textContent = taste.title;
  body.appendChild(title);

  const metaRow = document.createElement("div");
  metaRow.className = "card-meta";
  metaRow.appendChild(categoryBadge(category));
  if (taste.rating) metaRow.appendChild(starDisplay(taste.rating, "sm"));
  body.appendChild(metaRow);

  const chipRow = document.createElement("div");
  chipRow.className = "card-chips";
  if (ctx.draft) {
    const draft = document.createElement("span");
    draft.className = "chip chip-draft";
    draft.textContent = t("card.draft");
    chipRow.appendChild(draft);
  }
  if (status) {
    const pill = document.createElement("span");
    pill.className = "chip chip-status";
    pill.textContent = status.name;
    chipRow.appendChild(pill);
  }
  for (const tag of taste.tags.slice(0, 4)) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = tag;
    chipRow.appendChild(chip);
  }
  if (taste.tags.length > 4) {
    const more = document.createElement("span");
    more.className = "chip chip-more";
    more.textContent = `+${taste.tags.length - 4}`;
    chipRow.appendChild(more);
  }
  if (chipRow.childElementCount > 0) body.appendChild(chipRow);

  card.appendChild(body);
  return card;
}

export function tasteRow(taste: TasteSummary, ctx: CardContext): HTMLElement {
  const category = ctx.categories.get(taste.categoryId);
  const status = taste.statusId !== null ? ctx.statuses.get(taste.statusId) : undefined;

  const row = document.createElement("a");
  row.className = "taste-row";
  row.href = `/taste/${taste.id}`;

  const thumb = document.createElement("div");
  thumb.className = "row-media";
  if (category) thumb.style.setProperty("--cat-color", category.color);
  if (taste.imageFile) {
    const img = document.createElement("img");
    img.src = thumbUrl(taste.imageFile);
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.width = 96;
    img.height = 96;
    if (taste.imageFocus) {
      img.style.objectPosition = `${taste.imageFocus.x * 100}% ${taste.imageFocus.y * 100}%`;
    }
    thumb.appendChild(img);
  } else {
    thumb.classList.add("card-media-placeholder");
    thumb.appendChild(icon(category?.icon ?? "tag", "icon"));
  }
  row.appendChild(thumb);

  const main = document.createElement("div");
  main.className = "row-main";
  const title = document.createElement("span");
  title.className = "row-title";
  title.textContent = taste.title;
  if (taste.favorite) {
    const heart = document.createElement("span");
    heart.className = "row-heart";
    // No tooltip here: the row title clips overflow and would swallow the
    // bubble; the label still reaches assistive tech.
    heart.setAttribute("aria-label", t("card.favorite"));
    heart.appendChild(icon("heart-solid-20", "icon icon-sm"));
    title.appendChild(heart);
  }
  main.appendChild(title);
  const meta = document.createElement("span");
  meta.className = "row-meta";
  meta.appendChild(categoryBadge(category));
  if (status) {
    const pill = document.createElement("span");
    pill.className = "chip chip-status";
    pill.textContent = status.name;
    meta.appendChild(pill);
  }
  const dateText = ctx.rowDate?.(taste);
  if (dateText) {
    const date = document.createElement("span");
    date.className = "muted row-date";
    date.textContent = dateText;
    meta.appendChild(date);
  }
  main.appendChild(meta);
  row.appendChild(main);

  const right = document.createElement("div");
  right.className = "row-right";
  if (taste.rating) right.appendChild(starDisplay(taste.rating, "sm"));
  row.appendChild(right);

  return row;
}
