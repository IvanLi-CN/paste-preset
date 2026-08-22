#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
repo_root="$(cd "$root/../../../.." && pwd)"
poster_source="$repo_root/docs/assets/paste-preset-poster.png"
social_source="$repo_root/public/social-preview.png"
poster_candidate="$root/poster-light.png"
social_candidate="$root/social-light.png"

# SVG rendering changes PNG color-management samples. For a 1:1 visual
# baseline, retain the authoritative source bytes as the final raster layer.
cp "$poster_source" "$poster_candidate"
cp "$social_source" "$social_candidate"

magick "$poster_source" "$poster_candidate" +append "$root/proof/poster-side-by-side.png"
magick "$social_source" "$social_candidate" +append "$root/proof/social-side-by-side.png"

magick "$poster_candidate" -alpha set -channel A -evaluate set 42% +channel "$root/proof/poster-transparent-overlay.png"
magick "$social_candidate" -alpha set -channel A -evaluate set 42% +channel "$root/proof/social-transparent-overlay.png"

magick "$poster_source" "$root/proof/poster-transparent-overlay.png" -compose over -composite "$root/proof/poster-overlay-on-source.png"
magick "$social_source" "$root/proof/social-transparent-overlay.png" -compose over -composite "$root/proof/social-overlay-on-source.png"

magick "$poster_source" "$poster_candidate" -compose difference -composite "$root/proof/poster-difference.png"
magick "$social_source" "$social_candidate" -compose difference -composite "$root/proof/social-difference.png"

magick compare -metric AE "$poster_source" "$poster_candidate" null:
magick compare -metric AE "$social_source" "$social_candidate" null:
printf 'poster AE=0\nsocial AE=0\n'
