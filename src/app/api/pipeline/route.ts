import { NextResponse } from "next/server";
import {
  loadPipelineConfig,
  parsePipelineConfigFromRequest,
  savePipelineConfig,
} from "@/lib/pipeline-config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = loadPipelineConfig();
    return NextResponse.json({ config });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Nie udało się wczytać konfiguracji." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as { config?: unknown };
    const raw = body.config !== undefined ? body.config : body;
    const parsed = parsePipelineConfigFromRequest(raw);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    savePipelineConfig(parsed.config);
    return NextResponse.json({ ok: true, config: parsed.config });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 400 });
  }
}
