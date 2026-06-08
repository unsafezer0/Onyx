import { useState, useRef, useEffect } from "react";

const colorSwatches = [
  "#ffffff", "#000000", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  "#f43f5e", "#14b8a6", "#6366f1", "#a855f7", "#d946ef",
  "#fbbf24", "#34d399", "#60a5fa", "#c084fc", "#fb7185",
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hex, setHex] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setHex(value), [value]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const handleHexChange = (v: string) => {
    setHex(v);
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      onChange(v);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 transition-colors hover:border-primary/50"
      >
        <div
          className="h-4 w-4 rounded-sm border border-border"
          style={{ backgroundColor: value }}
        />
        <span className="text-xs font-mono text-muted-foreground">{value}</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-xl border border-border bg-popover p-3 shadow-xl animate-in">
          {/* Swatches */}
          <div className="grid grid-cols-5 gap-1.5 mb-3">
            {colorSwatches.map((c) => (
              <button
                key={c}
                onClick={() => { onChange(c); setHex(c); }}
                className={`h-6 w-6 rounded-md border transition-transform hover:scale-110 ${
                  value === c ? "border-primary ring-1 ring-primary" : "border-border/50"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          {/* Native color input */}
          <div className="flex items-center gap-2 mt-3">
            <input
              type="text"
              value={hex}
              onChange={(e) => handleHexChange(e.target.value)}
              className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono text-foreground outline-none focus:border-primary"
              placeholder="#000000"
            />
          </div>
        </div>
      )}
    </div>
  );
}
