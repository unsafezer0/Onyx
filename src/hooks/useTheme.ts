import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (t: Theme) => void;
  cycle: () => void;
}

const themeStorageKey = "theme";

export const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  resolved: "dark",
  setTheme: () => {},
  cycle: () => {},
});

export function useThemeProvider() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(themeStorageKey) as Theme | null;
    return stored ?? "dark";
  });

  const [resolved, setResolved] = useState<"light" | "dark">(theme);

  const apply = useCallback((t: Theme) => {
    setResolved(t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }, []);

  const setTheme = useCallback(
    (t: Theme) => {
      setThemeState(t);
      localStorage.setItem(themeStorageKey, t);
      apply(t);
    },
    [apply],
  );

  const cycle = useCallback(() => {
    const order: Theme[] = ["light", "dark"];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
  }, [theme, setTheme]);

  useEffect(() => {
    apply(theme);
  }, [apply, theme]);

  return { theme, resolved, setTheme, cycle } satisfies ThemeContextValue;
}

export function useTheme() {
  return useContext(ThemeContext);
}
