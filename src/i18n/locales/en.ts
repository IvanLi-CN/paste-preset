export const en = {
  // App chrome
  "app.title": "PastePreset",
  "app.tagline":
    "Paste or drop an image, resize and convert it entirely in your browser.",
  "app.summary.preset": "Preset",
  "app.summary.size": "Size",
  "app.summary.format": "Format",
  "app.summary.mode": "Mode",
  "app.summary.auto": "auto",

  // Language selector
  "language.ariaLabel": "Change language",
  "language.en": "English",
  "language.zh-CN": "简体中文",
  "language.zh-TW": "繁體中文（台灣）",
  "language.zh-HK": "繁體中文（香港）",

  // Clipboard / status
  "clipboard.copying": "Copying image to clipboard…",
  "clipboard.error.unsupported":
    "Clipboard image write is not supported in this browser. Please use your browser's context menu (for example, right-click → Copy image) to copy the result manually.",
  "clipboard.error.formatUnsupported":
    "Copying this image format is not supported in this browser. Please use your browser's context menu (for example, right-click → Copy image) to copy the result manually.",
  "clipboard.error.prepareFailed": "Failed to prepare image for clipboard.",
  "clipboard.error.convertFailed": "Failed to convert image for clipboard.",
  "clipboard.error.generic": "Failed to copy image",

  "status.processing": "Processing image…",
  "status.queued": "Queued",
  "status.done": "Done",
  "status.error": "Error",
  "status.error.unknown": "Unknown processing error",

  // Settings panel
  "settings.title": "Settings",
  "settings.description":
    "Configure how your pasted images will be resized and exported.",

  "settings.presets.title": "Presets",
  "settings.presets.original": "Original",
  "settings.presets.large": "Large",
  "settings.presets.medium": "Medium",
  "settings.presets.small": "Small",
  "settings.presets.custom": "Custom",
  "settings.presets.unsaved": "Unsaved",
  "settings.presets.delete": "Delete",
  "settings.presets.fallbackWarning":
    "Unable to save presets on this device. Changes to presets will not be remembered after closing this page.",

  "settings.resolution.title": "Resolution",
  "settings.resolution.width": "Width (px)",
  "settings.resolution.height": "Height (px)",
  "settings.resolution.placeholderAuto": "Auto",
  "settings.resolution.lockAspectRatio": "Lock aspect ratio",

  "settings.resizeMode.title": "Resize mode",
  "settings.resizeMode.fit": "Fit",
  "settings.resizeMode.fill": "Fill (crop)",
  "settings.resizeMode.stretch": "Stretch",

  "settings.output.title": "Output",
  "settings.output.format.label": "Format",
  "settings.output.format.auto": "Auto (source)",
  "settings.output.format.jpeg": "JPEG",
  "settings.output.format.png": "PNG",
  "settings.output.format.webp": "WebP",
  "settings.output.quality.label": "Quality",
  "settings.output.stripMetadata": "Strip metadata (EXIF, etc.)",

  "settings.presets.diff.size": "Size: {value}",
  "settings.presets.diff.format": "Format: {value}",
  "settings.presets.diff.quality": "Quality: {value}",
  "settings.presets.diff.stripMetadata": "Strip metadata",
  "settings.presets.diff.stripMetadata.short": "Strip meta",

  "settings.actions.reset": "Reset settings",

  "settings.about.title": "About",
  "settings.about.description":
    "PastePreset runs entirely in your browser. Images never leave your device. Paste a screenshot or drop a photo on the right to get started.",

  "settings.tools.title": "Advanced tools",
  "settings.tools.description":
    "Manage local data stored by PastePreset on this device.",
  "settings.tools.resetPresets": "Reset preset list",
  "settings.tools.resetPresets.confirm":
    "Reset the preset list on this device? This will restore the default presets and remove any custom presets you created.",
  "settings.tools.resetPresets.confirmButton": "Reset presets",
  "settings.tools.resetPresets.cancelButton": "Cancel",

  "settings.drawer.closeAria": "Close settings",
  "settings.drawer.overlayAria": "Close settings panel",

  // Paste area
  "pasteArea.aria.replace":
    "Paste, drop, or click to replace the current image",
  "pasteArea.aria.select": "Paste, drop, or click to select an image",
  "pasteArea.title.replace": "Paste, drop, or click to replace the image",
  "pasteArea.title.initial": "Paste image here (Ctrl/Cmd + V)",
  "pasteArea.subtitle": "or drag & drop an image, or click to choose a file",
  "pasteArea.error.noImageFile": "Please paste or drop an image file.",
  "pasteArea.error.noClipboardImage":
    "No image data found in the clipboard. Please copy an image and try again.",

  // Preview panel & image cards
  "preview.empty":
    "Paste, drop, or select an image to see the original and processed previews here.",
  "preview.source.title": "Source image",
  "preview.result.title": "Result image",
  "preview.result.description":
    "Result can be copied to clipboard or downloaded as a file.",
  "preview.result.badge.originalSize": "Original size",
  "preview.result.badge.resizedPrefix": "Resized to",
  "preview.result.badge.metadataStripped": "Stripped metadata",
  "preview.result.badge.metadataPreserved": "Metadata preserved",

  "preview.actions.copyLabel": "Copy to clipboard",
  "preview.actions.copyAria": "Copy result image to clipboard",
  "preview.actions.downloadLabel": "Download",
  "preview.actions.downloadAria": "Download result image",

  // Fullscreen viewer
  "preview.viewer.closeAria": "Close fullscreen image preview",
  "preview.viewer.zoomIn": "Zoom in",
  "preview.viewer.zoomOut": "Zoom out",
  "preview.viewer.fit": "Fit to screen",
  "preview.viewer.actualSize": "Actual size (1:1)",
  "preview.viewer.loading": "Loading image…",
  "preview.viewer.error": "Unable to load image.",
  "preview.viewer.retry": "Retry",

  "preview.card.dimensions": "Dimensions",
  "preview.card.format": "Format",
  "preview.card.size": "Size",
  "preview.card.metadataLabel": "Metadata",
  "preview.card.metadataStrippedBadge": "Stripped",
  "preview.card.metadataPreservedBadge": "Preserved",
  "preview.card.metadataUnknownBadge": "Unknown",
  "preview.card.captured": "Captured",
  "preview.card.camera": "Camera",
  "preview.card.lens": "Lens",
  "preview.card.exposure": "Exposure",
  "preview.card.isoPrefix": "ISO",
  "preview.card.focalLength": "Focal length",
  "preview.card.location": "Location",
  "preview.card.metadataSummary.stripped":
    "EXIF / IPTC / XMP data was removed when generating this image.",
  "preview.card.metadataSummary.preserved":
    "Original image metadata is kept for this image whenever possible.",
  "preview.card.metadataSummary.unknown":
    "This image's metadata status could not be determined.",

  // Processing / HEIC errors
  "error.heic.unavailable":
    "HEIC/HEIF conversion is not available in this environment. Please convert the image to JPEG or PNG and try again.",
  "error.heic.libraryFailed":
    "HEIC/HEIF conversion library failed to load correctly. Please convert the image to JPEG or PNG and try again.",
  "error.heic.convertFailed":
    "Failed to convert HEIC/HEIF image. Please convert it to JPEG or PNG and try again.",
  "error.heic.unexpectedResult": "Unexpected HEIC conversion result.",
  "error.processing.invalidDataUrl": "Invalid image data.",
  "error.processing.sourceReadTimeout":
    "Reading the image timed out. If the file is stored in cloud storage or a connected device, make sure it is downloaded locally and try again.",
  "error.processing.canvasContext": "Unable to prepare image for processing.",
  "error.processing.decodeFailed": "Failed to load image.",
  "error.processing.timeout":
    "Image processing timed out. Please try again (downloading the file locally may help).",
  "error.processing.tooLarge":
    "The requested output size is too large to process safely. Please choose smaller dimensions or a lower-resolution preset and try again.",
  "error.processing.exportFailed": "Failed to export image.",
} as const;
