# PWA Offline Support (L2) – Requirements & High-Level Design

## 1. Background

PastePreset is a privacy-first, fully client-side image processing SPA. Today it requires a working network connection to load the app shell (HTML/CSS/JS) even though all image processing happens locally. Users want the app to be **installable** and **usable when offline** after installation.

This document specifies the requirements and the high-level design to add **PWA L2** support:

- Installable on desktop and mobile.
- After the user has opened the app online at least once and installed it, the app can be launched from an icon and used **offline**.
- Updates are applied **on next launch**, not mid-session.
- No cloud sync and no server-side features.

## 2. Goals

1. **Installability**
   - Desktop (Chrome/Edge): Install prompt / menu install works.
   - Android (Chrome): Install prompt / menu install works.
   - iOS (Safari): “Add to Home Screen” works with proper icons and metadata.

2. **Offline usability (L2)**
   - After a successful online visit + installation, launching from the app icon while offline opens the full UI and allows completing the core flow:
     - Import an image (drag & drop or file picker; paste depends on platform permissions).
     - Process it.
     - Download the result (clipboard support depends on platform capability).

3. **No UI degradation when offline**
   - The offline-launched UI must not appear “broken”:
     - no missing icons,
     - no missing styles,
     - no blank placeholders where UI elements should exist,
     - no missing app version display (see `version.json`).

4. **Update strategy: next launch**
   - A new service worker + assets may be downloaded in the background while the app is open.
   - The currently open session must not be force-reloaded or taken over.
   - The new version becomes active only after the user closes the app and launches it again.

## 3. Scope and Non-goals

### 3.1 In scope

- Web App Manifest and icons required for installability.
- Service worker that provides:
  - **pre-cached app shell** (static assets),
  - **SPA navigation fallback** to `index.html` while offline,
  - stable offline access to `version.json` and other UI-critical assets.
- A small amount of UX logic to avoid confusing failures when offline (e.g., external links).

### 3.2 Out of scope

- L3 (“first launch offline” without any prior online visit).
- Background sync, push notifications, and advanced PWA features.
- Persisting user images/results for offline use.
- Cloud sync or accounts.

## 4. Key User Flows

### 4.1 Install (desktop / Android)

1. User opens the site online.
2. Browser indicates installability (address bar install icon or menu).
3. User installs the app.
4. User launches from the app icon (app window / standalone mode).

### 4.2 Install (iOS)

1. User opens the site online in Safari.
2. User uses Share → Add to Home Screen.
3. User launches from the home screen icon.

### 4.3 Offline launch and core use

1. User goes offline.
2. User launches the installed app from the icon.
3. App UI renders fully (no missing resources).
4. User imports an image and processes it.
5. User downloads the result (clipboard actions depend on platform support).

### 4.4 Update (next launch)

1. While online, a new version is deployed.
2. A new service worker is installed and enters **waiting**.
3. User keeps using the current version without interruption.
4. User closes the app.
5. Next launch uses the new version.

## 5. Constraints and Invariants

### 5.1 Deployment

- The app is served from **root path** `/`.
- The PWA `scope` and `start_url` must be aligned with `/`.

### 5.2 “No UI degradation” means no runtime network dependencies

The offline app must not require network access to render its UI. This implies:

- No external CDN fonts, icons, or styles.
- No runtime fetching of icon assets.
- Any “UI metadata” that is shown (e.g. app version) must be available offline.

**Known risk:** the app currently uses `@iconify/react` with `icon="mdi:..."` string identifiers (e.g. `mdi:github`). If the runtime fetches icon data from the network, it violates this requirement. The implementation must ensure icons are bundled locally.

### 5.3 Update strategy

- The service worker must **not** call `skipWaiting()` automatically.
- The app must **not** call `clients.claim()` in a way that steals control from an existing session.
- The update is applied only after all existing tabs/standalone windows are closed.

## 6. High-Level Architecture

### 6.1 Web App Manifest

Add/ship a manifest that includes:

- `name`, `short_name`
- `start_url: "/"` and `scope: "/"`
- `display: "standalone"` (or `"fullscreen"` if desired later)
- `theme_color` and `background_color`
- Icons:
  - multiple sizes (at least 192 and 512),
  - include `purpose: "maskable"` variants.

iOS additions:

- `apple-touch-icon` links (multiple sizes if needed),
- any required meta tags for standalone appearance.

