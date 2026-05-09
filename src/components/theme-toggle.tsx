import { motion, AnimatePresence } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "./theme-provider";

function detectInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // Common embedded webviews with hit-testing quirks around fixed+backdrop-filter
  return /FBAN|FBAV|Instagram|Line\/|Twitter|Snapchat/i.test(ua);
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const [inApp, setInApp] = useState(false);

  useEffect(() => {
    setInApp(detectInAppBrowser());
  }, []);

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className={[
        "group fixed right-5 top-5 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-border-soft text-foreground",
        "transition hover:scale-105 active:scale-95 touch-manipulation",
        inApp ? "bg-surface-elevated shadow-[0_10px_30px_-16px_rgba(0,0,0,0.45)]" : "glass",
      ].join(" ")}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="flex"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
