import type { Layer, TextLayer, ImageLayer } from "../context/EditorContext";



export interface OverlayImageEntry {
  url: string;
  img: HTMLImageElement;
}

export type OverlayImageCache = Map<string, OverlayImageEntry>;



let cachedPattern: CanvasPattern | null = null;

/**
 * Returns a reusable checkerboard CanvasPattern.
 * The pattern is created once and cached for the lifetime of the session.
 */
export function getCheckerboardPattern(ctx: CanvasRenderingContext2D): CanvasPattern {
  if (cachedPattern) return cachedPattern;

  const size = 12;
  const tile = document.createElement("canvas");
  tile.width = size * 2;
  tile.height = size * 2;
  const tCtx = tile.getContext("2d")!;

  tCtx.fillStyle = "#1e1e22";
  tCtx.fillRect(0, 0, size * 2, size * 2);
  tCtx.fillStyle = "#2a2a2e";
  tCtx.fillRect(size, 0, size, size);
  tCtx.fillRect(0, size, size, size);

  cachedPattern = ctx.createPattern(tile, "repeat")!;
  return cachedPattern;
}



export interface RenderLayersOptions {
  /** When set, draws selection outlines on the matching layer. */
  selectedLayerId?: string | null;
  /** Current zoom level — used to scale selection outlines. */
  zoom?: number;
  /** Resolved CSS `--primary` color value. */
  primaryColor?: string;
  /** Callback fired when a newly-encountered image finishes loading. */
  onImageLoad?: () => void;
}

/**
 * Renders all visible layers onto the given canvas context.
 * Shared between the live canvas display and the lossless export path.
 */
export function renderLayers(
  ctx: CanvasRenderingContext2D,
  layers: readonly Layer[],
  overlayCache: OverlayImageCache,
  options: RenderLayersOptions = {},
) {
  const { selectedLayerId, zoom = 1, primaryColor, onImageLoad } = options;

  for (const l of layers) {
    if (!l.visible) continue;
    ctx.save();
    ctx.translate(l.x, l.y);
    if (l.rotation) ctx.rotate((l.rotation * Math.PI) / 180);
    ctx.globalAlpha = l.opacity;

    if (l.type === "text") {
      renderTextLayer(ctx, l, { selectedLayerId, zoom, primaryColor });
    } else if (l.type === "image") {
      renderImageLayer(ctx, l, overlayCache, { selectedLayerId, zoom, primaryColor, onImageLoad });
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}



function renderTextLayer(
  ctx: CanvasRenderingContext2D,
  l: TextLayer,
  opts: Pick<RenderLayersOptions, "selectedLayerId" | "zoom" | "primaryColor">,
) {
  const { selectedLayerId, zoom = 1, primaryColor } = opts;

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

  // Selection outline
  if (selectedLayerId === l.id && primaryColor) {
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 1.5 / zoom;
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    ctx.strokeRect(
      -4 / zoom,
      -4 / zoom,
      metrics.width + 8 / zoom,
      textHeight + 8 / zoom,
    );
    ctx.setLineDash([]);
  }
}



function renderImageLayer(
  ctx: CanvasRenderingContext2D,
  l: ImageLayer,
  overlayCache: OverlayImageCache,
  opts: RenderLayersOptions,
) {
  const { selectedLayerId, zoom = 1, primaryColor, onImageLoad } = opts;

  let cached = overlayCache.get(l.id);
  if (!cached || cached.url !== l.dataUrl) {
    const img = new Image();
    img.src = l.dataUrl;
    cached = { url: l.dataUrl, img };
    overlayCache.set(l.id, cached);
    if (!img.complete) {
      img.onload = () => onImageLoad?.();
      return; // Don't draw until loaded
    }
  }

  if (!cached.img.complete) return;

  const cx = l.cropX ?? 0;
  const cy = l.cropY ?? 0;
  const cw = l.cropWidth ?? cached.img.naturalWidth;
  const ch = l.cropHeight ?? cached.img.naturalHeight;
  const radius = l.borderRadius ?? 0;

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

  // Selection outline + resize handles
  if (selectedLayerId === l.id && primaryColor) {
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2 / zoom;
    ctx.setLineDash([5 / zoom, 5 / zoom]);
    ctx.strokeRect(0, 0, l.width, l.height);
    ctx.setLineDash([]);

    const hs = 8 / zoom;
    ctx.fillStyle = primaryColor;
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



/**
 * Derives a MIME type and quality from a file extension.
 */
export function formatFromExtension(ext: string): { mime: string; quality: number } {
  switch (ext.toLowerCase()) {
    case "jpg":
    case "jpeg":
      return { mime: "image/jpeg", quality: 0.92 };
    case "webp":
      return { mime: "image/webp", quality: 0.92 };
    default:
      return { mime: "image/png", quality: 1.0 };
  }
}
