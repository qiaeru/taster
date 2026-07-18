// SPDX-License-Identifier: MIT
// Decorative cloud of floating icons behind the admin login. A single random
// depth value per icon drives its size, blur, speed and opacity together so
// the parallax reads as actual distance instead of visual noise; the cursor
// gently pushes nearby icons away.

import { loadCatalog } from "../api.js";
import { icon } from "./Icon.js";

// Shown when the catalog has no categories yet or fails to load.
const FALLBACK_ICONS = [
  "film",
  "tv",
  "book-open",
  "musical-note",
  "puzzle-piece",
  "cake",
  "camera",
  "trophy",
  "rocket-launch",
  "paint-brush",
  "globe-alt",
  "sparkles",
];

export function floatingBackground(count = 20): { el: HTMLElement; dispose: () => void } {
  const wrap = document.createElement("div");
  wrap.className = "floating-bg";
  wrap.setAttribute("aria-hidden", "true");

  const items: HTMLElement[] = [];

  const mount = (sources: Array<{ icon: string; color?: string }>): void => {
    if (!wrap.isConnected) return; // the page was left before the catalog arrived
    for (let i = 0; i < count; i++) {
      const source = sources[i % sources.length];
      const item = document.createElement("span");
      item.className = "floating-icon";
      const depth = Math.random();
      const size = Math.round(110 - depth * 65);
      item.style.left = `${(Math.random() * 100).toFixed(1)}%`;
      item.style.top = `${(Math.random() * 100).toFixed(1)}%`;
      const duration = 14 + depth * 20;
      item.style.animationDuration = `${duration.toFixed(1)}s`;
      // Negative delay: every icon starts mid-cycle instead of all in sync.
      item.style.animationDelay = `${(-Math.random() * duration).toFixed(1)}s`;
      item.style.setProperty("--drift", `${(Math.random() * 40 - 20).toFixed(1)}px`);
      item.style.setProperty("--rotate", `${(Math.random() * 30 - 15).toFixed(1)}deg`);
      item.style.setProperty("--blur", `${(depth * 3).toFixed(2)}px`);
      item.style.setProperty("--base-opacity", (0.4 - depth * 0.28).toFixed(2));
      if (source.color) item.style.setProperty("--float-color", source.color);
      // Closer icons paint over farther ones when they cross paths.
      item.style.zIndex = String(Math.round((1 - depth) * 10));
      const svg = icon(source.icon, "floating-icon-svg");
      svg.style.width = `${size}px`;
      svg.style.height = `${size}px`;
      item.appendChild(svg);
      wrap.appendChild(item);
      items.push(item);
    }
  };

  // The instance's own category icons and colors personalize the cloud; the
  // catalog is usually already cached from a visit to the public list.
  loadCatalog()
    .then((catalog) => catalog.categories.map((c) => ({ icon: c.icon, color: c.color })))
    .catch(() => [] as Array<{ icon: string; color?: string }>)
    .then((sources) =>
      mount(sources.length ? sources : FALLBACK_ICONS.map((name) => ({ icon: name })))
    );

  // Cursor repulsion: icons within reach slide away from the pointer. The
  // rAF gate coalesces mousemove bursts into one measurement per frame.
  const REPEL_RADIUS = 180;
  const REPEL_MAX = 32;
  let rafId = 0;
  let mx = 0;
  let my = 0;
  const apply = (): void => {
    rafId = 0;
    for (const el of items) {
      const rect = el.getBoundingClientRect();
      const dx = rect.left + rect.width / 2 - mx;
      const dy = rect.top + rect.height / 2 - my;
      const dist = Math.hypot(dx, dy);
      if (dist < REPEL_RADIUS && dist > 0.1) {
        const force = (1 - dist / REPEL_RADIUS) * REPEL_MAX;
        el.style.setProperty("--repel-x", `${((dx / dist) * force).toFixed(1)}px`);
        el.style.setProperty("--repel-y", `${((dy / dist) * force).toFixed(1)}px`);
      } else {
        el.style.setProperty("--repel-x", "0px");
        el.style.setProperty("--repel-y", "0px");
      }
    }
  };
  const onMove = (e: MouseEvent): void => {
    mx = e.clientX;
    my = e.clientY;
    if (!rafId) rafId = requestAnimationFrame(apply);
  };
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.addEventListener("mousemove", onMove);
  }

  return {
    el: wrap,
    dispose: () => {
      window.removeEventListener("mousemove", onMove);
      if (rafId) cancelAnimationFrame(rafId);
    },
  };
}
