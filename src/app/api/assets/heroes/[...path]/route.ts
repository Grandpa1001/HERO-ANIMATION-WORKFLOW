import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getHeroesRoot } from "@/lib/paths";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
};

function mimeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME[ext] ?? "application/octet-stream";
}

type Ctx = { params: { path: string[] } };

export async function GET(_req: Request, context: Ctx) {
  const segments = context.params.path ?? [];
  for (const s of segments) {
    if (s === ".." || s.includes("/") || s.includes("\\")) {
      return new NextResponse("Invalid path", { status: 400 });
    }
  }

  const root = path.resolve(getHeroesRoot());
  const full = path.resolve(path.join(root, ...segments));

  if (!full.startsWith(root + path.sep) && full !== root) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const buf = fs.readFileSync(full);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": mimeFor(full),
      "Cache-Control": "public, max-age=60",
    },
  });
}
