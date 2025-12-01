# PastePreset 端到端测试用例

## 1. 目标与范围

- 覆盖 PastePreset v1 SPA 的核心用户路径：图像输入 → 参数配置 → 处理 → 复制/下载 → 状态与错误反馈。
- 验证在不同视口尺寸和浏览器能力下的关键行为（剪贴板、HEIC 转换等）。
- 测试以真实浏览器驱动（如 Playwright）执行，尽量少做 mock，仅在必要时对剪贴板和 HEIC 处理做能力模拟。

不在本轮覆盖：多图历史、服务器交互（不存在）、设计文档中尚未实现的“高级元数据控制”等未来功能。

---

## 2. 测试环境与前提

- 运行方式：
  - 启动 dev server：`bun run dev`，基址 `http://localhost:25119/`。
- 浏览器：
  - 推荐：最新稳定版 Chrome（主 Target）。
  - 回归点：最新 Edge / Firefox / Safari（可抽样执行关键路径）。
- 视口：
  - 桌面：`1280x800`（触发“两栏布局 + SettingsPanel 常驻”）。
  - 平板：`800x900`（Tailwind md，`>=768 && <1024`）。
  - 小屏：`390x844`（iPhone 12 近似，Tailwind xs/sm）。
- 测试用图片（应准备在 `public/test-images/` 或类似目录）：
  - `photo-large-jpeg.jpg`：手机照片，含 EXIF（相机/时间/位置）。
  - `screenshot-png.png`：UI 截图，无 EXIF。
  - `heic-photo.heic`：HEIC 手机照片（含 EXIF）。
  - `very-large.png`：分辨率足够大，可触发尺寸过大错误。
  - `non-image.txt`：非图片文件。
- 剪贴板能力：
  - 至少两种运行配置：
    - A：`navigator.clipboard.write` 正常可用。
    - B：禁用或模拟缺失/拒绝，验证降级提示。

---

## 3. 测试用例

### 3.1 首屏与基础布局

**E2E-001 首屏加载（桌面宽度）**

- 前置条件：浏览器视口 `1280x800`。
- 步骤：
  - 打开首页 `/`。
- 期望结果：
  - 页面标题区域显示：
    - 大标题 `PastePreset`。
    - 描述文案包含 `Paste or drop an image, resize and convert it entirely in your browser.`。
  - 顶部右侧显示 `Images stay on this device; no uploads.`。
  - 左侧出现 Settings 卡片，标题 `Settings` 和 “Presets/Resolution/Output/Strip metadata”等控件。
  - 右侧出现 Paste 区域，按钮文案为 `Paste image here (Ctrl/Cmd + V)` 及“drag & drop / click to choose”提示。
  - Preview 区域显示 info 提示：`Paste, drop, or select an image to see the original and processed previews here.`。
  - 底部 `StatusBar` 不显示（无 processing/error）。

**E2E-002 首屏加载（小屏布局）**

- 前置条件：视口 `390x844`。
- 步骤：
  - 打开首页 `/`。
- 期望结果：
  - SettingsPanel 在页面上方，Paste/Preview 区在其下方（纵向堆叠）。
  - 无 “Settings” 浮动按钮与侧滑抽屉（小屏直接展示设置面板）。
  - 文案同 E2E-001，StatusBar 不显示。

**E2E-003 系统主题同步**

- 前置条件：
  - 通过测试框架模拟 `window.matchMedia("(prefers-color-scheme: dark)")` 返回 `matches = true`。
- 步骤：
  - 加载应用。
- 期望结果：
  - `document.documentElement` 的 `data-theme` 属性为 `dim`。
  - 切换模拟为 `matches = false` 后触发 `change` 事件，`data-theme` 更新为 `winter`。

---

### 3.2 图像输入：粘贴 / 拖拽 / 文件选择

**E2E-010 从剪贴板粘贴 PNG（主路径）**

- 前置条件：
  - 视口桌面尺寸，剪贴板含一张 PNG 图 `screenshot-png.png`。
- 步骤：
  - 打开首页，确保窗口聚焦。
  - 触发 `Ctrl/Cmd + V`（不特别聚焦任何输入元素）。
- 期望结果：
  - StatusBar 显示 `Processing image…` 后消失。
  - PreviewPanel 显示两张卡片：
    - 左：`Source image`，Dimensions 与原始图片一致，Format 为 `image/png`。
    - 右：`Result image`，Dimensions 符合默认 preset 逻辑（medium，长边约 1280 或保持原尺寸），Format 按 `outputFormat=auto` 决定。
  - PasteArea 文案变为 `Paste, drop, or click to replace the image`，说明 `hasImage = true`。

