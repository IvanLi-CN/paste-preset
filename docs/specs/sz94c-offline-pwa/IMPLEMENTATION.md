# Implementation

## Current Status

- Service worker lifecycle uses waiting-update semantics plus cached-shell-first
  navigation for repeat visits.
- The build now splits heavy optional offline codec assets into
  `offline-warm-manifest.json` so the core shell stays light.
- Frontend runtime exposes offline readiness and update state through a shared
  PWA store.
- `StatusBar` owns the reusable UI for offline readiness, warmup failure, and
  update prompts, rendered inline below the app header as a sticky shell status
  region instead of a floating footer toast.
- Storybook and automated tests cover the new reusable visual states.
- Visual evidence for the waiting-update prompt and offline shell is stored
  under `assets/`.

## Validation Target

- Desktop Chromium browser revisit and hard reload while offline
- Desktop installed-app manual smoke
- Root-path production hosting contract

## Verification Notes

- Automated validation passed for `bun run check`, `bun run build`,
  `bun run test`, `bun run test-storybook`, and `bun run test:e2e:pwa`.
- Browser proof covers:
  - offline revisit and hard reload of `/` with cached-shell-first startup
  - offline import -> process -> download
  - background optional warmup reaching `full offline-ready`
  - offline HEIC recovery guidance before warmup completes
  - waiting-update prompt lifecycle with `Reload now` / `Later`
  - root-path footer version visibility
- The PWA runtime also reloads passive tabs on `controllerchange` once those
  tabs have already observed the waiting update, preventing mixed-version lazy
  asset fetches after old precache buckets are deleted.
- Desktop installed-app standalone launch remains a manual smoke requirement.
  The current Codex runtime can verify installability artifacts and browser
  offline behavior, but it cannot drive Chromium's native app-install flow or
  standalone launch surface through `chrome-devtools`. Release sign-off still
  requires one human-installed desktop Chromium smoke pass against the same
  root-path build.

## Remaining Notes

- Android and iOS remain manual verification only in this topic.
- Legacy draft documentation is retained until explicit delete approval is
  granted.
