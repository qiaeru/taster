// SPDX-License-Identifier: MIT
// Promise-based confirmation on the native <dialog> element.

import { t } from "../i18n/index.js";

export function confirmDialog(message: string, confirmLabel?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "confirm-dialog";

    const text = document.createElement("p");
    text.textContent = message;
    dialog.appendChild(text);

    const row = document.createElement("div");
    row.className = "dialog-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn";
    cancel.textContent = t("action.cancel");
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "btn btn-primary";
    ok.textContent = confirmLabel ?? t("action.delete");
    row.append(cancel, ok);
    dialog.appendChild(row);

    const close = (result: boolean) => {
      dialog.close();
      dialog.remove();
      resolve(result);
    };
    cancel.addEventListener("click", () => close(false));
    ok.addEventListener("click", () => close(true));
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      close(false);
    });

    document.body.appendChild(dialog);
    dialog.showModal();
    cancel.focus();
  });
}

/** Confirmation for irreversible bulk wipes: the admin must type the keyword. */
export function confirmWipeDialog(message: string, keyword: string): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "confirm-dialog";

    const text = document.createElement("p");
    text.textContent = message;
    dialog.appendChild(text);

    const hint = document.createElement("p");
    hint.className = "muted";
    hint.textContent = t("admin.app.wipe.type", { keyword });
    dialog.appendChild(hint);

    const input = document.createElement("input");
    input.type = "text";
    input.className = "input";
    input.setAttribute("aria-label", t("admin.app.wipe.type", { keyword }));
    dialog.appendChild(input);

    const row = document.createElement("div");
    row.className = "dialog-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn";
    cancel.textContent = t("action.cancel");
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "btn btn-danger";
    ok.textContent = t("action.delete");
    ok.disabled = true;
    row.append(cancel, ok);
    dialog.appendChild(row);

    const close = (result: boolean) => {
      dialog.close();
      dialog.remove();
      resolve(result);
    };
    input.addEventListener("input", () => {
      ok.disabled = input.value.trim() !== keyword;
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !ok.disabled) close(true);
    });
    cancel.addEventListener("click", () => close(false));
    ok.addEventListener("click", () => close(true));
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      close(false);
    });

    document.body.appendChild(dialog);
    dialog.showModal();
    input.focus();
  });
}
