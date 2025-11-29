PastePreset – GitHub Pages Deployment Guide
===========================================

This document describes how to deploy the PastePreset Vite + React + TypeScript app to GitHub Pages.

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

2. Configure Vite base path
---------------------------

For GitHub Pages, the app usually lives under a path like:

```
https://<your-username>.github.io/paste-preset/
```

Vite needs to know this base path at build time.

1. In `vite.config.ts`, set the `base` option to the repository name:

   ```ts
   import { defineConfig } from "vite";
   import react from "@vitejs/plugin-react-swc";

   export default defineConfig({
     base: "/paste-preset/",
     server: {
       port: 25119,
     },
     plugins: [react()],
   });
   ```

2. Commit the config change:

   ```bash
   git add vite.config.ts
   git commit -m "chore: configure vite base for GitHub Pages" --signoff
   git push
   ```

3. Build the app
----------------

Install dependencies and create a production build:

```bash
bun install
bun run build
```

The compiled static files will be in the `dist/` directory.

4. Option A: Deploy using GitHub Actions (recommended)
------------------------------------------------------

This approach automatically builds and deploys on every push to the main branch.

1. Ensure your repository is on GitHub with the latest changes.
2. Create the workflow file `.github/workflows/deploy.yml` with a configuration similar to:

   ```yaml
   name: Deploy to GitHub Pages

   on:
     push:
       branches:
         - main

   permissions:
     contents: read
     pages: write
     id-token: write

   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: oven-sh/setup-bun@v2
           with:
             bun-version: "1.3.3"
         - run: bun install
         - run: bun run build
         - uses: actions/upload-pages-artifact@v3
           with:
             path: ./dist

     deploy:
       needs: build
       runs-on: ubuntu-latest
       environment:
         name: github-pages
         url: ${{ steps.deployment.outputs.page_url }}
       steps:
         - id: deployment
           uses: actions/deploy-pages@v4
   ```

3. Commit and push the workflow:

   ```bash
   git add .github/workflows/deploy.yml
   git commit -m "chore: add GitHub Pages deployment workflow" --signoff
   git push
   ```

4. In the GitHub repository settings:
   - Go to **Settings → Pages**.
   - Set **Source** to “GitHub Actions”.

GitHub will then build and deploy your app each time you push to `main`. The deployed URL will be shown in the Pages settings and in the workflow logs.

5. Option B: Manual deploy to `gh-pages` branch
----------------------------------------------

If you prefer not to use GitHub Actions, you can push the `dist/` directory to a `gh-pages` branch.

1. Build the app:

   ```bash
   bun run build
   ```

2. Use `git subtree` to push the `dist/` directory:

   ```bash
   git subtree push --prefix dist origin gh-pages
   ```

   Alternatively, create and manage the `gh-pages` branch manually (for example by using the `gh-pages` npm package).

3. In the GitHub repository settings:
   - Go to **Settings → Pages**.
   - Set **Source** to the `gh-pages` branch and the root directory.

GitHub will serve the static files from the `gh-pages` branch at:

```
https://<your-username>.github.io/paste-preset/
```

6. Verify the deployment
------------------------

After the first deployment completes:

1. Open the GitHub Pages URL in your browser.
2. Confirm:
   - The app loads without 404 errors (if you see 404s on assets, re-check the `base` setting in `vite.config.ts`).
   - The dev-only features (like using port 25119) are not required in production; the app should work from the GitHub Pages path.
3. Test:
   - Pasting or dropping an image.
   - Seeing the processed result.
   - Downloading the image.
   - (After implementation) copying the result image to the clipboard if your browser supports it.

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
