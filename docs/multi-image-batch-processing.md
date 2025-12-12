Multi‑Image Batch Processing & OffscreenCanvas
=============================================

1. Background & Goals
---------------------

PastePreset v1 is designed around a single active image: each paste / drop / file
selection replaces the current source/result pair, and processing happens on
the main thread via an HTMLCanvas 2D context. This works well for quick, ad‑hoc
usage but becomes inefficient when users need to normalize a set of images.

This document specifies the design for:

- Multi‑image batch processing (typically up to ~100 images per session).
- A new multi‑image preview UI on the right‑hand side.
- Moving heavy image processing off the main thread using a dedicated Web Worker
  and OffscreenCanvas, with a clear, deterministic fallback path.
- Providing a ZIP‑based “Download all” entrypoint for processed results.

All decisions in this document are intended to be concrete; any alternative
approaches are explicitly marked as out of scope for this iteration.


2. Scope
--------

In scope for this iteration:

- Input:
  - Paste multiple images from the clipboard into the existing paste area.
  - Drag & drop multiple files onto the paste area.
  - Select multiple files via a file input (no directory selection).
- Processing:
  - Queue‑based batch processing of images, using the existing pipeline
    (HEIC→canvas‑friendly conversion, resizing, metadata strip/preserve,
    format conversion).
  - Off‑main‑thread rendering using a Web Worker + OffscreenCanvas when
    available.
  - Fallback to the existing main‑thread processing path when OffscreenCanvas
    or createImageBitmap is unavailable.
- UI:
  - Replace the single‑image preview area with a multi‑image task list on the
    right‑hand side.
  - Each task shows a compact summary row, with optional expandable details
    showing a full source/result comparison.
  - Default behavior: only one task is expanded at a time.
  - Modified behavior: when the user holds the Option/Alt or Shift key while
    clicking, multiple tasks may be expanded simultaneously.
  - Allow copying and downloading individual results directly from the collapsed
    row (no need to expand).
- Bulk download:
  - Provide a “Download all” action that generates a ZIP archive of all
    successfully processed result images and triggers a single download.

Out of scope for this iteration:

- Drag‑and‑drop or selection of directories / folders.
- Special Chrome‑only enhancements for download or file system access.
- Advanced task management (per‑task cancellation, reordering, or priorities).
- Persistence of batch history across page reloads.


3. Core User Flows
------------------

3.1 Paste multiple images
~~~~~~~~~~~~~~~~~~~~~~~~~

1. User copies one or more images into the clipboard.
2. With the PastePreset window focused, the user pastes into the paste area.
3. The app inspects the clipboard items and extracts all entries with an
   `image/*` MIME type.
4. For each image, the app creates an `ImageTask` (see Section 4) in the
   “queued” state and enqueues it for processing.
5. Tasks are processed strictly one at a time in FIFO order by the worker
   (no parallelism in this iteration).
6. As each task completes, its status transitions from `processing` to `done`
   (or `error` if processing fails), and the right‑hand list updates:
   - A collapsed row shows a thumbnail, basic metadata, and action buttons.
   - Expanding a row reveals a detailed source/result comparison.

3.2 Drag‑and‑drop multiple files
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

1. User selects multiple image files from the OS file manager and drags them
   onto the paste area.
2. The app reads `DataTransfer.files`, filters `image/*` types, and ignores
   non‑image entries.
3. For each image file, an `ImageTask` is created and enqueued as above.
4. Processing and UI behaviors are identical to the clipboard‑based flow.

3.3 Select multiple files via file input
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

1. User clicks the paste area to trigger the file picker.
2. In the file dialog, the user selects one or more image files.
3. The app reads `event.target.files`, filters `image/*`, and creates one
   `ImageTask` per file.
4. The queue, worker processing, and UI updates follow the same pattern as
   described above.

3.4 Expand/collapse behaviors
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

- Default click on a task row:
  - If the row is currently collapsed:
    - Collapse all other rows.
    - Expand only this row.
  - If the row is currently expanded:
    - Collapse this row.

- Modified click with Option/Alt or Shift held:
  - Toggle the expanded state of the clicked row only.
  - Do not affect other rows (allows multiple expanded tasks).

Collapsed rows:

- Show a small thumbnail (from the result image when available, otherwise from
  the source).
