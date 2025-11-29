import { useState } from "react";
import { PasteArea } from "./components/PasteArea.tsx";
import { PreviewPanel } from "./components/PreviewPanel.tsx";
import { SettingsPanel } from "./components/SettingsPanel.tsx";
import { StatusBar } from "./components/StatusBar.tsx";
import { useClipboard } from "./hooks/useClipboard.ts";
import { useImageProcessor } from "./hooks/useImageProcessor.ts";
import { DEFAULT_OPTIONS } from "./lib/presets.ts";
import type { ProcessingOptions } from "./lib/types.ts";

function App() {
  const [options, setOptions] = useState<ProcessingOptions>(DEFAULT_OPTIONS);
  const [uiError, setUiError] = useState<string | null>(null);

  const {
    status,
    errorMessage: processingError,
    source,
    result,
    processBlob,
    resetError: resetProcessingError,
  } = useImageProcessor(options);

  const {
    isCopying,
    errorMessage: clipboardError,
    copyImage,
    resetError: resetClipboardError,
  } = useClipboard();

  const handleImageSelected = async (file: File) => {
    resetProcessingError();
    setUiError(null);

    await processBlob(file, file.name);
  };

  const handleError = (message: string) => {
    resetProcessingError();
    setUiError(message);
  };

  const handleCopyResult = async (blob: Blob, mimeType: string) => {
    resetClipboardError();
    await copyImage(blob, mimeType);
  };

  return (
    <div className="min-h-screen bg-base-200 text-base-content">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-4 lg:px-6 lg:py-6">
        <header className="mb-4 border-b border-base-300 pb-3">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-baseline">
            <div>
              <h1 className="text-2xl font-semibold">PastePreset</h1>
              <p className="text-sm text-base-content/70">
                Paste or drop an image, resize and convert it entirely in your
                browser.
              </p>
            </div>
            <div className="text-xs text-base-content/60">
              Images stay on this device; no uploads.
            </div>
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-4 lg:flex-row">
          <div className="w-full lg:w-1/3">
            <SettingsPanel options={options} onOptionsChange={setOptions} />
          </div>

          <div className="flex w-full flex-1 flex-col gap-4 lg:w-2/3">
            <PasteArea
              hasImage={Boolean(source || result)}
              onImageSelected={handleImageSelected}
              onError={handleError}
            />
            <PreviewPanel
              source={source}
              result={result}
              status={status}
              onCopyResult={handleCopyResult}
            />

            {isCopying && (
              <div className="text-right text-xs text-base-content/60">
                Copying image to clipboard…
              </div>
            )}
          </div>
        </main>

        <StatusBar
          status={status}
          processingError={processingError ?? uiError}
          clipboardError={clipboardError}
        />
      </div>
    </div>
  );
}

export default App;
