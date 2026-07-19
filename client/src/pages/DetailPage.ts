// SPDX-License-Identifier: MIT
// Taste detail: hero image, ratings with their labels, tags, partial date,
// description, review sections (Markdown + spoilers), reference links, GPS
// block and the external-review call-to-action. Admins get a draft banner and
// an edit link.

import type { TasteDetail } from "@taster/shared";
import { publicApi, authApi, displayUrl, loadCatalog, ApiError, type Catalog } from "../api.js";
import { renderHeader } from "../components/Header.js";
import { tasteCard, cardContext } from "../components/TasteCard.js";
import { starDisplay } from "../components/StarRating.js";
import { geoLink } from "../components/GeoLink.js";
import { icon } from "../components/Icon.js";
import { openLightbox } from "../components/Lightbox.js";
import { tip } from "../components/Tooltip.js";
import { t } from "../i18n/index.js";
import { appName } from "../lib/appSettings.js";
import { formatPartialDate, formatDateTime } from "../lib/format.js";
import { isTypingTarget } from "../lib/dom.js";
import { readListOrder } from "../lib/listOrder.js";
import { renderMarkdown } from "../lib/markdown.js";
import { navigate } from "../router.js";

export function renderDetail(
  root: HTMLElement,
  _params: URLSearchParams,
  segments: string[]
): () => void {
  const id = segments[0] ?? "";
  let disposed = false;
  let onKeyNav: ((e: KeyboardEvent) => void) | null = null;

  root.appendChild(renderHeader());
  const main = document.createElement("main");
  main.className = "detail-page";
  root.appendChild(main);

  void (async () => {
    const networkError = (): void => {
      const err = document.createElement("p");
      err.className = "error-box";
      err.textContent = t("error.network");
      main.appendChild(err);
    };

    let detail: TasteDetail;
    try {
      detail = await publicApi.tasteDetail(id);
    } catch (err) {
      if (disposed) return;
      // A dead server is not a missing taste: report it as such.
      if (err instanceof ApiError && err.status === 0) {
        networkError();
        return;
      }
      const box = document.createElement("div");
      box.className = "empty-state";
      const title = document.createElement("h2");
      title.textContent = t("detail.notFound");
      const back = document.createElement("a");
      back.href = "/";
      back.className = "btn";
      back.textContent = t("nav.backToList");
      box.append(title, back);
      main.appendChild(box);
      return;
    }
    if (disposed) return;
    document.title = `${detail.title} · ${appName()}`;

    let catalog: Catalog;
    let session: { authenticated: boolean; mustChangePassword: boolean };
    try {
      [catalog, session] = await Promise.all([
        loadCatalog(),
        authApi.session().catch(() => ({ authenticated: false, mustChangePassword: false })),
      ]);
    } catch {
      // The detail arrived but the catalog (category/status names) did not:
      // without it the page cannot render, so fail visibly instead of blank.
      if (!disposed) networkError();
      return;
    }
    if (disposed) return;
    const category = catalog.categories.find((c) => c.id === detail.categoryId);
    const status =
      detail.statusId !== null
        ? category?.statuses.find((s) => s.id === detail.statusId)
        : undefined;

    const nav = document.createElement("div");
    nav.className = "detail-nav";
    const back = document.createElement("a");
    back.href = "/";
    back.className = "back-link";
    back.appendChild(icon("arrow-left", "icon icon-sm"));
    back.appendChild(document.createTextNode(t("nav.backToList")));
    nav.appendChild(back);

    // Prev/next within the order the visitor last saw on the list; deep links
    // (no stored order, or an id outside it) fall back to newest-first. Filter
    // to ids still in the catalog so a taste deleted since the list was viewed
    // is skipped rather than linked to a not-found page.
    const validIds = new Set(catalog.tastes.map((x) => x.id));
    let order = readListOrder().filter((id) => validIds.has(id));
    if (!order.includes(detail.id)) {
      order = [...catalog.tastes]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((x) => x.id);
    }
    const index = order.indexOf(detail.id);
    const neighbors = document.createElement("div");
    neighbors.className = "detail-nav-arrows";
    const arrow = (targetId: string | undefined, iconName: string, label: string): void => {
      if (!targetId) return;
      const a = document.createElement("a");
      a.href = `/taste/${targetId}`;
      a.className = "icon-btn";
      a.setAttribute("aria-label", label);
      tip(a, label);
      a.appendChild(icon(iconName, "icon icon-sm"));
      neighbors.appendChild(a);
    };
    if (index !== -1) {
      arrow(order[index - 1], "arrow-left", t("detail.prev"));
      arrow(order[index + 1], "arrow-right", t("detail.next"));
    }
    if (neighbors.childElementCount) nav.appendChild(neighbors);
    main.appendChild(nav);

    // Keyboard companion of the prev/next arrows. Inert while a modal dialog
    // (lightbox, confirmation) is open: navigating under it would leave the
    // orphaned dialog on top of the next page.
    onKeyNav = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || index === -1) return;
      if (isTypingTarget(e.target) || document.querySelector("dialog[open]")) return;
      if (e.key === "ArrowLeft" && order[index - 1]) navigate(`/taste/${order[index - 1]}`);
      else if (e.key === "ArrowRight" && order[index + 1]) navigate(`/taste/${order[index + 1]}`);
    };
    document.addEventListener("keydown", onKeyNav);

    if (!detail.published) {
      const banner = document.createElement("p");
      banner.className = "chip chip-draft detail-draft";
      banner.textContent = t("card.draft");
      main.appendChild(banner);
    }

    const layout = document.createElement("div");
    layout.className = "detail-layout";

    if (detail.imageFile) {
      const figure = document.createElement("figure");
      figure.className = "detail-media";
      if (category) figure.style.setProperty("--cat-color", category.color);
      const img = document.createElement("img");
      img.src = displayUrl(detail.imageFile);
      // The optional image description doubles as alt text and native hover
      // tooltip (credits, context); without it the title is still announced.
      img.alt = detail.imageAlt ?? detail.title;
      if (detail.imageAlt) img.title = detail.imageAlt;
      img.decoding = "async";
      img.width = 1600;
      img.height = 1067;
      const zoom = document.createElement("button");
      zoom.type = "button";
      zoom.className = "media-zoom";
      // No tooltip: the zoom-in cursor already says it, and a bubble tracking
      // the whole image on hover would be intrusive.
      zoom.setAttribute("aria-label", t("detail.image.zoom"));
      zoom.appendChild(img);
      zoom.addEventListener("click", () => openLightbox(img.src, detail.imageAlt ?? detail.title));
      figure.appendChild(zoom);
      layout.appendChild(figure);
    }

    const head = document.createElement("div");
    head.className = "detail-head";

    const titleRow = document.createElement("div");
    titleRow.className = "detail-title-row";
    const h1 = document.createElement("h1");
    h1.className = "detail-title";
    h1.textContent = detail.title;
    titleRow.appendChild(h1);
    if (detail.favorite) {
      const heart = document.createElement("span");
      heart.className = "detail-heart";
      tip(heart, t("card.favorite"));
      heart.setAttribute("aria-label", t("card.favorite"));
      heart.appendChild(icon("heart-solid", "icon"));
      titleRow.appendChild(heart);
    }
    if (session.authenticated) {
      const edit = document.createElement("a");
      edit.href = `/admin/taste/${detail.id}/edit`;
      edit.className = "icon-btn";
      tip(edit, t("detail.edit"));
      edit.setAttribute("aria-label", t("detail.edit"));
      edit.appendChild(icon("pencil"));
      titleRow.appendChild(edit);
    }
    head.appendChild(titleRow);

    if (detail.rating) {
      const ratingRow = document.createElement("div");
      ratingRow.className = "detail-rating";
      ratingRow.appendChild(starDisplay(detail.rating, "md"));
      const label = document.createElement("span");
      label.className = "rating-label";
      label.textContent = t(`rating.${detail.rating}`);
      ratingRow.appendChild(label);
      head.appendChild(ratingRow);
    }

    const meta = document.createElement("div");
    meta.className = "detail-meta";
    if (category) {
      const badge = document.createElement("a");
      badge.href = `/?cat=${encodeURIComponent(category.slug)}`;
      badge.className = "cat-badge cat-badge-lg";
      badge.style.setProperty("--cat-color", category.color);
      badge.appendChild(icon(category.icon, "icon icon-sm"));
      badge.appendChild(document.createTextNode(category.name));
      meta.appendChild(badge);
    }
    if (status) {
      const pill = document.createElement("span");
      pill.className = "chip chip-status";
      pill.textContent = status.name;
      meta.appendChild(pill);
    }
    if (detail.refDate) {
      const date = document.createElement("span");
      date.className = "muted detail-date";
      date.textContent = formatPartialDate(detail.refDate);
      meta.appendChild(date);
    }
    head.appendChild(meta);

    const added = document.createElement("p");
    added.className = "muted detail-added";
    added.textContent = t("detail.addedOn", { date: formatDateTime(detail.createdAt) });
    head.appendChild(added);

    if (detail.tags.length) {
      const tagRow = document.createElement("div");
      tagRow.className = "card-chips";
      for (const tag of detail.tags) {
        const chip = document.createElement("a");
        chip.className = "chip chip-toggle";
        chip.href = `/?tags=${encodeURIComponent(tag)}${category ? `&cat=${encodeURIComponent(category.slug)}` : ""}`;
        chip.textContent = tag;
        tagRow.appendChild(chip);
      }
      head.appendChild(tagRow);
    }

    if (detail.description) {
      // Markdown, same pipeline as the review sections (spoilers included).
      const placeholder = document.createElement("div");
      placeholder.className = "detail-description";
      head.appendChild(placeholder);
      void renderMarkdown(detail.description).then((el) => {
        if (disposed) return;
        el.classList.add("detail-description");
        placeholder.replaceWith(el);
      });
    }

    layout.appendChild(head);
    main.appendChild(layout);

    // External review CTA replaces (or precedes) written sections.
    if (detail.externalReviewUrl) {
      const cta = document.createElement("a");
      cta.href = detail.externalReviewUrl;
      cta.target = "_blank";
      cta.rel = "noopener noreferrer";
      cta.className = "btn btn-primary external-review";
      cta.appendChild(document.createTextNode(t("detail.externalReview")));
      cta.appendChild(icon("arrow-top-right-on-square", "icon icon-sm"));
      main.appendChild(cta);
    }

    const writtenSections = detail.sections.filter((s) => s.text.trim() || s.subtitle);
    if (writtenSections.length) {
      const review = document.createElement("section");
      review.className = "detail-review";
      for (const section of writtenSections) {
        const block = document.createElement("div");
        block.className = "review-section";
        if (section.subtitle || section.rating) {
          const headRow = document.createElement("div");
          headRow.className = "review-section-head";
          if (section.subtitle) {
            const h2 = document.createElement("h2");
            h2.className = "detail-subhead";
            h2.textContent = section.subtitle;
            headRow.appendChild(h2);
          }
          if (section.rating) headRow.appendChild(starDisplay(section.rating, "sm"));
          block.appendChild(headRow);
        }
        if (section.text.trim()) {
          const placeholder = document.createElement("div");
          block.appendChild(placeholder);
          void renderMarkdown(section.text).then((el) => {
            if (!disposed) placeholder.replaceWith(el);
          });
        }
        review.appendChild(block);
      }
      main.appendChild(review);
    }

    if (detail.location) main.appendChild(geoLink(detail.location));

    if (detail.links.length) {
      const linksWrap = document.createElement("section");
      linksWrap.className = "detail-links";
      const h2 = document.createElement("h2");
      h2.className = "detail-subhead";
      h2.textContent = t("detail.links");
      linksWrap.appendChild(h2);
      const ul = document.createElement("ul");
      ul.className = "link-list";
      for (const link of detail.links) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = link.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.appendChild(document.createTextNode(link.label));
        a.appendChild(icon("arrow-top-right-on-square", "icon icon-sm"));
        li.appendChild(a);
        ul.appendChild(li);
      }
      linksWrap.appendChild(ul);
      main.appendChild(linksWrap);
    }

    // "See also": same-category tastes sharing the most tags, newest first
    // among equals. Computed from the already-cached catalog.
    const related = catalog.tastes
      .filter((x) => x.id !== detail.id && x.categoryId === detail.categoryId)
      .map((x) => ({ x, shared: x.tags.filter((tag) => detail.tags.includes(tag)).length }))
      .sort((a, b) => b.shared - a.shared || b.x.createdAt.localeCompare(a.x.createdAt))
      .slice(0, 4)
      .map((r) => r.x);
    if (related.length) {
      const relatedWrap = document.createElement("section");
      relatedWrap.className = "detail-related";
      const h2 = document.createElement("h2");
      h2.className = "detail-subhead";
      h2.textContent = t("detail.related");
      relatedWrap.appendChild(h2);
      const ctx = cardContext(catalog.categories);
      const grid = document.createElement("div");
      grid.className = "card-grid card-grid-related";
      for (const taste of related) grid.appendChild(tasteCard(taste, ctx));
      relatedWrap.appendChild(grid);
      main.appendChild(relatedWrap);
    }
  })();

  return () => {
    disposed = true;
    if (onKeyNav) document.removeEventListener("keydown", onKeyNav);
    document.title = appName();
  };
}
