import { useState, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import { CaretDown } from "@phosphor-icons/react";

export interface SelectOption {
  value: string;
  label: string;
  style?: React.CSSProperties;
}

interface CustomSelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  renderValue?: (option: SelectOption) => ReactNode;
}

export default function CustomSelect({
  value,
  options,
  onChange,
  renderValue,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const selectedOption = options.find((o) => o.value === value) || options[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none hover:border-primary"
      >
        {renderValue ? (
          renderValue(selectedOption)
        ) : (
          <span style={selectedOption?.style}>{selectedOption?.label}</span>
        )}
        <CaretDown weight="bold" className="opacity-50" />
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-md">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-1.5 text-left text-xs hover:bg-muted ${
                value === opt.value
                  ? "bg-muted font-medium text-primary"
                  : "text-foreground"
              }`}
              style={opt.style}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
