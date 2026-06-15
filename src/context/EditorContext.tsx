import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { set, get, del } from "idb-keyval";
import { resizeImageIfTooLarge } from "../utils/renderUtils";

export interface LayerBase {
  id: string;
  type: "text" | "image";
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  blendMode: GlobalCompositeOperation;
}

export interface TextLayer extends LayerBase {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
  italic: boolean;
  strokeColor?: string;
  strokeWidth?: number;
  backgroundColor?: string;
}

export interface ImageLayer extends LayerBase {
  type: "image";
  dataUrl: string;
  width: number;
  height: number;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
  originalWidth?: number;
  originalHeight?: number;
  borderRadius?: number;
}

export type Layer = TextLayer | ImageLayer;

export interface FilterState {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  grayscale: number;
  sepia: number;
  invert: number;
  hueRotate: number;
}

export interface CropState {
  active: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  aspectRatio: "free" | "1:1" | "4:3" | "16:9" | "3:2";
}

export type Tool = "select" | "text" | "crop" | "pan" | "cropLayer";

export interface ImageInfo {
  dataUrl: string;
  width: number;
  height: number;
  filePath: string | null;
  fileName: string;
}

export interface EditorState {
  image: ImageInfo | null;
  layers: Layer[];
  selectedLayerId: string | null;
  filters: FilterState;
  crop: CropState;
  layerCrop: CropState;
  activeTool: Tool;
  zoom: number;
  panX: number;
  panY: number;
  isDirty: boolean;
}

export const defaultFilters: FilterState = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hueRotate: 0,
  blur: 0,
  grayscale: 0,
  sepia: 0,
  invert: 0,
};

export const defaultCrop: CropState = {
  active: false,
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  aspectRatio: "free",
};

const initialState: EditorState = {
  image: null,
  layers: [],
  selectedLayerId: null,
  filters: { ...defaultFilters },
  crop: { ...defaultCrop },
  layerCrop: { ...defaultCrop },
  activeTool: "select",
  zoom: 1,
  panX: 0,
  panY: 0,
  isDirty: false,
};

