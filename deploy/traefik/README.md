# Taster behind Traefik (HTTPS)

Use this variant when Traefik already fronts other containers on your server, or when you prefer label-based routing.

## Prerequisites

- A domain name whose DNS record points to your server's public IP address.
- Ports 80 and 443 open in your firewall.
- Docker and the Docker Compose plugin installed.

## Steps

1. Export the required variables and start the stack from the project root:

   ```bash
   export TASTER_DOMAIN=tastes.example.com
   export LETSENCRYPT_EMAIL=you@example.com
   export SESSION_SECRET="$(openssl rand -base64 48)"
   docker compose -f deploy/traefik/docker-compose.traefik.yml up -d
   ```

2. Open `https://tastes.example.com`, click the lock icon in the header and sign in with `taster` / `changeme`. You are forced to choose a new password immediately.

## Notes

- `TRUST_PROXY=1` and `COOKIE_SECURE=1` are set automatically; `PUBLIC_URL` is derived from `TASTER_DOMAIN`.
- Your data (SQLite database and images) lives in the project's `var/` folder on the host. Back it up.
- Traefik stores its ACME state in the `letsencrypt` Docker volume; keep it to avoid re-issuing certificates on every restart.
- If Traefik already runs on the host, drop the `traefik` service from this file and only keep the `taster` service with its labels, attached to your existing Traefik network.
