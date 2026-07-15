// SPDX-License-Identifier: MIT
// Taste detail page. Fleshed out in the detail phase.

import { renderHeader } from "../components/Header.js";

export function renderDetail(root: HTMLElement, _params: URLSearchParams, segments: string[]): void {
  root.appendChild(renderHeader());
  const main = document.createElement("main");
  main.textContent = `detail: ${segments[0] ?? ""}`;
  root.appendChild(main);
}
