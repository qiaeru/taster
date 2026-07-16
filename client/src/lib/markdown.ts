// SPDX-License-Identifier: MIT
// Markdown rendering: marked + DOMPurify, loaded dynamically so the list
// bundle stays light. A marked extension turns ||text|| into an accessible
// click-to-reveal spoiler button; it runs before sanitization and DOMPurify
// keeps button/aria attributes, so the output stays safe.

import { t } from "../i18n/index.js";
import { tip } from "../components/Tooltip.js";

type Marked = typeof import("marked");
type DomPurifyModule = typeof import("dompurify");

let enginePromise: Promise<{ marked: Marked; purify: DomPurifyModule["default"] }> | null = null;

async function getEngine() {
  if (!enginePromise) {
    enginePromise = Promise.all([import("marked"), import("dompurify")]).then(
      ([markedMod, dompurifyMod]) => {
        const purify = dompurifyMod.default;
        // External links open in a new tab without opener access. Scheme
        // match is case-insensitive: "HTTPS://" would otherwise slip through
        // with a hand-written rel="opener".
        purify.addHook("afterSanitizeAttributes", (node) => {
          if (node.tagName !== "A") return;
          if (/^https?:/i.test(node.getAttribute("href") ?? "")) {
            node.setAttribute("target", "_blank");
            node.setAttribute("rel", "noopener noreferrer");
          } else if (node.getAttribute("target") === "_blank") {
            // Hand-written _blank anchors on other schemes never keep a
            // custom rel (rel="opener" would allow tabnabbing).
            node.setAttribute("rel", "noopener noreferrer");
          }
        });
        markedMod.marked.use({
          extensions: [
            {
              name: "spoiler",
              level: "inline",
              start(src: string) {
                const i = src.indexOf("||");
                return i < 0 ? undefined : i;
              },
              tokenizer(src: string) {
                const match = /^\|\|([\s\S]+?)\|\|/.exec(src);
                if (!match) return undefined;
                return {
                  type: "spoiler",
                  raw: match[0],
                  tokens: this.lexer.inlineTokens(match[1]),
                };
              },
              renderer(token) {
                const inner = this.parser.parseInline(
                  (token as { tokens: import("marked").Token[] }).tokens
                );
                return `<button type="button" class="spoiler" aria-pressed="false"><span class="spoiler-inner">${inner}</span></button>`;
              },
            },
          ],
        });
        return { marked: markedMod, purify };
      }
    );
  }
  return enginePromise;
}

export async function renderMarkdown(md: string): Promise<HTMLElement> {
  const { marked, purify } = await getEngine();
  const html = await marked.marked.parse(md, { async: true, gfm: true, breaks: true });
  const container = document.createElement("div");
  container.className = "prose";
  // Defense in depth on top of DOMPurify's defaults: reviews have no business
  // containing form controls or inline styles (CSP blocks them anyway).
  container.innerHTML = purify.sanitize(html, {
    FORBID_TAGS: ["form", "input", "select", "textarea", "style"],
    FORBID_ATTR: ["style"],
  });
  wireSpoilers(container);
  return container;
}

function wireSpoilers(container: HTMLElement): void {
  for (const spoiler of container.querySelectorAll<HTMLButtonElement>("button.spoiler")) {
    tip(spoiler, t("spoiler.show"));
    spoiler.setAttribute("aria-label", t("spoiler.show"));
    spoiler.addEventListener("click", () => {
      const revealed = spoiler.getAttribute("aria-pressed") === "true";
      spoiler.setAttribute("aria-pressed", String(!revealed));
      const label = revealed ? t("spoiler.show") : t("spoiler.hide");
      tip(spoiler, label);
      spoiler.setAttribute("aria-label", label);
    });
  }
}
