#!/usr/bin/env bash
set -euo pipefail

# Compute the version used for CI builds and releases.
#
# - Computes the next semver from the highest stable semver tag (`vMAJOR.MINOR.PATCH`).
# - Supports semver bumps via `APP_VERSION_BUMP` (patch|minor|major|none).
# - Supports release channels via `APP_RELEASE_CHANNEL` (stable|rc):
#   - stable: `X.Y.Z`
#   - rc: `X.Y.Z-rc.<sha7>`
# - Is idempotent for already-tagged commits: if `HEAD` already has a stable/rc tag, reuse it.
#
# Result is exported as APP_EFFECTIVE_VERSION (via $GITHUB_ENV when available).

root_dir="$(git rev-parse --show-toplevel)"

# Ensure tags are available (defensive when checkout uses shallow clone)
git fetch --tags --force >/dev/null 2>&1 || true

target_ref="${GITHUB_SHA:-HEAD}"
target_sha="$(git rev-parse "${target_ref}")"
sha7="${target_sha:0:7}"

tag_exists() {
  local tag="$1"
  git rev-parse -q --verify "refs/tags/${tag}" >/dev/null 2>&1
}

# If this commit is already tagged, reuse the tag (rerun-safe).
existing_stable_core="$(
  git tag --points-at "${target_sha}" \
    | grep -E '^(v)?[0-9]+\.[0-9]+\.[0-9]+$' \
    | sed -E 's/^v//' \
    | sort -V \
    | tail -n 1 \
    || true
)"
if [[ -n "${existing_stable_core:-}" ]]; then
  effective="${existing_stable_core}"
  if [[ -n "${GITHUB_ENV:-}" ]]; then
    echo "APP_EFFECTIVE_VERSION=${effective}" >> "${GITHUB_ENV}"
  else
    export APP_EFFECTIVE_VERSION="${effective}"
  fi
  echo "Computed APP_EFFECTIVE_VERSION=${effective} (already tagged: v${existing_stable_core})"
  exit 0
fi

existing_rc_core="$(
  git tag --points-at "${target_sha}" \
    | grep -E '^(v)?[0-9]+\.[0-9]+\.[0-9]+-rc\.[0-9a-f]{7}$' \
    | sed -E 's/^v//' \
    | sort -V \
    | tail -n 1 \
    || true
)"
if [[ -n "${existing_rc_core:-}" ]]; then
  effective="${existing_rc_core}"
  if [[ -n "${GITHUB_ENV:-}" ]]; then
    echo "APP_EFFECTIVE_VERSION=${effective}" >> "${GITHUB_ENV}"
  else
    export APP_EFFECTIVE_VERSION="${effective}"
  fi
  echo "Computed APP_EFFECTIVE_VERSION=${effective} (already tagged: v${existing_rc_core})"
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

# Base version comes from the latest stable semver tag. If none exists, fall back to package.json.
latest_stable_core="$(
  git tag -l \
    | grep -E '^(v)?[0-9]+\.[0-9]+\.[0-9]+$' \
    | sed -E 's/^v//' \
    | sort -V \
    | tail -n 1 \
    || true
)"
base_source="pkg ${pkg_ver}"
if [[ -n "${latest_stable_core:-}" && "$latest_stable_core" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
  base_major="${BASH_REMATCH[1]}"
  base_minor="${BASH_REMATCH[2]}"
  base_patch="${BASH_REMATCH[3]}"
  base_source="tag v${latest_stable_core}"
fi

bump="${APP_VERSION_BUMP:-patch}"
channel="${APP_RELEASE_CHANNEL:-stable}"

target_major="${base_major}"
target_minor="${base_minor}"
target_patch="${base_patch}"
ensure_unique_tag=true
case "${bump}" in
  patch)
    target_patch="$((target_patch + 1))"
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

core="${target_major}.${target_minor}.${target_patch}"
if [[ "${ensure_unique_tag}" == "true" ]]; then
  while tag_exists "v${core}" || tag_exists "${core}"; do
    target_patch="$((target_patch + 1))"
    core="${target_major}.${target_minor}.${target_patch}"
  done
fi

case "${channel}" in
  stable)
    effective="${core}"
    ;;
  rc)
    effective="${core}-rc.${sha7}"
    ;;
  *)
    echo "Unsupported APP_RELEASE_CHANNEL='${channel}' (expected stable|rc)" >&2
    exit 1
    ;;
esac

if [[ -n "${GITHUB_ENV:-}" ]]; then
  echo "APP_EFFECTIVE_VERSION=${effective}" >> "${GITHUB_ENV}"
else
  export APP_EFFECTIVE_VERSION="${effective}"
fi
echo "Computed APP_EFFECTIVE_VERSION=${effective} (base ${base_source}, bump ${bump}, channel ${channel})"
