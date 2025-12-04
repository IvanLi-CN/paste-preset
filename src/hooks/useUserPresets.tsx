import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { UserSettings } from "../lib/types.ts";
import type {
  PresetStorageMode,
  UserPresetRecord,
} from "../lib/userPresets.ts";
import {
  getInitialUserPresetsState,
  getNextCustomPresetName,
  userPresetsStorage,
} from "../lib/userPresets.ts";
import { normalizeUserSettings } from "../lib/userSettings.ts";

interface UserPresetsContextValue {
  mode: PresetStorageMode;
  presets: UserPresetRecord[];
  activePresetId: string | null;
  /**
   * Id of the preset that is currently being edited in place.
   * At most one preset may be in editing mode at any time.
   */
  editingPresetId: string | null;
  /**
   * Single temporary unsaved slot derived from a locked preset.
   * When non-null, preset switching is disabled until saved or cancelled.
   */
  unsavedSlot: { settings: UserSettings; sourceId: string } | null;

  setActivePresetId: (id: string) => void;
  beginEditPreset: (id: string) => void;
  applyEditPreset: (settings: UserSettings) => void;
  cancelEditPreset: () => void;
  beginUnsavedFromLocked: (
    lockedId: string,
    baseSettings: UserSettings,
  ) => void;
  applyUnsavedToNewPreset: (settings: UserSettings) => void;
  cancelUnsaved: () => void;
}

const UserPresetsContext = createContext<UserPresetsContextValue | undefined>(
  undefined,
);

export function UserPresetsProvider(props: { children: ReactNode }) {
  const { children } = props;

  // Initialize the presets state once per provider instance so the React tree
  // can rely on a stable in-memory snapshot during the session.
  const [initialState] = useState(getInitialUserPresetsState);

  const [mode, setMode] = useState<PresetStorageMode>(initialState.mode);
  const [presets, setPresets] = useState<UserPresetRecord[]>(
    initialState.presets,
  );

  const [activePresetId, setActivePresetIdState] = useState<string | null>(
    () => {
      // Prefer the canonical "original" preset when available so the initial
      // selection aligns with the default behaviour.
      const original = initialState.presets.find(
        (preset) => preset.id === "original",
      );
      if (original) return original.id;
      return initialState.presets[0]?.id ?? null;
    },
  );

  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [unsavedSlot, setUnsavedSlot] = useState<{
    settings: UserSettings;
    sourceId: string;
  } | null>(null);

  const setActivePresetId = useCallback(
    (id: string) => {
      // While editing or working with an unsaved slot in normal mode,
      // preset switching via the public API is disabled.
      if (mode === "normal" && (editingPresetId || unsavedSlot)) {
        return;
      }
      setActivePresetIdState(id);
    },
    [mode, editingPresetId, unsavedSlot],
  );

  const beginEditPreset = useCallback(
    (id: string) => {
      if (mode !== "normal") return;
      if (editingPresetId || unsavedSlot) return;

      const existing = presets.find((preset) => preset.id === id);
      if (!existing) return;

      setEditingPresetId(id);
    },
    [mode, editingPresetId, unsavedSlot, presets],
  );

  const applyEditPreset = useCallback(
    (settings: UserSettings) => {
      if (!editingPresetId) return;
      if (mode !== "normal") return;

      const normalizedSettings = normalizeUserSettings(settings);

      setPresets((current) => {
        const index = current.findIndex(
          (preset) => preset.id === editingPresetId,
        );
        if (index === -1) {
          return current;
        }

        const nextPresets = [...current];
        nextPresets[index] = {
          ...nextPresets[index],
          settings: normalizedSettings,
        };

        const result = userPresetsStorage.save(nextPresets);
        setMode(result.mode);
        return result.presets;
      });

      setEditingPresetId(null);
    },
    [editingPresetId, mode],
  );

  const cancelEditPreset = useCallback(() => {
    if (!editingPresetId) return;
    setEditingPresetId(null);
  }, [editingPresetId]);

  const beginUnsavedFromLocked = useCallback(
    (lockedId: string, baseSettings: UserSettings) => {
      if (mode !== "normal") return;
      if (unsavedSlot || editingPresetId) return;

      const sourcePreset = presets.find((preset) => preset.id === lockedId);
      if (!sourcePreset) return;

      setUnsavedSlot({
        settings: normalizeUserSettings(baseSettings),
        sourceId: lockedId,
      });
      // We keep activePresetId pointing at the locked preset so other parts
      // of the UI can continue to derive labels from it. The unsavedSlot flag
      // itself is used to gate interactions.
    },
    [mode, unsavedSlot, editingPresetId, presets],
  );

  const applyUnsavedToNewPreset = useCallback(
    (settings: UserSettings) => {
      if (!unsavedSlot) return;
      if (mode !== "normal") return;

      const normalizedSettings = normalizeUserSettings(settings);
      const newId = `user-${Date.now().toString(36)}`;

      setPresets((current) => {
        const name = getNextCustomPresetName(current);
        const newPreset: UserPresetRecord = {
          id: newId,
          name,
          kind: "user",
          settings: normalizedSettings,
        };

        const nextPresets = [...current, newPreset];
        const result = userPresetsStorage.save(nextPresets);
        setMode(result.mode);
        return result.presets;
      });

      setUnsavedSlot(null);
      setEditingPresetId(null);
      setActivePresetIdState(newId);
    },
    [mode, unsavedSlot],
  );

  const cancelUnsaved = useCallback(() => {
    if (!unsavedSlot) return;

    const { sourceId } = unsavedSlot;
    setUnsavedSlot(null);
    setEditingPresetId(null);

    if (sourceId) {
      setActivePresetIdState(sourceId);
    }
  }, [unsavedSlot]);

  const value = useMemo<UserPresetsContextValue>(
    () => ({
      mode,
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
    }),
    [
      mode,
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
    ],
  );

  return (
    <UserPresetsContext.Provider value={value}>
      {children}
    </UserPresetsContext.Provider>
  );
}

export function useUserPresets(): UserPresetsContextValue {
  const context = useContext(UserPresetsContext);
  if (!context) {
    throw new Error("useUserPresets must be used within a UserPresetsProvider");
  }
  return context;
}
