import { NextResponse } from "next/server";
import { createHero, listHeroesRescanned } from "@/lib/heroes-store";
import { listPromptAnimationIds } from "@/lib/prompts-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const heroes = listHeroesRescanned();
  return NextResponse.json({
    heroes,
    promptAnimationIds: listPromptAnimationIds(),
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      name?: string;
      description?: string;
      tags?: unknown;
    };
    const name = typeof body.name === "string" ? body.name : "";
    const description =
      typeof body.description === "string" ? body.description : "";
    if (!name.trim()) {
      return NextResponse.json(
        { error: "Nazwa bohatera jest wymagana." },
        { status: 400 },
      );
    }
    const tags = Array.isArray(body.tags)
      ? body.tags.filter((t): t is string => typeof t === "string")
      : [];

    const hero = createHero({ name, description, tags });
    return NextResponse.json(
      { hero, promptAnimationIds: listPromptAnimationIds() },
      { status: 201 },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Nie udało się utworzyć bohatera." }, { status: 500 });
  }
}
