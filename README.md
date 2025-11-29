# PastePreset

PastePreset 是一个在浏览器端运行的单页应用，用来快速对截图和手机照片做**裁剪 / 缩放 / 转码 / 去元数据**，并支持复制到剪贴板或下载到本地，全流程不经过服务器。

核心特性（按设计文档实现）：

- React + TypeScript + Vite 单页应用（SPA）
- Tailwind CSS v4 + DaisyUI 负责 UI 组件和主题
- 完全前端处理图片（包含 HEIC/HEIF 转换、缩放、裁剪、格式转换、质量控制、去元数据等）

## 技术栈与工具

- 构建与运行：Vite（开发端口 `25119`）
- UI：React + TypeScript + Tailwind CSS v4 + DaisyUI
- 开发运行时 & 包管理：**使用 Bun（>= 1.0）作为开发环境，替代 Node.js/npm 作为默认选择**
- 代码质量：**使用 Biome 替代 ESLint + Prettier**
  - `@biomejs/biome` 负责：
    - 代码格式化（format）
    - 代码风格和质量检查（lint）
    - 统一的 `check` 流程
  - 不再使用 ESLint / Prettier / eslint.config.js

## 本地开发

```bash
bun install
bun run dev
```

默认开发地址为：`http://localhost:25119/`。

## 脚本（通过 Bun 运行）

- `bun run dev`：启动 Vite 开发服务器。
- `bun run build`：TypeScript 编译并产出生产构建（`dist/`）。
- `bun run preview`：本地预览生产构建。
- `bun run lint`：运行 `biome lint .`，只做静态检查，不改动文件。
- `bun run format`：运行 `biome format --write .`，自动格式化代码。
- `bun run check`：运行 `biome check .`，综合执行格式、导入排序和 lint 检查。

## 部署

部署到 GitHub Pages 的流程见 `docs/deploy-github-pages.md`。
