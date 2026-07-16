// SPDX-License-Identifier: MIT
// The public list: category chips, contextual filters, instant search, three
// display modes (grid, compact rows, tier list) and a random pick. All
// filtering happens in memory over the cached catalog; the state mirrors
// into the query string so any view is shareable.

import type { Category, Rating, Status, TasteSummary } from "@taster/shared";
import { loadCatalog, type Catalog } from "../api.js";
import { renderHeader } from "../components/Header.js";
import { tasteCard, tasteRow, type CardContext } from "../components/TasteCard.js";
import { starDisplay } from "../components/StarRating.js";
import { icon } from "../components/Icon.js";
import { selectMenu } from "../components/Select.js";
import { tip } from "../components/Tooltip.js";
import { t } from "../i18n/index.js";
import { formatDateTime, formatPartialDate, searchFold } from "../lib/format.js";
import { rememberListOrder } from "../lib/listOrder.js";
import { navigate, replaceQuery } from "../router.js";

type SortKey = "recent" | "date" | "rating" | "title";
type ViewKey = "grid" | "compact" | "tiers";

interface ListState {
  q: string;
  cat: string | null; // category slug
  tags: string[];
  status: number | null;
  minRating: number; // "N stars and up" (stats "rated" tile); URL-only, no select
  rating: number | null; // exact rating, driven by the filter-bar select
  favorites: boolean;
  sort: SortKey;
  rev: boolean; // reversed sort direction
  view: ViewKey;
}

const VIEW_KEY = "taster:view";

// First cards load eagerly at high priority: over HTTP/1.1 a lazy grid drains
// ~6 thumbs at a time and the whole fold pops in as one late batch.
const EAGER_CARDS = 8;

function readState(params: URLSearchParams): ListState {
  const sort = params.get("sort") as SortKey | null;
  const view = (params.get("view") as ViewKey | null) ?? readSavedView();
  const exact = Number(params.get("r"));
  return {
    q: params.get("q") ?? "",
    cat: params.get("cat"),
    tags: (params.get("tags") ?? "").split(",").filter(Boolean),
    status: params.get("status") ? Number(params.get("status")) : null,
    minRating: params.get("min") ? Number(params.get("min")) : 0,
    rating: exact >= 1 && exact <= 5 ? exact : null,
    favorites: params.get("fav") === "1",
    sort: sort && ["recent", "date", "rating", "title"].includes(sort) ? sort : "recent",
    rev: params.get("rev") === "1",
    view: ["grid", "compact", "tiers"].includes(view ?? "") ? (view as ViewKey) : "grid",
  };
}

function readSavedView(): ViewKey | null {
  try {
    return localStorage.getItem(VIEW_KEY) as ViewKey | null;
  } catch {
    return null;
  }
}

function writeState(state: ListState): void {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.cat) params.set("cat", state.cat);
  if (state.tags.length) params.set("tags", state.tags.join(","));
  if (state.status !== null) params.set("status", String(state.status));
  if (state.minRating > 0) params.set("min", String(state.minRating));
  if (state.rating !== null) params.set("r", String(state.rating));
  if (state.favorites) params.set("fav", "1");
  if (state.sort !== "recent") params.set("sort", state.sort);
  if (state.rev) params.set("rev", "1");
  if (state.view !== "grid") params.set("view", state.view);
  replaceQuery(params);
  try {
    localStorage.setItem(VIEW_KEY, state.view);
  } catch {
    /* ignore */
  }
}

function sortTastes(list: TasteSummary[], sort: SortKey, rev = false): TasteSummary[] {
  const byTitle = (a: TasteSummary, b: TasteSummary) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  // Only the primary criterion flips; the title tiebreak stays A to Z and
  // undated entries stay last either way.
  const m = rev ? -1 : 1;
  const sorted = [...list];
  switch (sort) {
    case "title":
      sorted.sort((a, b) => m * byTitle(a, b));
      break;
    case "date":
      // Partial dates compare correctly as strings; undated entries go last.
      sorted.sort((a, b) => {
        if (a.refDate === null && b.refDate === null) return byTitle(a, b);
        if (a.refDate === null) return 1;
        if (b.refDate === null) return -1;
        return m * b.refDate.localeCompare(a.refDate) || byTitle(a, b);
      });
      break;
    case "rating":
      sorted.sort((a, b) => m * ((b.rating ?? 0) - (a.rating ?? 0)) || byTitle(a, b));
      break;
    default:
      sorted.sort((a, b) => m * b.createdAt.localeCompare(a.createdAt) || byTitle(a, b));
  }
  return sorted;
}

