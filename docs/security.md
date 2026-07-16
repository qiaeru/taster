# Security

## Model

Taster is a public showcase with a single trusted editor. Visitors have read-only access to published content; every mutation requires the admin session. There are no other accounts.

## Measures

- **Passwords**: Argon2id via hash-wasm (t=3, m=19 MiB, OWASP-aligned), a strength policy (12+ characters, character classes, zxcvbn score with EN + FR dictionaries), a per-IP lockout after 10 failed logins (15 minutes), per-route rate limits on login and password change, and a forced change of the seeded `changeme` password at first login.
- **Sessions**: encrypted, signed cookies (`@fastify/secure-session`), `HttpOnly`, `SameSite=Strict`, `Secure` when `COOKIE_SECURE=1`, a 30-day expiry enforced server-side inside the encrypted payload, invalidated server-side by a session epoch on every password change.
- **CSRF**: double-submit token (`x-csrf-token` header) on every mutating `/api` request; login is exempt (no session yet) but covered by `SameSite=Strict` and its rate limit.
- **Headers**: strict CSP (`default-src 'self'`, no inline scripts, no external hosts), `frame-ancestors 'none'`, restrictive Permissions-Policy, HSTS when secure. Unlike a private app there is no noindex: the site is meant to be indexed, and robots.txt only excludes `/admin` and `/api`.
- **Uploads**: images are validated by magic bytes (never trusting filenames or MIME headers), capped at 5 MB, then fully re-encoded by sharp into WebP; the user-provided original is never stored or served. Stored filenames are random UUIDs.
- **Input validation**: shared server-side validation for all taste writes (admin API and JSON import), URL fields restricted to http(s), JSON Schema validation on route bodies, drafts indistinguishable from missing content for visitors (list, detail, feed, sitemap and OpenGraph all filter on published).
- **Runtime**: zero external network calls (no CDN, no telemetry, self-hosted fonts and icons), non-root container user, read-only public endpoints rate-limited globally.

## Accepted tradeoffs

- **Stateless sessions**: sessions live in an encrypted cookie, not in the database, so logging out clears the browser cookie but cannot revoke a copy stolen beforehand. A stolen cookie stays valid until its 30-day expiry or until the next password change, which bumps the session epoch and kills every session at once; changing the password is therefore the kill switch if a device is compromised.
- **Per-IP login lockout**: failed logins are counted per source IP (in memory, reset on restart), so an attacker only ever blocks their own address and can never lock the admin out. The flip side is that an attacker rotating IPs is throttled only by the per-IP rate limit; with the mandatory 12+ character zxcvbn-checked password and the Argon2id verification cost, an online brute force remains impractical. Behind a reverse proxy, set `TRUST_PROXY=1` so the real client IP is used rather than the proxy's.
- **Host header fallback**: when `PUBLIC_URL` is unset, the Atom feed and sitemap build their URLs from the request's Host header, which a client can forge. Always set `PUBLIC_URL` on an internet-facing instance. The Caddy and Traefik deploy variants derive it from the required `TASTER_DOMAIN`; the nginx variant expects it in the environment.

## Reporting

Please report vulnerabilities privately through GitHub security advisories on the repository rather than public issues.
