# Preset Lifecycle, Local Storage, and Editing Modes

This document extends `docs/presets.md` and specifies **how presets are
persisted locally, how the four system presets are initialised for each
user, and how the UI-level preset states (`locked`, `editing`, `unsaved`)
behave.**

It is normative for behaviour; implementation details should follow this
specification.

---

## 1. Goals and Scope

- Turn the existing four system presets (`Original`, `Large`, `Medium`,
  `Small`) into **per-user presets**, stored in the browser.
- Define a **single source of truth** for the preset list:
  - On first successful load, initialise user presets from the four system
    presets.
  - On subsequent loads, the UI must use **only the user-local preset list**.
- Introduce three UI states for presets:
  - `locked`（锁定）
  - `editing`（编辑）
  - `unsaved`（未保存；单独的临时槽位）
- Ensure there is **at most one unsaved preset** at any time, and that when
  editing is in progress, the user **cannot switch to another preset**
  without saving or cancelling.
- Provide a fallback behaviour when local preset initialisation fails.

`docs/presets.md` continues to define the semantic meaning of a preset as a
patch on top of the default configuration. This document focuses on:

- how presets are stored as a *list*,
- how the user manipulates this list via the UI, and
- how the app behaves when persistence is not available.

---

## 2. Data Model

### 2.1 System preset definitions

The existing `PRESETS` constant in `src/lib/presets.ts` remains the canonical
definition of **system presets**:

- `id ∈ {"original","large","medium","small"}`
- patch semantics are as described in `docs/presets.md`.

These definitions are treated as **templates** used for first-time
initialisation of the user-local preset list.

### 2.2 User preset records (persistent)

The user-local preset list is stored as an array of records, conceptually:

```ts
interface UserPresetRecord {
  id: string; // stable identifier; system presets reuse "original"/"large"/...
  name: string; // display name; translated for system presets, arbitrary for user presets
  kind: "system" | "user";
  /**
   * Configuration patch or full snapshot.
   * Semantics must be compatible with docs/presets.md.
   */
  config: unknown;
}
```

Notes:

- Only the **persistent** fields are stored. UI state such as
  `"locked" / "editing" / "unsaved"` is **not persisted**; it is derived at
  runtime.
- System-derived presets use `kind: "system"`; user-created presets use
  `kind: "user"`.

### 2.3 Runtime UI state

At runtime, the app holds:

```ts
type PresetUiMode = "locked" | "editing";

interface SavedPresetViewModel extends UserPresetRecord {
  uiMode: PresetUiMode;
}

interface UnsavedPresetSlot {
  /** Current working configuration not yet promoted to a saved preset. */
  config: unknown;
}
```

Global invariants:

- There is a single list of **saved presets** (`SavedPresetViewModel[]`).
- At any time:
  - **At most one** saved preset may have `uiMode: "editing"`.
  - **At most one** `UnsavedPresetSlot` may exist.
  - The app is either:
    - not in an editing session; or
    - editing **one saved preset**; or
    - editing the **single unsaved preset slot**.
- While an editing session is active (saved or unsaved), the user **cannot
  switch to another preset**; all other preset entries must be visually
  disabled for selection.

---

## 3. Local Storage and First-Load Initialisation

### 3.1 Local storage key and schema

- The user preset list is stored in `localStorage` under a dedicated key
  (exact key name and versioning are implementation details, but the schema
  must contain an array of `UserPresetRecord` objects).

### 3.2 First successful load

When the app loads:

1. Attempt to read the user preset list from local storage.
2. If a valid list is found:
   - Use it as the **only** source of truth for saved presets.
3. If no valid list is found:
   - Construct an initial array of four `UserPresetRecord` entries, one per
     system preset in `PRESETS`:
     - `id` = system preset id (`"original" | "large" | "medium" | "small"`).
     - `name` = current translated label for that preset.
     - `kind = "system"`.
     - `config` = configuration patch compatible with `docs/presets.md`.
   - Persist this initial array to local storage.
   - If persistence succeeds, use this array as the user preset list.

### 3.3 Persistence failure and fallback

If **initialisation or persistence fails** (for example due to disabled
storage, quota errors, or security restrictions), the app must:

1. Enter a **fallback mode**:
   - Do **not** attempt to persist a user preset list.
   - Render the preset UI as the current v1 behaviour: four fixed presets
     based directly on `PRESETS` (no per-user preset management).
   - Manual configuration changes still work for the current session, but
     no new presets are saved and nothing survives reload.
2. Display a clear, non-blocking warning to the user, e.g.:
   - “Unable to save presets on this device. Preset changes will not be
     remembered after you close the page.”

The fallback must preserve a fully usable core experience (pasting, resizing,
format conversion), but **preset creation/editing is effectively disabled**
beyond the current session.

---

## 4. Preset States and Editing Flows

This section describes how a user interacts with presets in normal (non
fallback) mode.

### 4.1 States overview

From the user’s perspective, each preset can be in one of three states:

- `locked`（锁定）
  - The preset is saved and not being edited.
  - Its configuration is stable and represents a named, reusable preset.
- `editing`（编辑）
  - The user is editing a **saved preset in place**.
  - Changes are not applied to the stored record until the user clicks
    “Save”; “Cancel” discards the edits.
