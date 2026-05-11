import { NextResponse } from "next/server";
import { deleteHero, getHeroById, updateHero } from "@/lib/heroes-store";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, context: Ctx) {
  const { id } = context.params;
  const hero = getHeroById(id);
  if (!hero) {
    return NextResponse.json({ error: "Nie znaleziono bohatera." }, { status: 404 });
  }
  return NextResponse.json({ hero });
}

export async function PUT(req: Request, context: Ctx) {
  const { id } = context.params;
  try {
    const body = (await req.json()) as {
      name?: string;
      description?: string;
      tags?: unknown;
    };
    const patch: Parameters<typeof updateHero>[1] = {};
    if (typeof body.name === "string") patch.name = body.name;
    if (typeof body.description === "string") patch.description = body.description;
    if (Array.isArray(body.tags)) {
      patch.tags = body.tags.filter((t): t is string => typeof t === "string");
    }
    const hero = updateHero(id, patch);
    if (!hero) {
      return NextResponse.json({ error: "Nie znaleziono bohatera." }, { status: 404 });
    }
    return NextResponse.json({ hero });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Nie udało się zapisać." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: Ctx) {
  const { id } = context.params;
  const result = deleteHero(id);
  if (!result.ok) {
    const status = result.error.includes("Nie znaleziono") ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true });
}
