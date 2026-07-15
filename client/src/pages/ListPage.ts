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
import { t } from "../i18n/index.js";
import { searchFold } from "../lib/format.js";
import { navigate, replaceQuery } from "../router.js";

type SortKey = "recent" | "date" | "rating" | "title";
type ViewKey = "grid" | "compact" | "tiers";

interface ListState {
  q: string;
  cat: string | null; // category slug
  tags: string[];
  status: number | null;
  minRating: number;
  favorites: boolean;
  sort: SortKey;
  view: ViewKey;
}

const VIEW_KEY = "taster:view";

function readState(params: URLSearchParams): ListState {
  const sort = params.get("sort") as SortKey | null;
  const view = (params.get("view") as ViewKey | null) ?? readSavedView();
  return {
    q: params.get("q") ?? "",
    cat: params.get("cat"),
    tags: (params.get("tags") ?? "").split(",").filter(Boolean),
    status: params.get("status") ? Number(params.get("status")) : null,
    minRating: params.get("min") ? Number(params.get("min")) : 0,
    favorites: params.get("fav") === "1",
    sort: sort && ["recent", "date", "rating", "title"].includes(sort) ? sort : "recent",
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
  if (state.favorites) params.set("fav", "1");
  if (state.sort !== "recent") params.set("sort", state.sort);
  if (state.view !== "grid") params.set("view", state.view);
  replaceQuery(params);
  try {
    localStorage.setItem(VIEW_KEY, state.view);
  } catch {
    /* ignore */
  }
}

function sortTastes(list: TasteSummary[], sort: SortKey): TasteSummary[] {
  const byTitle = (a: TasteSummary, b: TasteSummary) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  const sorted = [...list];
  switch (sort) {
    case "title":
      sorted.sort(byTitle);
      break;
    case "date":
      // Partial dates compare correctly as strings; undated entries go last.
      sorted.sort((a, b) => {
        if (a.refDate === null && b.refDate === null) return byTitle(a, b);
        if (a.refDate === null) return 1;
        if (b.refDate === null) return -1;
        return b.refDate.localeCompare(a.refDate) || byTitle(a, b);
      });
      break;
    case "rating":
      sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || byTitle(a, b));
      break;
    default:
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || byTitle(a, b));
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

  root.appendChild(renderHeader());
  const main = document.createElement("main");
  main.className = "list-page";
  root.appendChild(main);

  const loading = document.createElement("p");
  loading.className = "muted loading";
  loading.textContent = "…";
  main.appendChild(loading);

  loadCatalog()
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
      retry.addEventListener("click", () => {
        loadCatalog(true).then((data) => {
          catalog = data;
          main.innerHTML = "";
          build();
        });
      });
      main.append(err, retry);
    });

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
      update();
    });
    searchWrap.appendChild(search);
    toolbar.appendChild(searchWrap);

    // Sort
    const sortSel = document.createElement("select");
    sortSel.className = "select";
    sortSel.setAttribute("aria-label", t("sort.label"));
    for (const key of ["recent", "date", "rating", "title"] as SortKey[]) {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = t(`sort.${key}`);
      opt.selected = state.sort === key;
      sortSel.appendChild(opt);
    }
    sortSel.addEventListener("change", () => {
      state.sort = sortSel.value as SortKey;
      update();
    });
    toolbar.appendChild(sortSel);

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
      btn.title = t(`view.${def.key}`);
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
    random.title = t("filters.random");
    random.setAttribute("aria-label", t("filters.random"));
    random.appendChild(icon("sparkles"));
    random.addEventListener("click", () => {
      if (!catalog) return;
      const pool = applyFilters(catalog, state);
      if (!pool.length) return;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      navigate(`/taste/${pick.id}`);
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

  function renderCategoryChips(): void {
    if (!catalog) return;
    chipsNav.innerHTML = "";
    const all = document.createElement("button");
    all.type = "button";
    all.className = "cat-chip";
    all.dataset.active = String(state.cat === null);
    all.textContent = t("filters.all");
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
    const topTags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 12)
      .map(([name]) => name);
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
        chip.addEventListener("click", () => {
          state.tags = state.tags.includes(tag)
            ? state.tags.filter((x) => x !== tag)
            : [...state.tags, tag];
          update();
        });
        group.appendChild(chip);
      }
      filterBar.appendChild(group);
    }

    const controls = document.createElement("div");
    controls.className = "filter-controls";

    // Status select: only when exactly one category is active (statuses are
    // per-category).
    if (category && category.statuses.length) {
      const statusSel = document.createElement("select");
      statusSel.className = "select select-sm";
      statusSel.setAttribute("aria-label", t("filters.status"));
      const any = document.createElement("option");
      any.value = "";
      any.textContent = t("filters.anyStatus");
      statusSel.appendChild(any);
      for (const status of category.statuses) {
        const opt = document.createElement("option");
        opt.value = String(status.id);
        opt.textContent = status.name;
        opt.selected = state.status === status.id;
        statusSel.appendChild(opt);
      }
      statusSel.addEventListener("change", () => {
        state.status = statusSel.value ? Number(statusSel.value) : null;
        update();
      });
      controls.appendChild(statusSel);
    }

    // Minimum rating
    const minSel = document.createElement("select");
    minSel.className = "select select-sm";
    minSel.setAttribute("aria-label", t("filters.minRating"));
    const anyRating = document.createElement("option");
    anyRating.value = "0";
    anyRating.textContent = t("filters.anyRating");
    minSel.appendChild(anyRating);
    for (let i = 5; i >= 1; i--) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = `${"★".repeat(i)} ${t(`rating.${i}`)}`;
      opt.selected = state.minRating === i;
      minSel.appendChild(opt);
    }
    minSel.addEventListener("change", () => {
      state.minRating = Number(minSel.value);
      update();
    });
    controls.appendChild(minSel);

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
      state.favorites;
    if (hasFilters) {
      const clear = document.createElement("button");
      clear.type = "button";
      clear.className = "chip chip-toggle";
      clear.appendChild(icon("x-mark", "icon icon-sm"));
      clear.appendChild(document.createTextNode(t("filters.clear")));
      clear.addEventListener("click", () => {
        state.q = "";
        state.cat = null;
        state.tags = [];
        state.status = null;
        state.minRating = 0;
        state.favorites = false;
        const search = main.querySelector<HTMLInputElement>(".search input");
        if (search) search.value = "";
        update();
      });
      controls.appendChild(clear);
    }

    filterBar.appendChild(controls);
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
        for (const taste of sortTastes(group.items, rowSort)) {
          grid.appendChild(tasteCard(taste, ctx));
        }
        section.appendChild(grid);
        results.appendChild(section);
      }
      return;
    }

    const sorted = sortTastes(filtered, state.sort);
    if (state.view === "compact") {
      const listEl = document.createElement("div");
      listEl.className = "row-list";
      for (const taste of sorted) listEl.appendChild(tasteRow(taste, ctx));
      results.appendChild(listEl);
    } else {
      const grid = document.createElement("div");
      grid.className = "card-grid";
      for (const taste of sorted) grid.appendChild(tasteCard(taste, ctx));
      results.appendChild(grid);
    }
  }

  function update(): void {
    writeState(state);
    renderCategoryChips();
    renderFilterBar();
    renderResults();
    main
      .querySelectorAll<HTMLButtonElement>(".view-btn")
      .forEach((b) => (b.dataset.active = String(b.dataset.view === state.view)));
  }

  return () => {
    disposed = true;
  };
}
