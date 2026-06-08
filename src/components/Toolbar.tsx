import { useEditor, type Tool } from "../context/EditorContext";
import {
  Cursor,
  TextT,
  Crop,
  Hand,
} from "@phosphor-icons/react";

const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
  { id: "select", icon: <Cursor size={20} weight="duotone" />, label: "Select / Move" },
  { id: "text", icon: <TextT size={20} weight="duotone" />, label: "Text" },
  { id: "crop", icon: <Crop size={20} weight="duotone" />, label: "Crop" },
  { id: "pan", icon: <Hand size={20} weight="duotone" />, label: "Pan" },
];

export default function Toolbar() {
  const { state, setTool, startCrop } = useEditor();

  const handleToolClick = (id: Tool) => {
    if (id === "crop") {
      startCrop();
    } else {
      setTool(id);
    }
  };

  return (
    <div className="flex w-12 flex-col items-center gap-1 border-r border-border bg-card/50 py-3 backdrop-blur-sm">
      {tools.map(({ id, icon, label }) => (
        <div key={id} className="group relative flex items-center justify-center">
          <button
            onClick={() => handleToolClick(id)}
            className={`flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-150 ${
              state.activeTool === id
                ? "bg-primary/15 text-primary shadow-sm shadow-primary/10"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
          >
            {icon}
          </button>
          <div className="pointer-events-none absolute left-full top-1/2 z-[100] ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[10px] font-medium text-popover-foreground shadow-md opacity-0 transition-all duration-200 group-hover:opacity-100">
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}
