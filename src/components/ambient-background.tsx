"use client";

export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-background">
      {/* Lamp effect — visible only in dark mode via CSS */}
      <div className="lamp-layers">
        {/* Bottom lamp — wide ambient wash with atmospheric glow */}
        <div
          className="absolute inset-x-0 bottom-0 h-[90vh] animate-[lamp-breathe_8s_ease-in-out_infinite]"
          style={{
            background:
              "radial-gradient(ellipse 100% 70% at 50% 115%, var(--lamp-color) 0%, transparent 65%)",
            filter: "blur(40px)",
          }}
        />
        {/* Bottom lamp — hot spot glow */}
        <div
          className="absolute inset-x-0 bottom-0 h-[60vh] animate-[lamp-breathe_8s_ease-in-out_infinite_1.5s]"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 110%, var(--lamp-color-strong) 0%, transparent 55%)",
            filter: "blur(20px)",
          }}
        />
        {/* Bottom lamp — core bright spot */}
        <div
          className="absolute inset-x-0 bottom-0 h-[35vh] animate-[lamp-breathe_8s_ease-in-out_infinite_3s]"
          style={{
            background:
              "radial-gradient(ellipse 35% 30% at 50% 108%, var(--lamp-color-strong) 0%, transparent 50%)",
          }}
        />
      </div>
    </div>
  );
}
