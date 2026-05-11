import fs from "fs";
import { getPipelineConfigPath } from "@/lib/paths";
import type { PipelineConfig, RasterExportFormat } from "@/types/pipeline";

const RASTER_FORMATS = new Set<string>(["gif", "webp", "apng"]);

export function loadPipelineConfig(): PipelineConfig {
  const raw = fs.readFileSync(getPipelineConfigPath(), "utf-8");
  return JSON.parse(raw) as PipelineConfig;
}

export function normalizeRasterFormat(
  value: string | undefined,
  fallback: RasterExportFormat = "gif",
): RasterExportFormat {
  const v = (value ?? "").toLowerCase().trim();
  if (RASTER_FORMATS.has(v)) {
    return v as RasterExportFormat;
  }
  return fallback;
}

export function getDefaultExportFormat(cfg: PipelineConfig): RasterExportFormat {
  return normalizeRasterFormat(cfg.output?.format, "gif");
}

/** #RRGGBB → 0xRRGGBB (ffmpeg chromakey) */
export function hexColorToFfmpegHex(hex: string): string {
  const h = hex.trim().replace(/^#/, "");
  if (h.length === 6 && /^[0-9a-fA-F]+$/.test(h)) {
    return `0x${h.toUpperCase()}`;
  }
  return "0x00FF00";
}
