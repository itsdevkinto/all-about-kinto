"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type Interactable = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  cx?: number;
  cy?: number;
  cw?: number;
  ch?: number;
  ix?: number;
  iy?: number;
  // Primary sequence shown in order on first visit
  lines: string[];
  // Random pool shown after primary sequence is exhausted
  repeatLines?: string[];
  // Lines the character mutters autonomously during idle wandering
  idleLines?: string[];
};

const REPEAT_LIMIT = 3; // how many bonus repeat interactions allowed after primary sequence

// Dialogue state — module-level so it survives re-renders
const dlgState: Record<
  string,
  {
    seqIdx: number;
    seqDone: boolean;
    repeatCount: number; // how many repeat-line interactions have been used
    lastLine: string;
    idleCooldown: number; // timestamp (ms) before idle can trigger again
  }
> = {};

const WORLD_W = 720;
const WORLD_H = 520;
const GRID_SIZE = 32; // bigger tiles, Pokemon-style movement

// A* pathfinding with snap-to-nearest logic
class PathFinder {
  private grid: boolean[][] = [];
  private gridW: number = 0;
  private gridH: number = 0;

  constructor() {
    this.gridW = Math.ceil(WORLD_W / GRID_SIZE);
    this.gridH = Math.ceil(WORLD_H / GRID_SIZE);
    this.grid = Array(this.gridH)
      .fill(null)
      .map(() => Array(this.gridW).fill(false));
  }

  setBlocked(x: number, y: number, w: number, h: number) {
    const x1 = Math.max(0, Math.floor(x / GRID_SIZE));
    const x2 = Math.min(this.gridW - 1, Math.floor((x + w - 1) / GRID_SIZE));
    const y1 = Math.max(0, Math.floor(y / GRID_SIZE));
    const y2 = Math.min(this.gridH - 1, Math.floor((y + h - 1) / GRID_SIZE));
    for (let gy = y1; gy <= y2; gy++) {
      for (let gx = x1; gx <= x2; gx++) {
        this.grid[gy][gx] = true;
      }
    }
  }

  isBlocked(x: number, y: number): boolean {
    const gx = Math.round((x - GRID_SIZE / 2) / GRID_SIZE);
    const gy = Math.round((y - GRID_SIZE / 2) / GRID_SIZE);
    if (gx < 0 || gx >= this.gridW || gy < 0 || gy >= this.gridH) return true;
    return this.grid[gy][gx];
  }

  // Find nearest walkable point within search radius
  findNearestWalkable(x: number, y: number, maxRadius: number = 200): [number, number] | null {
    const startGx = Math.round((x - GRID_SIZE / 2) / GRID_SIZE);
    const startGy = Math.round((y - GRID_SIZE / 2) / GRID_SIZE);
    const maxGridRadius = Math.ceil(maxRadius / GRID_SIZE);

    let nearest: [number, number] | null = null;
    let nearestDist = Infinity;

    for (let radius = 0; radius <= maxGridRadius; radius++) {
      for (
        let gx = Math.max(0, startGx - radius);
        gx <= Math.min(this.gridW - 1, startGx + radius);
        gx++
      ) {
        for (
          let gy = Math.max(0, startGy - radius);
          gy <= Math.min(this.gridH - 1, startGy + radius);
          gy++
        ) {
          // Only check cells on current radius ring to optimize
          if (Math.abs(gx - startGx) !== radius && Math.abs(gy - startGy) !== radius) continue;

          if (!this.grid[gy][gx]) {
            const wx = gx * GRID_SIZE + GRID_SIZE / 2;
            const wy = gy * GRID_SIZE + GRID_SIZE / 2;
            const dist = Math.hypot(wx - x, wy - y);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearest = [wx, wy];
            }
          }
        }
      }
      if (nearest) break; // Found walkable on this radius
    }
    return nearest;
  }

  findPath(startX: number, startY: number, endX: number, endY: number): Array<[number, number]> {
    const start = [
      Math.round((startX - GRID_SIZE / 2) / GRID_SIZE),
      Math.round((startY - GRID_SIZE / 2) / GRID_SIZE),
    ];
    const end = [
      Math.round((endX - GRID_SIZE / 2) / GRID_SIZE),
      Math.round((endY - GRID_SIZE / 2) / GRID_SIZE),
    ];

    // Clamp to valid grid bounds
    start[0] = Math.max(0, Math.min(this.gridW - 1, start[0]));
    start[1] = Math.max(0, Math.min(this.gridH - 1, start[1]));
    end[0] = Math.max(0, Math.min(this.gridW - 1, end[0]));
    end[1] = Math.max(0, Math.min(this.gridH - 1, end[1]));

    // If end is blocked, find nearest walkable
    if (this.grid[end[1]][end[0]]) {
      return []; // Will be handled by snap-to-nearest
    }

    const openSet: Array<[number, number]> = [start as [number, number]];
    const cameFrom = new Map<string, [number, number]>();
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();

    const key = (x: number, y: number) => `${x},${y}`;
    const h = (x: number, y: number) => Math.abs(x - end[0]) + Math.abs(y - end[1]);

    gScore.set(key(start[0], start[1]), 0);
    fScore.set(key(start[0], start[1]), h(start[0], start[1]));

    while (openSet.length > 0) {
      let current = openSet[0];
      let currentIdx = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (
          (fScore.get(key(openSet[i][0], openSet[i][1])) ?? Infinity) <
          (fScore.get(key(current[0], current[1])) ?? Infinity)
        ) {
          current = openSet[i];
          currentIdx = i;
        }
      }

      if (current[0] === end[0] && current[1] === end[1]) {
        const path: Array<[number, number]> = [];
        let curr = current;
        while (cameFrom.has(key(curr[0], curr[1]))) {
          path.unshift(curr);
          curr = cameFrom.get(key(curr[0], curr[1]))!;
        }
        return path;
      }

      openSet.splice(currentIdx, 1);
      const neighbors: Array<[number, number]> = [
        [current[0], current[1] - 1], // up
        [current[0], current[1] + 1], // down
        [current[0] - 1, current[1]], // left
        [current[0] + 1, current[1]], // right
      ];

      for (const [nx, ny] of neighbors) {
        if (nx < 0 || nx >= this.gridW || ny < 0 || ny >= this.gridH || this.grid[ny][nx]) continue;

        const tentativeG = (gScore.get(key(current[0], current[1])) ?? 0) + 1;
        if (!gScore.has(key(nx, ny)) || tentativeG < (gScore.get(key(nx, ny)) ?? Infinity)) {
          cameFrom.set(key(nx, ny), current);
          gScore.set(key(nx, ny), tentativeG);
          fScore.set(key(nx, ny), tentativeG + h(nx, ny));
          if (!openSet.some((n) => n[0] === nx && n[1] === ny)) {
            openSet.push([nx, ny]);
          }
        }
      }
    }
    return [];
  }
}

const INTERACTABLES: Interactable[] = [
  {
    id: "pc",
    x: 230,
    y: 130,
    w: 70,
    h: 70,
    label: "desk",
    cx: 200,
    cy: 180,
    cw: 100,
    ch: 6,
    ix: 265,
    iy: 220,
    lines: [
      "the cursor is blinking back at me.",
      "another late commit. nobody's awake to review it.",
      "github says i pushed 14 times today. felt like 4.",
    ],
    repeatLines: [
      // debugging
      "it worked. i don't know why. shipping it.",
      "undefined is not a function. classic.",
      "the bug was a missing semicolon. twelve hours.",
      "console.log everywhere. professional debugging.",
      "i added a sleep(1000) and it fixed it. i hate this.",
      "the test was wrong, not the code. obviously.",
      "works on my machine. good enough.",
      "i commented it out and the bug disappeared. interesting.",
      "npm install fixed it. i'll think about that later.",
      "oh. i was importing from the wrong file. for three days.",
      // git
      "force pushed to main. nobody saw that.",
      "commit message: 'fix'. specific enough.",
      "this branch has 47 commits. all of them are 'wip'.",
      "merge conflict on a file i didn't touch. love that.",
      "git blame points to me. obviously.",
      "squash and merge. burn the evidence.",
      "i'll write a proper commit message next time.",
      "'revert revert revert fix' — clean history.",
      // code quality
      "this function is 300 lines. i'll refactor it someday.",
      "i know what this does. i think.",
      "TODO: actually do this. — me, 8 months ago.",
      "the comment says one thing. the code says another.",
      "copy pasted this from stackoverflow. still don't get it.",
      "technical debt is just debt with better branding.",
      "i'll write tests after it ships. definitely.",
      "the variable is named 'data2'. don't ask.",
      "this is a temporary workaround from 2022.",
      "prettier reformatted everything. the diff is huge.",
      // late night coding
      "it's 2am. the code looks worse in daylight anyway.",
      "one more feature. then sleep. for real this time.",
      "i've been staring at this for so long the words look wrong.",
      "three monitors and i'm still running out of space.",
      "the terminal is red. it's fine. probably.",
      "i should write documentation. i won't.",
      "this PR has been in review for two weeks.",
      "rubber duck debugging. the duck knows.",
      "energy drink number two. calculating risk.",
      "stack trace is thirty lines deep. cozy.",
      // small wins / frustrations
      "it compiled on the first try. suspicious.",
      "the loading spinner finally goes away. small victory.",
      "i optimized this to 4ms. nobody will notice.",
      "the design changed again. rebuilding from scratch.",
      "mobile layout is broken. always mobile layout.",
      "i fixed a bug and introduced two more. net neutral.",
      "the API rate limit hit. unexpected nap.",
      "finally found the off-by-one error. it was me.",
      "this would've taken ten minutes in vanilla JS.",
      "i hate CSS. no, i love CSS. no, i hate it.",
    ],
    idleLines: [
      // returning to desk
      "i should get back to this.",
      "right, where was i.",
      "the monitor's still on. good.",
      "back to it.",
      "one thing left to fix. probably.",
      // active coding thoughts while at desk
      "okay. one more pass.",
      "i think i know what's wrong.",
      "just need to check one thing.",
      "almost got it.",
      "this is the last bug. i mean it.",
      "let me just run this real quick.",
      "okay the linter is mad at me again.",
      "why is this 400ms slower than yesterday.",
      "the build is green. somehow.",
      "i need a rubber duck. or a nap.",
    ],
  },
  {
    id: "guitar",
    x: 340,
    y: 170,
    w: 24,
    h: 60,
    label: "guitar",
    cx: 345,
    cy: 186,
    cw: 10,
    ch: 4,
    ix: 340,
    lines: [
      "the E string snapped again. third time this month.",
      "should probably change the whole set. intonation's off.",
      "frets are wearing thin. maybe it adds character.",
    ],
    repeatLines: [
      "some songs only make sense at night.",
      "i never finished learning that one chord progression.",
      "the neck needs adjusting. probably.",
      "three chords and a lot of feelings.",
    ],
    idleLines: [
      "i keep meaning to play more.",
      "maybe just one song before bed.",
      "the strings are dusty. that's on me.",
    ],
  },
  {
    id: "dumbbell",
    x: 470,
    y: 308,
    w: 70,
    h: 24,
    label: "dumbbell",
    cx: 470,
    cy: 290,
    cw: 70,
    ch: 15,
    lines: [
      "planche is destroying my wrists.",
      "one more set. then sleep. probably.",
      "the body keeps the score. the spreadsheet too.",
    ],
    repeatLines: [
      "rest days feel like guilt days.",
      "i did ten reps. then sat for six hours.",
      "consistency is the hard part. obviously.",
      "still lighter than my expectations.",
    ],
    idleLines: [
      "i should work out more.",
      "or at least move these off the floor.",
      "ten more reps. in spirit.",
    ],
  },
  {
    id: "window",
    x: 380,
    y: 50,
    w: 130,
    h: 80,
    label: "window",
    cw: 400,
    ch: 0,
    ix: 445,
    iy: 140,
    lines: [
      "it's quiet outside. the kind that hums.",
      "rain again. the city looks softer through it.",
      "the moon is doing its thing. unbothered.",
    ],
    repeatLines: [
      "still dark out. good.",
      "someone's light is still on across the way.",
      "the city never really sleeps.",
      "i forget the sky exists sometimes.",
    ],
    idleLines: [
      "it's late. again.",
      "nice out, probably. hard to tell through glass.",
      "the moon's still there. reassuring.",
    ],
  },
  {
    id: "bed",
    x: 540,
    y: 380,
    w: 140,
    h: 110,
    label: "bed",
    cx: 540,
    cy: 50,
    cw: 140,
    ch: 110,
    lines: [
      "why does spacing suddenly look wrong at 2am.",
      "five more minutes. then i'll close the laptop.",
      "tomorrow me will figure it out. probably.",
    ],
    repeatLines: [
      "it's calling me. i'm ignoring it.",
      "sleep is a feature, not a bug.",
      "the pillow has seen my worst ideas.",
      "i'll lie down for five minutes.",
    ],
    idleLines: [
      "i should sleep.",
      "just five more minutes of everything.",
      "the bed looks really good right now.",
    ],
  },
  {
    id: "shelf",
    x: 40,
    y: 60,
    w: 130,
    h: 100,
    label: "shelf",
    cw: 150,
    ch: 0,
    ix: 105,
    iy: 140,
    lines: [
      "books i keep meaning to finish.",
      "dust is its own kind of bookmark.",
      "each spine a quiet guilt trip.",
    ],
    repeatLines: [
      "page 47. forever.",
      "i know the plot. i just haven't read it.",
      "someday i'll have a reading routine.",
      "physical books feel important to own.",
    ],
    idleLines: [
      "i should read more.",
      "i think i left my bookmark somewhere.",
      "those books aren't going to read themselves.",
    ],
  },
  {
    id: "plant",
    x: 615,
    y: 110,
    w: 60,
    h: 90,
    label: "plant",
    cx: 627,
    cy: 188,
    cw: 28,
    ch: 20,
    ix: 645,
    iy: 240,
    lines: [
      "still alive. somehow.",
      "talked to it once. didn't reply. fair.",
      "watered it yesterday. or was that last week?",
    ],
    repeatLines: [
      "resilient little thing.",
      "i think it's growing? or leaning. hard to tell.",
      "plants are the lowest maintenance friends.",
      "we have an understanding, me and this plant.",
    ],
    idleLines: [
      "i think i left something here…",
      "this plant is doing better than i am.",
      "maybe it needs more light. or less. i forget.",
    ],
  },
  {
    id: "rug",
    x: 210,
    y: 360,
    w: 240,
    h: 100,
    label: "rug",
    cw: 0,
    ch: 0,
    lines: ["soft. needs a vacuum. soon."],
    repeatLines: [
      "it's holding the room together. barely.",
      "i've been meaning to clean this for a while.",
      "soft underfoot. that's enough.",
    ],
    idleLines: ["the rug is… here.", "at least the floor is cozy."],
  },
  {
    id: "coffee",
    x: 0,
    y: 190,
    w: 36,
    h: 150,
    label: "coffee table",
    cx: 0,
    cy: 190,
    cw: 32,
    ch: 150,
    lines: [
      "third cup today. the machine never judges.",
      "snack stash is running low. again.",
      "the espresso tastes like it knows it's 2am.",
    ],
    repeatLines: [
      "one more cup. final answer.",
      "the machine is warm. that's enough.",
      "i ran out of oat milk. dark times.",
      "caffeine is a personality trait at this point.",
    ],
    idleLines: [
      "i could use another coffee.",
      "the machine's still warm. tempting.",
      "snacks are running low. a crisis.",
    ],
  },
];

