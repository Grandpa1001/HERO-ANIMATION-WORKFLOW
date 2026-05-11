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
  const mp4Name = `${heroId}_${animationKey}.mp4`;
  const outName = outputBasename(heroId, animationKey, format);
  const inputPath = path.join(root, heroId, "mp4", mp4Name);
  const outPath = path.join(root, heroId, "gif", outName);
  return { root, inputPath, outPath, mp4Name, outName };
}

export function animationKeyFromMp4Filename(
  heroId: string,
  filename: string,
): string | null {
  const prefix = `${heroId}_`;
  if (!filename.startsWith(prefix) || !filename.toLowerCase().endsWith(".mp4")) {
    return null;
  }
  return filename.slice(prefix.length, -4);
}

/** MP4 istnieje, brak pliku wyjściowego w podanym formacie (w folderze gif/). */
export function listPendingRasterKeys(
  heroId: string,
  format: RasterExportFormat,
): string[] {
  const root = getHeroesRoot();
  const mp4Dir = path.join(root, heroId, "mp4");
  const gifDir = path.join(root, heroId, "gif");
  if (!fs.existsSync(mp4Dir)) return [];
  const ext = RASTER_EXT[format];
  const keys: string[] = [];
  for (const name of fs.readdirSync(mp4Dir)) {
    if (!name.toLowerCase().endsWith(".mp4")) continue;
    const key = animationKeyFromMp4Filename(heroId, name);
    if (!key) continue;
    const outName = `${heroId}_${key}${ext}`;
    const hasOut = fs.existsSync(path.join(gifDir, outName));
    if (!hasOut) keys.push(key);
  }
  return keys;
}

/** @deprecated użyj listPendingRasterKeys — domyślny format z pipeline */
export function listPendingAnimationKeys(heroId: string): string[] {
  const cfg = loadPipelineConfig();
  const fmt = getDefaultExportFormat(cfg);
  return listPendingRasterKeys(heroId, fmt);
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
