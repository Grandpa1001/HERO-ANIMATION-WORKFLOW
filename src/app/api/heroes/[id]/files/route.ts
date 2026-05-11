import { NextResponse } from "next/server";
import { isSafeHeroId } from "@/lib/heroes-store";
import { scanHeroFiles } from "@/lib/hero-files";
import {
  getDefaultExportFormat,
  loadPipelineConfig,
  normalizeRasterFormat,
} from "@/lib/pipeline-config";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, context: Ctx) {
  const { id } = context.params;
  if (!isSafeHeroId(id)) {
    return NextResponse.json({ error: "Nieprawidłowy identyfikator." }, { status: 400 });
  }
  try {
    const cfg = loadPipelineConfig();
    const tree = await scanHeroFiles(id);
    const defaultFormat = getDefaultExportFormat(cfg);
    const alt = normalizeRasterFormat(cfg.output?.alternativeFormat, "webp");
    return NextResponse.json({
      tree,
      exportSettings: {
        fps: cfg.output.fps,
        width: cfg.output.width,
        defaultFormat,
        alternativeFormat: alt,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Nie udało się zeskanować plików." }, { status: 500 });
  }
}
