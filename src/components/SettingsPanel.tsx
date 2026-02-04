import { useCallback, useEffect, useRef, useState } from "react";
import { useUserPresets } from "../hooks/useUserPresets.tsx";
import { useUserSettings } from "../hooks/useUserSettings.tsx";
import { useTranslation } from "../i18n";
import type { ImageInfo, ResizeMode, UserSettings } from "../lib/types.ts";
import type { SystemPresetId } from "../lib/userPresets.ts";
import { PresetButtons } from "./PresetButtons.tsx";

interface SettingsPanelProps {
  currentImage?: ImageInfo | null;
}

const NUMERIC_INPUT_DEBOUNCE_MS = 400;
const PRESET_SWITCH_BLOCKED_THRESHOLD = 3;
const PRESET_SWITCH_BLOCKED_WINDOW_MS = 3500;
const PRESET_SWITCH_BLOCKED_HINT_AUTOHIDE_MS = 6000;

export function SettingsPanel(props: SettingsPanelProps) {
  const { currentImage } = props;
  const { t } = useTranslation();
  const { settings, updateSettings, resetSettings } = useUserSettings();
  const options = settings;
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [targetWidthInput, setTargetWidthInput] = useState(
    options.targetWidth?.toString() ?? "",
  );
  const [targetHeightInput, setTargetHeightInput] = useState(
    options.targetHeight?.toString() ?? "",
  );
  const targetWidthInputRef = useRef(targetWidthInput);
  const targetHeightInputRef = useRef(targetHeightInput);
  const numericDebounceTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const {
    resetPresets,
    mode: presetsMode,
    presets,
    activePresetId,
    editingPresetId,
    unsavedSlot,
    setActivePresetId,
    beginEditPreset,
    applyEditPreset,
    cancelEditPreset,
    beginUnsavedFromLocked,
    applyUnsavedToNewPreset,
    cancelUnsaved,
  } = useUserPresets();

  const activePreset = presets.find((preset) => preset.id === activePresetId);

  const isEditingSavedPreset =
    presetsMode === "normal" && Boolean(editingPresetId) && !unsavedSlot;
  const isEditingUnsaved = presetsMode === "normal" && Boolean(unsavedSlot);
  const canShowPresetSwitchHint = isEditingSavedPreset || isEditingUnsaved;
  const [isPresetSwitchHintOpen, setIsPresetSwitchHintOpen] = useState(false);
  const presetSwitchHintTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const presetSwitchAttemptRef = useRef<{ count: number; lastAt: number }>({
    count: 0,
    lastAt: 0,
  });

  const aspectRatio = (() => {
    // Prefer the actual source/result image aspect ratio when available.
    if (currentImage && currentImage.height > 0) {
      return currentImage.width / currentImage.height;
    }

    // Fallback: derive an aspect ratio from the current target dimensions if
    // both are explicitly set. This allows the lock to behave sensibly even
    // before an image is loaded, based on the "currently computed target
    // aspect" from user input.
    const { targetWidth, targetHeight } = options;
    if (
      typeof targetWidth === "number" &&
      typeof targetHeight === "number" &&
      targetWidth > 0 &&
      targetHeight > 0
    ) {
      return targetWidth / targetHeight;
    }

    return null;
  })();

  useEffect(() => {
    const next = options.targetWidth?.toString() ?? "";
    setTargetWidthInput(next);
    targetWidthInputRef.current = next;
    if (numericDebounceTimeoutRef.current) {
      clearTimeout(numericDebounceTimeoutRef.current);
      numericDebounceTimeoutRef.current = null;
    }
  }, [options.targetWidth]);

  useEffect(() => {
    const next = options.targetHeight?.toString() ?? "";
    setTargetHeightInput(next);
    targetHeightInputRef.current = next;
    if (numericDebounceTimeoutRef.current) {
      clearTimeout(numericDebounceTimeoutRef.current);
      numericDebounceTimeoutRef.current = null;
    }
  }, [options.targetHeight]);

  useEffect(
    () => () => {
      if (numericDebounceTimeoutRef.current) {
        clearTimeout(numericDebounceTimeoutRef.current);
      }
      if (presetSwitchHintTimeoutRef.current) {
        clearTimeout(presetSwitchHintTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (canShowPresetSwitchHint) {
      return;
    }

    // Exit edit/unsaved mode: reset hint state so it does not linger.
    setIsPresetSwitchHintOpen(false);
    presetSwitchAttemptRef.current = { count: 0, lastAt: 0 };
    if (presetSwitchHintTimeoutRef.current) {
      clearTimeout(presetSwitchHintTimeoutRef.current);
      presetSwitchHintTimeoutRef.current = null;
    }
  }, [canShowPresetSwitchHint]);

  const handleBlockedPresetSwitchAttempt = useCallback(
    (_attemptedId: string) => {
      if (!canShowPresetSwitchHint) {
        return;
      }

      const now = Date.now();
      const { count, lastAt } = presetSwitchAttemptRef.current;
      const nextCount =
        lastAt > 0 && now - lastAt <= PRESET_SWITCH_BLOCKED_WINDOW_MS
          ? count + 1
          : 1;

      presetSwitchAttemptRef.current = { count: nextCount, lastAt: now };

      if (nextCount < PRESET_SWITCH_BLOCKED_THRESHOLD) {
        return;
      }

      setIsPresetSwitchHintOpen(true);
      if (presetSwitchHintTimeoutRef.current) {
        clearTimeout(presetSwitchHintTimeoutRef.current);
      }
      presetSwitchHintTimeoutRef.current = setTimeout(() => {
        setIsPresetSwitchHintOpen(false);
      }, PRESET_SWITCH_BLOCKED_HINT_AUTOHIDE_MS);
    },
    [canShowPresetSwitchHint],
  );

  const resetPresetSwitchHint = () => {
    setIsPresetSwitchHintOpen(false);
    presetSwitchAttemptRef.current = { count: 0, lastAt: 0 };
    if (presetSwitchHintTimeoutRef.current) {
      clearTimeout(presetSwitchHintTimeoutRef.current);
      presetSwitchHintTimeoutRef.current = null;
    }
  };

  const handlePresetSelect = (presetId: string) => {
    const presetRecord = presets.find((preset) => preset.id === presetId);
    if (!presetRecord) {
      return;
    }

    // In both normal and fallback modes, the saved preset list provides
    // the snapshot to apply to UserSettings.
    updateSettings(presetRecord.settings);
    setActivePresetId(presetRecord.id);
  };

  const beginUnsavedIfNeeded = () => {
    if (
      presetsMode !== "normal" ||
      unsavedSlot ||
      editingPresetId ||
      !options.presetId
    ) {
      return;
    }

    beginUnsavedFromLocked(options.presetId, options);
  };

  const handleNumericChange = (
    key: "targetWidth" | "targetHeight",
    value: string,
  ) => {
    beginUnsavedIfNeeded();

    const parsed = Number.parseInt(value, 10);
    const nextValue = Number.isNaN(parsed) ? null : parsed;

    if (key === "targetWidth") {
      setTargetWidthInput(value);
      targetWidthInputRef.current = value;
    } else {
      setTargetHeightInput(value);
      targetHeightInputRef.current = value;
    }

    if (numericDebounceTimeoutRef.current) {
      clearTimeout(numericDebounceTimeoutRef.current);
    }

    const scheduleCommit = () => {
      numericDebounceTimeoutRef.current = setTimeout(() => {
        const widthValue = (() => {
          const widthParsed = Number.parseInt(targetWidthInputRef.current, 10);
          return Number.isNaN(widthParsed) ? null : widthParsed;
        })();
        const heightValue = (() => {
          const heightParsed = Number.parseInt(
            targetHeightInputRef.current,
            10,
          );
          return Number.isNaN(heightParsed) ? null : heightParsed;
        })();

        updateSettings({
          targetWidth: widthValue,
          targetHeight: heightValue,
        });
        numericDebounceTimeoutRef.current = null;
      }, NUMERIC_INPUT_DEBOUNCE_MS);
    };

    // When aspect ratio lock is enabled and we know an aspect ratio from
    // the current image, keep width/height in sync as the user edits one
    // dimension. When there is no image yet, fall back to independent
    // width/height behavior.
    if (
      options.lockAspectRatio &&
      aspectRatio !== null &&
      nextValue !== null &&
      nextValue > 0
    ) {
      if (key === "targetWidth") {
        const derivedHeight = Math.round(nextValue / aspectRatio);
        const derivedHeightText = String(derivedHeight);
        setTargetHeightInput(derivedHeightText);
        targetHeightInputRef.current = derivedHeightText;
      } else if (key === "targetHeight") {
        const derivedWidth = Math.round(nextValue * aspectRatio);
        const derivedWidthText = String(derivedWidth);
        setTargetWidthInput(derivedWidthText);
        targetWidthInputRef.current = derivedWidthText;
      }
    }

    scheduleCommit();
  };

  const handleResizeModeChange = (mode: ResizeMode) => {
    beginUnsavedIfNeeded();
    updateSettings({
      resizeMode: mode,
    });
  };

  const handleOutputFormatChange = (value: UserSettings["outputFormat"]) => {
    beginUnsavedIfNeeded();
    updateSettings({
      outputFormat: value,
    });
  };

  const handleQualityChange = (value: string) => {
    beginUnsavedIfNeeded();
    const asNumber = Number.parseFloat(value);
    updateSettings({
      quality: Number.isNaN(asNumber) ? null : asNumber,
    });
  };

  const showQuality =
    options.outputFormat === "image/jpeg" ||
    options.outputFormat === "image/webp";

  const handleEditClick = () => {
    if (!activePresetId || presetsMode !== "normal") {
      return;
    }

    const preset = presets.find((item) => item.id === activePresetId);
    if (!preset) {
      return;
    }

    beginEditPreset(activePresetId);
    // Start editing from the last persisted preset configuration.
    updateSettings(preset.settings);
  };

  const handleEditSave = () => {
    if (!isEditingSavedPreset || !editingPresetId) {
      return;
    }
    resetPresetSwitchHint();
    applyEditPreset(options);
  };

  const handleEditCancel = () => {
    if (!editingPresetId) {
      return;
    }
    resetPresetSwitchHint();

    const preset = presets.find((item) => item.id === editingPresetId);
    if (preset) {
      // Restore the last persisted configuration for this preset.
      updateSettings(preset.settings);
    }

    cancelEditPreset();
  };

  const handleUnsavedSave = () => {
    if (!isEditingUnsaved || !unsavedSlot) {
      return;
    }
    resetPresetSwitchHint();
    applyUnsavedToNewPreset(options);
  };

  const handleUnsavedCancel = () => {
    if (!unsavedSlot) {
      return;
    }
    resetPresetSwitchHint();

    const sourcePreset = presets.find(
      (preset) => preset.id === unsavedSlot.sourceId,
    );
    if (sourcePreset) {
      updateSettings(sourcePreset.settings);
    }

    cancelUnsaved();
  };

  const handleResetPresetsClick = () => {
    setIsResetDialogOpen(true);
  };

  const handleResetPresetsConfirm = () => {
    resetPresets();
    setIsResetDialogOpen(false);
  };

  const handleResetPresetsCancel = () => {
    setIsResetDialogOpen(false);
  };

  useEffect(() => {
    if (!activePresetId) return;

    const exists = presets.some((preset) => preset.id === activePresetId);
    if (exists) return;

    const bySystemId = (id: SystemPresetId) =>
      presets.find((preset) => preset.systemPresetId === id);

    const fallbackPreset =
      bySystemId("original") ??
      bySystemId("large") ??
      bySystemId("medium") ??
      bySystemId("small") ??
      presets[0] ??
      null;

    if (!fallbackPreset) {
      return;
    }

    setActivePresetId(fallbackPreset.id);
    updateSettings(fallbackPreset.settings);
  }, [activePresetId, presets, setActivePresetId, updateSettings]);

  return (
    <aside className="space-y-6">
      <section className="card bg-base-100">
        <div className="card-body">
          <h2 className="card-title text-lg">{t("settings.title")}</h2>
          <p className="text-sm text-base-content/70">
            {t("settings.description")}
          </p>

          <PresetButtons
            selectedId={isEditingUnsaved ? "__unsaved__" : activePresetId}
            onPresetSelect={handlePresetSelect}
            onBlockedPresetSwitchAttempt={handleBlockedPresetSwitchAttempt}
          />

          <div className="space-y-4">
            <div>
              <div className="mb-2 text-sm font-semibold">
                {t("settings.resolution.title")}
              </div>
              <div className="flex gap-2">
                <label className="form-control w-1/2">
                  <div className="label">
                    <span className="label-text text-xs">
                      {t("settings.resolution.width")}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={1}
                    placeholder={t("settings.resolution.placeholderAuto")}
                    className="input input-sm input-bordered"
                    value={targetWidthInput}
                    onChange={(event) =>
                      handleNumericChange("targetWidth", event.target.value)
                    }
                  />
                </label>
                <label className="form-control w-1/2">
                  <div className="label">
                    <span className="label-text text-xs">
                      {t("settings.resolution.height")}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={1}
                    placeholder={t("settings.resolution.placeholderAuto")}
                    className="input input-sm input-bordered"
                    value={targetHeightInput}
                    onChange={(event) =>
                      handleNumericChange("targetHeight", event.target.value)
                    }
                  />
                </label>
              </div>

              <label className="mt-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="toggle toggle-sm"
                  checked={options.lockAspectRatio}
                  onChange={(event) => {
                    beginUnsavedIfNeeded();
                    updateSettings({
                      lockAspectRatio: event.target.checked,
                    });
                  }}
                />
                <span>{t("settings.resolution.lockAspectRatio")}</span>
              </label>
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold">
                {t("settings.resizeMode.title")}
              </div>
              <div className="join">
                {(["fit", "fill", "stretch"] satisfies ResizeMode[]).map(
                  (mode) => {
                    const label =
                      mode === "fit"
                        ? t("settings.resizeMode.fit")
                        : mode === "fill"
                          ? t("settings.resizeMode.fill")
                          : t("settings.resizeMode.stretch");

                    return (
                      <input
                        key={mode}
                        type="radio"
                        name="resizeMode"
                        aria-label={label}
                        className="btn btn-xs join-item"
                        checked={options.resizeMode === mode}
                        onChange={() => handleResizeModeChange(mode)}
                      />
                    );
                  },
                )}
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold">
                {t("settings.output.title")}
              </div>
              <div className="flex flex-col gap-3">
                <label className="form-control">
                  <div className="label">
                    <span className="label-text text-xs">
                      {t("settings.output.format.label")}
                    </span>
                  </div>
                  <select
                    className="select select-sm select-bordered"
                    value={options.outputFormat}
                    onChange={(event) =>
                      handleOutputFormatChange(
                        event.target.value as UserSettings["outputFormat"],
                      )
                    }
                  >
                    <option value="auto">
                      {t("settings.output.format.auto")}
                    </option>
                    <option value="image/jpeg">
                      {t("settings.output.format.jpeg")}
                    </option>
                    <option value="image/png">
                      {t("settings.output.format.png")}
                    </option>
                    <option value="image/webp">
                      {t("settings.output.format.webp")}
                    </option>
                  </select>
                </label>

                {showQuality && (
                  <label className="form-control">
                    <div className="label flex justify-between">
                      <span className="label-text text-xs">
                        {t("settings.output.quality.label")}
                      </span>
                      <span className="label-text-alt text-xs">
                        {Math.round((options.quality ?? 0.8) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={options.quality ?? 0.8}
                      onChange={(event) =>
                        handleQualityChange(event.target.value)
                      }
                      className="range range-xs"
                    />
                  </label>
                )}

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={options.stripMetadata}
                    onChange={(event) => {
                      beginUnsavedIfNeeded();
                      updateSettings({
                        stripMetadata: event.target.checked,
                      });
                    }}
                  />
                  <span>{t("settings.output.stripMetadata")}</span>
                </label>
              </div>
            </div>
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={resetSettings}
                >
                  {t("settings.actions.reset")}
                </button>

                {presetsMode === "normal" && (
                  <div className="relative flex justify-end gap-2">
                    {isPresetSwitchHintOpen && canShowPresetSwitchHint && (
                      <output
                        className="absolute bottom-full left-1/2 z-20 mb-3 w-[32rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 whitespace-pre-line rounded-3xl border border-base-content/10 bg-base-200 p-5 text-xs leading-relaxed text-base-content shadow-xl"
                        aria-live="polite"
                        data-testid="preset-switch-blocked-hint"
                      >
                        {t("settings.presets.switchBlockedHint")}
                        <span className="pointer-events-none absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-l-[12px] border-r-[12px] border-t-[12px] border-l-transparent border-r-transparent border-t-base-content/10" />
                        <span className="pointer-events-none absolute left-1/2 top-full -mt-px h-0 w-0 -translate-x-1/2 border-l-[11px] border-r-[11px] border-t-[11px] border-l-transparent border-r-transparent border-t-base-200" />
                      </output>
                    )}
                    {isEditingSavedPreset && (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary btn-xs"
                          onClick={handleEditSave}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={handleEditCancel}
                        >
                          Cancel
                        </button>
                      </>
                    )}

                    {isEditingUnsaved && (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary btn-xs"
                          onClick={handleUnsavedSave}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={handleUnsavedCancel}
                        >
                          Cancel
                        </button>
                      </>
                    )}

                    {!isEditingSavedPreset &&
                      !isEditingUnsaved &&
                      activePreset &&
                      presetsMode === "normal" && (
                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          onClick={handleEditClick}
                        >
                          Edit
                        </button>
                      )}
                  </div>
                )}
              </div>

              {presetsMode === "fallback" && (
                <p className="text-xs text-warning text-right">
                  {t("settings.presets.fallbackWarning")}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="card bg-base-100">
        <div className="card-body space-y-2 text-sm">
          <h3 className="font-semibold">{t("settings.about.title")}</h3>
          <p className="text-base-content/70">
            {t("settings.about.description")}
          </p>
        </div>
      </section>

      <section className="card bg-base-100">
        <div className="card-body space-y-3 text-sm">
          <h3 className="font-semibold">{t("settings.tools.title")}</h3>
          <p className="text-base-content/70">
            {t("settings.tools.description")}
          </p>
          <div>
            <button
              type="button"
              className="btn btn-outline btn-xs"
              onClick={handleResetPresetsClick}
            >
              {t("settings.tools.resetPresets")}
            </button>
          </div>
        </div>
      </section>

      {isResetDialogOpen && (
        <dialog className="modal" open>
          <div className="modal-box">
            <h3 className="font-bold text-lg">
              {t("settings.tools.resetPresets")}
            </h3>
            <p className="py-2 text-sm text-base-content/70">
              {t("settings.tools.resetPresets.confirm")}
            </p>
            <div className="modal-action">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleResetPresetsCancel}
              >
                {t("settings.tools.resetPresets.cancelButton")}
              </button>
              <button
                type="button"
                className="btn btn-error btn-sm"
                onClick={handleResetPresetsConfirm}
              >
                {t("settings.tools.resetPresets.confirmButton")}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button
              type="submit"
              aria-label={t("settings.drawer.closeAria")}
              onClick={handleResetPresetsCancel}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleResetPresetsCancel();
                }
              }}
            >
              close
            </button>
          </form>
        </dialog>
      )}
    </aside>
  );
}
