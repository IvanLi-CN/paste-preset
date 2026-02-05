#!/usr/bin/env bash
set -euo pipefail

# Compute the version used for CI builds and releases.
#
# - Uses the highest semver tag (`vMAJOR.MINOR.PATCH`) and `package.json` version as lower bounds.
# - Supports semver bumps via `APP_VERSION_BUMP` (patch|minor|major|none).
# - Is idempotent for already-tagged commits: if `HEAD` already has a semver tag, reuse it.
#
# Result is exported as APP_EFFECTIVE_VERSION (via $GITHUB_ENV when available).

root_dir="$(git rev-parse --show-toplevel)"

# Ensure tags are available (defensive when checkout uses shallow clone)
git fetch --tags --force >/dev/null 2>&1 || true

# If this commit is already tagged, reuse the tag (rerun-safe).
target_ref="${GITHUB_SHA:-HEAD}"
target_sha="$(git rev-parse "${target_ref}")"
existing_tag="$(
  git tag --points-at "${target_sha}" \
    | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' \
    | sort -V \
    | tail -n 1 \
    || true
)"
if [[ -n "${existing_tag:-}" ]]; then
  effective="${existing_tag#v}"
  if [[ -n "${GITHUB_ENV:-}" ]]; then
    echo "APP_EFFECTIVE_VERSION=${effective}" >> "${GITHUB_ENV}"
  else
    export APP_EFFECTIVE_VERSION="${effective}"
  fi
  echo "Computed APP_EFFECTIVE_VERSION=${effective} (already tagged: ${existing_tag})"
  exit 0
fi

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

latest_tag="$(
  git tag -l 'v*' \
    | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' \
    | sort -V \
    | tail -n 1 \
    || true
)"
tag_major=0
tag_minor=0
tag_patch=0
if [[ -n "${latest_tag:-}" && "$latest_tag" =~ ^v([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
  tag_major="${BASH_REMATCH[1]}"
  tag_minor="${BASH_REMATCH[2]}"
  tag_patch="${BASH_REMATCH[3]}"
fi

# Base version is the higher of (package.json version, latest semver tag).
base_major_cmp="${base_major}"
base_minor_cmp="${base_minor}"
base_patch_cmp="${base_patch}"
if [[ "${tag_major}" -gt "${base_major_cmp}" ]] \
  || [[ "${tag_major}" -eq "${base_major_cmp}" && "${tag_minor}" -gt "${base_minor_cmp}" ]] \
  || [[ "${tag_major}" -eq "${base_major_cmp}" && "${tag_minor}" -eq "${base_minor_cmp}" && "${tag_patch}" -gt "${base_patch_cmp}" ]]; then
  base_major_cmp="${tag_major}"
  base_minor_cmp="${tag_minor}"
  base_patch_cmp="${tag_patch}"
fi

bump="${APP_VERSION_BUMP:-patch}"
target_major="${base_major_cmp}"
target_minor="${base_minor_cmp}"
target_patch="${base_patch_cmp}"
ensure_unique_tag=true
case "${bump}" in
  patch)
    ;;
  minor)
    target_minor="$((target_minor + 1))"
    target_patch=0
    ;;
  major)
    target_major="$((target_major + 1))"
    target_minor=0
    target_patch=0
    ;;
  none)
    ensure_unique_tag=false
    ;;
  *)
    echo "Unsupported APP_VERSION_BUMP='${bump}' (expected patch|minor|major|none)" >&2
    exit 1
    ;;
esac

candidate="${target_patch}"
if [[ "${ensure_unique_tag}" == "true" ]]; then
  while git rev-parse -q --verify "refs/tags/v${target_major}.${target_minor}.${candidate}" >/dev/null; do
    candidate="$((candidate + 1))"
  done
fi

effective="${target_major}.${target_minor}.${candidate}"

if [[ -n "${GITHUB_ENV:-}" ]]; then
  echo "APP_EFFECTIVE_VERSION=${effective}" >> "${GITHUB_ENV}"
else
  export APP_EFFECTIVE_VERSION="${effective}"
fi
echo "Computed APP_EFFECTIVE_VERSION=${effective} (pkg ${pkg_ver}, latest ${latest_tag:-none}, bump ${bump})"
