#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
repo_root="$(cd "$root/../../../.." && pwd)"
wrapper="/Users/ivan/.codex/skills/cvm-imagegen/scripts/image_gen.py"
poster_source="$repo_root/docs/assets/paste-preset-poster.png"
social_source="$repo_root/public/social-preview.png"

export PYTHONPATH="$root/../.python-packages${PYTHONPATH:+:$PYTHONPATH}"

python3 "$wrapper" edit \
  --image "$poster_source" \
  --prompt-file "$root/templates/poster-dark-edit-prompt.txt" \
  --size 2560x3200 \
  --quality high \
  --output-format png \
  --no-augment \
  --out "$root/controlled/poster-dark-edit.png" \
  --force

python3 "$wrapper" edit \
  --image "$social_source" \
  --prompt-file "$root/templates/social-dark-edit-prompt.txt" \
  --size 1280x640 \
  --quality high \
  --output-format png \
  --no-augment \
  --out "$root/controlled/social-dark-edit.png" \
  --force
