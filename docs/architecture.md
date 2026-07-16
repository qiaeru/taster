# Architecture

Taster is a single Node.js process: a Fastify 5 server that serves the JSON API, the normalized images, the SEO endpoints and the static client bundle. Data lives in one SQLite file (through Node's built-in `node:sqlite`, zero native database dependency) plus an `uploads/` folder, both under `DATA_DIR`.

## Repository layout

- `shared/` holds the TypeScript models and the JSON import/export schema, consumed by both other workspaces as `@taster/shared`. Rebuild it (`npm run build -w shared`) after editing.
- `server/` is the Fastify backend: `src/routes/` (public read API, auth, admin CRUD, import/export, SEO), `src/plugins/` (session, CSRF, rate limit, security headers, static), `src/lib/` (auth guards, password policy, image pipeline, taste read/write, import/export, OG template rendering), `src/db/` (connection, migration runner, first-boot seed) and `migrations/*.sql`.
- `client/` is a Vite + vanilla TypeScript app, no UI framework: components are plain functions returning DOM elements, pages live under `src/pages/` and are lazy-loaded by the history-API router.

## Key design decisions

- **Public read, single admin.** Visitors browse without an account; every mutation sits behind one admin session (Argon2id password, encrypted session cookie, CSRF double-submit, login rate limit and lockout, forced password change on first boot).
- **Client-side filtering.** `GET /api/tastes` returns every published summary at once with an ETag derived from a `data_revision` counter bumped on each mutation, so an unchanged catalog answers 304. A personal catalog is hundreds of rows; filtering, search and sorting are instant in the browser and need no server round-trip. Revisit only past a few thousand entries.
- **Real URLs + server-side OpenGraph.** The client routes with the history API and the server answers any unknown GET with `index.html`; for `/taste/:id` it injects `<title>` and OpenGraph meta into the `<!--og:head-->` placeholder so shared links unfurl into preview cards. Spoilers are stripped from the generated descriptions.
- **Images are always normalized.** Every incoming image (multipart upload or base64 in a JSON import) is validated by magic bytes then re-encoded with sharp into two WebP variants: a ~480 px thumbnail served in list cards and a 1600 px display variant for the detail page. The original is never stored, so nothing heavy is ever served. The client additionally downscales before uploading to save bandwidth; that is an optimization, not the security boundary.
- **Flexible dates as plain strings.** A reference date is `"YYYY"`, `"YYYY-MM"` or `"YYYY-MM-DD"`; the length encodes the precision and lexicographic order matches chronological order, so one TEXT column covers all three.
- **Per-category statuses.** Each category owns its ordered status list (movies: Watched / Watching / To watch; games: Finished / Playing / Dropped / To play...). Status ids are preserved across edits so tastes keep their status when a list is reordered or renamed.
- **Reviews as sections.** A review is a list of sections (optional subtitle, optional 1-5 sub-rating, Markdown body); a single untitled section is a simple review, and an `externalReviewUrl` replaces the written review with a "read the full review" link. Markdown renders client-side with marked + DOMPurify (dynamically imported so the list bundle stays light); the `||spoiler||` extension emits an accessible click-to-reveal button.

## Theming

Themes are a CSS custom-property contract. `client/src/styles/themes/default.css` defines every variable (`--bg`, `--fg`, `--accent`, shadows...) for light (`:root`) and dark (`[data-theme="dark"]`); `client/src/styles/app.css` maps them onto Tailwind v4 tokens with `@theme inline`, so utilities like `bg-elev` resolve through the active theme. `client/src/lib/theme.ts` persists the choice in localStorage and falls back to `prefers-color-scheme`. A future theme is one more CSS file redefining the same variables plus an entry in the `THEMES` registry; components never change. Category accents flow through a `--cat-color` inline variable.

## GPS links

Coordinates render as a `geo:lat,lng` link (Android opens the user's preferred maps app chooser; iOS handles the scheme poorly) plus always-visible OpenStreetMap and Google Maps links. These are outbound links the visitor clicks; the app itself performs zero external network calls (no embedded map tiles, no CDN, no telemetry).

## Data flow for a mutation

Admin form → `POST/PUT /api/admin/tastes` → shared validation in `server/src/lib/tasteWrite.ts` (also used by the JSON import, so both paths enforce identical rules) → transactional write that replaces sections/tags/links atomically, garbage-collects orphan tags and bumps `data_revision` → clients re-fetch the list on their next navigation and the ETag changes.
