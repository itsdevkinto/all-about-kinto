import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Send } from "lucide-react";
import { AmbientBackground } from "@/components/ambient-background";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pokemon-game")({
  head: () => ({
    meta: [
      { title: "Pokemon Office — Andrei Lopez" },
      { name: "description", content: "A small chat-driven Pokemon-style scene." },
    ],
  }),
  component: PokemonGame,
});

type Role = "user" | "assistant";

type GameMessage = {
  id: string;
  role: Role;
  content: string;
  localOnly?: boolean;
};

type ActorId = "kinto" | "rdj";

type ActorState = {
  x: number;
  y: number;
};

const COLS = 18;
const ROWS = 11;
const TILE = 32;

function cellKey(x: number, y: number) {
  return `${x},${y}`;
}

const SPRITES: Record<ActorId, string> = {
  kinto: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/red.png",
  rdj: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/blue.png",
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function parseMoveCommand(text: string): { actor: ActorId; dx: number; dy: number } | null {
  const trimmed = text.trim();
  if (!trimmed.toLowerCase().startsWith("/move")) return null;

  const parts = trimmed.split(/\s+/).map((p) => p.toLowerCase());
  if (parts.length < 3) return null;

  const actor = parts[1] === "rdj" ? "rdj" : parts[1] === "kinto" ? "kinto" : null;
  if (!actor) return null;

  const dir = parts[2];
  const step = parts[3] ? Number(parts[3]) : 1;
  const amount = Number.isFinite(step) ? clamp(step, 1, 6) : 1;

  if (dir === "left") return { actor, dx: -amount, dy: 0 };
  if (dir === "right") return { actor, dx: amount, dy: 0 };
  if (dir === "up") return { actor, dx: 0, dy: -amount };
  if (dir === "down") return { actor, dx: 0, dy: amount };

  return null;
}

function PokemonGame() {
  const router = useRouter();

  useEffect(() => {
    router.navigate({ to: "/coming-soon", replace: true });
  }, [router]);

  const [messages, setMessages] = useState<GameMessage[]>([
    {
      id: "intro",
      role: "assistant",
      localOnly: true,
      content:
        "you’re in a pokemon-style office. me (kinto) and rdj are here, vibe coding a mini ‘jarvis’ setup.\n\ncommands: /move kinto left|right|up|down [1-6]  |  /move rdj left|right|up|down [1-6]",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [actors, setActors] = useState<Record<ActorId, ActorState>>({
    kinto: { x: 6, y: 6 },
    rdj: { x: 11, y: 6 },
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (cooldownUntil === null) return;
    const now = Date.now();
    if (now >= cooldownUntil) {
      setCooldownUntil(null);
      return;
    }

    const id = window.setInterval(() => {
      const t = Date.now();
      if (t >= cooldownUntil) setCooldownUntil(null);
    }, 200);

    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const sceneSummary = useMemo(() => {
    return `scene: pixel office. kinto at (${actors.kinto.x},${actors.kinto.y}), rdj at (${actors.rdj.x},${actors.rdj.y}). objects: computers, coffee machine, whiteboard.`;
  }, [actors.kinto.x, actors.kinto.y, actors.rdj.x, actors.rdj.y]);

  const blockedCells = useMemo(() => {
    const blocked = new Set<string>();

    const blockRect = (x0: number, y0: number, w: number, h: number) => {
      for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w; x++) {
          blocked.add(cellKey(x, y));
        }
      }
    };

    blockRect(2, 2, 3, 2);
    blockRect(7, 2, 3, 2);
    blockRect(14, 2, 2, 4);
    blockRect(11, 8, 5, 2);

    return blocked;
  }, []);

  const interactionCells = useMemo(() => {
    return {
      coffee: cellKey(12, 8),
      desks: cellKey(3, 4),
      whiteboard: cellKey(15, 6),
    };
  }, []);

  const tryStepMove = useCallback(
    (actor: ActorId, dx: number, dy: number) => {
      setActors((prev) => {
        const next = { ...prev };
        const curr = next[actor];
        const nx = clamp(curr.x + dx, 0, COLS - 1);
        const ny = clamp(curr.y + dy, 0, ROWS - 1);
        const other: ActorId = actor === "kinto" ? "rdj" : "kinto";

        if (blockedCells.has(cellKey(nx, ny))) return prev;
        if (prev[other].x === nx && prev[other].y === ny) return prev;

        next[actor] = { x: nx, y: ny };
        return next;
      });
    },
    [blockedCells],
  );

  useEffect(() => {
    const maybeEmitInteraction = (actor: ActorId) => {
      const pos = actors[actor];
      const key = cellKey(pos.x, pos.y);

      let content = "";
      if (key === interactionCells.coffee) {
        content =
          actor === "rdj"
            ? "rdj grabs coffee like it’s a side quest."
            : "i refill my coffee and glance at the monitors.";
      } else if (key === interactionCells.desks) {
        content =
          actor === "rdj"
            ? "rdj leans over the desk like he’s reviewing a PR."
            : "i tap the keyboard and tweak a setting.";
      } else if (key === interactionCells.whiteboard) {
        content =
          actor === "rdj"
            ? "rdj points at the whiteboard like he’s pitching the next feature."
            : "i stare at the whiteboard like it owes me answers.";
      }

      if (!content) return;

      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now().toString()}-${actor}-idle`,
          role: "assistant",
          localOnly: true,
          content,
        },
      ]);
    };

    maybeEmitInteraction("kinto");
    maybeEmitInteraction("rdj");
  }, [actors, interactionCells]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const roll = Math.random();
      if (roll < 0.35) {
        const dirs = [
          { dx: -1, dy: 0 },
          { dx: 1, dy: 0 },
          { dx: 0, dy: -1 },
          { dx: 0, dy: 1 },
        ];
        const dir = dirs[Math.floor(Math.random() * dirs.length)];
        tryStepMove("kinto", dir.dx, dir.dy);
      }

      if (roll > 0.55) {
        const dirs = [
          { dx: -1, dy: 0 },
          { dx: 1, dy: 0 },
          { dx: 0, dy: -1 },
          { dx: 0, dy: 1 },
        ];
        const dir = dirs[Math.floor(Math.random() * dirs.length)];
        tryStepMove("rdj", dir.dx, dir.dy);
      }
    }, 1100);

    return () => window.clearInterval(id);
  }, [tryStepMove]);

  const sendToAi = async (userText: string) => {
    const userMessage: GameMessage = {
      id: Date.now().toString(),
      role: "user",
      content: userText,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const MAX_MESSAGES_TO_SEND = 10;
      const apiMessages = [...messages, userMessage]
        .filter((m) => !m.localOnly)
        .slice(-MAX_MESSAGES_TO_SEND)
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
        }),
      });

      const data = (await response.json()) as {
        response?: string;
        error?: string;
        retryAfterMs?: number;
        model?: string;
      };

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfterMs = typeof data.retryAfterMs === "number" ? data.retryAfterMs : 10_000;
          setCooldownUntil(Date.now() + retryAfterMs);
          throw new Error(
            data.error || `rate limited. try again in ${Math.ceil(retryAfterMs / 1000)}s.`,
          );
        }

        throw new Error(data.error || "Failed to get response");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: data.response || "…",
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: error instanceof Error ? error.message : "something went wrong.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    if (cooldownUntil !== null && Date.now() < cooldownUntil) return;

    const cmd = parseMoveCommand(input);
    if (cmd) {
      const steps = Math.max(Math.abs(cmd.dx), Math.abs(cmd.dy));
      const dx = Math.sign(cmd.dx);
      const dy = Math.sign(cmd.dy);
      for (let i = 0; i < steps; i++) {
        tryStepMove(cmd.actor, dx, dy);
      }

      const actionText = `${input.trim()}\n${sceneSummary}\nroleplay: you are speaking as kinto, and rdj is also present. narrate the tiny movement + what we’re doing in the office while vibe coding jarvis.`;
      await sendToAi(actionText);
      return;
    }

    const text = `${input.trim()}\n${sceneSummary}\nroleplay: you are speaking as kinto, and rdj is also present in the room. keep it natural + chatty.`;
    await sendToAi(text);
  };

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  return (
    <>
      <AmbientBackground />
      <ThemeToggle />
      <div className="flex min-h-screen w-full items-center justify-center px-4 py-10">
        <main className="mx-auto w-full max-w-[1200px] px-2 sm:px-6">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl border border-border-soft bg-background px-3 py-2 text-sm text-foreground hover:bg-surface-muted"
            >
              <ArrowLeft className="h-4 w-4" />
              back
            </Link>
            <div className="text-sm text-muted-foreground">pokemon office</div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
            <div className="rounded-2xl border border-border-soft bg-background p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-medium text-foreground">office scene</div>
                <div className="text-xs text-muted-foreground">try: /move kinto right 2</div>
              </div>

              <div
                className={cn(
                  "relative overflow-hidden rounded-xl border border-border-soft",
                  "bg-surface-muted",
                )}
                style={{ height: ROWS * TILE }}
              >
                <div
                  className="absolute inset-0 opacity-60"
                  style={{
                    backgroundImage:
                      "linear-gradient(to right, color-mix(in oklab, var(--color-border-soft) 70%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--color-border-soft) 70%, transparent) 1px, transparent 1px)",
                    backgroundSize: `${TILE}px ${TILE}px`,
                  }}
                />

                <div
                  className="absolute rounded-lg border border-border-soft bg-background/90"
                  style={{
                    left: 2 * TILE,
                    top: 2 * TILE,
                    width: 3 * TILE,
                    height: 2 * TILE,
                  }}
                />
                <div
                  className="absolute rounded-md border border-border-soft bg-surface-muted"
                  style={{
                    left: 2 * TILE + 12,
                    top: 2 * TILE + 12,
                    width: TILE,
                    height: TILE / 2,
                  }}
                />

                <div
                  className="absolute rounded-lg border border-border-soft bg-background/90"
                  style={{
                    left: 7 * TILE,
                    top: 2 * TILE,
                    width: 3 * TILE,
                    height: 2 * TILE,
                  }}
                />
                <div
                  className="absolute rounded border border-border-soft bg-surface-muted"
                  style={{
                    left: 7 * TILE + 12,
                    top: 2 * TILE + 12,
                    width: TILE,
                    height: TILE / 2,
                  }}
                />

                <div
                  className="absolute rounded-xl border border-border-soft bg-background/90"
                  style={{ left: 14 * TILE, top: 2 * TILE, width: 2 * TILE, height: 4 * TILE }}
                />
                <div
                  className="absolute rounded-md border border-border-soft bg-surface-muted"
                  style={{
                    left: 14 * TILE + 12,
                    top: 2 * TILE + 18,
                    width: TILE,
                    height: TILE / 2,
                  }}
                />

                <div
                  className="absolute rounded-xl border border-border-soft bg-background/90"
                  style={{ left: 11 * TILE, top: 8 * TILE, width: 5 * TILE, height: 2 * TILE }}
                />

                <img
                  alt="kinto sprite"
                  src={SPRITES.kinto}
                  className="absolute h-16 w-16"
                  style={{
                    left: actors.kinto.x * TILE,
                    top: actors.kinto.y * TILE,
                    imageRendering: "pixelated",
                  }}
                />
                <img
                  alt="rdj sprite"
                  src={SPRITES.rdj}
                  className="absolute h-16 w-16"
                  style={{
                    left: actors.rdj.x * TILE,
                    top: actors.rdj.y * TILE,
                    imageRendering: "pixelated",
                  }}
                />

                <div className="absolute left-4 bottom-4 rounded-lg border border-border-soft bg-background/90 px-2 py-1 text-xs text-muted-foreground">
                  office vibes: computers + coffee + jarvis
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border-soft bg-background p-4">
              <div className="mb-3 text-sm font-medium text-foreground">chat</div>

              <div className="h-[320px] overflow-y-auto rounded-xl border border-border-soft bg-surface-muted p-3">
                <div className="flex flex-col gap-3">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "max-w-[92%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm",
                        m.role === "user"
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "bg-background text-foreground",
                      )}
                    >
                      {m.content}
                    </div>
                  ))}

                  {isLoading && (
                    <div className="animate-msg max-w-[92%] rounded-2xl bg-background px-3.5 py-2.5 text-sm text-foreground">
                      thinking…
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </div>

              <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="talk to kinto + rdj…"
                  className={cn(
                    "flex-1 rounded-xl border border-border-soft bg-background px-3 py-2.5",
                    "text-sm text-foreground placeholder:text-muted-foreground",
                    "focus:outline-none focus:ring-2 focus:ring-ring",
                  )}
                  disabled={isLoading || (cooldownUntil !== null && Date.now() < cooldownUntil)}
                />
                <button
                  type="submit"
                  disabled={
                    !input.trim() ||
                    isLoading ||
                    (cooldownUntil !== null && Date.now() < cooldownUntil)
                  }
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    "bg-primary text-primary-foreground transition-colors",
                    "hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>

              <div className="mt-2 text-xs text-muted-foreground">
                deepseek first, gemini fallback. message history is capped.
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
