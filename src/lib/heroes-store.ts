import fs from "fs";
import path from "path";
import type {
  AnimationEntry,
  AnimationStatus,
  Hero,
  HeroesFile,
} from "@/types/heroes";
import { DEFAULT_ANIMATION_KEYS } from "@/types/heroes";
import { getHeroesRoot } from "@/lib/paths";

function getDataPath(): string {
  return path.join(process.cwd(), "data", "heroes.json");
}

function ensureDataDir(): void {
  const dir = path.dirname(getDataPath());
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function slugifyName(name: string): string {
  const s = name
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "hero";
}

function uniqueId(base: string, taken: Set<string>): string {
  let id = base;
  let n = 2;
  while (taken.has(id)) {
    id = `${base}-${n++}`;
  }
  return id;
}

export function defaultAnimations(): Record<string, AnimationEntry> {
  const o: Record<string, AnimationEntry> = {};
  for (const k of DEFAULT_ANIMATION_KEYS) {
    o[k] = {
      mp4: null,
      gif: null,
      webp: null,
      apng: null,
      status: "missing",
    };
  }
  return o;
}

export function heroPngLogicalPath(heroId: string): string {
  return `/heroes/${heroId}/png/${heroId}_main.png`;
}

export function ensureHeroDirs(heroId: string): void {
  const root = getHeroesRoot();
  for (const sub of ["png", "mp4", "gif"]) {
    const p = path.join(root, heroId, sub);
    if (!fs.existsSync(p)) {
      fs.mkdirSync(p, { recursive: true });
    }
  }
}

export function mainPngAbsolute(heroId: string): string {
  return path.join(getHeroesRoot(), heroId, "png", `${heroId}_main.png`);
}

export function rescanHeroAnimations(hero: Hero): Hero {
  const root = getHeroesRoot();
  const next: Hero = {
    ...hero,
    animations: { ...hero.animations },
  };

  for (const [key] of Object.entries(next.animations)) {
    const mp4Name = `${hero.id}_${key}.mp4`;
    const gifName = `${hero.id}_${key}.gif`;
    const webpName = `${hero.id}_${key}.webp`;
    const apngName = `${hero.id}_${key}.apng`;
    const mp4Full = path.join(root, hero.id, "mp4", mp4Name);
    const gifDir = path.join(root, hero.id, "gif");
    const gifFull = path.join(gifDir, gifName);
    const webpFull = path.join(gifDir, webpName);
    const apngFull = path.join(gifDir, apngName);
    const hasG = fs.existsSync(gifFull);
    const hasW = fs.existsSync(webpFull);
    const hasA = fs.existsSync(apngFull);
    const hasRaster = hasG || hasW || hasA;
    const hasMp4 = fs.existsSync(mp4Full);

    let status: AnimationStatus;
    let mp4: string | null = null;
    let gif: string | null = null;
    let webp: string | null = null;
    let apng: string | null = null;

    if (hasRaster) {
      status = "done";
      gif = hasG ? gifName : null;
      webp = hasW ? webpName : null;
      apng = hasA ? apngName : null;
      mp4 = hasMp4 ? mp4Name : null;
    } else if (hasMp4) {
      status = "pending";
      mp4 = mp4Name;
      gif = null;
      webp = null;
      apng = null;
    } else {
      status = "missing";
      mp4 = null;
      gif = null;
      webp = null;
      apng = null;
    }

    next.animations[key] = { mp4, gif, webp, apng, status };
  }

  return next;
}

export function readHeroesFile(): HeroesFile {
  ensureDataDir();
  const p = getDataPath();
  if (!fs.existsSync(p)) {
    return { heroes: [] };
  }
  const raw = fs.readFileSync(p, "utf-8");
  return JSON.parse(raw) as HeroesFile;
}

export function writeHeroesFile(data: HeroesFile): void {
  ensureDataDir();
  fs.writeFileSync(getDataPath(), JSON.stringify(data, null, 2), "utf-8");
}

export function listHeroesRescanned(): Hero[] {
  const { heroes } = readHeroesFile();
  return heroes.map((h) => rescanHeroAnimations(h));
}

export function getHeroById(id: string): Hero | null {
  const { heroes } = readHeroesFile();
  const h = heroes.find((x) => x.id === id);
  return h ? rescanHeroAnimations(h) : null;
}

export function saveHero(hero: Hero): void {
  const data = readHeroesFile();
  const idx = data.heroes.findIndex((x) => x.id === hero.id);
  if (idx === -1) {
    data.heroes.push(hero);
  } else {
    data.heroes[idx] = hero;
  }
  writeHeroesFile(data);
}

export function createHero(input: {
  name: string;
  description: string;
  tags: string[];
}): Hero {
  const data = readHeroesFile();
  const taken = new Set(data.heroes.map((h) => h.id));
  const base = slugifyName(input.name);
  const id = uniqueId(base, taken);
  ensureHeroDirs(id);

  const hero: Hero = {
    id,
    name: input.name.trim(),
    description: input.description.trim(),
    tags: input.tags,
    png: heroPngLogicalPath(id),
    animations: defaultAnimations(),
  };
  saveHero(hero);
  return rescanHeroAnimations(hero);
}

export function updateHero(
  id: string,
  patch: Partial<Pick<Hero, "name" | "description" | "tags">>,
): Hero | null {
  const data = readHeroesFile();
  const idx = data.heroes.findIndex((x) => x.id === id);
  if (idx === -1) return null;
  const cur = data.heroes[idx];
  const next: Hero = {
    ...cur,
    ...patch,
    name: patch.name !== undefined ? patch.name.trim() : cur.name,
    description:
      patch.description !== undefined
        ? patch.description.trim()
        : cur.description,
    tags: patch.tags !== undefined ? patch.tags : cur.tags,
  };
  data.heroes[idx] = next;
  writeHeroesFile(data);
  return rescanHeroAnimations(next);
}

export function hasMainPng(heroId: string): boolean {
  return fs.existsSync(mainPngAbsolute(heroId));
}

/** Dozwolone identyfikatory z createHero / slug (bez traversala ścieżki). */
export function isSafeHeroId(id: string): boolean {
  if (!id || id.length > 64) return false;
  if (!/^[a-z0-9-]+$/.test(id)) return false;
  if (id.startsWith("-") || id.endsWith("-") || id.includes("--")) {
    return false;
  }
  return true;
}

/**
 * Usuwa bohatera z `data/heroes.json` oraz katalog `heroes/{id}/` (PNG, MP4, GIF).
 */
export function deleteHero(
  id: string,
): { ok: true } | { ok: false; error: string } {
  if (!isSafeHeroId(id)) {
    return { ok: false, error: "Nieprawidłowy identyfikator bohatera." };
  }

  const data = readHeroesFile();
  const idx = data.heroes.findIndex((x) => x.id === id);
  if (idx === -1) {
    return { ok: false, error: "Nie znaleziono bohatera." };
  }

  data.heroes.splice(idx, 1);
  writeHeroesFile(data);

  const resolvedRoot = path.resolve(getHeroesRoot());
  const heroDir = path.resolve(path.join(resolvedRoot, id));

  if (heroDir.startsWith(resolvedRoot + path.sep)) {
    if (fs.existsSync(heroDir)) {
      fs.rmSync(heroDir, { recursive: true, force: true });
    }
  }

  return { ok: true };
}
