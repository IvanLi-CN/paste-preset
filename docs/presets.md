# Preset and Default Configuration Semantics

This document defines how the **default configuration** and **presets** are
conceptually related in PastePreset. It is the source of truth for how
presets should behave in the UI and processing pipeline.

The document is normative for behaviour; implementation details in the code
should follow this specification.

---

## 1. Core Concepts

We distinguish three related concepts:

- **Default configuration (D)**  
  The configuration used:
  - on first load of the app, and
  - after the user clicks “Reset settings”.

  It represents the “Original / keep as-is” behaviour.

- **Current configuration (C)**  
  The configuration that is currently active. It is derived from:
  - the default configuration, plus
  - applying a preset, plus
  - any manual edits performed by the user.

- **Presets (Pi)**  
  Named configuration patches that are applied **on top of the default
  configuration**, not on top of the current configuration. Each preset only
  specifies how it differs from the default.

When applying preset *Pi*, the intended behaviour is:

```text
1. C := clone(D)
2. C := applyPatch(C, Pi)
3. C becomes the new active configuration
```

The `Original` preset is defined as the “no-op” preset: its patch does not
change any fields relative to `D` other than setting `presetId` itself.

---

## 2. Default Configuration D

The default configuration `D` represents a “keep everything as-is” behaviour.
It corresponds to the user selecting the `Original` preset and not changing
any settings.

Conceptually, the fields are:

- `presetId: "original"`  
  The Original preset is selected by default.

- `targetWidth: null`  
- `targetHeight: null`  
  No explicit target resolution is set. The processing pipeline should keep the
  original source dimensions when no preset imposes additional constraints and
  no explicit dimensions are provided by the user.

- `lockAspectRatio: true`  
  When the user edits width/height, the aspect ratio is locked by default.

- `resizeMode: "fit"`  
  - Only meaningful when both `targetWidth` and `targetHeight` are explicitly
    set.
  - `"fit"` is used as the safe default: scale to fit inside the target box
    without cropping, preserving aspect ratio. Empty space may appear.

- `outputFormat: "auto"`  
  - Semantics: **“as close to the source format as possible”**.
  - Resolution rules:
    - If the source MIME type is `image/jpeg`, `image/png`, `image/webp`,
      `image/gif`, or `image/apng`, the output format is the same as the
      (effective) source MIME.
      - Note: APNG is detected by scanning PNG chunks for `acTL`.
    - For other formats (including HEIC/HEIF and similar), the output format
      falls back to `image/jpeg`.

- `quality: 0.8`  
  - Used when encoding lossy formats (JPEG and WebP).
  - Ignored for lossless formats such as PNG.

- `stripMetadata: false`  
  - By default, metadata (EXIF, etc.) is **preserved** whenever the pipeline
    allows it.
  - When all of the following are true, the original blob may be passed
    through unchanged:
    - the input did not require HEIC/HEIF conversion;
    - `stripMetadata === false`;
    - the target dimensions equal the source dimensions;
    - the resolved output MIME equals the original MIME.

Both initial load and “Reset settings” should set the current configuration
`C` to `clone(D)`.

---

## 3. Preset Definitions (Patches Relative to D)

Presets are defined as **patches relative to the default configuration D**.
Any field not mentioned in a preset’s patch inherits the value from `D`.

In particular:

- `resizeMode` and `lockAspectRatio` are **not** overridden by presets unless
  explicitly stated.
- Metadata behaviour **is** overridden for size-changing presets: Large,
  Medium, and Small all enable `stripMetadata` by default.

### 3.1 Original Preset

- `id: "original"`

Patch relative to `D`:

- `presetId = "original"`
- No additional overrides.

Semantics:

- No extra resizing rules; the image keeps its original resolution when the
  user does not specify explicit dimensions.
- No change to quality, output format, or metadata behaviour beyond what is
  defined in `D`.

In other words, applying the `Original` preset is equivalent to using the
default configuration `D`.

### 3.2 Large Preset

- `id: "large"`

Patch relative to `D`:

- `presetId = "large"`
- `maxLongSide = 2048` (conceptually enforced by the sizing logic when
  explicit dimensions are not set)
- `outputFormat = "image/png"`
- `defaultQuality = 0.85`
- `stripMetadata = true`

Semantics:

- When no explicit width/height is provided:
  - If the source’s longest side ≤ 2048 px, keep the original resolution.
  - If the longest side > 2048 px, scale the image down so that the longest
    side becomes 2048 px, preserving aspect ratio.
- The resolved output format is **PNG** by default for this preset, regardless
  of the source format.
- Quality defaults to `0.85` for lossy formats (if relevant).
- Metadata is stripped by default (`stripMetadata = true`) so that resized
  exports do not carry EXIF and related information.

All other fields (e.g. `stripMetadata`, `resizeMode`, `lockAspectRatio`) are
inherited from `D` unless the user manually changes them.

### 3.3 Medium Preset

- `id: "medium"`

Patch relative to `D`:

- `presetId = "medium"`
- `maxLongSide = 1280`
- `outputFormat = "image/png"`
- `defaultQuality = 0.8`
- `stripMetadata = true`

Semantics:

- When no explicit width/height is provided:
  - If the source’s longest side ≤ 1280 px, keep the original resolution.
  - If the longest side > 1280 px, scale the image down so that the longest
    side becomes 1280 px, preserving aspect ratio.
- The resolved output format is **PNG** by default for this preset.
- Quality defaults to `0.8` for lossy formats.
- Metadata is stripped by default (`stripMetadata = true`).

Other fields follow `D` unless manually changed by the user.

### 3.4 Small Preset

- `id: "small"`

Patch relative to `D`:

- `presetId = "small"`
- `maxLongSide = 800`
- `outputFormat = "image/png"`
- `defaultQuality = 0.8`
- `stripMetadata = true`

Semantics:

- When no explicit width/height is provided:
  - If the source’s longest side ≤ 800 px, keep the original resolution.
  - If the longest side > 800 px, scale the image down so that the longest
    side becomes 800 px, preserving aspect ratio.
- The resolved output format is **PNG** by default for this preset.
- Quality defaults to `0.8` for lossy formats.
- Metadata is stripped by default (`stripMetadata = true`).

Other fields follow `D` unless manually changed.

---

## 4. Application Rules

### 4.1 Initial Load and Reset

- On initial load:
  - Load the stored user settings if available and valid.
  - If no stored settings exist or they are invalid, set `C := clone(D)`.

- When the user clicks “Reset settings”:
  - Clear stored settings.
  - Set `C := clone(D)`.

In both cases the UI should show the `Original` preset as selected.

### 4.2 Applying a Preset

When the user selects a preset `Pi` (Original / Large / Medium / Small):

1. Start from a fresh copy of the default configuration:  
   `C_new := clone(D)`
2. Apply the preset’s patch relative to `D`:
   - Set `presetId` to the preset’s id.
   - Clear explicit dimensions (`targetWidth`, `targetHeight`) so that the
     preset’s longest-side rules can determine the size.
   - Apply `maxLongSide`, `outputFormat`, and `defaultQuality` as defined for
     that preset.
3. Replace the current configuration:  
   `C := C_new`
4. Persist `C` to storage and re-run processing if an image is already loaded.

### 4.3 Manual Edits

After a preset is applied, the user may edit any fields (resolution, mode,
format, quality, metadata). These edits:

- Affect the current configuration `C` only.
- Do **not** change the default configuration `D`.
- Do **not** change the preset definitions.

When the user later selects another preset, the new configuration is again
computed as `clone(D)` plus that preset’s patch; previous manual edits do not
carry over unless they are persisted separately by design.
