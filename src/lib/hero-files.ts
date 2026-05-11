import fs from "fs";
import path from "path";
import sharp from "sharp";
import { getHeroesRoot } from "@/lib/paths";

const RASTER_EXTS = [".gif", ".webp", ".apng"] as const;

export type HeroFileEntry = {
  name: string;
  /** Ścieżka względem katalogu heroes, np. zara/mp4/zara_idle.mp4 */
  relativePath: string;
  bytes: number;
  width?: number;
  height?: number;
  /** Dla MP4: czy istnieje dowolny plik wyjściowy (gif/webp/apng) o tej samej bazie nazwy */
  hasPairedExport?: boolean;
  /** Dla PNG głównego — podpowiedź UI */
  hint?: string;
};

export type HeroFilesTree = {
  heroId: string;
  png: HeroFileEntry[];
  mp4: HeroFileEntry[];
  /** Zawartość folderu gif/ — GIF, WebP, APNG */
  rasters: HeroFileEntry[];
  mp4PendingCount: number;
  rasterCount: number;
};

function formatMainPngName(heroId: string): string {
  return `${heroId}_main.png`;
}

async function enrichImageMeta(absPath: string): Promise<{ width?: number; height?: number }> {
  try {
    const m = await sharp(absPath).metadata();
    return { width: m.width, height: m.height };
  } catch {
    return {};
  }
}

function hasRasterSibling(gifDir: string, baseWithoutExt: string): boolean {
  if (!fs.existsSync(gifDir)) return false;
  return RASTER_EXTS.some((ext) => fs.existsSync(path.join(gifDir, baseWithoutExt + ext)));
}

export async function scanHeroFiles(heroId: string): Promise<HeroFilesTree> {
  const root = getHeroesRoot();
  const base = path.join(root, heroId);
  const pngDir = path.join(base, "png");
  const mp4Dir = path.join(base, "mp4");
  const gifDir = path.join(base, "gif");

  const png: HeroFileEntry[] = [];
  const mp4: HeroFileEntry[] = [];
  const rasters: HeroFileEntry[] = [];

  const readDir = (dir: string): string[] => {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((n) => !n.startsWith("."));
  };

  for (const name of readDir(pngDir)) {
    if (!name.toLowerCase().endsWith(".png")) continue;
    const abs = path.join(pngDir, name);
    const st = fs.statSync(abs);
    const meta = await enrichImageMeta(abs);
    const entry: HeroFileEntry = {
      name,
      relativePath: path.join(heroId, "png", name).split(path.sep).join("/"),
      bytes: st.size,
      width: meta.width,
      height: meta.height,
    };
    if (name === formatMainPngName(heroId)) {
      entry.hint = "greenscreen";
    }
    png.push(entry);
  }

  for (const name of readDir(mp4Dir)) {
    if (!name.toLowerCase().endsWith(".mp4")) continue;
    const abs = path.join(mp4Dir, name);
    const st = fs.statSync(abs);
    const baseName = name.replace(/\.mp4$/i, "");
    const hasPairedExport = hasRasterSibling(gifDir, baseName);
    mp4.push({
      name,
      relativePath: path.join(heroId, "mp4", name).split(path.sep).join("/"),
      bytes: st.size,
      hasPairedExport,
    });
  }

  for (const name of readDir(gifDir)) {
    const lower = name.toLowerCase();
    if (
      !lower.endsWith(".gif") &&
      !lower.endsWith(".webp") &&
      !lower.endsWith(".apng")
    ) {
      continue;
    }
    const abs = path.join(gifDir, name);
    const st = fs.statSync(abs);
    const meta = await enrichImageMeta(abs);
    rasters.push({
      name,
      relativePath: path.join(heroId, "gif", name).split(path.sep).join("/"),
      bytes: st.size,
      width: meta.width,
      height: meta.height,
    });
  }

  png.sort((a, b) => a.name.localeCompare(b.name));
  mp4.sort((a, b) => a.name.localeCompare(b.name));
  rasters.sort((a, b) => a.name.localeCompare(b.name));

  const mp4PendingCount = mp4.filter((m) => !m.hasPairedExport).length;

  return {
    heroId,
    png,
    mp4,
    rasters,
    mp4PendingCount,
    rasterCount: rasters.length,
  };
}
