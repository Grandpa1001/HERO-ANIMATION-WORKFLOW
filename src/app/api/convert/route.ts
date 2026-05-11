import { NextResponse } from "next/server";
import { getHeroById, isSafeHeroId } from "@/lib/heroes-store";
import {
  convertHeroMp4ToRaster,
  listPendingRasterKeys,
} from "@/lib/convert";
import {
  getDefaultExportFormat,
  loadPipelineConfig,
  normalizeRasterFormat,
} from "@/lib/pipeline-config";
import type { RasterExportFormat } from "@/types/pipeline";

export const dynamic = "force-dynamic";

const KEY_RE = /^[a-z0-9_]+$/i;

function logicalOutputPath(rel: string): string {
  return `/heroes/${rel.split("/").filter(Boolean).join("/")}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      heroId?: string;
      animationKey?: string;
      animationName?: string;
      mp4Path?: string;
      batchPending?: boolean;
      format?: string;
      options?: { width?: number; fps?: number };
    };

    const cfg = loadPipelineConfig();
    const defaultFmt = getDefaultExportFormat(cfg);
    const format: RasterExportFormat = normalizeRasterFormat(
      typeof body.format === "string" ? body.format : undefined,
      defaultFmt,
    );

    const heroId = typeof body.heroId === "string" ? body.heroId : "";
    if (!isSafeHeroId(heroId)) {
      return NextResponse.json({ error: "Nieprawidłowy bohater." }, { status: 400 });
    }
    if (!getHeroById(heroId)) {
      return NextResponse.json({ error: "Nie znaleziono bohatera." }, { status: 404 });
    }

    const options =
      body.options && typeof body.options === "object"
        ? {
            width:
              typeof body.options.width === "number" ? body.options.width : undefined,
            fps: typeof body.options.fps === "number" ? body.options.fps : undefined,
          }
        : undefined;
    const overrides: Partial<{ width: number; fps: number }> = {};
    if (options?.width !== undefined) overrides.width = options.width;
    if (options?.fps !== undefined) overrides.fps = options.fps;

    if (typeof body.mp4Path === "string" && body.mp4Path.trim()) {
      return NextResponse.json(
        { error: "Ścieżka mp4Path nie jest jeszcze obsługiwana — użyj heroId + animationKey." },
        { status: 400 },
      );
    }

    if (body.batchPending === true) {
      const keys = listPendingRasterKeys(heroId, format);
      const results: {
        animationKey: string;
        ok: boolean;
        bytes?: number;
        format?: RasterExportFormat;
        error?: string;
        durationSec?: number;
        framesApprox?: number;
        outputPath?: string;
        fileSize?: number;
      }[] = [];
      for (const k of keys) {
        try {
          const r = await convertHeroMp4ToRaster(heroId, k, format, overrides);
          results.push({
            animationKey: k,
            ok: true,
            bytes: r.bytes,
            format: r.format,
            durationSec: r.durationSec,
            framesApprox: r.framesApprox,
            outputPath: logicalOutputPath(r.relativePath),
            fileSize: r.bytes,
          });
        } catch (e) {
          results.push({
            animationKey: k,
            ok: false,
            error: (e as Error).message,
          });
        }
      }
      return NextResponse.json({ ok: true, batch: true, format, results });
    }

    const animationKeyRaw =
      (typeof body.animationKey === "string" && body.animationKey.trim()
        ? body.animationKey
        : typeof body.animationName === "string"
          ? body.animationName
          : "") ?? "";
    const animationKey = animationKeyRaw.trim();
    if (!animationKey || !KEY_RE.test(animationKey)) {
      return NextResponse.json(
        { error: "Podaj animationKey lub animationName (np. idle, jump_in)." },
        { status: 400 },
      );
    }

    try {
      const r = await convertHeroMp4ToRaster(heroId, animationKey, format, overrides);
      return NextResponse.json({
        ok: true,
        format: r.format,
        fileSize: r.bytes,
        bytes: r.bytes,
        durationSec: r.durationSec,
        frames: r.framesApprox,
        framesApprox: r.framesApprox,
        gifPath: logicalOutputPath(r.relativePath),
        outputPath: logicalOutputPath(r.relativePath),
        animationKey,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      /** Brak oczekiwanego pliku wejściowego — zwykle zła nazwa MP4 (konwencja `{id}_{animacja}.mp4`). */
      const isClientInput =
        msg.startsWith("Brak pliku MP4:") || msg.includes("ENOENT");
      return NextResponse.json(
        { ok: false, error: msg },
        { status: isClientInput ? 400 : 500 },
      );
    }
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 400 });
  }
}
