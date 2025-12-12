import JSZip from "jszip";
import type { ImageTask } from "./types";

/**
 * Builds a ZIP file containing the results of all completed tasks.
 *
 * @param tasks - The list of image tasks to process.
 * @returns A Promise that resolves to a Blob representing the ZIP file, or null if no tasks are done.
 * @throws Error if ZIP generation fails.
 */
export async function buildResultsZip(
  tasks: ImageTask[],
): Promise<Blob | null> {
  const doneTasks = tasks.filter((t) => t.status === "done" && t.result);

  if (doneTasks.length === 0) {
    return null;
  }

  const zip = new JSZip();
  const now = new Date();

  // Format: YYYYMMDD-HHMMSS
  // Using local time components to match user expectation of "current time"
  const timestamp =
    now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, "0") +
    now.getDate().toString().padStart(2, "0") +
    "-" +
    now.getHours().toString().padStart(2, "0") +
    now.getMinutes().toString().padStart(2, "0") +
    now.getSeconds().toString().padStart(2, "0");

  const usedNames = new Set<string>();
  let index = 1;

  for (const task of doneTasks) {
    if (!task.result) continue;

    const mimeType = task.result.mimeType;
    let extension = "";
    if (mimeType === "image/jpeg") extension = ".jpg";
    else if (mimeType === "image/png") extension = ".png";
    else if (mimeType === "image/webp") extension = ".webp";
    // If unknown mime type, we might want to default or skip extension.
    // Keeping empty string if unknown for now, or could default to .bin if really needed.

    let baseName: string;

    if (task.fileName) {
      // Remove original extension if present
      const lastDotIndex = task.fileName.lastIndexOf(".");
      baseName =
        lastDotIndex !== -1
          ? task.fileName.substring(0, lastDotIndex)
          : task.fileName;
    } else {
      baseName = `pastepreset-${timestamp}-${index}`;
    }

    // Construct full filename
    const initialFileName = `${baseName}${extension}`;
    let uniqueName = initialFileName;
    let counter = 1;

    // Deduplicate
    while (usedNames.has(uniqueName)) {
      // format: basename (1).ext
      uniqueName = `${baseName} (${counter})${extension}`;
      counter++;
    }

    usedNames.add(uniqueName);
    // Use arrayBuffer() to ensure compatibility with JSZip in various environments
    // (Node/Bun/Browser) where Blob detection might be flaky.
    const ab = await task.result.blob.arrayBuffer();
    zip.file(uniqueName, new Uint8Array(ab));
    index++;
  }

  return zip.generateAsync({ type: "blob" });
}
