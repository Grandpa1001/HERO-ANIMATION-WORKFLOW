"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Hero } from "@/types/heroes";
import { formatAnimKey, sortAnimationKeys } from "@/lib/anim-labels";
import { logicalHeroPathToAssetUrl } from "@/lib/hero-assets";

type Props = {
  hero: Hero;
  animationKeyOrder?: string[];
  onUpdated: (hero: Hero) => void;
  onPngUploaded: () => void;
  onGoPrompt: () => void;
  onGoPreview: () => void;
  /** Po udanym usunięciu na serwerze (JSON + folder `heroes/{id}/`). */
  onDeleted: (id: string) => void;
};

function statusLabel(s: string): string {
  if (s === "done") return "Eksport gotowy (GIF / WebP / APNG)";
  if (s === "pending") return "MP4 oczekuje konwersji";
  return "Brak";
}

function statusRowClass(s: string): string {
  if (s === "done") return "text-emerald-800";
  if (s === "pending") return "text-amber-800";
  return "text-neutral-500";
}

export function HeroCard({
  hero,
  animationKeyOrder,
  onUpdated,
  onPngUploaded,
  onGoPrompt,
  onGoPreview,
  onDeleted,
}: Props) {
  const [name, setName] = useState(hero.name);
  const [description, setDescription] = useState(hero.description);
  const [tagsRaw, setTagsRaw] = useState(hero.tags.join(", "));
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pngBust, setPngBust] = useState(0);
  const [pngFailed, setPngFailed] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(hero.name);
    setDescription(hero.description);
    setTagsRaw(hero.tags.join(", "));
    setPngFailed(false);
  }, [hero.id, hero.name, hero.description, hero.tags]);

  const pngUrl = `${logicalHeroPathToAssetUrl(hero.png)}?v=${pngBust}`;

  const saveMeta = useCallback(async () => {
    setSaveMsg(null);
    setSaveBusy(true);
    try {
      const tags = tagsRaw
        .split(/[,;]/)
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await fetch(`/api/heroes/${hero.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, tags }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveMsg(typeof data.error === "string" ? data.error : "Błąd zapisu");
        return;
      }
      onUpdated(data.hero as Hero);
      setSaveMsg("Zapisano.");
    } catch {
      setSaveMsg("Błąd sieci.");
    } finally {
      setSaveBusy(false);
    }
  }, [hero.id, name, description, tagsRaw, onUpdated]);

  async function uploadFile(file: File | null) {
    if (!file) return;
    setUploadErr(null);
    setUploadBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch(`/api/heroes/${hero.id}/png`, {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setUploadErr(data.error ?? "Upload nie powiódł się.");
        return;
      }
      setPngBust(Date.now());
      setPngFailed(false);
      onPngUploaded();
    } catch {
      setUploadErr("Błąd sieci przy wgrywaniu pliku.");
    } finally {
      setUploadBusy(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    void uploadFile(f ?? null);
  }

  const animKeys = sortAnimationKeys(Object.keys(hero.animations), animationKeyOrder);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex flex-col items-center gap-3 lg:items-start">
          <div
            className={`checkerboard-16 relative w-full max-w-[260px] overflow-hidden rounded-xl border border-neutral-200 shadow-inner ${
              dragOver ? "ring-2 ring-neutral-900 ring-offset-2" : ""
            }`}
            style={{ aspectRatio: "9 / 16" }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            {!pngFailed ? (
              // Dynamiczny URL z API; next/image wymagałby hostname w config.
              // eslint-disable-next-line @next/next/no-img-element -- podgląd lokalnego PNG
              <img
                src={pngUrl}
                alt={`Postać ${hero.name}`}
                className="relative z-10 h-full w-full object-contain"
                onError={() => setPngFailed(true)}
                onLoad={() => setPngFailed(false)}
              />
            ) : (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-4 text-center text-sm text-neutral-600">
                <p>Brak pliku PNG</p>
                <p className="mt-2 text-xs text-neutral-500">
                  Wgraj obraz 9:16, jednolite tło chroma #00FF00
                </p>
              </div>
            )}
          </div>
          <p className="max-w-[260px] text-center text-xs text-neutral-500 lg:text-left">
            Podgląd 9:16 na szachownicy — przezroczystość widać dzięki wzorowi tła.
          </p>
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onGoPrompt}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Generuj prompt →
            </button>
            <button
              type="button"
              onClick={onGoPreview}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
            >
              Preview →
            </button>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-neutral-900">
              Dane bohatera
            </h2>
            <p className="mt-0.5 text-xs text-neutral-500">ID: {hero.id}</p>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-sm font-medium text-neutral-700">
                  Nazwa
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-neutral-700">
                  Opis / charakter
                </span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-neutral-700">
                  Tagi
                </span>
                <input
                  value={tagsRaw}
                  onChange={(e) => setTagsRaw(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
                  placeholder="fantasy, female, dynamic"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void saveMeta()}
                disabled={saveBusy}
                className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {saveBusy ? "Zapisywanie…" : "Zapisz zmiany"}
              </button>
              {saveMsg ? (
                <span className="text-sm text-neutral-600">{saveMsg}</span>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-semibold text-neutral-900">
              Zdjęcie PNG (9:16)
            </h3>
            <p className="mt-1 text-sm text-neutral-500">
              Przeciągnij i upuść lub wybierz plik — format PNG, proporcje 9:16,
              tło chroma #00FF00.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/png"
              className="hidden"
              onChange={(e) => void uploadFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              disabled={uploadBusy}
              onClick={() => fileRef.current?.click()}
              className="mt-3 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
            >
              {uploadBusy ? "Wgrywanie…" : "Wybierz plik PNG"}
            </button>
            {uploadErr ? (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {uploadErr}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-neutral-900">
          Animacje
        </h3>
        <p className="mt-1 text-sm text-neutral-500">
          Sloty = wpisy w bibliotece promptów (pole <code className="text-xs">id</code>
          ). Pliki:{" "}
          <code className="text-xs">{`{id_bohatera}_{id_promptu}.mp4`}</code>.
        </p>
        <ul className="mt-3 divide-y divide-neutral-100">
          {animKeys.map((key) => {
            const a = hero.animations[key];
            if (!a) return null;
            return (
              <li
                key={key}
                className={`flex flex-wrap items-center justify-between gap-2 py-2 text-sm ${statusRowClass(a.status)}`}
              >
                <span className="font-medium text-neutral-900">
                  {formatAnimKey(key)}
                </span>
                <span>{statusLabel(a.status)}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 shadow-sm">
        <h3 className="text-base font-semibold text-red-900">Strefa niebezpieczna</h3>
        <p className="mt-2 text-sm text-red-800/90">
          Usunięcie bohatera usuwa wpis w{" "}
          <code className="rounded bg-red-100 px-1 py-0.5 text-xs text-red-900">
            data/heroes.json
          </code>{" "}
          oraz cały katalog{" "}
          <code className="rounded bg-red-100 px-1 py-0.5 text-xs text-red-900">
            heroes/{hero.id}/
          </code>{" "}
          (PNG źródłowe, MP4, GIF). Operacji nie można cofnąć.
        </p>
        <button
          type="button"
          disabled={deleteBusy}
          onClick={() => {
            setDeleteErr(null);
            const lines = [
              `Usunąć bohatera „${hero.name}” (id: ${hero.id})?`,
              "",
              "Zostaną usunięte:",
              "• wpis w data/heroes.json,",
              `• folder heroes/${hero.id}/ wraz z plikami.`,
              "",
              "Kontynuować?",
            ];
            if (!window.confirm(lines.join("\n"))) return;
            void (async () => {
              setDeleteBusy(true);
              try {
                const res = await fetch(`/api/heroes/${hero.id}`, {
                  method: "DELETE",
                });
                const data = (await res.json()) as { error?: string };
                if (!res.ok) {
                  setDeleteErr(
                    typeof data.error === "string"
                      ? data.error
                      : "Nie udało się usunąć bohatera.",
                  );
                  return;
                }
                onDeleted(hero.id);
              } catch {
                setDeleteErr("Błąd sieci przy usuwaniu.");
              } finally {
                setDeleteBusy(false);
              }
            })();
          }}
          className="mt-4 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
        >
          {deleteBusy ? "Usuwanie…" : "Usuń bohatera i konfigurację"}
        </button>
        {deleteErr ? (
          <p className="mt-2 text-sm text-red-700" role="alert">
            {deleteErr}
          </p>
        ) : null}
      </div>
    </div>
  );
}
