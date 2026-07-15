// SPDX-License-Identifier: MIT
// Admin dashboard: login (with the forced password change), then tabs for
// tastes, categories, import/export and account.

import type { AdminTasteSummary, Category } from "@taster/shared";
import {
  adminApi,
  authApi,
  api,
  ApiError,
  invalidateCatalog,
  loadCatalog,
  thumbUrl,
} from "../api.js";
import { renderHeader } from "../components/Header.js";
import { icon, CATEGORY_ICONS } from "../components/Icon.js";
import { starDisplay } from "../components/StarRating.js";
import { toast } from "../components/Toaster.js";
import { confirmDialog } from "../components/ConfirmDialog.js";
import { t } from "../i18n/index.js";
import { formatDateTime, searchFold } from "../lib/format.js";
import { navigate, rerender } from "../router.js";
import { renderImportExportTab } from "./adminImportExport.js";

function field(labelText: string, input: HTMLElement, hint?: string): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "field";
  const label = document.createElement("label");
  label.className = "field-label";
  label.textContent = labelText;
  if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement) {
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

function passwordErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const key = `password.error.${err.code}`;
    const translated = t(key);
    if (translated !== key) return translated;
  }
  return t("error.generic");
}

// ---- login ----

function renderLogin(main: HTMLElement): void {
  const box = document.createElement("form");
  box.className = "auth-box";
  const h1 = document.createElement("h1");
  h1.className = "page-title";
  h1.textContent = t("login.title");
  box.appendChild(h1);

  const user = document.createElement("input");
  user.type = "text";
  user.className = "input";
  user.autocomplete = "username";
  user.required = true;
  const pass = document.createElement("input");
  pass.type = "password";
  pass.className = "input";
  pass.autocomplete = "current-password";
  pass.required = true;
  box.appendChild(field(t("login.username"), user));
  box.appendChild(field(t("login.password"), pass));

  const error = document.createElement("p");
  error.className = "error-box";
  error.hidden = true;
  box.appendChild(error);

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "btn btn-primary";
  submit.textContent = t("login.submit");
  box.appendChild(submit);

  box.addEventListener("submit", async (e) => {
    e.preventDefault();
    submit.disabled = true;
    error.hidden = true;
    try {
      await authApi.login(user.value, pass.value);
      rerender();
    } catch (err) {
      submit.disabled = false;
      error.hidden = false;
      if (err instanceof ApiError && err.status === 423) error.textContent = t("login.error.locked");
      else if (err instanceof ApiError && err.status === 429)
        error.textContent = t("login.error.rateLimited");
      else error.textContent = t("login.error.invalid");
    }
  });

  main.appendChild(box);
  user.focus();
}

// ---- forced password change ----

function renderPasswordChange(main: HTMLElement, forced: boolean, onDone: () => void): void {
  const box = document.createElement("form");
  box.className = "auth-box";
  if (forced) {
    const h1 = document.createElement("h1");
    h1.className = "page-title";
    h1.textContent = t("password.title");
    const intro = document.createElement("p");
    intro.className = "muted";
    intro.textContent = t("password.intro");
    box.append(h1, intro);
  }

  const current = document.createElement("input");
  current.type = "password";
  current.className = "input";
  current.autocomplete = "current-password";
  current.required = true;
  const next = document.createElement("input");
  next.type = "password";
  next.className = "input";
  next.autocomplete = "new-password";
  next.required = true;
  const confirm = document.createElement("input");
  confirm.type = "password";
  confirm.className = "input";
  confirm.autocomplete = "new-password";
  confirm.required = true;
  box.appendChild(field(t("password.current"), current));
  box.appendChild(field(t("password.new"), next, t("password.hint")));
  box.appendChild(field(t("password.confirm"), confirm));

  const error = document.createElement("p");
  error.className = "error-box";
  error.hidden = true;
  box.appendChild(error);

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "btn btn-primary";
  submit.textContent = t("password.submit");
  box.appendChild(submit);

  box.addEventListener("submit", async (e) => {
    e.preventDefault();
    error.hidden = true;
    if (next.value !== confirm.value) {
      error.hidden = false;
      error.textContent = t("password.mismatch");
      return;
    }
    submit.disabled = true;
    try {
      await authApi.changePassword(current.value, next.value);
      toast(t("account.changed"), "success");
      onDone();
    } catch (err) {
      submit.disabled = false;
      error.hidden = false;
      error.textContent = passwordErrorMessage(err);
    }
  });

  main.appendChild(box);
}

// ---- tastes tab ----

