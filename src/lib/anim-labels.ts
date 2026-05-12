/** Etykieta z id promptu / animacji (np. idle_loop → Idle Loop). */
export function formatAnimKey(key: string): string {
  return key
    .split("_")
    .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : ""))
    .join(" ");
}

/**
 * Kolejność listy animacji: jak w bibliotece promptów (`preferredOrder`),
 * potem ewentualne dodatkowe klucze alfabetycznie.
 */
export function sortAnimationKeys(
  keys: string[],
  preferredOrder?: string[],
): string[] {
  if (!preferredOrder?.length) {
    return [...keys].sort((a, b) => a.localeCompare(b));
  }
  const idx = new Map(preferredOrder.map((id, i) => [id, i]));
  return [...keys].sort((a, b) => {
    const oa = idx.has(a) ? (idx.get(a) as number) : 99999;
    const ob = idx.has(b) ? (idx.get(b) as number) : 99999;
    if (oa !== ob) return oa - ob;
    return a.localeCompare(b);
  });
}
