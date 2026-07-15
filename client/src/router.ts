// SPDX-License-Identifier: MIT
// History-API router (real URLs, no hash): the server answers every non-API
// GET with index.html, so deep links and OpenGraph previews work. Routes load
// on demand to keep the initial bundle lean (marked/dompurify only download
// on pages that render Markdown).

type Renderer = (
  root: HTMLElement,
  params: URLSearchParams,
  segments: string[]
) => void | (() => void);
type RouteLoader = () => Promise<Renderer>;

interface Route {
  // Path pattern segments; ":x" matches any single segment.
  pattern: string[];
  load: RouteLoader;
}

const routes: Route[] = [
  { pattern: [], load: () => import("./pages/ListPage.js").then((m) => m.renderList) },
  {
    pattern: ["taste", ":id"],
    load: () => import("./pages/DetailPage.js").then((m) => m.renderDetail),
  },
  { pattern: ["stats"], load: () => import("./pages/StatsPage.js").then((m) => m.renderStats) },
  { pattern: ["admin"], load: () => import("./pages/AdminPage.js").then((m) => m.renderAdmin) },
  {
    pattern: ["admin", "taste", "new"],
    load: () => import("./pages/TasteFormPage.js").then((m) => m.renderTasteForm),
  },
  {
    pattern: ["admin", "taste", ":id", "edit"],
    load: () => import("./pages/TasteFormPage.js").then((m) => m.renderTasteForm),
  },
];

let currentTeardown: (() => void) | void;
// Lets render() drop stale dynamic-import resolutions when the user
// navigates again before the previous load finishes.
let renderToken = 0;

function matchRoute(segments: string[]): { route: Route; params: string[] } | null {
  for (const route of routes) {
    if (route.pattern.length !== segments.length) continue;
    const params: string[] = [];
    let ok = true;
    for (let i = 0; i < route.pattern.length; i++) {
      if (route.pattern[i].startsWith(":")) params.push(decodeURIComponent(segments[i]));
      else if (route.pattern[i] !== segments[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { route, params };
  }
  return null;
}

async function render(): Promise<void> {
  const myToken = ++renderToken;
  if (typeof currentTeardown === "function") currentTeardown();
  currentTeardown = undefined;

  const segments = location.pathname.split("/").filter(Boolean);
  const matched = matchRoute(segments) ?? { route: routes[0], params: [] };
  const params = new URLSearchParams(location.search);
  document.body.dataset.route = "/" + matched.route.pattern.join("/");

  let renderFn: Renderer;
  try {
    renderFn = await matched.route.load();
  } catch (err) {
    console.error("Failed to load route module", err);
    return;
  }
  if (myToken !== renderToken) return;

  const root = document.getElementById("app")!;
  root.innerHTML = "";
  currentTeardown = renderFn(root, params, matched.params) ?? undefined;

  // Move focus to the new page's <main> so keyboard users land in the new
  // view instead of a stale element.
  const main = root.querySelector<HTMLElement>("main");
  if (main) {
    main.id = "main-content";
    main.setAttribute("tabindex", "-1");
    main.focus({ preventScroll: true });
  }
}

export function navigate(path: string, params?: Record<string, string>): void {
  const q = params && Object.keys(params).length ? "?" + new URLSearchParams(params).toString() : "";
  history.pushState(null, "", `${path}${q}`);
  void render();
}

// Update the query string of the current path without a page re-render
// (the list page owns its own updates; the URL only mirrors the state).
export function replaceQuery(params: URLSearchParams): void {
  const q = params.size ? "?" + params.toString() : "";
  history.replaceState(null, "", location.pathname + q);
}

export function startRouter(): void {
  window.addEventListener("popstate", () => void render());
  // Intercept internal link clicks so <a href="/taste/x"> stays a real link
  // (middle-click, copy address) but navigates client-side on plain click.
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return;
    const anchor = (e.target as HTMLElement).closest("a");
    if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
    const href = anchor.getAttribute("href");
    if (!href || !href.startsWith("/") || href.startsWith("//")) return;
    e.preventDefault();
    history.pushState(null, "", href);
    void render();
  });
  void render();
}

export function rerender(): void {
  void render();
}
