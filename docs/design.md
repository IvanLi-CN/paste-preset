PastePreset – Design Document
=============================

1. Overview

-----------

PastePreset is a single-page, clipboard-centric web app for quickly converting and resizing images entirely in the browser. Users configure presets (resolution, aspect handling, output format, quality, metadata stripping), then paste or drop an image and immediately get a processed result that can be copied back to the clipboard or downloaded.

Target usage:

- Paste screenshots or mobile photos.
- Normalize size/format for documentation, design tools, or chat apps.
- Ensure privacy by stripping metadata and avoiding any server-side processing.

2. Core Requirements

--------------------

2.1 Functional
--------------

### Layout and interaction

- Single-page application.
- Two-pane layout on desktop:
  - Left: parameter/settings panel.
  - Right: paste/preview area for input and processed image.
- On narrow screens (mobile), panels stack vertically with sensible order (settings first, then paste/preview) and optional tabs.

### Image input

- Input methods:
  - Paste from clipboard (`Ctrl/Cmd + V`) when the app window is focused.
  - Drag-and-drop into the right-hand area.
  - File picker button as a fallback (`<input type="file">`).

- Supported input formats (smartphone-oriented):
  - Core phone photo formats:
    - JPEG (`image/jpeg`) – common default on both iOS and Android.
    - HEIC/HEIF (`image/heic`, `image/heif`) – “High Efficiency” formats used by modern iPhones and some Android devices. These must be converted in the browser (for example via `heic2any`) to a canvas-friendly format such as PNG or JPEG before further processing.
  - Screenshots and app exports:
    - PNG (`image/png`).
    - WebP (`image/webp`) – often used by Android devices and some apps when saving images.
  - Other still-image formats:
    - GIF (`image/gif`) – only the first frame is processed as a static image.
    - BMP (`image/bmp`) – supported but not a primary target.
  - Unsupported in v1:
    - RAW/ProRAW/DNG and other camera-specific RAW formats.
    - Multi-frame/sequence content beyond the first frame (animated GIF/WebP, HEIF image sequences).
  - Error handling:
    - If the browser cannot decode an image, or HEIC/HEIF conversion fails, the app must show a clear error message and suggest converting the file to JPEG or PNG on the device before using PastePreset.

- Supported output formats:
  - `Auto (same as source)`:
    - If the source is JPEG/PNG/WebP, keep the same MIME type.
    - If the source is HEIC/HEIF, default the output to JPEG.
  - Explicit choices:
    - JPEG (`image/jpeg`) – lossy, good for general sharing and small file sizes.
    - PNG (`image/png`) – lossless, supports transparency, ideal for UI screenshots and graphics.
    - WebP (`image/webp`) – modern web format with good quality/size characteristics.
  - Animated inputs are always exported as a single static frame image; preserving animation is out of scope for v1.

- Single active image in v1:
  - Each paste/load replaces the current source image and result.
  - History/multi-image support can be considered as a future enhancement.

### Parameter presets

Located at the top of the left settings panel:

- Preset buttons:
  - `Original`:
    - Keeps original resolution.
    - Output format defaults to “same as source” unless explicitly changed.
  - `Large`:
    - Constrains the longest side to a max (e.g. 2048 px) with aspect ratio preserved.
  - `Medium`:
    - Longest side e.g. 1280 px.
  - `Small`:
    - Longest side e.g. 800 px.
- Clicking a preset:
  - Updates resolution-related controls and quality defaults.
  - Does not immediately process; user pastes/selects an image to apply the preset.
  - If an image is already loaded, changing preset re-triggers processing.

Exact pixel sizes for presets should be configurable via a single config object so they can be tuned later without touching logic.

### Resolution and aspect ratio handling

Controls in the settings panel:

- Target resolution:
  - Inputs for width and height (integer pixels).
  - A “lock aspect ratio” toggle:
    - When locked, editing one dimension updates the other based on the source aspect ratio or the currently computed target aspect.
    - When unlocked, both dimensions are independent.
