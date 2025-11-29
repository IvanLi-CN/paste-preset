# Repository Guidelines

## Project Structure & Modules

- `src/` – React + TypeScript SPA (entry: `src/main.tsx`, root component: `src/App.tsx`).
- `src/assets/` – Static assets (logos, future icons).
- `docs/` – Product and deployment docs (`design.md`, `deploy-github-pages.md`).
- `dist/` – Build output (git-ignored).

## Build, Check & Development

Runtime and package manager: **Bun (>= 1.0)**.

- `bun run dev` – Start Vite dev server on port `25119`.
- `bun run build` – Type-check (`tsc -b`) and build for production into `dist/`.
- `bun run preview` – Preview the production build locally.
- `bun run lint` – Run Biome lint only.
- `bun run format` – Apply Biome formatting in-place.
- `bun run check` – Full Biome check (formatting, imports, lint).

## Coding Style & Naming

- Language: TypeScript (strict) + React function components.
- Formatter / linter: **Biome** (`biome.json`), 2-space indent, double quotes in TS/JS.
- Tailwind CSS v4 + DaisyUI for styling; prefer utility classes over custom CSS.
- Components: `PascalCase` filenames (`SettingsPanel.tsx`), hooks in `camelCase` (`useImageProcessor`).
- DaisyUI LLM reference (from the official ChatGPT guide):  
  `https://daisyui.com/llms.txt give me a light daisyUI 5 theme with tropical color palette`

## Testing Guidelines

No test framework is wired up yet. When adding tests:

- Co-locate tests as `*.test.ts` / `*.test.tsx` next to the source file.
- Ensure tests can be run via a single Bun script (e.g. `bun run test`) before opening a PR.

## Commit & Pull Request Guidelines

- Use **Conventional Commits**, e.g. `feat: add paste area layout`, `chore: update tooling`.
- Sign off commits (`--signoff`) as required by the deployment docs.
- PRs should include:
  - A clear summary of changes and motivation.
  - References to issues or design sections when relevant.
  - Before/after screenshots or GIFs for visible UI changes.
  - Confirmation that `bun run check` and `bun run build` pass locally.  
