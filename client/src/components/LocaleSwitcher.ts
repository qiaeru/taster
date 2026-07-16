// SPDX-License-Identifier: MIT
// Language picker: a dropdown listing each locale by its native name, so
// adding a locale later means one entry in SUPPORTED_LOCALES and nothing else.

import { icon } from "./Icon.js";
import { tip } from "./Tooltip.js";
import { locale$, setLocale, SUPPORTED_LOCALES, t, type Locale } from "../i18n/index.js";

export function renderLocaleSwitcher(): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "locale-picker";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "icon-btn";
  btn.setAttribute("aria-label", t("a11y.languageToggle"));
  tip(btn, t("a11y.languageToggle"), "bottom", "end");
  btn.setAttribute("aria-haspopup", "menu");
  btn.setAttribute("aria-expanded", "false");
  btn.appendChild(icon("language"));
  wrap.appendChild(btn);

  const menu = document.createElement("ul");
  menu.className = "locale-menu";
  menu.setAttribute("role", "menu");
  menu.hidden = true;
  wrap.appendChild(menu);

  const renderMenu = (): void => {
    menu.innerHTML = "";
    for (const { code: c, native } of SUPPORTED_LOCALES) {
      const li = document.createElement("li");
      const item = document.createElement("button");
      item.type = "button";
      item.className = "locale-menu-item";
      item.setAttribute("role", "menuitemradio");
      item.setAttribute("aria-checked", String(c === locale$.get()));
      item.dataset.active = String(c === locale$.get());
      // Each native name is in its own language; the lang attribute makes
      // screen readers pronounce "Français" in French, not in the page voice.
      item.lang = c;
      item.textContent = native;
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const target = c as Locale;
        setLocale(target);
        close();
        // Page re-render is owned by main.ts's locale subscriber. Calling
        // rerender() here too races itself in the microtask queue and can
        // leave the page stuck in the old language.
      });
      li.appendChild(item);
      menu.appendChild(li);
    }
  };

  const open = (): void => {
    renderMenu();
    menu.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    document.addEventListener("click", onOutside, true);
    document.addEventListener("keydown", onKey);
    // role="menu" promises focus-on-open + arrow navigation (see onKey).
    menu.querySelector<HTMLElement>(".locale-menu-item")?.focus();
  };
  const close = (): void => {
    menu.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", onOutside, true);
    document.removeEventListener("keydown", onKey);
  };
  const onOutside = (e: MouseEvent): void => {
    // Self-heal if the header was torn down while the menu was open.
    if (!wrap.isConnected || !wrap.contains(e.target as Node)) close();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (!wrap.isConnected) {
      close();
      return;
    }
    if (e.key === "Escape") {
      close();
      btn.focus();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = Array.from(menu.querySelectorAll<HTMLElement>(".locale-menu-item"));
    if (items.length === 0) return;
    const idx = items.indexOf(document.activeElement as HTMLElement);
    const next = (idx + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menu.hidden) open();
    else close();
  });

  return wrap;
}
