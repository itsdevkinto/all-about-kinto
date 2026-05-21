"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function ChatButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      onTouchEnd={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={cn(
        "fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full px-4 py-3",
        "bg-foreground text-background shadow-lg transition-transform duration-300 touch-manipulation",
        "hover:scale-105 hover:shadow-xl active:scale-95",
      )}
      aria-label="Open chat"
    >
      <MessageCircle className="h-5 w-5" />
      <span className="text-sm font-medium">Talk to my AI version.</span>
    </button>
  );
}

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1") // **bold**
    .replace(/\*(.+?)\*/g, "$1") // *italic*
    .replace(/__(.+?)__/g, "$1") // __bold__
    .replace(/~~(.+?)~~/g, "$1") // ~~strikethrough~~
    .replace(/`(.+?)`/g, "$1") // `inline code`
    .replace(/^#{1,6}\s+/gm, "") // # headers
    .replace(/^\s*[-*+]\s+/gm, "") // - bullet points
    .replace(/^\s*\d+\.\s+/gm, "") // 1. numbered lists
    .replace(/\[(.+?)\]\(.+?\)/g, "$1") // [links](url)
    .replace(/^>\s+/gm, "") // > blockquotes
    .trim();
}

export function ChatModal({ isOpen, onClose }: ChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `hey, i’m Andrei. i'd prefer if you just call me kinto though.
        i’m into lifting, design, music, and i’m also an aspiring software engineer, still figuring things out as i go but i genuinely enjoy building and learning new things.
        I’m usually at the gym, listening to music, playing games.
        i’m pretty easygoing though. a bit reserved at first maybe, but i get along with people naturally once i’m comfortable. :)`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (cooldownUntil === null) return;
    const now = Date.now();
    if (now >= cooldownUntil) {
      setCooldownUntil(null);
      return;
    }

    const id = window.setInterval(() => {
      const t = Date.now();
      if (t >= cooldownUntil) {
        setCooldownUntil(null);
      }
    }, 200);

    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    if (cooldownUntil !== null && Date.now() < cooldownUntil) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const MAX_MESSAGES_TO_SEND = 10;
      const apiMessages = [...messages, userMessage]
        .filter((m) => m.id !== "welcome")
        .slice(-MAX_MESSAGES_TO_SEND)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

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
          content: stripMarkdown(data.response || "hmm, not sure what to say to that"),
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content:
            error instanceof Error ? error.message : "sorry, something went wrong. try again?",
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  return (
    <>
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="animate-backdrop fixed inset-0 z-50 bg-background/60"
            onClick={onClose}
            onTouchEnd={(e) => {
              e.preventDefault();
              onClose();
            }}
          />

          {/* Modal */}
          <div
            className={cn(
              "animate-modal fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-48px)] overflow-hidden rounded-2xl",
              "border border-border-soft bg-background shadow-2xl",
              "sm:right-6 sm:max-w-[380px]",
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-soft px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-foreground">kinto</span>
              </div>
              <button
                onClick={onClose}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  onClose();
                }}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="h-[400px] overflow-y-auto px-4 py-4">
              <div className="flex flex-col gap-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "animate-msg max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
                      message.role === "user"
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "bg-surface-muted text-foreground",
                    )}
                  >
                    {message.content}
                  </div>
                ))}
                {isLoading && (
                  <div className="animate-msg max-w-[85%] rounded-2xl bg-surface-muted px-3.5 py-2.5 text-sm text-foreground">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground delay-100" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground delay-200" />
                    </span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="border-t border-border-soft p-3">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="say something..."
                  className={cn(
                    "flex-1 rounded-xl border border-border-soft bg-background px-3 py-2.5",
                    "text-sm text-foreground placeholder:text-muted-foreground",
                    "focus:outline-none focus:ring-2 focus:ring-ring",
                  )}
                  readOnly={isLoading || (cooldownUntil !== null && Date.now() < cooldownUntil)}
                />
                <button
                  type="submit"
                  disabled={
                    !input.trim() ||
                    isLoading ||
                    (cooldownUntil !== null && Date.now() < cooldownUntil)
                  }
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl",
                    "bg-primary text-primary-foreground transition-colors",
                    "hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed",
                  )}
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </>
  );
}
