export type AnimationStatus = "done" | "pending" | "missing";

export type AnimationEntry = {
  mp4: string | null;
  gif: string | null;
  webp: string | null;
  apng: string | null;
  status: AnimationStatus;
};

export type Hero = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  /** Ścieżka logiczna zgodna z pipeline, np. /heroes/zara/png/zara_main.png */
  png: string;
  animations: Record<string, AnimationEntry>;
};

export type HeroesFile = {
  heroes: Hero[];
};

export const DEFAULT_ANIMATION_KEYS = [
  "idle",
  "run",
  "wave",
  "jump_in",
  "dance",
] as const;
