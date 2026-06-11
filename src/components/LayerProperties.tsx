import { useState, useRef, useEffect } from "react";
import { useEditor, type TextLayer, type ImageLayer } from "../context/EditorContext";
import {
  Trash,
  TextB,
  TextItalic,
  Eye,
  EyeSlash,
  Image as ImageIcon,
  TextT,
  Crop,
  Check,
  X,
  ArrowsClockwise,
  CaretDown,
  DotsSixVertical,
} from "@phosphor-icons/react";
import ColorPicker from "./ColorPicker";

const availableFonts = [
  "system-ui",
  "Arial",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Verdana",
  "Impact",
  "Comic Sans MS",
  "Trebuchet MS",
  "Palatino",
];

export default function LayerProperties() {
  const { state, updateLayer, removeLayer, reorderLayer, addImageOverlay, startLayerCrop, cancelLayerCrop, addText, selectLayer, startCrop, cancelCrop, dispatch, canvasActionsRef, snapshotForUndo } = useEditor();
  const selected = state.layers.find((l) => l.id === state.selectedLayerId);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [isFontOpen, setIsFontOpen] = useState(false);
  const fontRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceOverlayInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isFontOpen) return;
    const handler = (e: MouseEvent) => {
      if (fontRef.current && !fontRef.current.contains(e.target as Node)) {
        setIsFontOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isFontOpen]);

  const handleAddImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > 600) {
          h = Math.round((600 / w) * h);
          w = 600;
        }
        addImageOverlay(dataUrl, w, h);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleReplaceOverlay = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        updateLayer(selected.id, {
          dataUrl,
          originalWidth: img.naturalWidth,
          originalHeight: img.naturalHeight,
          cropX: 0,
          cropY: 0,
          cropWidth: img.naturalWidth,
          cropHeight: img.naturalHeight,
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleReplaceBackground = async () => {
    const result = await window.electronAPI?.openFile();
    if (!result) return;
    const img = new Image();
    img.onload = () => {
      dispatch({
        type: "REPLACE_BACKGROUND",
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
  };

  const handleApplyLayerCrop = () => {
    canvasActionsRef.current?.applyLayerCrop();
  };

  const handleApplyCrop = () => {
    canvasActionsRef.current?.applyCrop();
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx) return;
    reorderLayer(draggedIdx, targetIdx);
    setDraggedIdx(null);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Add buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => addText()}
          disabled={!state.image}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-sm transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:hover:brightness-100"
        >
          <TextT size={14} weight="bold" />
          Text
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={!state.image}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-sm transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:hover:brightness-100"
        >
          <ImageIcon size={14} weight="bold" />
          Image
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleAddImage}
          accept="image/*"
          className="hidden"
        />
      </div>

      {/* Selected layer properties */}
      {selected && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-3">
          <h4 className="text-sm font-medium text-muted-foreground mb-1">
            {selected.type === "text" ? "Text Properties" : "Image Properties"}
          </h4>

          {selected.type === "text" && (
            <>
              {/* Text content */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-muted-foreground/90">
                  Content
                </label>
                <input
                  type="text"
                  value={(selected as TextLayer).text}
                  onChange={(e) => updateLayer(selected.id, { text: e.target.value })}
                  className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none transition-colors focus:border-primary"
                />
              </div>

              {/* Font family */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-muted-foreground/90">
                  Font
                </label>
                <div ref={fontRef} className="relative">
                  <button
                    onClick={() => setIsFontOpen(!isFontOpen)}
                    className="flex w-full items-center justify-between rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none hover:border-primary"
                  >
                    <span style={{ fontFamily: (selected as TextLayer).fontFamily }}>{(selected as TextLayer).fontFamily}</span>
                    <CaretDown weight="bold" className="opacity-50" />
                  </button>
                  {isFontOpen && (
                    <div className="absolute left-0 top-full z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-md">
                      {availableFonts.map((f) => (
                        <button
                          key={f}
                          onClick={() => {
                            updateLayer(selected.id, { fontFamily: f });
                            setIsFontOpen(false);
                          }}
                          className={`w-full px-3 py-1.5 text-left text-xs hover:bg-muted ${(selected as TextLayer).fontFamily === f ? "bg-muted font-medium text-primary" : "text-foreground"}`}
                          style={{ fontFamily: f }}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Font size */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-muted-foreground/90">
                  Size: {(selected as TextLayer).fontSize}px
                </label>
                <input
                  type="range"
                  min={8}
                  max={200}
                  value={(selected as TextLayer).fontSize}
                  onChange={(e) => updateLayer(selected.id, { fontSize: Number(e.target.value) })}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>

              {/* Bold / Italic toggles */}
              <div className="flex gap-1.5">
                <div className="group relative flex items-center justify-center">
                  <button
                    onClick={() => updateLayer(selected.id, { bold: !(selected as TextLayer).bold })}
                    className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                      (selected as TextLayer).bold
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <TextB size={14} />
                  </button>
                  <div className="pointer-events-none absolute left-1/2 top-full z-[100] mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[10px] font-medium text-popover-foreground shadow-md opacity-0 transition-all duration-200 group-hover:opacity-100">
                    Bold
                  </div>
                </div>
                <div className="group relative flex items-center justify-center">
                  <button
                    onClick={() => updateLayer(selected.id, { italic: !(selected as TextLayer).italic })}
                    className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                      (selected as TextLayer).italic
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <TextItalic size={14} />
                  </button>
                  <div className="pointer-events-none absolute left-1/2 top-full z-[100] mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[10px] font-medium text-popover-foreground shadow-md opacity-0 transition-all duration-200 group-hover:opacity-100">
                    Italic
                  </div>
                </div>
              </div>

              {/* Color */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-muted-foreground/90">
                  Color
                </label>
                <ColorPicker
                  value={(selected as TextLayer).color}
                  onChange={(c) => updateLayer(selected.id, { color: c })}
                />
              </div>

              {/* Background */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-muted-foreground/90">
                    Background
                  </label>
                  <button
                    onClick={() => updateLayer(selected.id, { backgroundColor: (selected as TextLayer).backgroundColor ? "" : "#000000" })}
                    className="text-[10px] text-primary hover:underline"
                  >
                    {(selected as TextLayer).backgroundColor ? "Remove" : "Add"}
                  </button>
                </div>
                {(selected as TextLayer).backgroundColor && (
                  <ColorPicker
                    value={(selected as TextLayer).backgroundColor!}
                    onChange={(c) => updateLayer(selected.id, { backgroundColor: c })}
                  />
                )}
              </div>

              {/* Border (Stroke) */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-muted-foreground/90">
                    Border
                  </label>
                  <button
                    onClick={() => updateLayer(selected.id, { strokeColor: (selected as TextLayer).strokeColor ? "" : "#000000", strokeWidth: (selected as TextLayer).strokeColor ? 0 : 2 })}
                    className="text-[10px] text-primary hover:underline"
                  >
                    {(selected as TextLayer).strokeColor ? "Remove" : "Add"}
                  </button>
                </div>
                {(selected as TextLayer).strokeColor && (
                  <div className="flex flex-col gap-2 mt-1">
                    <ColorPicker
                      value={(selected as TextLayer).strokeColor!}
                      onChange={(c) => updateLayer(selected.id, { strokeColor: c })}
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-12">W: {(selected as TextLayer).strokeWidth}px</span>
                      <input
                        type="range"
                        min={1}
                        max={20}
                        value={(selected as TextLayer).strokeWidth || 2}
                        onChange={(e) => updateLayer(selected.id, { strokeWidth: Number(e.target.value) })}
                        onPointerDown={snapshotForUndo}
                        className="flex-1 accent-primary cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Opacity */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground/90">
              Opacity: {Math.round(selected.opacity * 100)}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(selected.opacity * 100)}
              onChange={(e) => updateLayer(selected.id, { opacity: Number(e.target.value) / 100 })}
              onPointerDown={snapshotForUndo}
              className="w-full accent-primary cursor-pointer"
            />
          </div>

          {/* Rotation */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground/90">
              Rotation: {selected.rotation}°
            </label>
            <input
              type="range"
              min={-180}
              max={180}
              value={selected.rotation}
              onChange={(e) => updateLayer(selected.id, { rotation: Number(e.target.value) })}
              onPointerDown={snapshotForUndo}
              className="w-full accent-primary cursor-pointer"
            />
          </div>

          {/* Scale & Crop (Image only) */}
          {selected.type === "image" && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-muted-foreground/90">
                  Width: {Math.round((selected as ImageLayer).width)}px
                </label>
                <input
                  type="range"
                  min={10}
                  max={2000}
                  value={(selected as ImageLayer).width}
                  onChange={(e) => {
                    const newW = Number(e.target.value);
                    const newH = newW * ((selected as ImageLayer).height / (selected as ImageLayer).width);
                    updateLayer(selected.id, { width: newW, height: newH });
                  }}
                  onPointerDown={snapshotForUndo}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>

              {/* Corner Radius */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-muted-foreground/90">
                  Corner Radius: {(selected as ImageLayer).borderRadius || 0}px
                </label>
                <input
                  type="range"
                  min={0}
                  max={200}
                  value={(selected as ImageLayer).borderRadius || 0}
                  onChange={(e) => updateLayer(selected.id, { borderRadius: Number(e.target.value) })}
                  onPointerDown={snapshotForUndo}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>
              {state.activeTool === "cropLayer" ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleApplyLayerCrop}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent bg-primary px-2 py-1.5 text-xs text-primary-foreground transition-all hover:brightness-110"
                  >
                    <Check size={14} />
                    Apply
                  </button>
                  <button
                    onClick={cancelLayerCrop}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
                  >
                    <X size={14} />
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={startLayerCrop}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
                >
                  <Crop size={14} />
                  Crop Image
                </button>
              )}
              
              <input
                type="file"
                ref={replaceOverlayInputRef}
                onChange={handleReplaceOverlay}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={() => replaceOverlayInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
              >
                <ArrowsClockwise size={14} />
                Replace Image
              </button>
            </>
          )}

          {/* Delete */}
          <button
            onClick={() => removeLayer(selected.id)}
            className="flex items-center justify-center gap-1.5 rounded-md border border-destructive/30 px-2 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/10"
          >
            <Trash size={12} />
            Remove
          </button>
        </div>
      )}

      {/* Layer list */}
      {state.layers.length > 0 && (
        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-medium text-muted-foreground mb-1">Layers</h4>
          {state.layers.map((_, reverseIdx) => {
            const index = state.layers.length - 1 - reverseIdx;
            const lObj = state.layers[index];
            return (
              <div
                key={lObj.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                onClick={() => selectLayer(lObj.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors cursor-pointer ${
                  selected?.id === lObj.id
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                } ${draggedIdx === index ? "opacity-50" : "opacity-100"}`}
              >
                <div className="flex items-center gap-2">
                  <div className="cursor-grab hover:text-foreground mr-1 text-muted-foreground/50">
                    <DotsSixVertical size={14} weight="bold" />
                  </div>
                  <div className="group relative flex items-center justify-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        snapshotForUndo();
                        updateLayer(lObj.id, { visible: !lObj.visible });
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded hover:bg-background/50"
                    >
                      {lObj.visible ? (
                        <Eye size={14} className="text-muted-foreground" />
                      ) : (
                        <EyeSlash size={14} className="text-muted-foreground/50" />
                      )}
                    </button>
                    <div className="pointer-events-none absolute left-1/2 top-full z-[100] mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[10px] font-medium text-popover-foreground shadow-md opacity-0 transition-all duration-200 group-hover:opacity-100">
                      Toggle Visibility
                    </div>
                  </div>
                  {lObj.type === "text" ? <TextT size={14} /> : <ImageIcon size={14} />}
                  <span className="truncate max-w-[100px] text-xs text-foreground/80">
                    {lObj.type === "text" ? ((lObj as TextLayer).text || "Empty text") : "Image"}
                  </span>
                </div>
                <div className="group relative flex items-center justify-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeLayer(lObj.id);
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash size={14} />
                  </button>
                  <div className="pointer-events-none absolute right-0 top-full z-[100] mt-1.5 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[10px] font-medium text-popover-foreground shadow-md opacity-0 transition-all duration-200 group-hover:opacity-100">
                    Delete Layer
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Background properties (when no layer is selected) */}
      {!selected && state.image && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-3 mt-auto">
          <h4 className="text-sm font-medium text-muted-foreground mb-1">Background Image</h4>
          {state.activeTool === "crop" ? (
            <div className="flex gap-2">
              <button
                onClick={handleApplyCrop}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent bg-primary px-2 py-1.5 text-xs text-primary-foreground transition-all hover:brightness-110"
              >
                <Check size={14} />
                Apply
              </button>
              <button
                onClick={cancelCrop}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
              >
                <X size={14} />
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={startCrop}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
            >
              <Crop size={14} />
              Crop Background
            </button>
          )}
          <button
            onClick={handleReplaceBackground}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
          >
            <ArrowsClockwise size={14} />
            Replace Background
          </button>
        </div>
      )}

      {/* Empty state text */}
      {!selected && state.layers.length === 0 && state.image && (
        <p className="pb-2 text-center text-xs text-muted-foreground/50">
          Click "Text" or "Image" to add an overlay
        </p>
      )}
    </div>
  );
}
