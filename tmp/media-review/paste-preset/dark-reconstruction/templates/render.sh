#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
repo_root="$(cd "$root/../../../.." && pwd)"
poster_source="$repo_root/docs/assets/paste-preset-poster.png"
social_source="$repo_root/public/social-preview.png"
logo_source="$repo_root/public/brand/paste-preset-logo-dark.svg"

rsvg-convert --width 1833 --height 478 "$logo_source" --output "$root/templates/paste-preset-logo-dark.png"
rsvg-convert --width 3072 --height 3840 "$root/poster-dark.svg" --output "$root/poster-dark.png"
rsvg-convert --width 1280 --height 640 "$root/social-dark.svg" --output "$root/social-dark.png"

magick "$poster_source" "$root/poster-dark.png" +append "$root/proof/poster-side-by-side.png"
magick "$social_source" "$root/social-dark.png" +append "$root/proof/social-side-by-side.png"

magick "$root/poster-dark.png" -alpha set -channel A -evaluate set 42% +channel "$root/proof/poster-transparent-overlay.png"
magick "$root/social-dark.png" -alpha set -channel A -evaluate set 42% +channel "$root/proof/social-transparent-overlay.png"

magick "$poster_source" "$root/proof/poster-transparent-overlay.png" -compose over -composite "$root/proof/poster-overlay-on-source.png"
magick "$social_source" "$root/proof/social-transparent-overlay.png" -compose over -composite "$root/proof/social-overlay-on-source.png"

magick "$poster_source" "$root/poster-dark.png" -compose difference -composite "$root/proof/poster-difference.png"
magick "$social_source" "$root/social-dark.png" -compose difference -composite "$root/proof/social-difference.png"