// Solid walls/edges — only the actual wall area (above floor line at y=176)
const STATIC_COLLIDERS = [
  { x: 0, y: 0, w: WORLD_W, h: 140 }, // back wall + baseboard
];

// Explicit walkable waypoints (Pokemon-style navigation map)
// These are grid positions the player can stand on. The pathfinder
// uses A* on the grid, and these define the "floor" area.
const FLOOR_RECTS = [
  { x: 0, y: 140, w: WORLD_W, h: WORLD_H - 140 }, // main floor
];

// Pick random item from array, avoiding lastItem if possible
function pickRandom<T>(pool: T[], lastItem?: T): T {
  if (pool.length === 1) return pool[0];
  const filtered = lastItem !== undefined ? pool.filter((x) => x !== lastItem) : pool;
  return filtered[Math.floor(Math.random() * filtered.length)];
}

// Tutorial sequence — shown only on first visit
const getTutorialLines = (isMobile: boolean) => [
  { speaker: "—", text: "hey. welcome to my room." },
  {
    speaker: "—",
    text: isMobile
      ? "tap anywhere on the floor or use the D-pad to walk around."
      : "click anywhere on the floor or press WASD to walk around.",
  },
  {
    speaker: "—",
    text: isMobile
      ? "get close to something and tap the TALK button to interact."
      : "get close to something and press E to interact.",
  },
  { speaker: "—", text: "anyway. make yourself at home." },
];

// Idle waypoint pool — valid floor positions the character drifts to during idle
const IDLE_WAYPOINTS = [
  { x: 205, y: 200 }, // desk area
  { x: 445, y: 140 }, // window area
  { x: 105, y: 140 }, // shelf area
  { x: 645, y: 240 }, // plant area
  { x: 350, y: 350 }, // center floor
  { x: 200, y: 420 }, // left floor
  { x: 500, y: 420 }, // right floor
  { x: 350, y: 280 }, // mid floor
  { x: 480, y: 320 }, // dumbbell area
];

const INTERACT_RADIUS = 48;

type NearbyTarget = { id: string; label: string };

