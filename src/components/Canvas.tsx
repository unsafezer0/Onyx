import { useRef, useEffect, useCallback, useState } from "react";
import { useEditor, buildFilterString } from "../context/EditorContext";
import { useLayerDrag } from "../hooks/useLayerDrag";
import { useCrop } from "../hooks/useCrop";
import { useLayerCrop } from "../hooks/useLayerCrop";

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
  } = useEditor();
  const { onPointerDown, onPointerMove, onPointerUp, hitTestLayer } =
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
  const overlayImages = useRef<
    Map<string, { url: string; img: HTMLImageElement }>
  >(new Map());

  // Load image element when dataUrl changes
  useEffect(() => {
    if (!state.image) {
      setImageEl(null);
      return;
    }
    const img = new Image();
    img.onload = () => setImageEl(img);
    img.src = state.image.dataUrl;
  }, [state.image?.dataUrl]);

  // Render canvas
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !imageEl || !state.image) return;

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

    // Clear
    ctx.clearRect(0, 0, cw, ch);

    // Draw checkerboard background
    drawCheckerboard(ctx, cw, ch);

    // Calculate centered position with zoom
    const imgW = state.image.width * state.zoom;
    const imgH = state.image.height * state.zoom;
    const offsetX = (cw - imgW) / 2 + state.panX;
    const offsetY = (ch - imgH) / 2 + state.panY;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(state.zoom, state.zoom);

    // Draw image with filters
    const filterStr = buildFilterString(state.filters);
    ctx.filter = filterStr;
    ctx.drawImage(imageEl, 0, 0, state.image.width, state.image.height);
    ctx.filter = "none";

    // Draw layers
    for (const l of state.layers) {
      if (!l.visible) continue;
      ctx.save();
      ctx.translate(l.x, l.y);
      if (l.rotation) ctx.rotate((l.rotation * Math.PI) / 180);
      ctx.globalAlpha = l.opacity;

      if (l.type === "text") {
        ctx.font = `${l.italic ? "italic " : ""}${l.bold ? "bold " : ""}${l.fontSize}px "${l.fontFamily}", sans-serif`;
        ctx.textBaseline = "top";

        const metrics = ctx.measureText(l.text);
        const textHeight = l.fontSize;

        if (l.backgroundColor) {
          ctx.fillStyle = l.backgroundColor;
          ctx.fillRect(-4, -4, metrics.width + 8, textHeight + 8);
        }

        ctx.fillStyle = l.color;
        ctx.fillText(l.text, 0, textHeight * 0.1);

        if (l.strokeColor && l.strokeWidth) {
          ctx.strokeStyle = l.strokeColor;
          ctx.lineWidth = l.strokeWidth;
          ctx.strokeText(l.text, 0, textHeight * 0.1);
        }

        // Draw selection outline
        if (state.selectedLayerId === l.id) {
          const primaryColor =
            getComputedStyle(document.documentElement)
              .getPropertyValue("--primary")
              .trim() || "white";
          ctx.strokeStyle = primaryColor;
          ctx.lineWidth = 1.5 / state.zoom;
          ctx.setLineDash([4 / state.zoom, 4 / state.zoom]);
          ctx.strokeRect(
            -4 / state.zoom,
            -4 / state.zoom,
            metrics.width + 8 / state.zoom,
            textHeight + 8 / state.zoom,
          );
          ctx.setLineDash([]);
        }
      } else if (l.type === "image") {
        let cached = overlayImages.current.get(l.id);
        if (!cached || cached.url !== l.dataUrl) {
          const img = new Image();
          img.src = l.dataUrl;
          img.onload = () => render();
          cached = { url: l.dataUrl, img };
          overlayImages.current.set(l.id, cached);
        }

        if (cached.img.complete) {
          const cx = (l as any).cropX ?? 0;
          const cy = (l as any).cropY ?? 0;
          const cw = (l as any).cropWidth ?? cached.img.naturalWidth;
          const ch = (l as any).cropHeight ?? cached.img.naturalHeight;
          const radius = (l as any).borderRadius || 0;

          if (radius > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(0, 0, l.width, l.height, radius);
            ctx.clip();
            ctx.drawImage(cached.img, cx, cy, cw, ch, 0, 0, l.width, l.height);
            ctx.restore();
          } else {
            ctx.drawImage(cached.img, cx, cy, cw, ch, 0, 0, l.width, l.height);
          }
        }

        if (state.selectedLayerId === l.id && state.activeTool === "select") {
          const primaryColor =
            getComputedStyle(document.documentElement)
              .getPropertyValue("--primary")
              .trim() || "white";
          ctx.strokeStyle = `hsl(${primaryColor})`;
          ctx.lineWidth = 2 / state.zoom;
          ctx.setLineDash([5 / state.zoom, 5 / state.zoom]);
          ctx.strokeRect(0, 0, l.width, l.height);
          ctx.setLineDash([]);

          if (l.type === "image") {
            const hs = 8 / state.zoom;
            ctx.fillStyle = `hsl(${primaryColor})`;
            ctx.fillRect(-hs / 2, -hs / 2, hs, hs);
            ctx.fillRect(l.width / 2 - hs / 2, -hs / 2, hs, hs);
            ctx.fillRect(l.width - hs / 2, -hs / 2, hs, hs);
            ctx.fillRect(-hs / 2, l.height / 2 - hs / 2, hs, hs);
            ctx.fillRect(l.width - hs / 2, l.height / 2 - hs / 2, hs, hs);
            ctx.fillRect(-hs / 2, l.height - hs / 2, hs, hs);
            ctx.fillRect(l.width / 2 - hs / 2, l.height - hs / 2, hs, hs);
            ctx.fillRect(l.width - hs / 2, l.height - hs / 2, hs, hs);
          }
        }
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Draw crop overlay
    if (state.crop.active && state.activeTool === "crop") {
      drawCropOverlay(ctx, state.image.width, state.image.height, state.crop);
    }

    // Draw layer crop overlay
    if (state.layerCrop.active && state.activeTool === "cropLayer") {
      drawLayerCropOverlay(ctx, state.layerCrop);
    }

    ctx.restore();
  }, [imageEl, state]);

  useEffect(() => {
    render();
  }, [render]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => render());
    ro.observe(container);
    return () => ro.disconnect();
  }, [render]);

  // Mouse → canvas coords
  const toCanvasCoords = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current;
      if (!container || !state.image) return { x: 0, y: 0 };
      const rect = container.getBoundingClientRect();
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const imgW = state.image.width * state.zoom;
      const imgH = state.image.height * state.zoom;
      const offsetX = (cw - imgW) / 2 + state.panX;
      const offsetY = (ch - imgH) / 2 + state.panY;
      return {
        x: (clientX - rect.left - offsetX) / state.zoom,
        y: (clientY - rect.top - offsetY) / state.zoom,
      };
    },
    [state.image, state.zoom, state.panX, state.panY],
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
        const hs = 15 / state.zoom; // slightly larger hit area for easier grabbing
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
      state.crop.active,
      state.layerCrop.active,
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
    (_e: React.PointerEvent) => {
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

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(state.zoom * delta);
    },
    [state.zoom, setZoom],
  );

  // Export function exposed via ref-like pattern
  useEffect(() => {
    // Attach export function to window for IPC access
    (window as any).__oynx_export = (
      format: string = "image/png",
      quality: number = 0.92,
    ): string | null => {
      if (!imageEl || !state.image) return null;
      const offscreen = document.createElement("canvas");
      offscreen.width = state.image.width;
      offscreen.height = state.image.height;
      const ctx = offscreen.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Apply filters
      ctx.filter = buildFilterString(state.filters);
      ctx.drawImage(imageEl, 0, 0);
      ctx.filter = "none";

      // Draw layers
      for (const l of state.layers) {
        if (!l.visible) continue;
        ctx.save();
        ctx.translate(l.x, l.y);
        if (l.rotation) ctx.rotate((l.rotation * Math.PI) / 180);
        ctx.globalAlpha = l.opacity;

        if (l.type === "text") {
          ctx.font = `${l.italic ? "italic " : ""}${l.bold ? "bold " : ""}${l.fontSize}px "${l.fontFamily}", sans-serif`;
          ctx.textBaseline = "top";

          const metrics = ctx.measureText(l.text);
          const textHeight = l.fontSize;

          if (l.backgroundColor) {
            ctx.fillStyle = l.backgroundColor;
            ctx.fillRect(-4, -4, metrics.width + 8, textHeight + 8);
          }

          ctx.fillStyle = l.color;
          ctx.fillText(l.text, 0, textHeight * 0.1);

          if (l.strokeColor && l.strokeWidth) {
            ctx.strokeStyle = l.strokeColor;
            ctx.lineWidth = l.strokeWidth;
            ctx.strokeText(l.text, 0, textHeight * 0.1);
          }
        } else if (l.type === "image") {
          let cached = overlayImages.current.get(l.id);
          if (cached && cached.img.complete) {
            const cx = (l as any).cropX ?? 0;
            const cy = (l as any).cropY ?? 0;
            const cw = (l as any).cropWidth ?? cached.img.naturalWidth;
            const ch = (l as any).cropHeight ?? cached.img.naturalHeight;
            const radius = (l as any).borderRadius || 0;

            if (radius > 0) {
              ctx.save();
              ctx.beginPath();
              ctx.roundRect(0, 0, l.width, l.height, radius);
              ctx.clip();
              ctx.drawImage(cached.img, cx, cy, cw, ch, 0, 0, l.width, l.height);
              ctx.restore();
            } else {
              ctx.drawImage(cached.img, cx, cy, cw, ch, 0, 0, l.width, l.height);
            }
          }
        }

        ctx.globalAlpha = 1;
        ctx.restore();
      }

      return offscreen.toDataURL(format, quality);
    };

    // Attach crop apply function
    (window as any).__oynx_applyCrop = () => {
      if (!imageEl || !state.image || !state.crop.active) return;
      const { x, y, width, height } = state.crop;
      const offscreen = document.createElement("canvas");
      offscreen.width = width;
      offscreen.height = height;
      const ctx = offscreen.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.filter = buildFilterString(state.filters);
      ctx.drawImage(imageEl, x, y, width, height, 0, 0, width, height);
      applyCrop(offscreen.toDataURL("image/png"), width, height);
    };

    (window as any).__oynx_applyLayerCrop = () => {
      const selected = state.layers.find((l) => l.id === state.selectedLayerId);
      if (!selected || selected.type !== "image" || !state.layerCrop.active)
        return;

      const cached = overlayImages.current.get(selected.id);
      if (!cached) return;

      const cx = (selected as any).cropX ?? 0;
      const cy = (selected as any).cropY ?? 0;
      const cw = (selected as any).cropWidth ?? cached.img.naturalWidth;
      const ch = (selected as any).cropHeight ?? cached.img.naturalHeight;

      const { x, y, width, height } = state.layerCrop;
      const scaleX = cw / selected.width;
      const scaleY = ch / selected.height;

      const newCropX = cx + (x - selected.x) * scaleX;
      const newCropY = cy + (y - selected.y) * scaleY;
      const newCropW = width * scaleX;
      const newCropH = height * scaleY;

      setTool("select");
      updateLayer(selected.id, {
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
    };

    return () => {
      delete (window as any).__oynx_export;
      delete (window as any).__oynx_applyCrop;
      delete (window as any).__oynx_applyLayerCrop;
    };
  }, [imageEl, state, applyCrop, setTool, updateLayer]);

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

function drawCheckerboard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const size = 12;
  const c1 = "#1e1e22";
  const c2 = "#2a2a2e";
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      ctx.fillStyle = (x / size + y / size) % 2 === 0 ? c1 : c2;
      ctx.fillRect(x, y, size, size);
    }
  }
}

function drawCropOverlay(
  ctx: CanvasRenderingContext2D,
  imgW: number,
  imgH: number,
  crop: { x: number; y: number; width: number; height: number },
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
  const primaryColor =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--primary")
      .trim() || "white";
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
) {
  const primaryColor =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--primary")
      .trim() || "white";
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