- Display the file name, dimensions, output format, and a concise status badge
  (`Queued`, `Processing`, `Done`, `Error`).
- Provide “Copy” and “Download” actions that operate on the result image
  (when available) without expanding the row.


4. Data Model
-------------

4.1 Task model
~~~~~~~~~~~~~~

New types are introduced to represent multi‑image processing:

```ts
type TaskStatus = "queued" | "processing" | "done" | "error";

interface ImageTask {
  id: string;
  fileName?: string;
  source?: ImageInfo;
  result?: ImageInfo;
  status: TaskStatus;
  errorMessage?: string;
  createdAt: number;
  completedAt?: number;
}
```

Design decisions:

- `ImageTask` is the canonical unit of work for the multi‑image view.
- A task is created in the `queued` state as soon as an image file is accepted
  (from paste/drop/file input).
- `source` and `result` are filled once processing succeeds.
- `errorMessage` is set when processing fails; the row remains visible in the
  list with an error badge.
- `createdAt` and `completedAt` are used purely for UI/diagnostics (e.g.
  sorting, elapsed time display); they have no effect on processing logic.

4.2 App‑level state
~~~~~~~~~~~~~~~~~~~

At the App/container level, single‑image state is replaced by:

```ts
const [tasks, setTasks] = useState<ImageTask[]>([]);
const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
const [activeTaskId, setActiveTaskId] = useState<string | undefined>();
```

Key decisions:

- The “global” `AppStatus` is no longer a single source of truth; it can be
  derived from the tasks (e.g. “processing” when any task is in that state).
- `activeTaskId` is used for keyboard focus / initial selection and is typically
  set to the first task created in a batch.
- The list can be cleared via a dedicated “Clear all” action, which removes
  all tasks and revokes associated object URLs (see Section 7).
- Per‑task cancellation or reordering is not implemented in this iteration.


5. Input Handling & PasteArea Changes
-------------------------------------

The existing `PasteArea` component is modified to support multi‑image input.

5.1 Component API
~~~~~~~~~~~~~~~~~

New props:

```ts
interface PasteAreaProps {
  onImagesSelected: (
    files: File[],
    source: "paste" | "drop" | "file-input",
  ) => void;
  onError: (message: string) => void;
  hasImage: boolean;
}
```

Changes:

- The old `onImageSelected(File)` prop is replaced by `onImagesSelected(...)`.
- The `source` argument allows the container to track where images came from,
  but does not affect processing; it is primarily for analytics / future UX.

5.2 Clipboard paste
~~~~~~~~~~~~~~~~~~~

- On `paste`:
  - Inspect `event.clipboardData.items` for all entries with an `image/*`
    MIME type.
  - Convert those items to `File` instances (via `getAsFile()`).
  - If there are no image items, check `clipboardData.files` in case the
    browser exposes images only via the files collection.
  - If no image files are found, invoke `onError` with the existing
    “no image in clipboard” message.
  - Otherwise, call `onImagesSelected(files, "paste")` with all discovered
    image files.

5.3 Drag‑and‑drop
~~~~~~~~~~~~~~~~~

- On `drop`:
  - Read `event.dataTransfer.files`.
  - Filter to `file.type.startsWith("image/")`.
  - If no valid images remain, call `onError` with the existing
    “no image file” message.
  - Otherwise, call `onImagesSelected(files, "drop")`.

5.4 File input
~~~~~~~~~~~~~~

- The hidden `<input type="file">` is updated to include `multiple`.
- On `change`:
  - Read `event.target.files`.
  - Filter `image/*` as above.
  - Pass the resulting array to `onImagesSelected(files, "file-input")`.
  - Reset `event.target.value` to allow re‑selecting the same file(s).


6. Processing Pipeline & Worker Architecture
--------------------------------------------

6.1 Responsibilities
~~~~~~~~~~~~~~~~~~~~

- Main thread:
  - Manages UI, task list state, expand/collapse behavior, and user actions.
  - Sends individual processing requests to a dedicated image processing worker.
  - Constructs `ImageInfo` objects from worker responses and updates
    `ImageTask` entries.
  - Triggers single‑image copy/download and bulk ZIP download.

