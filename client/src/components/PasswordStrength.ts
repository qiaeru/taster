// SPDX-License-Identifier: MIT
// Live password strength feedback under the "new password" field: a rule
// checklist plus a zxcvbn score meter, mirroring the server policy so the
// admin sees why a password will be rejected before submitting. The server
// remains the enforcement point; zxcvbn (with its EN + FR dictionaries, the
// same set the server scores with) loads lazily on first keystroke.

import { api } from "../api.js";
import { t } from "../i18n/index.js";

interface PasswordPolicy {
  minLength: number;
  requireUpper: boolean;
  requireLower: boolean;
  requireDigit: boolean;
  requireSpecial: boolean;
  zxcvbnMinScore: number;
}

const FALLBACK_POLICY: PasswordPolicy = {
  minLength: 12,
  requireUpper: true,
  requireLower: true,
  requireDigit: true,
  requireSpecial: true,
  zxcvbnMinScore: 4,
};

let policyPromise: Promise<PasswordPolicy> | null = null;
function loadPolicy(): Promise<PasswordPolicy> {
  policyPromise ??= api
    .get<PasswordPolicy>("/api/auth/password-policy")
    .catch(() => FALLBACK_POLICY);
  return policyPromise;
}

type Scorer = (password: string, userInputs: string[]) => number;
let scorerPromise: Promise<Scorer> | null = null;
function loadScorer(): Promise<Scorer> {
  scorerPromise ??= Promise.all([
    import("@zxcvbn-ts/core"),
    import("@zxcvbn-ts/language-common"),
    import("@zxcvbn-ts/language-en"),
    import("@zxcvbn-ts/language-fr"),
  ]).then(([core, common, en, fr]) => {
    const factory = new core.ZxcvbnFactory({
      translations: en.translations,
      graphs: common.adjacencyGraphs,
      dictionary: { ...common.dictionary, ...en.dictionary, ...fr.dictionary },
    });
    return (password, userInputs) => factory.check(password, userInputs).score;
  });
  return scorerPromise;
}

interface HardRules {
  minLength: boolean;
  upper: boolean;
  lower: boolean;
  digit: boolean;
  special: boolean;
  noWhitespace: boolean;
}

function evaluateHardRules(password: string, policy: PasswordPolicy): HardRules {
  return {
    minLength: password.length >= policy.minLength,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    noWhitespace: !/\s/.test(password),
  };
}

/**
 * Renders the strength meter under `input` and keeps it in sync on every
 * keystroke. Purely informative: submission stays possible, the server has
 * the final say.
 */
export function bindPasswordStrength(input: HTMLInputElement, host: HTMLElement): void {
  host.className = "pw-strength";

  const bar = document.createElement("div");
  bar.className = "pw-strength-bar";
  const fill = document.createElement("div");
  fill.className = "pw-strength-fill";
  bar.appendChild(fill);

  const label = document.createElement("p");
  label.className = "pw-strength-label";
  label.setAttribute("aria-live", "polite");

  const rules = document.createElement("ul");
  rules.className = "pw-strength-rules";
  const ruleItems = new Map<keyof HardRules, HTMLLIElement>();

  host.append(bar, label, rules);

  void loadPolicy().then((policy) => {
    const defs: Array<{ key: keyof HardRules; text: string; enabled: boolean }> = [
      {
        key: "minLength",
        text: t("password.policy.minLength", { min: policy.minLength }),
        enabled: true,
      },
      { key: "upper", text: t("password.policy.upper"), enabled: policy.requireUpper },
      { key: "lower", text: t("password.policy.lower"), enabled: policy.requireLower },
      { key: "digit", text: t("password.policy.digit"), enabled: policy.requireDigit },
      { key: "special", text: t("password.policy.special"), enabled: policy.requireSpecial },
      { key: "noWhitespace", text: t("password.policy.noWhitespace"), enabled: true },
    ];
    for (const def of defs) {
      if (!def.enabled) continue;
      const li = document.createElement("li");
      li.textContent = def.text;
      ruleItems.set(def.key, li);
      rules.appendChild(li);
    }

    let lastScoreShown = -1;
    const update = async (): Promise<void> => {
      const value = input.value;
      const checks = evaluateHardRules(value, policy);
      for (const [key, li] of ruleItems) {
        li.classList.toggle("ok", value.length > 0 && checks[key]);
      }
      if (!value) {
        fill.style.width = "0";
        fill.dataset.score = "";
        label.textContent = "";
        lastScoreShown = -1;
        return;
      }
      const score = (await loadScorer())(value, []);
      // The input may have changed while zxcvbn loaded; a newer run repaints.
      if (input.value !== value) return;
      fill.style.width = `${(score / 4) * 100}%`;
      fill.dataset.score = String(score);
      // Only rewrite the live region when the tier changes, so screen readers
      // are not spammed on every keystroke.
      if (score !== lastScoreShown) {
        lastScoreShown = score;
        label.textContent = t(`password.strength.${score}`);
      }
    };
    input.addEventListener("input", () => void update());
    void update();
  });
}