**E2E-011 在 PasteArea 上粘贴非图片内容**

- 前置条件：剪贴板中为文本，例如 `"hello"`。
- 步骤：
  - 打开页面。
  - 聚焦 PasteArea 按钮（Tab 或直接点击）。
  - 在其上触发 `Ctrl/Cmd + V`。
- 期望结果：
  - 不进入 processing 状态。
  - StatusBar 显示错误：`No image data found in the clipboard. Please copy an image and try again.`。
  - PreviewPanel 仍显示初始 info 提示，无图片卡片。

**E2E-012 拖拽 PNG 图片到 PasteArea**

- 前置条件：本地有 `screenshot-png.png`。
- 步骤：
  - 打开页面。
  - 将 PNG 文件拖拽到 PasteArea 按钮区域并释放。
- 期望结果：
  - StatusBar 显示 `Processing image…`，处理完成后隐藏。
  - Source/Result 卡片正常显示，与 E2E-010 类似。
  - 未出现错误提示。

**E2E-013 拖拽非图片文件到 PasteArea**

- 前置条件：`non-image.txt` 文件存在。
- 步骤：
  - 将 `non-image.txt` 拖拽到 PasteArea。
- 期望结果：
  - 不进入 processing。
  - StatusBar 显示错误：`Please paste or drop an image file.`。
  - PreviewPanel 不显示任何图片卡片。

**E2E-014 通过文件选择对话框选择图片**

- 步骤：
  - 打开页面。
  - 点击 PasteArea 按钮（触发隐藏的 `<input type="file">`）。
  - 在文件选择对话框中选择 `screenshot-png.png`。
- 期望结果：
  - 行为与 E2E-012 一致：正常处理并显示 Source/Result。

**E2E-015 选择新图片替换已有图片**

- 前置条件：
  - 已执行 E2E-010，当前已经有一张图片显示。
- 步骤：
  - 再次点击 PasteArea 按钮，通过文件选择选择另一张图片 `photo-large-jpeg.jpg`。
- 期望结果：
  - Source/Result 卡片更新为新图片的信息。
  - 不再显示旧图片任何缩略图或尺寸信息。

---

### 3.3 Preset 与尺寸计算

**E2E-020 默认 medium 预设生效**

- 前置条件：
  - 使用高分辨率 JPEG `photo-large-jpeg.jpg`（长边 > 2000px）。
- 步骤：
  - 打开页面，不改动任何设置（默认 presetId 为 `medium`）。
  - 通过文件选择载入该 JPEG。
- 期望结果：
  - Source Dimensions 与原图一致。
  - Result Dimensions 满足：
    - 长边约为 `1280`（`maxLongSide`）且短边按比例。
  - Result 卡片徽章中，如果 Source/Result 尺寸不同，显示 `Resized to {w} × {h}` 而不是 `Original size`。

**E2E-021 Original 预设保留原始尺寸**

- 前置条件：同 E2E-020。
- 步骤：
  - 在 SettingsPanel 点击 `Original` 预设。
  - 载入 `photo-large-jpeg.jpg`。
- 期望结果：
  - Result Dimensions 等于 Source Dimensions。
  - Result 徽章显示 `Original size`。
  - 输出 MIME 类型为 `image/jpeg`（源为 JPEG 且 `outputFormat=auto`）。

**E2E-022 切换预设重新处理已有图片**

- 前置条件：
  - 已按 E2E-021 加载 `photo-large-jpeg.jpg`（当前为 Original）。
- 步骤：
  - 点击 `Small` 预设。
- 期望结果：
  - 立即进入 processing 状态。
  - Result Dimensions 更新为 `maxLongSide=800` 左右。
  - Source 卡片保持不变。

---

### 3.4 分辨率输入与长宽比锁定

**E2E-030 有图情况下锁定宽高比**

- 前置条件：
  - 已加载一张图片（任意），记下 Result/Source 宽高比。
  - `Lock aspect ratio` 复选框勾选。
- 步骤：
  - 在 `Width (px)` 输入框输入一个新值，例如 `1000`。
- 期望结果：
  - `Height (px)` 自动更新为基于当前 image aspect ratio 的四舍五入值。
  - 再次处理图片后，Result Dimensions 与填写宽高完全一致。

