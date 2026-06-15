import { useEffect, useCallback, useRef, useState } from "react";
import { ThemeContext, useThemeProvider } from "./hooks/useTheme";
import { EditorProvider, useEditor } from "./context/EditorContext";
import { formatFromExtension } from "./utils/renderUtils";
import Header from "./components/Header";
import WelcomeScreen from "./components/WelcomeScreen";
import Canvas from "./components/Canvas";
import Toolbar from "./components/Toolbar";
import PropertiesPanel from "./components/PropertiesPanel";
import ExportDialog from "./components/ExportDialog";

function App() {
  const themeCtx = useThemeProvider();

  // Default to dark theme for editors
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (!stored) {
      themeCtx.setTheme("dark");
    }
  }, []);

  return (
    <ThemeContext.Provider value={themeCtx}>
      <EditorProvider>
        <div className="flex h-screen w-full select-none flex-col bg-background text-foreground">
          <Header />
          <EditorLayout />
        </div>
        <MenuEventHandler />
        <KeyboardEventHandler />
      </EditorProvider>
    </ThemeContext.Provider>
  );
}

function EditorLayout() {
  const { state } = useEditor();

  if (!state.image) {
    return <WelcomeScreen />;
  }

  return (
    <main className="flex flex-1 overflow-hidden">
      <Toolbar />
      <Canvas />
      <PropertiesPanel />
    </main>
  );
}

function MenuEventHandler() {
  const { dispatch, undo, redo, state, openImage, canvasActionsRef } =
    useEditor();
  const [showExportDialog, setShowExportDialog] = useState(false);

  const handleSaveAs = useCallback(async () => {
    const actions = canvasActionsRef.current;
    if (!actions) return;

    let filePath = "";
    let format = "png";

    if (window.electronAPI) {
      // Step 1: Show dialog to get the chosen path
      const result = await window.electronAPI.saveFileAs();
      if (!result) return;
      filePath = result.filePath;
      format = filePath.split(".").pop()?.toLowerCase() || "png";
    } else {
      // Web fallback
      format = "png";
      filePath = Date.now().toString().slice(-5) + ".png";
    }

    // Step 2: Determine format from chosen extension
    const ext = format;
    const { mime, quality } = formatFromExtension(ext);

    // Step 3: Export in the correct format
    const dataUrl = actions.exportImage(mime, quality);
    if (!dataUrl) return;

    // Step 4: Write the file
    if (window.electronAPI) {
      await window.electronAPI.saveFile(dataUrl, filePath);
    } else {
      // Web fallback: download the data URL
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filePath;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
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
      // No existing path — fall through to save-as
      await handleSaveAs();
    }
  }, [state.image, dispatch, canvasActionsRef, handleSaveAs]);

  const handleAction = useCallback(
    (action: string) => {
      switch (action) {
        case "open":
          openImage();
          break;
        case "save":
          handleSave();
          break;
        case "save-as":
          handleSaveAs();
          break;
        case "export":
          setShowExportDialog(true);
          break;
        case "undo":
          undo();
          break;
        case "redo":
          redo();
          break;
      }
    },
    [openImage, handleSave, handleSaveAs, undo, redo],
  );

  useEffect(() => {
    // Listen for Electron menu events (keyboard shortcuts)
    const cleanup = window.electronAPI?.onMenuEvent((action: string) =>
      handleAction(action),
    );

    // Listen for custom DOM events from Header buttons
    const domHandler = (e: Event) => handleAction((e as CustomEvent).detail);
    window.addEventListener("onyx:menu-action", domHandler);

    return () => {
      cleanup?.();
      window.removeEventListener("onyx:menu-action", domHandler);
    };
  }, [handleAction]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      const cmdOrCtrl = e.ctrlKey || e.metaKey;
      if (!cmdOrCtrl) return;

      switch (e.key.toLowerCase()) {
        case "o":
          e.preventDefault();
          handleAction("open");
          break;
        case "s":
          e.preventDefault();
          if (e.shiftKey) {
            handleAction("save-as");
          } else {
            handleAction("save");
          }
          break;
        case "e":
          e.preventDefault();
          handleAction("export");
          break;
        case "z":
          e.preventDefault();
          if (e.shiftKey) {
            handleAction("redo");
          } else {
            handleAction("undo");
          }
          break;
        case "y":
          e.preventDefault();
          handleAction("redo");
          break;
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [handleAction]);

  return (
    <ExportDialog
      open={showExportDialog}
      onClose={() => setShowExportDialog(false)}
    />
  );
}

function KeyboardEventHandler() {
  const { state, updateLayer, snapshotForUndo, removeLayer } = useEditor();

  // Store in refs to avoid re-subscribing the keydown listener on every frame during drag.
  const layersRef = useRef(state.layers);
  const selectedIdRef = useRef(state.selectedLayerId);
  useEffect(() => {
    layersRef.current = state.layers;
    selectedIdRef.current = state.selectedLayerId;
  });

  // Debounced undo snapshot: snapshot once before the first arrow key move,
  // then suppress further snapshots until keys are idle for 500ms.
  const snapshotPending = useRef(true);
  const snapshotTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if editing text or active input
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      const selectedId = selectedIdRef.current;
      if (!selectedId) return;

      const layer = layersRef.current.find((l) => l.id === selectedId);
      if (!layer) return;

      let dx = 0;
      let dy = 0;
      const step = e.shiftKey ? 10 : 1;

      switch (e.key) {
        case "ArrowUp":
          dy = -step;
          break;
        case "ArrowDown":
          dy = step;
          break;
        case "ArrowLeft":
          dx = -step;
          break;
        case "ArrowRight":
          dx = step;
          break;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          snapshotForUndo();
          removeLayer(layer.id);
          return;
        default:
          return;
      }

      e.preventDefault();

      // Snapshot once before the first move in a burst
      if (snapshotPending.current) {
        snapshotForUndo();
        snapshotPending.current = false;
      }
      // Reset after idle
      if (snapshotTimer.current) clearTimeout(snapshotTimer.current);
      snapshotTimer.current = setTimeout(() => {
        snapshotPending.current = true;
      }, 500);

      updateLayer(layer.id, { x: layer.x + dx, y: layer.y + dy });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [updateLayer, snapshotForUndo, removeLayer]); // stable deps only

  return null;
}

export default App;
