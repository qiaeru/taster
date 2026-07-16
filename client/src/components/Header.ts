// SPDX-License-Identifier: MIT
// Site header: logo + name, stats link, theme toggle, locale toggle and the
// discreet admin link.

import logoRaw from "../../public/logo.svg?raw";
import { icon } from "./Icon.js";
import { tip } from "./Tooltip.js";
import { renderLocaleSwitcher } from "./LocaleSwitcher.js";
import { t } from "../i18n/index.js";
import { scheme$, toggleScheme } from "../lib/theme.js";

function themeToggle(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "icon-btn";
  btn.setAttribute("aria-label", t("a11y.themeToggle"));
  // Header tooltips open downward: the bar sits against the viewport top.
  tip(btn, t("a11y.themeToggle"), "bottom");
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
  tip(stats, t("nav.stats"), "bottom");
  stats.appendChild(icon("chart-pie"));
  actions.appendChild(stats);

  actions.appendChild(themeToggle());
  actions.appendChild(renderLocaleSwitcher());

  const admin = document.createElement("a");
  admin.href = "/admin";
  admin.className = "icon-btn admin-link";
  admin.setAttribute("aria-label", t("nav.admin"));
  tip(admin, t("nav.admin"), "bottom", "end");
  admin.appendChild(icon("arrow-right-end-on-rectangle"));
  actions.appendChild(admin);

  header.appendChild(actions);
  return header;
}