- When both width and height are specified and the source aspect ratio differs, behavior is controlled by a “Resize mode” option:
  - `Fit` (default):
    - Scales the image to fit entirely within the target box while preserving aspect ratio.
    - Remaining area is left transparent for formats supporting alpha (PNG, WebP) or filled with a solid background color (for JPEG) when implemented.
  - `Fill (crop)`:
    - Scales the image to cover the entire target box and crops overflow, preserving aspect ratio.
  - `Stretch`:
    - Scales independently in X and Y to exactly match the target width and height, ignoring aspect ratio.

### Output format and quality

- Output format select:
  - `Auto (same as source)`
  - `JPEG`
  - `PNG`
  - `WebP`
  - (`AVIF` can be added later depending on browser support and complexity.)
- Quality factor:
  - Visible only when the chosen output format supports lossy quality:
    - JPEG
    - WebP (lossy)
  - Represented as a slider and numeric input:
    - Range: 0.1 – 1.0 (or 10 – 100%) with sensible default (e.g. 0.8).
  - Hidden or disabled for lossless formats (PNG, lossless WebP, Auto when the resolved output is lossless).

### Metadata handling

- Option: `Strip metadata` (default checked).
  - When enabled (default), the app re-encodes the image without EXIF/IPTC/XMP metadata.
  - When disabled, the app attempts to preserve metadata only if the pipeline and format allow it. At minimum, this toggle should control whether EXIF orientation is applied and then discarded.
- The actual implementation will likely always re-encode via a canvas (which drops most metadata) but the toggle will:
  - Control whether EXIF orientation is honored.
  - Reserve room for future metadata-aware optimizations.

### Processing pipeline

High-level steps when an image is received:

1. **Load source**
   - Read `File` or clipboard `Blob` into an object URL or `ArrayBuffer`.
   - If MIME type indicates HEIC/HEIF, invoke the conversion helper (based on `heic2any` or similar) to produce a PNG or JPEG blob.
   - For other formats, proceed directly.
2. **Decode**
   - Use `createImageBitmap` when available for performance, otherwise an `<img>` element.
3. **Compute target size**
   - Based on:
     - Source dimensions.
     - Selected preset (if any).
     - Explicit width/height.
     - Resize mode (`fit`, `fill`, `stretch`).
4. **Render to canvas**
   - Use `<canvas>` (or `OffscreenCanvas` if supported) to draw the scaled image.
   - Use `imageSmoothingEnabled`/`imageSmoothingQuality` set to `"high"`.
5. **Export**
   - Use `canvas.toBlob` with the chosen MIME type and quality factor.
   - The resulting `Blob` is the canonical “result image”.
6. **Update UI**
   - Show the result preview.
   - Attach blob URL for `<img>` source and for download.

### Result copy and download

For the processed image:

- Default selection:
  - Immediately after processing, the result image is considered “selected”.
  - Visually highlight the selected result card.
- Copy to clipboard:
  - Copy button:
    - Uses the async clipboard API (`navigator.clipboard.write`) with a `ClipboardItem` containing the image blob when supported.
    - On failure:
      - Show a toast explaining that the browser does not allow programmatic image copying and instruct the user to right-click and copy or use keyboard shortcuts.
  - Keyboard shortcut:
    - When the result area is focused, `Ctrl/Cmd + C` triggers the same clipboard write logic.
  - Native context menu:
    - The result image is a standard `<img>` so the OS/browser “Copy image” menu works.
- Download:
  - Download button:
    - Creates a temporary object URL for the blob and triggers an `<a download>` click.
    - Default file name:
      - `pastepreset-YYYYMMDD-HHMMSS.ext` (ext based on output format).

### Error and status handling

- Global status indicator for:
  - Idle
  - Processing (with spinner and short text)
  - Error (with clear explanation and possible next steps)
- Typical error cases:
  - No image data in clipboard.
  - Unsupported format (with special handling for HEIC when library is not available).
  - Image too large to process (canvas size limits).
  - Clipboard write permission denied.

