import { NextResponse } from "next/server";
import {
  addPrompt,
  listPrompts,
  normalizePromptCategories,
} from "@/lib/prompts-store";
import type { PromptCategory } from "@/types/prompts";
import { PROMPT_CATEGORIES } from "@/types/prompts";

export const dynamic = "force-dynamic";

function parseCategoryParam(
  value: string | null,
): PromptCategory | null | undefined {
  if (value === null || value === "") return null;
  if (value === "all") return null;
  if ((PROMPT_CATEGORIES as readonly string[]).includes(value)) {
    return value as PromptCategory;
  }
  return undefined;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("category");
  const parsed = parseCategoryParam(raw);
  if (parsed === undefined) {
    return NextResponse.json(
      {
        error: `Nieprawidłowa kategoria. Dozwolone: all, ${PROMPT_CATEGORIES.join(", ")}`,
      },
      { status: 400 },
    );
  }
  const prompts = listPrompts(parsed);
  return NextResponse.json({ prompts });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      name?: string;
      text?: string;
      category?: unknown;
    };
    const name = typeof body.name === "string" ? body.name : "";
    const text = typeof body.text === "string" ? body.text : "";
    const category = normalizePromptCategories(body.category);
    if (!name.trim()) {
      return NextResponse.json({ error: "Nazwa promptu jest wymagana." }, { status: 400 });
    }
    if (!text.trim()) {
      return NextResponse.json({ error: "Treść promptu jest wymagana." }, { status: 400 });
    }
    if (category.length === 0) {
      return NextResponse.json(
        { error: "Wybierz co najmniej jedną kategorię." },
        { status: 400 },
      );
    }
    const prompt = addPrompt({ name, text, category });
    return NextResponse.json({ prompt }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Nie udało się zapisać promptu." }, { status: 500 });
  }
}
