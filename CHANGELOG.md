# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Cover images can get a focal point (click the preview in the edit form) that card thumbnails keep centered, so portrait covers stop being cropped mid-face; the point travels through JSON export and import.
- The admin taste list supports bulk actions: check several entries to publish, unpublish or delete them at once.
- The statistics page shows the average rating per category and a timeline of additions per month.
- The footer links to the Atom feed so visitors can subscribe.
- The taste form autosaves a local draft every couple of seconds and restores it when the form reopens, so a crash or a closed tab no longer loses a review in progress.
- The sort direction can be reversed with a dedicated button next to the sort selector.
- JSON imports show a preview (how many entries would be created, updated or rejected) and ask for confirmation before writing anything.
- Cards serve a sharper cover image on high-density (retina) screens.
- Reference links can be reordered with up and down arrows in the edit form.
- The tag field accepts several tags at once, separated by commas, and a hint under the field says so.
- The compact view shows each entry's date when sorting by recent additions or by date.

### Changed

- Tags display in alphabetical order on cards, detail pages and in the edit form.
- Saving a tag under a new casing (for example "aventure" replacing "Aventure") renames it for every taste using it, instead of silently keeping the old spelling.

### Fixed

- JSON exports start with a UTF-8 byte order mark so Windows editors display accents correctly; the import accepts files with or without it.
- Cards keep a uniform 3:2 image height in Chromium-based browsers, matching Firefox.
- The first visible images load at high priority instead of popping in late as one batch over HTTP/1.1.
- Buttons center their content; the password change and login buttons no longer stretch full width with a left-aligned label.

## [0.1.0] - 2026-07-16

- Initial release.