- `unsaved`（未保存）
  - Represents a single **temporary preset slot** not yet promoted to the
    saved list.
  - There may be **at most one** unsaved preset at any time.
  - The unsaved preset does **not** have a name until the user chooses to
    save it.

Invariant:

- There is always exactly one “active” configuration:
  - either a saved preset (locked or editing), or
  - the unsaved preset slot.

### 4.2 Editing a saved preset via the “Edit” action

For saved presets, the settings UI exposes an **Edit** action (icon + label).

When the user clicks “Edit” on a saved preset:

1. Precondition:
   - No active unsaved preset slot exists.
   - No other preset is in `editing` mode.
2. Behaviour:
   - The clicked preset becomes the **active** preset.
   - Its UI mode changes from `locked` to `editing`.
   - The UI enters an “editing session”:
     - All other presets remain visible but are disabled for selection.
     - The settings controls are bound to this preset’s working copy.
3. The bottom actions for this preset show:
   - `Save` – apply the changes **in place**:
     - Overwrite the stored `config` of this preset.
     - Persist the updated preset list.
     - Switch UI mode back to `locked`.
   - `Cancel` – discard the edits:
     - Restore the last persisted `config` for this preset.
     - Switch UI mode back to `locked`.
4. After Save or Cancel, the editing session ends and normal preset switching
   is re-enabled.

Important:

- **No new preset is created** when editing via the “Edit” button.
- The preset keeps its existing `name` and `id`; only the stored configuration
  is updated.

### 4.3 Creating and editing the unsaved preset slot

When a locked preset is selected, the user can also **modify settings without
clicking “Edit” first** (e.g. by directly changing width/height, resize mode,
output format, etc.).

In this case:

1. If there is no active editing session and no existing unsaved slot:
   - The app creates a new **unsaved preset slot**:
     - Its initial `config` is derived from the current configuration of the
       selected locked preset (as per `docs/presets.md` semantics).
   - The active context switches from the locked preset to this unsaved slot.
2. All further changes while in this mode apply to the unsaved slot’s
   `config`.
3. While the unsaved slot is active:
   - No other preset can be selected.
   - The UI shows `Save` and `Cancel` actions associated with the unsaved
     preset.

Behaviour of actions:

- `Save` on unsaved preset:
  1) Generate a **new saved preset record** from the unsaved slot:
     - See §4.4 for naming rules.
     - `kind = "user"`.
     - `config` = current unsaved slot configuration.
  2) Append the new record to the saved preset list and persist.
  3) Clear the unsaved slot.
  4) Set the new preset as active in `locked` mode.

- `Cancel` on unsaved preset:
  1) Discard the unsaved slot completely.
  2) Revert the active context to the previously selected locked preset
     (with its last persisted configuration).
  3) After cancelling, it should be as if the unsaved preset “never existed”.

Invariant:

- There may be **at most one** unsaved slot at any time. Attempts to create
  another unsaved preset while one is active must either be ignored or
  blocked by the UI.

### 4.4 Naming rules for user presets (“自定义N”)

Unsaved presets have **no name**. A name is assigned only when the user
clicks “Save” on the unsaved slot.

Naming rules:

- Base prefix: `"自定义"`.
- Suffix: positive integer `N`.
- To allocate a new name:
  1. Look at all **saved** presets whose `name` strictly matches the pattern
     `"自定义" + N`, where `N` is a decimal number.
  2. Let `maxN` be the largest such `N` (or `0` if none exist).
  3. The new preset’s name is `"自定义" + (maxN + 1)`.
- Holes are not reused: if only `"自定义1"` and `"自定义3"` exist, the next
  saved preset becomes `"自定义4"`.

This rule guarantees:

- No duplicate names of the form `"自定义N"` among saved presets.
- Predictable, monotonically increasing numbering for user presets.

### 4.5 Interaction between locked, editing, and unsaved states

Summary of key rules:

- A saved preset can be modified in two distinct ways:
  1. **In-place editing** via its `Edit` button:
     - Switches that preset to `editing` mode.
     - No unsaved slot is created.
     - Save/Cancel update or revert the same preset record.
  2. **Temporary adjustment** by directly changing settings while the preset
     is locked:
     - Switches the app into the **unsaved preset slot**.
     - Leaves the original locked preset unchanged.
     - Save promotes the unsaved slot to a new user preset.
     - Cancel discards the unsaved slot and returns to the locked preset.

- While a saved preset is being edited (`editing` mode) or an unsaved slot is
  active:
  - The user cannot switch to another preset.
  - Preset list entries other than the one being edited must be disabled for
    selection.

---

## 5. UI Placement and Controls (Settings Panel)

In the Settings panel:

- The preset section remains near the top of the panel, reflecting the
  currently active preset (or the unsaved slot).
- A **preset management area** is shown in the lower part of the panel for
  saved presets:
  - For presets in `locked` mode:
    - Show an `Edit` action (icon + text) that enters the in-place editing
      flow (§4.2).
  - For a preset in `editing` mode:
    - Replace `Edit` with `Save` and `Cancel` actions bound to that preset.
  - When an unsaved preset slot is active:
    - Show `Save` and `Cancel` actions for the unsaved slot.
    - Visually indicate that the current configuration is “unsaved /
      temporary”.

Error/fallback behaviour:

- When the app is in fallback mode (local preset storage unavailable), the
  preset management area should be either hidden or clearly disabled, and a
  warning message as described in §3.3 should be visible to the user.

