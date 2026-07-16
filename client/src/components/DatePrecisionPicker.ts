// SPDX-License-Identifier: MIT
// Flexible-precision date picker: Year, then optional Month, then optional
// Day (enabled only once a month is chosen). Leaving month empty IS year
// precision; no separate precision control needed.

import { locale$, t } from "../i18n/index.js";
import { selectMenu, type SelectOption } from "./Select.js";

export interface DatePickerWidget {
  el: HTMLElement;
  /** "YYYY" | "YYYY-MM" | "YYYY-MM-DD" | null */
  get(): string | null;
}

export function datePrecisionPicker(initial: string | null): DatePickerWidget {
  const parts = (initial ?? "").split("-");
  let year = parts[0] ?? "";
  let month = parts[1] ?? "";
  let day = parts[2] ?? "";

  const wrap = document.createElement("div");
  wrap.className = "date-picker";

  const yearInput = document.createElement("input");
  yearInput.type = "number";
  yearInput.className = "input date-year";
  yearInput.min = "1";
  yearInput.max = "9999";
  yearInput.placeholder = t("form.date.year");
  yearInput.setAttribute("aria-label", t("form.date.year"));
  yearInput.value = year;

  const monthName = (m: number): string =>
    new Intl.DateTimeFormat(locale$.get(), { month: "long" }).format(new Date(2000, m - 1, 1));

  const monthOptions: SelectOption[] = [
    { value: "", label: `${t("form.date.month")} ${t("form.date.none")}` },
  ];
  for (let m = 1; m <= 12; m++) {
    monthOptions.push({ value: String(m).padStart(2, "0"), label: monthName(m) });
  }

  const dayOptions = (): SelectOption[] => {
    const options: SelectOption[] = [
      { value: "", label: `${t("form.date.day")} ${t("form.date.none")}` },
    ];
    const y = Number(year) || 2000;
    const m = Number(month) || 1;
    const max = new Date(y, m, 0).getDate();
    for (let d = 1; d <= max; d++) {
      options.push({ value: String(d).padStart(2, "0"), label: String(d) });
    }
    return options;
  };

  const monthSel = selectMenu({
    options: monthOptions,
    value: month,
    label: t("form.date.month"),
    onChange: (value) => {
      month = value;
      if (!month) {
        day = "";
      } else if (day && Number(day) > new Date(Number(year) || 2000, Number(month), 0).getDate()) {
        day = "";
      }
      fillDays();
    },
  });

  const daySel = selectMenu({
    options: [],
    value: "",
    label: t("form.date.day"),
    onChange: (value) => {
      day = value;
    },
  });

  const fillDays = (): void => {
    daySel.setOptions(dayOptions(), day);
    daySel.setDisabled(!month || !year);
  };

  yearInput.addEventListener("input", () => {
    year = yearInput.value.trim();
    // Same clamp as the month handler: Feb 29 must not survive a switch to
    // a non-leap year (the server would reject the resulting date).
    if (day && month && Number(day) > new Date(Number(year) || 2000, Number(month), 0).getDate()) {
      day = "";
    }
    fillDays();
  });

  fillDays();

  const hint = document.createElement("p");
  hint.className = "muted field-hint";
  hint.textContent = t("form.date.hint");

  const row = document.createElement("div");
  row.className = "date-picker-row";
  row.append(yearInput, monthSel.el, daySel.el);
  wrap.append(row, hint);

  return {
    el: wrap,
    get: () => {
      const y = Number(year);
      if (!year || !Number.isInteger(y) || y < 1 || y > 9999) return null;
      const yyyy = String(y).padStart(4, "0");
      if (!month) return yyyy;
      if (!day) return `${yyyy}-${month}`;
      return `${yyyy}-${month}-${day}`;
    },
  };
}
