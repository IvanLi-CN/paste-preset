# PastePreset media review

This directory contains candidate-only light and dark poster/social assets. It
is not an official asset path and must not be copied into `docs/assets/` or
`public/` without separate owner approval.

## Candidate sets

- `light-baseline/` is the pixel-identical light reference. Its final PNGs
  compare against the canonical sources with `AE=0`.
- `dark-reconstruction/` is the dark theme treatment. It retains the source
  composition, product identity, browser/mobile mockups, image comparison,
  feature panels, and measured positions.

Each set contains deterministic SVG templates, controlled CVM edit layers,
final PNGs, prompts, render scripts, and the required side-by-side,
transparent-overlay, and difference proofs. Rebuild the dark layers with
`CVM_IMAGEGEN_WRAPPER=/path/to/image_gen.py dark-reconstruction/templates/controlled-edit.sh`, then render with
`dark-reconstruction/templates/render.sh`. Rebuild the exact light baseline
with the corresponding scripts under `light-baseline/templates/`.

The controlled-edit scripts require `CVM_IMAGEGEN_WRAPPER` to point to the
environment-owned `cvm-imagegen` `image_gen.py` wrapper. The wrapper and
`CVM_API_KEY` are intentionally not stored in this review directory.

## Canonical sources

- Poster: `/Users/ivan/Projects/Ivan/paste-preset/docs/assets/paste-preset-poster.png`
  (`3072x3840`)
- Social: `/Users/ivan/Projects/Ivan/paste-preset/public/social-preview.png`
  (`1280x640`)
- Brand marks:
  `/Users/ivan/Projects/Ivan/paste-preset/public/brand/paste-preset-logo.svg`
  and `paste-preset-logo-dark.svg`

The CVM prompts use edit mode against those exact sources. No text-to-image
generation, global inversion, or blanket palette transform is used.
