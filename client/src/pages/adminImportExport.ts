// SPDX-License-Identifier: MIT
// Import/export tab: two mirrored sections, one for tastes, one for
// categories, each with its own import button, export link and result box.

import { api, ApiError, invalidateCatalog } from "../api.js";
import { icon } from "../components/Icon.js";
import { toast } from "../components/Toaster.js";
import { t, locale$ } from "../i18n/index.js";

// Kept in sync with docs/json-import.md; statuses match the EN seed (the
// default) because the templates are a starting point the owner edits anyway.
const TEMPLATE = {
  app: "taster",
  version: 1,
  tastes: [
    {
      title: "Chrono Trigger",
      category: "video-games",
      rating: 5,
      status: "Finished",
      favorite: true,
      published: true,
      tags: ["JRPG", "SNES"],
      date: "1995-03",
      externalReviewUrl: null,
      sections: [
        {
          subtitle: "Story",
          rating: 5,
          text: "Some **Markdown**, with ||a hidden spoiler|| when needed.",
        },
      ],
      links: [{ label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Chrono_Trigger" }],
    },
  ],
};

const TEMPLATE_CATEGORIES = {
  app: "taster",
  version: 1,
  categories: [
    {
      slug: "board-games",
      name: "Board games",
      icon: "puzzle-piece",
      color: "#3b82f6",
      statuses: ["Played", "To play"],
    },
  ],
};

interface ImportOutcome {
  imported: number;
  updated: number;
  errors: { index: number; code: string }[];
}

/** File input + label button wired to an import endpoint and a result box. */
function importControl(
  id: string,
  label: string,
  endpoint: string,
  resultBox: HTMLElement
): HTMLElement[] {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "application/json,.json";
  fileInput.className = "sr-only";
  fileInput.id = id;
  const chooseBtn = document.createElement("label");
  chooseBtn.className = "btn btn-primary";
  chooseBtn.htmlFor = id;
  chooseBtn.appendChild(icon("document-arrow-up", "icon icon-sm"));
  chooseBtn.appendChild(document.createTextNode(label));

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    resultBox.hidden = true;
    let payload: unknown;
    try {
      // Exports start with a UTF-8 BOM (for Windows editors); strict
      // JSON.parse rejects it, so strip a leading one before parsing.
      payload = JSON.parse((await file.text()).replace(/^\uFEFF/, ""));
    } catch {
      toast(t("io.import.invalidFile"), "error");
      fileInput.value = "";
      return;
    }
    try {
      const result = await api.post<ImportOutcome>(endpoint, payload);
      invalidateCatalog();
      resultBox.hidden = false;
      resultBox.innerHTML = "";
      const summary = document.createElement("p");
      summary.className = result.errors.length ? "error-box" : "io-success";
      summary.textContent = t("io.import.result", {
        imported: result.imported,
        updated: result.updated,
        errors: result.errors.length,
      });
      resultBox.appendChild(summary);
      if (result.errors.length) {
        const ul = document.createElement("ul");
        ul.className = "io-errors muted";
        for (const err of result.errors) {
          const li = document.createElement("li");
          li.textContent = t("io.import.errorLine", { index: err.index + 1, code: err.code });
          ul.appendChild(li);
        }
        resultBox.appendChild(ul);
      }
    } catch (err) {
      toast(
        err instanceof ApiError && err.code === "INVALID_FILE"
          ? t("io.import.invalidFile")
          : t("error.generic"),
        "error"
      );
    }
    fileInput.value = "";
  });

  return [fileInput, chooseBtn];
}

/** Button that downloads an editable starter file. */
function templateButton(payload: unknown, baseName: string): HTMLElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn";
  btn.appendChild(icon("document-arrow-down", "icon icon-sm"));
  btn.appendChild(document.createTextNode(t("io.template")));
  btn.addEventListener("click", () => {
    // Same UTF-8 BOM as the server exports: keeps accents readable in
    // Windows editors that default to ANSI on BOM-less files.
    const blob = new Blob(["\uFEFF" + JSON.stringify(payload, null, 2) + "\n"], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${baseName}-${locale$.get()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  return btn;
}

export async function renderImportExportTab(body: HTMLElement): Promise<void> {
  body.innerHTML = "";

  // ---- tastes ----
  const tastesSection = document.createElement("section");
  tastesSection.className = "io-section";
  const tastesHead = document.createElement("h3");
  tastesHead.className = "detail-subhead";
  tastesHead.textContent = t("io.tastes");
  const tastesHint = document.createElement("p");
  tastesHint.className = "muted field-hint";
  tastesHint.textContent = t("io.tastes.hint");
  tastesSection.append(tastesHead, tastesHint);

  const tastesResult = document.createElement("div");
  tastesResult.className = "io-result";
  tastesResult.hidden = true;

  const tastesActions = document.createElement("div");
  tastesActions.className = "io-actions";
  tastesActions.append(
    ...importControl("import-tastes-file", t("io.tastes.import"), "/api/admin/import", tastesResult)
  );

  const exportBtn = document.createElement("a");
  exportBtn.className = "btn";
  exportBtn.href = "/api/admin/export";
  exportBtn.setAttribute("download", "taster-tastes.json");
  exportBtn.appendChild(icon("document-arrow-down", "icon icon-sm"));
  exportBtn.appendChild(document.createTextNode(t("io.tastes.export")));
  tastesActions.appendChild(exportBtn);

  tastesActions.appendChild(templateButton(TEMPLATE, "taster-tastes-template"));
  tastesSection.appendChild(tastesActions);

  const withImagesLabel = document.createElement("label");
  withImagesLabel.className = "checkbox-label";
  const withImages = document.createElement("input");
  withImages.type = "checkbox";
  withImagesLabel.append(withImages, document.createTextNode(t("io.export.withImages")));
  withImages.addEventListener("change", () => {
    exportBtn.href = withImages.checked ? "/api/admin/export?images=1" : "/api/admin/export";
  });
  tastesSection.appendChild(withImagesLabel);

  tastesSection.appendChild(tastesResult);
  body.appendChild(tastesSection);

  // ---- categories ----
  const catSection = document.createElement("section");
  catSection.className = "io-section";
  const catHead = document.createElement("h3");
  catHead.className = "detail-subhead";
  catHead.textContent = t("io.categories");
  const catHint = document.createElement("p");
  catHint.className = "muted field-hint";
  catHint.textContent = t("io.categories.hint");
  catSection.append(catHead, catHint);

  const catResult = document.createElement("div");
  catResult.className = "io-result";
  catResult.hidden = true;

  const catActions = document.createElement("div");
  catActions.className = "io-actions";
  catActions.append(
    ...importControl(
      "import-categories-file",
      t("io.categories.import"),
      "/api/admin/import/categories",
      catResult
    )
  );

  const catExportBtn = document.createElement("a");
  catExportBtn.className = "btn";
  catExportBtn.href = "/api/admin/export/categories";
  catExportBtn.setAttribute("download", "taster-categories.json");
  catExportBtn.appendChild(icon("document-arrow-down", "icon icon-sm"));
  catExportBtn.appendChild(document.createTextNode(t("io.categories.export")));
  catActions.appendChild(catExportBtn);
  catActions.appendChild(templateButton(TEMPLATE_CATEGORIES, "taster-categories-template"));
  catSection.appendChild(catActions);

  catSection.appendChild(catResult);
  body.appendChild(catSection);
}
