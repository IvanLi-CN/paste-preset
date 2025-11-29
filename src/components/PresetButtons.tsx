import { PRESETS } from "../lib/presets.ts";
import type { PresetId } from "../lib/types.ts";

interface PresetButtonsProps {
  selectedId: PresetId;
  onPresetSelect: (id: Exclude<PresetId, null>) => void;
}

export function PresetButtons(props: PresetButtonsProps) {
  const { selectedId, onPresetSelect } = props;

  return (
    <div className="mb-4">
      <div className="mb-2 text-sm font-semibold">Presets</div>
      <div className="join">
        {PRESETS.map((preset) => {
          const isActive = selectedId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              className={[
                "btn btn-sm join-item",
                isActive ? "btn-primary" : "btn-ghost",
              ].join(" ")}
              onClick={() => onPresetSelect(preset.id)}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
