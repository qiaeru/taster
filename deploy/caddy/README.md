# Taster behind Caddy (HTTPS)

This is the simplest way to expose Taster over HTTPS. Caddy negotiates a Let's Encrypt certificate automatically on first start, with no extra tooling.

## Prerequisites

- A domain name whose DNS record points to your server's public IP address.
- Ports 80 and 443 open in your firewall.
- Docker and the Docker Compose plugin installed.

## Steps

1. Export your domain and a session secret, then start the stack from the project root:

   ```bash
   export TASTER_DOMAIN=tastes.example.com
   export SESSION_SECRET="$(openssl rand -base64 48)"
   docker compose -f deploy/caddy/docker-compose.caddy.yml up -d
   ```

2. Open `https://tastes.example.com`, click the lock icon in the header and sign in with `taster` / `changeme`. You are forced to choose a new password immediately.

## Notes

- The container runs as UID/GID 999. Before the first start, create the data folder and give it to that user: `mkdir -p var && sudo chown -R 999:999 var` (run from the project root).

- `TRUST_PROXY=1` and `COOKIE_SECURE=1` are set automatically so Fastify honors the `X-Forwarded-*` headers and session cookies stay HTTPS-only.
- `PUBLIC_URL` is derived from `TASTER_DOMAIN` and feeds the OpenGraph previews, the Atom feed and the sitemap with absolute URLs.
- Your data (SQLite database and images) lives in the project's `var/` folder on the host. Back it up.
- Caddy stores its generated certificates in the `caddy_data` Docker volume. Do not delete the volume, because the next start would then trigger a fresh ACME challenge and possibly run into Let's Encrypt rate limits.
- To update the stack: `docker compose -f deploy/caddy/docker-compose.caddy.yml pull && docker compose -f deploy/caddy/docker-compose.caddy.yml up -d`.
