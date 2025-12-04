import { useUserPresets } from "../hooks/useUserPresets.tsx";
import type { TranslationKey } from "../i18n";
import { useTranslation } from "../i18n";
import { PRESETS } from "../lib/presets.ts";

interface PresetButtonsProps {
  selectedId: string | null;
  onPresetSelect: (id: string) => void;
}

export function PresetButtons(props: PresetButtonsProps) {
  const { selectedId, onPresetSelect } = props;
  const { t } = useTranslation();
  const { presets, editingPresetId, unsavedSlot } = useUserPresets();

  const canSwitchPresets = !editingPresetId && !unsavedSlot;
  const hasUnsavedSlot = Boolean(unsavedSlot);

  return (
    <div className="mb-4">
      <div className="mb-2 text-sm font-semibold">
        {t("settings.presets.title")}
      </div>
      <div className="join">
        {presets.map((preset) => {
          const isActive = selectedId === preset.id;
          const isDisabled = !canSwitchPresets && !isActive;

          const label =
            preset.kind === "system"
              ? (() => {
                  const presetConfig = PRESETS.find(
                    (item) => item.id === preset.id,
                  );
                  if (presetConfig) {
                    return t(presetConfig.labelKey as TranslationKey);
                  }
                  return preset.name;
                })()
              : preset.name;

          return (
            <button
              key={preset.id}
              type="button"
              className={[
                "btn btn-sm join-item",
                isActive ? "btn-primary btn-active" : "",
              ].join(" ")}
              onClick={() => canSwitchPresets && onPresetSelect(preset.id)}
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
