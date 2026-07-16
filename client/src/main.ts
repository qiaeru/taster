// SPDX-License-Identifier: MIT
// Entry point: fonts, styles, theme, locale-driven re-render, router.

import "@fontsource-variable/hanken-grotesk";
import "@fontsource/young-serif";
import "./styles/app.css";

import { initTheme } from "./lib/theme.js";
import { locale$ } from "./i18n/index.js";
import { startRouter, rerender } from "./router.js";

initTheme();

// Re-render the current page when the locale changes; skip the synchronous
// first notification (the initial render is owned by startRouter).
let firstLocale = true;
locale$.subscribe(() => {
  if (firstLocale) {
    firstLocale = false;
    return;
  }
  rerender();
});

startRouter();
