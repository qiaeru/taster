// SPDX-License-Identifier: MIT
// Flexible-precision date picker: Year, then optional Month, then optional
// Day (enabled only once a month is chosen). Leaving month empty IS year
// precision; no separate precision control needed.

import { locale$, t } from "../i18n/index.js";

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

  const monthSel = document.createElement("select");
  monthSel.className = "select";
  monthSel.setAttribute("aria-label", t("form.date.month"));

  const daySel = document.createElement("select");
  daySel.className = "select";
  daySel.setAttribute("aria-label", t("form.date.day"));

  const monthName = (m: number): string =>
    new Intl.DateTimeFormat(locale$.get(), { month: "long" }).format(new Date(2000, m - 1, 1));

  const fillMonths = (): void => {
    monthSel.innerHTML = "";
    const none = document.createElement("option");
    none.value = "";
    none.textContent = `${t("form.date.month")} ${t("form.date.none")}`;
    monthSel.appendChild(none);
    for (let m = 1; m <= 12; m++) {
      const opt = document.createElement("option");
      opt.value = String(m).padStart(2, "0");
      opt.textContent = monthName(m);
      opt.selected = month === opt.value;
      monthSel.appendChild(opt);
    }
  };

  const fillDays = (): void => {
    daySel.innerHTML = "";
    const none = document.createElement("option");
    none.value = "";
    none.textContent = `${t("form.date.day")} ${t("form.date.none")}`;
    daySel.appendChild(none);
    const y = Number(year) || 2000;
    const m = Number(month) || 1;
    const max = new Date(y, m, 0).getDate();
    for (let d = 1; d <= max; d++) {
      const opt = document.createElement("option");
      opt.value = String(d).padStart(2, "0");
      opt.textContent = String(d);
      opt.selected = day === opt.value;
      daySel.appendChild(opt);
    }
    daySel.disabled = !month || !year;
  };

  yearInput.addEventListener("input", () => {
    year = yearInput.value.trim();
    fillDays();
  });
  monthSel.addEventListener("change", () => {
    month = monthSel.value;
    if (!month) {
      day = "";
    } else if (day && Number(day) > new Date(Number(year) || 2000, Number(month), 0).getDate()) {
      day = "";
    }
    fillDays();
  });
  daySel.addEventListener("change", () => {
    day = daySel.value;
  });

  fillMonths();
  fillDays();

  const hint = document.createElement("p");
  hint.className = "muted field-hint";
  hint.textContent = t("form.date.hint");

  const row = document.createElement("div");
  row.className = "date-picker-row";
  row.append(yearInput, monthSel, daySel);
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