2.2 Non-functional
-------------------

- All processing is client-side; no images are uploaded to any server.
- Performance:
  - Must handle typical modern smartphone photos (up to around 4000–6000 px on the long side) on mid-range hardware.
  - Use progressive downscaling for very large images if needed.
- Browser support:
  - Target latest stable Chrome, Edge, Firefox, and Safari.
  - Graceful degradation if:
    - Async clipboard image write is unavailable.
    - `createImageBitmap` or `OffscreenCanvas` is unavailable.
- Accessibility:
  - Keyboard navigable controls.
  - ARIA labels for key actions.
  - High-contrast-friendly theme (leveraging DaisyUI theme tokens).

3. UI / UX Design

-----------------

### Layout

- Top-level:
  - App header with project name and short description.
  - Main area with two columns on desktop:
    - Left column: 30–40% width, scrollable settings panel.
    - Right column: remaining width, paste/preview area.
- Settings panel (left):
  - Preset button group: `Original`, `Large`, `Medium`, `Small`.
  - Resolution section:
    - Width and height numeric inputs.
    - Aspect ratio lock toggle.
    - Resize mode radio group (`Fit`, `Fill (crop)`, `Stretch`).
  - Output section:
    - Output format select.
    - Quality slider/field (conditionally shown).
    - Strip metadata checkbox (default checked).
  - Advanced or “About” section as needed.
- Paste/preview panel (right):
  - Input area:
    - A bordered surface with instructions:
      - “Paste image here (Ctrl/Cmd + V), or drop / click to select.”
  - When an image is loaded:
    - Show two cards:
      - Source image card (thumbnail + meta: format, size, dimensions).
      - Result image card (thumbnail + meta: format, size, dimensions).
    - Result card includes:
      - Copy button.
      - Download button.
      - Status labels (e.g. “Stripped metadata”, “Resized to 1280 × 720”).

### Visual framework

- Use Tailwind CSS with DaisyUI components.
- Stick to DaisyUI component patterns:
  - `card`, `btn`, `btn-primary`, `select`, `input`, `range`, `toggle`, `alert`, `toast`.
- Default DaisyUI theme can be used initially, with a simple light/dark toggle added later if desired.

4. Technical Architecture

-------------------------

4.1 Stack
---------

- React (latest stable) with function components and hooks.
- TypeScript (strict mode).
- Vite (latest stable) as the build tool and dev server.
  - Dev server configured to use port `25119`.
- Tailwind CSS + DaisyUI for styling and components.
- Optional libraries:
  - HEIC/HEIF conversion: `heic2any` or equivalent browser-side converter.

4.2 High-level component structure
----------------------------------

Proposed structure (not yet implemented, but used for planning):

- `src/main.tsx`
  - Bootstraps React and wraps `App` with providers if needed.
- `src/App.tsx`
  - Top-level layout: header + main.
  - Holds global state for current image and processing options (or delegates to a state container).

Components:

- `SettingsPanel`
  - Props:
    - `options`, `onOptionsChange`, `onPresetSelect`.
  - Renders presets, resolution, resize mode, format, quality, metadata toggle.
- `PresetButtons`
  - Stateless; emits selected preset ID.
- `PasteArea`
  - Handles:
    - Paste events.
    - Drag-and-drop.
    - File input.
  - Emits a File/Blob or error to the parent.
- `PreviewPanel`
  - Receives `sourceImageInfo` and `resultImageInfo`.
  - Renders source/result cards and action buttons for the result.
- `ResultActions`
  - Handles copy/download actions for the result blob.
- `StatusBar` or `ToastHost`
  - For inline status and error messages.

4.3 State model
---------------

Type sketches:

- `ProcessingOptions`:
  - `presetId: "original" | "large" | "medium" | "small" | null`
  - `targetWidth: number | null`
  - `targetHeight: number | null`
  - `lockAspectRatio: boolean`
  - `resizeMode: "fit" | "fill" | "stretch"`
  - `outputFormat: "auto" | "image/jpeg" | "image/png" | "image/webp"`
  - `quality: number | null`
  - `stripMetadata: boolean`
