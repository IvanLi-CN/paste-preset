import { useEffect, useRef } from "react";
import { useUserPresets } from "../hooks/useUserPresets.tsx";
import type { TranslationKey } from "../i18n";
import { useTranslation } from "../i18n";
import {
  describePresetDiff,
  getPresetDiffTokens,
  getPresetDisplayName,
} from "../lib/userPresets.ts";

interface PresetButtonsProps {
  selectedId: string | null;
  onPresetSelect: (id: string) => void;
  onBlockedPresetSwitchAttempt?: (id: string) => void;
}

export function PresetButtons(props: PresetButtonsProps) {
  const { selectedId, onPresetSelect, onBlockedPresetSwitchAttempt } = props;
  const { t } = useTranslation();
  const {
    mode,
    presets,
    editingPresetId,
    unsavedSlot,
    renamingPresetId,
    beginRenamingPreset,
    applyRenamePreset,
    cancelRenamePreset,
    deletePreset,
  } = useUserPresets();

  const canSwitchPresets =
    !editingPresetId && !unsavedSlot && !renamingPresetId;
  const canDeletePresets = mode === "normal" && canSwitchPresets;
  const hasUnsavedSlot = Boolean(unsavedSlot);
  const isVertical = presets.length >= 5 || mode === "fallback";

  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const lastTapRef = useRef<{ id: string; timestamp: number } | null>(null);

  useEffect(() => {
    if (renamingPresetId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingPresetId]);

  const handlePresetClick = (id: string) => {
    if (!canSwitchPresets) {
      if (selectedId !== id) {
        onBlockedPresetSwitchAttempt?.(id);
      }
      return;
    }

    onPresetSelect(id);

    const now =
      typeof performance !== "undefined" &&
      typeof performance.now === "function"
        ? performance.now()
        : Date.now();
    const last = lastTapRef.current;

    if (last && last.id === id && now - last.timestamp < 350) {
      // Treat two quick taps/clicks on the same preset as a rename gesture.
      beginRenamingPreset(id);
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { id, timestamp: now };
    }
  };

  if (isVertical) {
    return (
      <div className="mb-4">
        <div className="mb-2 text-sm font-semibold">
          {t("settings.presets.title")}
        </div>
        <div className="flex flex-col gap-2 w-full">
          {presets.map((preset) => {
            const isActive = selectedId === preset.id;
            const isBlocked = !canSwitchPresets && !isActive;
            const label = getPresetDisplayName(preset, (key) => t(key));
            const diffTokens = getPresetDiffTokens(preset.settings, t);

            if (renamingPresetId === preset.id) {
              return (
                <div
                  key={preset.id}
                  className="grid w-full items-center gap-3"
                  style={{ gridTemplateColumns: "7rem minmax(0,1fr) 2rem" }}
                >
                  <input
                    ref={renameInputRef}
                    className="input input-sm input-bordered w-full truncate"
                    defaultValue={preset.name ?? label}
                    onBlur={(e) => applyRenamePreset(preset.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyRenamePreset(
                          preset.id,
                          (e.target as HTMLInputElement).value,
                        );
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        (e.target as HTMLInputElement).blur();
                        cancelRenamePreset();
                      }
                    }}
                  />
                  <div className="text-xs text-base-content/70">
                    {diffTokens.length === 0 ? (
                      <span className="opacity-60">-</span>
                    ) : (
                      <div
                        className="tooltip tooltip-top w-full"
                        data-tip={describePresetDiff(preset.settings, t)}
                      >
                        <div className="flex flex-row gap-1 overflow-hidden whitespace-nowrap">
                          {diffTokens.slice(0, 3).map((token, index) => (
                            <span
                              key={`${token.kind}-${index}`}
                              className="badge badge-ghost badge-xs"
                            >
                              {token.short}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs shrink-0"
                    disabled
                  >
                    🗑
                  </button>
                </div>
              );
            }

            return (
              <div
                key={preset.id}
                className="grid w-full items-center gap-3"
                style={{ gridTemplateColumns: "7rem minmax(0,1fr) 2rem" }}
              >
                <button
                  type="button"
                  className={[
                    "btn btn-ghost btn-xs justify-start w-full truncate",
                    isActive ? "btn-primary btn-active font-semibold" : "",
                    isBlocked ? "opacity-40 cursor-not-allowed" : "",
                  ].join(" ")}
                  data-blocked={isBlocked ? "true" : undefined}
                  onClick={() => handlePresetClick(preset.id)}
                >
                  {label}
                </button>
                <div className="text-xs text-base-content/70">
                  {diffTokens.length === 0 ? (
                    <span className="opacity-60">-</span>
                  ) : (
                    <div
                      className="tooltip tooltip-top w-full"
                      data-tip={describePresetDiff(preset.settings, t)}
                    >
                      <div className="flex flex-row gap-1 overflow-hidden whitespace-nowrap">
                        {diffTokens.slice(0, 3).map((token, index) => (
                          <span
                            key={`${token.kind}-${index}`}
                            className="badge badge-ghost badge-xs"
                          >
                            {token.short}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs shrink-0"
                  disabled={!canDeletePresets}
                  onClick={() => canDeletePresets && deletePreset(preset.id)}
                  aria-label={t("settings.presets.delete" as TranslationKey)}
                >
                  🗑
                </button>
              </div>
            );
          })}

          {hasUnsavedSlot && (
            <div
              className="grid w-full items-center gap-3"
              style={{ gridTemplateColumns: "7rem minmax(0,1fr) 2rem" }}
            >
              <button
                type="button"
                className={[
                  "btn btn-sm w-full truncate",
                  selectedId === "__unsaved__" ? "btn-primary btn-active" : "",
                ].join(" ")}
                disabled
              >
                {t("settings.presets.unsaved" as TranslationKey)}
              </button>
              <div className="flex-1 text-xs text-base-content/70">-</div>
              <button
                type="button"
                className="btn btn-ghost btn-xs shrink-0"
                disabled
              >
                🗑
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <div className="mb-2 text-sm font-semibold">
        {t("settings.presets.title")}
      </div>
      <div className="overflow-x-auto">
        <div className="join flex-nowrap">
          {presets.map((preset) => {
            const isActive = selectedId === preset.id;
            const isBlocked = !canSwitchPresets && !isActive;

            const label = getPresetDisplayName(preset, (key) => t(key));

            if (renamingPresetId === preset.id) {
              return (
                <input
                  key={preset.id}
                  ref={renameInputRef}
                  className="input input-sm join-item input-bordered"
                  defaultValue={preset.name ?? label}
                  onBlur={(e) => applyRenamePreset(preset.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyRenamePreset(
                        preset.id,
                        (e.target as HTMLInputElement).value,
                      );
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      (e.target as HTMLInputElement).blur();
                      cancelRenamePreset();
                    }
                  }}
                />
              );
            }

            return (
              <button
                key={preset.id}
                type="button"
                className={[
                  "btn btn-sm join-item",
                  isActive ? "btn-primary btn-active" : "",
                  isBlocked ? "opacity-40 cursor-not-allowed" : "",
                ].join(" ")}
                onClick={() => handlePresetClick(preset.id)}
                data-blocked={isBlocked ? "true" : undefined}
              >
                {label}
              </button>
            );
          })}
          {hasUnsavedSlot && (
            <button
              key="__unsaved__"
              type="button"
              className={[
                "btn btn-sm join-item",
                selectedId === "__unsaved__" ? "btn-primary btn-active" : "",
              ].join(" ")}
              // Unsaved slot is a temporary view and cannot be selected as a
              // normal preset; clicking is always a no-op.
              onClick={() => {}}
              disabled={!canSwitchPresets && selectedId !== "__unsaved__"}
            >
              {t("settings.presets.unsaved" as TranslationKey)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
