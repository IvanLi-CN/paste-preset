import type { TranslationMessages } from "./types";

export const zhCN: TranslationMessages = {
  // App chrome
  "app.title": "PastePreset",
  "app.tagline": "粘贴或拖拽图片，在浏览器中完成尺寸调整和格式转换。",
  "app.summary.preset": "预设",
  "app.summary.size": "尺寸",
  "app.summary.format": "格式",
  "app.summary.mode": "模式",
  "app.summary.auto": "自动",

  // Language selector
  "language.ariaLabel": "切换语言",
  "language.en": "English",
  "language.zh-CN": "简体中文",
  "language.zh-TW": "繁體中文（台灣）",
  "language.zh-HK": "繁體中文（香港）",

  // Clipboard / status
  "clipboard.copying": "正在将图片复制到剪贴板…",
  "clipboard.error.unsupported":
    "当前浏览器不支持以编程方式写入图片到剪贴板。请使用浏览器菜单（例如右键 → 复制图片）手动复制结果。",
  "clipboard.error.formatUnsupported":
    "当前浏览器不支持复制此图片格式。请使用浏览器菜单（例如右键 → 复制图片）手动复制结果。",
  "clipboard.error.prepareFailed": "准备图片以复制到剪贴板时失败。",
  "clipboard.error.convertFailed": "转换图片以复制到剪贴板时失败。",
  "clipboard.error.generic": "复制图片失败",

  "status.processing": "正在处理图片…",
  "status.error.unknown": "发生未知的处理错误",

  // Settings panel
  "settings.title": "设置",
  "settings.description": "配置粘贴图片的缩放方式和导出格式。",

  "settings.presets.title": "预设",
  "settings.presets.original": "原始",
  "settings.presets.large": "大",
  "settings.presets.medium": "中",
  "settings.presets.small": "小",
  "settings.presets.custom": "自定义",
  "settings.presets.unsaved": "未保存",
  "settings.presets.fallbackWarning":
    "无法在此设备上保存预设。对预设的更改在关闭页面后不会被保留。",

  "settings.resolution.title": "分辨率",
  "settings.resolution.width": "宽度（px）",
  "settings.resolution.height": "高度（px）",
  "settings.resolution.placeholderAuto": "自动",
  "settings.resolution.lockAspectRatio": "锁定长宽比",

  "settings.resizeMode.title": "缩放模式",
  "settings.resizeMode.fit": "适配",
  "settings.resizeMode.fill": "填充（裁剪）",
  "settings.resizeMode.stretch": "拉伸",

  "settings.output.title": "输出",
  "settings.output.format.label": "格式",
  "settings.output.format.auto": "自动（跟随来源）",
  "settings.output.format.jpeg": "JPEG",
  "settings.output.format.png": "PNG",
  "settings.output.format.webp": "WebP",
  "settings.output.quality.label": "质量",
  "settings.output.stripMetadata": "移除元数据（EXIF 等）",

  "settings.actions.reset": "重置设置",

  "settings.about.title": "关于",
  "settings.about.description":
    "PastePreset 完全在浏览器中运行，图片不会离开你的设备。粘贴截图或将照片拖到右侧即可开始处理。",

  "settings.drawer.closeAria": "关闭设置",

  // Paste area
  "pasteArea.aria.replace": "粘贴、拖拽或点击以替换当前图片",
  "pasteArea.aria.select": "粘贴、拖拽或点击以选择图片",
  "pasteArea.title.replace": "粘贴、拖拽或点击以替换图片",
  "pasteArea.title.initial": "在此粘贴图片（Ctrl/Cmd + V）",
  "pasteArea.subtitle": "或者拖拽图片到此处，或点击选择文件",
  "pasteArea.error.noImageFile": "请粘贴或拖拽一张图片文件。",
  "pasteArea.error.noClipboardImage":
    "剪贴板中未找到图片数据。请先复制一张图片后重试。",

  // Preview panel & image cards
  "preview.empty": "粘贴、拖拽或选择一张图片，在这里查看原图与处理后的预览。",
  "preview.source.title": "原始图片",
  "preview.result.title": "结果图片",
  "preview.result.description": "结果图片可以复制到剪贴板或下载到本地。",
  "preview.result.badge.originalSize": "原始尺寸",
  "preview.result.badge.resizedPrefix": "已调整为",
  "preview.result.badge.metadataStripped": "已移除元数据",
  "preview.result.badge.metadataPreserved": "保留元数据",

  "preview.actions.copyLabel": "复制到剪贴板",
  "preview.actions.copyAria": "将结果图片复制到剪贴板",
  "preview.actions.downloadLabel": "下载",
  "preview.actions.downloadAria": "下载结果图片",

  "preview.card.dimensions": "分辨率",
  "preview.card.format": "格式",
  "preview.card.size": "文件大小",
  "preview.card.metadataLabel": "元数据",
  "preview.card.metadataStrippedBadge": "已移除",
  "preview.card.metadataPreservedBadge": "已保留",
  "preview.card.metadataUnknownBadge": "未知",
  "preview.card.captured": "拍摄时间",
  "preview.card.camera": "相机",
  "preview.card.lens": "镜头",
  "preview.card.exposure": "曝光",
  "preview.card.isoPrefix": "ISO",
  "preview.card.focalLength": "焦距",
  "preview.card.location": "位置",
  "preview.card.metadataSummary.stripped":
    "导出本图片时已移除 EXIF / IPTC / XMP 元数据。",
  "preview.card.metadataSummary.preserved":
    "在可能的情况下，本图片保留了原始元数据。",
  "preview.card.metadataSummary.unknown": "无法确定本图片的元数据状态。",

  // Processing / HEIC errors
  "error.heic.unavailable":
    "当前环境不支持 HEIC/HEIF 转换。请先在设备上将图片转换为 JPEG 或 PNG 后再试。",
  "error.heic.libraryFailed":
    "HEIC/HEIF 转换库加载失败。请将图片转换为 JPEG 或 PNG 后再试。",
  "error.heic.convertFailed":
    "HEIC/HEIF 图片转换失败。请将图片转换为 JPEG 或 PNG 后再试。",
  "error.heic.unexpectedResult": "HEIC 转换结果异常。",
  "error.processing.invalidDataUrl": "图片数据无效。",
  "error.processing.canvasContext": "无法准备图片进行处理。",
  "error.processing.decodeFailed": "图片加载失败。",
  "error.processing.tooLarge":
    "请求的输出尺寸过大，无法安全处理。请减小宽高或选择更低分辨率的预设后重试。",
  "error.processing.exportFailed": "导出图片失败。",
};
