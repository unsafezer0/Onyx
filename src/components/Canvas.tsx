import { useRef, useEffect, useCallback, useState } from "react";
import { useEditor, buildFilterString, type ImageLayer } from "../context/EditorContext";
import { useLayerDrag } from "../hooks/useLayerDrag";
import { useCrop } from "../hooks/useCrop";
import { useLayerCrop } from "../hooks/useLayerCrop";
import {
  getCheckerboardPattern,
  renderLayers,
  pruneOverlayCache,
  type OverlayImageCache,
} from "../utils/renderUtils";

export default function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    state,
    setZoom,
    setPan,
    applyCrop,
    setTool,
    selectLayer,
    updateLayer,
    canvasActionsRef,
  } = useEditor();
  const { onPointerDown, onPointerMove, onPointerUp, hitTestLayer, guides } =
    useLayerDrag();
  const { onCropPointerDown, onCropPointerMove, onCropPointerUp } = useCrop();
  const {
    onLayerCropPointerDown,
    onLayerCropPointerMove,
    onLayerCropPointerUp,
  } = useLayerCrop();
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const overlayImages = useRef<OverlayImageCache>(new Map());
  const rafId = useRef<number>(0);

  // Stable refs for state and imageEl — avoids recreating callbacks on every state change.
  const stateRef = useRef(state);
  const imageElRef = useRef(imageEl);
  const guidesRef = useRef(guides);
  useEffect(() => {
    stateRef.current = state;
    imageElRef.current = imageEl;
    guidesRef.current = guides;
  });

  // Cache the resolved --primary CSS variable; re-read only on theme changes.
  const primaryColorRef = useRef<string>("");
  useEffect(() => {
    const update = () => {
      primaryColorRef.current =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--primary")
          .trim() || "white";
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  // Load image element when dataUrl changes
  const imageDataUrl = state.image?.dataUrl ?? null;
  useEffect(() => {
    if (!imageDataUrl) return;
    const img = new Image();
    img.onload = () => setImageEl(img);
    img.src = imageDataUrl;
    return () => { setImageEl(null); };
  }, [imageDataUrl]);

  // Stable ref for triggering re-render from inside render callback
  const scheduleRenderRef = useRef<() => void>(() => {});

  // Render canvas (coalesced via rAF) — reads from refs for stability.
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const curImageEl = imageElRef.current;
    const s = stateRef.current;
    if (!canvas || !ctx || !curImageEl || !s.image) return;

    const dpr = window.devicePixelRatio || 1;
    const container = containerRef.current;
    if (!container) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    ctx.scale(dpr, dpr);

    // Clear with cached checkerboard pattern
    ctx.fillStyle = getCheckerboardPattern(ctx);
    ctx.fillRect(0, 0, cw, ch);

    // Calculate centered position with zoom
    const imgW = s.image.width * s.zoom;
    const imgH = s.image.height * s.zoom;
    const offsetX = (cw - imgW) / 2 + s.panX;
    const offsetY = (ch - imgH) / 2 + s.panY;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(s.zoom, s.zoom);

    // Draw image with filters
    const filterStr = buildFilterString(s.filters);
    ctx.filter = filterStr;
    ctx.drawImage(curImageEl, 0, 0, s.image.width, s.image.height);
    ctx.filter = "none";

    // Draw layers using shared utility, clipping to the image bounds
    const showSelection = s.activeTool === "select" || s.activeTool === "text";
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, s.image.width, s.image.height);
    ctx.clip();
    
    renderLayers(ctx, s.layers, overlayImages.current, {
      selectedLayerId: showSelection ? s.selectedLayerId : null,
      zoom: s.zoom,
      primaryColor: primaryColorRef.current,
      onImageLoad: () => scheduleRenderRef.current(),
    });
    
    ctx.restore();

    // Prune overlay cache of deleted layers (#9)
    const activeIds = new Set(s.layers.map((l) => l.id));
    pruneOverlayCache(overlayImages.current, activeIds);

    // Draw crop overlay
    if (s.crop.active && s.activeTool === "crop") {
      drawCropOverlay(ctx, s.image.width, s.image.height, s.crop, primaryColorRef.current);
    }

    // Draw layer crop overlay
    if (s.layerCrop.active && s.activeTool === "cropLayer") {
      drawLayerCropOverlay(ctx, s.layerCrop, primaryColorRef.current);
    }

    // Draw snapping guides
    const activeGuides = guidesRef.current;
    if (activeGuides && activeGuides.length > 0 && (s.activeTool === "select" || s.activeTool === "text")) {
      ctx.save();
      ctx.strokeStyle = primaryColorRef.current;
      ctx.lineWidth = 1 / s.zoom;
      ctx.setLineDash([5 / s.zoom, 5 / s.zoom]);
      ctx.beginPath();
      for (const guide of activeGuides) {
        if (guide.axis === "x") {
          ctx.moveTo(guide.position, 0);
          ctx.lineTo(guide.position, s.image.height);
        } else {
          ctx.moveTo(0, guide.position);
          ctx.lineTo(s.image.width, guide.position);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }, []); // stable — reads everything from refs

  const scheduleRender = useCallback(() => {
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(render);
  }, [render]);
  useEffect(() => { scheduleRenderRef.current = scheduleRender; }, [scheduleRender]);

  // Re-schedule render whenever state or imageEl or guides change.
  useEffect(() => {
    scheduleRender();
    return () => cancelAnimationFrame(rafId.current);
  }, [scheduleRender, state, imageEl, guides]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => scheduleRender());
    ro.observe(container);
    return () => ro.disconnect();
  }, [scheduleRender]);



  // Register canvas actions — reads from refs for stability.
  useEffect(() => {
    canvasActionsRef.current = {
      exportImage: (
        format: string = "image/png",
        quality: number = 0.92,
      ): string | null => {
        const curImageEl = imageElRef.current;
        const s = stateRef.current;
        if (!curImageEl || !s.image) return null;
        const offscreen = document.createElement("canvas");
        offscreen.width = s.image.width;
        offscreen.height = s.image.height;
        const ctx = offscreen.getContext("2d")!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // Apply filters
        ctx.filter = buildFilterString(s.filters);
        ctx.drawImage(curImageEl, 0, 0);
        ctx.filter = "none";

        // Draw layers using shared utility (no selection outlines), clipping to the image bounds
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, s.image.width, s.image.height);
        ctx.clip();
        renderLayers(ctx, s.layers, overlayImages.current);
        ctx.restore();

        return offscreen.toDataURL(format, quality);
      },

      applyCrop: () => {
        const curImageEl = imageElRef.current;
        const s = stateRef.current;
        if (!curImageEl || !s.image || !s.crop.active) return;
        const { x, y, width, height } = s.crop;
        const offscreen = document.createElement("canvas");
        offscreen.width = width;
        offscreen.height = height;
        const ctx = offscreen.getContext("2d")!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.filter = buildFilterString(s.filters);
        ctx.drawImage(curImageEl, x, y, width, height, 0, 0, width, height);
        applyCrop(offscreen.toDataURL("image/png"), width, height);
      },

      applyLayerCrop: () => {
        const s = stateRef.current;
        const selected = s.layers.find((l) => l.id === s.selectedLayerId);
        if (!selected || selected.type !== "image" || !s.layerCrop.active)
          return;

        const cached = overlayImages.current.get(selected.id);
        if (!cached) return;

        const il = selected as ImageLayer;
        const cx = il.cropX ?? 0;
        const cy = il.cropY ?? 0;
        const cw = il.cropWidth ?? cached.img.naturalWidth;
        const ch = il.cropHeight ?? cached.img.naturalHeight;

        const { x, y, width, height } = s.layerCrop;
        const scaleX = cw / il.width;
        const scaleY = ch / il.height;

        const newCropX = cx + (x - il.x) * scaleX;
        const newCropY = cy + (y - il.y) * scaleY;
        const newCropW = width * scaleX;
        const newCropH = height * scaleY;

        setTool("select");
        updateLayer(il.id, {
          cropX: newCropX,
          cropY: newCropY,
          cropWidth: newCropW,
          cropHeight: newCropH,
          originalWidth: cached.img.naturalWidth,
          originalHeight: cached.img.naturalHeight,
          x,
          y,
          width,
          height,
        });
      },
    };

    return () => {
      canvasActionsRef.current = null;
    };
  }, [applyCrop, setTool, updateLayer, canvasActionsRef]);



  // Stable toCanvasCoords — reads state from ref to avoid recreating on every pan/zoom.
  const toCanvasCoords = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current;
      const s = stateRef.current;
      if (!container || !s.image) return { x: 0, y: 0 };
      const rect = container.getBoundingClientRect();
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const imgW = s.image.width * s.zoom;
      const imgH = s.image.height * s.zoom;
      const offsetX = (cw - imgW) / 2 + s.panX;
      const offsetY = (ch - imgH) / 2 + s.panY;
      return {
        x: (clientX - rect.left - offsetX) / s.zoom,
        y: (clientY - rect.top - offsetY) / s.zoom,
      };
    },
    [], // stable — reads from stateRef
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const { x, y } = toCanvasCoords(e.clientX, e.clientY);
      const hit = hitTestLayer(x, y);
      if (hit) {
        selectLayer(hit.id);
        setTool("text");
      }
    },
    [toCanvasCoords, hitTestLayer, selectLayer, setTool],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const { x, y } = toCanvasCoords(e.clientX, e.clientY);

      if (state.activeTool === "pan") {
        isPanning.current = true;
        panStart.current = {
          x: e.clientX,
          y: e.clientY,
          panX: state.panX,
          panY: state.panY,
        };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }

      if (state.activeTool === "select" || state.activeTool === "text") {
        onPointerDown(x, y);
      }

      if (state.activeTool === "crop" && state.crop.active) {
        let handle: string | null = null;
        let isInside = false;
        const hs = 15 / state.zoom;
        const { x: cx, y: cy, width: cw, height: ch } = state.crop;

        const inRect = (
          px: number,
          py: number,
          rx: number,
          ry: number,
          s: number,
        ) => {
          return px >= rx - s && px <= rx + s && py >= ry - s && py <= ry + s;
        };

        if (inRect(x, y, cx, cy, hs)) handle = "nw";
        else if (inRect(x, y, cx + cw, cy, hs)) handle = "ne";
        else if (inRect(x, y, cx, cy + ch, hs)) handle = "sw";
        else if (inRect(x, y, cx + cw, cy + ch, hs)) handle = "se";
        else if (x >= cx && x <= cx + cw && y >= cy && y <= cy + ch) {
          isInside = true;
        }

        if (handle || isInside) {
          onCropPointerDown(x, y, handle);
        }
      }

      if (state.activeTool === "cropLayer" && state.layerCrop.active) {
        let handle: string | null = null;
        let isInside = false;
        const hs = 15 / state.zoom;
        const { x: cx, y: cy, width: cw, height: ch } = state.layerCrop;

        const inRect = (
          px: number,
          py: number,
          rx: number,
          ry: number,
          s: number,
        ) => {
          return px >= rx - s && px <= rx + s && py >= ry - s && py <= ry + s;
        };

        if (inRect(x, y, cx, cy, hs)) handle = "nw";
        else if (inRect(x, y, cx + cw, cy, hs)) handle = "ne";
        else if (inRect(x, y, cx, cy + ch, hs)) handle = "sw";
        else if (inRect(x, y, cx + cw, cy + ch, hs)) handle = "se";
        else if (x >= cx && x <= cx + cw && y >= cy && y <= cy + ch) {
          isInside = true;
        }

        if (handle || isInside) {
          onLayerCropPointerDown(x, y, handle);
        }
      }
    },
    [
      state.activeTool,
      state.crop,
      state.layerCrop,
      state.zoom,
      state.panX,
      state.panY,
      toCanvasCoords,
      onPointerDown,
      onCropPointerDown,
      onLayerCropPointerDown,
    ],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (isPanning.current) {
        const dx = e.clientX - panStart.current.x;
        const dy = e.clientY - panStart.current.y;
        setPan(panStart.current.panX + dx, panStart.current.panY + dy);
        return;
      }

      const { x, y } = toCanvasCoords(e.clientX, e.clientY);
      if (state.activeTool === "select" || state.activeTool === "text") {
        onPointerMove(x, y);
      }
      if (state.activeTool === "crop") {
        onCropPointerMove(x, y);
      }
      if (state.activeTool === "cropLayer") {
        onLayerCropPointerMove(x, y);
      }
    },
    [
      state.activeTool,
      toCanvasCoords,
      onPointerMove,
      onCropPointerMove,
      onLayerCropPointerMove,
      setPan,
    ],
  );

  const handlePointerUp = useCallback(
    () => {
      if (isPanning.current) {
        isPanning.current = false;
        return;
      }
      onPointerUp();
      onCropPointerUp();
      onLayerCropPointerUp();
    },
    [onPointerUp, onCropPointerUp, onLayerCropPointerUp],
  );

  // Wheel zoom batched via rAF to avoid 60+ dispatches/sec on trackpads.
  const pendingZoom = useRef<number | null>(null);
  const zoomRafId = useRef<number>(0);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const base = pendingZoom.current ?? stateRef.current.zoom;
      pendingZoom.current = base * delta;

      cancelAnimationFrame(zoomRafId.current);
      zoomRafId.current = requestAnimationFrame(() => {
        if (pendingZoom.current !== null) {
          setZoom(pendingZoom.current);
          pendingZoom.current = null;
        }
      });
    },
    [setZoom],
  );

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden bg-[#1a1a1e]"
      style={{
        cursor:
          state.activeTool === "pan"
            ? "grab"
            : state.activeTool === "crop"
              ? "crosshair"
              : "default",
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      />
      {/* Zoom indicator */}
      <div className="absolute bottom-3 right-3 rounded-lg bg-black/60 px-2.5 py-1 text-xs tabular-nums text-white/70 backdrop-blur-sm">
        {Math.round(state.zoom * 100)}%
      </div>
    </div>
  );
}



function drawCropOverlay(
  ctx: CanvasRenderingContext2D,
  imgW: number,
  imgH: number,
  crop: { x: number; y: number; width: number; height: number },
  primaryColor: string,
) {
  // Dim outside area
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, 0, imgW, crop.y);
  ctx.fillRect(0, crop.y, crop.x, crop.height);
  ctx.fillRect(
    crop.x + crop.width,
    crop.y,
    imgW - crop.x - crop.width,
    crop.height,
  );
  ctx.fillRect(0, crop.y + crop.height, imgW, imgH - crop.y - crop.height);

  // Crop border
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(crop.x, crop.y, crop.width, crop.height);

  // Rule-of-thirds
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 0.5;
  for (let i = 1; i <= 2; i++) {
    const xLine = crop.x + (crop.width * i) / 3;
    const yLine = crop.y + (crop.height * i) / 3;
    ctx.beginPath();
    ctx.moveTo(xLine, crop.y);
    ctx.lineTo(xLine, crop.y + crop.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(crop.x, yLine);
    ctx.lineTo(crop.x + crop.width, yLine);
    ctx.stroke();
  }

  // Corner handles
  const hs = 8;
  ctx.fillStyle = primaryColor;
  const corners = [
    [crop.x, crop.y],
    [crop.x + crop.width, crop.y],
    [crop.x, crop.y + crop.height],
    [crop.x + crop.width, crop.y + crop.height],
  ];
  for (const [cx, cy] of corners) {
    ctx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs);
  }
}

function drawLayerCropOverlay(
  ctx: CanvasRenderingContext2D,
  crop: { x: number; y: number; width: number; height: number },
  primaryColor: string,
) {
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(crop.x, crop.y, crop.width, crop.height);
  ctx.setLineDash([]);

  // Corner handles
  const hs = 8;
  ctx.fillStyle = primaryColor;
  const corners = [
    [crop.x, crop.y],
    [crop.x + crop.width, crop.y],
    [crop.x, crop.y + crop.height],
    [crop.x + crop.width, crop.y + crop.height],
  ];
  for (const [cx, cy] of corners) {
    ctx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs);
  }
}
