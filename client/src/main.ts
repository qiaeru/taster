// SPDX-License-Identifier: MIT
// Entry point: fonts, styles, theme, locale-driven re-render, router.

import "@fontsource-variable/hanken-grotesk";
import "@fontsource/young-serif";
import "./styles/app.css";

import { initTheme } from "./lib/theme.js";
import { initAppSettings, appSettings } from "./lib/appSettings.js";
import { locale$, hasStoredLocale, applyDefaultLocale } from "./i18n/index.js";
import { startRouter, rerender } from "./router.js";

initTheme();

// The instance settings (name, theme, default locale) must be known before
// the first render: the header shows the name and the locale drives every
// string on the page.
void initAppSettings().then(() => {
  const { defaultLocale } = appSettings();
  if (defaultLocale !== "auto" && !hasStoredLocale()) applyDefaultLocale(defaultLocale);

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
});
