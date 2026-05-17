import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AmbientBackground } from "@/components/ambient-background";
import { RoomScene } from "@/components/room-scene";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/room")({
  head: () => ({
    meta: [
      { title: "Room — Andrei Lopez" },
      {
        name: "description",
        content: "A small atmospheric pixel room. Late-night workspace, quiet things to look at.",
      },
      { property: "og:title", content: "Room — Andrei Lopez" },
      {
        property: "og:description",
        content: "A quiet pixel room you can wander through.",
      },
    ],
  }),
  component: RoomPage,
  ssr: false,
});

function RoomPage() {
  return (
    <>
      <AmbientBackground />
      <ThemeToggle />
      <main className="animate-fade-up mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-[12px] text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          back
        </Link>

        <header className="mb-6">
          <h1 className="text-[20px] font-semibold tracking-tight text-foreground">the room</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            a quiet corner. wander around, press E on anything that catches your eye.
          </p>
        </header>

        <RoomScene />
      </main>
    </>
  );
}
