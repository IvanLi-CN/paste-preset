# Fullscreen Image Preview (Single Image) – Requirements & High-Level Design

## 1. Background

The current `ImageCard` renders an inline, constrained preview (`max-h-64`) which is not suitable for detailed inspection. Users want to click an `ImageCard` and view the image in a fullscreen overlay, with the standard interactions expected from an image viewer (zoom, pan, quick reset).

This feature is **single-image only** (no gallery navigation), and the preview always displays the **original image** already available in the app (no download/open-link flows).

## 2. Goals

1. **Fullscreen overlay preview**
   - Clicking an `ImageCard` opens a viewport-covering overlay that shows the image.

2. **Close interactions**
   - Close via backdrop click, close button, or `Esc`.
   - Closing returns the user to the previous scroll position and restores focus.

3. **Viewing interactions**
   - Default view is **fit-to-viewport** (contain, no cropping).
   - Zoom range is **min(fit-to-viewport, 1:1) → 8×**.
   - Double-click (desktop) / double-tap (mobile) toggles **1:1** ↔ **fit-to-viewport**.
   - Pan is available when the image is zoomed beyond the fit scale.

4. **Robustness**
   - Loading and error states are handled gracefully.
   - The app remains fully client-side; no network dependency is introduced.

## 3. Scope and Non-goals

### 3.1 In scope

- Single-image viewer (one `ImageInfo` at a time).
- Backdrop-click close + close button + `Esc`.
- Zoom (wheel / pinch / buttons), pan (drag).
- Double-click toggle 1:1 ↔ fit-to-viewport.
- Body scroll lock while the overlay is open.
- Basic accessibility: dialog semantics + focus management.

### 3.2 Out of scope

- Browser “true fullscreen” (`requestFullscreen`).
- Multi-image navigation (next/prev, preloading adjacent images).
- Download / open-in-new-tab / share links.
- Advanced camera-like features (rotate, EXIF panel) beyond existing metadata shown on the card.
- Complex zoom behavior (e.g., zoom-to-cursor) unless required later.

## 4. Key User Flows

### 4.1 Open and close

1. User clicks an `ImageCard`.
2. Fullscreen overlay opens with the image in fit-to-viewport mode.
3. User closes via:
   - clicking the backdrop, or
   - clicking the close button, or
   - pressing `Esc`.
4. Overlay closes; focus returns to the previously focused element (typically the card), and background scroll is restored.

### 4.2 Zoom, pan, reset

1. Default: image is centered and fit-to-viewport.
2. User zooms in (wheel / pinch / `+`) up to 8×.
3. When zoomed in, user drags to pan.
4. User resets:
   - “Fit” button returns to fit-to-viewport, and
   - double-click toggles 1:1 ↔ fit-to-viewport.

## 5. High-Level Design

### 5.1 Component structure

- `ImageCard` becomes the interaction entry point and owns the “open/close” state for the preview.
- Introduce a dedicated viewer component:
  - `src/components/FullscreenImagePreview.tsx` (name TBD)
  - Props: `{ open, image, title, onClose }`
- UI implementation uses the existing DaisyUI modal pattern (`<dialog className="modal" open> ... <form className="modal-backdrop"> ...`), but the “box” content is styled to be fullscreen-friendly.

### 5.2 Viewer layout

- Overlay: darkened backdrop.
- Top-right: close button.
- Optional top/bottom control strip:
  - `+` / `-` zoom buttons
  - “Fit” (reset to fit-to-viewport)
  - optional zoom percentage display

### 5.3 State model

The viewer maintains:

- `fitScale`: computed scale for “fit-to-viewport” (clamped; see below)
- `scale`: current scale
- `offset`: `{ x, y }` translation in pixels (pan)
- `mode`: `"fit" | "oneToOne" | "custom"` (used to decide double-click behavior and UI states)
- `isDragging`: pointer drag state
- `isLoaded` / `hasError`: image loading state
- `lastFocusedElement`: to restore focus on close

### 5.4 Fit scale computation and zoom limits

Given:

- image size: `image.width`, `image.height`
- available viewport box: `containerWidth`, `containerHeight` (excluding control strip if present)

Compute:

- `fitScaleRaw = min(containerWidth / image.width, containerHeight / image.height)`
- `fitScale = min(fitScaleRaw, 8)`
- `minScale = min(fitScale, 1)`
- `maxScale = 8`

Notes:

- The minimum zoom for continuous controls (wheel/pinch/buttons) is `minScale`.
- Double-click toggles `scale` between:
  - `oneToOneScale = 1`, and
  - `fitScale`

### 5.5 Interaction handling

- **Backdrop click:** closes the viewer.
- **Esc:** closes the viewer.
- **Wheel zoom (desktop):** scales up/down, clamped to `[fitScale, 8]`.
- **Wheel zoom (desktop):** scales up/down, clamped to `[minScale, 8]`.
- **Pinch zoom (mobile):** scales up/down, clamped to `[minScale, 8]` (when supported).
- **Pan:** enabled when `scale > fitScale`; drag updates `offset`.
- **Reset on mode switch:** when switching to `fit` or `1:1`, reset `offset` to `{0, 0}`.
- **Prevent background scroll:** lock body scrolling while open.

### 5.6 Accessibility & focus

- Use dialog semantics (`role="dialog"` / `aria-modal="true"` where needed).
- Focus the close button on open.
- Restore focus to the triggering `ImageCard` on close.
- Ensure the close action is reachable via keyboard (`Esc` and focusable button).

### 5.7 i18n

Add new localized strings for:

- close button aria label
- “Zoom in / Zoom out”
- “Fit to screen”
- “Actual size (1:1)”
- loading / error messages

## 6. Compatibility and Migration

- No persisted data changes.
- No network calls: the viewer uses the existing `image.url` and `ImageInfo` metadata already in memory.
- Works for blob/object URLs and data URLs.

## 7. Testing Plan (Manual)

- **Open/close**
  - Click card opens overlay.
  - Backdrop click closes.
  - Close button closes.
  - `Esc` closes.
  - Focus returns to the card after close.

- **Zoom**
  - Default fit-to-viewport is correct (no cropping).
  - Wheel/pinch zoom respects limits: never below fit, never above 8×.
  - If `fitScale === 8`, verify zoom controls are disabled (and confirm 1:1 toggle behavior per final decision).

- **Double-click toggle**
  - Double-click toggles between 1:1 and fit-to-viewport, resetting pan each time.

- **Pan**
  - Drag-to-pan works only when zoomed in beyond fit.

- **Loading/error**
  - Slow image decode shows a loading state.
  - Invalid image URL shows an error state with an exit path.

## 8. Open Questions

None.