- `ImageInfo`:
  - `blob: Blob`
  - `url: string` (object URL)
  - `width: number`
  - `height: number`
  - `mimeType: string`
  - `fileSize: number`
  - `sourceName?: string`
- `AppState`:
  - `source: ImageInfo | null`
  - `result: ImageInfo | null`
  - `options: ProcessingOptions`
  - `status: "idle" | "processing" | "error"`
  - `errorMessage?: string`

Hooks and helpers:

- `useImageProcessor(options)`:
  - Exposes `process(imageBlob): Promise<ImageInfo>`.
  - Encapsulates the pipeline (decode, resize, encode).
- `useClipboard()`:
  - Exposes `copyImage(blob): Promise<void>`.
  - Handles feature detection and errors.
- `lib/imageProcessing.ts`:
  - Pure functions for computing target sizes and resize modes.
- `lib/heic.ts`:
  - Wrapped integration with the HEIC/HEIF converter, loaded lazily.

5. Clipboard and Browser Integration

------------------------------------

- Paste handling:
  - Attach `paste` listener to a focusable element in the right pane and optionally to `window` while the app is focused.
  - For each clipboard item:
    - Prefer image types (`image/png`, `image/jpeg`, `image/heic`, etc.).
    - Extract the corresponding blob and pass it into the processing pipeline.
- Copy handling:
  - Use async clipboard API where available:
    - `navigator.clipboard.write([new ClipboardItem({ [mime]: blob })])`.
  - Fallback:
    - Show instructions to manually copy via right-click or using OS shortcuts on the preview image.
- Permissions:
  - Gracefully handle:
    - `NotAllowedError` when clipboard access is denied.
    - Missing `navigator.clipboard.write` or `navigator.clipboard.read`.

6. Development and Tooling Plan

-------------------------------

- Project scaffolding (to be done later):
  - Initialize Vite React + TypeScript template in the `paste-preset` directory.
  - Install and configure Tailwind CSS and DaisyUI.
  - Configure Vite dev server:
    - `server: { port: 25119 }`.
- Code quality:
  - Enable strict TypeScript options.
  - Use ESLint and Prettier with conventional React/TypeScript rules.
- Git:
  - Repository already initialized.
  - Commit messages should follow Conventional Commits style.

7. Future Enhancements (Out of Scope for v1)

--------------------------------------------

- Multiple image queue/history with batch processing.
- User-defined named presets with persistence (e.g. localStorage).
- Dark mode toggle.
- More advanced metadata control (view/edit EXIF).
- Drag to reorder and compare multiple result variants (different quality/resolution combinations).
PastePreset – Design Document
=============================

1. Overview

-----------

PastePreset is a single-page, clipboard-centric web app for quickly converting and resizing images entirely in the browser. Users configure presets (resolution, aspect handling, output format, quality, metadata stripping), then paste or drop an image and immediately get a processed result that can be copied back to the clipboard or downloaded.

Target usage:

- Paste screenshots or mobile photos.
- Normalize size/format for documentation, design tools, or chat apps.
- Ensure privacy by stripping metadata and avoiding any server-side processing.

2. Core Requirements

--------------------

2.1 Functional
--------------

### Layout and interaction

- Single-page application.
- Two-pane layout on desktop:
  - Left: parameter/settings panel.
  - Right: paste/preview area for input and processed image.
- On narrow screens (mobile), panels stack vertically with sensible order (settings first, then paste/preview) and optional tabs.

### Image input

- Input methods:
  - Paste from clipboard (`Ctrl/Cmd + V`) when the app window is focused.
  - Drag-and-drop into the right-hand area.
  - File picker button as a fallback (`<input type="file">`).
- Multiple formats:
  - Standard web formats: JPEG, PNG, WebP, GIF, BMP.
  - Mobile-focused formats:
    - HEIC/HEIF (via a browser-side library such as `heic2any` for conversion to a canvas-friendly format).
  - If a format is unsupported by the browser or conversion pipeline, show a clear error message.
