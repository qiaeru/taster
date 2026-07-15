// SPDX-License-Identifier: MIT
// Site header: logo + name, stats link, theme toggle, locale toggle and the
// discreet admin link.

import logoRaw from "../../public/logo.svg?raw";
import { icon } from "./Icon.js";
import { t, locale$, setLocale, SUPPORTED_LOCALES } from "../i18n/index.js";
import { scheme$, toggleScheme } from "../lib/theme.js";

function themeToggle(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "icon-btn";
  btn.setAttribute("aria-label", t("a11y.themeToggle"));
  btn.title = t("a11y.themeToggle");
  // Self-unsubscribe once the button leaves the DOM (the router rebuilds the
  // header on every render). subscribe() fires synchronously before the
  // button is appended, so the isConnected check must skip that first call.
  let first = true;
  const unsub = scheme$.subscribe(() => {
    if (!first && !btn.isConnected) {
      unsub();
      return;
    }
    first = false;
    btn.innerHTML = "";
    btn.appendChild(icon(scheme$.get() === "dark" ? "sun" : "moon"));
    btn.setAttribute("aria-pressed", String(scheme$.get() === "dark"));
  });
  btn.addEventListener("click", toggleScheme);
  return btn;
}

// Two locales only: a simple toggle labeled with the target language reads
// better than a menu.
function localeToggle(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "icon-btn locale-btn";
  btn.setAttribute("aria-label", t("a11y.languageToggle"));
  btn.title = t("a11y.languageToggle");
  const current = locale$.get();
  const other = SUPPORTED_LOCALES.find((l) => l.code !== current)!;
  btn.appendChild(icon("language", "icon icon-sm"));
  const code = document.createElement("span");
  code.textContent = other.code.toUpperCase();
  code.lang = other.code;
  btn.appendChild(code);
  btn.addEventListener("click", () => setLocale(other.code));
  return btn;
}

export function renderHeader(): HTMLElement {
  const header = document.createElement("header");
  header.className = "site-header";

  const skip = document.createElement("a");
  skip.href = "#main-content";
  skip.className = "skip-link";
  skip.textContent = t("a11y.skipToContent");
  header.appendChild(skip);

  const brand = document.createElement("a");
  brand.href = "/";
  brand.className = "brand";
  const logo = document.createElement("span");
  logo.className = "brand-logo";
  logo.innerHTML = logoRaw;
  logo.querySelector("svg")?.setAttribute("aria-hidden", "true");
  brand.appendChild(logo);
  const name = document.createElement("span");
  name.className = "brand-name";
  name.textContent = t("app.name");
  brand.appendChild(name);
  header.appendChild(brand);

  const actions = document.createElement("div");
  actions.className = "header-actions";

  const stats = document.createElement("a");
  stats.href = "/stats";
  stats.className = "icon-btn";
  stats.setAttribute("aria-label", t("nav.stats"));
  stats.title = t("nav.stats");
  stats.appendChild(icon("chart-bar"));
  actions.appendChild(stats);

  actions.appendChild(themeToggle());
  actions.appendChild(localeToggle());

  const admin = document.createElement("a");
  admin.href = "/admin";
  admin.className = "icon-btn admin-link";
  admin.setAttribute("aria-label", t("nav.admin"));
  admin.title = t("nav.admin");
  admin.appendChild(icon("lock-closed"));
  actions.appendChild(admin);

  header.appendChild(actions);
  return header;
}