**E2E-031 解除锁定后宽高独立**

- 前置条件：已有图片，`Lock aspect ratio` 初始为勾选。
- 步骤：
  - 取消勾选 `Lock aspect ratio`。
  - 将 Width 改为 `1000`，Height 改为 `300`。
- 期望结果：
  - Height 不被自动改写。
  - 再次处理后，Result Dimensions 为 `1000 × 300`。

**E2E-032 无图时宽高行为（无锁定联动）**

- 前置条件：刷新页面，未加载任何图片。
- 步骤：
  - 确保 `Lock aspect ratio` 勾选。
  - 在 Width 输入框输入 `1000`。
- 期望结果：
  - Height 保持为空（未自动计算），说明无当前 image aspect ratio 时只是独立输入。

---

### 3.5 Resize mode 行为（维度层面验证）

> 通过 Result 卡片显示的 `Dimensions` 验证尺寸；不做像素级裁剪检查。

**E2E-040 Fit 模式（默认）**

- 前置条件：
  - 加载一张非方形图片。
  - 设置 Width=800，Height=600，`Resize mode` 选择 `Fit`（默认）。
- 步骤：
  - 触发重新处理（例如点击不同 preset 再改回、或者重新 paste 同一图片）。
- 期望结果：
  - Result Dimensions 至少满足：宽高不超过 800x600，且保持原始宽高比。

**E2E-041 Fill (crop) 模式**

- 前置条件：同 E2E-040。
- 步骤：
  - `Resize mode` 选择 `Fill (crop)`。
  - 再次处理当前图。
- 期望结果：
  - Result Dimensions 精确为 `800 × 600`。
  - `Resized to 800 × 600` 徽章出现（如果与 Source 不同）。

**E2E-042 Stretch 模式**

- 前置条件：同 E2E-040。
- 步骤：
  - `Resize mode` 选择 `Stretch`。
  - 再次处理。
- 期望结果：
  - Result Dimensions 依然精确为 `800 × 600`。
  - 由于不保留比例，图像肉眼会有拉伸变形（可人工验证）。

---

### 3.6 输出格式与质量控件显示

**E2E-050 Auto 输出格式**

- 前置条件：
  - 使用 PNG 源图 `screenshot-png.png`。
- 步骤：
  - 保持 `Format` 选择 `Auto (source)`。
  - 加载图片。
- 期望结果：
  - Result Format 为 `image/png`（与 Source 相同）。
  - Result 文件扩展名下载时为 `.png`。

**E2E-051 强制 JPEG 与质量滑块显示**

- 步骤：
  - 在 SettingsPanel 将 `Format` 选择为 `JPEG` (`image/jpeg`)。
  - 观察 Output 区域。
- 期望结果：
  - 显示 `Quality` 滑块，右侧 `label-text-alt` 显示约 `80%`（默认质量 0.8）。
  - 调整滑块后百分比文本随之更新。

**E2E-052 选择 PNG/WebP 隐藏质量滑块**

- 步骤：
  - 将 Format 改为 `PNG`，观察 Output 区域。
  - 再改为 `WebP`。
- 期望结果：
  - `image/png` 时不显示 Quality 滑块。
  - `image/webp` 时显示 Quality 滑块。

---

### 3.7 元数据与 HEIC 相关行为

**E2E-060 默认 stripMetadata=true 时结果元数据被标记为已剥离**

- 前置条件：
  - 使用带 EXIF 的 JPEG `photo-large-jpeg.jpg`。
  - 确保 `Strip metadata` 复选框勾选（默认）。
- 步骤：
  - 加载图片。
- 期望结果：
  - Source 卡片：
    - Metadata 区显示 Camera/Captured/ISO 等字段。
    - Metadata badge 显示 `Preserved`。
  - Result 卡片：
    - Metadata badge 显示 `Stripped metadata`。
    - 不显示具体 Camera/ISO 等 metadata 字段。
    - 描述文案中提到 `EXIF / IPTC / XMP data was removed when generating this image.`。

**E2E-061 stripMetadata=false 且不改变格式/尺寸时保留元数据**

- 前置条件：
  - 使用同一 `photo-large-jpeg.jpg`，分辨率适中，不会触发 preset 缩放。
- 步骤：
  - 选择 `Original` preset。
  - 将 `Strip metadata` 取消勾选。
  - `Format` 选择 `JPEG` 或 `Auto`（且保证未缩放）。
  - 加载图片。