async function renderTastesTab(body: HTMLElement): Promise<void> {
  const [tastes, catalog] = await Promise.all([adminApi.tastes(), loadCatalog()]);
  const categories = new Map(catalog.categories.map((c) => [c.id, c]));
  body.innerHTML = "";

  const toolbar = document.createElement("div");
  toolbar.className = "admin-toolbar";
  const newBtn = document.createElement("a");
  newBtn.href = "/admin/taste/new";
  newBtn.className = "btn btn-primary";
  newBtn.appendChild(icon("plus", "icon icon-sm"));
  newBtn.appendChild(document.createTextNode(t("admin.newTaste")));
  toolbar.appendChild(newBtn);
  const filter = document.createElement("input");
  filter.type = "search";
  filter.className = "input";
  filter.placeholder = t("admin.search");
  filter.setAttribute("aria-label", t("admin.search"));
  toolbar.appendChild(filter);
  body.appendChild(toolbar);

  const listEl = document.createElement("div");
  listEl.className = "row-list admin-taste-list";
  body.appendChild(listEl);

  const paint = (): void => {
    const fold = searchFold(filter.value.trim());
    const visible = fold
      ? tastes.filter((x) => searchFold(x.title + " " + x.tags.join(" ")).includes(fold))
      : tastes;
    listEl.innerHTML = "";
    if (!visible.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = t("admin.empty");
      listEl.appendChild(empty);
      return;
    }
    for (const taste of visible) listEl.appendChild(row(taste));
  };

  const row = (taste: AdminTasteSummary): HTMLElement => {
    const el = document.createElement("div");
    el.className = "taste-row admin-row";
    const category = categories.get(taste.categoryId);

    const thumb = document.createElement("div");
    thumb.className = "row-media";
    if (category) thumb.style.setProperty("--cat-color", category.color);
    if (taste.imageFile) {
      const img = document.createElement("img");
      img.src = thumbUrl(taste.imageFile);
      img.alt = "";
      img.loading = "lazy";
      img.width = 96;
      img.height = 96;
      thumb.appendChild(img);
    } else {
      thumb.classList.add("card-media-placeholder");
      thumb.appendChild(icon(category?.icon ?? "tag", "icon"));
    }
    el.appendChild(thumb);

    const main = document.createElement("div");
    main.className = "row-main";
    const title = document.createElement("a");
    title.className = "row-title";
    title.href = `/taste/${taste.id}`;
    title.textContent = taste.title;
    main.appendChild(title);
    const meta = document.createElement("span");
    meta.className = "row-meta";
    if (!taste.published) {
      const draft = document.createElement("span");
      draft.className = "chip chip-draft";
      draft.textContent = t("card.draft");
      meta.appendChild(draft);
    }
    if (category) {
      const badge = document.createElement("span");
      badge.className = "cat-badge";
      badge.style.setProperty("--cat-color", category.color);
      badge.appendChild(icon(category.icon, "icon icon-sm"));
      badge.appendChild(document.createTextNode(category.name));
      meta.appendChild(badge);
    }
    const updated = document.createElement("span");
    updated.className = "muted admin-updated";
    updated.textContent = formatDateTime(taste.updatedAt);
    meta.appendChild(updated);
    main.appendChild(meta);
    el.appendChild(main);

    const right = document.createElement("div");
    right.className = "row-right admin-row-actions";
    if (taste.rating) right.appendChild(starDisplay(taste.rating, "sm"));
    const edit = document.createElement("a");
    edit.href = `/admin/taste/${taste.id}/edit`;
    edit.className = "icon-btn";
    edit.title = t("detail.edit");
    edit.setAttribute("aria-label", t("detail.edit"));
    edit.appendChild(icon("pencil", "icon icon-sm"));
    right.appendChild(edit);
    const del = document.createElement("button");
    del.type = "button";
    del.className = "icon-btn btn-danger";
    del.title = t("action.delete");
    del.setAttribute("aria-label", t("action.delete"));
    del.appendChild(icon("trash", "icon icon-sm"));
    del.addEventListener("click", async () => {
      if (!(await confirmDialog(t("admin.deleteConfirm", { title: taste.title })))) return;
      try {
        await adminApi.deleteTaste(taste.id);
        tastes.splice(tastes.indexOf(taste), 1);
        invalidateCatalog();
        toast(t("admin.deleted"), "success");
        paint();
      } catch {
        toast(t("error.generic"), "error");
      }
    });
    right.appendChild(del);
    el.appendChild(right);
    return el;
  };

  filter.addEventListener("input", paint);
  paint();
}

// ---- categories tab ----

