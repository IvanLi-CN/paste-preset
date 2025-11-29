# PastePreset – TODO

Tracking gaps between the implementation and the v1 design in `docs/design.md`.

## Functional gaps

- [x] Resolution lock behavior  
  Implement `lockAspectRatio` semantics so that when it is enabled, editing width or height updates the other dimension based on the current image aspect ratio (or the current target aspect), and when disabled the dimensions behave independently.

- [x] Clipboard UX improvements  
  - [x] Expand paste handling (optionally window-level) so that pasting while the app is focused is more forgiving.  
  - [x] Show a clear error when there is no image data in the clipboard.

- [x] Result card state & labels  
  Add visual “selected” treatment for the current result image card and status labels such as “Resized to …” and “Stripped metadata / Metadata preserved” to match the design examples.

- [x] Copy to clipboard UX  
  Support `Ctrl/Cmd + C` on the result preview area to trigger image copy, and improve fallback messaging when programmatic image copy is not available (guiding users to use the browser’s context menu or shortcuts).

- [x] Download file naming  
  Use a timestamp-based default filename of the form `pastepreset-YYYYMMDD-HHMMSS.ext` for downloaded results, where `ext` is derived from the output MIME type.

- [x] EXIF orientation & metadata semantics  
  Clarify and implement how the `Strip metadata` option affects EXIF orientation handling (at minimum: whether EXIF orientation is applied and then discarded vs. preserved).

- [x] Large-image handling  
  Improve behavior for very large images (e.g. progressive downscaling or explicit “image too large to process” errors instead of relying solely on canvas failures).

- [x] Accessibility polish  
  Add ARIA labels and keyboard focus affordances for key actions (paste area, copy/download buttons, status messages) to better align with the accessibility goals in the design.
