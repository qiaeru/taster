# Deployment

Taster ships as a single Docker image: `ghcr.io/qiaeru/taster` (multi-arch, linux/amd64 and linux/arm64). One container, one volume, no external database.

## Quick start (HTTP, LAN or behind your own proxy)

```bash
mkdir taster && cd taster
curl -O https://raw.githubusercontent.com/qiaeru/taster/main/docker-compose.yml
echo "SESSION_SECRET=$(openssl rand -base64 48)" > .env
mkdir -p var && sudo chown -R 999:999 var
docker compose up -d
```

The container runs as a non-root user with **UID 999, GID 999**. The host directory bind-mounted to `/app/var` must be owned by that UID/GID, otherwise the server cannot open the database file and crashes at startup with `unable to open database file`; the `chown` above handles it.

Open http://your-server:3000, click the sign-in icon in the header and sign in with `taster` / `changeme`. You are forced to choose a new password immediately.

To use the prebuilt image instead of building locally, replace the `build: .` and `image: taster:latest` lines with `image: ghcr.io/qiaeru/taster:latest` in the compose file.

## HTTPS

Three ready-made variants live in [deploy/](../deploy):

- [Caddy](../deploy/caddy/README.md): automatic Let's Encrypt, simplest option.
- [nginx](../deploy/nginx/README.md): for hosts already managing certificates with certbot.
- [Traefik](../deploy/traefik/README.md): label-based routing, fits servers already running Traefik.

All three set `TRUST_PROXY=1` and `COOKIE_SECURE=1` and pass `PUBLIC_URL` so OpenGraph previews, the Atom feed and the sitemap carry absolute URLs. Set `PUBLIC_URL` yourself in any custom setup; without it link previews degrade.

## Data and backups

Everything lives in the mounted `var/` folder: `taster.db` (plus its `-wal`/`-shm` companions) and `uploads/`. Back that folder up; restoring it on a fresh container restores the whole instance. The JSON export (admin, Import and export tab, "Include images") is a complementary portable backup, alongside the categories export from the same tab.

## Upgrades

```bash
docker compose pull && docker compose up -d
```

Database migrations run automatically at boot.

## Recovering a lost admin password

Set `ADMIN_RESET=1` in the environment, restart the container once (the account is reset to `taster` / `changeme` with a forced change), then remove the flag and restart again.
