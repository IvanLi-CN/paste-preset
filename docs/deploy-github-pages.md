PastePreset – Root-Path Deployment Guide
=======================================

This document describes how PastePreset is deployed from GitHub Actions to a
root-path host. The current production contract is:

- production URL: `https://paste-preset.ivanli.cc/`
- Vite `base`: `/`
- PWA `start_url` / `scope`: `/`

The app must not be deployed as a project subpath such as `/paste-preset/`,
because that breaks the current service worker, manifest, and offline shell
contract.

Assumptions
-----------

- You have already initialized the project in the `paste-preset` directory.
- You have a GitHub account.
- Bun (>= 1.0) is installed locally as the JavaScript runtime and package manager used for development.

1. Create the GitHub repository
-------------------------------

1. On GitHub, create a new repository named `paste-preset`.
   - Owner should match your GitHub user or organization.
   - Repository can be public or private (GitHub Pages works for both in most cases, but public is simpler).
2. On your local machine, inside `paste-preset/`, add the remote:

   ```bash
   git remote add origin git@github.com:<your-username>/paste-preset.git
   ```

3. Commit your initial files and push:

   ```bash
   git add .
   git commit -m "chore: initial project skeleton" --signoff
   git push -u origin main
   ```

   Adjust the branch name if you prefer `master`.

2. Keep the app on the root path
--------------------------------

`vite.config.ts` must keep:

```ts
export default defineConfig({
  base: "/",
  // ...
});
```

Do not change the build to `/paste-preset/` or any other project subpath unless
the entire PWA contract is intentionally redesigned.

3. Build the app
----------------

Install dependencies and create a production build:

```bash
bun install
bun run build
```

The compiled static files will be in the `dist/` directory.

4. Deploy using GitHub Actions
------------------------------

The repository already contains `.github/workflows/deploy.yml`. It builds the
production bundle and publishes `dist/` to GitHub Pages on every push to
`main`.

1. Ensure the repository has the latest `main` branch changes.
2. In the GitHub repository settings:
   - Go to **Settings → Pages**.
   - Set **Source** to “GitHub Actions”.
3. Point the Pages site at a root-path host:
   - recommended: custom domain `paste-preset.ivanli.cc`
   - acceptable alternative: a user or organization Pages root site

Manual `gh-pages` branch deployment is not the maintained path for this repo.

6. Verify the deployment
------------------------

After the first deployment completes:

1. Open the production URL in your browser.
2. Confirm:
   - The app loads without 404 errors.
   - The service worker is registered at `/sw.js`.
   - `manifest.webmanifest` resolves from `/manifest.webmanifest`.
   - The dev-only features (like using port 25119) are not required in production; the app should work from the GitHub Pages path.
3. Test:
   - Pasting or dropping an image.
   - Seeing the processed result.
   - Downloading the image.
   - Copying the result image to the clipboard if your browser supports it.
   - Reloading or revisiting while offline after one successful online visit.

7. Local preview on the production build
----------------------------------------

To approximate how the app will behave on GitHub Pages:

1. Build the app:

   ```bash
   bun run build
   ```

2. Preview the production build:

   ```bash
   bun run preview -- --port 25119
   ```

3. Open `http://localhost:25119/paste-preset/` (or the root URL printed by Vite, adjusted for the `base` path) to test the built version locally.
3. Open `http://localhost:25119/` to test the root-path production build
   locally.
