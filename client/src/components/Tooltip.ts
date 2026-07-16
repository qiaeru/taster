// SPDX-License-Identifier: MIT
// Themed tooltips replacing native title attributes: the text lands in a
// data-tip attribute that components.css renders through a ::after bubble,
// shown on hover and on keyboard focus. Purely visual; callers keep their
// aria-label as the accessible name.

type TipPos = "top" | "bottom";
type TipAlign = "center" | "end";

export function tip(el: HTMLElement, text: string, pos: TipPos = "top", align: TipAlign = "center"): void {
  el.dataset.tip = text;
  if (pos !== "top") el.dataset.tipPos = pos;
  if (align !== "center") el.dataset.tipAlign = align;
}
