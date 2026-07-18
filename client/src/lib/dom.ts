// SPDX-License-Identifier: MIT
// Small DOM predicates shared by the global keyboard shortcuts.

/** True when the event target is a place where the visitor is typing. */
export function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}
