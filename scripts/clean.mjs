// SPDX-License-Identifier: MIT
// Removes locally generated files so the app can be rebuilt and re-tested
// from a clean slate: build outputs, TypeScript incremental state and the
// runtime data directory (SQLite database and uploaded images).
// Usage: npm run clean            (keeps node_modules)
//        npm run clean -- --deps  (also removes node_modules; npm install after)

import { rmSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const targets = [
  "shared/dist",
  "shared/tsconfig.tsbuildinfo",
  "server/dist",
  "server/tsconfig.tsbuildinfo",
  "client/dist",
  "client/tsconfig.tsbuildinfo",
  // Runtime data: server/var in dev (DATA_DIR resolves against server/), var
  // at the repo root when the server was started from there.
  "server/var",
  "var",
];
if (process.argv.includes("--deps")) {
  targets.push("node_modules", "shared/node_modules", "server/node_modules", "client/node_modules");
}

let removed = 0;
for (const rel of targets) {
  const path = resolve(root, rel);
  if (!existsSync(path)) continue;
  rmSync(path, { recursive: true, force: true });
  console.log("removed", rel);
  removed++;
}
console.log(removed ? `done (${removed} removed)` : "already clean");
