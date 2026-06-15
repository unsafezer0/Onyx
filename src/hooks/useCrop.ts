import { useState, useCallback, useRef } from "react";
import { useEditor } from "../context/EditorContext";

export function useCrop() {
  const { state, dispatch } = useEditor();
  const [isDragging, setIsDragging] = useState(false);
  const [dragHandle, setDragHandle] = useState<string | null>(null);
  const startRef = useRef<{
    x: number;
    y: number;
    crop: typeof state.crop;
  } | null>(null);

  const setCrop = useCallback(
    (changes: Partial<typeof state.crop>) => {
      dispatch({ type: "SET_CROP", payload: changes });
    },
    [dispatch],
  );

  const constrainToImage = useCallback(
    (x: number, y: number, w: number, h: number) => {
      const imgW = state.image?.width ?? 0;
      const imgH = state.image?.height ?? 0;
      let nx = Math.max(0, Math.min(x, imgW - w));
      let ny = Math.max(0, Math.min(y, imgH - h));
      let nw = Math.max(20, Math.min(w, imgW - nx));
      let nh = Math.max(20, Math.min(h, imgH - ny));
      return { x: nx, y: ny, width: nw, height: nh };
    },
    [state.image],
  );

  const onCropPointerDown = useCallback(
    (canvasX: number, canvasY: number, handle: string | null) => {
      setIsDragging(true);
      setDragHandle(handle);
      startRef.current = { x: canvasX, y: canvasY, crop: { ...state.crop } };
    },
    [state.crop],
  );

  const onCropPointerMove = useCallback(
    (canvasX: number, canvasY: number) => {
      if (!isDragging || !startRef.current) return;

      const dx = canvasX - startRef.current.x;
      const dy = canvasY - startRef.current.y;
      const prev = startRef.current.crop;

      if (!dragHandle) {
        // Move entire crop region
        const constrained = constrainToImage(
          prev.x + dx,
          prev.y + dy,
          prev.width,
          prev.height,
        );
        setCrop(constrained);
      } else {
        // Resize from handle
        let newX = prev.x;
        let newY = prev.y;
        let newW = prev.width;
        let newH = prev.height;

        if (dragHandle.includes("w")) {
          newX = prev.x + dx;
          newW = prev.width - dx;
        }
        if (dragHandle.includes("e")) {
          newW = prev.width + dx;
        }
        if (dragHandle.includes("n")) {
          newY = prev.y + dy;
          newH = prev.height - dy;
        }
        if (dragHandle.includes("s")) {
          newH = prev.height + dy;
        }

        if (newW < 20) {
          newW = 20;
        }
        if (newH < 20) {
          newH = 20;
        }

        const constrained = constrainToImage(newX, newY, newW, newH);
        setCrop(constrained);
      }
    },
    [isDragging, dragHandle, constrainToImage, setCrop],
  );

  const onCropPointerUp = useCallback(() => {
    setIsDragging(false);
    setDragHandle(null);
    startRef.current = null;
  }, []);

  return {
    isDragging,
    onCropPointerDown,
    onCropPointerMove,
    onCropPointerUp,
  };
}