- 期望结果：
  - Result Dimensions 与 Source 一致。
  - Result Metadata badge 显示 `Metadata preserved`。
  - Result 卡片中展示同 Source 的 metadata 字段。

**E2E-062 HEIC 图片转换与 metadata 行为**

- 前置条件：
  - HEIC 测试图 `heic-photo.heic`，环境中 `heic2any` 正常可用。
- 步骤：
  - 使用默认设置加载该 HEIC 图片。
- 期望结果：
  - Source 卡片：
    - Format 可能显示为 HEIC 类型 MIME（取决于 blob.type）。
    - Metadata badge 为 `Preserved`，显示 Camera/Captured 等。
  - Result 卡片：
    - Format 为 `image/jpeg`（Auto 对于 HEIC 输出为 JPEG）。
    - Metadata badge 显示 `Stripped metadata`（当前实现不会重建 EXIF）。
    - 不显示具体 metadata 字段。

**E2E-063 HEIC 转换库缺失时的错误提示**

- 前置条件：
  - 通过测试框架注入，模拟 `import("heic2any")` 抛错或返回 undefined。
- 步骤：
  - 加载 HEIC 图片。
- 期望结果：
  - StatusBar 显示错误提示（例如 `HEIC/HEIF conversion is not available in this environment. Please convert the image to JPEG or PNG and try again.`）。
  - PreviewPanel 无 Result 卡片显示。

---

### 3.8 复制到剪贴板

**E2E-070 正常浏览器中点击按钮复制**

- 前置条件：
  - 浏览器支持 `navigator.clipboard.write`。
  - 已有 Result 图像（例如执行 E2E-010）。
- 步骤：
  - 点击 `Copy to clipboard` 按钮。
- 期望结果：
  - 在复制期间 UI 显示 `Copying image to clipboard…` 提示文本。
  - 状态结束后提示消失，无错误消息。
  - 可通过断言 stub/spies 验证 `navigator.clipboard.write` 被调用一次。

**E2E-071 Copy 按钮上的 Ctrl/Cmd+C 快捷键**

- 前置条件：同 E2E-070。
- 步骤：
  - 将焦点放在 `Copy to clipboard` 按钮。
  - 触发 `Ctrl/Cmd + C` 键盘事件。
- 期望结果：
  - 不触发浏览器默认复制文本行为。
  - 触发与点击按钮相同的复制逻辑。

**E2E-072 全局 Ctrl/Cmd+C 快捷键复制 Result**

- 前置条件：
  - 已有 Result 图像。
  - 当前页面中没有聚焦到 `<input>`/`<textarea>`/`select`/`contentEditable` 元素。
- 步骤：
  - 触发 `Ctrl/Cmd + C`。
- 期望结果：
  - 阻止默认复制行为。
  - 触发 `onCopyResult`，表现与 E2E-070 一致。

**E2E-073 在输入框中 Ctrl/Cmd+C 不应触发图像复制**

- 前置条件：
  - 有 Result 图像。
  - 聚焦到 SettingsPanel 中任一 `<input>`（如 Width 输入）。
- 步骤：
  - 在输入框中选中部分文本，触发 `Ctrl/Cmd + C`。
- 期望结果：
  - 字符串成功复制到剪贴板（可选地通过 clipboard API 验证）。
  - 不触发图像复制逻辑（`navigator.clipboard.write` 未被调用）。

**E2E-074 剪贴板 API 不可用时的降级提示**

- 前置条件：
  - 模拟 `!("clipboard" in navigator)` 或 `!("write" in navigator.clipboard)`。
  - 有 Result 图像。
- 步骤：
  - 点击 `Copy to clipboard` 按钮。
- 期望结果：
  - StatusBar 显示错误提示：
    - 文案包含 `Clipboard image write is not supported in this browser. Please use your browser's context menu (for example, right-click → Copy image) to copy the result manually.`。
  - 不崩溃，Result 图像仍可见。

---

### 3.9 下载

**E2E-080 下载按钮存在并可点击**

- 前置条件：已有 Result 图像。
- 步骤：
  - 找到 `Download` 按钮（`aria-label="Download result image"`）。
  - 点击按钮。
