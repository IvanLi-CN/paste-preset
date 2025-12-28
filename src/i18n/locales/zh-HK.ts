import type { TranslationMessages } from "./types";

export const zhHK: TranslationMessages = {
  // App chrome
  "app.title": "PastePreset",
  "app.tagline": "貼上或拖曳圖片，在瀏覽器中完成尺寸調整與格式轉換。",
  "app.summary.preset": "預設",
  "app.summary.size": "尺寸",
  "app.summary.format": "格式",
  "app.summary.mode": "模式",
  "app.summary.auto": "自動",

  // Language selector
  "language.ariaLabel": "切換語言",
  "language.en": "English",
  "language.zh-CN": "簡體中文",
  "language.zh-TW": "繁體中文（台灣）",
  "language.zh-HK": "繁體中文（香港）",

  // Clipboard / status
  "clipboard.copying": "正在將圖片複製到剪貼簿…",
  "clipboard.error.unsupported":
    "目前瀏覽器不支援以程式方式寫入圖片到剪貼簿。請使用瀏覽器選單（例如右鍵 → 複製圖片）手動複製結果。",
  "clipboard.error.formatUnsupported":
    "目前瀏覽器不支援複製此圖片格式。請使用瀏覽器選單（例如右鍵 → 複製圖片）手動複製結果。",
  "clipboard.error.prepareFailed": "準備圖片以複製到剪貼簿時失敗。",
  "clipboard.error.convertFailed": "轉換圖片以複製到剪貼簿時失敗。",
  "clipboard.error.generic": "複製圖片失敗",
  "shortcut.copy.noUpToDateResult":
    "目前任務尚未有符合目前設定的結果。請展開已完成的項目，或等待處理完成。",

  "status.processing": "處理中…",
  "status.queued": "排隊中",
  "status.done": "已完成",
  "status.error": "錯誤",
  "status.error.unknown": "未知處理錯誤",

  // Settings panel
  "settings.title": "設定",
  "settings.description": "設定貼上圖片的縮放方式與輸出格式。",

  "settings.presets.title": "預設",
  "settings.presets.original": "原始",
  "settings.presets.large": "大",
  "settings.presets.medium": "中",
  "settings.presets.small": "小",
  "settings.presets.custom": "自訂",
  "settings.presets.unsaved": "未儲存",
  "settings.presets.delete": "刪除",
  "settings.presets.fallbackWarning":
    "無法在此裝置上儲存預設。對預設的更改在關閉頁面後不會被保留。",

  "settings.resolution.title": "解像度",
  "settings.resolution.width": "闊度（px）",
  "settings.resolution.height": "高度（px）",
  "settings.resolution.placeholderAuto": "自動",
  "settings.resolution.lockAspectRatio": "鎖定長闊比",

  "settings.resizeMode.title": "縮放模式",
  "settings.resizeMode.fit": "等比例縮放",
  "settings.resizeMode.fill": "填滿（裁切）",
  "settings.resizeMode.stretch": "拉伸",

  "settings.output.title": "輸出",
  "settings.output.format.label": "格式",
  "settings.output.format.auto": "自動（依來源）",
  "settings.output.format.jpeg": "JPEG",
  "settings.output.format.png": "PNG",
  "settings.output.format.webp": "WebP",
  "settings.output.quality.label": "質素",
  "settings.output.stripMetadata": "移除中繼資料（EXIF 等）",

  "settings.presets.diff.size": "尺寸: {value}",
  "settings.presets.diff.format": "格式: {value}",
  "settings.presets.diff.quality": "質素: {value}",
  "settings.presets.diff.stripMetadata": "移除中繼資料",
  "settings.presets.diff.stripMetadata.short": "脫敏",

  "settings.actions.reset": "重設設定",

  "settings.about.title": "關於",
  "settings.about.description":
    "PastePreset 完全在瀏覽器中執行，圖片不會離開你的裝置。貼上螢幕截圖或將照片拖曳到右側即可開始處理。",

  "settings.tools.title": "進階操作",
  "settings.tools.description": "管理 PastePreset 在此裝置上儲存的本機資料。",
  "settings.tools.resetPresets": "重設預設清單",
  "settings.tools.resetPresets.confirm":
    "確定要重設此裝置上的預設清單嗎？這會還原預設列表並刪除你建立的自訂預設。",
  "settings.tools.resetPresets.confirmButton": "重設預設",
  "settings.tools.resetPresets.cancelButton": "取消",

  "settings.drawer.closeAria": "關閉設定",
  "settings.drawer.overlayAria": "關閉設定面板",

  // Paste area
  "pasteArea.aria.replace": "貼上、拖曳或點擊以取代目前圖片",
  "pasteArea.aria.select": "貼上、拖曳或點擊以選擇圖片",
  "pasteArea.title.replace": "貼上、拖曳或點擊以取代圖片",
  "pasteArea.title.initial": "在此貼上圖片（Ctrl/Cmd + V）",
  "pasteArea.subtitle": "或將圖片拖曳到此處，或點擊選擇檔案",
  "pasteArea.error.noImageFile": "請貼上一張圖片或將圖片拖曳到此處。",
  "pasteArea.error.noClipboardImage":
    "剪貼簿中未找到圖片資料。請先複製一張圖片後再試一次。",

  // Preview panel & image cards
  "preview.empty": "貼上、拖曳或選擇一張圖片，在此查看原圖與處理後的預覽。",
  "preview.source.title": "原始圖片",
  "preview.result.title": "結果圖片",
  "preview.result.description": "結果圖片可以複製到剪貼簿或下載到本機。",
  "preview.result.badge.originalSize": "原始尺寸",
  "preview.result.badge.resizedPrefix": "已調整為",
  "preview.result.badge.metadataStripped": "已移除中繼資料",
  "preview.result.badge.metadataPreserved": "保留中繼資料",

  "preview.actions.copyLabel": "複製到剪貼簿",
  "preview.actions.copyAria": "將結果圖片複製到剪貼簿",
  "preview.actions.downloadLabel": "下載",
  "preview.actions.downloadAria": "下載結果圖片",

  "export.gate.noResult": "暫無結果。",
  "export.gate.queued": "排隊中…",
  "export.gate.processing": "處理中…",
  "export.gate.waiting": "等待重新生成…",
  "export.gate.regenerating": "重新生成中…",
  "export.gate.failed": "目前設定下重新生成失敗。",
  "export.gate.stale": "結果已過期，請等待重新生成。",
  "export.gate.unavailable": "暫時無法匯出。",

  "preview.result.overlay.waiting": "等待中…",
  "preview.result.overlay.regenerating": "重新生成中…",
  "preview.result.overlay.failed": "重新生成失敗",

  // Fullscreen viewer
  "preview.viewer.closeAria": "關閉全螢幕圖片預覽",
  "preview.viewer.zoomIn": "放大",
  "preview.viewer.zoomOut": "縮小",
  "preview.viewer.fit": "適合螢幕",
  "preview.viewer.actualSize": "實際大小（1:1）",
  "preview.viewer.loading": "正在載入圖片…",
  "preview.viewer.error": "圖片載入失敗。",
  "preview.viewer.retry": "重試",

  "preview.card.dimensions": "解像度",
  "preview.card.format": "格式",
  "preview.card.size": "檔案大小",
  "preview.card.metadataLabel": "中繼資料",
  "preview.card.metadataStrippedBadge": "已移除",
  "preview.card.metadataPreservedBadge": "已保留",
  "preview.card.metadataUnknownBadge": "未知",
  "preview.card.captured": "拍攝時間",
  "preview.card.camera": "相機",
  "preview.card.lens": "鏡頭",
  "preview.card.exposure": "曝光",
  "preview.card.isoPrefix": "ISO",
  "preview.card.focalLength": "焦距",
  "preview.card.location": "位置",
  "preview.card.metadataSummary.stripped":
    "匯出此圖片時已移除 EXIF / IPTC / XMP 中繼資料。",
  "preview.card.metadataSummary.preserved":
    "在可能的情況下，此圖片保留了原始中繼資料。",
  "preview.card.metadataSummary.unknown": "無法判斷此圖片的中繼資料狀態。",

  // Processing / HEIC errors
  "error.heic.unavailable":
    "目前環境不支援 HEIC/HEIF 轉換。請先在裝置上將圖片轉換為 JPEG 或 PNG 再試一次。",
  "error.heic.libraryFailed":
    "HEIC/HEIF 轉換程式庫載入失敗。請將圖片轉換為 JPEG 或 PNG 再試一次。",
  "error.heic.convertFailed":
    "HEIC/HEIF 圖片轉換失敗。請將圖片轉換為 JPEG 或 PNG 再試一次。",
  "error.heic.unexpectedResult": "HEIC 轉換結果異常。",
  "error.processing.invalidDataUrl": "圖片資料無效。",
  "error.processing.sourceReadTimeout":
    "讀取圖片檔案逾時。該檔案可能位於雲端/外部裝置，尚未完整下載到本機。請先將檔案儲存到本機後再試一次。",
  "error.processing.canvasContext": "無法準備圖片以進行處理。",
  "error.processing.decodeFailed": "圖片載入失敗。",
  "error.processing.timeout":
    "圖片處理逾時。請稍後再試（先將檔案儲存到本機可能會有所幫助）。",
  "error.processing.tooLarge":
    "要求的輸出尺寸過大，無法安全處理。請減小闊度與高度或選擇較低解像度的預設後再試一次。",
  "error.processing.exportFailed": "匯出圖片失敗。",
};
