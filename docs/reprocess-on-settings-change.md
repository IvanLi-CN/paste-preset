Reprocessing on Settings Change
===============================

This document specifies how PastePreset behaves when **output-affecting settings**
change:

- All existing tasks become **stale** and must be regenerated.
- In-app export actions (copy/download/shortcut) are **gated** until the current
  generation result is ready.
- The currently visible (expanded) tasks are **prioritized** for regeneration.

This document is **normative for behavior**; implementation details should follow
this specification.


1. Background
-------------

Changing settings can leave previously generated results unchanged, which breaks
trust: the visible “result” may no longer match the active settings.

The intended UX is strict: once output-affecting settings change, all previously
generated results are considered stale and must be regenerated before the app
allows copying/downloading them.


2. Goals
--------

- Strong correctness: results correspond to the current settings.
- Predictable priority: regenerate what the user is currently looking at first.
- Clear UX feedback: stale results remain visible but are clearly marked.
- Safe exports: no copy/download until an up-to-date result exists.
- No bulk download: disallow ZIP-based “download all” export.


3. Non-Goals
------------

- No attempts to restrict browser-native actions (context menu, save as, etc).
  Only in-app buttons and shortcuts are gated.
- No automatic retry loop within the same settings generation.
- No parallel processing / performance redesign beyond prioritization.


4. Terminology
--------------

- **Batch**: a “wave” of images coming from a single input action
  (paste/drop/file picker).
- **Task**: a single image work item inside a batch.
- **Generation**: a monotonic version counter representing the currently
  effective, output-affecting settings.
- **Stale result**: a task result generated under an older generation.


5. Batch Grouping and Ordering
------------------------------

### 5.1 Creating a batch

Each user input action creates exactly one batch:

- paste → one batch (may contain multiple images)
- drop → one batch
- file-input → one batch

### 5.2 Insertion and ordering

- A new batch is inserted at the top of the list (newest-first).
- Batches are ordered by time descending (newest batch first).
- Tasks within a batch are ordered by the original file order (stable, ascending).

### 5.3 Visual grouping

- The UI shows a clear separator between batches (divider or group header).
- The separator may include: timestamp, source, and image count.


6. Expansion, Active Task, and Keyboard Target
----------------------------------------------

### 6.1 Definitions

- `expandedIds`: the set of currently expanded task ids.
- `activeTaskId`: the last task that became expanded (auto or manual).

### 6.2 New batch behavior

When a new batch is inserted:

- All previously expanded tasks must collapse (`expandedIds` becomes empty).
- The first task of the new batch must be auto-expanded.
- `activeTaskId` becomes that auto-expanded task.

### 6.3 Manual expansion

- Expanding a task sets `activeTaskId` to that task id.
- Multi-expand (Alt/Shift) may keep multiple tasks expanded, but `activeTaskId`
  is still a single “current” task (the most recently expanded).

### 6.4 Copy shortcut target

Ctrl/Cmd + C targets the result image of `activeTaskId`.


7. Settings Generation and Debounce
-----------------------------------

### 7.1 Generation

Maintain a monotonic `generation` counter.
Whenever output-affecting settings become effective, generation increments.

### 7.2 Output-affecting settings

Any setting that changes image processing output (i.e., the derived
`ProcessingOptions`) is considered output-affecting.

### 7.3 Debounce rules

- Numeric input fields (e.g., width/height) MUST be debounced before they are
  considered “effective” for generation purposes.
- All other controls (selects/toggles/buttons, preset selection) apply immediately.

Recommended debounce delay: 400ms after the last keystroke.


8. Stale Results and Reprocessing
---------------------------------

### 8.1 Task generation markers

Each task tracks:

- `desiredGeneration`: the generation the task is expected to match.
- `resultGeneration`: the generation that produced the currently stored result (if any).

A task’s result is considered up-to-date iff:

`result exists AND resultGeneration === currentGeneration`

### 8.2 Behavior on settings change

When generation increments:

- For every task: `desiredGeneration` is set to `currentGeneration`.
- All tasks are scheduled for processing under `currentGeneration`.
- Existing results remain visible but become stale (see UI rules below).

If a task is currently being processed when generation changes:

- Any finishing output that belongs to the old generation MUST NOT become an
  exportable result for the current UI state.
- The task remains scheduled to run under the new generation.

### 8.3 Scheduling priority

Reprocessing order MUST prioritize “what the user can see”:

1) `activeTaskId` (if it needs processing for the current generation)
2) other expanded tasks, in list order
3) all remaining tasks, in list order

List order is defined by Section 5 (batch newest-first, then task order within batch).


9. Export Gating (Copy / Download)
----------------------------------

### 9.1 Rule

In-app export actions are allowed only when the targeted task has an up-to-date
result for the current generation.

Disallowed targets:

- processing / queued / not yet processed
- stale result (`resultGeneration !== currentGeneration`)
- error state without a current-generation result

### 9.2 In-app entrypoints to gate

- Copy button (task row and task details)
- Download button/link (task row and task details)
- Ctrl/Cmd + C shortcut

### 9.3 Feedback requirements

- Buttons that would export MUST be disabled when export is disallowed.
- Shortcut-triggered export MUST show a clear status/toast when disallowed.
- When copying is in progress, visible copy entrypoints MUST show loading state.


10. UI: Stale Overlay and Status Messaging
------------------------------------------

### 10.1 Stale overlay

When a task has a stale result (Section 8.1):

- The result image remains visible.
- A pulse/skeleton-style overlay is shown on top of it.
- Overlay text communicates regeneration, e.g. “Regenerating…” / “Waiting…”.

### 10.2 Global status

While any tasks are being processed for the current generation, the app shows a
global status indicator (e.g., via StatusBar).

A progress indicator is recommended, e.g.:

- Regenerating `{done}/{total}`


11. Failure Policy (No Retry Within a Generation)
-------------------------------------------------

- If a task fails while attempting to generate for the current generation, it
  transitions to error and remains so for that generation.
- No automatic retry is performed under the same generation.
- When settings change (new generation), past failures are ignored and the task
  participates in reprocessing like all other tasks.


12. No Bulk Download
--------------------

- The app MUST NOT offer any bulk export (e.g. ZIP “Download all results”).
- Only single-image exports are allowed (subject to gating in Section 9).


13. Acceptance Criteria
-----------------------

- Changing any output-affecting setting makes all tasks stale and schedules them
  for regeneration under the new generation.
- Stale results remain visible with a pulse overlay, and cannot be copied/downloaded
  via in-app actions or shortcut.
- Regeneration prioritizes the currently visible expanded tasks, with `activeTaskId` first.
- Adding a new batch collapses all previous expansions, inserts the new batch at the top,
  and auto-expands the first task in the new batch (becoming `activeTaskId`).
- No automatic retries occur for failures within the same generation.
- No bulk download action exists.
