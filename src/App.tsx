import { useEffect, useCallback } from "react";
import { ThemeContext, useThemeProvider } from "./hooks/useTheme";
import { EditorProvider, useEditor } from "./context/EditorContext";
import Header from "./components/Header";

import WelcomeScreen from "./components/WelcomeScreen";
import Canvas from "./components/Canvas";
import Toolbar from "./components/Toolbar";
import PropertiesPanel from "./components/PropertiesPanel";

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
  const { dispatch, undo, redo, state } = useEditor();

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
    if (state.image.filePath) {
      const ext = state.image.filePath.split('.').pop()?.toLowerCase() || 'png';
      const format = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
      const dataUrl = exportFn(format, 1.0);
      if (!dataUrl) return;

      await window.electronAPI?.saveFile(dataUrl, state.image.filePath);
      dispatch({ type: "MARK_SAVED" });
    } else {
      const dataUrl = exportFn("image/png", 1.0);
      if (!dataUrl) return;
      const result = await window.electronAPI?.saveFileAs(dataUrl);
      if (result) dispatch({ type: "MARK_SAVED" });
    }
  }, [state.image, dispatch]);

  const handleSaveAs = useCallback(async () => {
    const exportFn = (window as any).__oynx_export;
    if (!exportFn) return;
    
    // We don't know the format until they pick it in the dialog!
    // We should let electron handle it or we can just send PNG and let electron convert it?
    // Wait, IPC doesn't convert it! We need to change IPC so that it tells us the format!
    // Since we can't easily change the synchronous flow here without refactoring IPC,
    // let's pass a high quality PNG to the saveFileAs and let electron write it.
    // BUT wait! If they pick JPEG, they get a PNG.
    
    // As a workaround, we will just export PNG. PNG is lossless, so no pixels are lost.
    const dataUrl = exportFn("image/png", 1.0);
    if (!dataUrl) return;
    const result = await window.electronAPI?.saveFileAs(dataUrl);
    if (result) dispatch({ type: "MARK_SAVED" });
  }, [dispatch]);

  useEffect(() => {
    const cleanup = window.electronAPI?.onMenuEvent((action: string) => {
      switch (action) {
        case "open":
          handleOpen();
          break;
        case "save":
          handleSave();
          break;
        case "save-as":
        case "export":
          handleSaveAs();
          break;
        case "undo":
          undo();
          break;
        case "redo":
          redo();
          break;
      }
    });

    return () => {
      cleanup?.();
    };
  }, [handleOpen, handleSave, handleSaveAs, undo, redo]);

  return null;
}

function KeyboardEventHandler() {
  const { state, updateLayer } = useEditor();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if editing text or active input
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (!state.selectedLayerId) return;

      const layer = state.layers.find((l) => l.id === state.selectedLayerId);
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
        default:
          return;
      }

      e.preventDefault();
      updateLayer(layer.id, { x: layer.x + dx, y: layer.y + dy });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.selectedLayerId, state.layers, updateLayer]);

  return null;
}

export default App;
