<p align="center">
  <img src="public/paste-preset-icon.svg" alt="PastePreset icon" width="96" />
</p>

# PastePreset

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

## Deployment

See `docs/deploy-github-pages.md` for instructions on deploying to GitHub Pages.

## License

This project is distributed under the MIT License. See `LICENSE` for details.
