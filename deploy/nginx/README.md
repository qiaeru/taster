# Taster behind nginx (HTTPS)

Use this variant when you already manage certificates with certbot (or another ACME client) on the host.

## Prerequisites

- A domain name whose DNS record points to your server's public IP address.
- A valid certificate under `/etc/letsencrypt/live/<your-domain>/` (for example via `certbot certonly --standalone -d tastes.example.com`).
- Docker and the Docker Compose plugin installed.

## Steps

1. Replace `tastes.example.com` with your domain in [nginx.conf](nginx.conf) (three occurrences).

2. Start the stack from the project root:

   ```bash
   export SESSION_SECRET="$(openssl rand -base64 48)"
   export PUBLIC_URL=https://tastes.example.com
   docker compose -f deploy/nginx/docker-compose.nginx.yml up -d
   ```

3. Open your domain, click the lock icon in the header and sign in with `taster` / `changeme`. You are forced to choose a new password immediately.

## Notes

- The container runs as UID/GID 999. Before the first start, create the data folder and give it to that user: `mkdir -p var && sudo chown -R 999:999 var` (run from the project root).

- `TRUST_PROXY=1` and `COOKIE_SECURE=1` are set automatically; nginx forwards the `X-Forwarded-*` headers the app expects.
- Set `PUBLIC_URL` so OpenGraph previews, the Atom feed and the sitemap carry absolute URLs.
- Your data (SQLite database and images) lives in the project's `var/` folder on the host. Back it up.
- Certificate renewal happens on the host (certbot's systemd timer); reload nginx afterwards with `docker compose -f deploy/nginx/docker-compose.nginx.yml exec nginx nginx -s reload`.
