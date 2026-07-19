# Configuration

All configuration happens through environment variables (see [.env.example](../.env.example)).

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port the server listens on. |
| `HOST` | `0.0.0.0` | Interface to bind. |
| `DATA_DIR` | `./var` (`/app/var` in Docker) | Runtime data: SQLite database and normalized images. Mount it as a volume. |
| `SESSION_SECRET` | none | **Required for any run except `npm run dev`** (a throwaway dev key is used only there). At least 32 characters; encrypts session cookies. Generate with `openssl rand -base64 48`. Changing it signs everyone out. |
| `PUBLIC_URL` | empty | Public URL of the site, no trailing slash (e.g. `https://tastes.example.com`). Feeds absolute URLs to OpenGraph previews, the Atom feed and the sitemap. Strongly recommended on any public instance; without it previews degrade to relative URLs and the feed falls back to the request host. |
| `COOKIE_SECURE` | `0` (`1` when `NODE_ENV=production`) | Set to `1` when served over HTTPS so session cookies are HTTPS-only. Set to `0` explicitly for plain-HTTP LAN deployments, otherwise login silently fails. |
| `TRUST_PROXY` | `0` | Number of reverse proxies in front of the app (`1` for the usual single Caddy/Traefik/nginx). Only that many `X-Forwarded-*` hops are trusted, so clients cannot spoof their IP to the rate limits and login lockout; `0` means no proxy. |
| `SEED_LOCALE` | `en` | Language of the categories and statuses created on first boot: `en` or `fr`. Only read while the database is empty. |
| `ADMIN_RESET` | `0` | Set to `1` for one boot to reset the admin account to `taster` / `changeme` (forced change), then remove it. |
| `LOG_LEVEL` | `info` (`debug` in dev) | Pino verbosity: `fatal`, `error`, `warn`, `info`, `debug`, `trace`. |
| `DB_PATH` | `DATA_DIR/taster.db` | Override the SQLite file location (rarely needed). |
| `PUBLIC_DIR` | bundled | Override the client bundle location (rarely needed). |

## In-app settings

The Application tab of the admin stores a few instance settings in the database rather than the environment: the application name (shown in the header, the browser tab, the PWA manifest, the Atom feed and link previews), the theme, and the default language served to first-time visitors (visitors who explicitly pick a language in the header keep their choice). To offer more themes, drop additional `.css` files in `DATA_DIR/themes`: they are served under `/themes/` and listed automatically in the tab. A theme file overrides the custom properties defined by the built-in theme; start from a copy of [client/src/styles/themes/default.css](../client/src/styles/themes/default.css) and keep its selectors (`:root, :root[data-theme="light"]` for light, `:root[data-theme="dark"]` for dark), otherwise the built-in values win on specificity. The same tab also offers two destructive resets (all tastes, all categories) guarded by a type-to-confirm dialog.
