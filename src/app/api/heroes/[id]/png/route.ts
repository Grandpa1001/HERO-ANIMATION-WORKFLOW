import { NextResponse } from "next/server";
import sharp from "sharp";
import fs from "fs";
import { ensureHeroDirs, getHeroById, mainPngAbsolute } from "@/lib/heroes-store";

export const dynamic = "force-dynamic";

const ASPECT_9_16 = 9 / 16;
const ASPECT_TOLERANCE = 0.06;

type Ctx = { params: { id: string } };

export async function POST(req: Request, context: Ctx) {
  const { id } = context.params;
  const hero = getHeroById(id);
  if (!hero) {
    return NextResponse.json({ error: "Nie znaleziono bohatera." }, { status: 404 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Brak pliku (pole file)." }, { status: 400 });
  }
  if (file.type && file.type !== "image/png") {
    return NextResponse.json(
      { error: "Wymagany format PNG." },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let meta: sharp.Metadata;
  try {
    meta = await sharp(buf).metadata();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowy obraz PNG." }, { status: 400 });
  }

  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) {
    return NextResponse.json(
      { error: "Nie można odczytać wymiarów obrazu." },
      { status: 400 },
    );
  }

  const ratio = w / h;
  if (Math.abs(ratio - ASPECT_9_16) > ASPECT_TOLERANCE) {
    return NextResponse.json(
      {
        error:
          "Kadr powinien być w proporcji 9:16 (pionowy). Sprawdź szerokość i wysokość pliku.",
        width: w,
        height: h,
      },
      { status: 400 },
    );
  }

  ensureHeroDirs(id);
  const out = mainPngAbsolute(id);
  await sharp(buf).png().toFile(out);

  return NextResponse.json({
    ok: true,
    path: hero.png,
    bytes: fs.statSync(out).size,
  });
}
