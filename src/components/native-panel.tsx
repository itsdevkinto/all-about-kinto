import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type NativePanelProps = React.HTMLAttributes<HTMLDivElement> & {
  inset?: boolean;
};

export const NativePanel = forwardRef<HTMLDivElement, NativePanelProps>(function NativePanel(
  { className, inset = false, ...props },
  ref,
) {
  return (
    <div
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
