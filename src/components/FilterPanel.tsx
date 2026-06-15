import {
  useEditor,
  defaultFilters,
  type FilterState,
} from "../context/EditorContext";
import { ArrowCounterClockwise } from "@phosphor-icons/react";

interface SliderDef {
  key: keyof FilterState;
  label: string;
  min: number;
  max: number;
  unit: string;
  defaultValue: number;
}

const sliders: SliderDef[] = [
  {
    key: "brightness",
    label: "Brightness",
    min: 0,
    max: 200,
    unit: "%",
    defaultValue: 100,
  },
  {
    key: "contrast",
    label: "Contrast",
    min: 0,
    max: 200,
    unit: "%",
    defaultValue: 100,
  },
  {
    key: "saturation",
    label: "Saturation",
    min: 0,
    max: 200,
    unit: "%",
    defaultValue: 100,
  },
  {
    key: "hueRotate",
    label: "Hue Rotate",
    min: -180,
    max: 180,
    unit: "°",
    defaultValue: 0,
  },
  { key: "blur", label: "Blur", min: 0, max: 20, unit: "px", defaultValue: 0 },
  {
    key: "grayscale",
    label: "Grayscale",
    min: 0,
    max: 100,
    unit: "%",
    defaultValue: 0,
  },
  {
    key: "sepia",
    label: "Sepia",
    min: 0,
    max: 100,
    unit: "%",
    defaultValue: 0,
  },
  {
    key: "invert",
    label: "Invert",
    min: 0,
    max: 100,
    unit: "%",
    defaultValue: 0,
  },
];

interface Preset {
  name: string;
  filters: Partial<FilterState>;
}

const presets: Preset[] = [
  {
    name: "Vintage",
    filters: { sepia: 40, brightness: 110, contrast: 85, saturation: 70 },
  },
  {
    name: "Cool",
    filters: { hueRotate: -20, brightness: 105, saturation: 90, contrast: 110 },
  },
  {
    name: "Warm",
    filters: { hueRotate: 15, brightness: 108, saturation: 120, contrast: 95 },
  },
  {
    name: "B&W",
    filters: { grayscale: 100, contrast: 120 },
  },
  {
    name: "Dramatic",
    filters: { contrast: 150, brightness: 90, saturation: 130 },
  },
  {
    name: "Fade",
    filters: { brightness: 115, contrast: 80, saturation: 80, sepia: 10 },
  },
];

export default function FilterPanel() {
  const { state, setFilters, resetFilters, snapshotForUndo } = useEditor();

  const isDefault = (key: keyof FilterState) =>
    state.filters[key] === defaultFilters[key];

  const allDefault = sliders.every((s) => isDefault(s.key));

  const isPresetActive = (preset: Preset) => {
    // Check if current filter state exactly matches this preset
    for (const key of Object.keys(defaultFilters) as (keyof FilterState)[]) {
      const expectedValue = preset.filters[key] ?? defaultFilters[key];
      if (state.filters[key] !== expectedValue) return false;
    }
    return true;
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Presets */}
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium text-muted-foreground mb-1">
          Presets
        </h4>
        <div className="grid grid-cols-3 gap-1.5">
          {presets.map((p) => {
            const active = isPresetActive(p);
            return (
              <button
                key={p.name}
                onClick={() => {
                  resetFilters();
                  // Slight delay for state to settle, then apply preset
                  setTimeout(() => setFilters(p.filters), 0);
                }}
                disabled={!state.image}
                className={`rounded-lg border px-2 py-2 text-[10px] font-medium transition-all active:scale-95 disabled:opacity-30 ${
                  active
                    ? "border-primary bg-primary/20 text-primary hover:bg-primary/30"
                    : "border-border bg-muted/50 text-foreground/80 hover:border-primary/30 hover:bg-accent/60"
                }`}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sliders */}
      <div className="flex flex-col gap-3">
        <h4 className="text-sm font-medium text-muted-foreground mb-1">
          Adjustments
        </h4>
        {sliders.map((s) => (
          <div key={s.key} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-muted-foreground/90">
                {s.label}
              </label>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {state.filters[s.key]}
                {s.unit}
              </span>
            </div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              value={state.filters[s.key]}
              onChange={(e) => setFilters({ [s.key]: Number(e.target.value) })}
              onPointerDown={snapshotForUndo}
              disabled={!state.image}
              className="w-full accent-primary cursor-pointer"
            />
          </div>
        ))}
      </div>

      {/* Reset */}
      <button
        onClick={resetFilters}
        disabled={allDefault || !state.image}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground disabled:opacity-30"
      >
        <ArrowCounterClockwise size={12} />
        Reset All Filters
      </button>
    </div>
  );
}
