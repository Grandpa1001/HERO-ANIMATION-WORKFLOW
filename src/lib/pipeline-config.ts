import fs from "fs";
import { getPipelineConfigPath } from "@/lib/paths";
import { DEFAULT_PIPELINE_CONFIG } from "@/lib/pipeline-defaults";
import type { PipelineConfig, RasterExportFormat } from "@/types/pipeline";

const RASTER_FORMATS = new Set<string>(["gif", "webp", "apng"]);

export { DEFAULT_PIPELINE_CONFIG } from "@/lib/pipeline-defaults";

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function clampNumber(val: unknown, fallback: number, min: number, max: number): number {
  const n = typeof val === "number" ? val : Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function clampInt(val: unknown, fallback: number, min: number, max: number): number {
  const n = clampNumber(val, fallback, min, max);
  return Math.round(n);
}

function safeRelPath(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (t.includes("..")) return false;
  return true;
}

/** Uzupełnia brakujące pola (np. starszy plik bez sekcji `fal`). */
export function mergePipelineConfig(input: unknown): PipelineConfig {
  if (!isRecord(input)) {
    return structuredClone(DEFAULT_PIPELINE_CONFIG);
  }

  const g = isRecord(input.greenscreen) ? input.greenscreen : {};
  const o = isRecord(input.output) ? input.output : {};
  const f = isRecord(input.fal) ? input.fal : {};
  const fo = isRecord(input.folders) ? input.folders : {};

  const altRaw = o.alternativeFormat;
  const alternativeFormat =
    typeof altRaw === "string" && altRaw.trim()
      ? normalizeRasterFormat(altRaw.trim(), "webp")
      : DEFAULT_PIPELINE_CONFIG.output.alternativeFormat;

  const heroesRoot =
    typeof fo.heroesRoot === "string" &&
    fo.heroesRoot.trim() &&
    safeRelPath(fo.heroesRoot)
      ? fo.heroesRoot.trim()
      : DEFAULT_PIPELINE_CONFIG.folders.heroesRoot;

  const promptsFile =
    typeof fo.promptsFile === "string" &&
    fo.promptsFile.trim() &&
    safeRelPath(fo.promptsFile)
      ? fo.promptsFile.trim()
      : DEFAULT_PIPELINE_CONFIG.folders.promptsFile;

  return {
    greenscreen: {
      color:
        typeof g.color === "string" && /^#[0-9a-fA-F]{6}$/.test(g.color.trim())
          ? g.color.trim().toUpperCase()
          : DEFAULT_PIPELINE_CONFIG.greenscreen.color,
      similarity: clampNumber(
        g.similarity,
        DEFAULT_PIPELINE_CONFIG.greenscreen.similarity,
        0,
        1,
      ),
      blend: clampNumber(g.blend, DEFAULT_PIPELINE_CONFIG.greenscreen.blend, 0, 1),
    },
    output: {
      format: normalizeRasterFormat(
        typeof o.format === "string" ? o.format : undefined,
        "gif",
      ),
      alternativeFormat,
      fps: clampInt(o.fps, DEFAULT_PIPELINE_CONFIG.output.fps, 1, 60),
      width: clampInt(o.width, DEFAULT_PIPELINE_CONFIG.output.width, 16, 4096),
      loop:
        typeof o.loop === "boolean"
          ? o.loop
          : DEFAULT_PIPELINE_CONFIG.output.loop,
    },
    fal: {
      model:
        typeof f.model === "string" && f.model.trim()
          ? f.model.trim().slice(0, 200)
          : DEFAULT_PIPELINE_CONFIG.fal.model,
      duration: clampInt(f.duration, DEFAULT_PIPELINE_CONFIG.fal.duration, 1, 120),
      aspectRatio:
        typeof f.aspectRatio === "string" && f.aspectRatio.trim()
          ? f.aspectRatio.trim().slice(0, 32)
          : DEFAULT_PIPELINE_CONFIG.fal.aspectRatio,
    },
    folders: {
      heroesRoot,
      promptsFile,
    },
  };
}

export function loadPipelineConfig(): PipelineConfig {
  try {
    const raw = fs.readFileSync(getPipelineConfigPath(), "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return mergePipelineConfig(parsed);
  } catch {
    return structuredClone(DEFAULT_PIPELINE_CONFIG);
  }
}

export function savePipelineConfig(cfg: PipelineConfig): void {
  const filePath = getPipelineConfigPath();
  fs.writeFileSync(filePath, `${JSON.stringify(cfg, null, 2)}\n`, "utf-8");
}

/** Walidacja ciała żądania PUT — bez cichego domyślnego „naprawiania” pustych pól krytycznych. */
export function parsePipelineConfigFromRequest(
  json: unknown,
): { ok: true; config: PipelineConfig } | { ok: false; error: string } {
  if (!isRecord(json)) {
    return { ok: false, error: "Oczekiwano obiektu JSON." };
  }

  const gs = json.greenscreen;
  if (!isRecord(gs)) {
    return { ok: false, error: "Brak obiektu greenscreen." };
  }
  const color = typeof gs.color === "string" ? gs.color.trim() : "";
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    return { ok: false, error: "greenscreen.color musi być w formacie #RRGGBB." };
  }
  const simN = typeof gs.similarity === "number" ? gs.similarity : Number(gs.similarity);
  if (!Number.isFinite(simN) || simN < 0 || simN > 1) {
    return { ok: false, error: "greenscreen.similarity: liczba od 0 do 1." };
  }
  const blendN = typeof gs.blend === "number" ? gs.blend : Number(gs.blend);
  if (!Number.isFinite(blendN) || blendN < 0 || blendN > 1) {
    return { ok: false, error: "greenscreen.blend: liczba od 0 do 1." };
  }

  const out = json.output;
  if (!isRecord(out)) {
    return { ok: false, error: "Brak obiektu output." };
  }
  if (!RASTER_FORMATS.has(String(out.format ?? "").toLowerCase().trim())) {
    return { ok: false, error: "output.format: dozwolone gif, webp, apng." };
  }
  const alt = out.alternativeFormat;
  if (alt !== undefined && alt !== null && String(alt).trim() !== "") {
    if (!RASTER_FORMATS.has(String(alt).toLowerCase().trim())) {
      return { ok: false, error: "output.alternativeFormat: dozwolone gif, webp, apng lub puste." };
    }
  }
  const fpsN = typeof out.fps === "number" ? out.fps : Number(out.fps);
  if (!Number.isFinite(fpsN) || fpsN < 1 || fpsN > 60) {
    return { ok: false, error: "output.fps: liczba od 1 do 60." };
  }
  const widthN = typeof out.width === "number" ? out.width : Number(out.width);
  if (!Number.isFinite(widthN) || widthN < 16 || widthN > 4096) {
    return { ok: false, error: "output.width: liczba od 16 do 4096 (px)." };
  }
  if (typeof out.loop !== "boolean") {
    return { ok: false, error: "output.loop musi być wartością logiczną." };
  }

  const fal = json.fal;
  if (!isRecord(fal)) {
    return { ok: false, error: "Brak obiektu fal." };
  }
  if (typeof fal.model !== "string" || !fal.model.trim()) {
    return { ok: false, error: "fal.model nie może być pusty." };
  }
  const durN = typeof fal.duration === "number" ? fal.duration : Number(fal.duration);
  if (!Number.isFinite(durN) || durN < 1 || durN > 120) {
    return { ok: false, error: "fal.duration: liczba od 1 do 120 (s)." };
  }
  const ar = typeof fal.aspectRatio === "string" ? fal.aspectRatio.trim() : "";
  if (!ar || ar.length > 32) {
    return { ok: false, error: "fal.aspectRatio: niepusty tekst (np. 9:16)." };
  }

  const folders = json.folders;
  if (!isRecord(folders)) {
    return { ok: false, error: "Brak obiektu folders." };
  }
  const hr = typeof folders.heroesRoot === "string" ? folders.heroesRoot.trim() : "";
  const pf = typeof folders.promptsFile === "string" ? folders.promptsFile.trim() : "";
  if (!hr || !safeRelPath(hr)) {
    return { ok: false, error: "folders.heroesRoot: niepusta ścieżka względna bez '..'." };
  }
  if (!pf || !safeRelPath(pf)) {
    return { ok: false, error: "folders.promptsFile: niepusta ścieżka względna bez '..'." };
  }

  return { ok: true, config: mergePipelineConfig(json) };
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
  return normalizeRasterFormat(cfg.output.format, "gif");
}

/** #RRGGBB → 0xRRGGBB (ffmpeg chromakey) */
export function hexColorToFfmpegHex(hex: string): string {
  const h = hex.trim().replace(/^#/, "");
  if (h.length === 6 && /^[0-9a-fA-F]+$/.test(h)) {
    return `0x${h.toUpperCase()}`;
  }
  return "0x00FF00";
}
