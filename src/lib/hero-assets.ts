/** Ścieżka względem katalogu `heroes/`, np. `zara/gif/zara_idle.gif`. */
export function heroesRelativeToAssetUrl(rel: string): string {
  const segments = rel.split("/").filter(Boolean);
  return `/api/assets/heroes/${segments.map(encodeURIComponent).join("/")}`;
}

/** Zamienia ścieżkę /heroes/id/... na URL API serwującego pliki z dysku. */
export function logicalHeroPathToAssetUrl(logical: string): string {
  const prefix = "/heroes/";
  if (!logical.startsWith(prefix)) {
    return logical;
  }
  const rest = logical.slice(prefix.length);
  const segments = rest.split("/").filter(Boolean);
  return `/api/assets/heroes/${segments.map(encodeURIComponent).join("/")}`;
}
