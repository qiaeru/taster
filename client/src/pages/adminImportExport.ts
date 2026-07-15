// SPDX-License-Identifier: MIT
// Import/export tab: JSON file import with per-item error reporting, full
// export (with or without embedded images) and a downloadable template.

import type { ImportResult } from "@taster/shared";
import { api, ApiError, invalidateCatalog } from "../api.js";
import { icon } from "../components/Icon.js";
import { toast } from "../components/Toaster.js";
import { t, locale$ } from "../i18n/index.js";

// Kept in sync with docs/json-import.md; localized statuses match the FR
// seed because the template is a starting point the owner edits anyway.
const TEMPLATE = {
  app: "taster",
  version: 1,
  tastes: [
    {
      title: "Chrono Trigger",
      category: "video-games",
      rating: 5,
      status: "Terminé",
      favorite: true,
      published: true,
      tags: ["JRPG", "SNES"],
      date: "1995-03",
      externalReviewUrl: null,
      sections: [
        {
          subtitle: "Scénario",
          rating: 5,
          text: "Du **Markdown**, avec ||un spoiler masqué|| si besoin.",
        },
      ],
      links: [{ label: "Wikipedia", url: "https://fr.wikipedia.org/wiki/Chrono_Trigger" }],
    },
  ],
};

export async function renderImportExportTab(body: HTMLElement): Promise<void> {
  body.innerHTML = "";

  // ---- import ----
  const importSection = document.createElement("section");
  importSection.className = "io-section";
  const importHead = document.createElement("h3");
  importHead.className = "detail-subhead";
  importHead.textContent = t("io.import");
  const importHint = document.createElement("p");
  importHint.className = "muted field-hint";
  importHint.textContent = t("io.import.hint");
  importSection.append(importHead, importHint);

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "application/json,.json";
  fileInput.className = "sr-only";
  fileInput.id = "import-file";
  const chooseBtn = document.createElement("label");
  chooseBtn.className = "btn btn-primary";
  chooseBtn.htmlFor = "import-file";
  chooseBtn.appendChild(icon("document-arrow-up", "icon icon-sm"));
  chooseBtn.appendChild(document.createTextNode(t("io.import.choose")));
  importSection.append(fileInput, chooseBtn);

  const resultBox = document.createElement("div");
  resultBox.className = "io-result";
  resultBox.hidden = true;
  importSection.appendChild(resultBox);

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    resultBox.hidden = true;
    let payload: unknown;
    try {
      payload = JSON.parse(await file.text());
    } catch {
      toast(t("io.import.invalidFile"), "error");
      fileInput.value = "";
      return;
    }
    try {
      const result = await api.post<ImportResult>("/api/admin/import", payload);
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

  body.appendChild(importSection);

  // ---- export ----
  const exportSection = document.createElement("section");
  exportSection.className = "io-section";
  const exportHead = document.createElement("h3");
  exportHead.className = "detail-subhead";
  exportHead.textContent = t("io.export");
  exportSection.appendChild(exportHead);

  const withImagesLabel = document.createElement("label");
  withImagesLabel.className = "checkbox-label";
  const withImages = document.createElement("input");
  withImages.type = "checkbox";
  withImagesLabel.append(withImages, document.createTextNode(t("io.export.withImages")));
  exportSection.appendChild(withImagesLabel);

  const exportBtn = document.createElement("a");
  exportBtn.className = "btn";
  exportBtn.href = "/api/admin/export";
  exportBtn.setAttribute("download", "taster-export.json");
  exportBtn.appendChild(icon("document-arrow-down", "icon icon-sm"));
  exportBtn.appendChild(document.createTextNode(t("io.export.all")));
  withImages.addEventListener("change", () => {
    exportBtn.href = withImages.checked ? "/api/admin/export?images=1" : "/api/admin/export";
  });
  exportSection.appendChild(exportBtn);

  const templateBtn = document.createElement("button");
  templateBtn.type = "button";
  templateBtn.className = "btn";
  templateBtn.appendChild(icon("document-arrow-down", "icon icon-sm"));
  templateBtn.appendChild(document.createTextNode(t("io.template")));
  templateBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(TEMPLATE, null, 2) + "\n"], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `taster-template-${locale$.get()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  exportSection.appendChild(templateBtn);

  body.appendChild(exportSection);
}
