// SPDX-License-Identifier: MIT
// The list card, in two densities: rich card (grid) and compact row (list).
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
  /** Date to display for the active sort (null = none). */
  rowDate?: (taste: TasteSummary) => string | null;
  /** Show an edit shortcut on each entry (signed-in admin only). */
  editable?: boolean;
  /** Admin quick action: flip the favorite flag without opening the form.
   *  Only ever set for a signed-in admin; its presence turns hearts into
   *  toggles. */
  onToggleFavorite?: (taste: TasteSummary) => void;
}

/** Base CardContext (category/status lookup maps) from the catalog. */
export function cardContext(categories: Category[]): CardContext {
  return {
    categories: new Map(categories.map((c) => [c.id, c])),
    statuses: new Map<number, Status>(
      categories.flatMap((c) => c.statuses.map((s) => [s.id, s] as const))
    ),
  };
}

// Heart as a toggle for admins: shows the state on every entry and flips it
// in place. Also layered above the stretched link.
function favoriteToggle(
  taste: TasteSummary,
  ctx: CardContext,
  className: string
): HTMLElement {
  const heart = document.createElement("button");
  heart.type = "button";
  heart.className = className;
  // Lets the list patch every rendered heart of this taste in place.
  heart.dataset.tasteId = taste.id;
  heart.dataset.active = String(taste.favorite);
  heart.setAttribute("aria-pressed", String(taste.favorite));
  heart.setAttribute("aria-label", t("card.favorite"));
  tip(heart, t("card.favorite"), "bottom", "end");
  heart.appendChild(icon(taste.favorite ? "heart-solid-20" : "heart", "icon icon-sm"));
  heart.addEventListener("click", () => ctx.onToggleFavorite?.(taste));
  return heart;
}

// Edit shortcut for admins. A real link layered above the card's stretched
// link, so cards stay valid HTML (no nested anchors).
function editShortcut(id: string, className: string): HTMLElement {
  const edit = document.createElement("a");
  edit.className = className;
  edit.href = `/admin/taste/${id}/edit`;
  edit.setAttribute("aria-label", t("detail.edit"));
  // Start-aligned: the card clips overflow and the badge sits near its left
  // edge, so a centered bubble would be cropped.
  tip(edit, t("detail.edit"), "bottom", "start");
  edit.appendChild(icon("pencil", "icon icon-sm"));
  return edit;
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

function media(
  taste: TasteSummary,
  category: Category | undefined,
  eager: boolean,
  ctx: CardContext
): HTMLElement {
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
  if (ctx.onToggleFavorite) {
    wrap.appendChild(favoriteToggle(taste, ctx, "card-heart card-heart-toggle"));
  } else if (taste.favorite) {
    // Decorative badge for visitors; pointer-events: none in CSS so clicks
    // fall through to the card's stretched link instead of dying on it.
    const heart = document.createElement("span");
    heart.className = "card-heart";
    heart.setAttribute("aria-label", t("card.favorite"));
    heart.appendChild(icon("heart-solid-20", "icon icon-sm"));
    wrap.appendChild(heart);
  }
  return wrap;
}

export function tasteCard(taste: TasteSummary, ctx: CardContext, eager = false): HTMLElement {
  const category = ctx.categories.get(taste.categoryId);
  const status = taste.statusId !== null ? ctx.statuses.get(taste.statusId) : undefined;

  const card = document.createElement("div");
  card.className = "taste-card";

  const mediaEl = media(taste, category, eager, ctx);
  if (ctx.editable) mediaEl.appendChild(editShortcut(taste.id, "card-edit"));
  card.appendChild(mediaEl);

  const body = document.createElement("div");
  body.className = "card-body";

  const title = document.createElement("h3");
  title.className = "card-title";
  const link = document.createElement("a");
  link.className = "card-link";
  link.href = `/taste/${taste.id}`;
  link.textContent = taste.title;
  title.appendChild(link);
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

  const dateText = ctx.rowDate?.(taste);
  if (dateText) {
    const date = document.createElement("span");
    date.className = "muted card-date";
    date.textContent = dateText;
    body.appendChild(date);
  }

  card.appendChild(body);
  return card;
}

export function tasteRow(taste: TasteSummary, ctx: CardContext): HTMLElement {
  const category = ctx.categories.get(taste.categoryId);
  const status = taste.statusId !== null ? ctx.statuses.get(taste.statusId) : undefined;

  const row = document.createElement("div");
  row.className = "taste-row";

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
  const link = document.createElement("a");
  link.className = "card-link";
  link.href = `/taste/${taste.id}`;
  link.textContent = taste.title;
  title.appendChild(link);
  // Admins get the heart as a toggle in row-right instead (next to the pencil).
  if (taste.favorite && !ctx.onToggleFavorite) {
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
  if (ctx.onToggleFavorite) {
    right.appendChild(favoriteToggle(taste, ctx, "icon-btn row-action row-heart-toggle"));
  }
  if (ctx.editable) right.appendChild(editShortcut(taste.id, "icon-btn row-action"));
  row.appendChild(right);

  return row;
}
