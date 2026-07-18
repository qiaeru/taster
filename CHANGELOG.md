# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Tastes can carry an optional description (a movie's synopsis, a game's pitch) shown on the detail page next to the cover image, with Markdown and spoilers supported. It is searched by the instant search, travels through JSON export and import, and feeds link previews.
- The cover image can carry an optional description: read by screen readers, shown as a tooltip when hovering the image, a natural place for credits. It travels through JSON export and import and is cleared with its image.
- Signed-in admins get quick actions on the public list: a pencil shortcut to the edit form and a heart that toggles the favorite on the spot.
- The admin gets a Tags tab to rename, merge or delete a tag across the whole catalog: a filterable grid of cards whose usage counts open the public list filtered on that tag.
- Categories can be reordered by dragging their cards in the admin; reference links, review sections and statuses gain drag handles alongside the arrows.
- Detail pages end with a "You may also like" strip of same-category tastes and can be browsed with the left and right arrow keys.
- The admin taste list gains a "Drafts" toggle with a live count of unpublished entries.
- The search field gets a clear button, the chosen sort is remembered across visits like the view, and the statistics month bars link to the list filtered on that month.
- The admin sign-in becomes a card floating over a cloud of the catalog's own category icons, drifting at different depths and shying away from the cursor; the first-run password screen shares the backdrop.

### Changed

- The date shown in the grid and list views when sorting by date added reads "Added on ..." like the detail page, which also gains a final period.
- The status, rating and favorites filters sit above the tag cloud, right under the category chips.
- The statistics only list months and ratings that have at least one taste.
- The list no longer shows a result count between the filters and the results: the category chips already carry the numbers.
- Typing a comma in the tag field no longer commits the tag: Enter (or leaving the field) splits "a, b, c" into one tag each.
- Atom feed entries carry a short summary (the synopsis, or the first lines of the review), so feed readers show more than bare titles.

### Fixed

- The image viewer and the confirmation dialogs open centered on the screen again instead of in the top-left corner.
- The favorite heart is geometrically centered in its badge on grid cards.
- On phones, pages no longer wiggle sideways (hidden tooltip bubbles were widening the page) and the list toolbar fits on two rows.
- The "server not responding" message and its Retry button are no longer glued together.
- The home page filter blocks (category chips, filter row, tag cloud) are now evenly spaced, with the same breathing room before the results as after the search bar.

## [0.3.0] - 2026-07-17

### Changed

- The tier list is no longer a separate view: sorting by rating now groups entries by stars in both the grid and list views, and reversing the sort flips the tiers. Old tier-list links open as a rating-sorted list.
- The compact view is renamed "List".
- The grid view shows each entry's date when sorting by date added or reference date, like the list view.

### Fixed

- The sort selector's icon and the reverse button sit properly inside the toolbar instead of overflowing below it.
- The Atom feed link in the footer opens the feed instead of reloading the app, and its icon is no longer glued to the text.

## [0.2.0] - 2026-07-16

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
- Clearer sort names ("Date added", "Reference date") and reworked French interface labels.

### Fixed

- JSON exports start with a UTF-8 byte order mark so Windows editors display accents correctly; the import accepts files with or without it.
- Cards keep a uniform 3:2 image height in Chromium-based browsers, matching Firefox.
- The first visible images load at high priority instead of popping in late as one batch.
- Buttons center their content; the password change and login buttons no longer stretch full width with a left-aligned label.
- The image preview in the edit form shows tall images in full instead of clipping them.

## [0.1.0] - 2026-07-16

- Initial release.
