// SPDX-License-Identifier: MIT
// Brand logos come from the simple-icons package (simpleicons.org); the SVG
// path ships with the bundle, no external request ever.

import type { SimpleIcon } from "simple-icons";

const SVG_NS = "http://www.w3.org/2000/svg";

export function brandIcon(brand: SimpleIcon, className = "icon"): SVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", brand.path);
  svg.appendChild(path);
  return svg;
}