### 6.2 Service Worker (SW)

Responsibilities:

1. **Precache** all build outputs required to render the UI.
2. Provide **navigation fallback** to `index.html` for SPA routes.
3. Ensure **UI-critical static endpoints** (e.g. `version.json`) remain available offline.

Non-responsibilities:

- No caching of user images/results.
- No caching of remote third-party data (there should be none).

### 6.3 SW Registration and Updates

Registration behavior must enforce “next launch” updates:

- Register SW on app load (production only).
- When a new SW is installed and waiting:
  - Do not auto-reload.
  - Optionally show a non-blocking notice: “Update downloaded; will apply next time you open the app.”

## 7. Caching Strategy (Normative)

### 7.1 Precache categories (must)

The precache list must cover:

- `index.html`
- All built JS/CSS chunks and assets referenced by the app
- App icons and favicon assets
- `version.json` (UI shows version; offline must show it too)
- HEIC conversion assets:
  - `heic2any` dynamic-import chunk(s)
  - any additional worker/wasm/assets emitted by the bundler

### 7.2 SPA navigation fallback (must)

While offline:

- All navigation requests within `scope: "/"` should be served with the cached `index.html`.
- Static asset requests should be served from cache.

### 7.3 Runtime caching (prefer none)

Keep runtime caching minimal. If used at all, it should only cover:

- Requests that are strictly static and necessary for UI completeness.

Do not cache:

- pasted/dropped images,
- generated output blobs,
- user-specific data beyond existing `localStorage` settings.

### 7.4 Build-order requirement for `version.json` (must)

`version.json` is generated by `scripts/write-version.mjs`. The build pipeline must ensure `version.json` exists **before** SW precache metadata is generated, otherwise offline version display can fail.

## 8. Platform Considerations

### 8.1 Desktop Chrome/Edge

- Install prompt and offline launch are straightforward.
- DevTools “Offline” mode should be part of verification.

### 8.2 Android Chrome

- Similar behavior to desktop.
- Validate “standalone” display and offline startup from icon.

### 8.3 iOS Safari (A2HS)

- Service worker support exists but is more constrained:
  - Storage and cache may be evicted by the OS.
  - Some clipboard capabilities are limited.
- The requirement is best-effort L2: offline works when the OS has not purged caches.
- Document and verify real behavior on at least one supported iOS version during implementation.

## 9. Acceptance Criteria (Definition of Done)

### 9.1 Installability

- Desktop Chrome/Edge:
  - “Install app” is available and produces a standalone app.
- Android Chrome:
  - Install succeeds and launches from home screen.
- iOS Safari:
  - A2HS creates a home screen icon with correct name and icon.

### 9.2 Offline behavior

After at least one successful online visit and installation:

- Launch from icon while offline renders the full UI.
- No missing icons/styles/UI elements.
- Version display is present and stable offline.
- Core flow works offline (import → process → download).

### 9.3 Update behavior

- Deploying a new version does not force-refresh an active session.
- New version becomes active after closing and reopening the app.

### 9.4 No runtime network dependencies for UI

With the browser offline:

- The app must not attempt to fetch third-party UI resources (icons/fonts).
- Any network errors must not cause visible UI breakage.

## 10. Testing Plan

### 10.1 Manual validation checklist (must)

- Desktop: install → offline launch → process image → download.
- Android: install → offline launch → process image → download.
- iOS: A2HS → offline launch → process image → download.
- Update behavior: open v1 → deploy v2 → keep using v1 → close → reopen → see v2.

### 10.2 Automated checks (recommended)

Add Playwright E2E scenarios that:

- Installability checks (where feasible).
- Offline mode simulation (`context.setOffline(true)` or equivalent):
  - page reload while offline still loads app shell,
  - processing pipeline works with a fixture image.
- Assert “no missing UI resources” by checking:
  - failed network requests list,
  - presence of critical UI elements and icons.

## 11. Risks and Open Questions

1. **Icon strategy (must decide in implementation)**
   - If Iconify performs runtime fetching, switch to a local icon strategy (import-only icons or inline SVGs).

2. **iOS cache eviction**
   - Best-effort guarantee only; document limitations.

3. **Offline UX indicator**
   - Should the UI show an explicit “Offline” status badge?
   - This is not a degradation but introduces an offline-only visual element; decide with product preference.

