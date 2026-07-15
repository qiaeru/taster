// SPDX-License-Identifier: MIT
// Add/edit form: title, category (drives the status options), star rating,
// tags, flexible date, image (client downscale, uploaded after save), GPS,
// review sections or an external review link, reference links, published and
// favorite toggles.

import type { Category, TasteDetail, TasteInput } from "@taster/shared";
import { adminApi, authApi, publicApi, api, ApiError, invalidateCatalog, displayUrl } from "../api.js";
import { renderHeader } from "../components/Header.js";
import { icon } from "../components/Icon.js";
import { starInput } from "../components/StarRating.js";
import { tagInput } from "../components/TagInput.js";
import { datePrecisionPicker } from "../components/DatePrecisionPicker.js";
import { sectionEditor } from "../components/SectionEditor.js";
import { toast } from "../components/Toaster.js";
import { t } from "../i18n/index.js";
import { resizeForUpload } from "../lib/imageResize.js";
import { navigate } from "../router.js";

function field(labelText: string, input: HTMLElement, hint?: string): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "field";
  const label = document.createElement("label");
  label.className = "field-label";
  label.textContent = labelText;
  if (
    input instanceof HTMLInputElement ||
    input instanceof HTMLSelectElement ||
    input instanceof HTMLTextAreaElement
  ) {
    const id = `f-${Math.random().toString(36).slice(2, 8)}`;
    input.id = id;
    label.htmlFor = id;
  }
  wrap.append(label, input);
  if (hint) {
    const p = document.createElement("p");
    p.className = "muted field-hint";
    p.textContent = hint;
    wrap.appendChild(p);
  }
  return wrap;
}

function checkbox(labelText: string, checked: boolean, hint?: string) {
  const wrap = document.createElement("div");
  wrap.className = "field field-checkbox";
  const label = document.createElement("label");
  label.className = "checkbox-label";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  label.append(input, document.createTextNode(labelText));
  wrap.appendChild(label);
  if (hint) {
    const p = document.createElement("p");
    p.className = "muted field-hint";
    p.textContent = hint;
    wrap.appendChild(p);
  }
  return { el: wrap, input };
}