- Single active image in v1:
  - Each paste/load replaces the current source image and result.
  - History/multi-image support can be considered as a future enhancement.

### Parameter presets

Located at the top of the left settings panel:

- Preset buttons:
  - `Original`:
    - Keeps original resolution.
    - Output format defaults to “same as source” unless explicitly changed.
  - `Large`:
    - Constrains the longest side to a max (e.g. 2048 px) with aspect ratio preserved.
  - `Medium`:
    - Longest side e.g. 1280 px.
  - `Small`:
    - Longest side e.g. 800 px.
- Clicking a preset:
  - Updates resolution-related controls and quality defaults.
  - Does not immediately process; user pastes/selects an image to apply the preset.
  - If an image is already loaded, changing preset re-triggers processing.

Exact pixel sizes for presets should be configurable via a single config object so they can be tuned later without touching logic.

### Resolution and aspect ratio handling

Controls in the settings panel:

- Target resolution:
  - Inputs for width and height (integer pixels).
  - A “lock aspect ratio” toggle:
    - When locked, editing one dimension updates the other based on the source aspect ratio or the currently computed target aspect.
    - When unlocked, both dimensions are independent.
- When both width and height are specified and the source aspect ratio differs, behavior is controlled by a “Resize mode” option:
  - `Fit` (default):
    - Scales the image to fit entirely within the target box while preserving aspect ratio.
    - Remaining area is left transparent for formats supporting alpha (PNG, WebP) or filled with a solid background color (for JPEG) when implemented.
  - `Fill (crop)`:
    - Scales the image to cover the entire target box and crops overflow, preserving aspect ratio.
  - `Stretch`:
    - Scales independently in X and Y to exactly match the target width and height, ignoring aspect ratio.

### Output format and quality

- Output format select:
  - `Auto (same as source)`
  - `JPEG`
  - `PNG`
  - `WebP`
  - (`AVIF` can be added later depending on browser support and complexity.)
- Quality factor:
  - Visible only when the chosen output format supports lossy quality:
    - JPEG
    - WebP (lossy)
  - Represented as a slider and numeric input:
    - Range: 0.1 – 1.0 (or 10 – 100%) with sensible default (e.g. 0.8).
  - Hidden or disabled for lossless formats (PNG, lossless WebP, Auto when the resolved output is lossless).

### Metadata handling

- Option: `Strip metadata` (default checked).
  - When enabled (default), the app re-encodes the image without EXIF/IPTC/XMP metadata.
  - When disabled, the app attempts to preserve metadata only if the pipeline and format allow it. At minimum, this toggle should control whether EXIF orientation is applied and then discarded.
- The actual implementation will likely always re-encode via a canvas (which drops most metadata) but the toggle will:
  - Control whether EXIF orientation is honored.
  - Reserve room for future metadata-aware optimizations.

### Processing pipeline

High-level steps when an image is received:

1. **Load source**
   - Read `File` or clipboard `Blob` into an object URL or `ArrayBuffer`.
   - If MIME type indicates HEIC/HEIF, invoke the conversion helper (based on `heic2any` or similar) to produce a PNG or JPEG blob.
   - For other formats, proceed directly.
2. **Decode**
   - Use `createImageBitmap` when available for performance, otherwise an `<img>` element.
3. **Compute target size**
   - Based on:
     - Source dimensions.
     - Selected preset (if any).
     - Explicit width/height.
     - Resize mode (`fit`, `fill`, `stretch`).
4. **Render to canvas**
   - Use `<canvas>` (or `OffscreenCanvas` if supported) to draw the scaled image.
   - Use `imageSmoothingEnabled`/`imageSmoothingQuality` set to `"high"`.
5. **Export**
   - Use `canvas.toBlob` with the chosen MIME type and quality factor.
   - The resulting `Blob` is the canonical “result image”.
6. **Update UI**
   - Show the result preview.
   - Attach blob URL for `<img>` source and for download.

