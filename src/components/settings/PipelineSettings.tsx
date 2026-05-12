"use client";

import { useCallback, useEffect, useState } from "react";
import type { PipelineConfig } from "@/types/pipeline";
import { DEFAULT_PIPELINE_CONFIG } from "@/lib/pipeline-defaults";

function cloneConfig(c: PipelineConfig): PipelineConfig {
  return structuredClone(c);
}

export function PipelineSettings() {
  const [config, setConfig] = useState<PipelineConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/pipeline");
      if (!res.ok) throw new Error("fetch");
      const data = (await res.json()) as { config?: PipelineConfig; error?: string };
      if (!data.config) throw new Error("brak config");
      setConfig(cloneConfig(data.config));
    } catch {
      setLoadError("Nie udało się wczytać pipeline.config.json.");
      setConfig(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!config) return;
    setSaveError(null);
    setSavedAt(null);
    setSaving(true);
    try {
      const res = await fetch("/api/pipeline", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const data = (await res.json()) as { ok?: boolean; config?: PipelineConfig; error?: string };
      if (!res.ok) {
        setSaveError(data.error ?? "Zapis nie powiódł się.");
        return;
      }
      if (data.config) {
        setConfig(cloneConfig(data.config));
      }
      setSavedAt(Date.now());
    } catch {
      setSaveError("Błąd sieci przy zapisie.");
    } finally {
      setSaving(false);
    }
  };

  if (loadError && !config) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {loadError}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Spróbuj ponownie
        </button>
      </div>
    );
  }

  if (!config) {
    return <p className="text-sm text-neutral-500">Wczytywanie…</p>;
  }

  const setGreenscreen = (patch: Partial<PipelineConfig["greenscreen"]>) => {
    setConfig((c) => (c ? { ...c, greenscreen: { ...c.greenscreen, ...patch } } : c));
  };
  const setOutput = (patch: Partial<PipelineConfig["output"]>) => {
    setConfig((c) => (c ? { ...c, output: { ...c.output, ...patch } } : c));
  };
  const setFal = (patch: Partial<PipelineConfig["fal"]>) => {
    setConfig((c) => (c ? { ...c, fal: { ...c.fal, ...patch } } : c));
  };
  const setFolders = (patch: Partial<PipelineConfig["folders"]>) => {
    setConfig((c) => (c ? { ...c, folders: { ...c.folders, ...patch } } : c));
  };

  const rasterOptions = (
    <>
      <option value="gif">gif</option>
      <option value="webp">webp</option>
      <option value="apng">apng</option>
    </>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Po zmianie{" "}
        <strong className="font-medium">folders.heroesRoot</strong> zrestartuj serwer deweloperski
        (<code className="rounded bg-amber-100/80 px-1">npm run dev</code>), żeby watcher plików
        podłączył się pod nowy katalog.
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-neutral-900">Greenscreen (ffmpeg chromakey)</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Kolor tła w MP4 oraz parametry similarity / blend przekazywane do konwersji.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-neutral-700">Kolor (#RRGGBB)</span>
            <div className="mt-1 flex gap-2">
              <input
                type="color"
                value={config.greenscreen.color}
                onChange={(e) => setGreenscreen({ color: e.target.value.toUpperCase() })}
                className="h-10 w-14 cursor-pointer rounded border border-neutral-300"
              />
              <input
                type="text"
                value={config.greenscreen.color}
                onChange={(e) => setGreenscreen({ color: e.target.value })}
                className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm"
                pattern="^#[0-9A-Fa-f]{6}$"
              />
            </div>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-neutral-700">Similarity (0–1)</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={config.greenscreen.similarity}
              onChange={(e) => setGreenscreen({ similarity: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-neutral-700">Blend (0–1)</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={config.greenscreen.blend}
              onChange={(e) => setGreenscreen({ blend: Number(e.target.value) })}
              className="mt-1 w-full max-w-xs rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-neutral-900">Wyjście rastra</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Domyślny format eksportu, FPS i szerokość skalowania po chromakey.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-neutral-700">Format główny</span>
            <select
              value={config.output.format}
              onChange={(e) => setOutput({ format: e.target.value })}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              {rasterOptions}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-neutral-700">Format alternatywny</span>
            <select
              value={config.output.alternativeFormat ?? "webp"}
              onChange={(e) => setOutput({ alternativeFormat: e.target.value })}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              {rasterOptions}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-neutral-700">FPS (1–60)</span>
            <input
              type="number"
              min={1}
              max={60}
              step={1}
              value={config.output.fps}
              onChange={(e) => setOutput({ fps: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-neutral-700">Szerokość (px, 16–4096)</span>
            <input
              type="number"
              min={16}
              max={4096}
              step={1}
              value={config.output.width}
              onChange={(e) => setOutput({ width: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={config.output.loop}
              onChange={(e) => setOutput({ loop: e.target.checked })}
              className="h-4 w-4 rounded border-neutral-300"
            />
            <span className="font-medium text-neutral-700">Pętla (loop)</span>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-neutral-900">fal.ai (podpowiedź)</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Wartości referencyjne przy pracy ręcznej w generatorze — nie wywołują API automatycznie.
        </p>
        <div className="mt-4 grid gap-4">
          <label className="block text-sm">
            <span className="font-medium text-neutral-700">Model</span>
            <input
              type="text"
              value={config.fal.model}
              onChange={(e) => setFal({ model: e.target.value })}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-neutral-700">Czas trwania (s, 1–120)</span>
              <input
                type="number"
                min={1}
                max={120}
                step={1}
                value={config.fal.duration}
                onChange={(e) => setFal({ duration: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-neutral-700">Proporcje kadru</span>
              <input
                type="text"
                value={config.fal.aspectRatio}
                onChange={(e) => setFal({ aspectRatio: e.target.value })}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                placeholder="9:16"
              />
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-neutral-900">Ścieżki projektu</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Względem katalogu głównego repozytorium. Zabronione jest użycie{" "}
          <code className="rounded bg-neutral-100 px-1">..</code>.
        </p>
        <div className="mt-4 grid gap-4">
          <label className="block text-sm">
            <span className="font-medium text-neutral-700">Katalog bohaterów</span>
            <input
              type="text"
              value={config.folders.heroesRoot}
              onChange={(e) => setFolders({ heroesRoot: e.target.value })}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-neutral-700">Plik promptów</span>
            <input
              type="text"
              value={config.folders.promptsFile}
              onChange={(e) => setFolders({ promptsFile: e.target.value })}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm"
            />
          </label>
        </div>
      </section>

      {saveError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {saveError}
        </p>
      ) : null}
      {savedAt ? (
        <p className="text-sm text-green-700">Zapisano pomyślnie.</p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {saving ? "Zapisywanie…" : "Zapisz pipeline.config.json"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setSaveError(null);
            setSavedAt(null);
            setConfig(cloneConfig(DEFAULT_PIPELINE_CONFIG));
          }}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
        >
          Przywróć domyślne (tylko w formularzu)
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void load()}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
        >
          Wczytaj z dysku
        </button>
      </div>
    </div>
  );
}
