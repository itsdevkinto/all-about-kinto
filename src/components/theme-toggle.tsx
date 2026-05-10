import { Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      onTouchEnd={(e) => {
        e.preventDefault();
        toggle();
      }}
      aria-label="Toggle theme"
      className={[
        "group fixed right-5 top-5 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-border-soft text-foreground",
        "glass transition hover:scale-105 active:scale-95 touch-manipulation",
      ].join(" ")}
    >
      <span className="relative flex h-4 w-4">
        <Sun className="absolute inset-0 h-4 w-4 transition-transform duration-300 rotate-0 scale-100 dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute inset-0 h-4 w-4 transition-transform duration-300 rotate-90 scale-0 dark:rotate-0 dark:scale-100" />
      </span>
    </button>
  );
}
