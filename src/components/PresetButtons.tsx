import type { TranslationKey } from "../i18n";
import { useTranslation } from "../i18n";
import { PRESETS } from "../lib/presets.ts";
import type { PresetId } from "../lib/types.ts";

interface PresetButtonsProps {
  selectedId: PresetId;
  onPresetSelect: (id: Exclude<PresetId, null>) => void;
}

export function PresetButtons(props: PresetButtonsProps) {
  const { selectedId, onPresetSelect } = props;
  const { t } = useTranslation();

  return (
    <div className="mb-4">
      <div className="mb-2 text-sm font-semibold">
        {t("settings.presets.title")}
      </div>
      <div className="join">
        {PRESETS.map((preset) => {
          const isActive = selectedId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              className={[
                "btn btn-sm join-item",
                isActive ? "btn-primary btn-active" : "",
              ].join(" ")}
              onClick={() => onPresetSelect(preset.id)}
            >
              {t(preset.labelKey as TranslationKey)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
