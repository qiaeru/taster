# Accessibility

Accessibility choices baked into the UI:

- **Semantic structure**: one `<main>` per page (focused on navigation so keyboard and screen-reader users land in the new view), a skip-to-content link, real headings, and lists/anchors where content is navigational.
- **Star ratings**: display stars carry a `role="img"` with an explicit label ("Rating: 4 out of 5 (Good)"); the input variant is a native radiogroup, so arrow keys, focus states and announcements come from the platform, plus a clear button since rating is optional.
- **Spoilers** render as real `<button aria-pressed>` elements, toggling their label between show and hide; the hidden text is invisible but the control is fully keyboard-operable.
- **Filters** expose state through `aria-pressed` on toggle chips, a `role="group"` per filter cluster, and custom select menus (a labeled button with `aria-haspopup="listbox"` opening a `role="listbox"` with arrow, Home, End, Escape and type-to-select support). The theme toggle exposes `aria-pressed` for the dark state; the language picker is a labeled menu button whose items each carry their own `lang` attribute, so a screen reader pronounces each language name in its own language.
- **Images**: card thumbnails are decorative (`alt=""`) since the adjacent title carries the information; the detail hero uses the taste title as alt. Fixed width/height attributes avoid layout shifts that disorient magnifier users.
- **Dialogs and toasts**: confirmation uses the native `<dialog>` element (focus trap and Escape for free, with Escape mapped to cancel); error toasts use `role="alert"`, informational ones `role="status"`.
- **Color and contrast**: both light and dark schemes keep text on `--bg`/`--bg-elev` at WCAG AA contrast; category colors are always paired with an icon and a text label, never the only carrier of meaning.
- **Motion**: page changes use a short cross-fade (View Transitions where supported), with subtle touches like a loading-skeleton shimmer and a die roll on the random button. Everything is disabled under `prefers-reduced-motion: reduce`, and there is no autoplaying or parallax motion.

Known limits: the tag suggestion list relies on the native `datalist`, whose screen-reader experience varies by browser. Reorderable lists offer mouse drag handles as a convenience, but the up/down buttons remain on every list so keyboard and touch users always have an equivalent path; the handles themselves are hidden from assistive tech (`aria-hidden`, unfocusable).
