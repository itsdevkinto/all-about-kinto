import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Github, Music2, Mail, Link as LinkIcon, Mic, Gamepad2 } from "lucide-react";
import { AmbientBackground } from "@/components/ambient-background";
import { ChatButton, ChatModal } from "@/components/chat-modal";
import { FloatingShell } from "@/components/floating-shell";
import { IdentityCard } from "@/components/identity-card";
import { SystemLinkCard } from "@/components/system-link-card";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "kinto-io" },
      {
        name: "description",
        content: "A small floating space for links and quiet thoughts.",
      },
      { property: "og:title", content: "Andrei Lopez" },
      { property: "og:description", content: "Everything with God." },
    ],
  }),
  component: Index,
});

function Index() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <>
      <AmbientBackground />
      <ThemeToggle />
      <div className="flex min-h-screen w-full items-center justify-center">
        <FloatingShell>
          <IdentityCard />

          <div className="mt-6 flex flex-col gap-4">
            <SystemLinkCard
              icon={<LinkIcon className="h-5 w-5" />}
              label="Portfolio"
              description="selected work and case studies"
              href="/coming-soon"
              delay={0.12}
            />
            <SystemLinkCard
              icon={<Gamepad2 className="h-5 w-5" />}
              label="Pokemon Office"
              description="chat-driven pixel scene"
              href="/coming-soon"
              delay={0.15}
            />
            <SystemLinkCard
              icon={<Github className="h-5 w-5" />}
              label="GitHub"
              description="open source, side projects, late commits"
              href="https://github.com/itsdevkinto"
              delay={0.18}
            />
            <SystemLinkCard
              icon={<Music2 className="h-5 w-5" />}
              label="Playlist"
              description="what's been on repeat lately"
              href="https://open.spotify.com/playlist/0X6n3rAWIETGWVlpdRFcl4?si=y2qeApd-QZms0LKwwdRKOQ"
              delay={0.24}
            />
            <SystemLinkCard
              icon={<Mic className="h-5 w-5" />}
              label="Podcast"
              description="conversations on faith and craft"
              href="/coming-soon"
              delay={0.3}
            />
          </div>

          <motion.footer
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.55 }}
            className="mt-4 flex items-center justify-center gap-2 text-[11px] text-muted-foreground/70"
          >
            <span>made quietly</span>
            <span className="h-0.5 w-0.5 rounded-full bg-muted-foreground/40" />
            <span>{new Date().getFullYear()}</span>
          </motion.footer>
        </FloatingShell>
      </div>

      <ChatButton onClick={() => setIsChatOpen(true)} />
      <ChatModal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </>
  );
}
