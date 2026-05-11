import { DEFAULT_ANIMATION_KEYS } from "@/types/heroes";

export function formatAnimKey(key: string): string {
  return key
    .split("_")
    .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : ""))
    .join(" ");
}

export function sortAnimationKeys(keys: string[]): string[] {
  const order = new Map<string, number>(
    DEFAULT_ANIMATION_KEYS.map((k, i) => [k, i]),
  );
  return [...keys].sort((a, b) => {
    const oa = order.has(a) ? (order.get(a) as number) : 999;
    const ob = order.has(b) ? (order.get(b) as number) : 999;
    if (oa !== ob) return oa - ob;
    return a.localeCompare(b);
  });
}
