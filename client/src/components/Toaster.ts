// SPDX-License-Identifier: MIT
// Minimal toast notifications, mounted in <body> so router re-renders never
// wipe an active toast.

type ToastType = "info" | "success" | "error";

let container: HTMLElement | null = null;

function getContainer(): HTMLElement {
  if (!container || !container.isConnected) {
    container = document.createElement("div");
    container.className = "toaster";
    document.body.appendChild(container);
  }
  return container;
}

export function toast(message: string, type: ToastType = "info"): void {
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  // Errors are user-actionable: promote to an assertive live region.
  el.setAttribute("role", type === "error" ? "alert" : "status");
  el.textContent = message;
  getContainer().appendChild(el);
  window.setTimeout(() => {
    el.classList.add("toast-out");
    window.setTimeout(() => el.remove(), 300);
  }, 3500);
}