export function RoomScene() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<unknown>(null);
  const interactRef = useRef<(() => void) | null>(null);
  const dialogueRef = useRef<{ id: string; label: string; text: string } | null>(null);
  const skipTutorialRef = useRef<(() => void) | null>(null);
  const wasdMoveRef = useRef<((dx: number, dy: number) => void) | null>(null);
  const resetIdleRef = useRef<(() => void) | null>(null);
  const isMobile = useIsMobile();
  const tutorialLines = getTutorialLines(isMobile);
  const [dialogue, setDialogue] = useState<{ id: string; label: string; text: string } | null>(
    null,
  );
  const [nearbyTarget, setNearbyTarget] = useState<NearbyTarget | null>(null);
  const [ready, setReady] = useState(false);
  const [musicOn, setMusicOn] = useState(true);
  const [tutorialStep, setTutorialStep] = useState<number | null>(null); // null = done/skipped
  const audioCtxRef = useRef<AudioContext | null>(null);
  const musicNodesRef = useRef<{ osc: OscillatorNode; gain: GainNode }[]>([]);
  const musicLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const dirMap: Record<string, [number, number]> = {
      w: [0, -1],
      arrowup: [0, -1],
      s: [0, 1],
      arrowdown: [0, 1],
      a: [-1, 0],
      arrowleft: [-1, 0],
      d: [1, 0],
      arrowright: [1, 0],
    };

    // Track held keys and their repeat intervals
    const heldKeys = new Map<string, ReturnType<typeof setInterval>>();
    const HOLD_DELAY = 150; // ms before repeat starts
    const HOLD_INTERVAL = 0; // ms between steps while held

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "e") {
        if (!e.repeat) {
          resetIdleRef.current?.();
          interactRef.current?.();
        }
        return;
      }
      const dir = dirMap[k];
      if (!dir) return;
      e.preventDefault();
      if (heldKeys.has(k)) return; // already held

      // Reset idle on any key movement
      resetIdleRef.current?.();
      // Fire immediately on first press
      wasdMoveRef.current?.(dir[0], dir[1]);

      // Then after initial delay, repeat at interval
      const timeout = setTimeout(() => {
        const interval = setInterval(() => {
          wasdMoveRef.current?.(dir[0], dir[1]);
        }, HOLD_INTERVAL);
        heldKeys.set(k, interval);
      }, HOLD_DELAY);

      // Store timeout id in the map temporarily (cast to same type)
      heldKeys.set(k, timeout as unknown as ReturnType<typeof setInterval>);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const timer = heldKeys.get(k);
      if (timer !== undefined) {
        clearTimeout(timer as unknown as ReturnType<typeof setTimeout>);
        clearInterval(timer);
        heldKeys.delete(k);
      }
    };

    const onWheel = () => {
      resetIdleRef.current?.();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("wheel", onWheel);
      heldKeys.forEach((timer) => {
        clearTimeout(timer as unknown as ReturnType<typeof setTimeout>);
        clearInterval(timer);
      });
      heldKeys.clear();
    };
  }, []);

  // Keep dialogueRef in sync so Phaser scene can read it each frame
  useEffect(() => {
    dialogueRef.current = dialogue;
  }, [dialogue]);

  // ── Cozy retro chiptune background music ──────────────────────────────────
  useEffect(() => {
    if (!musicOn) {
      // Stop everything
      musicNodesRef.current.forEach(({ osc, gain }) => {
        try {
          gain.gain.setTargetAtTime(0, audioCtxRef.current!.currentTime, 0.1);
        } catch {}
        try {
          osc.stop(audioCtxRef.current!.currentTime + 0.3);
        } catch {}
      });
      musicNodesRef.current = [];
      if (musicLoopRef.current) clearTimeout(musicLoopRef.current);
      return;
    }

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    // Master gain / reverb chain
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.18;
    masterGain.connect(ctx.destination);

    // Simple reverb via convolver
    const convolver = ctx.createConvolver();
    const reverbLen = ctx.sampleRate * 1.2;
    const reverbBuf = ctx.createBuffer(2, reverbLen, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = reverbBuf.getChannelData(c);
      for (let i = 0; i < reverbLen; i++)
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / reverbLen, 2.5);
    }
    convolver.buffer = reverbBuf;
    convolver.connect(masterGain);

    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.7;
    dryGain.connect(masterGain);

    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.3;
    wetGain.connect(masterGain);
    convolver.connect(wetGain);

    // Cozy lo-fi melody: C pentatonic — C4 D4 E4 G4 A4
    const NOTE = {
      C4: 261.63,
      D4: 293.66,
      E4: 329.63,
      G4: 392.0,
      A4: 440.0,
      C5: 523.25,
      G3: 196.0,
      A3: 220.0,
      E3: 164.81,
    };
    // Chord progression: Am - F - C - G (lofi classic)
    const melody = [
      NOTE.E4,
      NOTE.A4,
      NOTE.G4,
      NOTE.E4,
      NOTE.D4,
      NOTE.C4,
      NOTE.D4,
      NOTE.E4,
      NOTE.A4,
      NOTE.C5,
      NOTE.A4,
      NOTE.G4,
      NOTE.E4,
      NOTE.G4,
      NOTE.E4,
      NOTE.D4,
    ];
    const bass = [NOTE.A3, NOTE.A3, NOTE.G3, NOTE.G3, NOTE.C4, NOTE.C4, NOTE.G3, NOTE.G3];

    const BPM = 76;
    const BEAT = 60 / BPM; // seconds per beat
    const melodyDur = BEAT * 0.45;
    const bassDur = BEAT * 0.85;

    let stopped = false;

    function playNote(
      freq: number,
      startTime: number,
      dur: number,
      type: OscillatorType,
      vol: number,
    ) {
      if (stopped) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(vol, startTime + 0.02);
      gain.gain.setTargetAtTime(vol * 0.6, startTime + 0.05, 0.08);
      gain.gain.setTargetAtTime(0, startTime + dur * 0.7, dur * 0.15);
      osc.connect(gain);
      gain.connect(dryGain);
      osc.start(startTime);
      osc.stop(startTime + dur + 0.2);
      musicNodesRef.current.push({ osc, gain });
    }

    function scheduleLoop(loopStart: number) {
      if (stopped) return;
      const HALF = BEAT * 0.5;

      // Melody (square wave, gentle)
      melody.forEach((freq, i) => {
        playNote(freq, loopStart + i * HALF, melodyDur, "square", 0.12);
      });

      // Bass (triangle, warm)
      bass.forEach((freq, i) => {
        playNote(freq, loopStart + i * BEAT, bassDur, "triangle", 0.22);
      });

      // Hi-hat style noise ticks
      for (let i = 0; i < 16; i++) {
        const t = loopStart + i * HALF;
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let j = 0; j < data.length; j++) data[j] = (Math.random() * 2 - 1) * 0.04;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const hg = ctx.createGain();
        hg.gain.setValueAtTime(i % 4 === 0 ? 0.35 : 0.15, t);
        hg.gain.setTargetAtTime(0, t + 0.01, 0.01);
        const hpf = ctx.createBiquadFilter();
        hpf.type = "highpass";
        hpf.frequency.value = 6000;
        src.connect(hpf);
        hpf.connect(hg);
        hg.connect(dryGain);
        if (!stopped) {
          try {
            src.start(t);
          } catch {}
        }
      }

      const loopDur = melody.length * HALF;
      const schedId = setTimeout(() => scheduleLoop(loopStart + loopDur), (loopDur - 0.5) * 1000);
      musicLoopRef.current = schedId;
    }

    scheduleLoop(ctx.currentTime + 0.1);

    return () => {
      stopped = true;
      if (musicLoopRef.current) clearTimeout(musicLoopRef.current);
      musicNodesRef.current.forEach(({ osc, gain }) => {
        try {
          gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        } catch {}
        try {
          osc.stop(ctx.currentTime + 0.2);
        } catch {}
      });
      musicNodesRef.current = [];
      setTimeout(() => {
        try {
          ctx.close();
        } catch {}
      }, 500);
    };
  }, [musicOn]);

  useEffect(() => {
    let destroyed = false;
    let game: any;

    (async () => {
      const Phaser = (await import("phaser")).default;
      if (destroyed || !containerRef.current) return;

      class RoomSceneClass extends Phaser.Scene {
        player!: Phaser.GameObjects.Container;
        spriteFrames: Record<string, Phaser.GameObjects.Image> = {};
        playerShadow!: Phaser.GameObjects.Ellipse;
        pathFinder!: PathFinder;
        nearby: Interactable | null = null;
        depthObjects: Array<{ obj: Phaser.GameObjects.GameObject; y: number }> = [];
        monitorGlow!: Phaser.GameObjects.Graphics;
        windowGlow!: Phaser.GameObjects.Graphics;
        lampGlow!: Phaser.GameObjects.Graphics;
        clickRing!: Phaser.GameObjects.Graphics;
        clickRingT = 0;
        clickRingPos = { x: 0, y: 0 };
        glowT = 0;
        frameT = 0;
        frame: 0 | 1 | 2 = 0;
        facing: "down" | "up" | "left" | "right" = "down";
        dirGroups!: Record<"down" | "up" | "left" | "right", Phaser.GameObjects.Container[]>;

        // Idle behaviour state
        idleTimer = 0; // ms since last player input
        readonly IDLE_THRESHOLD = 6000; // ms before idle kicks in
        idleMode = false;
        idleWaitT = 0; // countdown for pause between wanders
        idleWaitDur = 0; // how long to pause (random)
        lastInputTime = 0; // absolute time of last player input
        textureMap: Record<string, string> = {
          "down-0": "front-idle",
          "down-1": "front-walk-1",
          "down-2": "front-walk-2",
          "up-0": "back-idle",
          "up-1": "back-walk-1",
          "up-2": "back-walk-2",
          "left-0": "left-idle",
          "left-1": "left-walk-1",
          "left-2": "left-walk-2",
          "right-0": "right-idle",
          "right-1": "right-walk-1",
          "right-2": "right-walk-2",
        };
        useSpriteSheet = true;
        dlgGeneration = 0; // bumped on every new dialogue line; guards auto-dismiss delayedCall

        constructor() {
          super("room");
        }

        interactNearby() {
          if (!this.nearby) return;
          const it = this.nearby;

          // Reset idle state on every explicit interaction
          this.idleMode = false;
          this.idleTimer = 0;
          this.lastInputTime = Date.now();

          // Init state entry if missing
          if (!dlgState[it.id]) {
            dlgState[it.id] = {
              seqIdx: 0,
              seqDone: false,
              repeatCount: 0,
              lastLine: "",
              idleCooldown: 0,
            };
          }
          const state = dlgState[it.id];

          let text: string;

          if (!state.seqDone) {
            // Still in primary sequence
            text = it.lines[state.seqIdx];
            state.seqIdx++;
            if (state.seqIdx >= it.lines.length) {
              state.seqDone = true;
              // Auto-dismiss after last primary line — but only if no newer
              // interaction has replaced it in the meantime
              const gen = ++this.dlgGeneration;
              this.time.delayedCall(2800, () => {
                if (this.dlgGeneration === gen) {
                  setDialogue((cur) => (cur?.id === it.id ? null : cur));
                }
              });
            } else {
              this.dlgGeneration++;
            }
          } else if (
            it.repeatLines &&
            it.repeatLines.length > 0 &&
            state.repeatCount < REPEAT_LIMIT
          ) {
            // Primary done — up to REPEAT_LIMIT bonus interactions from repeatLines
            text = pickRandom(it.repeatLines, state.lastLine);
            state.repeatCount++;
            this.dlgGeneration++;
          } else {
            // Fully exhausted — dismiss if open, go silent
            setDialogue(null);
            return;
          }

          state.lastLine = text;
          state.idleCooldown = Date.now() + 15_000;
          setDialogue({ id: it.id, label: it.label, text });
        }

        // Emit an autonomous idle comment for an object (called by idle system)
        emitIdleDialogue(it: Interactable, isIdleWalk = false) {
          if (!dlgState[it.id]) {
            dlgState[it.id] = {
              seqIdx: 0,
              seqDone: false,
              repeatCount: 0,
              lastLine: "",
              idleCooldown: 0,
            };
          }
          const state = dlgState[it.id];
          if (Date.now() < state.idleCooldown) return;

          const pool = [...it.lines, ...(it.repeatLines ?? []), ...(it.idleLines ?? [])];
          const text = pickRandom(pool, state.lastLine);
          state.lastLine = text;
          // Desk gets a much shorter cooldown so he keeps muttering while coding
          const baseCooldown = it.id === "pc" ? 5_000 : isIdleWalk ? 12_000 : 8_000;
          state.idleCooldown = Date.now() + baseCooldown;

          setDialogue({ id: it.id, label: it.label, text });
          // Auto-dismiss idle dialogue after 3s
          const gen = ++this.dlgGeneration;
          this.time.delayedCall(3000, () => {
            if (this.dlgGeneration === gen) {
              setDialogue((cur) => (cur?.id === it.id ? null : cur));
            }
          });
        }

        preload() {
          this.load.image("front-idle", "/front-idle.png");
          this.load.image("back-idle", "/back-idle.png");
          this.load.image("left-idle", "/left-idle.png");
          this.load.image("right-idle", "/right-idle.png");
          this.load.image("front-walk-1", "/front-walk-1.png");
          this.load.image("front-walk-2", "/front-walk-2.png");
          this.load.image("back-walk-1", "/back-walk-1.png");
          this.load.image("back-walk-2", "/back-walk-2.png");
          this.load.image("left-walk-1", "/left-walk-1.png");
          this.load.image("left-walk-2", "/left-walk-2.png");
          this.load.image("right-walk-1", "/right-walk-1.png");
          this.load.image("right-walk-2", "/right-walk-2.png");
        }

        create() {
          this.pathFinder = new PathFinder();

          // Build collision grid
          for (const s of STATIC_COLLIDERS) {
            this.pathFinder.setBlocked(s.x, s.y, s.w, s.h);
          }
          for (const it of INTERACTABLES) {
            const cw = it.cw ?? it.w;
            const ch = it.ch ?? it.h;
            if (cw > 0 && ch > 0) {
              const cx = it.cx ?? it.x;
              const cy = it.cy ?? it.y;
              this.pathFinder.setBlocked(cx, cy, cw, ch);
            }
          }

          // Use custom sprite images from public/
          this.useSpriteSheet = true;

          const g = this.add.graphics();

          // ============ WALL ============
          // upper wall (lighter cream-brown)
          g.fillStyle(0x5e4a3a, 1);
          g.fillRect(0, 0, WORLD_W, 110);
          // wallpaper subtle pattern (vertical stripes)
          for (let x = 0; x < WORLD_W; x += 16) {
            g.fillStyle(0x523f31, 0.5);
            g.fillRect(x, 0, 1, 110);
          }
          // lower wall (wainscoting)
          g.fillStyle(0x453629, 1);
          g.fillRect(0, 108, WORLD_W, 64);
          // wainscot panels
          for (let x = 12; x < WORLD_W - 12; x += 60) {
            g.lineStyle(1, 0x2d2014, 1);
            g.strokeRect(x, 118, 48, 44);
          }
          // chair rail
          g.fillStyle(0x2a1d12, 1);
          g.fillRect(0, 108, WORLD_W, 4);
          g.fillStyle(0x6b4a30, 0.6);
          g.fillRect(0, 112, WORLD_W, 1);
          // baseboard
          g.fillStyle(0x1a110a, 1);
          g.fillRect(0, 168, WORLD_W, 8);
          g.fillStyle(0x3a2618, 1);
          g.fillRect(0, 174, WORLD_W, 2);

          // ============ FLOOR (parquet planks w/ grain) ============
          g.fillStyle(0x3a2a1d, 1);
          g.fillRect(0, 176, WORLD_W, WORLD_H - 176);
          for (let y = 184; y < WORLD_H; y += 24) {
            // plank seam
            g.fillStyle(0x1d140e, 0.7);
            g.fillRect(0, y, WORLD_W, 1);
            // highlight
            g.fillStyle(0x4a3525, 0.5);
            g.fillRect(0, y + 1, WORLD_W, 1);
            // staggered vertical seams
            const offset = ((y / 24) % 2) * 80;
            for (let x = offset; x < WORLD_W; x += 160) {
              g.fillStyle(0x1d140e, 0.6);
              g.fillRect(x, y - 23, 1, 23);
            }
          }
          // floor knots
          for (let i = 0; i < 22; i++) {
            const x = (i * 73) % WORLD_W;
            const y = 200 + ((i * 41) % (WORLD_H - 220));
            g.fillStyle(0x2a1810, 0.6);
            g.fillEllipse(x, y, 5, 2);
          }

          // ============ WALL ART ============
          // big frame
          this.add.rectangle(232, 30, 70, 56, 0x14100c).setOrigin(0);
          this.add.rectangle(236, 34, 62, 48, 0xc8a878).setOrigin(0);
          this.add.rectangle(238, 36, 58, 44, 0x3a4d44).setOrigin(0);
          // mountain silhouette
          this.add.triangle(226, 36, 12, 44, 28, 22, 44, 44, 0x1d2a23).setOrigin(0);
          this.add.triangle(226, 36, 28, 44, 44, 20, 60, 44, 0x2a3a30).setOrigin(0);

          // moon in art
          this.add.circle(282, 48, 5, 0xe6dcc4, 0.95);
          // small frame
          this.add.rectangle(322, 40, 32, 30, 0x14100c).setOrigin(0);
          this.add.rectangle(325, 43, 26, 24, 0xb87a4a).setOrigin(0);
          this.add.rectangle(330, 48, 16, 14, 0xe6c8a0).setOrigin(0);

          // wall sconce light
          this.add.rectangle(190, 40, 4, 14, 0x2a1d12).setOrigin(0);
          this.add.triangle(192, 40, -8, 0, 8, 0, 0, -10, 0xc8a878).setOrigin(0);
          // sconce glow
          const sconce = this.add.graphics();
          sconce.fillStyle(0xf2c878, 0.18);
          sconce.fillCircle(192, 38, 28);

          // ============ WINDOW (night sky) ============
          const win = INTERACTABLES.find((i) => i.id === "window")!;
          this.add.rectangle(win.x - 6, win.y - 6, win.w + 12, win.h + 12, 0x1a110a).setOrigin(0);
          this.add.rectangle(win.x - 4, win.y - 4, win.w + 8, win.h + 8, 0x2d1d12).setOrigin(0);
          // sky gradient
          this.add.rectangle(win.x, win.y, win.w, win.h, 0x05080f).setOrigin(0);
          this.add.rectangle(win.x, win.y, win.w, win.h * 0.55, 0x0e1a2e).setOrigin(0);
          this.add.rectangle(win.x, win.y, win.w, win.h * 0.28, 0x1a2d4a).setOrigin(0);
          // stars (varying brightness)
          const starSeed = [
            [10, 8, 1],
            [28, 14, 0.6],
            [44, 6, 0.9],
            [60, 18, 0.5],
            [80, 10, 0.8],
            [98, 22, 0.6],
            [16, 26, 0.7],
            [50, 32, 0.5],
            [72, 30, 0.9],
            [108, 14, 0.7],
            [120, 30, 0.5],
            [38, 42, 0.6],
          ];
          for (const [sx, sy, a] of starSeed) {
            this.add.rectangle(
              win.x + (sx as number),
              win.y + (sy as number),
              1,
              1,
              0xffffff,
              a as number,
            );
          }
          // moon
          this.add.circle(win.x + win.w - 26, win.y + 22, 10, 0xf2e8cf, 0.95);
          this.add.circle(win.x + win.w - 23, win.y + 19, 9, 0x142238, 0.35);
          this.add.circle(win.x + win.w - 30, win.y + 26, 1, 0x14100c, 0.5);
          this.add.circle(win.x + win.w - 22, win.y + 28, 1.5, 0x14100c, 0.4);
          // city skyline
          for (let i = 0; i < 9; i++) {
            const bx = win.x + i * 15;
            const bh = 8 + ((i * 11) % 22);
            this.add.rectangle(bx, win.y + win.h - bh - 2, 14, bh, 0x05080f).setOrigin(0);
            // warm windows
            for (let r = 0; r < bh - 4; r += 5) {
              for (let c = 0; c < 10; c += 4) {
                if ((i + r + c) % 3 === 0) {
                  this.add.rectangle(bx + 2 + c, win.y + win.h - bh + r, 2, 2, 0xf0c878, 0.85);
                }
              }
            }
          }
          // window cross
          this.add.rectangle(win.x + win.w / 2 - 1, win.y, 2, win.h, 0x1a110a).setOrigin(0);
          this.add.rectangle(win.x, win.y + win.h / 2 - 1, win.w, 2, 0x1a110a).setOrigin(0);
          // sill
          this.add.rectangle(win.x - 10, win.y + win.h + 2, win.w + 20, 6, 0x3a2618).setOrigin(0);
          this.add.rectangle(win.x - 10, win.y + win.h + 2, win.w + 20, 1, 0x6b4a30).setOrigin(0);
          // curtain hints (sides)
          this.add.rectangle(win.x - 14, win.y - 6, 8, win.h + 14, 0x4a2a3a).setOrigin(0);
          this.add.rectangle(win.x + win.w + 6, win.y - 6, 8, win.h + 14, 0x4a2a3a).setOrigin(0);
          // window inner glow
          this.windowGlow = this.add.graphics();

          // ============ BOOKSHELF ============
          const sh = INTERACTABLES.find((i) => i.id === "shelf")!;
          // back/sides
          this.add.rectangle(sh.x, sh.y, sh.w, sh.h, 0x2d1d12).setOrigin(0);
          this.add.rectangle(sh.x, sh.y, 4, sh.h, 0x1a110a).setOrigin(0);
          this.add.rectangle(sh.x + sh.w - 4, sh.y, 4, sh.h, 0x1a110a).setOrigin(0);
          this.add.rectangle(sh.x, sh.y, sh.w, 4, 0x1a110a).setOrigin(0);
          // 3 shelves
          const colors = [
            0x6b8e7f, 0xb87a4a, 0x88607a, 0x4a6b88, 0xc8a878, 0x7a5a4a, 0x3a4d44, 0x9a6a4a,
          ];
          for (let r = 0; r < 3; r++) {
            const ry = sh.y + 8 + r * 30;
            // shelf board
            this.add.rectangle(sh.x + 4, ry + 24, sh.w - 8, 3, 0x140a06).setOrigin(0);
            this.add.rectangle(sh.x + 4, ry + 27, sh.w - 8, 1, 0x4a3020, 0.6).setOrigin(0);
            // books
            let bx = sh.x + 6;
            let bi = 0;
            while (bx < sh.x + sh.w - 8) {
              const bw = 5 + ((bx + r * 3 + bi) % 5);
              const bh = 16 + ((bx * 3 + r) % 7);
              const col = colors[(bx + r + bi) % colors.length];
              this.add.rectangle(bx, ry + 24 - bh, bw, bh, col).setOrigin(0);
              // band
              this.add.rectangle(bx, ry + 24 - bh + 4, bw, 1, 0x14100c, 0.6).setOrigin(0);
              this.add.rectangle(bx, ry + 24 - bh + bh - 4, bw, 1, 0x14100c, 0.6).setOrigin(0);
              bx += bw + 1;
              bi++;
            }
            // small object on top shelf
            if (r === 0) {
              this.add.rectangle(sh.x + sh.w - 22, ry + 14, 10, 10, 0xc8a878).setOrigin(0);
              this.add.rectangle(sh.x + sh.w - 22, ry + 14, 10, 3, 0x6b4a30).setOrigin(0);
            }
          }

          // ============ COFFEE TABLE (vertical console — flush to left wall) ============
          const cf = INTERACTABLES.find((i) => i.id === "coffee")!;
          const ctX = cf.x; // flush to x=0 (left wall)
          const ctY = cf.y; // starts at floor line
          const ctW = cf.w; // narrow depth (36px)
          const ctH = cf.h; // 150px tall

          // === BACK PANEL — darkest strip against wall ===
          this.add.rectangle(ctX, ctY, 3, ctH, 0x120c06).setOrigin(0);

          // === FRONT FACE — visible amber-brown wood, contrasts with floor ===
          this.add.rectangle(ctX + 3, ctY, ctW - 3, ctH, 0x7a5030).setOrigin(0);
          // right edge shadow
          this.add.rectangle(ctX + ctW - 3, ctY, 3, ctH, 0x4a2e18).setOrigin(0);

          // Horizontal grain lines across face
          for (let gy = 0; gy < ctH; gy += 14) {
            this.add.rectangle(ctX + 3, ctY + gy, ctW - 6, 1, 0x5a3a20, 0.5).setOrigin(0);
          }

          // === TOP EDGE ===
          this.add.rectangle(ctX, ctY, ctW, 4, 0x9a6840).setOrigin(0); // top cap
          this.add.rectangle(ctX, ctY, ctW, 1, 0xc08850).setOrigin(0); // highlight
          this.add.rectangle(ctX, ctY + 3, ctW, 1, 0x2a1808).setOrigin(0); // shadow

          // === SHELF 1 (upper ~30%) ===
          const shelf1Y = ctY + Math.floor(ctH * 0.3);
          this.add.rectangle(ctX + 3, shelf1Y, ctW - 3, 5, 0x9a6840).setOrigin(0);
          this.add.rectangle(ctX + 3, shelf1Y, ctW - 3, 1, 0xc08850).setOrigin(0);
          this.add.rectangle(ctX + 3, shelf1Y + 4, ctW - 3, 1, 0x2a1808).setOrigin(0);

          // === SHELF 2 (lower ~63%) ===
          const shelf2Y = ctY + Math.floor(ctH * 0.63);
          this.add.rectangle(ctX + 3, shelf2Y, ctW - 3, 5, 0x9a6840).setOrigin(0);
          this.add.rectangle(ctX + 3, shelf2Y, ctW - 3, 1, 0xc08850).setOrigin(0);
          this.add.rectangle(ctX + 3, shelf2Y + 4, ctW - 3, 1, 0x2a1808).setOrigin(0);

          // === BOTTOM FOOT RAIL ===
          this.add.rectangle(ctX, ctY + ctH - 5, ctW, 5, 0x2a1808).setOrigin(0);
          this.add.rectangle(ctX, ctY + ctH - 5, ctW, 1, 0x9a6840, 0.6).setOrigin(0);

          // ~~~ TOP: Espresso Machine ~~~
          const machineX = ctX + 4;
          const machineY = ctY + 5;
          this.add.rectangle(machineX, machineY, ctW - 8, 20, 0x2a2a2a).setOrigin(0);
          this.add.rectangle(machineX + 2, machineY + 2, ctW - 12, 12, 0x1a1a1a).setOrigin(0);
          this.add.rectangle(machineX + 6, machineY + 14, ctW - 20, 4, 0x3a3a3a).setOrigin(0);
          this.add.rectangle(machineX + 9, machineY + 16, 4, 4, 0x444444).setOrigin(0);
          // steam wand
          this.add.rectangle(machineX + ctW - 16, machineY + 8, 3, 14, 0x4a4a4a).setOrigin(0);
          this.add.rectangle(machineX + ctW - 18, machineY + 21, 7, 2, 0x5a5a5a).setOrigin(0);
          // LED
          this.add.circle(machineX + ctW - 24, machineY + 4, 2, 0x40ff80, 0.9);
          // cup
          this.add.rectangle(machineX + ctW - 19, machineY + 23, 10, 7, 0xf0f0f0).setOrigin(0);
          this.add.rectangle(machineX + ctW - 20, machineY + 22, 3, 5, 0xf0f0f0).setOrigin(0);
          // steam wisps
          this.add.rectangle(machineX + ctW - 16, machineY + 21, 1, 4, 0xf0e8d8, 0.4).setOrigin(0);
          this.add.rectangle(machineX + ctW - 14, machineY + 19, 1, 3, 0xf0e8d8, 0.25).setOrigin(0);

          // ~~~ UPPER SHELF: Snack tray ~~~
          const trayY = shelf1Y + 6;
          const trayX = ctX + 4;
          this.add.rectangle(trayX, trayY, ctW - 8, 7, 0xc8a878).setOrigin(0);
          this.add.rectangle(trayX, trayY, ctW - 8, 2, 0x8a6040).setOrigin(0);
          this.add.rectangle(trayX + 2, trayY - 3, 5, 4, 0xe8c060).setOrigin(0); // cookie
          this.add.rectangle(trayX + 9, trayY - 3, 5, 4, 0xd85040).setOrigin(0); // chip
          this.add.rectangle(trayX + 17, trayY - 2, 4, 3, 0x60a040).setOrigin(0); // fruit

          // ~~~ LOWER SHELF: Books + succulent ~~~
          const lsY = shelf2Y + 6;
          this.add.rectangle(ctX + 5, lsY - 22, 6, 22, 0x6b8e7f).setOrigin(0);
          this.add.rectangle(ctX + 5, lsY - 22, 6, 3, 0x2a4a3a).setOrigin(0);
          this.add.rectangle(ctX + 13, lsY - 18, 6, 18, 0xb87a4a).setOrigin(0);
          this.add.rectangle(ctX + 13, lsY - 18, 6, 3, 0x6b4a20).setOrigin(0);
          // tiny succulent
          this.add.rectangle(ctX + 22, lsY - 9, 9, 9, 0x6b3a1f).setOrigin(0);
          this.add.ellipse(ctX + 26, lsY - 9, 7, 4, 0x2d4a2d);
          this.add.ellipse(ctX + 26, lsY - 15, 6, 9, 0x4a6e44);
          this.add.ellipse(ctX + 22, lsY - 13, 5, 7, 0x3a5a34);
          this.add.ellipse(ctX + 30, lsY - 13, 5, 7, 0x3a5a34);

          // ============ DESK + COMPUTER (smaller monitor) ============
          const pc = INTERACTABLES.find((i) => i.id === "pc")!;
          const deskX = 200;
          const deskY = 168;
          const deskW = 130;
          const deskH = 34;
          // desk top (with edge)
          this.add.rectangle(deskX, deskY, deskW, deskH, 0x3a2618).setOrigin(0);
          this.add.rectangle(deskX, deskY, deskW, 2, 0x6b4a30).setOrigin(0);
          this.add.rectangle(deskX, deskY + deskH - 1, deskW, 1, 0x140a06).setOrigin(0);
          // legs
          this.add.rectangle(deskX + 4, deskY + deskH, 6, 38, 0x1a110a).setOrigin(0);
          this.add.rectangle(deskX + deskW - 10, deskY + deskH, 6, 38, 0x1a110a).setOrigin(0);
          // drawer
          this.add.rectangle(deskX + 81, deskY + deskH + 0, 40, 30, 0x2d1d12).setOrigin(0);
          this.add.circle(deskX + 101, deskY + deskH + 11, 1.5, 0xc8a878);

          // monitor (smaller, modern slim)
          const mx = pc.x + 4;
          const my = pc.y + 8;
          const mw = 44;
          const mh = 32;
          // stand
          this.add.rectangle(mx + mw / 2 - 6, my + mh, 12, 6, 0x1a1a1a).setOrigin(0);
          this.add.rectangle(mx + mw / 2 - 14, my + mh + 6, 28, 3, 0x1a1a1a).setOrigin(0);
          // bezel
          this.add.rectangle(mx, my, mw, mh, 0x14100c).setOrigin(0);
          // screen
          this.add.rectangle(mx + 2, my + 2, mw - 4, mh - 4, 0x0e2a22).setOrigin(0);
          // code lines
          const codeColors = [0xc8b48a, 0x88b896, 0x6a9c84, 0xe6c8a0];
          for (let i = 0; i < 6; i++) {
            const lw = 8 + ((i * 7) % 22);
            this.add
              .rectangle(mx + 4 + (i % 2 ? 4 : 0), my + 5 + i * 4, lw, 1.5, codeColors[i % 4])
              .setOrigin(0);
          }
          // monitor warm glow
          this.monitorGlow = this.add.graphics();

          // laptop (small, on side of desk)
          this.add.rectangle(pc.x + 50, pc.y + 30, 22, 14, 0x2a2a2a).setOrigin(0);
          this.add.rectangle(pc.x + 51, pc.y + 31, 20, 12, 0x0e1a16).setOrigin(0);
          this.add.rectangle(pc.x + 50, pc.y + 44, 22, 2, 0x444444).setOrigin(0);

          // keyboard
          this.add.rectangle(pc.x - 4, pc.y + 50, 50, 7, 0x1a120c).setOrigin(0);
          for (let k = 0; k < 8; k++) {
            this.add.rectangle(pc.x - 2 + k * 6, pc.y + 51, 4, 5, 0x2a2a2a).setOrigin(0);
          }
          // mouse
          this.add.ellipse(pc.x + 56, pc.y + 56, 8, 11, 0x1a120c);

          // mug w/ steam
          this.add.rectangle(pc.x - 18, pc.y + 46, 10, 12, 0x242323).setOrigin(0);
          this.add.rectangle(pc.x - 8, pc.y + 49, 3, 6, 0x474544).setOrigin(0);
          this.add.rectangle(pc.x - 18, pc.y + 46, 10, 2, 0x474544).setOrigin(0);
          // steam wisps
          this.add.rectangle(pc.x - 14, pc.y + 42, 1, 2, 0xf0e8d8, 0.4).setOrigin(0);
          this.add.rectangle(pc.x - 12, pc.y + 38, 1, 2, 0xf0e8d8, 0.3).setOrigin(0);
          // notebook
          this.add.rectangle(pc.x + 50, pc.y + 50, 18, 10, 0xc8b48a).setOrigin(0);
          this.add.rectangle(pc.x + 50, pc.y + 50, 2, 10, 0x6b3a1f).setOrigin(0);
          this.add.rectangle(pc.x + 54, pc.y + 53, 12, 1, 0x6b3a1f, 0.6).setOrigin(0);
          this.add.rectangle(pc.x + 54, pc.y + 56, 10, 1, 0x6b3a1f, 0.6).setOrigin(0);

          // desk lamp (arched)
          this.add.rectangle(pc.x - 22, pc.y + 16, 3, 32, 0x1a120c).setOrigin(0);
          this.add.rectangle(pc.x - 22, pc.y + 16, 12, 3, 0x1a120c).setOrigin(0);
          this.add.triangle(pc.x - 12, pc.y + 16, 0, 0, 10, 0, 5, 8, 0x2a1d12).setOrigin(0);
          this.lampGlow = this.add.graphics();

          // chair tucked under desk (looks like drawer)
          this.add.rectangle(deskX + deskW / 2 - 4, deskY + deskH, 20, 12, 0x1a1a1a).setOrigin(0);

          // ============ GUITAR (Stratocaster, black body + white pickguard, beside desk) ============
          const gt = INTERACTABLES.find((i) => i.id === "guitar")!;
          // Strat body — double cutaway shape (black base)
          this.add.ellipse(gt.x + 12, gt.y + 38, 22, 26, 0x1a1a1a);
          // upper horn
          this.add.ellipse(gt.x + 6, gt.y + 26, 10, 12, 0x1a1a1a);
          // lower horn
          this.add.ellipse(gt.x + 18, gt.y + 28, 8, 10, 0x1a1a1a);
          // white pickguard (panda accent)
          this.add.ellipse(gt.x + 12, gt.y + 36, 16, 18, 0xf0f0f0);
          // pickups on pickguard
          this.add.rectangle(gt.x + 7, gt.y + 32, 10, 2, 0x3a3a3a).setOrigin(0);
          this.add.rectangle(gt.x + 7, gt.y + 38, 10, 2, 0x3a3a3a).setOrigin(0);
          this.add.rectangle(gt.x + 7, gt.y + 44, 10, 2, 0x3a3a3a).setOrigin(0);
          // knobs (black dots)
          this.add.circle(gt.x + 20, gt.y + 46, 2, 0x1a1a1a);
          this.add.circle(gt.x + 20, gt.y + 50, 2, 0x1a1a1a);
          // input jack
          this.add.circle(gt.x + 20, gt.y + 54, 1.5, 0x3a3a3a);
          // neck (dark wood)
          this.add.rectangle(gt.x + 9, gt.y, 6, 32, 0x3a2418).setOrigin(0);
          // fretboard (rosewood)
          this.add.rectangle(gt.x + 10, gt.y, 4, 32, 0x1a110a).setOrigin(0);
          // frets
          for (let f = 0; f < 5; f++) {
            this.add.rectangle(gt.x + 9, gt.y + 4 + f * 6, 6, 1, 0xc8c8c8, 0.4).setOrigin(0);
          }
          // strings
          this.add.rectangle(gt.x + 11, gt.y - 2, 1, 56, 0xe8dcc0, 0.5).setOrigin(0);
          this.add.rectangle(gt.x + 13, gt.y - 2, 1, 56, 0xe8dcc0, 0.4).setOrigin(0);
          // headstock (black)
          this.add.rectangle(gt.x + 7, gt.y - 5, 10, 6, 0x1a1a1a).setOrigin(0);
          // tuners (chrome)
          this.add.circle(gt.x + 9, gt.y - 2, 1, 0xc8c8c8);
          this.add.circle(gt.x + 13, gt.y - 2, 1, 0xc8c8c8);
          this.add.circle(gt.x + 17, gt.y - 2, 1, 0xc8c8c8);

          // ============ DUMBBELL ============
          const d = INTERACTABLES.find((i) => i.id === "dumbbell")!;
          this.add.rectangle(d.x + 16, d.y + 8, 38, 8, 0x3a3a3a).setOrigin(0);
          this.add.rectangle(d.x, d.y, 16, 24, 0x1a1a1a).setOrigin(0);
          this.add.rectangle(d.x + d.w - 16, d.y, 16, 24, 0x1a1a1a).setOrigin(0);
          this.add.rectangle(d.x + 2, d.y + 4, 12, 4, 0x4a4a4a).setOrigin(0);
          this.add.rectangle(d.x + d.w - 14, d.y + 4, 12, 4, 0x4a4a4a).setOrigin(0);
          this.add.rectangle(d.x + 4, d.y + 14, 8, 2, 0x6a6a6a, 0.5).setOrigin(0);

          // ============ BED ============
          const b = INTERACTABLES.find((i) => i.id === "bed")!;
          // headboard (depth-sorted: draws over player when player is above)
          const bedHeadboard = this.add.rectangle(b.x, b.y - 14, b.w, 18, 0x2d1d12).setOrigin(0);
          this.depthObjects.push({ obj: bedHeadboard, y: b.y - 14 });
          this.add.rectangle(b.x + 4, b.y - 10, b.w - 8, 2, 0x6b4a30, 0.6).setOrigin(0);
          // frame
          this.add.rectangle(b.x, b.y, b.w, b.h, 0x3a2618).setOrigin(0);
          // mattress
          this.add.rectangle(b.x + 4, b.y + 6, b.w - 8, b.h - 22, 0xeadcc0).setOrigin(0);
          // sheet
          this.add.rectangle(b.x + 4, b.y + 36, b.w - 8, b.h - 52, 0x4a6e7a).setOrigin(0);
          this.add.rectangle(b.x + 4, b.y + 36, b.w - 8, 2, 0x2a4a56).setOrigin(0);
          // blanket folds
          for (let i = 0; i < 4; i++) {
            this.add.rectangle(b.x + 4, b.y + 44 + i * 6, b.w - 8, 1, 0x2a4a56, 0.4).setOrigin(0);
          }
          // pillows
          this.add.rectangle(b.x + 8, b.y + 8, 56, 22, 0xf2e8cf).setOrigin(0);
          this.add.rectangle(b.x + 8, b.y + 8, 56, 3, 0xc8b48a).setOrigin(0);
          this.add.rectangle(b.x + 70, b.y + 12, 40, 16, 0xe6c8a0).setOrigin(0);
          // foot
          this.add.rectangle(b.x, b.y + b.h - 14, b.w, 14, 0x1a120c).setOrigin(0);
          // bedside lamp
          this.add.rectangle(b.x - 16, b.y + 4, 14, 8, 0x2d1d12).setOrigin(0);
          this.add.rectangle(b.x - 13, b.y - 4, 8, 8, 0xc8a878).setOrigin(0);
          // bedside lamp glow
          const bedLamp = this.add.graphics();
          bedLamp.fillStyle(0xf2c878, 0.16);
          bedLamp.fillCircle(b.x - 9, b.y, 30);

          // ============ PLANT ============
          const pl = INTERACTABLES.find((i) => i.id === "plant")!;
          // pot
          this.add.rectangle(pl.x + 12, pl.y + 84, 36, 32, 0x6b3a1f).setOrigin(0);
          this.add.rectangle(pl.x + 10, pl.y + 84, 40, 4, 0x4a2818).setOrigin(0);
          this.add.rectangle(pl.x + 14, pl.y + 88, 32, 1, 0x8a4a25, 0.6).setOrigin(0);
          // soil
          this.add.ellipse(pl.x + 30, pl.y + 84, 32, 4, 0x2a1810);
          // leaves (lower — behind player)
          this.add.ellipse(pl.x + 16, pl.y + 70, 22, 32, 0x2d4a2d);
          this.add.ellipse(pl.x + 44, pl.y + 72, 22, 30, 0x2d4a2d);
          // leaves (upper — depth-sorted: draw over player when above)
          const plLeaf1 = this.add.ellipse(pl.x + 22, pl.y + 58, 24, 36, 0x4a6e44);
          const plLeaf2 = this.add.ellipse(pl.x + 38, pl.y + 56, 22, 34, 0x4a6e44);
          const plLeaf3 = this.add.ellipse(pl.x + 30, pl.y + 46, 26, 38, 0x5a8a54);
          this.depthObjects.push({ obj: plLeaf1, y: pl.y + 58 });
          this.depthObjects.push({ obj: plLeaf2, y: pl.y + 56 });
          this.depthObjects.push({ obj: plLeaf3, y: pl.y + 46 });
          // leaf veins
          const plVein = this.add
            .rectangle(pl.x + 30, pl.y + 36, 1, 30, 0x2d4a2d, 0.7)
            .setOrigin(0);
          this.depthObjects.push({ obj: plVein, y: pl.y + 36 });

          // ============ RUG ============
          const rug = INTERACTABLES.find((i) => i.id === "rug")!;
          this.add.rectangle(rug.x, rug.y, rug.w, rug.h, 0x4a2a1f, 0.7).setOrigin(0);
          this.add
            .rectangle(rug.x + 4, rug.y + 4, rug.w - 8, rug.h - 8, 0x6b3a2a, 0.5)
            .setOrigin(0);
          // pattern
          for (let i = 0; i < 5; i++) {
            this.add
              .rectangle(rug.x + 8 + i * (rug.w / 5), rug.y + rug.h / 2 - 2, 4, 4, 0xc8a878, 0.6)
              .setOrigin(0);
          }
          this.add.rectangle(rug.x, rug.y + 6, rug.w, 1, 0xc8a878, 0.4).setOrigin(0);
          this.add.rectangle(rug.x, rug.y + rug.h - 7, rug.w, 1, 0xc8a878, 0.4).setOrigin(0);
          // fringe
          for (let i = 0; i < rug.w; i += 4) {
            this.add.rectangle(rug.x + i, rug.y - 3, 1, 3, 0xc8a878, 0.5).setOrigin(0);
            this.add.rectangle(rug.x + i, rug.y + rug.h, 1, 3, 0xc8a878, 0.5).setOrigin(0);
          }

          // ============ click ring ============
          this.clickRing = this.add.graphics().setDepth(50);
          this.pathDots = this.add.graphics().setDepth(15);
          this.destArrowGfx = this.add.graphics().setDepth(50);

          // ============ PLAYER (custom sprite images or pixel art fallback) ============
          this.player = this.add.container(WORLD_W / 2, WORLD_H / 2 + 60);
          this.playerShadow = this.add.ellipse(0, 0, 20, 5, 0x000000, 0.35);
          this.player.add(this.playerShadow);

          if (this.useSpriteSheet) {
            // Create all 12 sprite frames as Image objects, toggle visibility
            const allFrames = [
              "front-idle",
              "front-walk-1",
              "front-walk-2",
              "back-idle",
              "back-walk-1",
              "back-walk-2",
              "left-idle",
              "left-walk-1",
              "left-walk-2",
              "right-idle",
              "right-walk-1",
              "right-walk-2",
            ];
            for (const key of allFrames) {
              const img = this.add.image(0, -2, key);
              img.setOrigin(0.5, 0.5);
              img.setScale(0.32);
              img.setVisible(false);
              this.player.add(img);
              this.spriteFrames[key] = img;
            }
            // Show initial frame
            this.spriteFrames["front-idle"].setVisible(true);
          } else {
            // Fallback to pixel art (original system)
            // Game Boy palette (more retro Game Boy Color style)
            const SKIN = 0xf5d7ba;
            const SKIN_SH = 0xb8824a;
            const HAIR = 0x1a1208;
            const HAIR_DARK = 0x0a0600;
            const CAP_Y = 0xf2d050;
            const CAP_YH = 0xfff8d8;
            const CAP_R = 0xe84c3d;
            const SHIRT = 0xd73e2a;
            const SHIRT_SH = 0x7a1810;
            const STRIPE = 0xf8d858;
            const SHORT = 0x1a1a1a;
            const SHORT_SH = 0x000000;
            const SHOE = 0xf2b050;
            const SHOE_SH = 0x804a00;
            const PACK = 0x703020;
            const PACK_SH = 0x3a1a10;
            const OUTLINE = 0x000000;
            const EYE = 0x1a1a1a;

            // pixel helper
            const px = (
              frame: Phaser.GameObjects.Container,
              x: number,
              y: number,
              w: number,
              h: number,
              color: number,
              alpha = 1,
            ) => {
              const r = this.add
                .rectangle(Math.round(x), Math.round(y), w, h, color, alpha)
                .setOrigin(0, 0);
              frame.add(r);
              return r;
            };

            // Build sprite frames (24x32 now for more detail)
            const buildFrame = (
              dir: "down" | "up" | "left" | "right",
              step: 0 | 1,
            ): Phaser.GameObjects.Container => {
              const f = this.add.container(0, 0);
              const legSwing = step === 0 ? -1 : 1;

              // ---------- LEGS / SHOES ----------
              // Left leg
              px(f, -4, 10 + (legSwing > 0 ? 0 : 1), 2, 6, SHORT);
              px(f, -4, 16 + (legSwing > 0 ? 0 : 1), 3, 2, SHOE);
              px(f, -4, 18 + (legSwing > 0 ? 0 : 1), 3, 1, SHOE_SH);
              // Right leg
              px(f, 2, 10 + (legSwing < 0 ? 0 : 1), 2, 6, SHORT);
              px(f, 2, 16 + (legSwing < 0 ? 0 : 1), 3, 2, SHOE);
              px(f, 2, 18 + (legSwing < 0 ? 0 : 1), 3, 1, SHOE_SH);

              // ---------- TORSO (red shirt with yellow stripe) ----------
              // body outline
              px(f, -6, 0, 1, 10, OUTLINE);
              px(f, 5, 0, 1, 10, OUTLINE);
              px(f, -5, -1, 10, 1, OUTLINE);
              px(f, -5, 10, 10, 1, SHIRT_SH);
              // shirt body
              px(f, -5, 0, 10, 10, SHIRT);
              // shadow details
              px(f, -5, 7, 10, 2, SHIRT_SH);
              // yellow stripe (pokedex/gear band)
              px(f, -5, 3, 10, 1, STRIPE);

              // ---------- ARMS ----------
              if (dir === "down" || dir === "up") {
                // arms swinging
                const armYL = step === 0 ? 2 : 3;
                const armYR = step === 1 ? 2 : 3;
                px(f, -7, armYL, 2, 6, SHIRT);
                px(f, -7, armYL + 6, 2, 1, SKIN); // hand
                px(f, 5, armYR, 2, 6, SHIRT);
                px(f, 5, armYR + 6, 2, 1, SKIN);
              } else if (dir === "left") {
                // front arm visible, back arm hidden
                px(f, -7, 2 + (step === 0 ? 0 : 1), 2, 6, SHIRT);
                px(f, -7, 8 + (step === 0 ? 0 : 1), 2, 1, SKIN);
                px(f, 4, 3, 2, 5, SHIRT_SH);
              } else {
                // right-facing
                px(f, 5, 2 + (step === 0 ? 0 : 1), 2, 6, SHIRT);
                px(f, 5, 8 + (step === 0 ? 0 : 1), 2, 1, SKIN);
                px(f, -6, 3, 2, 5, SHIRT_SH);
              }

              // ---------- BACKPACK STRAPS ----------
              if (dir === "down") {
                px(f, -4, -2, 1, 8, PACK);
                px(f, 3, -2, 1, 8, PACK);
              } else if (dir === "left") {
                px(f, 1, 0, 1, 8, PACK);
              } else if (dir === "right") {
                px(f, -2, 0, 1, 8, PACK);
              }

              // ---------- HEAD (larger, more expressive) ----------
              // outline
              px(f, -6, -14, 12, 1, OUTLINE);
              px(f, -6, -2, 12, 1, OUTLINE);
              px(f, -7, -13, 1, 11, OUTLINE);
              px(f, 6, -13, 1, 11, OUTLINE);
              // face
              px(f, -6, -13, 12, 11, SKIN);
              // jaw/chin shadow
              px(f, -6, -4, 12, 1, SKIN_SH);

              // hair details (more prominent)
              if (dir === "down") {
                // sideburns
                px(f, -6, -10, 1, 6, HAIR);
                px(f, 5, -10, 1, 6, HAIR);
                // front hair tuft
                px(f, -2, -14, 4, 1, HAIR);
              } else if (dir === "up") {
                // back of head (full hair)
                px(f, -6, -13, 12, 11, HAIR);
                px(f, -4, -14, 8, 1, HAIR_DARK);
              } else if (dir === "left") {
                px(f, -6, -11, 3, 8, HAIR);
                px(f, 3, -9, 2, 6, HAIR);
                px(f, -5, -14, 3, 1, HAIR);
              } else {
                px(f, 3, -11, 3, 8, HAIR);
                px(f, -5, -9, 2, 6, HAIR);
                px(f, 2, -14, 3, 1, HAIR);
              }

              // ---------- FACE (eyes & mouth) ----------
              if (dir === "down") {
                px(f, -4, -8, 2, 2, EYE);
                px(f, 2, -8, 2, 2, EYE);
                // mouth (smile)
                px(f, -1, -5, 2, 1, SKIN_SH);
              } else if (dir === "left") {
                px(f, -4, -8, 2, 2, EYE);
                px(f, -2, -5, 1, 1, SKIN_SH);
              } else if (dir === "right") {
                px(f, 2, -8, 2, 2, EYE);
                px(f, 1, -5, 1, 1, SKIN_SH);
              }

              // ---------- CAP (more detailed, Ethan-style) ----------
              // cap crown (tall for Game Boy style)
              px(f, -7, -18, 14, 2, CAP_Y);
              px(f, -7, -20, 14, 2, CAP_Y);
              // highlight/shine
              px(f, -3, -20, 5, 1, CAP_YH);
              // outline
              px(f, -8, -21, 16, 1, OUTLINE);
              px(f, -8, -20, 1, 3, OUTLINE);
              px(f, 7, -20, 1, 3, OUTLINE);
              // red band around cap
              px(f, -7, -17, 14, 1, CAP_R);
              // pokéball patch
              px(f, -1, -19, 2, 2, CAP_R);
              px(f, 0, -18, 2, 1, STRIPE);

              // brim (depends on direction)
              if (dir === "down") {
                px(f, -8, -16, 16, 1, CAP_R);
                px(f, -8, -16, 16, 1, OUTLINE, 0.4);
              } else if (dir === "up") {
                // cap seen from back
                px(f, -1, -19, 2, 2, OUTLINE);
              } else if (dir === "left") {
                px(f, -9, -17, 4, 2, CAP_R);
                px(f, -9, -17, 1, 2, OUTLINE);
              } else {
                px(f, 5, -17, 4, 2, CAP_R);
                px(f, 8, -17, 1, 2, OUTLINE);
              }

              f.setVisible(false);
              this.player.add(f);
              return f;
            };

            this.dirGroups = {
              down: [buildFrame("down", 0), buildFrame("down", 1)],
              up: [buildFrame("up", 0), buildFrame("up", 1)],
              left: [buildFrame("left", 0), buildFrame("left", 1)],
              right: [buildFrame("right", 0), buildFrame("right", 1)],
            };
            this.dirGroups.down[0].setVisible(true);
          } // End fallback pixel art

          this.player.setSize(14, 32);
          this.player.setDepth(20);

          // Depth-sortable objects (draw over player when player is above them)
          this.depthObjects = [];

          // Snap player to grid on start
          this.snapToGrid();

          // ============ INPUT (click to walk, Pokemon tile-by-tile) ============
          // Rate-limit: ignore new taps until the current tile step is ≥60% done.
          // This prevents the queue-flooding teleport glitch from rapid tapping.
          this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
            // If dialogue is open, dismiss it and don't walk
            if (dialogueRef.current) {
              setDialogue(null);
              return;
            }

            // Block new path until current one is fully finished
            if (this.tileMoving || this.walkQueue.length > 0) return;

            // Reset idle mode on any player input
            this.idleMode = false;
            this.idleTimer = 0;
            this.lastInputTime = Date.now();
            // Auto-dismiss tutorial if still showing
            skipTutorialRef.current?.();

            const wp = this.cameras.main.getWorldPoint(p.x, p.y);

            // Clamp to walkable floor area
            let targetX = Phaser.Math.Clamp(wp.x, 24, WORLD_W - 24);
            let targetY = Phaser.Math.Clamp(wp.y, 140, WORLD_H - 24);

            // Snap target to nearest walkable grid tile
            if (this.pathFinder.isBlocked(targetX, targetY)) {
              const nearest = this.pathFinder.findNearestWalkable(targetX, targetY, 150);
              if (nearest) {
                [targetX, targetY] = nearest;
              } else {
                return;
              }
            }

            // A* pathfinding (cardinal directions, Pokemon style)
            const srcX = this.tileMoving ? this.tileTo.x : this.player.x;
            const srcY = this.tileMoving ? this.tileTo.y : this.player.y;
            const rawPath = this.pathFinder.findPath(srcX, srcY, targetX, targetY);
            const queue: Array<[number, number]> = rawPath.map(([gx, gy]) => [gx, gy]);

            if (queue.length > 0) {
              this.walkQueue = queue;
              this.destArrow = { x: targetX, y: targetY, alpha: 1 };
              this.flashRing(targetX, targetY);
            }
          });

          // ============ CRT + vignette ============
          const crt = this.add.graphics().setScrollFactor(0).setDepth(1000);
          for (let y = 0; y < WORLD_H; y += 3) {
            crt.fillStyle(0x000000, 0.06);
            crt.fillRect(0, y, WORLD_W, 1);
          }
          const vignette = this.add.graphics().setScrollFactor(0).setDepth(999);
          vignette.fillStyle(0x000000, 0.55);
          vignette.fillRect(0, 0, WORLD_W, 70);
          vignette.fillRect(0, WORLD_H - 70, WORLD_W, 70);
          vignette.fillRect(0, 0, 70, WORLD_H);
          vignette.fillRect(WORLD_W - 70, 0, 70, WORLD_H);

          this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
          this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
          this.cameras.main.setZoom(1.4);

          interactRef.current = () => this.interactNearby();

          resetIdleRef.current = () => {
            this.idleMode = false;
            this.idleTimer = 0;
            this.lastInputTime = Date.now();
          };

          wasdMoveRef.current = (dx: number, dy: number) => {
            // Dismiss dialogue first
            if (dialogueRef.current) {
              setDialogue(null);
              return;
            }
            // Block if already walking
            if (this.tileMoving || this.walkQueue.length > 0) return;
            // Reset idle
            this.idleMode = false;
            this.idleTimer = 0;
            this.lastInputTime = Date.now();
            skipTutorialRef.current?.();
            // Current grid position
            const [cgx, cgy] = this.gridPos(this.player.x, this.player.y);
            const ngx = cgx + dx;
            const ngy = cgy + dy;
            // Clamp to world bounds
            if (
              ngx < 0 ||
              ngy < 0 ||
              ngx >= Math.ceil(WORLD_W / GRID_SIZE) ||
              ngy >= Math.ceil(WORLD_H / GRID_SIZE)
            )
              return;
            const [wx, wy] = this.worldPos(ngx, ngy);
            if (wy < 140) return; // above walkable floor
            if (this.pathFinder.isBlocked(wx, wy)) return;
            this.walkQueue = [[ngx, ngy]];
            this.startNextTile();
          };

          // Tutorial: show first line after a short delay (first visit only)
          const hasSeen =
            typeof sessionStorage !== "undefined" && sessionStorage.getItem("roomTutDone");
          if (!hasSeen) {
            this.time.delayedCall(600, () => {
              setTutorialStep(0);
            });
          }
        }

        // Navigate player to a world position (for idle wandering)
        walkTo(wx: number, wy: number) {
          if (this.tileMoving && this.tileT / this.TILE_DURATION < 0.6) return;
          let targetX = Phaser.Math.Clamp(wx, 24, WORLD_W - 24);
          let targetY = Phaser.Math.Clamp(wy, 140, WORLD_H - 24);
          if (this.pathFinder.isBlocked(targetX, targetY)) {
            const nearest = this.pathFinder.findNearestWalkable(targetX, targetY, 150);
            if (!nearest) return;
            [targetX, targetY] = nearest;
          }
          const srcX = this.tileMoving ? this.tileTo.x : this.player.x;
          const srcY = this.tileMoving ? this.tileTo.y : this.player.y;
          const rawPath = this.pathFinder.findPath(srcX, srcY, targetX, targetY);
          if (rawPath.length > 0) {
            this.walkQueue = rawPath.map(([gx, gy]) => [gx, gy]);
            this.pendingQueue = [];
          }
        }

        // Pick a random idle waypoint different from current position
        pickIdleDestination(): { x: number; y: number } {
          const candidates = IDLE_WAYPOINTS.filter(
            (wp) => Math.hypot(wp.x - this.player.x, wp.y - this.player.y) > GRID_SIZE * 2,
          );
          return candidates[Math.floor(Math.random() * candidates.length)] ?? IDLE_WAYPOINTS[0];
        }

        flashRing(x: number, y: number) {
          this.clickRingPos = { x, y };
          this.clickRingT = 1;
        }

        collidesAt(x: number, y: number): boolean {
          // player collision box (feet-based)
          const halfW = 6;
          const footH = 4;
          const px1 = x - halfW;
          const px2 = x + halfW;
          const py1 = y + 10;
          const py2 = y + 10 + footH;
          const test = (rx: number, ry: number, rw: number, rh: number) =>
            !(px2 < rx || px1 > rx + rw || py2 < ry || py1 > ry + rh);
          for (const s of STATIC_COLLIDERS) {
            if (test(s.x, s.y, s.w, s.h)) return true;
          }
          for (const it of INTERACTABLES) {
            const cw = it.cw ?? it.w;
            const ch = it.ch ?? it.h;
            if (cw <= 0 || ch <= 0) continue;
            const cx = it.cx ?? it.x;
            const cy = it.cy ?? it.y;
            if (test(cx, cy, cw, ch)) return true;
          }
          return false;
        }

        // Tile-by-tile movement state (Pokemon Game Boy style)
        tileMoving = false;
        tileFrom = { x: 0, y: 0 };
        tileTo = { x: 0, y: 0 };
        tileT = 0;
        readonly TILE_DURATION = 200; // ms per tile
        walkQueue: Array<[number, number]> = [];
        pendingQueue: Array<[number, number]> = []; // queued while mid-tile
        destArrow: { x: number; y: number; alpha: number } | null = null;
        pathDots!: Phaser.GameObjects.Graphics;
        destArrowGfx!: Phaser.GameObjects.Graphics;

        snapToGrid() {
          this.player.x = Math.round(this.player.x / GRID_SIZE) * GRID_SIZE + GRID_SIZE / 2;
          this.player.y = Math.round(this.player.y / GRID_SIZE) * GRID_SIZE + GRID_SIZE / 2;
        }

        gridPos(x: number, y: number): [number, number] {
          return [
            Math.round((x - GRID_SIZE / 2) / GRID_SIZE),
            Math.round((y - GRID_SIZE / 2) / GRID_SIZE),
          ];
        }

        worldPos(gx: number, gy: number): [number, number] {
          return [gx * GRID_SIZE + GRID_SIZE / 2, gy * GRID_SIZE + GRID_SIZE / 2];
        }

        startNextTile() {
          if (this.walkQueue.length === 0) {
            this.tileMoving = false;
            return;
          }
          const [ngx, ngy] = this.walkQueue[0];
          const [wx, wy] = this.worldPos(ngx, ngy);
          if (this.pathFinder.isBlocked(wx, wy)) {
            this.walkQueue = [];
            this.tileMoving = false;
            return;
          }
          // Snap from position to grid to prevent diagonal drift
          const [snapX, snapY] = this.gridPos(this.player.x, this.player.y);
          this.tileFrom = { x: this.worldPos(snapX, snapY)[0], y: this.worldPos(snapX, snapY)[1] };
          this.tileTo = { x: wx, y: wy };
          this.tileT = 0;
          this.tileMoving = true;
          const dx = this.tileTo.x - this.tileFrom.x;
          const dy = this.tileTo.y - this.tileFrom.y;
          if (Math.abs(dx) >= Math.abs(dy)) {
            this.facing = dx > 0 ? "right" : "left";
          } else {
            this.facing = dy > 0 ? "down" : "up";
          }
        }

        update(_t: number, dt: number) {
          let moving = false;

          // Tile-by-tile movement (Pokemon style) with ease-out
          if (this.tileMoving) {
            this.tileT += dt;
            const raw = Math.min(this.tileT / this.TILE_DURATION, 1);
            // Ease-in-out for smooth, natural Pokemon-style stepping
            const t = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
            this.player.x = this.tileFrom.x + (this.tileTo.x - this.tileFrom.x) * t;
            this.player.y = this.tileFrom.y + (this.tileTo.y - this.tileFrom.y) * t;
            moving = true;

            if (raw >= 1) {
              // Arrived at tile — snap exactly
              this.player.x = this.tileTo.x;
              this.player.y = this.tileTo.y;
              this.tileMoving = false;
              this.walkQueue.shift();
              // Apply pending queue if a new tap came while moving
              if (this.walkQueue.length === 0 && this.pendingQueue.length > 0) {
                this.walkQueue = this.pendingQueue;
                this.pendingQueue = [];
              }
              if (this.walkQueue.length > 0) {
                this.startNextTile();
              }
            }
          } else if (this.walkQueue.length > 0) {
            this.startNextTile();
          }

          // Walk animation — 2 frames per step for natural feel
          // Each tile = one full step cycle (frame1 → frame2)
          if (moving) {
            if (this.frame === 0) this.frame = 1;
            this.frameT += dt;
            // Switch at halfway point of tile for even timing
            const halfTile = this.TILE_DURATION / 2;
            if (this.frameT > halfTile) {
              this.frameT = this.frameT - halfTile; // carry overflow
              this.frame = this.frame === 1 ? 2 : 1;
            }
          } else {
            this.frame = 0;
            this.frameT = 0;
          }

          // Update animation based on character type
          if (this.useSpriteSheet) {
            const frameKey = `${this.facing}-${this.frame}`;
            const activeKey = this.textureMap[frameKey] ?? "front-idle";
            for (const [key, img] of Object.entries(this.spriteFrames)) {
              img.setVisible(key === activeKey);
            }
          } else {
            // Show current direction/frame (pixel art)
            (Object.keys(this.dirGroups) as Array<"down" | "up" | "left" | "right">).forEach(
              (d) => {
                if (this.dirGroups[d] && this.dirGroups[d][0]) {
                  this.dirGroups[d][0].setVisible(d === this.facing && this.frame === 0);
                }
                if (this.dirGroups[d] && this.dirGroups[d][1]) {
                  this.dirGroups[d][1].setVisible(d === this.facing && this.frame === 1);
                }
              },
            );
          }

          // Depth sorting: objects draw over player when player is behind them (higher Y = lower on screen)
          for (const { obj, y } of this.depthObjects) {
            if ("setDepth" in obj) {
              (obj as Phaser.GameObjects.GameObject & { setDepth(d: number): unknown }).setDepth(
                this.player.y > y ? 25 : 15,
              );
            }
          }

          // Proximity detection for interactables
          let near: Interactable | null = null;
          let bestD = Infinity;
          for (const it of INTERACTABLES) {
            if (it.lines.length === 0) continue;
            // Use explicit interact center if set (for wall objects), else default to bounding-box center
            const cx = it.ix ?? it.x + it.w / 2;
            const cy = it.iy ?? it.y + it.h / 2;
            const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, cx, cy);
            const r = INTERACT_RADIUS + Math.min(it.w, it.h) / 4;
            if (d < r && d < bestD) {
              bestD = d;
              near = it;
            }
          }
          if (near?.id !== this.nearby?.id) {
            // Reset repeat quota when walking away from an object so next visit gets fresh interactions
            if (this.nearby && dlgState[this.nearby.id]) {
              dlgState[this.nearby.id].repeatCount = 0;
            }
            this.nearby = near;
            setNearbyTarget(near ? { id: near.id, label: near.label } : null);
            const nearId = near?.id;
            setDialogue((cur) => (cur && cur.id !== nearId ? null : cur));
          }

          // ── Idle / autonomous behaviour ──────────────────────────────────
          const isWalking = this.tileMoving || this.walkQueue.length > 0;
          if (!isWalking) {
            this.idleTimer += dt;
          } else {
            // Staying at threshold — reset timer when player manually walks
            // (idle-initiated walks keep idleMode=true, manual clicks set idleMode=false)
            if (!this.idleMode) this.idleTimer = 0;
          }

          if (!this.idleMode && this.idleTimer >= this.IDLE_THRESHOLD) {
            this.idleMode = true;
            this.idleWaitT = 0;
            this.idleWaitDur = 400 + Math.random() * 600; // short pause before first wander — go to desk fast
          }

          if (this.idleMode) {
            if (!isWalking) {
              // Arrived at destination — snap facing toward the nearby object
              if (this.nearby) {
                this.emitIdleDialogue(this.nearby, true);
                // Use object's actual center (not ix/iy which is the player stand point)
                const objCx = this.nearby.x + this.nearby.w / 2;
                const objCy = this.nearby.y + this.nearby.h / 2;
                const dx = objCx - this.player.x;
                const dy = objCy - this.player.y;
                if (Math.abs(dy) >= Math.abs(dx)) {
                  this.facing = dy < 0 ? "up" : "down";
                } else {
                  this.facing = dx < 0 ? "left" : "right";
                }
              }

              // Count down wait timer before next wander — pause if dialogue is open
              if (!dialogueRef.current) this.idleWaitT += dt;
              // Stay at desk longer (6–10s) vs other spots (1.5–4s)
              const atDesk = this.nearby?.id === "pc";
              const waitCap = atDesk ? 8000 + Math.random() * 4000 : 1500 + Math.random() * 2500;
              if (this.idleWaitDur === 0) this.idleWaitDur = waitCap;

              if (!dialogueRef.current && this.idleWaitT >= this.idleWaitDur) {
                this.idleWaitT = 0;
                this.idleWaitDur = 0; // reset so next arrival recalculates

                // Pick destination: 70% chance wander toward interactable.
                // Desk gets triple weight so he keeps coming back to code.
                if (Math.random() < 0.7) {
                  const candidates: Interactable[] = [];
                  for (const it of INTERACTABLES) {
                    const s = dlgState[it.id];
                    const cooldownOk = !s || Date.now() >= s.idleCooldown;
                    const hasIdle = (it.idleLines?.length ?? 0) > 0;
                    if (hasIdle && cooldownOk) {
                      const weight = it.id === "pc" ? 4 : 1;
                      for (let w = 0; w < weight; w++) candidates.push(it);
                    }
                  }
                  if (candidates.length > 0) {
                    const target = candidates[Math.floor(Math.random() * candidates.length)];
                    const wx = target.ix ?? target.x + target.w / 2;
                    const wy = target.iy ?? target.y + target.h / 2;
                    this.walkTo(wx, wy);
                  } else {
                    const dest = this.pickIdleDestination();
                    this.walkTo(dest.x, dest.y);
                  }
                } else {
                  const dest = this.pickIdleDestination();
                  this.walkTo(dest.x, dest.y);
                }
              }
            }
          }

          // Animations
          this.glowT += dt * 0.001;
          const pc = INTERACTABLES.find((i) => i.id === "pc")!;

          this.lampGlow.clear();
          this.lampGlow.fillStyle(0xf2c878, 0.32);
          this.lampGlow.fillCircle(pc.x - 10, pc.y + 24, 20);

          const win = INTERACTABLES.find((i) => i.id === "window")!;
          this.windowGlow.clear();
          this.windowGlow.fillStyle(0x6a8cb8, 0.12 + Math.sin(this.glowT) * 0.03);
          this.windowGlow.fillRect(win.x - 12, win.y - 12, win.w + 24, 80 + 36); // 80 = visual window height

          // Path dot indicators
          this.pathDots.clear();
          const fullQueue = this.tileMoving
            ? [this.walkQueue[0], ...this.walkQueue.slice(1)]
            : this.walkQueue;
          for (let i = 0; i < fullQueue.length; i++) {
            const [gx, gy] = fullQueue[i];
            const [wx, wy] = this.worldPos(gx, gy);
            const dotAlpha = 0.15 + 0.15 * (1 - i / Math.max(fullQueue.length, 1));
            this.pathDots.fillStyle(0xf2e8cf, dotAlpha);
            this.pathDots.fillCircle(wx, wy, 3);
          }

          // Destination arrow
          this.destArrowGfx.clear();
          if (this.destArrow) {
            if (this.walkQueue.length > 0 || this.tileMoving) {
              this.destArrow.alpha = Math.min(this.destArrow.alpha + dt * 0.004, 1);
              const ax = this.destArrow.x;
              const ay = this.destArrow.y - 18 + Math.sin(this.glowT * 3) * 3;
              const da = this.destArrow.alpha * 0.7;
              // Arrow triangle pointing down
              this.destArrowGfx.fillStyle(0xf2e8cf, da);
              this.destArrowGfx.fillTriangle(ax, ay + 8, ax - 5, ay, ax + 5, ay);
            } else {
              // Fade out when reached
              this.destArrow.alpha -= dt * 0.005;
              if (this.destArrow.alpha <= 0) {
                this.destArrow = null;
              }
            }
          }

          if (this.clickRingT > 0) {
            this.clickRingT -= dt * 0.004;
            this.clickRing.clear();
            const r = (1 - this.clickRingT) * 16;
            this.clickRing.lineStyle(2, 0xf2e8cf, this.clickRingT * 0.9);
            this.clickRing.strokeCircle(this.clickRingPos.x, this.clickRingPos.y, r);
          } else {
            this.clickRing.clear();
          }
        }
      }

      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: WORLD_W,
        height: WORLD_H,
        backgroundColor: "#14100c",
        pixelArt: true,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        scene: RoomSceneClass,
        physics: { default: "arcade" },
        banner: false,
      });

      gameRef.current = game;
      setReady(true);
    })();

    return () => {
      destroyed = true;
      interactRef.current = null;
      const g = gameRef.current as { destroy?: (b: boolean) => void } | null;
      g?.destroy?.(true);
      gameRef.current = null;
    };
  }, []);

  // Tutorial helpers
  const advanceTutorial = () => {
    if (tutorialStep === null) return;
    const next = tutorialStep + 1;
    if (next >= tutorialLines.length) {
      setTutorialStep(null);
      if (typeof sessionStorage !== "undefined") sessionStorage.setItem("roomTutDone", "1");
    } else {
      setTutorialStep(next);
    }
  };
  const skipTutorial = () => {
    setTutorialStep(null);
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem("roomTutDone", "1");
  };
  skipTutorialRef.current = skipTutorial;

  return (
    <div className="relative w-full">
      {/* Game canvas */}
      <div
        ref={containerRef}
        className="relative aspect-720/520 w-full cursor-pointer overflow-hidden rounded-2xl border border-border-soft bg-[#14100c] shadow-panel"
        style={{ filter: "saturate(0.92) contrast(1.06)" }}
      />

      {/* Loading overlay */}
      {!ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          warming up the room…
        </div>
      )}

      {/* ── Tutorial overlay ── shown only on first visit */}
      {tutorialStep !== null && tutorialLines[tutorialStep] && (
        <motion.div
          key={tutorialStep}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="absolute inset-x-3 md:bottom-12 bottom-57 z-20 rounded-xl border border-white/10 bg-black/85 px-4 py-3 backdrop-blur"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">intro</div>
              <div className="mt-1 text-[13px] leading-snug text-white/90">
                {tutorialLines[tutorialStep].text}
              </div>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={advanceTutorial}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border border-white/20",
                "bg-white/10 px-3 py-1 text-[11px] text-white/80",
                "transition hover:bg-white/18 active:scale-[0.97]",
              )}
            >
              {tutorialStep < tutorialLines.length - 1 ? (
                <>
                  <span>next</span>
                  <span className="text-white/40">▶</span>
                </>
              ) : (
                <span>got it</span>
              )}
            </button>
            <button
              type="button"
              onClick={skipTutorial}
              className="text-[10px] text-white/30 transition hover:text-white/55"
            >
              skip
            </button>
            <span className="ml-auto text-[10px] text-white/25">
              {tutorialStep + 1} / {tutorialLines.length}
            </span>
          </div>
        </motion.div>
      )}

      {/* ── Interaction prompt pill — top-center, only when no tutorial/dialogue ── */}
      {nearbyTarget && !dialogue && tutorialStep === null && (
        <motion.div
          key={nearbyTarget.id}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center"
        >
          <div
            className={cn(
              "flex items-center md:gap-2 rounded-full",
              "border border-white/15 bg-black/60 px-3 py-1.5 backdrop-blur",
              "text-[11px] tracking-wide text-white/80",
            )}
          >
            <span className="text-white/55">{isMobile ? "" : "press"}</span>
            {!isMobile && (
              <span className="rounded-md border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                E
              </span>
            )}
            <span className="text-white/90">{nearbyTarget.label}</span>
          </div>
        </motion.div>
      )}

      {/* ── Dialogue box — top, inside canvas ── */}
      {dialogue && tutorialStep === null && (
        <div className="absolute inset-x-3 md:bottom-12 bottom-57 z-10 rounded-xl border border-white/10 bg-black/80 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
              {dialogue.label}
            </div>
            <button
              type="button"
              onClick={() => setDialogue(null)}
              className="text-[11px] text-white/25 transition hover:text-white/60"
              aria-label="close"
            >
              ✕
            </button>
          </div>
          <div className="mt-1 text-[13px] leading-snug text-white/90">{dialogue.text}</div>
          <div className="mt-1 text-[10px] text-white/30">
            {isMobile
              ? "tap talk to continue · tap floor to dismiss"
              : "press E for next · tap floor to dismiss"}
          </div>
        </div>
      )}

      {/* ── Mobile d-pad + interact — BELOW the canvas, after bottom bar ── */}
      {/* (removed from absolute overlay — now in normal flow below) */}

      {/* ── Bottom bar ── music toggle + movement hint ── */}
      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{isMobile ? "tap floor · D-pad to move" : "click floor · WASD to move"}</span>
        <button
          type="button"
          onClick={() => setMusicOn((v) => !v)}
          className="
            flex items-center gap-1.5 
            bg-black/60
            rounded-full border border-white/10 
            md:bg-black/30 px-2.5 py-1 
            text-[11px] text-white transition 
            md:hover:bg-black/60 md:hover:text-white/80"
        >
          <span>{musicOn ? "♪" : "♩"}</span>
          <span>{musicOn ? "music on" : "music off"}</span>
        </button>
        <span>{isMobile ? "press TALK when close" : "press E when close"}</span>
      </div>

      {/* ── Mobile controls row — below bottom bar text ── */}
      {isMobile && ready && (
        <DPadControls
          wasdMoveRef={wasdMoveRef}
          interactRef={interactRef}
          nearbyTarget={nearbyTarget}
        />
      )}
    </div>
  );
}