type EditorAction =
  | { type: "LOAD_IMAGE"; payload: ImageInfo }
  | { type: "REPLACE_BACKGROUND"; payload: ImageInfo }
  | { type: "CLOSE_IMAGE" }
  | { type: "SET_TOOL"; payload: Tool }
  | { type: "ADD_LAYER"; payload: Layer }
  | { type: "UPDATE_LAYER"; payload: { id: string; changes: Partial<Layer> } }
  | { type: "REMOVE_LAYER"; payload: string }
  | { type: "REORDER_LAYER"; payload: { startIndex: number; endIndex: number } }
  | { type: "SELECT_LAYER"; payload: string | null }
  | { type: "SET_FILTERS"; payload: Partial<FilterState> }
  | { type: "RESET_FILTERS" }
  | { type: "SET_CROP"; payload: Partial<CropState> }
  | { type: "START_CROP" }
  | {
      type: "APPLY_CROP";
      payload: { dataUrl: string; width: number; height: number };
    }
  | { type: "CANCEL_CROP" }
  | { type: "START_LAYER_CROP" }
  | { type: "SET_LAYER_CROP"; payload: Partial<CropState> }
  | { type: "CANCEL_LAYER_CROP" }
  | { type: "SET_ZOOM"; payload: number }
  | { type: "SET_PAN"; payload: { x: number; y: number } }
  | { type: "MARK_SAVED" }
  | { type: "RESTORE_STATE"; payload: EditorState };

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "LOAD_IMAGE":
      return {
        ...initialState,
        image: action.payload,
        zoom: 0.75,
        panX: 0,
        panY: 0,
      };

    case "REPLACE_BACKGROUND":
      return {
        ...state,
        image: action.payload,
        isDirty: true,
      };

    case "CLOSE_IMAGE":
      return { ...initialState };

    case "SET_TOOL":
      return {
        ...state,
        activeTool: action.payload,
        crop: action.payload !== "crop" ? { ...defaultCrop } : state.crop,
        layerCrop:
          action.payload !== "cropLayer" ? { ...defaultCrop } : state.layerCrop,
      };

    case "ADD_LAYER":
      return {
        ...state,
        layers: [...state.layers, action.payload],
        selectedLayerId: action.payload.id,
        isDirty: true,
      };

    case "UPDATE_LAYER":
      return {
        ...state,
        layers: state.layers.map((t) =>
          t.id === action.payload.id
            ? ({ ...t, ...action.payload.changes } as Layer)
            : t,
        ),
        isDirty: true,
      };

    case "REMOVE_LAYER":
      return {
        ...state,
        layers: state.layers.filter((t) => t.id !== action.payload),
        selectedLayerId:
          state.selectedLayerId === action.payload
            ? null
            : state.selectedLayerId,
        isDirty: true,
      };

    case "REORDER_LAYER": {
      const result = Array.from(state.layers);
      const [removed] = result.splice(action.payload.startIndex, 1);
      result.splice(action.payload.endIndex, 0, removed);
      return {
        ...state,
        layers: result,
        isDirty: true,
      };
    }

    case "SELECT_LAYER":
      return { ...state, selectedLayerId: action.payload };

    case "SET_FILTERS":
      return {
        ...state,
        filters: { ...state.filters, ...action.payload },
        isDirty: true,
      };

    case "RESET_FILTERS":
      return {
        ...state,
        filters: { ...defaultFilters },
        isDirty: true,
      };

    case "SET_CROP":
      return {
        ...state,
        crop: { ...state.crop, ...action.payload },
      };

    case "START_CROP":
      return {
        ...state,
        activeTool: "crop",
        crop: {
          ...defaultCrop,
          active: true,
          x: 0,
          y: 0,
          width: state.image?.width ?? 0,
          height: state.image?.height ?? 0,
        },
      };

    case "APPLY_CROP":
      return {
        ...state,
        image: state.image
          ? {
              ...state.image,
              dataUrl: action.payload.dataUrl,
              width: action.payload.width,
              height: action.payload.height,
            }
          : null,
        crop: { ...defaultCrop },
        activeTool: "select",
        isDirty: true,
      };

    case "CANCEL_CROP":
      return {
        ...state,
        crop: { ...defaultCrop },
        activeTool: "select",
      };

    case "START_LAYER_CROP": {
      const selected = state.layers.find((l) => l.id === state.selectedLayerId);
      if (!selected || selected.type !== "image") return state;
      return {
        ...state,
        activeTool: "cropLayer",
        layerCrop: {
          ...defaultCrop,
          active: true,
          x: selected.x,
          y: selected.y,
          width: selected.width,
          height: selected.height,
        },
      };
    }

    case "SET_LAYER_CROP":
      return {
        ...state,
        layerCrop: { ...state.layerCrop, ...action.payload },
      };

    case "CANCEL_LAYER_CROP":
      return {
        ...state,
        layerCrop: { ...defaultCrop },
        activeTool: "select",
      };

    case "SET_ZOOM":
      return { ...state, zoom: Math.max(0.1, Math.min(10, action.payload)) };

    case "SET_PAN":
      return { ...state, panX: action.payload.x, panY: action.payload.y };

    case "MARK_SAVED":
      return { ...state, isDirty: false };

    case "RESTORE_STATE":
      return action.payload;

    default:
      return state;
  }
}

export interface CanvasActions {
  exportImage: (format?: string, quality?: number) => string | null;
  applyCrop: () => void;
  applyLayerCrop: () => void;
}

