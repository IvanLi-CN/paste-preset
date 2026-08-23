# PastePreset dark reconstruction review

This is a review-only dark reconstruction built from the accepted light
baseline. It is not an official asset.

## Canonical Source And Retained Structure

- Poster source: `/Users/ivan/Projects/Ivan/paste-preset/docs/assets/paste-preset-poster.png`
  (`3072x3840`)
- Social source: `/Users/ivan/Projects/Ivan/paste-preset/public/social-preview.png`
  (`1280x640`)
- Brand source: `/Users/ivan/Projects/Ivan/paste-preset/public/brand/paste-preset-logo-dark.svg`

The two candidates retain the source canvas, framing, browser/mobile mockup
positions, source/result forest preview, feature-card count, and lower feature
row. The dark treatment changes only surface, border, and typography color.

## Construction And Review

`templates/controlled-edit.sh` runs only `cvm-imagegen edit` against the
canonical source images. `poster-dark.svg` and `social-dark.svg` use the
controlled output as a bounded surface/photo layer, then rebuild the external
brand lockup, main display copy, and low-contrast critical panel geometry as
deterministic SVG layers. `templates/render.sh` writes the final candidates and
the side-by-side, transparent-overlay, overlay-on-source, and difference proof.

## Immutable Positions

| Format | Lockup | Desktop browser | Mobile browser |
| --- | --- | --- | --- |
| Poster | x=137, y=142 | x=1103, y=120, w=1821, h=2017 | x=290, y=1835, w=705, h=1507 |
| Social | x=78, y=47 | x=495, y=0, w=670, h=638 | x=1092, y=345, w=155, h=285 |