async function renderCategoriesTab(body: HTMLElement): Promise<void> {
  const categories = await api.get<Category[]>("/api/categories");
  body.innerHTML = "";

  const list = document.createElement("div");
  list.className = "category-list";
  body.appendChild(list);

  const iconSelect = (value: string): HTMLSelectElement => {
    const sel = document.createElement("select");
    sel.className = "select";
    sel.setAttribute("aria-label", t("categories.icon"));
    for (const name of CATEGORY_ICONS) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      opt.selected = name === value;
      sel.appendChild(opt);
    }
    return sel;
  };

  const categoryCard = (category: Category): HTMLElement => {
    const card = document.createElement("div");
    card.className = "category-card";

    const headRow = document.createElement("div");
    headRow.className = "category-head";
    const iconPreview = document.createElement("span");
    iconPreview.className = "cat-badge";
    iconPreview.style.setProperty("--cat-color", category.color);
    iconPreview.appendChild(icon(category.icon, "icon"));
    headRow.appendChild(iconPreview);

    const name = document.createElement("input");
    name.type = "text";
    name.className = "input";
    name.value = category.name;
    name.setAttribute("aria-label", t("categories.name"));
    headRow.appendChild(name);

    const iconSel = iconSelect(category.icon);
    headRow.appendChild(iconSel);

    const color = document.createElement("input");
    color.type = "color";
    color.className = "color-input";
    color.value = category.color;
    color.setAttribute("aria-label", t("categories.color"));
    headRow.appendChild(color);
    card.appendChild(headRow);

    // Statuses editor
    const statuses: { id?: number; name: string }[] = category.statuses.map((s) => ({
      id: s.id,
      name: s.name,
    }));
    const statusList = document.createElement("div");
    statusList.className = "status-list";
    const paintStatuses = (): void => {
      statusList.innerHTML = "";
      statuses.forEach((status, index) => {
        const rowEl = document.createElement("div");
        rowEl.className = "status-row";
        const input = document.createElement("input");
        input.type = "text";
        input.className = "input";
        input.value = status.name;
        input.addEventListener("input", () => (status.name = input.value));
        rowEl.appendChild(input);
        const up = document.createElement("button");
        up.type = "button";
        up.className = "icon-btn";
        up.disabled = index === 0;
        up.title = t("form.section.moveUp");
        up.appendChild(icon("arrow-up", "icon icon-sm"));
        up.addEventListener("click", () => {
          [statuses[index - 1], statuses[index]] = [statuses[index], statuses[index - 1]];
          paintStatuses();
        });
        const down = document.createElement("button");
        down.type = "button";
        down.className = "icon-btn";
        down.disabled = index === statuses.length - 1;
        down.title = t("form.section.moveDown");
        down.appendChild(icon("arrow-down", "icon icon-sm"));
        down.addEventListener("click", () => {
          [statuses[index], statuses[index + 1]] = [statuses[index + 1], statuses[index]];
          paintStatuses();
        });
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "icon-btn btn-danger";
        remove.title = t("action.delete");
        remove.appendChild(icon("trash", "icon icon-sm"));
        remove.addEventListener("click", () => {
          statuses.splice(index, 1);
          paintStatuses();
        });
        rowEl.append(up, down, remove);
        statusList.appendChild(rowEl);
      });
    };
    paintStatuses();
    const statusHead = document.createElement("p");
    statusHead.className = "field-label";
    statusHead.textContent = t("categories.statuses");
    const statusHint = document.createElement("p");
    statusHint.className = "muted field-hint";
    statusHint.textContent = t("categories.statuses.hint");
    card.append(statusHead, statusHint, statusList);

    const addStatus = document.createElement("button");
    addStatus.type = "button";
    addStatus.className = "btn";
    addStatus.appendChild(icon("plus", "icon icon-sm"));
    addStatus.appendChild(document.createTextNode(t("categories.statuses.add")));
    addStatus.addEventListener("click", () => {
      statuses.push({ name: "" });
      paintStatuses();
    });
    card.appendChild(addStatus);

    const actions = document.createElement("div");
    actions.className = "dialog-actions";
    const save = document.createElement("button");
    save.type = "button";
    save.className = "btn btn-primary";
    save.textContent = t("action.save");
    save.addEventListener("click", async () => {
      save.disabled = true;
      try {
        await adminApi.updateCategory(category.id, {
          name: name.value,
          icon: iconSel.value,
          color: color.value,
        });
        await adminApi.setStatuses(
          category.id,
          statuses.filter((s) => s.name.trim())
        );
        invalidateCatalog();
        toast(t("categories.saved"), "success");
        void renderCategoriesTab(body);
      } catch {
        toast(t("error.generic"), "error");
        save.disabled = false;
      }
    });
    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn btn-danger";
    del.textContent = t("action.delete");
    del.addEventListener("click", async () => {
      if (!(await confirmDialog(t("categories.deleteConfirm", { name: category.name })))) return;
      try {
        await adminApi.deleteCategory(category.id);
        invalidateCatalog();
        toast(t("categories.deleted"), "success");
        void renderCategoriesTab(body);
      } catch (err) {
        toast(
          err instanceof ApiError && err.code === "CATEGORY_IN_USE"
            ? t("categories.error.inUse")
            : t("error.generic"),
          "error"
        );
      }
    });
    actions.append(save, del);
    card.appendChild(actions);
    return card;
  };

  for (const category of categories) list.appendChild(categoryCard(category));

  // New category
  const newForm = document.createElement("form");
  newForm.className = "category-card category-new";
  const title = document.createElement("h3");
  title.className = "detail-subhead";
  title.textContent = t("categories.new");
  newForm.appendChild(title);
  const newRow = document.createElement("div");
  newRow.className = "category-head";
  const newName = document.createElement("input");
  newName.type = "text";
  newName.className = "input";
  newName.required = true;
  newName.placeholder = t("categories.name");
  newName.setAttribute("aria-label", t("categories.name"));
  const newIcon = iconSelect("tag");
  const newColor = document.createElement("input");
  newColor.type = "color";
  newColor.className = "color-input";
  newColor.value = "#8b5cf6";
  newColor.setAttribute("aria-label", t("categories.color"));
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "btn btn-primary";
  submit.textContent = t("action.add");
  newRow.append(newName, newIcon, newColor, submit);
  newForm.appendChild(newRow);
  newForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await adminApi.createCategory({
        name: newName.value,
        icon: newIcon.value,
        color: newColor.value,
      });
      invalidateCatalog();
      toast(t("categories.saved"), "success");
      void renderCategoriesTab(body);
    } catch {
      toast(t("error.generic"), "error");
    }
  });
  body.appendChild(newForm);
}

