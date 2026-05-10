import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SystemLinkCardProps {
  icon: ReactNode;
  label: string;
  description: string;
  href: string;
  accent?: string;
  delay?: number;
  size?: "default" | "large";
}

export function SystemLinkCard({
  icon,
  label,
  description,
  href,
  accent,
  delay = 0,
  size = "default",
}: SystemLinkCardProps) {
  const isLarge = size === "large";
  const isExternal = href.startsWith("http");

  const cardContent = (
    <>
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl border border-border-soft bg-surface-muted text-foreground",
          isLarge ? "h-14 w-14" : "h-11 w-11",
        )}
        style={
          accent
            ? {
                background: `linear-gradient(140deg, color-mix(in oklab, ${accent} 22%, var(--color-surface-muted)), var(--color-surface-muted))`,
              }
            : undefined
        }
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "font-semibold leading-tight tracking-tight text-foreground",
            isLarge ? "text-[16px]" : "text-[14.5px]",
          )}
        >
          {label}
        </div>
        <div
          className={cn(
            "mt-0.5 truncate text-muted-foreground",
            isLarge ? "text-[13px]" : "text-[12.5px]",
          )}
        >
          {description}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
    </>
  );

  const className = cn(
    "glass group relative flex items-center gap-4 rounded-2xl border border-border-soft transition-transform duration-600 ease-[cubic-bezier(0.15,1,0.25,1)] will-change-transform",
    "hover:-translate-y-1 hover:scale-105 hover:border-border hover:shadow-[0_16px_48px_-8px_var(--lamp-color-strong)] active:translate-y-0 active:scale-100 active:duration-100",
    isLarge ? "px-5 py-5" : "px-4 py-3.5",
  );

  const delayClass =
    delay <= 0.12
      ? "delay-1"
      : delay <= 0.15
        ? "delay-2"
        : delay <= 0.18
          ? "delay-3"
          : delay <= 0.24
            ? "delay-4"
            : delay <= 0.3
              ? "delay-5"
              : "delay-5";

  return (
    <div className={cn("animate-fade-up-sm", delayClass)}>
      {isExternal ? (
        <a href={href} target="_blank" rel="noreferrer" className={className}>
          {cardContent}
        </a>
      ) : (
        <Link to={href} className={className}>
          {cardContent}
        </Link>
      )}
    </div>
  );
}
