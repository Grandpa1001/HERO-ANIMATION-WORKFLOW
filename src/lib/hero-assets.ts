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
