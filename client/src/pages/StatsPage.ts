// SPDX-License-Identifier: MIT
// Public statistics page. Fleshed out in the detail phase.

import { renderHeader } from "../components/Header.js";

export function renderStats(root: HTMLElement): void {
  root.appendChild(renderHeader());
  const main = document.createElement("main");
  main.textContent = "stats";
  root.appendChild(main);
}
