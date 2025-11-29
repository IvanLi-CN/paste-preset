import { DEFAULT_OPTIONS } from "../lib/presets.ts";
import type { ProcessingOptions, ResizeMode } from "../lib/types.ts";
import { PresetButtons } from "./PresetButtons.tsx";

interface SettingsPanelProps {
  options: ProcessingOptions;
  onOptionsChange: (next: ProcessingOptions) => void;
}

export function SettingsPanel(props: SettingsPanelProps) {
  const { options, onOptionsChange } = props;

  const handlePresetSelect = (
    presetId: NonNullable<ProcessingOptions["presetId"]>,
  ) => {
    const presetDefaults = DEFAULT_OPTIONS;
    onOptionsChange({
      ...options,
      presetId,
      targetWidth: presetDefaults.targetWidth,
      targetHeight: presetDefaults.targetHeight,
      quality: presetDefaults.quality,
    });
  };

  const handleNumericChange = (
    key: "targetWidth" | "targetHeight",
    value: string,
  ) => {
    const parsed = Number.parseInt(value, 10);
    onOptionsChange({
      ...options,
      [key]: Number.isNaN(parsed) ? null : parsed,
    });
  };

  const handleResizeModeChange = (mode: ResizeMode) => {
    onOptionsChange({
      ...options,
      resizeMode: mode,
    });
  };

  const handleOutputFormatChange = (
    value: ProcessingOptions["outputFormat"],
  ) => {
    onOptionsChange({
      ...options,
      outputFormat: value,
    });
  };

  const handleQualityChange = (value: string) => {
    const asNumber = Number.parseFloat(value);
    onOptionsChange({
      ...options,
      quality: Number.isNaN(asNumber) ? null : asNumber,
    });
  };

  const showQuality =
    options.outputFormat === "image/jpeg" ||
    options.outputFormat === "image/webp";

  return (
    <aside className="space-y-6">
      <section className="card bg-base-200">
        <div className="card-body">
          <h2 className="card-title text-lg">Settings</h2>
          <p className="text-sm text-base-content/70">
            Configure how your pasted images will be resized and exported.
          </p>

          <PresetButtons
            selectedId={options.presetId}
            onPresetSelect={handlePresetSelect}
          />

          <div className="space-y-4">
            <div>
              <div className="mb-2 text-sm font-semibold">Resolution</div>
              <div className="flex gap-2">
                <label className="form-control w-1/2">
                  <div className="label">
                    <span className="label-text text-xs">Width (px)</span>
                  </div>
                  <input
                    type="number"
                    min={1}
                    placeholder="Auto"
                    className="input input-sm input-bordered"
                    value={options.targetWidth ?? ""}
                    onChange={(event) =>
                      handleNumericChange("targetWidth", event.target.value)
                    }
                  />
                </label>
                <label className="form-control w-1/2">
                  <div className="label">
                    <span className="label-text text-xs">Height (px)</span>
                  </div>
                  <input
                    type="number"
                    min={1}
                    placeholder="Auto"
                    className="input input-sm input-bordered"
                    value={options.targetHeight ?? ""}
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
                  onChange={(event) =>
                    onOptionsChange({
                      ...options,
                      lockAspectRatio: event.target.checked,
                    })
                  }
                />
                <span>Lock aspect ratio</span>
              </label>
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold">Resize mode</div>
              <div className="join join-vertical lg:join-horizontal">
                {(["fit", "fill", "stretch"] satisfies ResizeMode[]).map(
                  (mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={[
                        "btn btn-xs join-item",
                        options.resizeMode === mode
                          ? "btn-outline btn-primary"
                          : "btn-ghost",
                      ].join(" ")}
                      onClick={() => handleResizeModeChange(mode)}
                    >
                      {mode === "fit" && "Fit"}
                      {mode === "fill" && "Fill (crop)"}
                      {mode === "stretch" && "Stretch"}
                    </button>
                  ),
                )}
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold">Output</div>
              <div className="flex flex-col gap-3">
                <label className="form-control">
                  <div className="label">
                    <span className="label-text text-xs">Format</span>
                  </div>
                  <select
                    className="select select-sm select-bordered"
                    value={options.outputFormat}
                    onChange={(event) =>
                      handleOutputFormatChange(
                        event.target.value as ProcessingOptions["outputFormat"],
                      )
                    }
                  >
                    <option value="auto">Auto (source)</option>
                    <option value="image/jpeg">JPEG</option>
                    <option value="image/png">PNG</option>
                    <option value="image/webp">WebP</option>
                  </select>
                </label>

                {showQuality && (
                  <label className="form-control">
                    <div className="label flex justify-between">
                      <span className="label-text text-xs">Quality</span>
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
                    onChange={(event) =>
                      onOptionsChange({
                        ...options,
                        stripMetadata: event.target.checked,
                      })
                    }
                  />
                  <span>Strip metadata (EXIF, etc.)</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="card bg-base-100">
        <div className="card-body space-y-2 text-sm">
          <h3 className="font-semibold">About</h3>
          <p className="text-base-content/70">
            PastePreset runs entirely in your browser. Images never leave your
            device. Paste a screenshot or drop a photo on the right to get
            started.
          </p>
        </div>
      </section>
    </aside>
  );
}
