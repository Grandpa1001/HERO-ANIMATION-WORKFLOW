"use client";

import { useState } from "react";
import type { Hero } from "@/types/heroes";

type Props = {
  onCancel: () => void;
  onCreated: (hero: Hero) => void;
};

export function NewHeroForm({ onCancel, onCreated }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const tags = tagsRaw
        .split(/[,;]/)
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await fetch("/api/heroes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, tags }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Błąd zapisu");
        return;
      }
      onCreated(data.hero as Hero);
    } catch {
      setError("Sieć lub serwer niedostępny.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-neutral-900">
        Nowy bohater
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
        Nazwa, opis i tagi. PNG dodasz po utworzeniu karty.
      </p>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <label className="block">
          <span className="text-sm font-medium text-neutral-700">
            Nazwa bohatera
          </span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-neutral-900 focus:border-neutral-900 focus:ring-1"
            placeholder="np. Kael"
            autoComplete="off"
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
            placeholder="Kontekst użycia, styl ruchu, osobowość…"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-neutral-700">
            Tagi (oddziel przecinkiem)
          </span>
          <input
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
            placeholder="fantasy, female, dynamic"
          />
        </label>

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {busy ? "Zapisywanie…" : "Utwórz bohatera"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Anuluj
          </button>
        </div>
      </form>
    </div>
  );
}