- Worker:
  - Implements the heavy processing pipeline for a single image:
    HEIC normalization, decode, resizing, format conversion, and metadata
    handling, using OffscreenCanvas where available.
  - Returns a structured response containing all information required to build
    `ImageInfo` objects on the main thread.

6.2 Worker message protocol
~~~~~~~~~~~~~~~~~~~~~~~~~~~

Main → Worker:

```ts
interface ProcessRequest {
  type: "process";
  id: string;
  buffer: ArrayBuffer;
  mimeType: string;
  sourceName?: string;
  options: ProcessingOptions;
}
```

Worker → Main (success):

```ts
interface ProcessSuccess {
  type: "success";
  id: string;
  resultBuffer: ArrayBuffer;
  resultMimeType: string;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  metadata?: ImageMetadataSummary;
  metadataStripped: boolean;
}
```

Worker → Main (failure):

```ts
interface ProcessFailure {
  type: "failure";
  id: string;
  errorMessage: string;
}
```

Design decisions:

- `id` is echoed back so the main thread can match responses to tasks.
- All transferable payloads (`buffer`, `resultBuffer`) are passed using
  transferable objects to avoid unnecessary copying.
- Error messages are produced on the worker side but mapped to localized,
  user‑friendly messages on the main thread (reusing the existing error
  translation logic).

6.3 Queueing & concurrency
~~~~~~~~~~~~~~~~~~~~~~~~~~

To keep behavior predictable and limit resource usage:

- Processing is strictly sequential in this iteration:
  - At most one `ProcessRequest` is “in flight” at any time.
  - Newly created tasks are appended to a FIFO queue.
  - When the worker finishes a task (success or failure), the next task from
    the queue is dispatched.
- This design:
  - Avoids CPU spikes and memory contention from many parallel canvases.
  - Keeps UI feedback simple (a single “currently processing” indicator).
  - Still supports batches of up to ~100 images in a predictable manner.

Future iterations may introduce limited parallelism behind a configurable
concurrency level, but this is explicitly out of scope here.

6.4 OffscreenCanvas vs. main‑thread fallback
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Capability detection:

```ts
const supportsOffscreenCanvas =
  typeof OffscreenCanvas !== "undefined" &&
  typeof createImageBitmap === "function";
```

Processing behavior:

- If `supportsOffscreenCanvas` is `true`:
  - All image decoding and rendering happen inside the worker using:
    - `normalizeImageBlobForCanvas` for HEIC/HEIF normalization.
    - `createImageBitmap` for decoding.
    - `new OffscreenCanvas(targetWidth, targetHeight)` and a 2D context for
      rendering (equivalent to the existing `drawToCanvas` logic).
    - `OffscreenCanvas.convertToBlob({ type: mime, quality })` for export.
    - The existing EXIF embedding routines for PNG/WebP where applicable.

- If `supportsOffscreenCanvas` is `false`:
  - The worker still handles “pure data” parts (HEIC normalization, EXIF parsing
    and embedding) where feasible.
  - The main thread falls back to the existing `processImageBlob` pipeline
    using an HTMLCanvas element and `canvas.toBlob`.
  - From the container’s point of view, both paths conform to the same
    `ProcessSuccess` / `ProcessFailure` shape, so the UI does not need to
    branch on capabilities.


7. Preview UI & Interactions
----------------------------

7.1 List layout
~~~~~~~~~~~~~~~

The right‑hand panel is restructured as a vertical list of task cards:

- Each card corresponds to an `ImageTask`.
- Cards are ordered by `createdAt` (oldest first) or by completion time;
  the exact ordering should be stable and predictable, defaulting to
  creation time.
- A global “Clear all” button is provided to remove all tasks and free
  associated resources (revoking object URLs).

7.2 Collapsed row content
~~~~~~~~~~~~~~~~~~~~~~~~~

Each collapsed row includes:

- Thumbnail:
  - Uses the result image if available; otherwise the source image.
  - Constrained to a small fixed height/width for performance.
- Textual summary:
  - File name (if available).
  - Dimensions (result width × height).
  - Output MIME type (result).
  - Optional metadata status badge (e.g. “Metadata stripped”).
- Status badge:
  - `Queued`, `Processing`, `Done`, or `Error`.
- Actions:
  - `Copy`:
    - Invokes the existing clipboard pipeline with `result.blob` and
      `result.mimeType`.
  - `Download`:
    - Uses `<a download>` and the result object URL with a generated file name.