### Result copy and download

For the processed image:

- Default selection:
  - Immediately after processing, the result image is considered “selected”.
  - Visually highlight the selected result card.
- Copy to clipboard:
  - Copy button:
    - Uses the async clipboard API (`navigator.clipboard.write`) with a `ClipboardItem` containing the image blob when supported.
    - On failure:
      - Show a toast explaining that the browser does not allow programmatic image copying and instruct the user to right-click and copy or use keyboard shortcuts.
  - Keyboard shortcut:
    - When the result area is focused, `Ctrl/Cmd + C` triggers the same clipboard write logic.
  - Native context menu:
    - The result image is a standard `<img>` so the OS/browser “Copy image” menu works.
- Download:
  - Download button:
    - Creates a temporary object URL for the blob and triggers an `<a download>` click.
    - Default file name:
      - `pastepreset-YYYYMMDD-HHMMSS.ext` (ext based on output format).

### Error and status handling

- Global status indicator for:
  - Idle
  - Processing (with spinner and short text)
  - Error (with clear explanation and possible next steps)
- Typical error cases:
  - No image data in clipboard.
  - Unsupported format (with special handling for HEIC when library is not available).
  - Image too large to process (canvas size limits).
  - Clipboard write permission denied.

2.2 Non-functional
-------------------

- All processing is client-side; no images are uploaded to any server.
- Performance:
  - Must handle typical modern smartphone photos (up to around 4000–6000 px on the long side) on mid-range hardware.
  - Use progressive downscaling for very large images if needed.
- Browser support:
  - Target latest stable Chrome, Edge, Firefox, and Safari.
  - Graceful degradation if:
    - Async clipboard image write is unavailable.
    - `createImageBitmap` or `OffscreenCanvas` is unavailable.
- Accessibility:
  - Keyboard navigable controls.
  - ARIA labels for key actions.
  - High-contrast-friendly theme (leveraging DaisyUI theme tokens).

3. UI / UX Design

-----------------

### Layout

- Top-level:
  - App header with project name and short description.
  - Main area with two columns on desktop:
    - Left column: 30–40% width, scrollable settings panel.
    - Right column: remaining width, paste/preview area.
- Settings panel (left):
  - Preset button group: `Original`, `Large`, `Medium`, `Small`.
  - Resolution section:
    - Width and height numeric inputs.
    - Aspect ratio lock toggle.
    - Resize mode radio group (`Fit`, `Fill (crop)`, `Stretch`).
  - Output section:
    - Output format select.
    - Quality slider/field (conditionally shown).
    - Strip metadata checkbox (default checked).
  - Advanced or “About” section as needed.
- Paste/preview panel (right):
  - Input area:
    - A bordered surface with instructions:
      - “Paste image here (Ctrl/Cmd + V), or drop / click to select.”
  - When an image is loaded:
    - Show two cards:
      - Source image card (thumbnail + meta: format, size, dimensions).
      - Result image card (thumbnail + meta: format, size, dimensions).
    - Result card includes:
      - Copy button.
      - Download button.
      - Status labels (e.g. “Stripped metadata”, “Resized to 1280 × 720”).

### Visual framework

- Use Tailwind CSS with DaisyUI components.
- Stick to DaisyUI component patterns:
  - `card`, `btn`, `btn-primary`, `select`, `input`, `range`, `toggle`, `alert`, `toast`.
- Default DaisyUI theme can be used initially, with a simple light/dark toggle added later if desired.

4. Technical Architecture

-------------------------

4.1 Stack
---------

- React (latest stable) with function components and hooks.
- TypeScript (strict mode).
- Vite (latest stable) as the build tool and dev server.
  - Dev server configured to use port `25119`.
- Tailwind CSS + DaisyUI for styling and components.
- Optional libraries:
  - HEIC/HEIF conversion: `heic2any` or equivalent browser-side converter.

4.2 High-level component structure
----------------------------------

Proposed structure (not yet implemented, but used for planning):

