import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function FloatingShell({ children }: { children: ReactNode }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto w-full max-w-110 px-5 py-10 sm:py-14"
    >
      <div className="flex flex-col gap-4">{children}</div>
    </motion.main>
  );
}
