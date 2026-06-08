import { useCallback, useRef, useState } from "react";
import { useEditor } from "../context/EditorContext";

export function useLayerDrag() {
  const { state, updateLayer, selectLayer } = useEditor();
  const [resizing, setResizing] = useState<{ id: string; handle: string } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const dragStart = useRef<{ x: number; y: number; layerX: number; layerY: number; layerW: number; layerH: number } | null>(null);

  const hitTestLayer = useCallback(
    (canvasX: number, canvasY: number): { id: string; handle?: string } | null => {
      // Check for resize handles on the selected layer first
      const selected = state.layers.find((l) => l.id === state.selectedLayerId);
      if (selected && selected.type === "image") {
        const hs = 15 / state.zoom; // hit size
        const inRect = (px: number, py: number, rx: number, ry: number, s: number) => {
          return px >= rx - s && px <= rx + s && py >= ry - s && py <= ry + s;
        };
        const sx = selected.x;
        const sy = selected.y;
        const sw = selected.width;
        const sh = selected.height;
        const midX = sx + sw / 2;
        const midY = sy + sh / 2;

        const cx = selected.x + selected.width / 2;
        const cy = selected.y + selected.height / 2;
        const angle = (selected.rotation * Math.PI) / 180;
        
        // Unrotate pointer for hit testing
        const dx = canvasX - cx;
        const dy = canvasY - cy;
        const localX = cx + (dx * Math.cos(-angle) - dy * Math.sin(-angle));
        const localY = cy + (dx * Math.sin(-angle) + dy * Math.cos(-angle));

        if (inRect(localX, localY, sx, sy, hs)) return { id: selected.id, handle: "nw" };
        if (inRect(localX, localY, midX, sy, hs)) return { id: selected.id, handle: "n" };
        if (inRect(localX, localY, sx + sw, sy, hs)) return { id: selected.id, handle: "ne" };
        if (inRect(localX, localY, sx, midY, hs)) return { id: selected.id, handle: "w" };
        if (inRect(localX, localY, sx + sw, midY, hs)) return { id: selected.id, handle: "e" };
        if (inRect(localX, localY, sx, sy + sh, hs)) return { id: selected.id, handle: "sw" };
        if (inRect(localX, localY, midX, sy + sh, hs)) return { id: selected.id, handle: "s" };
        if (inRect(localX, localY, sx + sw, sy + sh, hs)) return { id: selected.id, handle: "se" };
      }

      // Check layers in reverse order (topmost first) for dragging
      for (let i = state.layers.length - 1; i >= 0; i--) {
        const l = state.layers[i];
        if (!l.visible) continue;

        let approxWidth = 0;
        let approxHeight = 0;

        if (l.type === "text") {
          approxWidth = l.text.length * l.fontSize * 0.6;
          approxHeight = l.fontSize * 1.2;
        } else if (l.type === "image") {
          approxWidth = l.width;
          approxHeight = l.height;
        }

        const cx = l.x + approxWidth / 2;
        const cy = l.y + approxHeight / 2;
        const angle = (l.rotation * Math.PI) / 180;
        
        const dx = canvasX - cx;
        const dy = canvasY - cy;
        const localX = cx + (dx * Math.cos(-angle) - dy * Math.sin(-angle));
        const localY = cy + (dx * Math.sin(-angle) + dy * Math.cos(-angle));

        if (
          localX >= l.x &&
          localX <= l.x + approxWidth &&
          localY >= l.y &&
          localY <= l.y + approxHeight
        ) {
          return { id: l.id };
        }
      }
      return null;
    },
    [state.layers, state.selectedLayerId, state.zoom],
  );

  const onPointerDown = useCallback(
    (canvasX: number, canvasY: number) => {
      const hit = hitTestLayer(canvasX, canvasY);
      if (hit) {
        selectLayer(hit.id);
        const l = state.layers.find((layer) => layer.id === hit.id);
        if (l) {
          dragStart.current = { x: canvasX, y: canvasY, layerX: l.x, layerY: l.y, layerW: l.type === "image" ? l.width : 0, layerH: l.type === "image" ? l.height : 0 };
          if (hit.handle) {
            setResizing({ id: hit.id, handle: hit.handle });
          } else {
            setDragging(hit.id);
          }
        }
        return true;
      }
      selectLayer(null);
      return false;
    },
    [hitTestLayer, selectLayer, state.layers],
  );

  const onPointerMove = useCallback(
    (canvasX: number, canvasY: number) => {
      if (!dragStart.current) return false;

      if (resizing) {
        const dx = canvasX - dragStart.current.x;
        const dy = canvasY - dragStart.current.y;
        let { layerX, layerY, layerW, layerH } = dragStart.current;
        let newX = layerX;
        let newY = layerY;
        let newW = layerW;
        let newH = layerH;

        const aspect = layerW / layerH;

        if (resizing.handle === "se") {
          newW = Math.max(20, layerW + dx);
          newH = newW / aspect;
        } else if (resizing.handle === "sw") {
          newW = Math.max(20, layerW - dx);
          newH = newW / aspect;
          newX = layerX + layerW - newW;
        } else if (resizing.handle === "ne") {
          newW = Math.max(20, layerW + dx);
          newH = newW / aspect;
          newY = layerY + layerH - newH;
        } else if (resizing.handle === "nw") {
          newW = Math.max(20, layerW - dx);
          newH = newW / aspect;
          newX = layerX + layerW - newW;
          newY = layerY + layerH - newH;
        } else if (resizing.handle === "e") {
          newW = Math.max(20, layerW + dx);
        } else if (resizing.handle === "w") {
          newW = Math.max(20, layerW - dx);
          newX = layerX + layerW - newW;
        } else if (resizing.handle === "s") {
          newH = Math.max(20, layerH + dy);
        } else if (resizing.handle === "n") {
          newH = Math.max(20, layerH - dy);
          newY = layerY + layerH - newH;
        }

        updateLayer(resizing.id, { x: newX, y: newY, width: newW, height: newH });
        return true;
      }

      if (dragging) {
        const dx = canvasX - dragStart.current.x;
        const dy = canvasY - dragStart.current.y;
        updateLayer(dragging, {
          x: dragStart.current.layerX + dx,
          y: dragStart.current.layerY + dy,
        });
        return true;
      }

      return false;
    },
    [dragging, resizing, updateLayer],
  );

  const onPointerUp = useCallback(() => {
    if (dragging || resizing) {
      setDragging(null);
      setResizing(null);
      dragStart.current = null;
      return true;
    }
    return false;
  }, [dragging, resizing]);

  return { dragging, hitTestLayer, onPointerDown, onPointerMove, onPointerUp };
}
