import { Icon } from "@iconify/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { LanguageSelector } from "./components/LanguageSelector.tsx";
import { PasteArea } from "./components/PasteArea.tsx";
import { PreviewPanel } from "./components/PreviewPanel.tsx";
import { SettingsPanel } from "./components/SettingsPanel.tsx";
import { StatusBar } from "./components/StatusBar.tsx";
import { useAppVersion } from "./hooks/useAppVersion.ts";
import { useClipboard } from "./hooks/useClipboard.ts";
import { useImageProcessor } from "./hooks/useImageProcessor.ts";
import { useUserPresets } from "./hooks/useUserPresets.tsx";
import { useUserSettings } from "./hooks/useUserSettings.tsx";
import type { TranslationKey } from "./i18n";
import { useTranslation } from "./i18n";
import { preloadHeicConverter } from "./lib/heic.ts";
import { PRESETS } from "./lib/presets.ts";
import type { ImageInfo } from "./lib/types.ts";

function App() {
  const { t } = useTranslation();
  const { presets, activePresetId } = useUserPresets();
  const { settings, processingOptions } = useUserSettings();
  const { version } = useAppVersion();
  const [uiError, setUiError] = useState<string | null>(null);
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window === "undefined" ? 0 : window.innerWidth,
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const currentYear = new Date().getFullYear();

  const {
    status,
    errorMessage: processingError,
    source,
    result,
    processBlob,
    resetError: resetProcessingError,
  } = useImageProcessor(processingOptions);

  const {
    isCopying,
    errorMessage: clipboardError,
    copyImage,
    resetError: resetClipboardError,
  } = useClipboard();

  const hasImage = Boolean(source || result);
  const previousHasImageRef = useRef(hasImage);

  const isXs = viewportWidth < 640;
  const isSm = viewportWidth >= 640 && viewportWidth < 768;
  const isMd = viewportWidth >= 768 && viewportWidth < 1024;
  const isSmOrMd = isSm || isMd;
  const isLgUp = viewportWidth >= 1024;

  // Best-effort preload for the HEIC conversion bundle so the first HEIC paste
  // does not have to wait on the dynamic import network round-trip.
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const schedulePreload = () => {
      void preloadHeicConverter();
    };

    if ("requestIdleCallback" in window) {
      // Prefer not to compete with initial rendering work.
      (
        window as typeof window & {
          requestIdleCallback?:
            | ((cb: IdleRequestCallback) => number)
            | undefined;
        }
      ).requestIdleCallback?.(schedulePreload);
    } else {
      const timeoutId = setTimeout(schedulePreload, 1500);
      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, []);

  const activePreset = presets.find((preset) => preset.id === activePresetId);

  const presetLabel = (() => {
    if (activePreset) {
      // System presets keep using the i18n label for the current locale.
      if (activePreset.kind === "system") {
        const presetConfig = PRESETS.find(
          (item) => item.id === activePreset.id,
        );
        if (presetConfig) {
          return t(presetConfig.labelKey as TranslationKey);
        }
      }
      // Future user presets may provide custom display names.
      return activePreset.name;
    }

    const fallbackConfig = PRESETS.find(
      (item) => item.id === settings.presetId,
    );
    if (fallbackConfig) {
      return t(fallbackConfig.labelKey as TranslationKey);
    }

    return t("settings.presets.custom");
  })();

  const formatLabel = (() => {
    switch (settings.outputFormat) {
      case "auto":
        return t("settings.output.format.auto");
      case "image/jpeg":
        return t("settings.output.format.jpeg");
      case "image/png":
        return t("settings.output.format.png");
      case "image/webp":
        return t("settings.output.format.webp");
      default:
        return settings.outputFormat;
    }
  })();

  const sizeLabel = (() => {
    const autoLabel = t("app.summary.auto");
    const { targetWidth, targetHeight } = settings;
    if (
      typeof targetWidth === "number" &&
      typeof targetHeight === "number" &&
      targetWidth > 0 &&
      targetHeight > 0
    ) {
      return `${targetWidth}×${targetHeight}`;
    }
    if (typeof targetWidth === "number" && targetWidth > 0) {
      return `${targetWidth}×${autoLabel}`;
    }
    if (typeof targetHeight === "number" && targetHeight > 0) {
      return `${autoLabel}×${targetHeight}`;
    }
    return autoLabel;
  })();

  const resizeModeLabel = (() => {
    switch (settings.resizeMode) {
      case "fit":
        return t("settings.resizeMode.fit");
      case "fill":
        return t("settings.resizeMode.fill");
      case "stretch":
        return t("settings.resizeMode.stretch");
      default:
        return settings.resizeMode;
    }
  })();

  const handleImageSelected = useCallback(
    async (file: File) => {
      resetProcessingError();
      setUiError(null);

      await processBlob(file, file.name);
    },
    [processBlob, resetProcessingError],
  );

  const handleError = (message: string) => {
    resetProcessingError();
    setUiError(message);
  };

  const handleCopyResult = useCallback(
    async (blob: Blob, mimeType: string) => {
      resetClipboardError();
      await copyImage(blob, mimeType);
    },
    [copyImage, resetClipboardError],
  );

  const settingsAspectSource: ImageInfo | null = result ?? source;

  useEffect(() => {
    const handleWindowPaste = (event: ClipboardEvent) => {
      const clipboardData = event.clipboardData;
      if (!clipboardData) {
        return;
      }

      const { items, files } = clipboardData;

      const imageItem = Array.from(items).find((item) =>
        item.type.startsWith("image/"),
      );

      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) {
          event.preventDefault();
          void handleImageSelected(file);
          return;
        }
      }

      if (files.length > 0) {
        const image = Array.from(files).find((file) =>
          file.type.startsWith("image/"),
        );
        if (image) {
          event.preventDefault();
          void handleImageSelected(image);
          return;
        }
      }
    };

    window.addEventListener("paste", handleWindowPaste);
    return () => {
      window.removeEventListener("paste", handleWindowPaste);
    };
  }, [handleImageSelected]);

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      const isCopyShortcut =
        (event.metaKey || event.ctrlKey) &&
        (event.key === "c" || event.key === "C");

      if (!isCopyShortcut || !result) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName.toLowerCase();
        const isInputLike =
          tag === "input" ||
          tag === "textarea" ||
          tag === "select" ||
          target.isContentEditable;

        // Do not override normal copy behavior inside text inputs etc.
        if (isInputLike) {
          return;
        }
      }

      event.preventDefault();
      void handleCopyResult(result.blob, result.mimeType);
    };

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [handleCopyResult, result]);

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (isLgUp) {
      setIsSettingsOpen(true);
    }
  }, [isLgUp]);

  useEffect(() => {
    if (!isSmOrMd) {
      previousHasImageRef.current = hasImage;
      return;
    }

    if (!previousHasImageRef.current && hasImage) {
      setIsSettingsOpen(false);
    }

    if (previousHasImageRef.current && !hasImage) {
      setIsSettingsOpen(true);
    }

    previousHasImageRef.current = hasImage;
  }, [hasImage, isSmOrMd]);

  return (
    <div className="relative min-h-screen bg-base-200 text-base-content">
      <div className="absolute right-4 top-4 z-30">
        <LanguageSelector />
      </div>
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-4 lg:px-6 lg:py-6">
        <header className="mb-4 border-b border-base-300 pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline">
            <div>
              <h1 className="text-2xl font-semibold">{t("app.title")}</h1>
              <p className="text-sm text-base-content/70">{t("app.tagline")}</p>
            </div>
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-4">
          {isXs ? (
            <>
              <div className="w-full">
                <SettingsPanel currentImage={settingsAspectSource} />
              </div>

              <div className="flex w-full flex-1 flex-col gap-4">
                <PasteArea
                  hasImage={hasImage}
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
                    {t("clipboard.copying")}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex w-full flex-1 flex-col gap-4 md:flex-row">
              {(isLgUp || (isMd && !hasImage)) && (
                <div className="w-full md:w-72 md:shrink-0 lg:w-1/3">
                  <SettingsPanel currentImage={settingsAspectSource} />
                </div>
              )}

              <div className="flex w-full flex-1 flex-col gap-4 lg:w-2/3">
                {!isLgUp && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm gap-2"
                      onClick={() => setIsSettingsOpen((previous) => !previous)}
                    >
                      <Icon icon="mdi:tune" className="h-4 w-4" />
                      {t("settings.title")}
                    </button>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-base-content/70">
                      <span>
                        {t("app.summary.preset")}: {presetLabel}
                      </span>
                      <span>|</span>
                      <span>
                        {t("app.summary.size")}: {sizeLabel}
                      </span>
                      <span>|</span>
                      <span>
                        {t("app.summary.format")}: {formatLabel}
                      </span>
                      <span>|</span>
                      <span>
                        {t("app.summary.mode")}: {resizeModeLabel}
                      </span>
                    </div>
                  </div>
                )}

                <PasteArea
                  hasImage={hasImage}
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
                    {t("clipboard.copying")}
                  </div>
                )}
              </div>

              {!isLgUp && (isSm || (isMd && hasImage)) && (
                <>
                  <button
                    type="button"
                    className={`fixed inset-0 z-40 cursor-default bg-base-200/80 backdrop-blur-sm transition-opacity duration-200 ${
                      isSettingsOpen
                        ? "opacity-100 pointer-events-auto"
                        : "opacity-0 pointer-events-none"
                    }`}
                    aria-label={t("settings.drawer.overlayAria")}
                    onClick={() => setIsSettingsOpen(false)}
                  />
                  <div
                    className={`fixed inset-y-0 left-0 z-50 h-full bg-base-100 p-4 shadow-lg transform transition-transform duration-200 ${
                      isSm ? "w-full max-w-md" : "w-80 md:w-80"
                    } ${
                      isSettingsOpen ? "translate-x-0" : "-translate-x-full"
                    }`}
                    role="none"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <h2 className="text-sm font-semibold">
                        {t("settings.title")}
                      </h2>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs btn-square"
                        aria-label={t("settings.drawer.closeAria")}
                        onClick={() => setIsSettingsOpen(false)}
                      >
                        <Icon icon="mdi:close" className="h-4 w-4" />
                      </button>
                    </div>
                    <SettingsPanel currentImage={settingsAspectSource} />
                  </div>
                </>
              )}
            </div>
          )}
        </main>

        <footer className="mt-4 flex items-center justify-between border-t border-base-300 pt-3 text-xs text-base-content/70">
          <div>© {currentYear} PastePreset</div>
          <div className="flex items-center gap-3">
            {version && (
              <span className="text-xs text-base-content/60">v{version}</span>
            )}
            <a
              href="https://github.com/IvanLi-CN/paste-preset"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-base-content"
            >
              <Icon icon="mdi:github" className="h-4 w-4" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
          </div>
        </footer>

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
