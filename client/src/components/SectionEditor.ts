// SPDX-License-Identifier: MIT
// Repeatable review sections: subtitle, optional sub-rating, Markdown body
// with a live preview toggle, reorder and remove. One untitled section by
// default = a simple review.

import type { ReviewSection } from "@taster/shared";
import { icon } from "./Icon.js";
import { starInput, type StarInput } from "./StarRating.js";
import { t } from "../i18n/index.js";
import { renderMarkdown } from "../lib/markdown.js";

interface SectionBlock {
  subtitle: string;
  rating: StarInput | null;
  ratingValue: ReviewSection["rating"];
  text: string;
}

export interface SectionEditorWidget {
  el: HTMLElement;
  get(): ReviewSection[];
}

export function sectionEditor(initial: ReviewSection[]): SectionEditorWidget {
  const blocks: SectionBlock[] = (
    initial.length ? initial : [{ subtitle: null, rating: null, text: "" }]
  ).map((section) => ({
    subtitle: section.subtitle ?? "",
    rating: null,
    ratingValue: section.rating,
    text: section.text,
  }));

  const wrap = document.createElement("div");
  wrap.className = "section-editor";
  const list = document.createElement("div");
  list.className = "section-list";
  wrap.appendChild(list);

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn";
  addBtn.appendChild(icon("plus", "icon icon-sm"));
  addBtn.appendChild(document.createTextNode(t("form.section.add")));
  addBtn.addEventListener("click", () => {
    blocks.push({ subtitle: "", rating: null, ratingValue: null, text: "" });
    paint();
  });
  wrap.appendChild(addBtn);

  function paint(): void {
    list.innerHTML = "";
    blocks.forEach((block, index) => {
      const card = document.createElement("div");
      card.className = "section-block";

      const head = document.createElement("div");
      head.className = "section-block-head";

      const subtitle = document.createElement("input");
      subtitle.type = "text";
      subtitle.className = "input section-subtitle";
      subtitle.placeholder = t("form.section.subtitle");
      subtitle.setAttribute("aria-label", t("form.section.subtitle"));
      subtitle.value = block.subtitle;
      subtitle.addEventListener("input", () => (block.subtitle = subtitle.value));
      head.appendChild(subtitle);

      const tools = document.createElement("div");
      tools.className = "section-tools";
      const mkTool = (name: string, label: string, onClick: () => void, disabled = false) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "icon-btn";
        btn.title = label;
        btn.setAttribute("aria-label", label);
        btn.disabled = disabled;
        btn.appendChild(icon(name, "icon icon-sm"));
        btn.addEventListener("click", onClick);
        return btn;
      };
      tools.appendChild(
        mkTool("arrow-up", t("form.section.moveUp"), () => {
          [blocks[index - 1], blocks[index]] = [blocks[index], blocks[index - 1]];
          paint();
        }, index === 0)
      );
      tools.appendChild(
        mkTool("arrow-down", t("form.section.moveDown"), () => {
          [blocks[index], blocks[index + 1]] = [blocks[index + 1], blocks[index]];
          paint();
        }, index === blocks.length - 1)
      );
      tools.appendChild(
        mkTool("trash", t("form.section.remove"), () => {
          blocks.splice(index, 1);
          if (!blocks.length) blocks.push({ subtitle: "", rating: null, ratingValue: null, text: "" });
          paint();
        })
      );
      head.appendChild(tools);
      card.appendChild(head);

      const ratingRow = document.createElement("div");
      ratingRow.className = "section-rating";
      block.rating = starInput(block.ratingValue ?? null, t("form.section.rating"));
      ratingRow.appendChild(block.rating.el);
      card.appendChild(ratingRow);

      const textarea = document.createElement("textarea");
      textarea.className = "textarea";
      textarea.placeholder = t("form.section.text");
      textarea.setAttribute("aria-label", t("form.section.text"));
      textarea.value = block.text;
      textarea.addEventListener("input", () => (block.text = textarea.value));
      card.appendChild(textarea);

      const previewBtn = document.createElement("button");
      previewBtn.type = "button";
      previewBtn.className = "btn preview-toggle";
      previewBtn.appendChild(icon("eye", "icon icon-sm"));
      previewBtn.appendChild(document.createTextNode(t("form.section.preview")));
      const previewBox = document.createElement("div");
      previewBox.className = "preview-box";
      previewBox.hidden = true;
      previewBtn.addEventListener("click", async () => {
        if (previewBox.hidden) {
          previewBox.innerHTML = "";
          previewBox.appendChild(await renderMarkdown(block.text));
          previewBox.hidden = false;
        } else {
          previewBox.hidden = true;
        }
      });
      card.appendChild(previewBtn);
      card.appendChild(previewBox);

      list.appendChild(card);
    });
  }

  paint();
  return {
    el: wrap,
    get: () =>
      blocks
        .map((block) => ({
          subtitle: block.subtitle.trim() || null,
          rating: block.rating?.get() ?? null,
          text: block.text,
        }))
        .filter((section) => section.subtitle || section.rating || section.text.trim()),
  };
}
