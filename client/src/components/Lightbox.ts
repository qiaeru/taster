// SPDX-License-Identifier: MIT
// Fullscreen image viewer on the native <dialog> element: Escape and backdrop
// clicks come for free, and the page behind stays inert while it is open.

export function openLightbox(src: string, alt: string): void {
  const dialog = document.createElement("dialog");
  dialog.className = "lightbox";
  const img = document.createElement("img");
  img.src = src;
  img.alt = alt;
  dialog.appendChild(img);
  const close = (): void => {
    dialog.close();
    dialog.remove();
  };
  dialog.addEventListener("click", close);
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });
  document.body.appendChild(dialog);
  dialog.showModal();
}
