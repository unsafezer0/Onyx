import { useCallback, useState } from "react";
import { useEditor } from "../context/EditorContext";
import { ImageSquare, UploadSimple, GlobeSimple } from "@phosphor-icons/react";
import UrlImportDialog from "./UrlImportDialog";

export default function WelcomeScreen() {
  const { loadImage, openImage } = useEditor();
  const [showUrlDialog, setShowUrlDialog] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const file = e.dataTransfer.files[0];
      if (!file) return;
      if (
        !file.type.startsWith("image/") &&
        !file.name.match(/\.(png|jpe?g|webp|bmp|gif)$/i)
      ) {
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onload = () => {
          loadImage({
            dataUrl,
            width: img.naturalWidth,
            height: img.naturalHeight,
            filePath: null,
            fileName: file.name,
          });
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    },
    [loadImage],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return (
    <div className="flex flex-1 items-center justify-center bg-background">
      <div
        className="welcome-dropzone group flex flex-col items-center gap-8 rounded-2xl border-2 border-dashed border-border/50 bg-card/30 px-16 py-20 transition-all duration-300 hover:border-primary/50 hover:bg-card/50"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div className="relative">
          <div className="welcome-icon-glow absolute -inset-4 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-40 bg-primary" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
            <ImageSquare
              size={40}
              weight="duotone"
              className="text-primary-foreground"
            />
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Open an image to get started
          </h2>
          <p className="max-w-xs text-center text-sm leading-relaxed text-muted-foreground">
            Drag and drop an image here, or click a button below to get started.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openImage}
            className="inline-flex items-center gap-2.5 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 hover:brightness-110 active:scale-[0.98]"
          >
            <UploadSimple size={18} weight="bold" />
            Open Image
          </button>
          <button
            onClick={() => setShowUrlDialog(true)}
            className="inline-flex items-center gap-2.5 rounded-xl border border-border bg-card/60 px-6 py-3 text-sm font-medium text-foreground shadow-sm transition-all duration-200 hover:bg-card hover:shadow-md active:scale-[0.98]"
          >
            <GlobeSimple size={18} weight="duotone" />
            Open from URL
          </button>
        </div>

        <p className="text-xs text-muted-foreground/50">
          Supports PNG, JPG, WebP, BMP, and GIF
        </p>
      </div>

      <UrlImportDialog
        open={showUrlDialog}
        onClose={() => setShowUrlDialog(false)}
      />
    </div>
  );
}
