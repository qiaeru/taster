// SPDX-License-Identifier: MIT
// Taste add/edit form. Fleshed out in the admin phase.

import { renderHeader } from "../components/Header.js";

export function renderTasteForm(
  root: HTMLElement,
  _params: URLSearchParams,
  segments: string[]
): void {
  root.appendChild(renderHeader());
  const main = document.createElement("main");
  main.textContent = `taste form: ${segments[0] ?? "new"}`;
  root.appendChild(main);
}
