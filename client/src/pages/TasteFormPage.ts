// SPDX-License-Identifier: MIT
// Add/edit form: title, category (drives the status options), star rating,
// tags, flexible date, image (client downscale, uploaded after save), GPS,
// review sections or an external review link, reference links, published and
// favorite toggles.

import type { Category, ImageFocus, ReviewSection, TasteDetail, TasteInput } from "@taster/shared";
import { adminApi, authApi, publicApi, api, ApiError, invalidateCatalog, displayUrl } from "../api.js";
import { renderHeader } from "../components/Header.js";
import { icon } from "../components/Icon.js";
import { selectMenu } from "../components/Select.js";
import { tip } from "../components/Tooltip.js";
import { starInput } from "../components/StarRating.js";
import { tagInput } from "../components/TagInput.js";
import { datePrecisionPicker } from "../components/DatePrecisionPicker.js";
import { sectionEditor } from "../components/SectionEditor.js";
import { toast } from "../components/Toaster.js";
import { confirmDialog } from "../components/ConfirmDialog.js";
import { t } from "../i18n/index.js";
import { resizeForUpload } from "../lib/imageResize.js";
import { navigate, setNavGuard } from "../router.js";

// Unsaved work is autosaved locally every couple of seconds and restored the
// next time the same form opens (per taste; "new" has its own slot). Images
// are not part of the draft: a Blob does not survive localStorage.
const DRAFT_PREFIX = "taster:draft:";

