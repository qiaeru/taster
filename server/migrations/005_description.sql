-- SPDX-License-Identifier: MIT
-- Optional plain-text description (synopsis, pitch) shown on the detail page
-- between the tags and the review. NULL or empty means none.
ALTER TABLE tastes ADD COLUMN description TEXT;
