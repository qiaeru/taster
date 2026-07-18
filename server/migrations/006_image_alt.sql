-- SPDX-License-Identifier: MIT
-- Optional description of the cover image: alt text for screen readers,
-- shown as the native hover tooltip on the detail page, also a place for
-- credits. NULL or empty means none (the image stays decorative).
ALTER TABLE tastes ADD COLUMN image_alt TEXT;
