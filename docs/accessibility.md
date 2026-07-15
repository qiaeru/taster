# Accessibility

Accessibility choices baked into the UI:

- **Semantic structure**: one `<main>` per page (focused on navigation so keyboard and screen-reader users land in the new view), a skip-to-content link, real headings, and lists/anchors where content is navigational.
- **Star ratings**: display stars carry a `role="img"` with an explicit label ("Rating: 4 out of 5 (Good)"); the input variant is a native radiogroup, so arrow keys, focus states and announcements come from the platform, plus a clear button since rating is optional.
- **Spoilers** render as real `<button aria-pressed>` elements, toggling their label between show and hide; the hidden text is invisible but the control is fully keyboard-operable.
- **Filters** expose state through `aria-pressed` on toggle chips, labeled selects, and a `role="group"` per filter cluster. The theme toggle exposes `aria-pressed` for the dark state; the language toggle is labeled in the target language.
- **Images**: card thumbnails are decorative (`alt=""`) since the adjacent title carries the information; the detail hero uses the taste title as alt. Fixed width/height attributes avoid layout shifts that disorient magnifier users.
- **Dialogs and toasts**: confirmation uses the native `<dialog>` element (focus trap and Escape for free, with Escape mapped to cancel); error toasts use `role="alert"`, informational ones `role="status"`.
- **Color and contrast**: both light and dark schemes keep text on `--bg`/`--bg-elev` at WCAG AA contrast; category colors are always paired with an icon and a text label, never the only carrier of meaning.
- **Motion**: transitions are short opacity/color fades; no autoplaying or parallax motion.

Known limits: the tag suggestion list relies on the native `datalist`, whose screen-reader experience varies by browser, and drag-free reordering (up/down buttons) was chosen over drag-and-drop precisely for keyboard operability.
