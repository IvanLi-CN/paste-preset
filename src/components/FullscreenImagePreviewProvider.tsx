import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ImageInfo } from "../lib/types.ts";
import { FullscreenImagePreview } from "./FullscreenImagePreview.tsx";

export type OpenImagePreviewOptions = {
  image: ImageInfo;
  title: string;
};

type PreviewState = OpenImagePreviewOptions | null;

type FullscreenImagePreviewContextValue = {
  openImagePreview: (options: OpenImagePreviewOptions) => void;
  closeImagePreview: () => void;
  isOpen: boolean;
};

const FullscreenImagePreviewContext =
  createContext<FullscreenImagePreviewContextValue | null>(null);

export function FullscreenImagePreviewProvider(props: { children: ReactNode }) {
  const { children } = props;
  const [state, setState] = useState<PreviewState>(null);

  const openImagePreview = useCallback((options: OpenImagePreviewOptions) => {
    setState({ image: options.image, title: options.title });
  }, []);

  const closeImagePreview = useCallback(() => {
    setState(null);
  }, []);

  const value = useMemo<FullscreenImagePreviewContextValue>(
    () => ({
      openImagePreview,
      closeImagePreview,
      isOpen: state !== null,
    }),
    [closeImagePreview, openImagePreview, state],
  );

  return (
    <FullscreenImagePreviewContext.Provider value={value}>
      {children}
      {state && (
        <FullscreenImagePreview
          open
          image={state.image}
          title={state.title}
          onClose={closeImagePreview}
        />
      )}
    </FullscreenImagePreviewContext.Provider>
  );
}

export function useFullscreenImagePreview(): FullscreenImagePreviewContextValue {
  const value = useContext(FullscreenImagePreviewContext);
  if (!value) {
    throw new Error(
      "useFullscreenImagePreview must be used within FullscreenImagePreviewProvider",
    );
  }
  return value;
}
