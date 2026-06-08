# Offline PWA

## Summary

PastePreset ships as a root-path Progressive Web App that remains usable after
at least one successful online visit. The offline contract covers browser
revisit and hard reload for desktop Chromium, with an additional manual smoke
path for installed desktop app launch. The app shell, version footer, icons,
and local image-processing flow must continue working without network access.

## Goals

### 1. Root-path installability

- Production hosting is the root path `/`, currently
  `https://paste-preset.ivanli.cc/`.
- `manifest.webmanifest`, the service worker scope, and runtime asset loading
  must stay aligned with `/`.
- Installability relies on browser-native install entry points; the app does
  not add a custom `beforeinstallprompt` CTA.

### 2. Offline revisit and hard reload

- After a successful online visit, reopening `/` while offline must render the
  full UI without missing styles, icons, or version metadata.
- The core flow remains available offline:
  import image -> process locally -> download result.
- Desktop Chromium is the strict automated target. Installed standalone launch
  on desktop remains a manual smoke requirement tied to the same artifact set.

### 3. Waiting-update lifecycle

- Updated service workers must not take over automatically.
- When a new worker reaches `waiting`, the UI shows a sticky status message with
  `Reload now` and `Later`.
- `Later` only dismisses the current waiting worker prompt for the current page
  session.
- `Reload now` posts `SKIP_WAITING` to the waiting worker and reloads only
  after `controllerchange`.
- If another tab explicitly activates the waiting worker, tabs that already
  know they are behind may self-refresh on `controllerchange` to avoid mixed
  old-page/new-worker asset sets.

### 4. Offline UX feedback

- A subtle offline status is visible while the browser is offline so users can
  distinguish cached-mode behavior from failures.
- External links remain clickable; the offline signal is informational and does
  not alter footer link behavior.

## Non-goals

- First-launch offline support without any successful online visit.
- Mandatory Android/iOS release gating in this topic. Mobile platforms stay in
  manual-check territory with explicit caveats.
- Caching pasted files, generated outputs, or any remote account/state data.
- Push notifications, background sync, or cloud-connected PWA features.

## Constraints

### Hosting and asset contract

- The Vite base path is `/`.
- `version.json` must exist before the service worker precache manifest is
  generated.
- UI assets must be bundled locally; no runtime CDN dependency is allowed for
  icons, fonts, or styles.

### Service worker contract

- The service worker precaches the built app shell, `version.json`, icons, and
  heavy emitted assets such as HEIC-related chunks, worker files, and WASM.
- SPA navigation requests fall back to cached `index.html` when the network is
  unavailable.
- Automatic `skipWaiting()` during install and automatic `clients.claim()` are
  forbidden for this topic.
- The worker may still honor a `SKIP_WAITING` message that originates from an
  explicit UI action.

## Acceptance

### Automated acceptance

- `bun run check`
- `bun run build`
- `bun run test`
- `bun run test:e2e:pwa`
- Storybook coverage for the reusable `StatusBar` states that expose offline and
  waiting-update UX

### Observable behavior

- Offline revisit or hard reload of `/` shows the full shell and version footer.
- Offline processing and download succeed for a representative fixture image.
- A waiting service worker does not interrupt the current session until the user
  clicks `Reload now`.
- The status UI can represent:
  - idle hidden state
  - processing
  - errors
  - offline informational state
  - update available with actions
  - update applying state

## Visual Evidence

PR: include

- Waiting-update prompt rendered through the reusable `StatusBar` story on the
  current reviewed `HEAD`.

  ![Waiting update status bar](./assets/statusbar-update.png)

- Root-path production preview rendered in desktop Chromium while offline,
  showing the cached shell, offline notice, and footer version on the current
  reviewed `HEAD`.

  ![Offline app shell](./assets/offline-app-shell.png)

## References

- Legacy source draft: [docs/pwa-offline-support.md](../../pwa-offline-support.md)
- Deployment guide: [docs/deploy-github-pages.md](../../deploy-github-pages.md)
- README project entry: [README.md](../../../README.md)
