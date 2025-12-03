#!/usr/bin/env bash
set -euo pipefail

# Compute effective semver from package.json, using it as a lower bound.
# Result is exported as APP_EFFECTIVE_VERSION into the GitHub Actions env.

root_dir="$(git rev-parse --show-toplevel)"

# Ensure tags are available (defensive when checkout uses shallow clone)
git fetch --tags --force >/dev/null 2>&1 || true

pkg_json="${root_dir}/package.json"
if [[ ! -f "$pkg_json" ]]; then
  echo "package.json not found at ${pkg_json}" >&2
  exit 1
fi

# Extract version string from package.json, expecting: "version": "x.y.z"
pkg_ver="$(
  grep -m1 '"version"' "$pkg_json" \
    | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/'
)"

if [[ -z "${pkg_ver:-}" ]]; then
  echo "Failed to detect version from package.json" >&2
  exit 1
fi

if [[ ! "$pkg_ver" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
  echo "Unsupported package.json version '${pkg_ver}', expected MAJOR.MINOR.PATCH" >&2
  exit 1
fi

base_major="${BASH_REMATCH[1]}"
base_minor="${BASH_REMATCH[2]}"
base_patch="${BASH_REMATCH[3]}"

candidate="${base_patch}"
while git rev-parse -q --verify "refs/tags/v${base_major}.${base_minor}.${candidate}" >/dev/null; do
  candidate="$((candidate + 1))"
done

effective="${base_major}.${base_minor}.${candidate}"

echo "APP_EFFECTIVE_VERSION=${effective}" >> "${GITHUB_ENV}"
echo "Computed APP_EFFECTIVE_VERSION=${effective} (base ${pkg_ver})"

