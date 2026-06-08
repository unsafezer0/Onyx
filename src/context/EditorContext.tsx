import { createContext, useContext, useReducer, useCallback, type ReactNode } from "react";

export interface LayerBase {
  id: string;
  type: "text" | "image";
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  visible: boolean;
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
  | { type: "SELECT_LAYER"; payload: string | null }
  | { type: "SET_FILTERS"; payload: Partial<FilterState> }
  | { type: "RESET_FILTERS" }
  | { type: "SET_CROP"; payload: Partial<CropState> }
  | { type: "START_CROP" }
  | { type: "APPLY_CROP"; payload: { dataUrl: string; width: number; height: number } }
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
        layerCrop: action.payload !== "cropLayer" ? { ...defaultCrop } : state.layerCrop,
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
          t.id === action.payload.id ? { ...t, ...action.payload.changes } as Layer : t,
        ),
        isDirty: true,
      };

    case "REMOVE_LAYER":
      return {
        ...state,
        layers: state.layers.filter((t) => t.id !== action.payload),
        selectedLayerId:
          state.selectedLayerId === action.payload ? null : state.selectedLayerId,
        isDirty: true,
      };

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

interface EditorContextValue {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  loadImage: (info: ImageInfo) => void;
  addText: (overrides?: Partial<TextLayer>) => void;
  addImageOverlay: (dataUrl: string, width: number, height: number, overrides?: Partial<ImageLayer>) => void;
  updateLayer: (id: string, changes: Partial<Layer>) => void;
  removeLayer: (id: string) => void;
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
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const EditorContext = createContext<EditorContextValue | null>(null);

let idCounter = 0;
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${++idCounter}`;
}

const maxHistory = 30;

export function EditorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(editorReducer, initialState);

  const loadImage = useCallback(
    (info: ImageInfo) => {
      historyStorage.past = [];
      historyStorage.future = [];
      dispatch({ type: "LOAD_IMAGE", payload: info });
    },
    [],
  );

  const pushHistory = useCallback(
    (currentState: EditorState) => {
      historyStorage.past = [
        ...historyStorage.past.slice(-(maxHistory - 1)),
        currentState,
      ];
      historyStorage.future = [];
    },
    [],
  );

  const addText = useCallback(
    (overrides?: Partial<TextLayer>) => {
      pushHistory(state);
      const newText: TextLayer = {
        id: generateId("text"),
        type: "text",
        text: "Double-click to edit",
        x: (state.image?.width ?? 400) / 2 - 100,
        y: (state.image?.height ?? 300) / 2,
        fontSize: 32,
        fontFamily: "system-ui",
        color: "#ffffff",
        bold: false,
        italic: false,
        rotation: 0,
        opacity: 1,
        visible: true,
        strokeColor: "",
        strokeWidth: 0,
        backgroundColor: "",
        ...overrides,
      };
      dispatch({ type: "ADD_LAYER", payload: newText });
    },
    [state, pushHistory],
  );

  const addImageOverlay = useCallback(
    (dataUrl: string, width: number, height: number, overrides?: Partial<ImageLayer>) => {
      pushHistory(state);
      const newImage: ImageLayer = {
        id: generateId("img"),
        type: "image",
        dataUrl,
        width,
        height,
        x: (state.image?.width ?? 400) / 2 - width / 2,
        y: (state.image?.height ?? 300) / 2 - height / 2,
        rotation: 0,
        opacity: 1,
        visible: true,
        ...overrides,
      };
      dispatch({ type: "ADD_LAYER", payload: newImage });
    },
    [state, pushHistory],
  );

  const updateLayer = useCallback(
    (id: string, changes: Partial<Layer>) => {
      dispatch({ type: "UPDATE_LAYER", payload: { id, changes } });
    },
    [],
  );

  const removeLayer = useCallback(
    (id: string) => {
      pushHistory(state);
      dispatch({ type: "REMOVE_LAYER", payload: id });
    },
    [state, pushHistory],
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
    pushHistory(state);
    dispatch({ type: "RESET_FILTERS" });
  }, [state, pushHistory]);

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
    pushHistory(state);
    dispatch({ type: "START_CROP" });
  }, [state, pushHistory]);

  const applyCrop = useCallback(
    (dataUrl: string, width: number, height: number) =>
      dispatch({ type: "APPLY_CROP", payload: { dataUrl, width, height } }),
    [],
  );

  const cancelCrop = useCallback(() => dispatch({ type: "CANCEL_CROP" }), []);

  const startLayerCrop = useCallback(() => {
    pushHistory(state);
    dispatch({ type: "START_LAYER_CROP" });
  }, [state, pushHistory]);

  const setLayerCrop = useCallback(
    (changes: Partial<CropState>) => dispatch({ type: "SET_LAYER_CROP", payload: changes }),
    [],
  );

  const cancelLayerCrop = useCallback(() => dispatch({ type: "CANCEL_LAYER_CROP" }), []);

  const undo = useCallback(() => {
    if (historyStorage.past.length === 0) return;
    const prev = historyStorage.past[historyStorage.past.length - 1];
    historyStorage.past = historyStorage.past.slice(0, -1);
    historyStorage.future = [state, ...historyStorage.future];
    dispatch({ type: "RESTORE_STATE", payload: prev });
  }, [state]);

  const redo = useCallback(() => {
    if (historyStorage.future.length === 0) return;
    const next = historyStorage.future[0];
    historyStorage.future = historyStorage.future.slice(1);
    historyStorage.past = [...historyStorage.past, state];
    dispatch({ type: "RESTORE_STATE", payload: next });
  }, [state]);

  const value: EditorContextValue = {
    state,
    dispatch,
    loadImage,
    addText,
    addImageOverlay,
    updateLayer,
    removeLayer,
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
    undo,
    redo,
    canUndo: historyStorage.past.length > 0,
    canRedo: historyStorage.future.length > 0,
  };

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
}

const historyStorage: { past: EditorState[]; future: EditorState[] } = {
  past: [],
  future: [],
};

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
  if (filters.brightness !== 100) parts.push(`brightness(${filters.brightness}%)`);
  if (filters.contrast !== 100) parts.push(`contrast(${filters.contrast}%)`);
  if (filters.saturation !== 100) parts.push(`saturate(${filters.saturation}%)`);
  if (filters.blur > 0) parts.push(`blur(${filters.blur}px)`);
  if (filters.grayscale > 0) parts.push(`grayscale(${filters.grayscale}%)`);
  if (filters.sepia > 0) parts.push(`sepia(${filters.sepia}%)`);
  if (filters.invert > 0) parts.push(`invert(${filters.invert}%)`);
  if (filters.hueRotate !== 0) parts.push(`hue-rotate(${filters.hueRotate}deg)`);
  return parts.length > 0 ? parts.join(" ") : "none";
}
