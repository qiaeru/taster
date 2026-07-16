// SPDX-License-Identifier: MIT
// Attribution footer rendered on every page. Mirrors the lockup used on the
// owner's other projects (meetingtime, couplecards).

import { siGithub } from "simple-icons";
import { brandIcon } from "./BrandIcon.js";
import { t } from "../i18n/index.js";

const REPO_URL = "https://github.com/qiaeru/taster";
const AUTHOR_URL = "https://qiae.ru";

export function renderFooter(): HTMLElement {
  const footer = document.createElement("footer");
  footer.className = "site-footer";

  const developedBy = document.createElement("span");
  developedBy.textContent = t("footer.developedBy");

  const author = document.createElement("a");
  author.className = "site-footer-link";
  author.href = AUTHOR_URL;
  author.target = "_blank";
  author.rel = "noopener noreferrer";
  author.setAttribute("aria-label", "Qiaeru");
  // qiae.ru lockup: the head sits on an organic orange blob drawn in CSS
  // (::before), mirroring the source site. The blob is not part of the SVG.
  const logoWrap = document.createElement("span");
  logoWrap.className = "qiaeru-logo";
  const logo = document.createElement("img");
  logo.className = "site-footer-logo";
  logo.src = "/icons/qiaeru.svg";
  logo.alt = "Qiaeru";
  logo.width = 22;
  logo.height = 22;
  logo.draggable = false;
  logoWrap.appendChild(logo);
  author.appendChild(logoWrap);

  const sep = document.createElement("span");
  sep.className = "site-footer-sep";
  sep.setAttribute("aria-hidden", "true");
  sep.textContent = "|";

  const sourceCode = document.createElement("span");
  sourceCode.textContent = t("footer.sourceCode");

  const repo = document.createElement("a");
  repo.className = "site-footer-link";
  repo.href = REPO_URL;
  repo.target = "_blank";
  repo.rel = "noopener noreferrer";
  repo.setAttribute("aria-label", "GitHub");
  repo.appendChild(brandIcon(siGithub, "site-footer-logo"));

  footer.append(developedBy, author, sep, sourceCode, repo);
  return footer;
}