These actions are disabled when `result` is not yet available or the task is
in an error state.

7.3 Expanded details
~~~~~~~~~~~~~~~~~~~~

When a row is expanded:

- The card shows a two‑column layout similar to the current `PreviewPanel`:
  - Left: source image card (thumbnail + dimensions + format + size).
  - Right: result image card (thumbnail + dimensions + format + size +
    metadata badges).
- The result side includes:
  - `Copy` and `Download` buttons (duplicating the collapsed row actions for
    convenience).
  - Badges indicating resize behavior and metadata status.
- Where possible, existing `PreviewPanel` subcomponents and styling are
  reused to minimize divergence between single‑image and multi‑image states.

7.4 Keyboard & accessibility
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

- Task rows are focusable, and expansion can be triggered via keyboard
  (e.g. Enter/Space), following the same single vs. multi‑expand rules as
  mouse clicks.
- ARIA labels mirror the current single‑image UI semantics for copy/download
  actions.
- Status badges use concise text that can be read by screen readers.


8. ZIP “Download All” Behavior
------------------------------

8.1 Functionality
~~~~~~~~~~~~~~~~~

- A “Download all” button appears in the header of the task list when there is
  at least one task with a completed result.
- On click:
  - The button enters a loading state with text such as “Preparing ZIP…”.
  - The app collects all tasks with `status === "done"` and a non‑null result.
  - For each, it determines a file name as described below and adds it to the
    ZIP archive.
  - When the ZIP is generated, a download is triggered via `<a download>`.

8.2 File naming
~~~~~~~~~~~~~~~

For each result in the ZIP:

- If the task has a `fileName`:
  - Strip the original extension, if any.
  - Append the extension corresponding to the result MIME type
    (`.jpg`, `.png`, `.webp`).
  - Example: `photo.heic` → `photo.jpg`.
- If no `fileName` is available (e.g. clipboard‑only images):
  - Use `pastepreset-YYYYMMDD-HHMMSS-<index>.<ext>`, where `<index>` is a
    zero‑based or one‑based index that is stable within the batch.

8.3 Implementation notes
~~~~~~~~~~~~~~~~~~~~~~~~

- A small helper module (e.g. `zip.ts`) is introduced to encapsulate ZIP
  creation, likely using a library such as JSZip.
- ZIP creation runs on the main thread in this iteration:
  - The amount of work is bounded by the number of completed tasks.
  - The UI communicates that “Preparing ZIP…” might take a short moment.
- If future profiling shows that ZIP creation is a bottleneck, a dedicated
  worker can be introduced, but that is explicitly out of scope here.


9. Risks & Mitigations
----------------------

- **Performance on large batches**:
  - Sequential processing via a single worker request at a time avoids
    pathological CPU spikes.
  - The UI can surface progress (e.g. “Processing 3/25”) based on task states.
- **Memory usage with many tasks**:
  - “Clear all” action is provided to release resources.
  - Implementation must revoke all object URLs (`URL.revokeObjectURL`) when
    tasks are removed.
- **Browser capability variance**:
  - The OffscreenCanvas‑based path is guarded by capability checks.
  - The main‑thread fallback reuses the existing `processImageBlob` logic,
    preserving behavior on older browsers.
- **Complexity of UI interactions**:
  - Expansion rules are clearly defined (single‑expand by default, multi‑expand
    only with Option/Alt or Shift).
  - The list view keeps per‑row actions simple and mirrors existing button
    semantics.


10. Summary
-----------

This design evolves PastePreset from a single‑image, main‑thread‑bound tool
into a multi‑image batch processor capable of handling up to roughly 100
images in a single session, while keeping interactions predictable and the
UI responsive.

Key pillars:

- Queue‑based multi‑image processing with a clear `ImageTask` model.
- Off‑main‑thread rendering via Web Worker + OffscreenCanvas where supported,
  with a deterministic main‑thread fallback.
- A task list UI that scales to dozens of images, supports fast per‑image
  operations from collapsed rows, and allows targeted deep inspection via
  expandable details.
- ZIP‑based “Download all” that aggregates successfully processed results into
  a single archive for convenience.

This document serves as the implementation reference for the corresponding
feature branch and should be kept up to date if the implementation deviates
from the described design.

