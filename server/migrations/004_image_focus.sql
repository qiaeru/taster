-- SPDX-License-Identifier: MIT
-- Optional focal point of the cover image, as fractions of its width and
-- height (0..1). NULL means centered; cards use it as CSS object-position
-- so 3:2 crops keep the interesting part of portrait covers visible.
ALTER TABLE tastes ADD COLUMN focus_x REAL;
ALTER TABLE tastes ADD COLUMN focus_y REAL;
