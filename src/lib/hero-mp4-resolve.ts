/**
 * Konwencja kanoniczna: `{heroId}_{animationKey}.mp4` (np. zara_idle.mp4).
 * Obsługa plików z dodatkowym prefiksem przed kluczem (np. zara_zaraz_idle.mp4 → idle),
 * o ile klucz animacji jest znany i dopasowanie po sufiksie `_${key}.mp4` jest jednoznaczne.
 */

/** Fragment po `{heroId}_` przed `.mp4` (może być ≠ kluczem animacji w heroes.json). */
export function animationKeyFromMp4Filename(
  heroId: string,
  filename: string,
): string | null {
  const prefix = `${heroId}_`;
  if (!filename.startsWith(prefix) || !filename.toLowerCase().endsWith(".mp4")) {
    return null;
  }
  return filename.slice(prefix.length, -4);
}

/**
 * Wybór nazwy pliku MP4 na dysku dla znanego klucza animacji.
 * Najpierw dokładnie `{heroId}_{key}.mp4`, potem dowolny plik `{heroId}_*_{key}.mp4` (bez rozróżniania wielkości liter).
 * Przy wielu kandydatach wybierany jest najkrótsza nazwa (najbliżej kanonicznej).
 */
export function findMp4FilenameForKey(
  heroId: string,
  animationKey: string,
  mp4Filenames: readonly string[],
): string | null {
  const exact = `${heroId}_${animationKey}.mp4`;
  const exactCi = mp4Filenames.find((n) => n.toLowerCase() === exact.toLowerCase());
  if (exactCi) return exactCi;

  const suffix = `_${animationKey}.mp4`.toLowerCase();
  const prefix = `${heroId}_`.toLowerCase();
  const candidates = mp4Filenames.filter(
    (n) =>
      n.toLowerCase().startsWith(prefix) && n.toLowerCase().endsWith(suffix),
  );
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  candidates.sort((a, b) => a.length - b.length);
  return candidates[0];
}

/**
 * Mapuje rzeczywistą nazwę pliku MP4 na klucz animacji z definicji bohatera.
 * Najpierw dokładne dopasowanie (`zaraz_idle` w JSON → tylko ten plik),
 * potem sufiks `_${key}.mp4` dla najdłuższego pasującego `key` (żeby `jump_in` wygrywało z `in`).
 */
export function matchMp4FilenameToKnownKey(
  heroId: string,
  filename: string,
  knownKeys: readonly string[],
): string | null {
  const extracted = animationKeyFromMp4Filename(heroId, filename);
  if (extracted && knownKeys.includes(extracted)) {
    return extracted;
  }

  const lower = filename.toLowerCase();
  const prefix = `${heroId}_`.toLowerCase();
  if (!lower.endsWith(".mp4") || !lower.startsWith(prefix)) {
    return null;
  }

  const sorted = [...knownKeys].sort((a, b) => b.length - a.length);
  for (const k of sorted) {
    if (lower.endsWith(`_${k}.mp4`.toLowerCase())) {
      return k;
    }
  }
  return null;
}
