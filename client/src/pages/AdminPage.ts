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
import { icon, CATEGORY_ICONS, isOutlineIcon } from "../components/Icon.js";
import { tip } from "../components/Tooltip.js";
import { bindPasswordStrength } from "../components/PasswordStrength.js";
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
    if (err.status === 0) return t("error.network");
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
      if (err instanceof ApiError && err.status === 0) error.textContent = t("error.network");
      else if (err instanceof ApiError && err.status === 423)
        error.textContent = t("login.error.locked");
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
  box.appendChild(field(t("password.new"), next));
  const strength = document.createElement("div");
  bindPasswordStrength(next, strength);
  box.appendChild(strength);
  box.appendChild(field(t("password.confirm"), confirm));

  const error = document.createElement("p");
  error.className = "error-box";
  error.hidden = true;
  box.appendChild(error);

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "btn btn-primary";
  submit.appendChild(icon("key", "icon icon-sm"));
  submit.appendChild(document.createTextNode(t("password.submit")));
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
    tip(edit, t("detail.edit"));
    edit.setAttribute("aria-label", t("detail.edit"));
    edit.appendChild(icon("pencil", "icon icon-sm"));
    right.appendChild(edit);
    const del = document.createElement("button");
    del.type = "button";
    del.className = "icon-btn btn-danger";
    tip(del, t("action.delete"));
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

  // Visual icon library: a grid of showcased Heroicons plus a free-text field
  // accepting any other Heroicons outline name.
  const iconPicker = (
    initial: string,
    onChange?: (name: string) => void
  ): { el: HTMLElement; readonly value: string } => {
    let value = initial;
    const wrap = document.createElement("div");
    wrap.className = "icon-picker";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "btn icon-picker-toggle";
    tip(toggle, t("categories.icon"));
    toggle.setAttribute("aria-label", t("categories.icon"));
    toggle.setAttribute("aria-haspopup", "true");
    toggle.setAttribute("aria-expanded", "false");
    const paintToggle = (): void => {
      toggle.innerHTML = "";
      toggle.appendChild(icon(value, "icon"));
      toggle.appendChild(icon("chevron-down", "icon icon-sm"));
    };
    paintToggle();
    wrap.appendChild(toggle);

    const panel = document.createElement("div");
    panel.className = "icon-picker-panel";
    panel.hidden = true;
    wrap.appendChild(panel);

    const grid = document.createElement("div");
    grid.className = "icon-picker-grid";
    panel.appendChild(grid);

    const manual = document.createElement("input");
    manual.type = "text";
    manual.className = "input";
    manual.placeholder = t("categories.icon.custom");
    manual.setAttribute("aria-label", t("categories.icon.custom"));

    const pick = (name: string): void => {
      value = name;
      paintToggle();
      paintGrid();
      onChange?.(name);
    };

    const paintGrid = (): void => {
      grid.innerHTML = "";
      for (const name of CATEGORY_ICONS) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "icon-picker-item";
        // Downward: the grid scrolls and would clip a bubble above its top row.
        tip(btn, name, "bottom");
        btn.setAttribute("aria-label", name);
        btn.dataset.active = String(name === value);
        btn.appendChild(icon(name, "icon"));
        btn.addEventListener("click", () => {
          manual.value = "";
          pick(name);
          close();
          toggle.focus();
        });
        grid.appendChild(btn);
      }
    };
    paintGrid();

    // Manual entry keeps the panel open so the toggle previews the icon live.
    manual.addEventListener("input", () => {
      const name = manual.value.trim();
      if (!name) return;
      const known = isOutlineIcon(name);
      manual.setAttribute("aria-invalid", String(!known));
      manual.classList.toggle("input-invalid", !known);
      if (known) pick(name);
    });
    if (!(CATEGORY_ICONS as readonly string[]).includes(initial)) manual.value = initial;
    panel.appendChild(manual);

    const open = (): void => {
      panel.hidden = false;
      // Measure once visible, then flip toward the space available.
      delete panel.dataset.align;
      delete panel.dataset.open;
      const rect = panel.getBoundingClientRect();
      if (rect.right > window.innerWidth - 8) panel.dataset.align = "right";
      if (rect.bottom > window.innerHeight - 8 && rect.top > window.innerHeight - rect.bottom) {
        panel.dataset.open = "up";
      }
      toggle.setAttribute("aria-expanded", "true");
      document.addEventListener("click", onOutside, true);
      document.addEventListener("keydown", onKey);
    };
    const close = (): void => {
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      document.removeEventListener("click", onOutside, true);
      document.removeEventListener("keydown", onKey);
    };
    const onOutside = (e: MouseEvent): void => {
      // Self-heal if the tab was torn down while the panel was open.
      if (!wrap.isConnected || !wrap.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (!wrap.isConnected) {
        close();
        return;
      }
      if (e.key === "Escape") {
        close();
        toggle.focus();
      }
    };
    toggle.addEventListener("click", () => {
      if (panel.hidden) open();
      else close();
    });

    return {
      el: wrap,
      get value() {
        return value;
      },
    };
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

    const iconSel = iconPicker(category.icon, (picked) => {
      iconPreview.innerHTML = "";
      iconPreview.appendChild(icon(picked, "icon"));
    });

    const color = document.createElement("input");
    color.type = "color";
    color.className = "color-input";
    color.value = category.color;
    color.setAttribute("aria-label", t("categories.color"));

    const controls = document.createElement("div");
    controls.className = "category-controls";
    controls.append(iconSel.el, color);
    headRow.appendChild(controls);
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
        tip(up, t("form.section.moveUp"));
        up.setAttribute("aria-label", t("form.section.moveUp"));
        up.appendChild(icon("arrow-up", "icon icon-sm"));
        up.addEventListener("click", () => {
          [statuses[index - 1], statuses[index]] = [statuses[index], statuses[index - 1]];
          paintStatuses();
        });
        const down = document.createElement("button");
        down.type = "button";
        down.className = "icon-btn";
        down.disabled = index === statuses.length - 1;
        tip(down, t("form.section.moveDown"));
        down.setAttribute("aria-label", t("form.section.moveDown"));
        down.appendChild(icon("arrow-down", "icon icon-sm"));
        down.addEventListener("click", () => {
          [statuses[index], statuses[index + 1]] = [statuses[index + 1], statuses[index]];
          paintStatuses();
        });
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "icon-btn btn-danger";
        tip(remove, t("action.delete"));
        remove.setAttribute("aria-label", t("action.delete"));
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
  const newIcon = iconPicker("tag");
  const newColor = document.createElement("input");
  newColor.type = "color";
  newColor.className = "color-input";
  newColor.value = "#8b5cf6";
  newColor.setAttribute("aria-label", t("categories.color"));
  const newControls = document.createElement("div");
  newControls.className = "category-controls";
  newControls.append(newIcon.el, newColor);
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "btn btn-primary";
  submit.textContent = t("action.add");
  newRow.append(newName, newControls, submit);
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
  // Creation first, existing categories below, mirroring the tastes tab.
  body.insertBefore(newForm, list);
}

