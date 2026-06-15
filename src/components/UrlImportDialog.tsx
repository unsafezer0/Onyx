import { useState, useRef, useCallback, useEffect } from "react";
import { useEditor } from "../context/EditorContext";
import { GlobeSimple, CircleNotch, X, ArrowRight } from "@phosphor-icons/react";

interface UrlImportDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function UrlImportDialog({
  open,
  onClose,
}: UrlImportDialogProps) {
  const { openImageFromUrl } = useEditor();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync open state with <dialog>
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      // Focus + select input after dialog animation starts
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setUrl("");
      setError(null);
      setLoading(false);
    }
  }, [open]);

  const isValidUrl = useCallback((value: string) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }, []);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const trimmed = url.trim();
      if (!trimmed || !isValidUrl(trimmed)) {
        setError("Please enter a valid HTTP or HTTPS URL.");
        return;
      }

      setError(null);
      setLoading(true);

      const result = await openImageFromUrl(trimmed);

      setLoading(false);
      if (result.success) {
        onClose();
      } else {
        setError(result.error || "Failed to load image.");
      }
    },
    [url, isValidUrl, openImageFromUrl, onClose],
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      // Close when clicking the backdrop (outside the dialog box)
      if (e.target === dialogRef.current && !loading) {
        onClose();
      }
    },
    [onClose, loading],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        e.preventDefault();
        onClose();
      }
    },
    [onClose, loading],
  );

  return (
    <dialog
      ref={dialogRef}
      className="m-auto max-w-[100vw] max-h-[100vh] overflow-visible bg-transparent p-0 outline-none backdrop:bg-black/55 backdrop:backdrop-blur-sm open:animate-in open:fade-in open:slide-in-from-bottom-4 open:duration-250"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      onCancel={(e) => {
        e.preventDefault();
        if (!loading) onClose();
      }}
    >
      <div className="w-[460px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-popover shadow-[0_24px_48px_-12px_rgba(0,0,0,0.25),inset_0_0_0_1px_rgba(255,255,255,0.04)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <GlobeSimple size={20} weight="duotone" />
            </div>
            <h2 className="m-0 text-sm font-semibold tracking-tight text-foreground">
              Open from URL
            </h2>
          </div>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md border-none bg-transparent text-muted-foreground transition-all duration-150 hover:bg-accent/60 hover:text-foreground disabled:cursor-default disabled:opacity-30"
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-5">
          <label
            className="text-xs font-medium tracking-[0.01em] text-muted-foreground"
            htmlFor="url-import-input"
          >
            Image URL
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              id="url-import-input"
              type="url"
              className="box-border w-full rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-[13px] text-foreground outline-none transition-colors duration-200 focus:border-primary focus:ring-3 focus:ring-primary/15 disabled:cursor-default disabled:opacity-50 placeholder:text-muted-foreground placeholder:opacity-50"
              placeholder="https://example.com/photo.jpg"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(null);
              }}
              disabled={loading}
              autoComplete="off"
              spellCheck={false}
              onFocus={(e) => e.target.select()}
            />
          </div>

          {error && (
            <p
              className="m-0 rounded-md border border-destructive/20 bg-destructive/10 px-2.5 py-2 text-xs leading-relaxed text-destructive animate-in fade-in slide-in-from-top-1 duration-200"
              role="alert"
            >
              {error}
            </p>
          )}

          <p className="m-0 text-[11px] text-muted-foreground opacity-70">
            Paste a direct link to a PNG, JPG, WebP, BMP, or GIF image.
          </p>

          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-transparent px-4 py-2 text-[13px] font-medium leading-none text-muted-foreground transition-all duration-150 hover:bg-accent/50 hover:text-foreground disabled:cursor-default disabled:opacity-40"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg border-none bg-primary px-4 py-2 text-[13px] font-medium leading-none text-primary-foreground shadow-[0_1px_3px_color-mix(in_srgb,var(--primary)_30%,transparent)] transition-all duration-150 hover:filter-[brightness(1.1)] hover:shadow-[0_2px_8px_color-mix(in_srgb,var(--primary)_40%,transparent)] active:scale-98 disabled:cursor-default disabled:opacity-40"
              disabled={loading || !url.trim()}
            >
              {loading ? (
                <>
                  <CircleNotch size={16} className="animate-spin" />
                  Loading…
                </>
              ) : (
                <>
                  <ArrowRight size={16} weight="bold" />
                  Open
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
