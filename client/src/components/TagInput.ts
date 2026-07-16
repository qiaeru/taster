// SPDX-License-Identifier: MIT
// Tag input: chips + free text with suggestions from the existing tags.
// Enter or comma commits a chip, commas split a pasted "a, b, c" into one
// chip each, Backspace on an empty input removes the last one.

import { icon } from "./Icon.js";
import { t } from "../i18n/index.js";

export interface TagInputWidget {
  el: HTMLElement;
  get(): string[];
}

export function tagInput(initial: string[], suggestions: string[]): TagInputWidget {
  let tags = [...initial];

  const wrap = document.createElement("div");
  wrap.className = "tag-input";

  const chips = document.createElement("div");
  chips.className = "tag-input-chips";
  wrap.appendChild(chips);

  const input = document.createElement("input");
  input.type = "text";
  input.className = "input";
  input.placeholder = t("form.tags.placeholder");
  input.setAttribute("aria-label", t("form.tags"));

  const listId = `tag-suggestions-${Math.random().toString(36).slice(2, 8)}`;
  const datalist = document.createElement("datalist");
  datalist.id = listId;
  for (const suggestion of suggestions) {
    const opt = document.createElement("option");
    opt.value = suggestion;
    datalist.appendChild(opt);
  }
  input.setAttribute("list", listId);
  wrap.appendChild(input);
  wrap.appendChild(datalist);

  const paint = (): void => {
    chips.innerHTML = "";
    for (const tag of tags) {
      const chip = document.createElement("span");
      chip.className = "chip chip-status tag-chip";
      chip.textContent = tag;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "tag-chip-remove";
      remove.setAttribute("aria-label", t("form.tags.remove", { tag }));
      remove.appendChild(icon("x-mark", "icon icon-sm"));
      remove.addEventListener("click", () => {
        tags = tags.filter((x) => x !== tag);
        paint();
      });
      chip.appendChild(remove);
      chips.appendChild(chip);
    }
  };

  const commit = (): void => {
    for (const part of input.value.split(",")) {
      const value = part.trim();
      if (!value) continue;
      if (!tags.some((x) => x.toLowerCase() === value.toLowerCase())) tags.push(value);
    }
    input.value = "";
    paint();
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && input.value === "" && tags.length) {
      tags = tags.slice(0, -1);
      paint();
    }
  });
  // Picking a datalist suggestion fires "change" without a keydown.
  input.addEventListener("change", commit);
  input.addEventListener("blur", commit);

  paint();
  return { el: wrap, get: () => [...tags] };
}
