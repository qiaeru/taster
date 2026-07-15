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
