import type { ReactNode } from "react";
import { createContext, useContext, useMemo, useState } from "react";
import type {
  PresetStorageMode,
  UserPresetRecord,
} from "../lib/userPresets.ts";
import { getInitialUserPresetsState } from "../lib/userPresets.ts";

interface UserPresetsContextValue {
  mode: PresetStorageMode;
  presets: UserPresetRecord[];
  activePresetId: string | null;
  setActivePresetId: (id: string) => void;
}

const UserPresetsContext = createContext<UserPresetsContextValue | undefined>(
  undefined,
);

export function UserPresetsProvider(props: { children: ReactNode }) {
  const { children } = props;

  // Initialize the presets state once per provider instance so the React tree
  // can rely on a stable in-memory snapshot during the session.
  const [initialState] = useState(getInitialUserPresetsState);

  const [activePresetId, setActivePresetId] = useState<string | null>(() => {
    // Prefer the canonical "original" preset when available so the initial
    // selection aligns with the default behaviour.
    const original = initialState.presets.find(
      (preset) => preset.id === "original",
    );
    if (original) return original.id;
    return initialState.presets[0]?.id ?? null;
  });

  const value = useMemo<UserPresetsContextValue>(
    () => ({
      mode: initialState.mode,
      presets: initialState.presets,
      activePresetId,
      setActivePresetId,
    }),
    [initialState.mode, initialState.presets, activePresetId],
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
