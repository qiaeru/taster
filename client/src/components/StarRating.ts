// SPDX-License-Identifier: MIT
// Star rating. Display mode renders 5 Heroicons stars (solid = filled,
// outline = empty). Input mode is a native radiogroup styled as stars, so
// keyboard and screen-reader semantics come for free, plus a clear button
// since the rating is optional.

import type { Rating } from "@taster/shared";
import { icon } from "./Icon.js";
import { t } from "../i18n/index.js";

export function starDisplay(rating: Rating | null, size: "sm" | "md" = "md"): HTMLElement {
  const wrap = document.createElement("span");
  wrap.className = `stars stars-${size}`;
  wrap.setAttribute("role", "img");
  if (rating) {
    wrap.setAttribute(
      "aria-label",
      t("rating.aria", { rating, label: t(`rating.${rating}`) })
    );
    wrap.title = t(`rating.${rating}`);
  } else {
    wrap.setAttribute("aria-label", t("rating.none"));
  }
  for (let i = 1; i <= 5; i++) {
    const cls = `star ${rating && i <= rating ? "star-filled" : "star-empty"}`;
    wrap.appendChild(icon(rating && i <= rating ? "star-solid-20" : "star", cls));
  }
  return wrap;
}

export interface StarInput {
  el: HTMLElement;
  get(): Rating | null;
  set(value: Rating | null): void;
}

let starInputSeq = 0;

export function starInput(initial: Rating | null, label: string): StarInput {
  const name = `star-input-${++starInputSeq}`;
  let value: Rating | null = initial;

  const wrap = document.createElement("div");
  wrap.className = "star-input";
  const group = document.createElement("div");
  group.className = "star-input-group";
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-label", label);
  wrap.appendChild(group);

  const inputs: HTMLInputElement[] = [];

  const paint = (): void => {
    inputs.forEach((input, idx) => {
      const rating = (idx + 1) as Rating;
      input.checked = value === rating;
      const lab = input.nextElementSibling as HTMLElement;
      lab.innerHTML = "";
      lab.appendChild(icon(value !== null && rating <= value ? "star-solid" : "star", "star"));
      lab.classList.toggle("star-filled", value !== null && rating <= value);
    });
    clearBtn.hidden = value === null;
  };

  for (let i = 1; i <= 5; i++) {
    const rating = i as Rating;
    const id = `${name}-${i}`;
    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.id = id;
    input.value = String(i);
    input.className = "sr-only star-radio";
    input.addEventListener("change", () => {
      value = rating;
      paint();
    });
    const lab = document.createElement("label");
    lab.htmlFor = id;
    lab.className = "star-label";
    lab.title = t(`rating.${rating}`);
    lab.setAttribute("aria-label", `${i}/5 (${t(`rating.${rating}`)})`);
    group.appendChild(input);
    group.appendChild(lab);
    inputs.push(input);
  }

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "star-clear";
  clearBtn.textContent = t("form.rating.clear");
  clearBtn.addEventListener("click", () => {
    value = null;
    paint();
  });
  wrap.appendChild(clearBtn);

  paint();
  return {
    el: wrap,
    get: () => value,
    set: (next) => {
      value = next;
      paint();
    },
  };
}