interface EditorContextValue {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  loadImage: (info: ImageInfo) => void;
  openImage: () => Promise<void>;
  openImageFromUrl: (
    url: string,
  ) => Promise<{ success: boolean; error?: string }>;
  addText: (overrides?: Partial<TextLayer>) => void;
  addImageOverlay: (
    dataUrl: string,
    width: number,
    height: number,
    overrides?: Partial<ImageLayer>,
  ) => void;
  updateLayer: (id: string, changes: Partial<Layer>) => void;
  removeLayer: (id: string) => void;
  reorderLayer: (startIndex: number, endIndex: number) => void;
  selectLayer: (id: string | null) => void;
  setFilters: (f: Partial<FilterState>) => void;
  resetFilters: () => void;
  setTool: (t: Tool) => void;
  setZoom: (z: number) => void;
  setPan: (x: number, y: number) => void;
  startCrop: () => void;
  applyCrop: (dataUrl: string, width: number, height: number) => void;
  cancelCrop: () => void;
  startLayerCrop: () => void;
  setLayerCrop: (changes: Partial<CropState>) => void;
  cancelLayerCrop: () => void;
  /** Snapshot current state for undo. Call before destructive actions. */
  snapshotForUndo: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Ref-based registry for canvas export/crop functions. */
  canvasActionsRef: React.MutableRefObject<CanvasActions | null>;
}

const EditorContext = createContext<EditorContextValue | null>(null);

