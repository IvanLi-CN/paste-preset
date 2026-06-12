# History

## 2026-06-08

- Canonicalized the offline PWA topic from the legacy draft
  `docs/pwa-offline-support.md`.
- Locked the production deployment truth to root-path hosting at
  `https://paste-preset.ivanli.cc/`.
- Replaced the previous immediate-takeover service worker behavior with an
  explicit waiting-update contract surfaced through the UI.
- Captured and persisted reviewed visual evidence for the waiting-update prompt
  and offline desktop shell.
- Tightened the runtime so passive tabs that already observed a waiting update
  also refresh on `controllerchange`, avoiding mixed asset sets after update
  activation.

## 2026-06-11

- Switched repeat-visit navigation from network-first fallback to cached
  app-shell-first startup.
- Split heavy optional offline codec assets out of the core precache into
  `offline-warm-manifest.json`.
- Added a shared offline readiness model that distinguishes cached shell,
  background warmup, full offline readiness, and warmup failure.
- Added startup timing marks for `app-shell-visible` and `app-interactive`.

## 2026-06-12

- Moved the offline/update/error status surface into the app shell directly
  below the page header so PWA readiness messaging no longer floats over the
  content at the bottom of the screen.
- Added Storybook app-shell scenarios for the offline and waiting-update
  states, and refreshed the spec-backed visual evidence to match the new
  placement.
- Restored the `full offline-ready` state across offline reloads by syncing the
  runtime from the cached optional warmup manifest and service worker cache
  status.
