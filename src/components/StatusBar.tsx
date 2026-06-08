import { useEditor } from "../context/EditorContext";

export default function StatusBar() {
  const { state } = useEditor();

  return (
    <footer className="flex w-full items-center justify-between border-t border-border bg-card/30 px-4 py-1.5 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        {state.image ? (
          <>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {state.image.width} × {state.image.height}px
            </span>
            <span className="text-[11px] text-muted-foreground/40">|</span>
            <span className="text-[11px] text-muted-foreground">
              {state.image.fileName}
            </span>
            {state.isDirty && (
              <span className="text-[11px] text-primary">● Modified</span>
            )}
          </>
        ) : (
          <span className="text-[11px] text-muted-foreground/50">No image loaded</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {Math.round(state.zoom * 100)}%
        </span>
      </div>
    </footer>
  );
}