// ---- account tab ----

function renderAccountTab(body: HTMLElement): void {
  body.innerHTML = "";
  const h = document.createElement("h3");
  h.className = "detail-subhead";
  h.textContent = t("account.changePassword");
  body.appendChild(h);
  renderPasswordChange(body, false, () => rerender());
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
  // The tablist only wraps the tabs: ARIA forbids other children, and the
  // logout button is an action, not a view, so it sits next to it in the bar.
  const tablist = document.createElement("div");
  tablist.className = "tab-list";
  tablist.setAttribute("role", "tablist");
  tablist.setAttribute("aria-label", t("admin.title"));
  const body = document.createElement("div");
  body.className = "tab-body";
  body.setAttribute("role", "tabpanel");
  body.id = "admin-panel";

  let active = "tastes";
  const paintNav = (): void => {
    tablist.innerHTML = "";
    for (const tab of tabs) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tab-btn";
      btn.id = `admin-tab-${tab.key}`;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", String(tab.key === active));
      btn.setAttribute("aria-controls", body.id);
      btn.dataset.active = String(tab.key === active);
      btn.textContent = tab.label;
      btn.addEventListener("click", () => {
        active = tab.key;
        paintNav();
        body.innerHTML = "";
        tab.render(body);
      });
      tablist.appendChild(btn);
    }
    body.setAttribute("aria-labelledby", `admin-tab-${active}`);
  };
  paintNav();

  const logout = document.createElement("button");
  logout.type = "button";
  logout.className = "tab-btn tab-logout";
  logout.appendChild(icon("arrow-right-start-on-rectangle", "icon icon-sm"));
  logout.appendChild(document.createTextNode(t("admin.logout")));
  logout.addEventListener("click", async () => {
    await authApi.logout().catch(() => undefined);
    navigate("/");
  });

  nav.append(tablist, logout);
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
