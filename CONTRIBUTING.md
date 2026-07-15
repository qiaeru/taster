# Contributing to Taster

Thank you for considering a contribution. The project is intentionally small and must stay approachable to non-technical maintainers who run their own instance. Changes that keep it simple are the ones most likely to land.

## Ground rules

- **English everywhere in the source tree.** This applies to comments, commit messages, pull request descriptions, documentation, identifiers and route paths. The only French strings in the codebase live in `client/src/i18n/locales/fr.json` (plus the French demo data).
- **No external network calls at runtime.** The app is fully self-contained and must keep running on an air-gapped host: fonts self-hosted through Fontsource, Heroicons bundled, no CDN, nothing fetched from a third party. Outbound links the visitor clicks (maps, references) are fine.
- **No new mandatory tooling** such as linters, formatters or test frameworks that a non-technical maintainer would have to run locally. Build-time tools like Vite and `tsc -b` are fine as long as they remain invisible inside the Docker build.
- **No telemetry, no analytics, no third-party trackers.**

## Development setup

See [docs/development.md](./docs/development.md). In short: Node.js 24+, `npm install`, `npm run dev`, and the client is served at `http://localhost:5173` with the API proxied to port 3000.

## Workflow

Branch from `main`, open a pull request, and let the `build` CI check pass. Keep commits atomic (one feature, one bug-fix, one refactor) and use Conventional Commit prefixes (`fix:`, `feat:`, `chore:`, `docs:`, `refactor:`) optionally scoped with the touched area (`fix(import):`, `feat(list):`). Pull request titles follow the same rule and stay at or below seventy characters.

Before pushing, review every added comment in the diff, update the relevant `docs/*.md` if the change affects public behavior, and tighten the `[Unreleased]` section of `CHANGELOG.md`.

## Code style

- Components are plain functions returning DOM elements (or a small handle object). No UI framework, no class hierarchies.
- Every user-visible string goes through `t("key")` and exists in every locale file; never hardcode natural-language strings in code or HTML.
- No `innerHTML` for arbitrary content. Sanitized Markdown (DOMPurify) and the bundled Heroicons SVGs are the only allowed exceptions.
- Server mutations for tastes go through the shared validation in `server/src/lib/tasteWrite.ts` so the admin API and the JSON import always enforce the same rules.

## Reporting issues

Open a GitHub issue with a minimal reproduction and the browser plus operating system you observed it on. For security-sensitive reports, open a private security advisory on GitHub instead of a public issue.

## License

By submitting a contribution, you agree that it is released under the MIT license shipped with this repo.
