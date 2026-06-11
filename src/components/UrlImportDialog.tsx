import { useState, useRef, useCallback, useEffect } from "react";
import { useEditor } from "../context/EditorContext";
import { GlobeSimple, CircleNotch, X, ArrowRight } from "@phosphor-icons/react";

interface UrlImportDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function UrlImportDialog({ open, onClose }: UrlImportDialogProps) {
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
      className="url-import-dialog"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      onCancel={(e) => {
        e.preventDefault();
        if (!loading) onClose();
      }}
    >
      <div className="url-import-dialog__content">
        {/* Header */}
        <div className="url-import-dialog__header">
          <div className="url-import-dialog__header-left">
            <div className="url-import-dialog__icon">
              <GlobeSimple size={20} weight="duotone" />
            </div>
            <h2 className="url-import-dialog__title">Open from URL</h2>
          </div>
          <button
            className="url-import-dialog__close"
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="url-import-dialog__body">
          <label className="url-import-dialog__label" htmlFor="url-import-input">
            Image URL
          </label>
          <div className="url-import-dialog__input-row">
            <input
              ref={inputRef}
              id="url-import-input"
              type="url"
              className="url-import-dialog__input"
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
            <p className="url-import-dialog__error" role="alert">
              {error}
            </p>
          )}

          <p className="url-import-dialog__hint">
            Paste a direct link to a PNG, JPG, WebP, BMP, or GIF image.
          </p>

          <div className="url-import-dialog__actions">
            <button
              type="button"
              className="url-import-dialog__btn url-import-dialog__btn--secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="url-import-dialog__btn url-import-dialog__btn--primary"
              disabled={loading || !url.trim()}
            >
              {loading ? (
                <>
                  <CircleNotch size={16} className="url-import-dialog__spinner" />
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
