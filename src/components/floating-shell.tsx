"use client";

import type { ReactNode } from "react";

export function FloatingShell({ children }: { children: ReactNode }) {
  return (
    <main className="animate-fade-up mx-auto w-full max-w-110 px-5 py-10 sm:py-14">
      <div className="flex flex-col gap-4">{children}</div>
    </main>
  );
}
