// SPDX-License-Identifier: MIT
// History-API router (real URLs, no hash): the server answers every non-API
// GET with index.html, so deep links and OpenGraph previews work. Routes load
// on demand to keep the initial bundle lean (marked/dompurify only download
// on pages that render Markdown).

import { renderFooter } from "./components/Footer.js";

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
// Set while we programmatically move the history cursor back to a guarded
// entry, so the resulting popstate is swallowed instead of re-handled.
let restoringHistory = false;

// Monotonic position of the current entry within our session history. Each
// entry is stamped with its index (alongside the scroll offset), so the
// unsaved-changes veto knows how far the cursor moved (Back, Forward, or a
// multi-entry jump) and can step it back by exactly that amount.
let currentIndex = 0;

// A page with unsaved state (the taste form) can veto client-side navigation;
// it registers a guard on mount and clears it in its teardown.
let navGuard: (() => Promise<boolean> | boolean) | null = null;

export function setNavGuard(guard: (() => Promise<boolean> | boolean) | null): void {
  navGuard = guard;
}

async function allowLeave(): Promise<boolean> {
  return navGuard ? await navGuard() : true;
}

// Manual scroll restoration: each history entry remembers its offset when the
// visitor navigates away, so Back lands where they left a long list.
function saveScroll(): void {
  history.replaceState({ scroll: window.scrollY, idx: currentIndex }, "", location.href);
}

function restoreScroll(y: number): void {
  // The target page fetches its data after mounting; wait (a bounded number
  // of frames) until the document is tall enough to honor the offset.
  let tries = 0;
  const attempt = (): void => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max >= y || tries >= 30) {
      window.scrollTo(0, y);
      return;
    }
    tries++;
    requestAnimationFrame(attempt);
  };
  attempt();
}

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

  const swap = (): void => {
    const root = document.getElementById("app")!;
    root.innerHTML = "";
    currentTeardown = renderFn(root, params, matched.params) ?? undefined;
    root.appendChild(renderFooter());

    // Move focus to the new page's <main> so keyboard users land in the new
    // view instead of a stale element.
    const main = root.querySelector<HTMLElement>("main");
    if (main) {
      main.id = "main-content";
      main.setAttribute("tabindex", "-1");
      main.focus({ preventScroll: true });
    }
  };
  // Soft cross-fade between pages where the browser supports it (a CSS rule
  // disables the animation under prefers-reduced-motion). Await the DOM swap
  // so callers (scroll restoration) measure the new page, not the old one.
  if (document.startViewTransition) await document.startViewTransition(swap).updateCallbackDone;
  else swap();
}

// Shared client-side navigation: honor the unsaved-changes guard, remember the
// current scroll offset on the entry we leave, then push and render.
async function go(href: string): Promise<void> {
  if (!(await allowLeave())) return;
  saveScroll();
  history.pushState({ idx: ++currentIndex }, "", href);
  await render();
}

export function navigate(path: string, params?: Record<string, string>): void {
  const q = params && Object.keys(params).length ? "?" + new URLSearchParams(params).toString() : "";
  void go(`${path}${q}`);
}

// Update the query string of the current path without a page re-render
// (the list page owns its own updates; the URL only mirrors the state).
export function replaceQuery(params: URLSearchParams): void {
  // `params.toString()` instead of `params.size`: `size` only exists from
  // Safari 17 / Chrome 113, and older engines would always strip the query.
  const q = params.toString();
  // Keep the existing state: replacing it with null would wipe the entry's
  // scroll offset and history index.
  history.replaceState(history.state, "", location.pathname + (q ? "?" + q : ""));
}

export function startRouter(): void {
  history.scrollRestoration = "manual";
  // Persist the scroll offset onto the current entry before the page is hidden
  // or reloaded, so a reload (F5) lands where the visitor left off.
  window.addEventListener("pagehide", saveScroll);
  window.addEventListener("popstate", () => {
    void (async () => {
      if (restoringHistory) {
        restoringHistory = false;
        return;
      }
      const state = history.state as { scroll?: number; idx?: number } | null;
      if (!(await allowLeave())) {
        // Vetoed: the browser already moved, so step the cursor back to the
        // guarded entry by the exact distance it jumped (Back, Forward, or a
        // multi-entry jump from the history menu). Unlike re-pushing a URL,
        // this keeps that entry's saved scroll state and forward history.
        restoringHistory = true;
        history.go(typeof state?.idx === "number" ? currentIndex - state.idx : 1);
        return;
      }
      currentIndex = state?.idx ?? 0;
      await render();
      restoreScroll(state?.scroll ?? 0);
    })();
  });
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
    void go(href);
  });
  void (async () => {
    // Reload restore: an entry revisited after pagehide carries its offset
    // and its history index.
    const state = history.state as { scroll?: number; idx?: number } | null;
    currentIndex = state?.idx ?? 0;
    await render();
    if (state?.scroll) restoreScroll(state.scroll);
  })();
}

// Force a re-render of the current route (e.g. after a locale change). Honors
// the unsaved-changes guard so it cannot silently discard a dirty form.
export function rerender(): void {
  void (async () => {
    if (await allowLeave()) await render();
  })();
}
