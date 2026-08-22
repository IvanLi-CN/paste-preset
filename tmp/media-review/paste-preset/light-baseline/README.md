# PastePreset light reconstruction baseline

This candidate is a visual acceptance baseline, not an official asset. It is
rendered from the authoritative light source without a theme transform. The
only passing result is a pixel-identical final image (`AE=0`) at the canonical
size.

## Canonical sources

- Poster: `/Users/ivan/Projects/Ivan/paste-preset/docs/assets/paste-preset-poster.png`
  (`3072x3840`)
- Social: `/Users/ivan/Projects/Ivan/paste-preset/public/social-preview.png`
  (`1280x640`)

## Reproducibility

- `templates/controlled-edit.sh` runs the required `cvm-imagegen edit` calls
  only as bounded, no-change verification layers. They never become the final
  candidate because exact source fidelity is the acceptance requirement.
- `templates/render-and-verify.sh` uses the SVGs as the immutable layout
  contract, retains canonical PNG bytes for the final raster layer to avoid
  color-management drift, creates side-by-side/overlay/difference proof, then
  fails unless both pixel comparisons report `AE=0`.

## Fixed visual contract

The final images preserve every source pixel: the PastePreset logo and all
wording, browser and mobile mockups, source/result forest-image comparison,
feature panels, icons, dividers, crop, spacing, palette, and image density.
