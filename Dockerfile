# SPDX-License-Identifier: MIT
# Multi-stage build on Debian slim (glibc): sharp ships reliable glibc
# prebuilds for linux amd64 and arm64, so we stay off Alpine/musl.

ARG VERSION=0.0.0
ARG REVISION=unknown

# --- Builder stage ---------------------------------------------------------
FROM node:24-slim AS builder
WORKDIR /app

# Copy workspace manifests first for cached deps install. The lock is
# committed and load-bearing (it pins sharp's linux prebuilds), so install
# with `npm ci`, which follows it exactly and fails loudly on drift.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/

RUN npm ci

# Copy sources and build (shared -> client into server/dist/public -> server).
COPY tsconfig.base.json ./
COPY shared/ ./shared/
COPY server/ ./server/
COPY client/ ./client/

RUN npm run build

# The client bundle lives in server/dist/public and the toolchain is only
# needed in this stage; reinstall just the server workspace's production
# dependencies so the runtime copy carries nothing else.
RUN rm -rf node_modules shared/node_modules server/node_modules client/node_modules \
  && npm ci --omit=dev -w server

# --- Runtime stage ---------------------------------------------------------
FROM node:24-slim AS runtime
ARG VERSION
ARG REVISION
LABEL org.opencontainers.image.title="taster" \
      org.opencontainers.image.description="Self-hosted showcase of your personal tastes: rate, tag and review films, series, video games, recipes and more." \
      org.opencontainers.image.source="https://github.com/qiaeru/taster" \
      org.opencontainers.image.url="https://github.com/qiaeru/taster" \
      org.opencontainers.image.documentation="https://github.com/qiaeru/taster#readme" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="$VERSION" \
      org.opencontainers.image.revision="$REVISION"

RUN apt-get update \
  && apt-get install -y --no-install-recommends tini \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 999 app \
  && useradd --system --uid 999 --gid 999 --home-dir /app --shell /usr/sbin/nologin app

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/var

# --chown on the COPY lines: a separate `chown -R /app` RUN would rewrite
# every copied file into an extra layer and roughly double the image size.
COPY --from=builder --chown=app:app /app/package.json ./
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/shared/package.json shared/
COPY --from=builder --chown=app:app /app/shared/dist shared/dist
COPY --from=builder --chown=app:app /app/server/package.json server/
COPY --from=builder --chown=app:app /app/server/dist server/dist
COPY --from=builder --chown=app:app /app/server/migrations server/migrations

# The volume mount point must exist and be writable (SQLite + uploads).
RUN mkdir -p /app/var && chown app:app /app/var
USER app

EXPOSE 3000
# /healthz sits outside the rate limiter so the probe never eats the budget.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/healthz').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server/dist/index.js"]
