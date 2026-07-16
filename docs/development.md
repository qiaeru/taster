# Development

## Prerequisites

- Node.js 24 or newer (the server uses the built-in `node:sqlite` module).
- npm (the repo is an npm workspaces monorepo: `shared`, `server`, `client`).

## Setup

```bash
npm install
npm run dev
```

`npm run dev` starts the Fastify server on port 3000 (tsx watch) and the Vite dev server on port 5173 with a proxy for `/api`, `/uploads`, `/healthz` and the SEO endpoints. Open http://localhost:5173.

First boot seeds the default categories (locale from `SEED_LOCALE`, English by default) and the admin account `taster` / `changeme` with a forced password change. Runtime data lands in `server/var/` in dev (the `DATA_DIR` default resolves against the server's working directory); delete that folder for a fresh start.

## Scripts

| Command | Effect |
| --- | --- |
| `npm run dev` | Server + client in watch mode. |
| `npm run build` | Full production build: shared, then client (into `server/dist/public`), then server. |
| `npm start` | Run the built server (serves API + client on port 3000). |
| `npm run typecheck` | `tsc -b` across the three workspaces. |
| `npm run lint` / `npm run format` | ESLint / Prettier, optional and never blocking. |
| `npm run clean` | Fresh start: removes build outputs and the runtime data (SQLite database, uploads). Add `-- --deps` to also remove `node_modules` (run `npm install` afterwards). |

## Gotchas

- **Rebuild `shared` after editing `shared/src/`**: server and client import `@taster/shared` through its `dist/`; a stale build causes `Cannot find module` errors. The rebuild itself is manual (`npm run build -w shared`); once done, `npm run dev`'s tsx watch restarts the server automatically.
- **Regenerate `package-lock.json` under WSL, never on Windows.** A Windows regen records only the host's optional native binaries and drops sharp's linux prebuilds, which breaks the Docker build. Remove `node_modules` and the lock first, then regen inside WSL.
- **`node:sqlite` unique violations** surface as `err.code === "ERR_SQLITE_ERROR"` with `errcode === 2067`; use the `isUniqueViolation` helper, never string-compare messages.
- **Icons** resolve through `client/src/components/Icon.ts`: UI icons are statically bundled Heroicons (add new ones to its registry), while any other Heroicons outline name loads as a lazy chunk, so every name works as a category icon. Brand logos (GitHub, OpenStreetMap, Google Maps) come from the simple-icons package through `client/src/components/BrandIcon.ts`; always prefer Simple Icons for brand marks.
- After changing `client/public/logo.svg`, regenerate the favicon and PWA icons with `node scripts/generate-icons.mjs` (run it from `server/` or anywhere sharp resolves). The script does not cover `client/public/favicon.ico`; rebuild that one with [RealFaviconGenerator](https://realfavicongenerator.net/).
