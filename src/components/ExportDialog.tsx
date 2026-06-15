import { useState, useRef, useCallback, useEffect } from "react";
import { useEditor } from "../context/EditorContext";
import { Export, X } from "@phosphor-icons/react";

type ExportFormat = "png" | "jpeg" | "webp";

const formatOptions: { value: ExportFormat; label: string; mime: string }[] = [
  { value: "png", label: "PNG", mime: "image/png" },
  { value: "jpeg", label: "JPEG", mime: "image/jpeg" },
  { value: "webp", label: "WebP", mime: "image/webp" },
];

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ExportDialog({ open, onClose }: ExportDialogProps) {
  const { state, canvasActionsRef, dispatch } = useEditor();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const openTimestampRef = useRef(0);
  const [filename, setFilename] = useState("onyx_export");
  const [format, setFormat] = useState<ExportFormat>("png");
  const [quality, setQuality] = useState(92);
  const [estimatedSize, setEstimatedSize] = useState<string | null>(null);

  // Sync open state with <dialog>
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Reset state when dialog opens
      openTimestampRef.current = Date.now();
      setFilename(`onyx_${openTimestampRef.current.toString().slice(-5)}`);
      setFormat("png");
      setQuality(92);
      setEstimatedSize(null);
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Compute estimated file size when format/quality changes
  useEffect(() => {
    if (!open) return;
    const actions = canvasActionsRef.current;
    if (!actions) return;

    const timer = setTimeout(() => {
      const formatInfo = formatOptions.find((f) => f.value === format)!;
      const q = format === "png" ? 1.0 : quality / 100;
      const dataUrl = actions.exportImage(formatInfo.mime, q);
      if (dataUrl) {
        // dataUrl is "data:<mime>;base64,<data>" — the base64 portion is ~4/3× the binary size
        const base64 = dataUrl.split(",")[1];
        if (base64) {
          const bytes = Math.round((base64.length * 3) / 4);
          setEstimatedSize(formatFileSize(bytes));
        }
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [open, format, quality, canvasActionsRef]);

  const handleExport = useCallback(async () => {
    const actions = canvasActionsRef.current;
    if (!actions) return;

    const formatInfo = formatOptions.find((f) => f.value === format)!;
    const q = format === "png" ? 1.0 : quality / 100;
    const dataUrl = actions.exportImage(formatInfo.mime, q);
    if (!dataUrl) return;

    const fullFilename = `${filename}.${format === "jpeg" ? "jpg" : format}`;

    if (window.electronAPI) {
      const result = await window.electronAPI.saveFileAs(fullFilename);
      if (!result) return;
      await window.electronAPI.saveFile(dataUrl, result.filePath);
    } else {
      // Web fallback: download
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = fullFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    dispatch({ type: "MARK_SAVED" });
    onClose();
  }, [canvasActionsRef, format, quality, filename, dispatch, onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) onClose();
    },
    [onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [onClose],
  );

  return (
    <dialog
      ref={dialogRef}
      className="m-auto max-w-[100vw] max-h-[100vh] overflow-visible bg-transparent p-0 outline-none backdrop:bg-black/55 backdrop:backdrop-blur-sm open:animate-in open:fade-in open:slide-in-from-bottom-4 open:duration-250"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="w-[420px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-popover shadow-[0_24px_48px_-12px_rgba(0,0,0,0.25),inset_0_0_0_1px_rgba(255,255,255,0.04)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Export size={20} weight="duotone" />
            </div>
            <h2 className="m-0 text-sm font-semibold tracking-tight text-foreground">
              Export Image
            </h2>
          </div>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md border-none bg-transparent text-muted-foreground transition-all duration-150 hover:bg-accent/60 hover:text-foreground"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 p-5">
          {/* Filename */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium tracking-[0.01em] text-muted-foreground">
              Filename
            </label>
            <div className="flex items-center overflow-hidden rounded-lg border border-border transition-colors duration-200 focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15">
              <input
                type="text"
                className="flex-1 border-none bg-background px-3 py-2 text-[13px] text-foreground outline-none"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                spellCheck={false}
                autoComplete="off"
              />
              <span className="select-none border-l border-border bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                .{format === "jpeg" ? "jpg" : format}
              </span>
            </div>
          </div>

          {/* Format */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium tracking-[0.01em] text-muted-foreground">
              Format
            </label>
            <div className="flex gap-1.5">
              {formatOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`flex-1 rounded-lg border px-2 py-2 text-center text-xs font-medium transition-all duration-150 ${
                    format === opt.value
                      ? "border-primary bg-primary/15 text-primary font-semibold"
                      : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                  onClick={() => setFormat(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quality (only for lossy formats) */}
          {format !== "png" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium tracking-[0.01em] text-muted-foreground">
                Quality: {quality}%
              </label>
              <input
                type="range"
                min={1}
                max={100}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground opacity-60">
                <span>Smaller file</span>
                <span>Higher quality</span>
              </div>
            </div>
          )}

          {/* File size + dimensions preview */}
          <div className="flex gap-3 rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex flex-1 flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground opacity-80">
                Dimensions
              </span>
              <span className="tabular-nums text-[13px] font-semibold text-foreground">
                {state.image
                  ? `${state.image.width} × ${state.image.height}`
                  : "—"}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground opacity-80">
                Est. Size
              </span>
              <span className="tabular-nums text-[13px] font-semibold text-foreground">
                {estimatedSize ?? "Calculating…"}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-transparent px-4 py-2 text-[13px] font-medium leading-none text-muted-foreground transition-all duration-150 hover:bg-accent/50 hover:text-foreground disabled:cursor-default disabled:opacity-40"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border-none bg-primary px-4 py-2 text-[13px] font-medium leading-none text-primary-foreground shadow-[0_1px_3px_color-mix(in_srgb,var(--primary)_30%,transparent)] transition-all duration-150 hover:filter-[brightness(1.1)] hover:shadow-[0_2px_8px_color-mix(in_srgb,var(--primary)_40%,transparent)] active:scale-98 disabled:cursor-default disabled:opacity-40"
              onClick={handleExport}
              disabled={!filename.trim()}
            >
              <Export size={16} weight="bold" />
              Export
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