// D-pad extracted into its own stable component so timer refs never get
// recreated on parent re-renders (dialogue open/close, etc.)
function DPadControls({
  wasdMoveRef,
  interactRef,
  nearbyTarget,
}: {
  wasdMoveRef: React.RefObject<((dx: number, dy: number) => void) | null>;
  interactRef: React.RefObject<(() => void) | null>;
  nearbyTarget: { id: string; label: string } | null;
}) {
  const HOLD_DELAY = 150;
  const HOLD_INTERVAL = 120;

  // One stable ref per direction — never recreated
  const upTimer = useRef<{
    t: ReturnType<typeof setTimeout> | null;
    i: ReturnType<typeof setInterval> | null;
  }>({ t: null, i: null });
  const downTimer = useRef<{
    t: ReturnType<typeof setTimeout> | null;
    i: ReturnType<typeof setInterval> | null;
  }>({ t: null, i: null });
  const leftTimer = useRef<{
    t: ReturnType<typeof setTimeout> | null;
    i: ReturnType<typeof setInterval> | null;
  }>({ t: null, i: null });
  const rightTimer = useRef<{
    t: ReturnType<typeof setTimeout> | null;
    i: ReturnType<typeof setInterval> | null;
  }>({ t: null, i: null });

  const start = (ref: typeof upTimer, dx: number, dy: number) => {
    stop(ref); // safety: clear any previous
    wasdMoveRef.current?.(dx, dy);
    ref.current.t = setTimeout(() => {
      ref.current.i = setInterval(() => {
        wasdMoveRef.current?.(dx, dy);
      }, HOLD_INTERVAL);
    }, HOLD_DELAY);
  };

  const stop = (ref: typeof upTimer) => {
    if (ref.current.t !== null) {
      clearTimeout(ref.current.t);
      ref.current.t = null;
    }
    if (ref.current.i !== null) {
      clearInterval(ref.current.i);
      ref.current.i = null;
    }
  };

  const btn = (ref: typeof upTimer, dx: number, dy: number, icon: string, className: string) => (
    <button
      type="button"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start(ref, dx, dy);
      }}
      onPointerUp={() => stop(ref)}
      onPointerCancel={() => stop(ref)}
      onPointerLeave={() => stop(ref)}
      className={`${className} flex size-12 items-center justify-center rounded-md border-4 border-white/15 bg-black/60 text-[12px] text-white active:border-blue-600/70 active:text-white`}
    >
      {icon}
    </button>
  );

  return (
    <div className="mt-12 flex items-center justify-between px-1 select-none">
      {/* D-pad */}
      <div className="relative ml-4 size-34">
        {btn(upTimer, 0, -1, "▲", "absolute left-1/2 top-0 -translate-x-1/2")}
        {btn(leftTimer, -1, 0, "◀", "absolute left-0 top-1/2 -translate-y-1/2")}
        {btn(rightTimer, 1, 0, "▶", "absolute right-0 top-1/2 -translate-y-1/2")}
        {btn(downTimer, 0, 1, "▼", "absolute bottom-0 left-1/2 -translate-x-1/2")}
      </div>

      {/* Interact button */}
      <div className="flex mr-4 flex-col items-center gap-1.5">
        <button
          type="button"
          onPointerDown={() => interactRef.current?.()}
          className={cn(
            "flex h-16 w-30 items-center mt-6 justify-center rounded-4xl",
            "border-4 border-white/20 bg-black/60",
            "text-[11px] font-semibold uppercase tracking-widest text-white/70",
            "shadow-inner active:scale-95 active:border-blue-600/75 active:text-white",
            "transition-all duration-75",
            nearbyTarget ? "border-white/35 text-white/90" : "opacity-90",
          )}
          aria-label="interact"
        >
          talk
        </button>
        <span className="text-[9px] text-white/25 tracking-wider uppercase">interact</span>
      </div>
    </div>
  );
}
