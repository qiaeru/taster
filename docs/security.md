# Security

## Model

Taster is a public showcase with a single trusted editor. Visitors have read-only access to published content; every mutation requires the admin session. There are no other accounts.

## Measures

- **Passwords**: Argon2id via hash-wasm (t=3, m=19 MiB, OWASP-aligned), a strength policy (12+ characters, character classes, zxcvbn score with EN + FR dictionaries), account lockout after 10 failures (15 minutes), per-route rate limits on login and password change, and a forced change of the seeded `changeme` password at first login.
- **Sessions**: encrypted, signed cookies (`@fastify/secure-session`), `HttpOnly`, `SameSite=Strict`, `Secure` when `COOKIE_SECURE=1`, invalidated server-side by a session epoch on every password change.
- **CSRF**: double-submit token (`x-csrf-token` header) on every mutating `/api` request; login is exempt (no session yet) but covered by `SameSite=Strict` and its rate limit.
- **Headers**: strict CSP (`default-src 'self'`, no inline scripts, no external hosts), `frame-ancestors 'none'`, restrictive Permissions-Policy, HSTS when secure. Unlike a private app there is no noindex: the site is meant to be indexed, and robots.txt only excludes `/admin` and `/api`.
- **Uploads**: images are validated by magic bytes (never trusting filenames or MIME headers), capped at 5 MB, then fully re-encoded by sharp into WebP; the user-provided original is never stored or served. Stored filenames are random UUIDs.
- **Input validation**: shared server-side validation for all taste writes (admin API and JSON import), URL fields restricted to http(s), JSON Schema validation on route bodies, drafts indistinguishable from missing content for visitors (list, detail, feed, sitemap and OpenGraph all filter on published).
- **Runtime**: zero external network calls (no CDN, no telemetry, self-hosted fonts and icons), non-root container user, read-only public endpoints rate-limited globally.

## Reporting

Please report vulnerabilities privately through GitHub security advisories on the repository rather than public issues.
