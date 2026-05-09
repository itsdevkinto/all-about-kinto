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
  // Try localStorage first (works in most environments)
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("theme") as Theme | null;
      if (stored && (stored === "dark" || stored === "light")) {
        return stored;
      }
    } catch {
      // localStorage blocked or unavailable (WebView environments)
    }

    // Fall back to system preference
    try {
      if (window.matchMedia("(prefers-color-scheme: light)").matches) {
        return "light";
      }
    } catch {
      // matchMedia not available
    }
  }

  return "light"; // Final fallback (safer default for in-app browsers)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Hydration-safe: keep first render consistent across SSR + client,
  // then resolve real preference after mount.
  const [theme, setThemeState] = useState<Theme>("light");

  const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

  // Resolve initial theme after mount (storage/system preference)
  useEffect(() => {
    setThemeState(getInitialTheme());
  }, []);

  // Sync theme to DOM (before paint on client when possible)
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
