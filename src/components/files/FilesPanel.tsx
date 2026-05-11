"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Hero } from "@/types/heroes";
import type { HeroFilesTree } from "@/lib/hero-files";
import type { RasterExportFormat } from "@/types/pipeline";
import { heroesRelativeToAssetUrl } from "@/lib/hero-assets";

const FMT_EXT: Record<RasterExportFormat, string> = {
  gif: ".gif",
  webp: ".webp",
  apng: ".apng",
};

const FMT_LABEL: Record<RasterExportFormat, string> = {
  gif: "GIF (1-bit alpha, paleta)",
  webp: "WebP animowany (pełna alpha)",
  apng: "APNG",
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function dimLabel(w?: number, h?: number): string {
  if (w && h) return `${w}×${h}px`;
  return "—";
}

function countPendingForFormat(
  tree: HeroFilesTree,
  format: RasterExportFormat,
): number {
  const ext = FMT_EXT[format];
  const names = new Set(tree.rasters.map((r) => r.name));
  return tree.mp4.filter((m) => {
    const base = m.name.replace(/\.mp4$/i, "");
    return !names.has(base + ext);
  }).length;
}

function hasRasterFormat(
  tree: HeroFilesTree,
  mp4Name: string,
  format: RasterExportFormat,
): boolean {
  const ext = FMT_EXT[format];
  const base = mp4Name.replace(/\.mp4$/i, "");
  return tree.rasters.some((r) => r.name === base + ext);
}

type Props = {
  heroId: string | null;
  heroes: Hero[];
  onGoNewHero: () => void;
  onRefreshHeroes: () => void | Promise<void>;
};

export function FilesPanel({
  heroId,
  heroes,
  onGoNewHero,
  onRefreshHeroes,
}: Props) {
  const [tree, setTree] = useState<HeroFilesTree | null>(null);
  const [exportSettings, setExportSettings] = useState<{
    fps: number;
    width: number;
    defaultFormat: RasterExportFormat;
    alternativeFormat: RasterExportFormat;
  } | null>(null);
  const [exportFormat, setExportFormat] = useState<RasterExportFormat>("gif");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const lastHeroForFormat = useRef<string | null>(null);
  const refreshHeroesRef = useRef(onRefreshHeroes);
  refreshHeroesRef.current = onRefreshHeroes;

  const loadFiles = useCallback(async () => {
    if (!heroId) {
      setTree(null);
      setExportSettings(null);
      return;
    }
    setLoadError(null);
    try {
      const res = await fetch(`/api/heroes/${heroId}/files`);
      const data = (await res.json()) as {
        tree?: HeroFilesTree;
        exportSettings?: {
          fps: number;
          width: number;
          defaultFormat: RasterExportFormat;
          alternativeFormat: RasterExportFormat;
        };
        error?: string;
      };
      if (!res.ok) {
        setLoadError(data.error ?? "Błąd wczytywania plików.");
        setTree(null);
        return;
      }
      setTree(data.tree ?? null);
      const es = data.exportSettings;
      if (es) {
        setExportSettings(es);
      } else {
        setExportSettings(null);
      }
    } catch {
      setLoadError("Błąd sieci.");
      setTree(null);
    }
  }, [heroId]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    if (!heroId) {
      lastHeroForFormat.current = null;
      return;
    }
    if (!exportSettings) return;
    if (lastHeroForFormat.current !== heroId) {
      lastHeroForFormat.current = heroId;
      setExportFormat(exportSettings.defaultFormat);
    }
  }, [heroId, exportSettings]);

  useEffect(() => {
    const es = new EventSource("/api/events/files");
    es.onmessage = (ev) => {
      try {
        const d = JSON.parse(ev.data as string) as { type?: string };
        if (d.type === "files_changed") {
          void loadFiles();
          void refreshHeroesRef.current();
        }
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => {
      /* reconnect */
    };
    return () => es.close();
  }, [loadFiles]);

  async function convertOne(animationKey: string) {
    if (!heroId) return;
    setActionMsg(null);
    setBusyKey(animationKey);
    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroId, animationKey, format: exportFormat }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        format?: RasterExportFormat;
        bytes?: number;
      };
      if (!res.ok || data.ok === false) {
        setActionMsg(data.error ?? "Konwersja nie powiodła się.");
        return;
      }
      const fmt = data.format ?? exportFormat;
      setActionMsg(
        `${fmt.toUpperCase()} zapisany (${formatBytes(data.bytes ?? 0)}).`,
      );
      await loadFiles();
      await onRefreshHeroes();
    } catch {
      setActionMsg("Błąd sieci przy konwersji.");
    } finally {
      setBusyKey(null);
    }
  }

  async function convertBatch() {
    if (!heroId) return;
    setActionMsg(null);
    setBatchBusy(true);
    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heroId,
          batchPending: true,
          format: exportFormat,
        }),
      });
      const data = (await res.json()) as {
        results?: { animationKey: string; ok: boolean; error?: string }[];
        error?: string;
      };
      if (!res.ok) {
        setActionMsg(data.error ?? "Batch nie powiódł się.");
        return;
      }
      const ok = data.results?.filter((r) => r.ok).length ?? 0;
      const fail = data.results?.filter((r) => !r.ok).length ?? 0;
      setActionMsg(
        fail
          ? `Konwersja (${exportFormat}): ${ok} OK, ${fail} błędów (ffmpeg / libwebp / MP4).`
          : `Konwersja (${exportFormat}): ${ok} plików.`,
      );
      await loadFiles();
      await onRefreshHeroes();
    } catch {
      setActionMsg("Błąd sieci przy batchu.");
    } finally {
      setBatchBusy(false);
    }
  }

  if (!heroId) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-neutral-600">
        <p className="font-medium">Wybierz bohatera</p>
        <p className="mt-2 text-sm">
          Lista po lewej — albo{" "}
          <button
            type="button"
            onClick={onGoNewHero}
            className="font-medium text-neutral-900 underline"
          >
            dodaj nowego w zakładce Bohater
          </button>
          .
        </p>
      </div>
    );
  }

  const hero = heroes.find((h) => h.id === heroId);
  const fps = exportSettings?.fps ?? 12;
  const outW = exportSettings?.width ?? 256;
  const pendingFmt =
    tree !== null ? countPendingForFormat(tree, exportFormat) : 0;

  return (
    <div className="min-w-0 flex-1 space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              Pliki — {hero?.name ?? heroId}
            </h2>
            <p className="text-xs text-neutral-500">
              Chromakey, skala {outW}px, {fps} fps — wartości z{" "}
              <code className="rounded bg-neutral-100 px-1">
                pipeline.config.json
              </code>
              . SSE odświeża widok po zmianach na dysku.
            </p>
          </div>
          <button
            type="button"
            disabled={batchBusy || !tree || pendingFmt === 0}
            onClick={() => void convertBatch()}
            className="shrink-0 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-40"
          >
            {batchBusy
              ? "Konwertowanie…"
              : `Konwertuj wszystkie (${pendingFmt}) → ${exportFormat.toUpperCase()}`}
          </button>
        </div>
        <label className="flex max-w-md flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700">Format eksportu</span>
          <select
            value={exportFormat}
            onChange={(e) =>
              setExportFormat(e.target.value as RasterExportFormat)
            }
            className="rounded-lg border border-neutral-300 px-3 py-2 font-sans outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
          >
            {(["gif", "webp", "apng"] as const).map((f) => (
              <option key={f} value={f}>
                {FMT_LABEL[f]}
              </option>
            ))}
          </select>
          <span className="text-xs text-neutral-500">
            Domyślnie z konfiguracji:{" "}
            <strong>{exportSettings?.defaultFormat ?? "gif"}</strong>
            {exportSettings?.alternativeFormat ? (
              <>
                {" "}
                · alternatywa: <strong>{exportSettings.alternativeFormat}</strong>
              </>
            ) : null}
            . WebP zwykle mniejszy i z lepszą przezroczystością niż GIF.
          </span>
        </label>
      </div>

      {loadError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {loadError}
        </p>
      ) : null}
      {actionMsg ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {actionMsg}
        </p>
      ) : null}

      {!tree ? (
        <p className="text-sm text-neutral-500">Wczytywanie…</p>
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 font-mono text-sm shadow-inner">
          <div className="text-neutral-800">
            <span className="font-semibold text-emerald-800">{tree.heroId}/</span>
          </div>

          <FolderBlock
            label="png/"
            badge={tree.png.length ? undefined : "pusto"}
            entries={tree.png.map((f) => ({
              line: `  ${f.name}`,
              meta: `${dimLabel(f.width, f.height)} · ${formatBytes(f.bytes)}${f.hint === "greenscreen" ? " · greenscreen" : ""}`,
              actions: null,
            }))}
          />

          <FolderBlock
            label="mp4/"
            badge={
              tree.mp4PendingCount > 0
                ? `[${tree.mp4PendingCount} bez żadnego eksportu]`
                : undefined
            }
            hint={`Nazwa pliku: „${tree.heroId}_” + klucz animacji + „.mp4” (np. ${tree.heroId}_idle.mp4). Inne nazwy nie są widoczne dla konwersji z listy animacji.`}
            entries={tree.mp4.map((f) => {
              const prefix = `${tree.heroId}_`;
              const key =
                f.name.startsWith(prefix) && f.name.toLowerCase().endsWith(".mp4")
                  ? f.name.slice(prefix.length, -4)
                  : f.name.replace(/\.mp4$/i, "");
              const readyFmt = hasRasterFormat(tree, f.name, exportFormat);
              let meta = `${formatBytes(f.bytes)} · `;
              if (readyFmt) {
                meta += `gotowy (${exportFormat})`;
              } else if (f.hasPairedExport) {
                meta += `inne formaty — brak .${exportFormat}`;
              } else {
                meta += "oczekuje";
              }
              return {
                line: `  ${f.name}`,
                meta,
                actions: readyFmt ? null : (
                  <button
                    type="button"
                    disabled={busyKey === key}
                    onClick={() => void convertOne(key)}
                    className="ml-2 rounded border border-amber-600/80 bg-white px-2 py-0.5 text-xs font-sans font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-50"
                  >
                    {busyKey === key ? "…" : `→ ${exportFormat}`}
                  </button>
                ),
              };
            })}
          />

          <FolderBlock
            label="gif/ (GIF · WebP · APNG)"
            badge={
              tree.rasterCount
                ? `[${tree.rasterCount} plik${tree.rasterCount === 1 ? "" : "i"}]`
                : undefined
            }
            entries={tree.rasters.map((f) => ({
              line: `  ${f.name}`,
              meta: `${dimLabel(f.width, f.height)} · ${fps}fps · ${formatBytes(f.bytes)}`,
              actions: (
                <a
                  href={heroesRelativeToAssetUrl(f.relativePath)}
                  download={f.name}
                  className="ml-2 rounded border border-neutral-400 bg-white px-2 py-0.5 text-xs font-sans font-medium text-neutral-800 hover:bg-neutral-100"
                >
                  ↓
                </a>
              ),
            }))}
          />
        </div>
      )}
    </div>
  );
}

