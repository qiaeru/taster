// SPDX-License-Identifier: MIT
// Argon2id hashing via hash-wasm (no native compile) and zxcvbn-ts strength
// scoring with the EN + FR dictionaries.

import { randomBytes } from "node:crypto";
import { argon2id, argon2Verify } from "hash-wasm";
import { ZxcvbnFactory } from "@zxcvbn-ts/core";
import * as zxcvbnCommonPackage from "@zxcvbn-ts/language-common";
import * as zxcvbnEnPackage from "@zxcvbn-ts/language-en";
import * as zxcvbnFrPackage from "@zxcvbn-ts/language-fr";

const zxcvbn = new ZxcvbnFactory({
  translations: zxcvbnEnPackage.translations,
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
  dictionary: {
    ...zxcvbnCommonPackage.dictionary,
    ...zxcvbnEnPackage.dictionary,
    ...zxcvbnFrPackage.dictionary,
  },
});

// Argon2id parameters above the OWASP minimum (t=2, m=19 MiB). Bumped to
// t=3 to widen the margin against GPU/ASIC attacks at a ~15 ms login cost.
// Existing hashes keep verifying since the PHC string encodes its own params.
const ARGON2_PARAMS = {
  parallelism: 1,
  iterations: 3,
  memorySize: 19456, // KiB, 19 MiB
  hashLength: 32,
  outputType: "encoded",
} as const;

export const POLICY = {
  minLength: 12,
  requireUpper: true,
  requireLower: true,
  requireDigit: true,
  requireSpecial: true,
  zxcvbnMinScore: 4,
};

export interface PasswordCheck {
  ok: boolean;
  code?: string;
  score: number;
  feedback?: unknown;
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = new Uint8Array(randomBytes(16));
  return argon2id({ password: plain, salt, ...ARGON2_PARAMS });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2Verify({ password: plain, hash });
  } catch (err) {
    // Log the throw: silently returning false would masquerade a malformed
    // PHC string or a WebAssembly load failure as "wrong password".
    console.error("[password.verify] argon2Verify threw:", (err as Error)?.message || err);
    return false;
  }
}

export function validatePassword(
  password: unknown,
  { userInputs = [] as string[] } = {}
): PasswordCheck {
  if (typeof password !== "string") {
    return { ok: false, code: "PASSWORD_INVALID", score: 0 };
  }
  if (password.length < POLICY.minLength) {
    return { ok: false, code: "PASSWORD_TOO_SHORT", score: 0 };
  }
  if (/\s/.test(password)) {
    return { ok: false, code: "PASSWORD_CONTAINS_WHITESPACE", score: 0 };
  }
  if (POLICY.requireUpper && !/[A-Z]/.test(password)) {
    return { ok: false, code: "PASSWORD_MISSING_UPPER", score: 0 };
  }
  if (POLICY.requireLower && !/[a-z]/.test(password)) {
    return { ok: false, code: "PASSWORD_MISSING_LOWER", score: 0 };
  }
  if (POLICY.requireDigit && !/\d/.test(password)) {
    return { ok: false, code: "PASSWORD_MISSING_DIGIT", score: 0 };
  }
  if (POLICY.requireSpecial && !/[^A-Za-z0-9]/.test(password)) {
    return { ok: false, code: "PASSWORD_MISSING_SPECIAL", score: 0 };
  }
  const lower = password.toLowerCase();
  for (const input of userInputs) {
    if (!input) continue;
    if (lower.includes(String(input).toLowerCase())) {
      return { ok: false, code: "PASSWORD_CONTAINS_USERNAME", score: 0 };
    }
  }

  const result = zxcvbn.check(password, userInputs.filter(Boolean));
  if (result.score < POLICY.zxcvbnMinScore) {
    return { ok: false, code: "PASSWORD_TOO_WEAK", score: result.score, feedback: result.feedback };
  }
  return { ok: true, score: result.score };
}
