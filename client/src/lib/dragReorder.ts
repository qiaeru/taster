// SPDX-License-Identifier: MIT
// Shared HTML5 drag-and-drop reorder for editor lists. Each row receives a
// grab handle; dropping onto another row calls onMove(from, to) and the list
// repaints itself. Indices are read from the DOM at drop time, so the caller
// never has to re-attach after a local move. The arrow buttons stay alongside:
// HTML5 drag ignores touch screens and keyboards.

import { icon } from "../components/Icon.js";
import { tip } from "../components/Tooltip.js";
import { t } from "../i18n/index.js";

export interface DragReorder {
  /** Builds the grab handle and wires the row; call once per painted row. */
  attach(row: HTMLElement): HTMLElement;
}

/**
 * One instance per list. Attached rows are marked with data-drag-row, and
 * indices count only marked rows, so a stray non-row child in the container
 * (empty-state note, header) cannot shift the drop targets.
 */
export function dragReorder(
  container: () => HTMLElement,
  onMove: (from: number, to: number) => void
): DragReorder {
  let dragged: HTMLElement | null = null;

  return {
    attach(row) {
      row.dataset.dragRow = "true";
      const handle = document.createElement("button");
      handle.type = "button";
      handle.className = "icon-btn drag-handle";
      // Mouse-only affordance: keyboard and assistive tech keep the arrows.
      handle.tabIndex = -1;
      handle.setAttribute("aria-hidden", "true");
      tip(handle, t("form.drag"));
      handle.draggable = true;
      handle.appendChild(icon("grip", "icon icon-sm"));

      handle.addEventListener("dragstart", (e) => {
        dragged = row;
        row.dataset.dragging = "true";
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move";
          // Required by Firefox to start a drag at all.
          e.dataTransfer.setData("text/plain", "");
          e.dataTransfer.setDragImage(row, 20, 20);
        }
      });
      handle.addEventListener("dragend", () => {
        delete row.dataset.dragging;
        dragged = null;
      });

      row.addEventListener("dragover", (e) => {
        if (!dragged || dragged === row) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        row.dataset.dropTarget = "true";
      });
      row.addEventListener("dragleave", () => {
        delete row.dataset.dropTarget;
      });
      row.addEventListener("drop", (e) => {
        if (!dragged || dragged === row) return;
        e.preventDefault();
        delete row.dataset.dropTarget;
        const rows = [...container().children].filter(
          (el) => (el as HTMLElement).dataset.dragRow
        );
        const from = rows.indexOf(dragged);
        const to = rows.indexOf(row);
        dragged = null;
        if (from !== -1 && to !== -1) onMove(from, to);
      });

      return handle;
    },
  };
}

/** Standard onMove: moves an array item from one index to another. */
export function moveItem<T>(list: T[], from: number, to: number): void {
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
}
