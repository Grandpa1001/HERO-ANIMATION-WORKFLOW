import path from "path";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import type { RasterExportFormat } from "@/types/pipeline";
import { getHeroesRoot } from "@/lib/paths";
import {
  getDefaultExportFormat,
  hexColorToFfmpegHex,
  loadPipelineConfig,
  normalizeRasterFormat,
} from "@/lib/pipeline-config";
import { getHeroById } from "@/lib/heroes-store";
import { findMp4FilenameForKey } from "@/lib/hero-mp4-resolve";

/** Ustaw binarkę ffmpeg (domyślnie z PATH; opcjonalnie `FFMPEG_PATH`). */
function applyFfmpegPath(): void {
  const p = process.env.FFMPEG_PATH?.trim();
  if (p) {
    ffmpeg.setFfmpegPath(p);
  }
}

const RASTER_EXT: Record<RasterExportFormat, string> = {
  gif: ".gif",
  webp: ".webp",
  apng: ".apng",
};

export function rasterExtension(format: RasterExportFormat): string {
  return RASTER_EXT[format];
}

export function outputBasename(
  heroId: string,
  animationKey: string,
  format: RasterExportFormat,
): string {
  return `${heroId}_${animationKey}${RASTER_EXT[format]}`;
}

export type ConvertRasterResult = {
  format: RasterExportFormat;
  /** Względem katalogu heroes, np. zara/gif/zara_idle.webp */
  relativePath: string;
  bytes: number;
  durationSec?: number;
  framesApprox?: number;
};

function resolvePaths(heroId: string, animationKey: string, format: RasterExportFormat) {
  const root = getHeroesRoot();
  const mp4Dir = path.join(root, heroId, "mp4");
  const names = fs.existsSync(mp4Dir) ? fs.readdirSync(mp4Dir) : [];
  const mp4Name =
    findMp4FilenameForKey(heroId, animationKey, names) ??
    `${heroId}_${animationKey}.mp4`;
  const outName = outputBasename(heroId, animationKey, format);
  const inputPath = path.join(mp4Dir, mp4Name);
  const outPath = path.join(root, heroId, "gif", outName);
  return { root, inputPath, outPath, mp4Name, outName };
}

/**
 * Klucze animacji z definicji bohatera, dla których jest MP4 (dowolna dopuszczalna nazwa),
 * a brak pliku wyjściowego w podanym formacie w folderze gif/.
 */
export function listPendingRasterKeys(
  heroId: string,
  format: RasterExportFormat,
  animationKeys: string[],
): string[] {
  const root = getHeroesRoot();
  const mp4Dir = path.join(root, heroId, "mp4");
  const gifDir = path.join(root, heroId, "gif");
  if (!fs.existsSync(mp4Dir)) return [];
  const names = fs.readdirSync(mp4Dir);
  const ext = RASTER_EXT[format];
  const pending: string[] = [];
  for (const key of animationKeys) {
    const mp4Name = findMp4FilenameForKey(heroId, key, names);
    if (!mp4Name) continue;
    const outName = `${heroId}_${key}${ext}`;
    if (!fs.existsSync(path.join(gifDir, outName))) {
      pending.push(key);
    }
  }
  return pending;
}

/** Domyślny format z pipeline; klucze z zapisanej definicji bohatera. */
export function listPendingAnimationKeys(heroId: string): string[] {
  const hero = getHeroById(heroId);
  if (!hero) return [];
  const cfg = loadPipelineConfig();
  const fmt = getDefaultExportFormat(cfg);
  return listPendingRasterKeys(heroId, fmt, Object.keys(hero.animations));
}

function ffprobeDurationSeconds(file: string): Promise<number | undefined> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(file, (err, data) => {
      if (err || data.format?.duration === undefined) {
        resolve(undefined);
        return;
      }
      const d = parseFloat(String(data.format.duration));
      resolve(Number.isFinite(d) ? d : undefined);
    });
  });
}

/**
 * MP4 (greenscreen) → GIF (palette + alpha) | animowany WebP | APNG.
 */
export async function convertHeroMp4ToRaster(
  heroId: string,
  animationKey: string,
  format: RasterExportFormat,
  overrides?: Partial<{ width: number; fps: number }>,
): Promise<ConvertRasterResult> {
  applyFfmpegPath();
  const cfg = loadPipelineConfig();
  const fmt = normalizeRasterFormat(format, getDefaultExportFormat(cfg));
  const { inputPath, outPath } = resolvePaths(heroId, animationKey, fmt);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Brak pliku MP4: ${path.basename(inputPath)}`);
  }

  const gifDir = path.dirname(outPath);
  if (!fs.existsSync(gifDir)) {
    fs.mkdirSync(gifDir, { recursive: true });
  }

  const color = hexColorToFfmpegHex(cfg.greenscreen.color);
  const sim = cfg.greenscreen.similarity;
  const blend = cfg.greenscreen.blend;
  const w = overrides?.width ?? cfg.output.width;
  const fps = overrides?.fps ?? cfg.output.fps;

  const durationSec = await ffprobeDurationSeconds(inputPath);

  const chromaPart = `chromakey=color=${color}:similarity=${sim}:blend=${blend},fps=${fps},scale=${w}:-1:flags=lanczos`;

  if (fmt === "gif") {
    const filter = `[0:v]${chromaPart},split[s0][s1];[s0]palettegen=max_colors=256:reserve_transparent=1[p];[s1][p]paletteuse=alpha_threshold=128`;
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .complexFilter(filter)
        .outputOptions(["-loop", "0"])
        .output(outPath)
        .on("end", () => resolve())
        .on("error", (err: Error) => reject(err))
        .run();
    });
  } else if (fmt === "webp") {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters([chromaPart, "format=yuva420p"])
        .outputOptions([
          "-c:v",
          "libwebp",
          "-pix_fmt",
          "yuva420p",
          "-quality",
          "82",
          "-compression_level",
          "6",
          "-loop",
          "0",
          "-an",
        ])
        .output(outPath)
        .on("end", () => resolve())
        .on("error", (err: Error) => reject(err))
        .run();
    });
  } else {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters([chromaPart])
        .outputOptions(["-plays", "0"])
        .format("apng")
        .output(outPath)
        .on("end", () => resolve())
        .on("error", (err: Error) => reject(err))
        .run();
    });
  }

  const bytes = fs.statSync(outPath).size;
  const rel = path.join(heroId, "gif", path.basename(outPath)).split(path.sep).join("/");
  const framesApprox =
    durationSec !== undefined ? Math.max(1, Math.round(durationSec * fps)) : undefined;

  return {
    format: fmt,
    relativePath: rel,
    bytes,
    durationSec,
    framesApprox,
  };
}
