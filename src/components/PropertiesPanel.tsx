import { useState, useMemo } from "react";
import { useEditor } from "../context/EditorContext";
import LayerProperties from "./LayerProperties";
import FilterPanel from "./FilterPanel";
import { TextT, FunnelSimple } from "@phosphor-icons/react";

type Tab = "layers" | "filters";

export default function PropertiesPanel() {
  const { state } = useEditor();
  const [selectedTab, setSelectedTab] = useState<Tab>("layers");

  // When text tool is active, always show the layers tab regardless of selection
  const activeTab = useMemo<Tab>(
    () => (state.activeTool === "text" ? "layers" : selectedTab),
    [state.activeTool, selectedTab],
  );

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "layers", label: "Layers", icon: <TextT size={15} /> },
    { id: "filters", label: "Filters", icon: <FunnelSimple size={15} /> },
  ];

  return (
    <div className="flex w-64 flex-col border-l border-border bg-card/30 backdrop-blur-sm">
      {/* Tab bar */}
      <div className="flex border-b border-border">
        {tabs.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setSelectedTab(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
              activeTab === id
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "layers" && <LayerProperties />}
        {activeTab === "filters" && <FilterPanel />}
      </div>
    </div>
  );
}
