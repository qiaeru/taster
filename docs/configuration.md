# Configuration

All configuration happens through environment variables (see [.env.example](../.env.example)).

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port the server listens on. |
| `HOST` | `0.0.0.0` | Interface to bind. |
| `DATA_DIR` | `./var` (`/app/var` in Docker) | Runtime data: SQLite database and normalized images. Mount it as a volume. |
| `SESSION_SECRET` | none | **Required in production.** At least 32 characters; encrypts session cookies. Generate with `openssl rand -base64 48`. Changing it signs everyone out. |
| `PUBLIC_URL` | empty | Public URL of the site, no trailing slash (e.g. `https://tastes.example.com`). Feeds absolute URLs to OpenGraph previews, the Atom feed and the sitemap. Strongly recommended on any public instance; without it previews degrade to relative URLs and the feed falls back to the request host. |
| `COOKIE_SECURE` | `0` (`1` when `NODE_ENV=production`) | Set to `1` when served over HTTPS so session cookies are HTTPS-only. Set to `0` explicitly for plain-HTTP LAN deployments, otherwise login silently fails. |
| `TRUST_PROXY` | `0` | Set to `1` behind a reverse proxy so `X-Forwarded-*` headers are honored (client IPs for rate limiting, protocol for cookies). |
| `SEED_LOCALE` | `fr` | Language of the categories and statuses created on first boot: `fr` or `en`. Only read while the database is empty. |
| `ADMIN_RESET` | `0` | Set to `1` for one boot to reset the admin account to `taster` / `changeme` (forced change), then remove it. |
| `LOG_LEVEL` | `info` (`debug` in dev) | Pino verbosity: `fatal`, `error`, `warn`, `info`, `debug`, `trace`. |
| `DB_PATH` | `DATA_DIR/taster.db` | Override the SQLite file location (rarely needed). |
| `PUBLIC_DIR` | bundled | Override the client bundle location (rarely needed). |
