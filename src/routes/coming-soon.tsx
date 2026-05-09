import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowLeft, Clock } from "lucide-react";
import { AmbientBackground } from "@/components/ambient-background";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/coming-soon")({
  head: () => ({
    meta: [
      { title: "Coming Soon —  Andrei Lopez" },
      { name: "description", content: "This page is under construction." },
    ],
  }),
  component: ComingSoon,
});

function ComingSoon() {
  return (
    <>
      <AmbientBackground />
      <ThemeToggle />
      <div className="flex min-h-screen w-full items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-border-soft bg-surface-muted">
            <Clock className="h-8 w-8 text-muted-foreground" />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Coming Soon</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This page is under construction. Check back later.
          </p>

          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border-soft bg-surface-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-elevated"
          >
            <ArrowLeft className="h-4 w-4" />
            Back home
          </Link>
        </motion.div>
      </div>
    </>
  );
}
