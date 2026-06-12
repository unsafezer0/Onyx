import { useCallback, useRef, useState } from "react";
import { useEditor } from "../context/EditorContext";

export interface Guide {
  axis: "x" | "y";
  position: number;
}

let _measureCtx: CanvasRenderingContext2D | null = null;
function getLayerBounds(l: any) {
  if (l.type === "image") {
    return { w: l.width, h: l.height };
  }
  if (l.type === "text") {
    if (!_measureCtx) {
      const c = document.createElement("canvas");
      _measureCtx = c.getContext("2d");
    }
    if (!_measureCtx) return { w: l.text.length * l.fontSize * 0.6, h: l.fontSize };
    _measureCtx.font = `${l.italic ? "italic " : ""}${l.bold ? "bold " : ""}${l.fontSize}px "${l.fontFamily}", sans-serif`;
    return { w: _measureCtx.measureText(l.text).width, h: l.fontSize };
  }
  return { w: 0, h: 0 };
}

export function useLayerDrag() {
  const { state, updateLayer, selectLayer, snapshotForUndo } = useEditor();
  const [resizing, setResizing] = useState<{ id: string; handle: string } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const dragStart = useRef<{ x: number; y: number; layerX: number; layerY: number; layerW: number; layerH: number; xTargets?: number[]; yTargets?: number[]; } | null>(null);

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

        const { w: approxWidth, h: approxHeight } = getLayerBounds(l);

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
          // Snapshot for undo BEFORE the drag/resize begins
          snapshotForUndo();
          
          let xTargets: number[] = [];
          let yTargets: number[] = [];
          if (state.image && !hit.handle) {
            xTargets = [0, state.image.width / 2, state.image.width];
            yTargets = [0, state.image.height / 2, state.image.height];
            for (const other of state.layers) {
              if (other.id === hit.id || !other.visible) continue;
              const { w: oW, h: oH } = getLayerBounds(other);
              xTargets.push(other.x, other.x + oW / 2, other.x + oW);
              yTargets.push(other.y, other.y + oH / 2, other.y + oH);
            }
          }

          dragStart.current = { 
            x: canvasX, 
            y: canvasY, 
            layerX: l.x, 
            layerY: l.y, 
            layerW: l.type === "image" ? l.width : 0, 
            layerH: l.type === "image" ? l.height : 0,
            xTargets,
            yTargets
          };
          
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
    [hitTestLayer, selectLayer, state.layers, snapshotForUndo, state.image],
  );

  const onPointerMove = useCallback(
    (canvasX: number, canvasY: number) => {
      if (!dragStart.current) return false;

      if (resizing) {
        const dx = canvasX - dragStart.current.x;
        const dy = canvasY - dragStart.current.y;
        const { layerX, layerY, layerW, layerH } = dragStart.current;
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
        let newX = dragStart.current.layerX + dx;
        let newY = dragStart.current.layerY + dy;
        
        const layer = state.layers.find(l => l.id === dragging);
        if (layer && state.image) {
          const { w: lW, h: lH } = getLayerBounds(layer);
          
          const snapThreshold = 5 / state.zoom;
          const activeGuides: Guide[] = [];

          const xTargets = dragStart.current.xTargets || [];
          const yTargets = dragStart.current.yTargets || [];

          // Points on dragged layer to check
          const myXPoints = [newX, newX + lW / 2, newX + lW];
          const myYPoints = [newY, newY + lH / 2, newY + lH];

          // Check X snap
          let snappedX = false;
          for (const mx of myXPoints) {
            if (snappedX) break;
            for (const tx of xTargets) {
              if (Math.abs(mx - tx) < snapThreshold) {
                newX += (tx - mx);
                activeGuides.push({ axis: "x", position: tx });
                snappedX = true;
                break;
              }
            }
          }

          // Check Y snap
          let snappedY = false;
          for (const my of myYPoints) {
            if (snappedY) break;
            for (const ty of yTargets) {
              if (Math.abs(my - ty) < snapThreshold) {
                newY += (ty - my);
                activeGuides.push({ axis: "y", position: ty });
                snappedY = true;
                break;
              }
            }
          }
          
          setGuides(activeGuides);
        }

        updateLayer(dragging, { x: newX, y: newY });
        return true;
      }

      return false;
    },
    [dragging, resizing, updateLayer, state.image, state.zoom, state.layers],
  );

  const onPointerUp = useCallback(() => {
    setGuides([]);
    if (dragging || resizing) {
      setDragging(null);
      setResizing(null);
      dragStart.current = null;
      return true;
    }
    return false;
  }, [dragging, resizing]);

  return { dragging, guides, hitTestLayer, onPointerDown, onPointerMove, onPointerUp };
}
