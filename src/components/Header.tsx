import { useEditor } from "../context/EditorContext";
import { useCallback } from "react";
import ThemeToggle from "./ThemeToggle";
import {
  ArrowCounterClockwise,
  ArrowClockwise,
  FloppyDisk,
  FolderOpen,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  Check,
  X,
  Export,
} from "@phosphor-icons/react";

export default function Header() {
  const { state, undo, redo, canUndo, canRedo, setZoom, cancelCrop, dispatch } =
    useEditor();

  const handleOpen = useCallback(async () => {
    const result = await window.electronAPI?.openFile();
    if (!result) return;
    const img = new Image();
    img.onload = () => {
      dispatch({
        type: "LOAD_IMAGE",
        payload: {
          dataUrl: result.dataUrl,
          width: img.naturalWidth,
          height: img.naturalHeight,
          filePath: result.filePath,
          fileName: result.fileName,
        },
      });
    };
    img.src = result.dataUrl;
  }, [dispatch]);

  const handleSave = useCallback(async () => {
    const exportFn = (window as any).__oynx_export;
    if (!exportFn || !state.image) return;
    const dataUrl = exportFn("image/png", 1);
    if (!dataUrl) return;

    if (state.image.filePath) {
      await window.electronAPI?.saveFile(dataUrl, state.image.filePath);
      dispatch({ type: "MARK_SAVED" });
    } else {
      const result = await window.electronAPI?.saveFileAs(dataUrl);
      if (result) {
        dispatch({ type: "MARK_SAVED" });
      }
    }
  }, [state.image, dispatch]);

  const handleExport = useCallback(async () => {
    const exportFn = (window as any).__oynx_export;
    if (!exportFn) return;
    const dataUrl = exportFn("image/png", 1);
    if (!dataUrl) return;
    const result = await window.electronAPI?.saveFileAs(dataUrl);
    if (result) {
      dispatch({ type: "MARK_SAVED" });
    }
  }, [dispatch]);

  const handleCropApply = useCallback(() => {
    const cropFn = (window as any).__oynx_applyCrop;
    if (cropFn) cropFn();
  }, []);

  return (
    <header className="relative z-10 flex w-full items-center justify-between border-b border-border bg-card/50 px-4 py-2 backdrop-blur-sm">
      {/* Left: Title */}
      <div className="flex items-center px-1">
        <span className="text-sm font-bold tracking-tight text-foreground">
          Onyx
        </span>
      </div>

      {/* Center: Toolbar actions */}
      <div className="flex items-center gap-1">
        {/* File operations */}
        <ToolbarButton
          icon={<FolderOpen size={15} />}
          label="Open (Ctrl+O)"
          onClick={handleOpen}
        />
        <ToolbarButton
          icon={<FloppyDisk size={15} />}
          label="Save (Ctrl+S)"
          onClick={handleSave}
          disabled={!state.image}
        />
        <ToolbarButton
          icon={<Export size={15} />}
          label="Export (Ctrl+E)"
          onClick={handleExport}
          disabled={!state.image}
        />

        <div className="mx-1.5 h-4 w-px bg-border" />

        {/* Undo/Redo */}
        <ToolbarButton
          icon={<ArrowCounterClockwise size={15} />}
          label="Undo (Ctrl+Z)"
          onClick={undo}
          disabled={!canUndo}
        />
        <ToolbarButton
          icon={<ArrowClockwise size={15} />}
          label="Redo (Ctrl+Shift+Z)"
          onClick={redo}
          disabled={!canRedo}
        />

        <div className="mx-1.5 h-4 w-px bg-border" />

        {/* Zoom */}
        <ToolbarButton
          icon={<MagnifyingGlassMinus size={15} />}
          label="Zoom Out"
          onClick={() => setZoom(state.zoom * 0.9)}
          disabled={!state.image}
        />
        <span className="min-w-[3rem] text-center text-[11px] tabular-nums text-muted-foreground">
          {Math.round(state.zoom * 100)}%
        </span>
        <ToolbarButton
          icon={<MagnifyingGlassPlus size={15} />}
          label="Zoom In"
          onClick={() => setZoom(state.zoom * 1.1)}
          disabled={!state.image}
        />

        {/* Crop actions */}
        {state.crop.active && (
          <>
            <div className="mx-1.5 h-4 w-px bg-border" />
            <ToolbarButton
              icon={<Check size={15} weight="bold" />}
              label="Apply Crop"
              onClick={handleCropApply}
              accent
            />
            <ToolbarButton
              icon={<X size={15} />}
              label="Cancel Crop"
              onClick={cancelCrop}
            />
          </>
        )}
      </div>

      {/* Right: Theme toggle */}
      <ThemeToggle />
    </header>
  );
}

function ToolbarButton({
  icon,
  label,
  onClick,
  disabled,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="group relative flex items-center justify-center">
      <button
        onClick={onClick}
        disabled={disabled}
        className={`flex h-8 w-8 items-center justify-center rounded-md transition-all duration-150 ${
          accent
            ? "bg-primary/20 text-primary hover:bg-primary/30"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        } disabled:opacity-30 disabled:hover:bg-transparent`}
      >
        {icon}
      </button>
      {!disabled && (
        <div className="pointer-events-none absolute left-1/2 top-full z-[100] mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[10px] font-medium text-popover-foreground shadow-md opacity-0 transition-all duration-200 group-hover:opacity-100">
          {label}
        </div>
      )}
    </div>
  );
}
