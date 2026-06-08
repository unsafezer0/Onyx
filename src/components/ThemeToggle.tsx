import { Sun, Moon, Monitor } from "@phosphor-icons/react";
import type { Theme } from "../hooks/useTheme";
import { useTheme } from "../hooks/useTheme";

const icons: Record<Theme, React.ReactNode> = {
  light: <Sun size={16} />,
  dark: <Moon size={16} />,
  system: <Monitor size={16} />,
};

const labels: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export default function ThemeToggle() {
  const { theme, cycle } = useTheme();

  return (
    <button
      onClick={cycle}
      className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      title={`Theme: ${labels[theme]}`}
    >
      {icons[theme]}
      <span>{labels[theme]}</span>
    </button>
  );
}