// ---- account tab ----

function renderAccountTab(body: HTMLElement): void {
  body.innerHTML = "";
  const h = document.createElement("h3");
  h.className = "detail-subhead";
  h.textContent = t("account.changePassword");
  body.appendChild(h);
  renderPasswordChange(body, false, () => rerender());

  const logout = document.createElement("button");
  logout.type = "button";
  logout.className = "btn admin-logout";
  logout.appendChild(icon("arrow-right-start-on-rectangle", "icon icon-sm"));
  logout.appendChild(document.createTextNode(t("admin.logout")));
  logout.addEventListener("click", async () => {
    await authApi.logout().catch(() => undefined);
    navigate("/");
  });
  body.appendChild(logout);
}

// ---- dashboard ----

function renderDashboard(main: HTMLElement): void {
  const h1 = document.createElement("h1");
  h1.className = "page-title";
  h1.textContent = t("admin.title");
  main.appendChild(h1);

  const tabs: Array<{ key: string; label: string; render: (body: HTMLElement) => void }> = [
    { key: "tastes", label: t("admin.tab.tastes"), render: (b) => void renderTastesTab(b) },
    {
      key: "categories",
      label: t("admin.tab.categories"),
      render: (b) => void renderCategoriesTab(b),
    },
    {
      key: "io",
      label: t("admin.tab.importExport"),
      render: (b) => void renderImportExportTab(b),
    },
    { key: "account", label: t("admin.tab.account"), render: renderAccountTab },
  ];

  const nav = document.createElement("div");
  nav.className = "tab-nav";
  nav.setAttribute("role", "tablist");
  const body = document.createElement("div");
  body.className = "tab-body";

  let active = "tastes";
  const paintNav = (): void => {
    nav.innerHTML = "";
    for (const tab of tabs) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tab-btn";
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", String(tab.key === active));
      btn.dataset.active = String(tab.key === active);
      btn.textContent = tab.label;
      btn.addEventListener("click", () => {
        active = tab.key;
        paintNav();
        body.innerHTML = "";
        tab.render(body);
      });
      nav.appendChild(btn);
    }
  };
  paintNav();
  main.append(nav, body);
  tabs[0].render(body);
}

export function renderAdmin(root: HTMLElement): void {
  root.appendChild(renderHeader());
  const main = document.createElement("main");
  main.className = "admin-page";
  root.appendChild(main);
  document.title = `${t("admin.title")} · Taster`;

  void authApi
    .session()
    .then((session) => {
      if (!session.authenticated) renderLogin(main);
      else if (session.mustChangePassword) renderPasswordChange(main, true, () => rerender());
      else renderDashboard(main);
    })
    .catch(() => {
      const err = document.createElement("p");
      err.className = "error-box";
      err.textContent = t("error.network");
      main.appendChild(err);
    });
}