- 期望结果：
  - 触发 `<a download>` 行为（可通过 href 与 download 属性断言）。
  - `download` 属性值匹配模式：`pastepreset-YYYYMMDD-HHMMSS.ext`，扩展名：
    - JPEG/Auto-JPEG 时为 `.jpg`。
    - PNG 为 `.png`。
    - WebP 为 `.webp`。

---

### 3.10 错误与状态栏

**E2E-090 超大尺寸导致处理失败**

- 前置条件：
  - 使用任意图片作为源。
- 步骤：
  - 设置 Width/Height 为一个明显超出限制的值，例如 `10000 × 10000`（超出 MAX_TARGET_SIDE=8000 和 40M 像素限制）。
  - 尝试处理图片。
- 期望结果：
  - StatusBar 显示错误：
    - 文案为 `The requested output size is too large to process safely. Please choose smaller dimensions or a lower-resolution preset and try again.`。
  - AppStatus 切换到 error，再通过后续操作可恢复为 idle。

**E2E-091 处理过程中的 processing 提示**

- 步骤：
  - 加载大图或在测试中人为延长处理时间（例如 mock `processImageBlob` 为 Promise 延迟）。
- 期望结果：
  - PreviewPanel 上方显示 alert-warning：`Processing image…`。
  - StatusBar 同样显示 `Processing image…` 信息。
  - 处理结束后这两个提示均消失。

**E2E-092 剪贴板错误消息显示优先级**

- 前置条件：
  - 模拟 `navigator.clipboard.write` 抛出自定义错误（非 “not supported on write”）。
  - 已有 Result 图像。
- 步骤：
  - 点击 `Copy to clipboard`。
- 期望结果：
  - StatusBar 显示该错误 message（`clipboardError` 优先显示）。
  - `Processing` 状态为空或 `idle`，不显示。

---

### 3.11 响应式 Settings 抽屉行为（中小屏）

**E2E-100 md 视口下 settings 抽屉自动关闭**

- 前置条件：
  - 视口宽度在 md 区间（例如 `800x900`）。
  - 初始进入页面时还没有图片。
- 步骤：
  - 加载一张图片（通过 paste 或 file input）。
- 期望结果：
  - 初始 SettingsPanel 以侧边栏（或抽屉）形式可见。
  - 加载完成后，`isSettingsOpen` 被置为 false：
    - 抽屉关闭（overlay 透明/不可点击）。
    - 只剩下顶部 `Settings` 按钮与摘要文本（Preset/Size/Format/Mode）。

**E2E-101 点击 Settings 按钮打开抽屉**

- 前置条件：视口 md，已有图片并抽屉处于关闭状态。
- 步骤：
  - 点击顶部 `Settings` 按钮。
- 期望结果：
  - 左侧遮罩与抽屉滑出，SettingsPanel 出现在视口中。
  - 点击遮罩空白处或点击关闭按钮（`aria-label="Close settings"`）抽屉关闭。

**E2E-102 lg 视口下 Settings 始终可见**

- 前置条件：
  - 刷新页面，视口宽度 `>=1024`（例如 `1280x800`）。
- 步骤：
  - 加载图片。
- 期望结果：
  - SettingsPanel 始终显示在左侧，不出现浮动 `Settings` 按钮与抽屉遮罩。
  - 窗口在 md ↔ lg 之间来回 resize 时：
    - 当进入 lg 时 `isSettingsOpen` 自动置为 true，确保 Settings 可见。

---

### 3.12 可访问性与辅助功能

**E2E-110 主要操作可通过键盘完成**

- 步骤：
  - 使用 Tab 依次聚焦到：
    - SettingsPanel 控件（Width/Height、Format、Strip metadata）。
    - PasteArea 按钮。
    - Copy/Download 按钮。
  - 使用 Enter/Space 激活。
- 期望结果：
  - 所有按钮/输入控件均可获得明显的键盘焦点样式。
  - 按 Enter/Space 可触发与鼠标点击相同的行为（例如打开文件选择、执行复制）。

**E2E-111 ARIA 属性与角色**

- 步骤：
  - 检查：
    - StatusBar 中 error/信息条 `role="alert"` 或 `role="status"` 与 `aria-live` 设置符合实现。
    - Copy/Download/Settings 抽屉相关按钮 `aria-label` 存在且语义正确。
- 期望结果：
  - 与 `StatusBar` 组件实现一致：
    - 错误消息 `role="alert"`，`aria-live="assertive"`。
    - 信息消息 `role="status"`，`aria-live="polite"`。

---

以上用例覆盖了当前代码中的主要交互路径、边界条件和浏览器能力分支。

