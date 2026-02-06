import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useElementSize } from "../hooks/useElementSize.ts";
import { useTranslation } from "../i18n";
import {
  clampScale,
  computeFitScale,
  computeMinScale,
  getNextModeOnDoubleActivate,
  MAX_PREVIEW_SCALE,
  scaleForMode,
  type ViewerMode,
} from "../lib/fullscreenImagePreview.ts";
import type { ImageInfo } from "../lib/types.ts";

export type FullscreenImagePreviewProps = {
  open: boolean;
  image: ImageInfo;
  title: string;
  onClose: () => void;
};

type Offset = { x: number; y: number };
type Point = { x: number; y: number };

const ZOOM_STEP = 1.2;
const ROTATE_STEP_DEG = 90;

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalizeRotation(deg: number): number {
  const normalized = deg % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function FullscreenImagePreview(props: FullscreenImagePreviewProps) {
  const { open, image, title, onClose } = props;
  const { t } = useTranslation();

  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const previousBodyOverflowRef = useRef<string>("");
  const lastOpenRef = useRef(false);
  const lastUrlRef = useRef<string | null>(null);

  const { ref: viewportRef, size: viewportSize } =
    useElementSize<HTMLDivElement>();

  const [rotationDeg, setRotationDeg] = useState(0);
  const normalizedRotation = useMemo(
    () => normalizeRotation(rotationDeg),
    [rotationDeg],
  );
  const isQuarterTurn = normalizedRotation === 90 || normalizedRotation === 270;

  const fitScale = useMemo(() => {
    return computeFitScale(
      { width: viewportSize.width, height: viewportSize.height },
      {
        // When rotated 90/270 degrees, the bounding box swaps width/height.
        width: isQuarterTurn ? image.height : image.width,
        height: isQuarterTurn ? image.width : image.height,
      },
    );
  }, [
    image.height,
    image.width,
    isQuarterTurn,
    viewportSize.height,
    viewportSize.width,
  ]);

  const minScale = useMemo(() => computeMinScale(fitScale), [fitScale]);

  const [mode, setMode] = useState<ViewerMode>("fit");
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">(
    "loading",
  );

  const canPan = open && scale > fitScale;
  const canZoomOut = open && scale > minScale + 1e-6;
  const canZoomIn = open && scale < MAX_PREVIEW_SCALE - 1e-6;

  const pointersRef = useRef<Map<number, Point>>(new Map());
  const pinchRef = useRef<{ startDistance: number; startScale: number } | null>(
    null,
  );
  const dragRef = useRef<{ pointerId: number; last: Point } | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    previousBodyOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflowRef.current;

      const previous = previouslyFocusedRef.current;
      if (previous && document.contains(previous)) {
        previous.focus();
      }
    };
  }, [open, onClose]);

  useEffect(() => {
    const wasOpen = lastOpenRef.current;
    const previousUrl = lastUrlRef.current;
    lastOpenRef.current = open;
    lastUrlRef.current = image.url;

    if (!open) {
      return;
    }

    const openedNow = !wasOpen;
    const urlChanged = previousUrl !== image.url;
    if (!openedNow && !urlChanged) {
      return;
    }

    setMode("fit");
    setScale(fitScale);
    setOffset({ x: 0, y: 0 });
    setRotationDeg(0);
    setRetryCount(0);
    setLoadState("loading");
    pointersRef.current.clear();
    pinchRef.current = null;
    dragRef.current = null;
    setIsDragging(false);
  }, [fitScale, image.url, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (mode === "fit") {
      setScale(fitScale);
      setOffset({ x: 0, y: 0 });
      return;
    }

    setScale((current) => clampScale(current, fitScale));
  }, [fitScale, mode, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (scale <= fitScale) {
      setOffset({ x: 0, y: 0 });
    }
  }, [fitScale, open, scale]);

  const resetOffset = useCallback(() => {
    setOffset({ x: 0, y: 0 });
  }, []);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const applyScale = useCallback(
    (nextScale: number) => {
      setScale(clampScale(nextScale, fitScale));
      setMode("custom");
    },
    [fitScale],
  );

  const handleZoomIn = useCallback(() => {
    applyScale(scale * ZOOM_STEP);
  }, [applyScale, scale]);

  const handleZoomOut = useCallback(() => {
    applyScale(scale / ZOOM_STEP);
  }, [applyScale, scale]);

  const handleFit = useCallback(() => {
    setMode("fit");
    setScale(fitScale);
    resetOffset();
  }, [fitScale, resetOffset]);

  const handleActualSize = useCallback(() => {
    setMode("oneToOne");
    setScale(1);
    resetOffset();
  }, [resetOffset]);

  const handleDoubleClick = useCallback(() => {
    const nextMode = getNextModeOnDoubleActivate(mode);
    const nextScale = scaleForMode(nextMode, fitScale, scale);
    setMode(nextMode);
    setScale(nextScale);
    resetOffset();
  }, [fitScale, mode, resetOffset, scale]);

  const canResetRotation = open && normalizedRotation !== 0;

  const handleRotateLeft = useCallback(() => {
    setRotationDeg((current) => current - ROTATE_STEP_DEG);
  }, []);

  const handleRotateRight = useCallback(() => {
    setRotationDeg((current) => current + ROTATE_STEP_DEG);
  }, []);

  const handleResetRotation = useCallback(() => {
    setRotationDeg(0);
  }, []);

  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      if (!open) {
        return;
      }

      if (event.cancelable) {
        event.preventDefault();
      }
      event.stopPropagation();

      const direction = event.deltaY < 0 ? 1 : -1;
      const factor = direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      applyScale(scale * factor);
    },
    [applyScale, open, scale],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!open) {
        return;
      }

      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      const point = { x: event.clientX, y: event.clientY };
      pointersRef.current.set(event.pointerId, point);
      event.currentTarget.setPointerCapture(event.pointerId);

      const pointers = [...pointersRef.current.values()];
      if (pointers.length === 2) {
        pinchRef.current = {
          startDistance: distance(pointers[0], pointers[1]),
          startScale: scale,
        };
        dragRef.current = null;
        setIsDragging(false);
        return;
      }

      if (pointers.length === 1 && canPan) {
        dragRef.current = { pointerId: event.pointerId, last: point };
        setIsDragging(true);
      }
    },
    [canPan, open, scale],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!open) {
        return;
      }

      if (!pointersRef.current.has(event.pointerId)) {
        return;
      }

      pointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });

      if (pointersRef.current.size === 2 && pinchRef.current) {
        const [a, b] = [...pointersRef.current.values()];
        const nextDistance = distance(a, b);
        const { startDistance, startScale } = pinchRef.current;
        const ratio = startDistance > 0 ? nextDistance / startDistance : 1;
        setScale(clampScale(startScale * ratio, fitScale));
        setMode("custom");
        return;
      }

      const dragging = dragRef.current;
      if (!dragging || !canPan || pointersRef.current.size !== 1) {
        return;
      }

      if (dragging.pointerId !== event.pointerId) {
        return;
      }

      const currentPoint = pointersRef.current.get(event.pointerId);
      if (!currentPoint) {
        return;
      }

      const dx = currentPoint.x - dragging.last.x;
      const dy = currentPoint.y - dragging.last.y;
      dragRef.current = { pointerId: dragging.pointerId, last: currentPoint };
      setOffset((current) => ({ x: current.x + dx, y: current.y + dy }));
    },
    [canPan, fitScale, open],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!open) {
        return;
      }

      pointersRef.current.delete(event.pointerId);

      if (dragRef.current?.pointerId === event.pointerId) {
        dragRef.current = null;
        setIsDragging(false);
      }

      if (pointersRef.current.size < 2) {
        pinchRef.current = null;
      }
    },
    [open],
  );

  const handleRetry = useCallback(() => {
    setRetryCount((current) => current + 1);
    setLoadState("loading");
    setMode("fit");
    setScale(fitScale);
    resetOffset();
  }, [fitScale, resetOffset]);

  if (!open) {
    return null;
  }

  if (typeof document === "undefined") {
    return null;
  }

  const cursorClassName = canPan
    ? isDragging
      ? "cursor-grabbing"
      : "cursor-grab"
    : "cursor-default";

  return createPortal(
    <dialog className="modal p-0" open>
      <div className="modal-box flex h-[100dvh] max-h-none w-[100dvw] max-w-none flex-col rounded-none p-0">
        <div className="flex items-center justify-between gap-3 border-b border-base-300 bg-base-100 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{title}</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="join">
              <button
                type="button"
                className="btn btn-outline btn-xs join-item"
                onClick={handleZoomOut}
                disabled={!canZoomOut}
              >
                {t("preview.viewer.zoomOut")}
              </button>
              <button
                type="button"
                className="btn btn-outline btn-xs join-item"
                onClick={handleZoomIn}
                disabled={!canZoomIn}
              >
                {t("preview.viewer.zoomIn")}
              </button>
              <button
                type="button"
                className="btn btn-outline btn-xs join-item"
                onClick={handleFit}
              >
                {t("preview.viewer.fit")}
              </button>
              <button
                type="button"
                className="btn btn-outline btn-xs join-item"
                onClick={handleActualSize}
              >
                {t("preview.viewer.actualSize")}
              </button>
            </div>
            <div className="join">
              <button
                type="button"
                className="btn btn-outline btn-xs join-item"
                onClick={handleRotateLeft}
              >
                {t("preview.viewer.rotateLeft")}
              </button>
              <button
                type="button"
                className="btn btn-outline btn-xs join-item"
                onClick={handleRotateRight}
              >
                {t("preview.viewer.rotateRight")}
              </button>
              <button
                type="button"
                className="btn btn-outline btn-xs join-item"
                onClick={handleResetRotation}
                disabled={!canResetRotation}
              >
                {t("preview.viewer.rotateReset")}
              </button>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              className="btn btn-ghost btn-xs btn-circle"
              aria-label={t("preview.viewer.closeAria")}
              onClick={handleClose}
            >
              ✕
            </button>
          </div>
        </div>

        <section
          ref={viewportRef}
          className={[
            "relative flex flex-1 items-center justify-center overflow-hidden bg-base-200",
            cursorClassName,
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label={title}
          onClick={(event) => {
            if (event.target !== event.currentTarget) {
              return;
            }
            handleClose();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleClose();
            }
          }}
          onDoubleClick={handleDoubleClick}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ touchAction: "none" }}
        >
          <img
            key={`${image.url}-${retryCount}`}
            src={image.url}
            width={image.width}
            height={image.height}
            alt={image.sourceName ?? title}
            draggable={false}
            className={[
              "max-w-none select-none",
              loadState === "error" ? "opacity-0" : "opacity-100",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              transformOrigin: "center center",
              transform: `translate3d(${offset.x}px, ${offset.y}px, 0) rotate(${normalizedRotation}deg) scale(${scale})`,
              transition:
                mode === "fit" || mode === "oneToOne"
                  ? "transform 120ms ease-out"
                  : undefined,
            }}
            onLoad={() => setLoadState("loaded")}
            onError={() => setLoadState("error")}
          />

          {loadState !== "loaded" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-base-200/80">
              {loadState === "loading" ? (
                <div className="flex flex-col items-center gap-3">
                  <span className="loading loading-spinner loading-md" />
                  <span className="text-sm text-base-content/80">
                    {t("preview.viewer.loading")}
                  </span>
                </div>
              ) : (
                <div className="pointer-events-auto flex flex-col items-center gap-3">
                  <p className="text-sm text-base-content/80">
                    {t("preview.viewer.error")}
                  </p>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={handleRetry}
                  >
                    {t("preview.viewer.retry")}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <form method="dialog" className="modal-backdrop">
        <button
          type="submit"
          aria-label={t("preview.viewer.closeAria")}
          onClick={handleClose}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleClose();
            }
          }}
        >
          close
        </button>
      </form>
    </dialog>,
    document.body,
  );
}