function applyFilters(catalog: Catalog, state: ListState): TasteSummary[] {
  const category = state.cat ? catalog.categories.find((c) => c.slug === state.cat) : null;
  const fold = searchFold(state.q.trim());
  return catalog.tastes.filter((taste) => {
    if (category && taste.categoryId !== category.id) return false;
    if (state.favorites && !taste.favorite) return false;
    if (state.minRating > 0 && (taste.rating ?? 0) < state.minRating) return false;
    if (state.rating !== null && taste.rating !== state.rating) return false;
    if (state.status !== null && taste.statusId !== state.status) return false;
    if (state.tags.length && !state.tags.every((tag) => taste.tags.includes(tag))) return false;
    if (fold) {
      const haystack = searchFold(taste.title + " " + taste.tags.join(" "));
      if (!haystack.includes(fold)) return false;
    }
    return true;
  });
}

export function renderList(root: HTMLElement, params: URLSearchParams): () => void {
  const state = readState(params);
  let catalog: Catalog | null = null;
  let disposed = false;
  let tagsExpanded = false;

  // "/" jumps to the search field, unless the visitor is already typing.
  const onSlashKey = (e: KeyboardEvent): void => {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target.isContentEditable
    )
      return;
    const search = main.querySelector<HTMLInputElement>(".search input");
    if (!search) return;
    e.preventDefault();
    search.focus();
  };
  document.addEventListener("keydown", onSlashKey);

  root.appendChild(renderHeader());
  const main = document.createElement("main");
  main.className = "list-page";
  root.appendChild(main);

  // Floating back-to-top button once the list has been scrolled a while.
  // Attached to root: main's content is wiped when the catalog arrives.
  const toTop = document.createElement("button");
  toTop.type = "button";
  toTop.className = "icon-btn to-top";
  toTop.hidden = true;
  toTop.setAttribute("aria-label", t("list.backToTop"));
  tip(toTop, t("list.backToTop"));
  toTop.appendChild(icon("arrow-up"));
  toTop.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  });
  root.appendChild(toTop);
  const onScroll = (): void => {
    toTop.hidden = window.scrollY < window.innerHeight * 1.5;
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Loading skeleton: ghost cards until the catalog arrives. The cards are
  // decorative (aria-hidden); a live status conveys the loading state to
  // assistive tech, which the previous "…" paragraph did implicitly.
  const loadingStatus = document.createElement("p");
  loadingStatus.className = "sr-only";
  loadingStatus.setAttribute("role", "status");
  loadingStatus.textContent = t("list.loading");
  main.appendChild(loadingStatus);
  const loading = document.createElement("div");
  loading.className = "card-grid";
  loading.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 8; i++) {
    const card = document.createElement("div");
    card.className = "skeleton-card";
    const media = document.createElement("div");
    media.className = "skeleton-block skeleton-media";
    const line = document.createElement("div");
    line.className = "skeleton-block skeleton-line";
    const short = document.createElement("div");
    short.className = "skeleton-block skeleton-line skeleton-line-short";
    card.append(media, line, short);
    loading.appendChild(card);
  }
  main.appendChild(loading);

  const boot = (force: boolean): void => {
    loadCatalog(force)
      .then((data) => {
        if (disposed) return;
        catalog = data;
        main.innerHTML = "";
        build();
      })
      .catch(() => {
        if (disposed) return;
        main.innerHTML = "";
        const err = document.createElement("p");
        err.className = "error-box";
        err.textContent = t("error.network");
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "btn";
        retry.textContent = t("action.retry");
        retry.addEventListener("click", () => boot(true));
        main.append(err, retry);
      });
  };
  boot(false);

  // ---- static skeleton (built once; results re-render on state change) ----
  let filterBar: HTMLElement;
  let results: HTMLElement;
  let countEl: HTMLElement;
  let chipsNav: HTMLElement;

  function build(): void {
    const toolbar = document.createElement("div");
    toolbar.className = "toolbar";

    // Search
    const searchWrap = document.createElement("div");
    searchWrap.className = "search";
    searchWrap.appendChild(icon("magnifying-glass", "icon icon-sm search-icon"));
    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = t("search.placeholder");
    search.setAttribute("aria-label", t("search.placeholder"));
    search.value = state.q;
    search.addEventListener("input", () => {
      state.q = search.value;
      // Debounced: update() rebuilds the whole result grid and mirrors the
      // state into the URL, and Safari throttles history.replaceState to
      // about 100 calls per 30 s; a per-keystroke call would pay both costs.
      window.clearTimeout(searchDebounce);
      searchDebounce = window.setTimeout(update, 150);
    });
    searchWrap.appendChild(search);
    toolbar.appendChild(searchWrap);

    // Sort
    const sortWrap = document.createElement("div");
    sortWrap.className = "sort-wrap";
    sortWrap.appendChild(icon("arrows-up-down", "icon icon-sm sort-icon"));
    // No tooltip here: it would sit over the open dropdown and hide options;
    // the arrows icon already marks this select as the sort control.
    const sortSel = selectMenu({
      options: (["recent", "date", "rating", "title"] as SortKey[]).map((key) => ({
        value: key,
        label: t(`sort.${key}`),
      })),
      value: state.sort,
      label: t("sort.label"),
      onChange: (value) => {
        state.sort = value as SortKey;
        // Each sort comes back in its natural direction.
        state.rev = false;
        update();
      },
    });
    sortWrap.appendChild(sortSel.el);

    const revBtn = document.createElement("button");
    revBtn.type = "button";
    revBtn.className = "icon-btn rev-btn";
    tip(revBtn, t("sort.reverse"), "bottom");
    revBtn.setAttribute("aria-label", t("sort.reverse"));
    revBtn.addEventListener("click", () => {
      state.rev = !state.rev;
      update();
    });
    sortWrap.appendChild(revBtn);
    toolbar.appendChild(sortWrap);

    // View switch
    const views = document.createElement("div");
    views.className = "view-switch";
    views.setAttribute("role", "group");
    views.setAttribute("aria-label", t("view.label"));
    const viewDefs: Array<{ key: ViewKey; iconName: string }> = [
      { key: "grid", iconName: "squares-2x2" },
      { key: "compact", iconName: "list-bullet" },
      { key: "tiers", iconName: "trophy" },
    ];
    for (const def of viewDefs) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "icon-btn view-btn";
      btn.dataset.view = def.key;
      tip(btn, t(`view.${def.key}`), "bottom");
      btn.setAttribute("aria-label", t(`view.${def.key}`));
      btn.appendChild(icon(def.iconName));
      btn.addEventListener("click", () => {
        state.view = def.key;
        update();
      });
      views.appendChild(btn);
    }
    toolbar.appendChild(views);

    // Random pick among current results
    const random = document.createElement("button");
    random.type = "button";
    random.className = "icon-btn";
    tip(random, t("filters.random"), "bottom", "end");
    random.setAttribute("aria-label", t("filters.random"));
    random.appendChild(icon("die"));
    random.addEventListener("click", () => {
      if (!catalog) return;
      const die = random.querySelector("svg");
      // Ignore a second click while the die is mid-roll: re-adding the class
      // does not restart the animation, so a second animationend listener
      // would fire the same event and navigate twice.
      if (die?.classList.contains("die-roll")) return;
      const pool = applyFilters(catalog, state);
      if (!pool.length) return;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      // Little die roll before revealing the pick.
      if (die && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        die.classList.add("die-roll");
        die.addEventListener("animationend", () => navigate(`/taste/${pick.id}`), { once: true });
      } else {
        navigate(`/taste/${pick.id}`);
      }
    });
    toolbar.appendChild(random);

    main.appendChild(toolbar);

    chipsNav = document.createElement("nav");
    chipsNav.className = "cat-chips";
    main.appendChild(chipsNav);

    filterBar = document.createElement("div");
    filterBar.className = "filter-bar";
    main.appendChild(filterBar);

    countEl = document.createElement("p");
    countEl.className = "muted result-count";
    main.appendChild(countEl);

    results = document.createElement("div");
    results.className = "results";
    main.appendChild(results);

    update();
  }

  function chipCount(n: number): HTMLElement {
    const count = document.createElement("span");
    count.className = "chip-count";
    count.textContent = String(n);
    return count;
  }

  // Per-category totals depend only on the catalog, not on filter state, so
  // compute them once instead of scanning all tastes per category per update.
  let categoryCounts: Map<number, number> | null = null;
  function getCategoryCounts(): Map<number, number> {
    if (!categoryCounts) {
      categoryCounts = new Map();
      for (const taste of catalog?.tastes ?? [])
        categoryCounts.set(taste.categoryId, (categoryCounts.get(taste.categoryId) ?? 0) + 1);
    }
    return categoryCounts;
  }

  function renderCategoryChips(): void {
    if (!catalog) return;
    chipsNav.innerHTML = "";
    const all = document.createElement("button");
    all.type = "button";
    all.className = "cat-chip";
    all.dataset.active = String(state.cat === null);
    all.textContent = t("filters.all");
    all.appendChild(chipCount(catalog.tastes.length));
    all.addEventListener("click", () => {
      state.cat = null;
      state.status = null;
      state.tags = [];
      update();
    });
    chipsNav.appendChild(all);
    for (const category of catalog.categories) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "cat-chip";
      chip.style.setProperty("--cat-color", category.color);
      chip.dataset.active = String(state.cat === category.slug);
      chip.appendChild(icon(category.icon, "icon icon-sm"));
      chip.appendChild(document.createTextNode(category.name));
      chip.appendChild(chipCount(getCategoryCounts().get(category.id) ?? 0));
      chip.addEventListener("click", () => {
        if (state.cat === category.slug) {
          state.cat = null;
        } else {
          state.cat = category.slug;
        }
        state.status = null;
        state.tags = [];
        update();
      });
      chipsNav.appendChild(chip);
    }
  }

  function renderFilterBar(): void {
    if (!catalog) return;
    filterBar.innerHTML = "";
    const category = state.cat ? catalog.categories.find((c) => c.slug === state.cat) : null;

    // Tag chips: tags actually present in the active scope.
    const scope = catalog.tastes.filter((x) => !category || x.categoryId === category.id);
    const tagCounts = new Map<string, number>();
    for (const taste of scope)
      for (const tag of taste.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    const allTags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name]) => name);
    const topTags = tagsExpanded ? allTags : allTags.slice(0, 12);
    // Selected tags always stay visible even when outside the top list.
    for (const selected of state.tags) if (!topTags.includes(selected)) topTags.unshift(selected);

    if (topTags.length) {
      const group = document.createElement("div");
      group.className = "tag-filter";
      group.setAttribute("role", "group");
      group.setAttribute("aria-label", t("filters.tags"));
      for (const tag of topTags) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip chip-toggle";
        chip.dataset.active = String(state.tags.includes(tag));
        chip.setAttribute("aria-pressed", String(state.tags.includes(tag)));
        chip.textContent = tag;
        chip.appendChild(chipCount(tagCounts.get(tag) ?? 0));
        chip.addEventListener("click", () => {
          state.tags = state.tags.includes(tag)
            ? state.tags.filter((x) => x !== tag)
            : [...state.tags, tag];
          update();
        });
        group.appendChild(chip);
      }
      if (allTags.length > 12) {
        const more = document.createElement("button");
        more.type = "button";
        more.className = "chip chip-toggle";
        more.textContent = tagsExpanded
          ? t("filters.lessTags")
          : t("filters.moreTags", { count: allTags.length - 12 });
        more.addEventListener("click", () => {
          tagsExpanded = !tagsExpanded;
          update();
        });
        group.appendChild(more);
      }
      filterBar.appendChild(group);
    }

    const controls = document.createElement("div");
    controls.className = "filter-controls";

    // Status select: only when exactly one category is active (statuses are
    // per-category).
    if (category && category.statuses.length) {
      const statusSel = selectMenu({
        options: [
          { value: "", label: t("filters.anyStatus") },
          ...category.statuses.map((status) => ({
            value: String(status.id),
            label: status.name,
          })),
        ],
        value: state.status !== null ? String(state.status) : "",
        label: t("filters.status"),
        small: true,
        onChange: (value) => {
          state.status = value ? Number(value) : null;
          update();
        },
      });
      controls.appendChild(statusSel.el);
    }

    // Rating: the select filters on an exact rating; the removable chip covers
    // the "N stars and up" links coming from the statistics page (?min=1).
    if (state.minRating > 0) {
      const min = document.createElement("button");
      min.type = "button";
      min.className = "chip chip-toggle";
      min.dataset.active = "true";
      min.setAttribute("aria-pressed", "true");
      min.setAttribute("aria-label", t("filters.removeRating"));
      tip(min, t("filters.removeRating"));
      min.appendChild(
        document.createTextNode(
          t("filters.minRatingChip", { stars: "★".repeat(state.minRating) })
        )
      );
      min.appendChild(icon("x-mark", "icon icon-sm"));
      min.addEventListener("click", () => {
        state.minRating = 0;
        update();
      });
      controls.appendChild(min);
    } else {
      const ratingSel = selectMenu({
        options: [
          { value: "", label: t("filters.anyRating") },
          ...[5, 4, 3, 2, 1].map((i) => ({
            value: String(i),
            label: `${"★".repeat(i)} ${t(`rating.${i}`)}`,
          })),
        ],
        value: state.rating !== null ? String(state.rating) : "",
        label: t("filters.rating"),
        small: true,
        onChange: (value) => {
          state.rating = value ? Number(value) : null;
          update();
        },
      });
      controls.appendChild(ratingSel.el);
    }

    // Favorites toggle
    const fav = document.createElement("button");
    fav.type = "button";
    fav.className = "chip chip-toggle chip-fav";
    fav.dataset.active = String(state.favorites);
    fav.setAttribute("aria-pressed", String(state.favorites));
    fav.appendChild(icon(state.favorites ? "heart-solid-20" : "heart", "icon icon-sm"));
    fav.appendChild(document.createTextNode(t("filters.favorites")));
    fav.addEventListener("click", () => {
      state.favorites = !state.favorites;
      update();
    });
    controls.appendChild(fav);

    // Clear filters (only when something is active)
    const hasFilters =
      state.q ||
      state.cat ||
      state.tags.length ||
      state.status !== null ||
      state.minRating > 0 ||
      state.rating !== null ||
      state.favorites;
    if (hasFilters) {
      const clear = document.createElement("button");
      clear.type = "button";
      clear.className = "chip chip-toggle";
      clear.appendChild(icon("x-mark", "icon icon-sm"));
      clear.appendChild(document.createTextNode(t("filters.clear")));
      clear.addEventListener("click", resetFilters);
      controls.appendChild(clear);
    }

    filterBar.appendChild(controls);
  }

  function resetFilters(): void {
    state.q = "";
    state.cat = null;
    state.tags = [];
    state.status = null;
    state.minRating = 0;
    state.rating = null;
    state.favorites = false;
    const search = main.querySelector<HTMLInputElement>(".search input");
    if (search) search.value = "";
    update();
  }

  function renderResults(): void {
    if (!catalog) return;
    results.innerHTML = "";

    const ctx: CardContext = {
      categories: new Map(catalog.categories.map((c) => [c.id, c])),
      statuses: new Map<number, Status>(
        catalog.categories.flatMap((c: Category) => c.statuses.map((s) => [s.id, s] as const))
      ),
    };

    const filtered = applyFilters(catalog, state);
    countEl.textContent = t(filtered.length === 1 ? "list.count.one" : "list.count.other", {
      count: filtered.length,
    });

    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      const title = document.createElement("h2");
      title.textContent = t("list.empty.title");
      const text = document.createElement("p");
      text.className = "muted";
      text.textContent = catalog.tastes.length ? t("list.empty.text") : t("list.empty.noData");
      empty.append(title, text);
      // Tastes exist but none matched: offer the reset right where the dead
      // end happens instead of sending the visitor back up to the filter bar.
      if (catalog.tastes.length) {
        const reset = document.createElement("button");
        reset.type = "button";
        reset.className = "btn empty-reset";
        reset.appendChild(icon("x-mark", "icon icon-sm"));
        reset.appendChild(document.createTextNode(t("filters.clear")));
        reset.addEventListener("click", resetFilters);
        empty.appendChild(reset);
      }
      results.appendChild(empty);
      return;
    }

    if (state.view === "tiers") {
      // Within a row the chosen sort applies; sorting by rating is meaningless
      // inside a same-rating row, so it falls back to alphabetical.
      const rowSort: SortKey = state.sort === "rating" ? "title" : state.sort;
      const groups: Array<{ rating: Rating | null; items: TasteSummary[] }> = [];
      for (const r of [5, 4, 3, 2, 1] as Rating[]) {
        groups.push({ rating: r, items: filtered.filter((x) => x.rating === r) });
      }
      groups.push({ rating: null, items: filtered.filter((x) => x.rating === null) });
      for (const group of groups) group.items = sortTastes(group.items, rowSort, state.rev);
      rememberListOrder(groups.flatMap((group) => group.items.map((x) => x.id)));

      let eagerLeft = EAGER_CARDS;
      for (const group of groups) {
        if (!group.items.length) continue;
        const section = document.createElement("section");
        section.className = "tier-row";
        const head = document.createElement("h2");
        head.className = "tier-head";
        if (group.rating) {
          head.appendChild(starDisplay(group.rating, "sm"));
          head.appendChild(document.createTextNode(t(`rating.${group.rating}`)));
        } else {
          head.textContent = t("tier.unrated");
        }
        const count = document.createElement("span");
        count.className = "muted tier-count";
        count.textContent = String(group.items.length);
        head.appendChild(count);
        section.appendChild(head);

        const grid = document.createElement("div");
        grid.className = "card-grid card-grid-tier";
        for (const taste of group.items) {
          grid.appendChild(tasteCard(taste, ctx, eagerLeft-- > 0));
        }
        section.appendChild(grid);
        results.appendChild(section);
      }
      return;
    }

    const sorted = sortTastes(filtered, state.sort, state.rev);
    rememberListOrder(sorted.map((x) => x.id));
    if (state.view === "compact") {
      // Show the date driving the active sort, so the order stays legible;
      // title and rating sorts read on their own.
      if (state.sort === "recent") ctx.rowDate = (x) => formatDateTime(x.createdAt);
      else if (state.sort === "date")
        ctx.rowDate = (x) => (x.refDate ? formatPartialDate(x.refDate) : null);
      const listEl = document.createElement("div");
      listEl.className = "row-list";
      for (const taste of sorted) listEl.appendChild(tasteRow(taste, ctx));
      results.appendChild(listEl);
    } else {
      const grid = document.createElement("div");
      grid.className = "card-grid";
      sorted.forEach((taste, i) => grid.appendChild(tasteCard(taste, ctx, i < EAGER_CARDS)));
      results.appendChild(grid);
    }
  }

  let searchDebounce = 0;

  function update(): void {
    writeState(state);
    renderCategoryChips();
    renderFilterBar();
    renderResults();
    main
      .querySelectorAll<HTMLButtonElement>(".view-btn")
      .forEach((b) => (b.dataset.active = String(b.dataset.view === state.view)));
    const revBtn = main.querySelector<HTMLButtonElement>(".rev-btn");
    if (revBtn) {
      revBtn.dataset.active = String(state.rev);
      revBtn.setAttribute("aria-pressed", String(state.rev));
      revBtn.innerHTML = "";
      // The icon shows the effective direction of the primary criterion:
      // title sorts A to Z by nature, the others newest/best first.
      const descending = state.sort === "title" ? state.rev : !state.rev;
      revBtn.appendChild(icon(descending ? "bars-arrow-down" : "bars-arrow-up"));
    }
  }

  return () => {
    disposed = true;
    // A pending debounced update() would otherwise fire after navigation and
    // rewrite the next page's URL through replaceQuery.
    window.clearTimeout(searchDebounce);
    document.removeEventListener("keydown", onSlashKey);
    window.removeEventListener("scroll", onScroll);
  };
}