---

## 4. 使用 Playwright 的实现方案（落地指引）

### 4.1 依赖与脚本

- 安装依赖（本地一次性执行）：
  - `npm install --save-dev @playwright/test playwright`  
  - `npx playwright install chromium`（或 `npx playwright install` 安装所有浏览器）。
- 推荐在 `package.json` 中新增脚本（待实现时再改）：
  - `"test:e2e": "playwright test"`
  - `"test:e2e:ui": "playwright test --ui"`

> 说明：运行时仍由 Bun 负责应用本身的 dev server，Playwright 仅作为 Node 端的测试工具。

### 4.2 目录结构规划

建议结构：

- `playwright.config.ts`：Playwright 主配置。
- `tests/e2e/`：端到端测试用例。
  - `tests/e2e/app-layout.spec.ts`（3.1 布局相关用例）。
  - `tests/e2e/image-input.spec.ts`（3.2 图像输入）。
  - `tests/e2e/presets-and-resize.spec.ts`（3.3–3.5）。
  - `tests/e2e/output-and-metadata.spec.ts`（3.6–3.7）。
  - `tests/e2e/clipboard.spec.ts`（3.8）。
  - `tests/e2e/download-and-errors.spec.ts`（3.9–3.10）。
  - `tests/e2e/responsive-and-a11y.spec.ts`（3.11–3.12）。
- `tests/fixtures/`：测试资源文件。
  - `tests/fixtures/photo-large-jpeg.jpg`
  - `tests/fixtures/screenshot-png.png`
  - `tests/fixtures/heic-photo.heic`
  - `tests/fixtures/very-large.png`
  - `tests/fixtures/non-image.txt`

### 4.3 Playwright 配置要点（playwright.config.ts）

关键配置示例（思路）：

- 基础设置：

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://localhost:25119",
    trace: "on-first-retry",
  },
  webServer: {
    command: "bun run dev",
    url: "http://localhost:25119",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: "chromium-tablet",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 800, height: 900 },
      },
    },
    {
      name: "chromium-mobile",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});
```

- 说明：
  - `webServer.command` 直接调用 `bun run dev`，测试时自动启动 dev server。
  - `baseURL` 固定为 `http://localhost:25119`，测试中统一用 `page.goto("/")`。
  - `projects` 三个视口分别覆盖桌面 / 平板 / 手机场景，可根据需要对部分 spec 限定项目。

### 4.4 通用测试工具与 fixture 设计

为了让各个 spec 复用逻辑，建议在 `tests/e2e/_helpers.ts`（或 `tests/e2e/fixtures.ts`）中封装：

1. **页面访问与初始化**

```ts
import path from "node:path";
import { test as base } from "@playwright/test";

export const test = base.extend<{
  testImagesDir: string;
}>({
  testImagesDir: async ({}, use) => {
    await use(path.resolve(__dirname, "../fixtures"));
  },
});

export const expect = test.expect;
```

2. **剪贴板能力注入/模拟**

- 正常剪贴板路径：默认使用浏览器原生实现，仅在测试中通过 `page.evaluate` 读取“记录变量”判断有没有调用。
- 不支持剪贴板路径（E2E-074）：

```ts
export async function disableClipboardAPI(page: Page) {
  await page.addInitScript(() => {
    try {
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        configurable: true,
      });
    } catch {
      // 某些浏览器不可重写，可在测试中降级为跳过此分支或用环境变量控制
    }
  });
}
```

- 强制错误路径（E2E-092）：

```ts
export async function makeClipboardWriteFail(page: Page) {
  await page.addInitScript(() => {
    const originalClipboard = navigator.clipboard;
    const fakeClipboard = {
      ...originalClipboard,
      write: () => Promise.reject(new Error("playwright test error")),
    };
    try {
      Object.defineProperty(navigator, "clipboard", {
        value: fakeClipboard,
        configurable: true,
      });
    } catch {
      // 同上，必要时仅在支持重写的环境下运行此测试
    }
  });
}
```

3. **上传测试图片的辅助函数**

```ts
export async function uploadImageFromFixture(
  page: Page,
  testImagesDir: string,
  fileName: string,
) {
  const filePath = path.join(testImagesDir, fileName);

  // 点击 PasteArea 按钮，触发隐藏的 input[type=file]
  const pasteButton = page.getByRole("button", {
    name: /Paste image here/i,
  });
  await pasteButton.click();

  const fileInput = page.getByLabel(/select an image/i).locator("input[type=file]").first();
  await fileInput.setInputFiles(filePath);
}
```

