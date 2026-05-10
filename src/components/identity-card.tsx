import { NativePanel } from "./native-panel";
import { Button } from "./ui/button";
import avatar from "@/assets/avatar.jpg";
import { Mail } from "lucide-react";

export function IdentityCard() {
  return (
    <NativePanel className="animate-fade-up flex flex-col">
      <div className="flex items-center gap-4 border-b border-border-soft pb-4">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full ring-1 ring-border">
          <img
            src={avatar}
            alt="Profile"
            width={256}
            height={256}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[16px] font-semibold tracking-tight text-foreground">Andrei Lopez</h1>
          <p className="text-[13px] text-muted-foreground">Everything with God</p>
        </div>
      </div>
      <div className="animate-fade-in delay-6 flex flex-col gap-3 pt-4">
        <div className="flex items-center gap-4">
          <div className="flex shrink-0 items-center justify-center rounded-lg text-muted-foreground">
            <Mail className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-medium text-foreground">Email me</div>
            <div className="truncate text-[13px] text-muted-foreground">yo.kinto.x@gmail.com</div>
          </div>
        </div>
        <Button
          asChild
          className="w-full border-foreground/20 bg-foreground text-background hover:bg-foreground/90 dark:bg-foreground dark:text-background dark:hover:bg-foreground/80"
        >
          <a href="mailto:yo.kinto.x@gmail.com" className="py-6">
            Let's connect
          </a>
        </Button>
      </div>
    </NativePanel>
  );
}
