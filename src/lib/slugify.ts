/** Wspólny slug (np. id bohatera, fragment id promptu) — bez zależności od heroes-store. */
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
