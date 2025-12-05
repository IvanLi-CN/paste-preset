import { useEffect, useRef } from "react";
import { useUserPresets } from "../hooks/useUserPresets.tsx";
import type { TranslationKey } from "../i18n";
import { useTranslation } from "../i18n";
import { getPresetDisplayName } from "../lib/userPresets.ts";

interface PresetButtonsProps {
  selectedId: string | null;
  onPresetSelect: (id: string) => void;
}

export function PresetButtons(props: PresetButtonsProps) {
  const { selectedId, onPresetSelect } = props;
  const { t } = useTranslation();
  const {
    presets,
    editingPresetId,
    unsavedSlot,
    renamingPresetId,
    beginRenamingPreset,
    applyRenamePreset,
    cancelRenamePreset,
  } = useUserPresets();

  const canSwitchPresets =
    !editingPresetId && !unsavedSlot && !renamingPresetId;
  const hasUnsavedSlot = Boolean(unsavedSlot);

  const renameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (renamingPresetId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingPresetId]);

  return (
    <div className="mb-4">
      <div className="mb-2 text-sm font-semibold">
        {t("settings.presets.title")}
      </div>
      <div className="join">
        {presets.map((preset) => {
          const isActive = selectedId === preset.id;
          const isDisabled = !canSwitchPresets && !isActive;

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
              ].join(" ")}
              onClick={() => canSwitchPresets && onPresetSelect(preset.id)}
              onDoubleClick={() =>
                canSwitchPresets && beginRenamingPreset(preset.id)
              }
              disabled={isDisabled}
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
  );
}
