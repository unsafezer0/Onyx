import { useEditor } from "../context/EditorContext";
import { useCallback } from "react";
import { formatFromExtension } from "../utils/renderUtils";
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
  const { state, undo, redo, canUndo, canRedo, setZoom, cancelCrop, dispatch, openImage, canvasActionsRef } =
    useEditor();

  const handleExport = useCallback(async () => {
    const actions = canvasActionsRef.current;
    if (!actions) return;

    const result = await window.electronAPI?.saveFileAs();
    if (!result) return;

    const ext = result.filePath.split(".").pop()?.toLowerCase() || "png";
    const { mime, quality } = formatFromExtension(ext);
    const dataUrl = actions.exportImage(mime, quality);
    if (!dataUrl) return;

    await window.electronAPI?.saveFile(dataUrl, result.filePath);
    dispatch({ type: "MARK_SAVED" });
  }, [dispatch, canvasActionsRef]);

  const handleSave = useCallback(async () => {
    const actions = canvasActionsRef.current;
    if (!actions || !state.image) return;

    if (state.image.filePath) {
      const ext = state.image.filePath.split(".").pop()?.toLowerCase() || "png";
      const { mime, quality } = formatFromExtension(ext);
      const dataUrl = actions.exportImage(mime, quality);
      if (!dataUrl) return;
      await window.electronAPI?.saveFile(dataUrl, state.image.filePath);
      dispatch({ type: "MARK_SAVED" });
    } else {
      // Fall through to export (save-as)
      await handleExport();
    }
  }, [state.image, dispatch, canvasActionsRef, handleExport]);

  const handleCropApply = useCallback(() => {
    canvasActionsRef.current?.applyCrop();
  }, [canvasActionsRef]);

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
          onClick={openImage}
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
