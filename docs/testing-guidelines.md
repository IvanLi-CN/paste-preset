# Testing Guidelines

This document describes the target testing strategy for PastePreset.  
All new work (features, refactors, bug fixes) should align with these guidelines.

The test stack is intentionally layered:

1. **Static checks** – Biome (formatting, linting, imports).
2. **Unit / small integration tests** – Vitest (logic and small React components).
3. **Component interaction tests** – Storybook 10 + `@storybook/test-runner` (component‑level UI and interactions).
4. **End‑to‑end (E2E) tests** – Playwright (real browser, user flows).

Each change should be covered at the lowest reasonable layer that can reliably verify it, with higher layers reserved for behaviour that cannot be tested effectively below.

---

## 1. Goals and Overall Strategy

- Protect the core user journeys:
  - Image input → configuration → processing → copy/download → status & error feedback.
- Cover representative browsers and viewports (desktop / tablet / mobile).
- Avoid duplicated coverage across layers:
  - Prefer unit tests for pure logic.
  - Prefer Storybook interaction tests for component‑level behaviour.
  - Use E2E tests sparingly for end‑to‑end flows and cross‑component interactions.
- Keep the setup friendly to both humans and agents:
  - Clear structure and naming.
  - Stable, machine‑discoverable patterns for tests and stories.

---

## 2. Tools and Scripts

### 2.1 Static checks – Biome

- **Tool:** `@biomejs/biome`
- **Purpose:** Formatting, linting, and basic semantic checks (replaces ESLint + Prettier).
- **Scripts:**
  - `bun run lint` – `biome lint .`
  - `bun run format` – `biome format --write .`
  - `bun run check` – `biome check .`
- **Git hooks (lefthook):**
  - `pre-commit` – runs `bun run check`.

Static checks must pass before any change is considered ready for review or merge.

---

### 2.2 Unit / Small Integration Tests – Vitest

- **Tool:** Vitest (`environment: "jsdom"`, configured in `vitest.config.ts`).
- **Purpose:**
  - Pure functions and utilities (e.g. size calculations, preset parsing).
  - React hooks and small components whose behaviour can be validated in JSDOM.
  - Logic that does not require a real browser engine, network stack, or full app shell.
- **Scripts:**
  - `bun run test` – runs all Vitest tests.
- **File conventions:**
  - Location: `src/**/*.test.ts`, `src/**/*.test.tsx`
  - Naming: place tests next to the implementation, with the `.test.ts(x)` suffix:
    - `src/foo/bar.ts` → `src/foo/bar.test.ts`
    - `src/components/Foo.tsx` → `src/components/Foo.test.tsx`

**Guidelines**

- Prefer unit tests whenever behaviour can be expressed as:
  - “Given input X, function/hook/component state produces output Y”.
- Keep each test focused:
  - One behaviour per test case; avoid “mega tests” with many unrelated assertions.
- Avoid testing implementation details:
  - Assert observable outputs, state, or DOM, not internal private variables.

---

### 2.3 Component Interaction Tests – Storybook + test‑runner

- **Tools:**
  - Storybook 10 with `@storybook/react-vite`.
  - `@storybook/addon-interactions` for interaction testing support.
  - `@storybook/test-runner` to execute interactions in CI using a real browser.
  - `@storybook/testing-library` and `@storybook/jest` for `play` functions.
- **Purpose:**
  - Verify UI behaviour and interactions at the **component** or small composite level.
  - Reuse stories for both:
    - Documentation (Docs/Canvas views).
    - Automated interaction tests (play + test‑runner).
  - Provide a visual way to inspect agent‑generated test steps via the Interactions panel.
- **Scripts:**
  - `bun run storybook` – start the Storybook dev server.
  - `bun run build-storybook` – build a static Storybook site.
  - `bun run test-storybook` – run all interaction tests using `@storybook/test-runner`.

**Story files**

- Location: next to the component they document:
  - `src/components/Foo.tsx` → `src/components/Foo.stories.tsx`
- Structure (CSF 3, TypeScript):

```ts
const meta = {
  title: "Components/Foo",
  component: Foo,
  tags: ["autodocs"],
} satisfies Meta<typeof Foo>;

export default meta;
```

- Each component state should be represented as a named story.
- Stories that describe important interactions should define a `play` function.

**Interaction tests (play functions)**

- Use Testing Library helpers (`within`, `userEvent`, `waitFor`) and `expect`:

```ts
export const WithError = {
  args: { /* ... */ },
  async play({ canvasElement, step }) {
    const canvas = within(canvasElement);

    await step("Click submit button", async () => {
      await userEvent.click(
        canvas.getByRole("button", { name: /submit/i }),
      );
    });

    await step("See error message", async () => {
      await waitFor(() =>
        expect(
          canvas.getByText("Something went wrong"),
        ).toBeInTheDocument(),
      );
    });
  },
};
```

- Use the `step` helper to annotate major actions and checks:
  - This makes the Interactions panel readable and easier to review.
- Focus on component‑level concerns:
  - e.g. button disabled state, validation messages, local state transitions.

**Layer boundaries**

- **Vitest** covers pure logic and isolated hooks/components.
- **Storybook + test‑runner** covers interactive component behaviour and UI state.
- **Playwright** covers full user flows across multiple components/routes.

---

### 2.4 End‑to‑End Tests – Playwright

