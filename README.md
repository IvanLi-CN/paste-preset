<p align="center">
  <img src="public/paste-preset-icon.svg" alt="PastePreset icon" width="96" />
</p>

# PastePreset

[![Release](https://img.shields.io/github/v/release/IvanLi-CN/paste-preset?logo=github)](https://github.com/IvanLi-CN/paste-preset/releases)
[![CI Pipeline](https://github.com/IvanLi-CN/paste-preset/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/IvanLi-CN/paste-preset/actions/workflows/ci.yml)
[![Bun](https://img.shields.io/badge/Bun-1.x-000000?logo=bun&logoColor=white)](https://bun.sh/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF?logo=vite&logoColor=white)](vite.config.ts)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![DaisyUI](https://img.shields.io/badge/DaisyUI-5.x-ec4899)](https://daisyui.com/)

PastePreset is a browser-based single-page application for quickly processing screenshots and mobile photos. It lets you crop, resize, transcode, and strip metadata entirely in the browser, then either copy the result to the clipboard or download it locally. No image data ever leaves your machine.

![PastePreset main UI](docs/assets/app-screenshot.png)

## Features

- 100% client-side image processing (no backend server)
- Crop and resize images
- Format conversion (including HEIC/HEIF to more common formats)
- Control over output quality and size
- Metadata stripping (EXIF, GPS, etc.)
- Copy processed image to clipboard
- Download processed image as a file

## Tech Stack

- React + TypeScript + Vite SPA (dev server on port `25119`)
- Tailwind CSS v4 + DaisyUI for UI components and theming
- Bun (>= 1.0) as runtime and package manager
- Biome for formatting, linting, and unified `check` workflow  
  (replaces ESLint + Prettier)

## Prerequisites

- Bun >= 1.0 installed on your machine

## Development

```bash
bun install
bun run dev
```

The dev server runs at `http://localhost:25119/` by default.

## Scripts (via Bun)

- `bun run dev` – Start the Vite development server.
- `bun run build` – Type-check and build for production into `dist/`.
- `bun run preview` – Preview the production build locally.
- `bun run lint` – Run `biome lint .` for static analysis only (no file changes).
- `bun run format` – Run `biome format --write .` to format code in place.
- `bun run check` – Run `biome check .` for combined formatting, import sorting, and lint checks.

## Release

This repo uses a PR-label-driven release flow. Every PR targeting `main` must carry:

- Exactly one `type:*` label:
  - `type:patch` – Release and bump patch.
  - `type:minor` – Release and bump minor.
  - `type:major` – Release and bump major.
  - `type:docs` – No release.
  - `type:skip` – No release.
- Exactly one `channel:*` label:
  - `channel:stable` – Stable release.
  - `channel:rc` – Prerelease (RC).

On a successful merge to `main`, CI will create a tag + GitHub Release when `type:patch|minor|major` is set:

- Stable: `vX.Y.Z`
- RC: `vX.Y.Z-rc.{sha7}` (marked as a GitHub prerelease)

## Deployment

See `docs/deploy-github-pages.md` for instructions on deploying to GitHub Pages.

## License

This project is distributed under the MIT License. See `LICENSE` for details.
