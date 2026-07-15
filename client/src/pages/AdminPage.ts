// SPDX-License-Identifier: MIT
// Admin dashboard. Fleshed out in the admin phase.

import { renderHeader } from "../components/Header.js";

export function renderAdmin(root: HTMLElement): void {
  root.appendChild(renderHeader());
  const main = document.createElement("main");
  main.textContent = "admin";
  root.appendChild(main);
}
