import { useEffect, useCallback } from "react";
import { ThemeContext, useThemeProvider } from "./hooks/useTheme";
import { EditorProvider, useEditor } from "./context/EditorContext";
import { formatFromExtension } from "./utils/renderUtils";
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
  const { dispatch, undo, redo, state, openImage, canvasActionsRef } = useEditor();

  const handleSaveAs = useCallback(async () => {
    const actions = canvasActionsRef.current;
    if (!actions) return;

    // Step 1: Show dialog to get the chosen path
    const result = await window.electronAPI?.saveFileAs();
    if (!result) return;

    // Step 2: Determine format from chosen extension
    const ext = result.filePath.split(".").pop()?.toLowerCase() || "png";
    const { mime, quality } = formatFromExtension(ext);

    // Step 3: Export in the correct format
    const dataUrl = actions.exportImage(mime, quality);
    if (!dataUrl) return;

    // Step 4: Write the file
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
      // No existing path — fall through to save-as
      await handleSaveAs();
    }
  }, [state.image, dispatch, canvasActionsRef, handleSaveAs]);

  useEffect(() => {
    const cleanup = window.electronAPI?.onMenuEvent((action: string) => {
      switch (action) {
        case "open":
          openImage();
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
  }, [openImage, handleSave, handleSaveAs, undo, redo]);

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