interface FormDraft {
  title: string;
  categoryId: string;
  rating: TasteInput["rating"];
  statusId: string;
  tags: string[];
  refDate: string | null;
  lat: string;
  lng: string;
  externalMode: boolean;
  externalUrl: string;
  sections: ReviewSection[];
  links: { label: string; url: string }[];
  imageFocus: ImageFocus | null;
  published: boolean;
  favorite: boolean;
  savedAt: string;
}

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
  } else {
    // Custom control (selectMenu): a <button> is not labelable via `for`, so
    // associate it for assistive tech with aria-labelledby and focus it when
    // the visible label is clicked, restoring the native <label> behavior.
    const toggle = input.querySelector<HTMLButtonElement>(".select-toggle");
    if (toggle) {
      const id = `f-${Math.random().toString(36).slice(2, 8)}`;
      label.id = id;
      toggle.setAttribute("aria-labelledby", id);
      label.classList.add("field-label-clickable");
      label.addEventListener("click", () => toggle.focus());
    }
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
): () => void {
  const editId = segments[0] && segments[0] !== "new" ? segments[0] : null;
  let cleanup: (() => void) | null = null;
  // The form loads its data asynchronously; the router may tear the page down
  // before that resolves. `disposed` lets the late setup remove itself.
  let disposed = false;

  root.appendChild(renderHeader());
  const main = document.createElement("main");
  main.className = "form-page";
  root.appendChild(main);

  const boot = async (): Promise<void> => {
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
    if (disposed) return;
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

    const draftKey = DRAFT_PREFIX + (editId ?? "new");
    const draft = ((): FormDraft | null => {
      try {
        const raw = localStorage.getItem(draftKey);
        if (!raw) return null;
        const d = JSON.parse(raw) as FormDraft;
        return typeof d?.title === "string" && Array.isArray(d.tags) && Array.isArray(d.links)
          ? d
          : null;
      } catch {
        return null;
      }
    })();
    const dropDraft = (): void => {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
    };
    if (draft) {
      const notice = document.createElement("div");
      notice.className = "draft-notice";
      const text = document.createElement("span");
      text.textContent = t("form.draft.restored");
      const discard = document.createElement("button");
      discard.type = "button";
      discard.className = "btn";
      discard.textContent = t("form.draft.discard");
      discard.addEventListener("click", () => {
        dropDraft();
        cleanup?.();
        start();
      });
      notice.append(text, discard);
      main.appendChild(notice);
    }

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
    title.value = draft?.title ?? detail?.title ?? "";
    form.appendChild(field(t("form.title"), title));

    // Category + status (status options follow the category)
    const categorySel = selectMenu({
      options: categories.map((category) => ({
        value: String(category.id),
        label: category.name,
      })),
      value:
        draft && categories.some((c) => String(c.id) === draft.categoryId)
          ? draft.categoryId
          : String(detail?.categoryId ?? categories[0]?.id ?? ""),
      label: t("form.category"),
      onChange: () => fillStatuses(),
    });
    form.appendChild(field(t("form.category"), categorySel.el));

    const statusSel = selectMenu({ options: [], value: "", label: t("form.status") });
    const fillStatuses = (): void => {
      const category = categories.find((c) => c.id === Number(categorySel.get()));
      const statuses = category?.statuses ?? [];
      const wanted = draft ? draft.statusId : detail?.statusId != null ? String(detail.statusId) : "";
      statusSel.setOptions(
        [
          { value: "", label: t("form.status.none") },
          ...statuses.map((status) => ({ value: String(status.id), label: status.name })),
        ],
        statuses.some((s) => String(s.id) === wanted) ? wanted : ""
      );
    };
    fillStatuses();
    form.appendChild(field(t("form.status"), statusSel.el));

    // Rating
    const rating = starInput(
      draft ? draft.rating ?? null : detail?.rating ?? null,
      t("form.rating")
    );
    form.appendChild(field(t("form.rating"), rating.el));

    // Tags
    const tags = tagInput(draft?.tags ?? detail?.tags ?? [], existingTags.map((x) => x.name));
    form.appendChild(field(t("form.tags"), tags.el, t("form.tags.hint")));

    // Date
    const date = datePrecisionPicker(draft ? draft.refDate : detail?.refDate ?? null);
    form.appendChild(field(t("form.date"), date.el));

    // Image
    let imageBlob: { blob: Blob; filename: string } | null = null;
    let removeImage = false;
    let imageFocus: ImageFocus | null = draft ? draft.imageFocus ?? null : detail?.imageFocus ?? null;
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
    const focusMarker = document.createElement("span");
    focusMarker.className = "focus-marker";
    focusMarker.hidden = true;
    preview.appendChild(focusMarker);
    imageWrap.appendChild(preview);

    // The preview uses object-fit: contain, so the visible image occupies a
    // centered content box inside the <img> element; both the click mapping
    // and the marker position have to go through that box.
    const contentBox = (): { left: number; top: number; w: number; h: number } | null => {
      if (previewImg.hidden || !previewImg.naturalWidth || !previewImg.naturalHeight) return null;
      const scale = Math.min(
        previewImg.clientWidth / previewImg.naturalWidth,
        previewImg.clientHeight / previewImg.naturalHeight
      );
      const w = previewImg.naturalWidth * scale;
      const h = previewImg.naturalHeight * scale;
      return {
        left: previewImg.offsetLeft + (previewImg.clientWidth - w) / 2,
        top: previewImg.offsetTop + (previewImg.clientHeight - h) / 2,
        w,
        h,
      };
    };
    const paintMarker = (): void => {
      const box = contentBox();
      if (!imageFocus || !box) {
        focusMarker.hidden = true;
        return;
      }
      focusMarker.hidden = false;
      focusMarker.style.left = `${box.left + imageFocus.x * box.w}px`;
      focusMarker.style.top = `${box.top + imageFocus.y * box.h}px`;
    };
    previewImg.addEventListener("load", paintMarker);
    preview.addEventListener("click", (e) => {
      const box = contentBox();
      if (!box) return;
      const rect = preview.getBoundingClientRect();
      const x = (e.clientX - rect.left - box.left) / box.w;
      const y = (e.clientY - rect.top - box.top) / box.h;
      if (x < 0 || x > 1 || y < 0 || y > 1) return; // letterbox area
      imageFocus = { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
      paintMarker();
    });

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
      paintMarker();
    };

    const imageActions = document.createElement("div");
    imageActions.className = "image-actions";
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/jpeg,image/png,image/webp,image/avif,image/gif";
    fileInput.className = "sr-only";
    fileInput.id = "image-file";
    const chooseBtn = document.createElement("label");
    chooseBtn.className = "btn";
    chooseBtn.htmlFor = "image-file";
    chooseBtn.appendChild(icon("photo", "icon icon-sm"));
    chooseBtn.appendChild(
      document.createTextNode(
        detail?.imageFile ? t("form.image.replace") : t("form.image.choose")
      )
    );
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-danger";
    removeBtn.appendChild(icon("trash", "icon icon-sm"));
    removeBtn.appendChild(document.createTextNode(t("form.image.remove")));
    removeBtn.addEventListener("click", () => {
      imageBlob = null;
      removeImage = true;
      imageFocus = null;
      fileInput.value = "";
      paintPreview();
    });
    const acceptFile = async (file: File): Promise<void> => {
      imageBlob = await resizeForUpload(file);
      removeImage = false;
      // A new picture invalidates the old picture's focal point.
      imageFocus = null;
      paintPreview();
    };
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (file) void acceptFile(file);
    });
    // Drop an image onto the preview, or paste one from anywhere on the page.
    preview.addEventListener("dragover", (e) => {
      e.preventDefault();
      preview.dataset.drop = "true";
    });
    preview.addEventListener("dragleave", () => {
      delete preview.dataset.drop;
    });
    preview.addEventListener("drop", (e) => {
      e.preventDefault();
      delete preview.dataset.drop;
      const file = e.dataTransfer?.files?.[0];
      if (file?.type.startsWith("image/")) void acceptFile(file);
    });
    const onPaste = (e: ClipboardEvent): void => {
      const file = e.clipboardData?.files?.[0];
      if (file?.type.startsWith("image/")) {
        e.preventDefault();
        void acceptFile(file);
      }
    };
    document.addEventListener("paste", onPaste);
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
    lat.value = draft ? draft.lat : detail?.location ? String(detail.location.lat) : "";
    const lng = document.createElement("input");
    lng.type = "number";
    lng.step = "any";
    lng.className = "input";
    lng.placeholder = t("form.location.lng");
    lng.setAttribute("aria-label", t("form.location.lng"));
    lng.value = draft ? draft.lng : detail?.location ? String(detail.location.lng) : "";
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

    let externalMode = draft ? draft.externalMode : Boolean(detail?.externalReviewUrl);
    const sections = sectionEditor(draft ? draft.sections : detail?.sections ?? []);
    const externalUrl = document.createElement("input");
    externalUrl.type = "url";
    externalUrl.className = "input";
    externalUrl.placeholder = "https://…";
    externalUrl.setAttribute("aria-label", t("form.review.externalUrl"));
    externalUrl.value = draft ? draft.externalUrl : detail?.externalReviewUrl ?? "";
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
    const links: { label: string; url: string }[] = (
      draft ? draft.links : detail?.links ?? []
    ).map((l) => ({ ...l }));
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
        // Saving persists the array order as the links' sort_order.
        const mkTool = (name: string, text: string, onClick: () => void, disabled = false) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "icon-btn";
          tip(btn, text);
          btn.setAttribute("aria-label", text);
          btn.disabled = disabled;
          btn.appendChild(icon(name, "icon icon-sm"));
          btn.addEventListener("click", onClick);
          return btn;
        };
        const up = mkTool("arrow-up", t("form.links.moveUp"), () => {
          [links[index - 1], links[index]] = [links[index], links[index - 1]];
          paintLinks();
        }, index === 0);
        const down = mkTool("arrow-down", t("form.links.moveDown"), () => {
          [links[index], links[index + 1]] = [links[index + 1], links[index]];
          paintLinks();
        }, index === links.length - 1);
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "icon-btn btn-danger";
        tip(remove, t("form.links.remove"));
        remove.setAttribute("aria-label", t("form.links.remove"));
        remove.appendChild(icon("trash", "icon icon-sm"));
        remove.addEventListener("click", () => {
          links.splice(index, 1);
          paintLinks();
        });
        row.append(label, url, up, down, remove);
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
      draft ? draft.published : detail?.published ?? true,
      t("form.published.hint")
    );
    const favorite = checkbox(t("form.favorite"), draft ? draft.favorite : detail?.favorite ?? false);
    const togglesRow = document.createElement("div");
    togglesRow.className = "toggles-row";
    togglesRow.append(published.el, favorite.el);
    form.appendChild(togglesRow);

    // Error + actions
    const errorBox = document.createElement("p");
    errorBox.className = "error-box";
    errorBox.hidden = true;
    form.appendChild(errorBox);

    // Unsaved-changes guard: compare a serialized snapshot of the form state
    // instead of tracking every widget's events.
    const snapshot = (): string =>
      JSON.stringify([
        title.value,
        categorySel.get(),
        rating.get(),
        statusSel.get(),
        tags.get(),
        date.get(),
        lat.value,
        lng.value,
        externalMode,
        externalUrl.value,
        sections.get(),
        links,
        imageFocus,
        published.input.checked,
        favorite.input.checked,
        imageBlob !== null,
        removeImage,
      ]);
    const initialState = snapshot();
    let saved = false;
    const isDirty = (): boolean => !saved && snapshot() !== initialState;

    // Draft autosave: persist the field values whenever they changed since
    // the last tick, so a crash or closed tab never loses a review.
    const collectDraft = (): FormDraft => ({
      title: title.value,
      categoryId: categorySel.get(),
      rating: rating.get(),
      statusId: statusSel.get(),
      tags: tags.get(),
      refDate: date.get(),
      lat: lat.value,
      lng: lng.value,
      externalMode,
      externalUrl: externalUrl.value,
      sections: sections.get(),
      links,
      imageFocus,
      published: published.input.checked,
      favorite: favorite.input.checked,
      savedAt: new Date().toISOString(),
    });
    let lastDraftSnap = initialState;
    const draftTimer = window.setInterval(() => {
      const now = snapshot();
      if (now === lastDraftSnap) return;
      lastDraftSnap = now;
      try {
        localStorage.setItem(draftKey, JSON.stringify(collectDraft()));
      } catch {
        /* ignore */
      }
    }, 2000);

    setNavGuard(async () =>
      isDirty() ? confirmDialog(t("form.leave.confirm"), t("form.leave.action")) : true
    );
    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      if (isDirty()) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    cleanup = () => {
      cleanup = null; // idempotent: the router may call teardown more than once
      setNavGuard(null);
      window.clearInterval(draftTimer);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("paste", onPaste);
    };
    // If the page was torn down while data was loading, the returned teardown
    // already ran against a null cleanup; undo the just-installed setup now.
    if (disposed) cleanup();

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

    // A taste needs a category; block saving (and guide the owner) when none
    // exist yet rather than sending an invalid categoryId.
    if (!categories.length) {
      save.disabled = true;
      errorBox.hidden = false;
      errorBox.textContent = t("form.noCategories");
    }

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
        categoryId: Number(categorySel.get()),
        rating: rating.get(),
        statusId: statusSel.get() ? Number(statusSel.get()) : null,
        tags: tags.get(),
        refDate: date.get(),
        location: latValue !== "" ? { lat: Number(latValue), lng: Number(lngValue) } : null,
        imageFocus,
        externalReviewUrl: externalMode && externalUrl.value.trim() ? externalUrl.value.trim() : null,
        sections: externalMode ? [] : sections.get(),
        links: links.filter((l) => l.label.trim() || l.url.trim()),
        published: published.input.checked,
        favorite: favorite.input.checked,
      };

      save.disabled = true;
      try {
        const result: TasteDetail = editId
          ? await adminApi.updateTaste(editId, input)
          : await adminApi.createTaste(input);
        if (imageBlob) {
          try {
            await adminApi.uploadImage(result.id, imageBlob.blob, imageBlob.filename);
          } catch {
            toast(t("form.image.error"), "error");
          }
        } else if (removeImage && detail?.imageFile) {
          await adminApi.deleteImage(result.id).catch(() => undefined);
        }
        saved = true;
        dropDraft();
        invalidateCatalog();
        toast(t("form.saved"), "success");
        navigate(`/taste/${result.id}`);
      } catch (err) {
        save.disabled = false;
        errorBox.hidden = false;
        if (err instanceof ApiError && err.status !== 0) {
          if (err.code === "INVALID_URL") errorBox.textContent = t("form.error.INVALID_URL");
          else if (err.code === "INVALID_LOCATION")
            errorBox.textContent = t("form.location.invalid");
          else if (err.code === "INVALID_DATE") errorBox.textContent = t("form.date.invalid");
          else if (err.code === "TITLE_REQUIRED") errorBox.textContent = t("form.title.required");
          else errorBox.textContent = t("form.error.generic");
        } else {
          errorBox.textContent = t("error.network");
        }
      }
    });

    title.focus();
  };

  // The categories request is not caught inside boot(): a transient network
  // failure while opening the form must show a retry, not a blank page.
  const start = (): void => {
    main.innerHTML = "";
    boot().catch(() => {
      if (disposed) return;
      main.innerHTML = "";
      const err = document.createElement("p");
      err.className = "error-box";
      err.textContent = t("error.network");
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "btn";
      retry.textContent = t("action.retry");
      retry.addEventListener("click", start);
      main.append(err, retry);
    });
  };
  start();

  return () => {
    disposed = true;
    cleanup?.();
  };
}
