"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialTheme(): Theme {
  // Read from DOM class set by inline script (runs before React hydrates).
  // This guarantees hydration matches what the browser already rendered.
  if (typeof window !== "undefined") {
    const cls = document.documentElement.className;
    if (cls === "dark" || cls === "light") return cls;
  }

  return "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Read theme from DOM class (set by inline script before React hydrates).
  // This ensures the first client render matches what the browser already has,
  // preventing hydration mismatches that break React in FB/Messenger webviews.
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

  // Sync theme to DOM
  useIsomorphicLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
  }, [theme]);

  // Persist theme changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // Ignore if localStorage is blocked
    }
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme: setThemeState,
        toggle: () => setThemeState((t) => (t === "dark" ? "light" : "dark")),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