export function renderTasteForm(
  root: HTMLElement,
  _params: URLSearchParams,
  segments: string[]
): void {
  const editId = segments[0] && segments[0] !== "new" ? segments[0] : null;

  root.appendChild(renderHeader());
  const main = document.createElement("main");
  main.className = "form-page";
  root.appendChild(main);

  void (async () => {
    const session = await authApi.session().catch(() => null);
    if (!session?.authenticated || session.mustChangePassword) {
      navigate("/admin");
      return;
    }

    const [categories, existingTags, detail] = await Promise.all([
      api.get<Category[]>("/api/categories"),
      publicApi.tags().catch(() => [] as { id: number; name: string }[]),
      editId ? publicApi.tasteDetail(editId).catch(() => null) : Promise.resolve(null),
    ]);
    if (editId && !detail) {
      const err = document.createElement("p");
      err.className = "error-box";
      err.textContent = t("detail.notFound");
      main.appendChild(err);
      return;
    }

    const h1 = document.createElement("h1");
    h1.className = "page-title";
    h1.textContent = editId ? t("form.editTitle") : t("form.newTitle");
    main.appendChild(h1);
    document.title = `${h1.textContent} · Taster`;

    const form = document.createElement("form");
    form.className = "taste-form";
    form.noValidate = true;
    main.appendChild(form);

    // Title
    const title = document.createElement("input");
    title.type = "text";
    title.className = "input";
    title.required = true;
    title.maxLength = 300;
    title.value = detail?.title ?? "";
    form.appendChild(field(t("form.title"), title));

    // Category + status (status options follow the category)
    const categorySel = document.createElement("select");
    categorySel.className = "select";
    for (const category of categories) {
      const opt = document.createElement("option");
      opt.value = String(category.id);
      opt.textContent = category.name;
      opt.selected = detail?.categoryId === category.id;
      categorySel.appendChild(opt);
    }
    form.appendChild(field(t("form.category"), categorySel));

    const statusSel = document.createElement("select");
    statusSel.className = "select";
    const fillStatuses = (): void => {
      const category = categories.find((c) => c.id === Number(categorySel.value));
      statusSel.innerHTML = "";
      const none = document.createElement("option");
      none.value = "";
      none.textContent = t("form.status.none");
      statusSel.appendChild(none);
      for (const status of category?.statuses ?? []) {
        const opt = document.createElement("option");
        opt.value = String(status.id);
        opt.textContent = status.name;
        opt.selected = detail?.statusId === status.id;
        statusSel.appendChild(opt);
      }
    };
    fillStatuses();
    categorySel.addEventListener("change", fillStatuses);
    form.appendChild(field(t("form.status"), statusSel));

    // Rating
    const rating = starInput(detail?.rating ?? null, t("form.rating"));
    form.appendChild(field(t("form.rating"), rating.el));

    // Tags
    const tags = tagInput(detail?.tags ?? [], existingTags.map((x) => x.name));
    form.appendChild(field(t("form.tags"), tags.el));

    // Date
    const date = datePrecisionPicker(detail?.refDate ?? null);
    form.appendChild(field(t("form.date"), date.el));

    // Image
    let imageBlob: { blob: Blob; filename: string } | null = null;
    let removeImage = false;
    const imageWrap = document.createElement("div");
    imageWrap.className = "image-field";
    const preview = document.createElement("div");
    preview.className = "image-preview";
    const previewImg = document.createElement("img");
    previewImg.alt = "";
    previewImg.hidden = true;
    preview.appendChild(previewImg);
    const previewEmpty = document.createElement("span");
    previewEmpty.className = "muted";
    previewEmpty.appendChild(icon("photo", "icon icon-xl"));
    preview.appendChild(previewEmpty);
    imageWrap.appendChild(preview);

    const paintPreview = (): void => {
      if (imageBlob) {
        previewImg.src = URL.createObjectURL(imageBlob.blob);
        previewImg.hidden = false;
        previewEmpty.hidden = true;
      } else if (detail?.imageFile && !removeImage) {
        previewImg.src = displayUrl(detail.imageFile);
        previewImg.hidden = false;
        previewEmpty.hidden = true;
      } else {
        previewImg.hidden = true;
        previewEmpty.hidden = false;
      }
      removeBtn.hidden = previewImg.hidden;
    };

    const imageActions = document.createElement("div");
    imageActions.className = "image-actions";
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/jpeg,image/png,image/webp";
    fileInput.className = "sr-only";
    fileInput.id = "image-file";
    const chooseBtn = document.createElement("label");
    chooseBtn.className = "btn";
    chooseBtn.htmlFor = "image-file";
    chooseBtn.textContent = detail?.imageFile ? t("form.image.replace") : t("form.image.choose");
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-danger";
    removeBtn.textContent = t("form.image.remove");
    removeBtn.addEventListener("click", () => {
      imageBlob = null;
      removeImage = true;
      fileInput.value = "";
      paintPreview();
    });
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      imageBlob = await resizeForUpload(file);
      removeImage = false;
      paintPreview();
    });
    imageActions.append(fileInput, chooseBtn, removeBtn);
    imageWrap.appendChild(imageActions);
    form.appendChild(field(t("form.image"), imageWrap, t("form.image.hint")));
    paintPreview();

    // GPS
    const geoRow = document.createElement("div");
    geoRow.className = "geo-inputs";
    const lat = document.createElement("input");
    lat.type = "number";
    lat.step = "any";
    lat.className = "input";
    lat.placeholder = t("form.location.lat");
    lat.setAttribute("aria-label", t("form.location.lat"));
    lat.value = detail?.location ? String(detail.location.lat) : "";
    const lng = document.createElement("input");
    lng.type = "number";
    lng.step = "any";
    lng.className = "input";
    lng.placeholder = t("form.location.lng");
    lng.setAttribute("aria-label", t("form.location.lng"));
    lng.value = detail?.location ? String(detail.location.lng) : "";
    geoRow.append(lat, lng);
    form.appendChild(field(t("form.location"), geoRow, t("form.location.hint")));

    // Review: sections or external link
    const reviewWrap = document.createElement("div");
    reviewWrap.className = "review-mode";
    const modeRow = document.createElement("div");
    modeRow.className = "view-switch review-mode-switch";
    const sectionsBtn = document.createElement("button");
    sectionsBtn.type = "button";
    sectionsBtn.className = "tab-btn";
    sectionsBtn.textContent = t("form.review.mode.sections");
    const externalBtn = document.createElement("button");
    externalBtn.type = "button";
    externalBtn.className = "tab-btn";
    externalBtn.textContent = t("form.review.mode.external");
    modeRow.append(sectionsBtn, externalBtn);
    reviewWrap.appendChild(modeRow);

    let externalMode = Boolean(detail?.externalReviewUrl);
    const sections = sectionEditor(detail?.sections ?? []);
    const externalUrl = document.createElement("input");
    externalUrl.type = "url";
    externalUrl.className = "input";
    externalUrl.placeholder = "https://…";
    externalUrl.setAttribute("aria-label", t("form.review.externalUrl"));
    externalUrl.value = detail?.externalReviewUrl ?? "";
    const externalField = field(t("form.review.externalUrl"), externalUrl);
    reviewWrap.append(sections.el, externalField);

    const paintMode = (): void => {
      sectionsBtn.dataset.active = String(!externalMode);
      externalBtn.dataset.active = String(externalMode);
      sections.el.hidden = externalMode;
      externalField.hidden = !externalMode;
    };
    sectionsBtn.addEventListener("click", () => {
      externalMode = false;
      paintMode();
    });
    externalBtn.addEventListener("click", () => {
      externalMode = true;
      paintMode();
    });
    paintMode();
    form.appendChild(field(t("form.review"), reviewWrap));

    // Reference links
    const links: { label: string; url: string }[] = detail?.links.map((l) => ({ ...l })) ?? [];
    const linksWrap = document.createElement("div");
    linksWrap.className = "links-editor";
    const linksList = document.createElement("div");
    linksList.className = "links-list";
    linksWrap.appendChild(linksList);
    const paintLinks = (): void => {
      linksList.innerHTML = "";
      links.forEach((link, index) => {
        const row = document.createElement("div");
        row.className = "link-row";
        const label = document.createElement("input");
        label.type = "text";
        label.className = "input";
        label.placeholder = t("form.links.label");
        label.setAttribute("aria-label", t("form.links.label"));
        label.value = link.label;
        label.addEventListener("input", () => (link.label = label.value));
        const url = document.createElement("input");
        url.type = "url";
        url.className = "input";
        url.placeholder = "https://…";
        url.setAttribute("aria-label", t("form.links.url"));
        url.value = link.url;
        url.addEventListener("input", () => (link.url = url.value));
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "icon-btn btn-danger";
        remove.title = t("form.links.remove");
        remove.setAttribute("aria-label", t("form.links.remove"));
        remove.appendChild(icon("trash", "icon icon-sm"));
        remove.addEventListener("click", () => {
          links.splice(index, 1);
          paintLinks();
        });
        row.append(label, url, remove);
        linksList.appendChild(row);
      });
    };
    paintLinks();
    const addLink = document.createElement("button");
    addLink.type = "button";
    addLink.className = "btn";
    addLink.appendChild(icon("plus", "icon icon-sm"));
    addLink.appendChild(document.createTextNode(t("form.links.add")));
    addLink.addEventListener("click", () => {
      links.push({ label: "", url: "" });
      paintLinks();
    });
    linksWrap.appendChild(addLink);
    form.appendChild(field(t("form.links"), linksWrap, t("form.links.hint")));

    // Published + favorite
    const published = checkbox(
      t("form.published"),
      detail?.published ?? true,
      t("form.published.hint")
    );
    const favorite = checkbox(t("form.favorite"), detail?.favorite ?? false);
    const togglesRow = document.createElement("div");
    togglesRow.className = "toggles-row";
    togglesRow.append(published.el, favorite.el);
    form.appendChild(togglesRow);

    // Error + actions
    const errorBox = document.createElement("p");
    errorBox.className = "error-box";
    errorBox.hidden = true;
    form.appendChild(errorBox);

    const actions = document.createElement("div");
    actions.className = "dialog-actions form-actions";
    const save = document.createElement("button");
    save.type = "submit";
    save.className = "btn btn-primary";
    save.textContent = t("form.save");
    const cancel = document.createElement("a");
    cancel.href = "/admin";
    cancel.className = "btn";
    cancel.textContent = t("form.cancel");
    actions.append(save, cancel);
    form.appendChild(actions);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorBox.hidden = true;

      if (!title.value.trim()) {
        errorBox.hidden = false;
        errorBox.textContent = t("form.title.required");
        title.focus();
        return;
      }
      const latValue = lat.value.trim();
      const lngValue = lng.value.trim();
      if ((latValue === "") !== (lngValue === "")) {
        errorBox.hidden = false;
        errorBox.textContent = t("form.location.invalid");
        return;
      }

      const input: TasteInput = {
        title: title.value.trim(),
        categoryId: Number(categorySel.value),
        rating: rating.get(),
        statusId: statusSel.value ? Number(statusSel.value) : null,
        tags: tags.get(),
        refDate: date.get(),
        location: latValue !== "" ? { lat: Number(latValue), lng: Number(lngValue) } : null,
        externalReviewUrl: externalMode && externalUrl.value.trim() ? externalUrl.value.trim() : null,
        sections: externalMode ? [] : sections.get(),
        links: links.filter((l) => l.label.trim() || l.url.trim()),
        published: published.input.checked,
        favorite: favorite.input.checked,
      };

      save.disabled = true;
      try {
        const saved: TasteDetail = editId
          ? await adminApi.updateTaste(editId, input)
          : await adminApi.createTaste(input);
        if (imageBlob) {
          try {
            await adminApi.uploadImage(saved.id, imageBlob.blob, imageBlob.filename);
          } catch {
            toast(t("form.image.error"), "error");
          }
        } else if (removeImage && detail?.imageFile) {
          await adminApi.deleteImage(saved.id).catch(() => undefined);
        }
        invalidateCatalog();
        toast(t("form.saved"), "success");
        navigate(`/taste/${saved.id}`);
      } catch (err) {
        save.disabled = false;
        errorBox.hidden = false;
        if (err instanceof ApiError) {
          if (err.code === "INVALID_URL") errorBox.textContent = t("form.error.INVALID_URL");
          else if (err.code === "INVALID_LOCATION")
            errorBox.textContent = t("form.location.invalid");
          else if (err.code === "TITLE_REQUIRED") errorBox.textContent = t("form.title.required");
          else errorBox.textContent = t("form.error.generic");
        } else {
          errorBox.textContent = t("error.network");
        }
      }
    });

    title.focus();
  })();
}