function FolderBlock({
  label,
  badge,
  hint,
  entries,
}: {
  label: string;
  badge?: string;
  hint?: string;
  entries: {
    line: string;
    meta: string;
    actions: ReactNode;
  }[];
}) {
  return (
    <div className="mt-3 border-l-2 border-neutral-300 pl-3">
      <div className="flex flex-wrap items-baseline gap-2 text-neutral-700">
        <span>├── {label}</span>
        {badge ? (
          <span className="text-xs font-sans text-amber-700">{badge}</span>
        ) : null}
      </div>
      {hint ? (
        <p className="mt-1 max-w-2xl pl-0.5 font-sans text-xs leading-relaxed text-neutral-600">
          {hint}
        </p>
      ) : null}
      {entries.length === 0 ? (
        <div className="mt-1 pl-2 text-xs text-neutral-500">(brak plików)</div>
      ) : (
        <ul className="mt-1 space-y-1">
          {entries.map((e, i) => (
            <li
              key={`${e.line}-${i}`}
              className="flex flex-wrap items-baseline gap-x-2 pl-1 text-neutral-800"
            >
              <span className="text-neutral-600">│</span>
              <span>{e.line}</span>
              <span className="font-sans text-xs text-neutral-500">{e.meta}</span>
              {e.actions}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