> 实际实现中可以改为直接通过 `page.locator('input[type="file"]')` 绑定，而不是依赖 label 文案。

4. **等待处理结束的通用断言**

```ts
export async function waitForProcessingToFinish(page: Page) {
  // 等待 processing 提示出现又消失
  const alert = page.getByText("Processing image…").first();
  await alert.waitFor({ state: "visible" });
  await alert.waitFor({ state: "hidden" });
}
```

### 4.5 E2E 用例到 spec 的映射示例

以部分用例为例说明如何在 Playwright 中落地：

1. **布局相关（E2E-001 / E2E-002 / E2E-003）**

- 文件：`tests/e2e/app-layout.spec.ts`
- 思路：
  - 使用 `test.describe("layout", ...)`，内部通过不同 `test.use({ viewport: ... })` 或限制项目运行。
  - 断言页面中的标题、描述文案、StatusBar 是否存在。
  - 对 E2E-003 使用 `page.addInitScript` 注入伪 `matchMedia`，通过 `evaluate` 查询 `data-theme`。

2. **图像输入（E2E-010–E2E-015）**

- 文件：`tests/e2e/image-input.spec.ts`
- 关键点：
  - 文件上传走 `setInputFiles`（见 4.4）。
  - 粘贴行为可用 `page.keyboard.press("Control+V")` 配合 `page.setClipboard` 或模拟 clipboard 事件：

```ts
await page.evaluate(() => {
  const data = new DataTransfer();
  // 这里可以在后续通过 page.route 拦截 request 或简化为“拖拽”路径，粘贴路径可更偏向手工回归
});
```

  - 拖拽用 `page.dragAndDrop` 或构造 `dragenter/drop` 事件（Playwright 内置 dragAndDrop 基于 HTML5 DnD）。

3. **剪贴板用例（E2E-070–E2E-074、E2E-092）**

- 文件：`tests/e2e/clipboard.spec.ts`
- 正常路径：
  - 利用 `page.addInitScript` 在 window 中挂一个全局数组，例如 `window.__clipboardWrites = []`。
  - 在 `useClipboard` 路径上调用 `navigator.clipboard.write` 前后往该数组 push 信息（如 blob type/size）——此处可能需要轻微修改应用代码以注入 hook，或者通过 `page.route("**/*")` 拦截 `clipboard` 请求也可以实现类似监控。
- 不支持/错误路径：
  - 使用 4.4 中的 `disableClipboardAPI` / `makeClipboardWriteFail`。
  - 断言 StatusBar 中文案是否与用例要求一致。

4. **HEIC 相关（E2E-062 / E2E-063）**

- HEIC 成功路径：
  - 依赖实际 `heic2any` 能在目标浏览器环境中运行，并且 fixtures 中的 HEIC 文件可被转换。
  - 测试中走和普通图片一样的上传流程，断言 Result Format 为 `image/jpeg`，metadata 徽章为 `Stripped metadata`。
- HEIC 失败路径：
  - 当前实现中 `normalizeImageBlobForCanvas` 直接在内部调用 `import("heic2any")`，不易在浏览器端 mock。
  - 建议后续将 HEIC loader 封装为可注入依赖（例如通过 `window.__heic2anyLoader` 或简单工厂函数），再在测试中替换。
  - 在完成重构前，此用例可以保留为“手工回归”项，或通过额外的 unit 测试在 Node 环境中模拟。

### 4.6 CI 集成建议

- 在 CI 中增加步骤：
  1. 安装依赖：`npm install`（或 `bun install` + `npm install @playwright/test playwright --save-dev`）。
  2. 安装浏览器：`npx playwright install --with-deps chromium`。
  3. 运行端到端测试：`npm run test:e2e`。
- 针对对平台支持有限的场景（例如 HEIC），可以：
  - 通过环境变量（如 `E2E_HEIC=0`）在 CI 上暂时跳过相关 spec。
  - 本机或特定 pipeline 中开启这些测试，避免影响主线稳定性。

---

实施 Playwright 时，可以按照本节指引先完成基础 skeleton（配置 + 目录 + 通用 helpers），再逐步将第 3 章中的用例映射为具体的 `test(...)` 实现。这样可以边写边验证，降低一次性落地全部用例的复杂度。