- **Tool:** `@playwright/test`, configured in `playwright.config.ts`.
- **Purpose:**
  - Validate complete user journeys in a real Chromium browser.
  - Verify layout, responsiveness, clipboard behaviour, downloads, HEIC handling, and error states.
  - Ensure the application works as expected when served via the dev server.
- **Scripts:**
  - `bun run test:e2e` – run all E2E tests.
  - `bun run test:e2e:ui` – open the Playwright test runner UI for debugging.
- **Configuration:**
  - `testDir: "./tests/e2e"`
  - `webServer`:
    - `command: "bun run dev"`
    - `url: "http://localhost:25119"`
    - `reuseExistingServer` when not in CI
  - Projects for multiple viewports:
    - `desktop` (e.g. 1280×800)
    - `tablet` (e.g. 800×900)
    - `mobile` (e.g. 390×844)
- **Data:**
  - Test fixtures (images, HEIC files, non‑image files) in `tests/fixtures`.
  - E2E test cases documented in `docs/e2e-test-plan.md`.

**Guidelines**

- Use E2E tests for:
  - End‑to‑end flows across multiple components.
  - Behaviour that depends on the real browser environment (clipboard, drag‑and‑drop, downloads, HEIC decoding).
  - Responsive layout and accessibility behaviours.
- Prefer helpers in `tests/e2e/_helpers.ts` (or similar) for:
  - File uploads from fixtures.
  - Clipboard API stubbing and error simulation.
  - Waiting for processing states to appear and disappear.
- Keep E2E tests scenario‑oriented:
  - “Paste image and copy result to clipboard” rather than “verify single button label”.

---

## 3. Layer‑Specific Guidelines

### 3.1 Static Checks (Biome)

- All JavaScript/TypeScript/TSX and configuration files should pass `bun run check`.
- Before committing:
  - Run `bun run format` to normalise formatting.
  - Run `bun run check` to catch lint and style issues.
- Agents should not introduce alternative linters or formatters.

---

### 3.2 Unit / Small Integration Tests (Vitest)

**When to use Vitest**

- Behaviour is primarily data‑ or state‑driven and does not require a real browser:
  - Size limits and preset computations.
  - Hooks that manage state machines or simple side‑effects.
  - Components where JSDOM rendering is sufficient to assert behaviour.

**Patterns**

- Co‑locate tests with the code they exercise.
- Use descriptive test names:
  - `it("clamps output width when target exceeds maximum")`, not `it("works")`.
- Avoid unstable DOM selectors:
  - Prefer roles and text where possible if testing components.

---

### 3.3 Component Interaction Tests (Storybook)

**When to use Storybook interaction tests**

- The focus is on:
  - Component‑local interactivity (click, input, focus, validation).
  - Visual states that are meaningful per component.
  - UI that needs to be documented and manually inspectable by designers or reviewers.

**Patterns**

- Create stories for important states:
  - Default, loading, error, disabled, edge cases.
- For each state where behaviour matters, add a `play` function:
  - Simulate user actions and assert on DOM changes within the story’s canvas.
- Use Stories as the single source of truth for examples in docs and tests where possible:
  - The same story should power Docs, Canvas, and interaction testing.

---

### 3.4 End‑to‑End Tests (Playwright)

**When to use Playwright**

- The scenario spans multiple components or screens:
  - “Paste screenshot, adjust preset, copy to clipboard, and download”.
- Behaviour depends on a real browser engine:
  - Clipboard integration, drag‑and‑drop, keyboard shortcuts.
  - Viewport‑dependent layout and responsive behaviour.
  - HEIC decoding and other image format quirks.

**Patterns**

- Express tests in terms of user intent and observable outcomes:
  - `await page.getByRole("button", { name: /Copy to clipboard/i }).click();`
  - Assert on both UI feedback and side‑effects (where feasible).
- Be deliberate with what is covered at this layer:
  - Avoid duplicating tests that are already robust at the unit/component level.
- Use tagging or file naming to group tests by feature when the suite grows.

---

## 4. Choosing the Right Layer

When adding or changing behaviour, choose the **lowest** layer that can test it effectively:

1. **Unit / small integration (Vitest)**  
   Use this when:
   - The logic can be expressed as pure functions or small components/hooks.
   - You can define clear inputs and expected outputs without a real browser.

2. **Component interaction (Storybook)**  
   Use this when:
   - You need to validate interactions and visual feedback within a single component or a small composition.
   - You want the same example to serve as both documentation and test.

3. **End‑to‑end (Playwright)**  
   Use this when:
   - You need to validate a whole user journey across multiple components.
   - You depend on real browser capabilities or layout behaviour.

**Coverage expectations**

- New logic with non‑trivial behaviour:
  - At least one Vitest test.
- Complex or critical component interactions:
  - At least one Storybook story with a `play` interaction test.
- Changes that affect a core user flow (clipboard, download, processing pipeline):
  - At least one E2E test covering the main scenario.

---

## 5. CI and Git Integration

To keep the main branch healthy and provide fast feedback, the following checks should be wired into Git hooks and CI:

- **pre-commit (lefthook)**
  - `bun run check`

- **pre-push (lefthook)**
  - `bun run build`
  - `bun run test:e2e`

- **CI pipeline (recommended order)**
  1. `bun run check`
  2. `bun run test` (Vitest)
  3. `bun run test-storybook` (Storybook interaction tests)
  4. `bun run test:e2e` (Playwright)

Pull requests should be considered ready only when all of the above pass, and when new or changed behaviour is covered at one or more appropriate layers in this stack.