- `src/main.tsx`
  - Bootstraps React and wraps `App` with providers if needed.
- `src/App.tsx`
  - Top-level layout: header + main.
  - Holds global state for current image and processing options (or delegates to a state container).

Components:

- `SettingsPanel`
  - Props:
    - `options`, `onOptionsChange`, `onPresetSelect`.
  - Renders presets, resolution, resize mode, format, quality, metadata toggle.
- `PresetButtons`
  - Stateless; emits selected preset ID.
- `PasteArea`
  - Handles:
    - Paste events.
    - Drag-and-drop.
    - File input.
  - Emits a File/Blob or error to the parent.
- `PreviewPanel`
  - Receives `sourceImageInfo` and `resultImageInfo`.
  - Renders source/result cards and action buttons for the result.
- `ResultActions`
  - Handles copy/download actions for the result blob.
- `StatusBar` or `ToastHost`
  - For inline status and error messages.

4.3 State model
---------------

Type sketches:

- `ProcessingOptions`:
  - `presetId: "original" | "large" | "medium" | "small" | null`
  - `targetWidth: number | null`
  - `targetHeight: number | null`
  - `lockAspectRatio: boolean`
  - `resizeMode: "fit" | "fill" | "stretch"`
  - `outputFormat: "auto" | "image/jpeg" | "image/png" | "image/webp"`
  - `quality: number | null`
  - `stripMetadata: boolean`
- `ImageInfo`:
  - `blob: Blob`
  - `url: string` (object URL)
  - `width: number`
  - `height: number`
  - `mimeType: string`
  - `fileSize: number`
  - `sourceName?: string`
- `AppState`:
  - `source: ImageInfo | null`
  - `result: ImageInfo | null`
  - `options: ProcessingOptions`
  - `status: "idle" | "processing" | "error"`
  - `errorMessage?: string`

Hooks and helpers:

- `useImageProcessor(options)`:
  - Exposes `process(imageBlob): Promise<ImageInfo>`.
  - Encapsulates the pipeline (decode, resize, encode).
- `useClipboard()`:
  - Exposes `copyImage(blob): Promise<void>`.
  - Handles feature detection and errors.
- `lib/imageProcessing.ts`:
  - Pure functions for computing target sizes and resize modes.
- `lib/heic.ts`:
  - Wrapped integration with the HEIC/HEIF converter, loaded lazily.

5. Clipboard and Browser Integration

------------------------------------

- Paste handling:
  - Attach `paste` listener to a focusable element in the right pane and optionally to `window` while the app is focused.
  - For each clipboard item:
    - Prefer image types (`image/png`, `image/jpeg`, `image/heic`, etc.).
    - Extract the corresponding blob and pass it into the processing pipeline.
- Copy handling:
  - Use async clipboard API where available:
    - `navigator.clipboard.write([new ClipboardItem({ [mime]: blob })])`.
  - Fallback:
    - Show instructions to manually copy via right-click or using OS shortcuts on the preview image.
- Permissions:
  - Gracefully handle:
    - `NotAllowedError` when clipboard access is denied.
    - Missing `navigator.clipboard.write` or `navigator.clipboard.read`.

6. Development and Tooling Plan

-------------------------------

- Project scaffolding (to be done later):
  - Initialize Vite React + TypeScript template in the `paste-preset` directory.
  - Install and configure Tailwind CSS and DaisyUI.
  - Configure Vite dev server:
    - `server: { port: 25119 }`.
- Code quality:
  - Enable strict TypeScript options.
  - Use ESLint and Prettier with conventional React/TypeScript rules.
- Git:
  - Repository already initialized.
  - Commit messages should follow Conventional Commits style.

7. Future Enhancements (Out of Scope for v1)

--------------------------------------------

- Multiple image queue/history with batch processing.
- User-defined named presets with persistence (e.g. localStorage).
- Dark mode toggle.
- More advanced metadata control (view/edit EXIF).
- Drag to reorder and compare multiple result variants (different quality/resolution combinations).