let idCounter = 0;
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${++idCounter}`;
}

const maxHistory = 20;

/**
 * Blob deduplication for undo history.
 * Large base64 dataUrl strings are stored once in a refcounted map and
 * replaced with lightweight hash keys inside history snapshots.
 * This prevents the same multi-MB string from being duplicated 20× in memory.
 */
interface BlobStore {
  blobs: Map<string, { data: string; refCount: number }>;
}

function hashDataUrl(dataUrl: string): string {
  // Fast identity hash — use the length + a sample of chars as a key.
  // Collisions are acceptable here because the store checks equality.
  const len = dataUrl.length;
  if (len < 200) return dataUrl; // small strings are cheaper to keep inline
  return `__blob_${len}_${dataUrl.charCodeAt(50)}${dataUrl.charCodeAt(len >> 1)}${dataUrl.charCodeAt(len - 50)}`;
}

function internBlob(store: BlobStore, dataUrl: string): string {
  if (dataUrl.length < 200) return dataUrl;
  const key = hashDataUrl(dataUrl);
  const existing = store.blobs.get(key);
  if (existing) {
    // Verify it's actually the same string (collision guard)
    if (existing.data === dataUrl) {
      existing.refCount++;
      return key;
    }
    // Collision — store inline (extremely rare)
    return dataUrl;
  }
  store.blobs.set(key, { data: dataUrl, refCount: 1 });
  return key;
}

function resolveBlob(store: BlobStore, keyOrData: string): string {
  const entry = store.blobs.get(keyOrData);
  return entry ? entry.data : keyOrData;
}

function releaseBlobs(store: BlobStore, snapshot: EditorState): void {
  const release = (key: string) => {
    const entry = store.blobs.get(key);
    if (entry) {
      entry.refCount--;
      if (entry.refCount <= 0) store.blobs.delete(key);
    }
  };
  if (snapshot.image?.dataUrl) release(snapshot.image.dataUrl);
  for (const l of snapshot.layers) {
    if (l.type === "image") release((l as ImageLayer).dataUrl);
  }
}

function internSnapshot(store: BlobStore, state: EditorState): EditorState {
  const image = state.image
    ? { ...state.image, dataUrl: internBlob(store, state.image.dataUrl) }
    : null;
  const layers = state.layers.map((l) => {
    if (l.type === "image") {
      return {
        ...l,
        dataUrl: internBlob(store, (l as ImageLayer).dataUrl),
      } as Layer;
    }
    return l;
  });
  return { ...state, image, layers };
}

function resolveSnapshot(store: BlobStore, snapshot: EditorState): EditorState {
  const image = snapshot.image
    ? { ...snapshot.image, dataUrl: resolveBlob(store, snapshot.image.dataUrl) }
    : null;
  const layers = snapshot.layers.map((l) => {
    if (l.type === "image") {
      return {
        ...l,
        dataUrl: resolveBlob(store, (l as ImageLayer).dataUrl),
      } as Layer;
    }
    return l;
  });
  return { ...snapshot, image, layers };
}

export function EditorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(editorReducer, initialState);

  // Blob deduplication store for undo history
  const blobStoreRef = useRef<BlobStore>({ blobs: new Map() });

  // History stored in a ref; canUndo/canRedo are explicit state so React re-renders.
  const historyRef = useRef<{ past: EditorState[]; future: EditorState[] }>({
    past: [],
    future: [],
  });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Canvas actions registry — Canvas registers its functions here.
  const canvasActionsRef = useRef<CanvasActions | null>(null);

  // Ref to current state — allows callbacks to read latest state without dep churn.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  // Auto-restore session on mount
  useEffect(() => {
    get<EditorState>("onyx-session")
      .then((savedState) => {
        if (savedState && savedState.image) {
          dispatch({ type: "RESTORE_STATE", payload: savedState });
        }
      })
      .catch(console.error);
  }, []);

  // Auto-save session on changes (debounced)
  useEffect(() => {
    if (!state.image) {
      del("onyx-session").catch(console.error);
      return;
    }
    const timer = setTimeout(() => {
      set("onyx-session", state).catch(console.error);
    }, 1000);
    return () => clearTimeout(timer);
  }, [state]);

  const syncHistoryFlags = useCallback(() => {
    setCanUndo(historyRef.current.past.length > 0);
    setCanRedo(historyRef.current.future.length > 0);
  }, []);

  const snapshotForUndo = useCallback(() => {
    const h = historyRef.current;
    const store = blobStoreRef.current;
    const interned = internSnapshot(store, stateRef.current);
    // Evict oldest snapshot if at capacity
    if (h.past.length >= maxHistory) {
      const evicted = h.past.shift();
      if (evicted) releaseBlobs(store, evicted);
    }
    h.past = [...h.past, interned];
    // Release blobs in discarded future
    for (const snap of h.future) releaseBlobs(store, snap);
    h.future = [];
    syncHistoryFlags();
  }, [syncHistoryFlags]);

  const loadImage = useCallback(
    (info: ImageInfo) => {
      // Release all blobs in history
      const store = blobStoreRef.current;
      for (const snap of historyRef.current.past) releaseBlobs(store, snap);
      for (const snap of historyRef.current.future) releaseBlobs(store, snap);
      historyRef.current = { past: [], future: [] };
      syncHistoryFlags();
      dispatch({ type: "LOAD_IMAGE", payload: info });
    },
    [syncHistoryFlags],
  );

  const openImage = useCallback(async () => {
    const result = await window.electronAPI?.openFile();
    if (!result) return;

    try {
      const resized = await resizeImageIfTooLarge(result.dataUrl);
      loadImage({
        dataUrl: resized.dataUrl,
        width: resized.width,
        height: resized.height,
        filePath: result.filePath,
        fileName: result.fileName,
      });
    } catch (e) {
      console.error("Failed to load image", e);
    }
  }, [loadImage]);

  const openImageFromUrl = useCallback(
    async (url: string): Promise<{ success: boolean; error?: string }> => {
      try {
        let dataUrl: string;
        let fileName: string;

        if (window.electronAPI?.openFileFromUrl) {
          // Electron path: IPC to main process
          const result = await window.electronAPI.openFileFromUrl(url);
          if (!result)
            return { success: false, error: "Request was cancelled." };
          if ("error" in result) return { success: false, error: result.error };
          dataUrl = result.dataUrl;
          fileName = result.fileName;
        } else {
          // Web fallback: fetch via browser
          const res = await fetch(url);
          if (!res.ok)
            return {
              success: false,
              error: `Server returned status ${res.status}.`,
            };
          const contentType = res.headers.get("content-type") || "";
          if (!contentType.startsWith("image/")) {
            return {
              success: false,
              error: `URL did not return an image (got ${contentType}).`,
            };
          }
          const blob = await res.blob();
          dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          try {
            const pathname = new URL(url).pathname;
            const base = pathname.split("/").pop();
            fileName = base && base.includes(".") ? base : "image.png";
          } catch {
            fileName = "image.png";
          }
        }

        return new Promise((resolve) => {
          resizeImageIfTooLarge(dataUrl)
            .then((resized) => {
              loadImage({
                dataUrl: resized.dataUrl,
                width: resized.width,
                height: resized.height,
                filePath: null,
                fileName,
              });
              resolve({ success: true });
            })
            .catch(() => {
              resolve({
                success: false,
                error: "Failed to decode image data.",
              });
            });
        });
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : "Failed to fetch image from URL.";
        return { success: false, error: msg };
      }
    },
    [loadImage],
  );

  const addText = useCallback(
    (overrides?: Partial<TextLayer>) => {
      snapshotForUndo();
      const img = stateRef.current.image;
      const newText: TextLayer = {
        id: generateId("text"),
        type: "text",
        text: "Double-click to edit",
        x: (img?.width ?? 400) / 2 - 100,
        y: (img?.height ?? 300) / 2,
        fontSize: 32,
        fontFamily: "system-ui",
        color: "#ffffff",
        bold: false,
        italic: false,
        rotation: 0,
        opacity: 1,
        visible: true,
        blendMode: "source-over",
        strokeColor: "",
        strokeWidth: 0,
        backgroundColor: "",
        ...overrides,
      };
      dispatch({ type: "ADD_LAYER", payload: newText });
    },
    [snapshotForUndo],
  );

  const addImageOverlay = useCallback(
    (
      dataUrl: string,
      width: number,
      height: number,
      overrides?: Partial<ImageLayer>,
    ) => {
      snapshotForUndo();
      const img = stateRef.current.image;
      const newImage: ImageLayer = {
        id: generateId("img"),
        type: "image",
        dataUrl,
        width,
        height,
        x: (img?.width ?? 400) / 2 - width / 2,
        y: (img?.height ?? 300) / 2 - height / 2,
        rotation: 0,
        opacity: 1,
        visible: true,
        blendMode: "source-over",
        ...overrides,
      };
      dispatch({ type: "ADD_LAYER", payload: newImage });
    },
    [snapshotForUndo],
  );

  const updateLayer = useCallback((id: string, changes: Partial<Layer>) => {
    dispatch({ type: "UPDATE_LAYER", payload: { id, changes } });
  }, []);

  const removeLayer = useCallback(
    (id: string) => {
      snapshotForUndo();
      dispatch({ type: "REMOVE_LAYER", payload: id });
    },
    [snapshotForUndo],
  );

  const reorderLayer = useCallback(
    (startIndex: number, endIndex: number) => {
      snapshotForUndo();
      dispatch({ type: "REORDER_LAYER", payload: { startIndex, endIndex } });
    },
    [snapshotForUndo],
  );

  const selectLayer = useCallback(
    (id: string | null) => dispatch({ type: "SELECT_LAYER", payload: id }),
    [],
  );

  const setFilters = useCallback(
    (f: Partial<FilterState>) => dispatch({ type: "SET_FILTERS", payload: f }),
    [],
  );

  const resetFilters = useCallback(() => {
    snapshotForUndo();
    dispatch({ type: "RESET_FILTERS" });
  }, [snapshotForUndo]);

  const setTool = useCallback(
    (t: Tool) => dispatch({ type: "SET_TOOL", payload: t }),
    [],
  );

  const setZoom = useCallback(
    (z: number) => dispatch({ type: "SET_ZOOM", payload: z }),
    [],
  );

  const setPan = useCallback(
    (x: number, y: number) => dispatch({ type: "SET_PAN", payload: { x, y } }),
    [],
  );

  const startCrop = useCallback(() => {
    snapshotForUndo();
    dispatch({ type: "START_CROP" });
  }, [snapshotForUndo]);

  const applyCrop = useCallback(
    (dataUrl: string, width: number, height: number) =>
      dispatch({ type: "APPLY_CROP", payload: { dataUrl, width, height } }),
    [],
  );

  const cancelCrop = useCallback(() => dispatch({ type: "CANCEL_CROP" }), []);

  const startLayerCrop = useCallback(() => {
    snapshotForUndo();
    dispatch({ type: "START_LAYER_CROP" });
  }, [snapshotForUndo]);

  const setLayerCrop = useCallback(
    (changes: Partial<CropState>) =>
      dispatch({ type: "SET_LAYER_CROP", payload: changes }),
    [],
  );

  const cancelLayerCrop = useCallback(
    () => dispatch({ type: "CANCEL_LAYER_CROP" }),
    [],
  );

  const undo = useCallback(() => {
    const h = historyRef.current;
    const store = blobStoreRef.current;
    if (h.past.length === 0) return;
    const interned = h.past[h.past.length - 1];
    h.past = h.past.slice(0, -1);
    // Intern current state before pushing to future
    const currentInterned = internSnapshot(store, stateRef.current);
    h.future = [currentInterned, ...h.future];
    syncHistoryFlags();
    dispatch({
      type: "RESTORE_STATE",
      payload: resolveSnapshot(store, interned),
    });
    // Release blobs from the snapshot we just resolved (they're now live in state)
    releaseBlobs(store, interned);
  }, [syncHistoryFlags]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    const store = blobStoreRef.current;
    if (h.future.length === 0) return;
    const interned = h.future[0];
    h.future = h.future.slice(1);
    // Intern current state before pushing to past
    const currentInterned = internSnapshot(store, stateRef.current);
    h.past = [...h.past, currentInterned];
    syncHistoryFlags();
    dispatch({
      type: "RESTORE_STATE",
      payload: resolveSnapshot(store, interned),
    });
    releaseBlobs(store, interned);
  }, [syncHistoryFlags]);

  const value: EditorContextValue = useMemo(
    () => ({
      state,
      dispatch,
      loadImage,
      openImage,
      openImageFromUrl,
      addText,
      addImageOverlay,
      updateLayer,
      removeLayer,
      reorderLayer,
      selectLayer,
      setFilters,
      resetFilters,
      setTool,
      setZoom,
      setPan,
      startCrop,
      applyCrop,
      cancelCrop,
      startLayerCrop,
      setLayerCrop,
      cancelLayerCrop,
      snapshotForUndo,
      undo,
      redo,
      canUndo,
      canRedo,
      canvasActionsRef,
    }),
    [
      state,
      loadImage,
      openImage,
      openImageFromUrl,
      addText,
      addImageOverlay,
      updateLayer,
      removeLayer,
      reorderLayer,
      selectLayer,
      setFilters,
      resetFilters,
      setTool,
      setZoom,
      setPan,
      startCrop,
      applyCrop,
      cancelCrop,
      startLayerCrop,
      setLayerCrop,
      cancelLayerCrop,
      snapshotForUndo,
      undo,
      redo,
      canUndo,
      canRedo,
    ],
  );

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
}

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used within EditorProvider");
  return ctx;
}

export function buildFilterString(filters: FilterState): string {
  if (
    filters.brightness === 100 &&
    filters.contrast === 100 &&
    filters.saturation === 100 &&
    filters.hueRotate === 0 &&
    filters.blur === 0 &&
    filters.grayscale === 0 &&
    filters.sepia === 0 &&
    filters.invert === 0
  ) {
    return "none";
  }

  const parts: string[] = [];
  if (filters.brightness !== 100)
    parts.push(`brightness(${filters.brightness}%)`);
  if (filters.contrast !== 100) parts.push(`contrast(${filters.contrast}%)`);
  if (filters.saturation !== 100)
    parts.push(`saturate(${filters.saturation}%)`);
  if (filters.blur > 0) parts.push(`blur(${filters.blur}px)`);
  if (filters.grayscale > 0) parts.push(`grayscale(${filters.grayscale}%)`);
  if (filters.sepia > 0) parts.push(`sepia(${filters.sepia}%)`);
  if (filters.invert > 0) parts.push(`invert(${filters.invert}%)`);
  if (filters.hueRotate !== 0)
    parts.push(`hue-rotate(${filters.hueRotate}deg)`);
  return parts.length > 0 ? parts.join(" ") : "none";
}
