import { NextResponse } from "next/server";
import {
  deletePrompt,
  getPromptById,
  normalizePromptCategories,
  updatePrompt,
} from "@/lib/prompts-store";
import { reconcileAllHeroesAnimationsWithPrompts } from "@/lib/heroes-store";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, context: Ctx) {
  const { id } = context.params;
  const prompt = getPromptById(id);
  if (!prompt) {
    return NextResponse.json({ error: "Nie znaleziono promptu." }, { status: 404 });
  }
  return NextResponse.json({ prompt });
}

export async function PUT(req: Request, context: Ctx) {
  const { id } = context.params;
  try {
    const body = (await req.json()) as {
      name?: string;
      text?: string;
      category?: unknown;
    };
    const patch: Parameters<typeof updatePrompt>[1] = {};
    if (typeof body.name === "string") {
      if (!body.name.trim()) {
        return NextResponse.json({ error: "Nazwa nie może być pusta." }, { status: 400 });
      }
      patch.name = body.name;
    }
    if (typeof body.text === "string") {
      if (!body.text.trim()) {
        return NextResponse.json({ error: "Treść nie może być pusta." }, { status: 400 });
      }
      patch.text = body.text;
    }
    if (body.category !== undefined) {
      const cats = normalizePromptCategories(body.category);
      if (cats.length === 0) {
        return NextResponse.json(
          { error: "Wybierz co najmniej jedną kategorię." },
          { status: 400 },
        );
      }
      patch.category = cats;
    }
    const prompt = updatePrompt(id, patch);
    if (!prompt) {
      return NextResponse.json({ error: "Nie znaleziono promptu." }, { status: 404 });
    }
    return NextResponse.json({ prompt });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Nie udało się zapisać." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: Ctx) {
  const { id } = context.params;
  const ok = deletePrompt(id);
  if (!ok) {
    return NextResponse.json({ error: "Nie znaleziono promptu." }, { status: 404 });
  }
  reconcileAllHeroesAnimationsWithPrompts();
  return NextResponse.json({ ok: true });
}
