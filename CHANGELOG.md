# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Public filterable list of tastes with category chips, tag/status/rating/favorite filters, instant search, four sort orders and three views (grid, compact rows, tier list by rating), plus a random pick and shareable filter URLs.
- Taste pages with star ratings, sectioned Markdown reviews with click-to-reveal spoilers, reference links, flexible-precision dates, map links and an external-review call-to-action.
- Admin area behind a hardened login (forced first-boot password change): full taste CRUD with image upload, customizable categories with per-category progress statuses, drafts and favorites.
- Server-side image normalization: every image is re-encoded into light WebP thumbnail and display variants.
- JSON import/export with upsert by id, per-item error reporting, embeddable base64 images, a downloadable template and ready-to-import demo files (FR and EN).
- Real permalinks with OpenGraph previews, Atom feed, sitemap, robots.txt, public statistics page and an installable PWA.
- French and English UI with a light/dark theme.
- Docker packaging (multi-arch), Compose file and HTTPS deployment variants for Caddy, nginx and Traefik.
