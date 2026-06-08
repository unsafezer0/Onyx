import { useState, useCallback, useRef } from "react";
import { useEditor, type ImageLayer } from "../context/EditorContext";

export function useLayerCrop() {
  const { state, setLayerCrop } = useEditor();
  const [isDragging, setIsDragging] = useState(false);
  const [dragHandle, setDragHandle] = useState<string | null>(null);
  const startRef = useRef<{ x: number; y: number; crop: typeof state.layerCrop } | null>(null);

  const constrainToImage = useCallback(
    (x: number, y: number, w: number, h: number) => {
      // The constraints are relative to the layer's original width and height!
      const selected = state.layers.find((l) => l.id === state.selectedLayerId) as ImageLayer;
      if (!selected) return { x, y, width: w, height: h };

      // Since x, y are absolute positions on the canvas, we should let them move freely
      // but constrain width and height. Actually, for a layer, cropping just means selecting a region.
      // Wait, if x, y are canvas coordinates, we just constrain w, h to not be negative or too small.
      let nw = Math.max(5, w);
      let nh = Math.max(5, h);
      return { x, y, width: nw, height: nh };
    },
    [state.layers, state.selectedLayerId],
  );

  const onLayerCropPointerDown = useCallback(
    (canvasX: number, canvasY: number, handle: string | null) => {
      setIsDragging(true);
      setDragHandle(handle);
      startRef.current = { x: canvasX, y: canvasY, crop: { ...state.layerCrop } };
    },
    [state.layerCrop],
  );

  const onLayerCropPointerMove = useCallback(
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
        setLayerCrop(constrained);
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

        if (newW < 5) { newW = 5; }
        if (newH < 5) { newH = 5; }

        const constrained = constrainToImage(newX, newY, newW, newH);
        setLayerCrop(constrained);
      }
    },
    [isDragging, dragHandle, constrainToImage, setLayerCrop],
  );

  const onLayerCropPointerUp = useCallback(() => {
    setIsDragging(false);
    setDragHandle(null);
    startRef.current = null;
  }, []);

  return {
    isLayerCropDragging: isDragging,
    onLayerCropPointerDown,
    onLayerCropPointerMove,
    onLayerCropPointerUp,
  };
}
