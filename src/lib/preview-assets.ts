import type { AnimationEntry } from "@/types/heroes";
import { heroesRelativeToAssetUrl } from "@/lib/hero-assets";

/** Kolejność podglądu: WebP (alpha) → GIF → APNG. */
export function pickRasterFile(entry: AnimationEntry | undefined): {
  filename: string;
  kind: "webp" | "gif" | "apng";
} | null {
  if (!entry) return null;
  if (entry.webp) return { filename: entry.webp, kind: "webp" };
  if (entry.gif) return { filename: entry.gif, kind: "gif" };
  if (entry.apng) return { filename: entry.apng, kind: "apng" };
  return null;
}

export function rasterAssetUrl(heroId: string, filename: string): string {
  return heroesRelativeToAssetUrl(`${heroId}/gif/${filename}`);
}

export function mp4AssetUrl(heroId: string, filename: string): string {
  return heroesRelativeToAssetUrl(`${heroId}/mp4/${filename}`);
}
