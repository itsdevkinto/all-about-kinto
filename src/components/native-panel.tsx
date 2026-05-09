import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type NativePanelProps = HTMLMotionProps<"div"> & {
  inset?: boolean;
};

export const NativePanel = forwardRef<HTMLDivElement, NativePanelProps>(function NativePanel(
  { className, inset = false, ...props },
  ref,
) {
  return (
    <motion.div
      ref={ref}
      className={cn(
        "glass relative rounded-3xl border border-border-soft",
        inset ? "p-3" : "p-5",
        className,
      )}
      {...props}
    />
  );
});
