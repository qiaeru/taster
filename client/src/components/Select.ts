// SPDX-License-Identifier: MIT
// Custom select: a button opening a themed popup listbox, replacing native
// <select> elements whose open list cannot be styled. Same open/close and
// keyboard recipe as LocaleSwitcher (Escape, arrows, Home/End, click outside).

import { icon } from "./Icon.js";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectMenu {
  el: HTMLElement;
  get(): string;
  /** Replaces the option list (dependent selects) and the current value. */
  setOptions(options: SelectOption[], value: string): void;
  setDisabled(disabled: boolean): void;
}

export function selectMenu(opts: {
  options: SelectOption[];
  value: string;
  /** Accessible name for the toggle and the listbox. */
  label: string;
  small?: boolean;
  onChange?: (value: string) => void;
}): SelectMenu {
  let options = opts.options;
  let value = opts.value;

  const wrap = document.createElement("div");
  wrap.className = "select-menu";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = `select select-toggle${opts.small ? " select-sm" : ""}`;
  toggle.setAttribute("aria-label", opts.label);
  toggle.setAttribute("aria-haspopup", "listbox");
  toggle.setAttribute("aria-expanded", "false");
  const valueEl = document.createElement("span");
  valueEl.className = "select-value";
  toggle.appendChild(valueEl);
  toggle.appendChild(icon("chevron-down", "icon icon-sm select-chevron"));
  wrap.appendChild(toggle);

  const menu = document.createElement("ul");
  menu.className = "select-panel";
  menu.setAttribute("role", "listbox");
  menu.setAttribute("aria-label", opts.label);
  menu.hidden = true;
  wrap.appendChild(menu);

  const paintValue = (): void => {
    valueEl.textContent = options.find((o) => o.value === value)?.label ?? "";
  };

  const renderMenu = (): void => {
    menu.innerHTML = "";
    for (const option of options) {
      const li = document.createElement("li");
      const item = document.createElement("button");
      item.type = "button";
      item.className = "select-option";
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(option.value === value));
      item.dataset.active = String(option.value === value);
      item.textContent = option.label;
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const changed = option.value !== value;
        value = option.value;
        paintValue();
        close();
        toggle.focus();
        if (changed) opts.onChange?.(value);
      });
      li.appendChild(item);
      menu.appendChild(li);
    }
  };

  const open = (): void => {
    renderMenu();
    menu.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    document.addEventListener("click", onOutside, true);
    document.addEventListener("keydown", onKey);
    (
      menu.querySelector<HTMLElement>('[data-active="true"]') ??
      menu.querySelector<HTMLElement>(".select-option")
    )?.focus();
  };
  const close = (): void => {
    menu.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", onOutside, true);
    document.removeEventListener("keydown", onKey);
  };
  const onOutside = (e: MouseEvent): void => {
    // Self-heal if the page was torn down while the menu was open: the
    // document listeners outlive the detached menu otherwise.
    if (!wrap.isConnected || !wrap.contains(e.target as Node)) close();
  };
  let typeahead = "";
  let typeaheadTimer: number | undefined;
  const onKey = (e: KeyboardEvent): void => {
    if (!wrap.isConnected) {
      close();
      return;
    }
    if (e.key === "Escape") {
      close();
      toggle.focus();
      return;
    }
    if (e.key === "Tab") {
      close();
      return;
    }
    const items = Array.from(menu.querySelectorAll<HTMLElement>(".select-option"));
    if (!items.length) return;
    // Type-to-select, like a native listbox: buffer keystrokes for a moment
    // and jump to the first option whose label starts with them.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      typeahead += e.key.toLowerCase();
      window.clearTimeout(typeaheadTimer);
      typeaheadTimer = window.setTimeout(() => (typeahead = ""), 600);
      const match = items.find((item) =>
        (item.textContent ?? "").toLowerCase().startsWith(typeahead)
      );
      match?.focus();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const idx = items.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? items.length - 1
          : (idx + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  };
  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menu.hidden) open();
    else close();
  });
  // ArrowDown/ArrowUp open a closed menu, matching a native <select>.
  toggle.addEventListener("keydown", (e) => {
    if (menu.hidden && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      open();
    }
  });
  // Close when focus leaves the widget entirely (Tab away, or another control
  // steals focus), which also removes the document listeners.
  wrap.addEventListener("focusout", () => {
    // Defer so focus has landed; if it stayed inside the widget, keep open.
    setTimeout(() => {
      if (!menu.hidden && !wrap.contains(document.activeElement)) close();
    }, 0);
  });

  paintValue();

  return {
    el: wrap,
    get: () => value,
    setOptions: (nextOptions, nextValue) => {
      options = nextOptions;
      value = nextValue;
      paintValue();
      if (!menu.hidden) renderMenu();
    },
    setDisabled: (disabled) => {
      toggle.disabled = disabled;
      if (disabled) close();
    },
  };
}
