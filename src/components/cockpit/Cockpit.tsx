"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Hero } from "@/types/heroes";
import { HeroSidebar } from "./HeroSidebar";
import { HeroCard } from "./HeroCard";
import { NewHeroForm } from "./NewHeroForm";
import { PromptLibrary } from "@/components/prompts/PromptLibrary";

export type CockpitTab = "bohater" | "prompt" | "pliki" | "preview";

const TABS: { id: CockpitTab; label: string; stage?: string }[] = [
  { id: "bohater", label: "Bohater" },
  { id: "prompt", label: "Prompt" },
  { id: "pliki", label: "Pliki", stage: "Etap 3" },
  { id: "preview", label: "Preview", stage: "Etap 5" },
];

export function Cockpit() {
  const [tab, setTab] = useState<CockpitTab>("bohater");
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/heroes");
      if (!res.ok) throw new Error("fetch");
      const data = (await res.json()) as { heroes: Hero[] };
      setHeroes(data.heroes);
      setSelectedId((cur) => {
        if (cur && data.heroes.some((h) => h.id === cur)) return cur;
        return data.heroes[0]?.id ?? null;
      });
    } catch {
      setLoadError("Nie udało się wczytać listy bohaterów.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selected = heroes.find((h) => h.id === selectedId) ?? null;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">
              Hero Animation — Kokpit
            </h1>
            <p className="text-sm text-neutral-500">
              {tab === "bohater" &&
                "Etap 1: definicja bohatera, PNG 9:16, lista animacji"}
              {tab === "prompt" &&
                "Etap 2: biblioteka promptów — zapis, filtr, kopiowanie do fal.ai"}
              {tab === "pliki" &&
                "Etap 3 (wkrótce): widok plików i watcher folderów"}
              {tab === "preview" &&
                "Etap 5 (wkrótce): galeria podglądu animacji 9:16"}
            </p>
          </div>
          <nav className="flex flex-wrap gap-1" aria-label="Zakładki kokpitu">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  tab === t.id
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {t.label}
                {t.stage && tab !== t.id ? (
                  <span className="ml-1 text-xs font-normal text-neutral-400">
                    ({t.stage})
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div
        className={`mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-6 ${
          tab === "bohater" ? "flex-col lg:flex-row" : "flex-col"
        }`}
      >
        {tab === "bohater" ? (
          <>
            <aside className="w-full shrink-0 lg:w-56">
              <HeroSidebar
                heroes={heroes}
                selectedId={selectedId}
                onSelect={(id) => {
                  setCreating(false);
                  setSelectedId(id);
                }}
                onNew={() => {
                  setCreating(true);
                  setSelectedId(null);
                }}
              />
            </aside>

            <section className="min-w-0 flex-1">
              {loadError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {loadError}
                </p>
              ) : null}

              <AnimatePresence mode="wait">
                {creating ? (
                  <motion.div
                    key="new"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                  >
                    <NewHeroForm
                      onCancel={() => {
                        setCreating(false);
                        if (heroes[0]) setSelectedId(heroes[0].id);
                      }}
                      onCreated={(h) => {
                        setCreating(false);
                        setHeroes((prev) => [...prev, h]);
                        setSelectedId(h.id);
                      }}
                    />
                  </motion.div>
                ) : selected ? (
                  <motion.div
                    key={selected.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                  >
                    <HeroCard
                      hero={selected}
                      onUpdated={(h) => {
                        setHeroes((prev) =>
                          prev.map((x) => (x.id === h.id ? h : x)),
                        );
                      }}
                      onPngUploaded={() => void refresh()}
                      onGoPrompt={() => setTab("prompt")}
                      onGoPreview={() => setTab("preview")}
                      onDeleted={(deletedId) => {
                        let nextList: Hero[] = [];
                        setHeroes((prev) => {
                          nextList = prev.filter((h) => h.id !== deletedId);
                          return nextList;
                        });
                        setSelectedId((cur) =>
                          cur === deletedId
                            ? (nextList[0]?.id ?? null)
                            : cur,
                        );
                      }}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-neutral-600"
                  >
                    <p className="font-medium">Brak bohaterów</p>
                    <p className="mt-2 text-sm">
                      Dodaj pierwszego bohatera z paska po lewej.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </>
        ) : tab === "prompt" ? (
          <PromptLibrary hero={selected} />
        ) : (
          <main className="flex flex-1 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 p-12 text-center text-neutral-600">
            <div>
              <p className="text-lg font-medium text-neutral-800">
                Zakładka w przygotowaniu
              </p>
              <p className="mt-2 max-w-md text-sm">
                {tab === "pliki" &&
                  "Widok plików i watcher folderów (Etap 3)."}
                {tab === "preview" &&
                  "Galeria podglądu animacji 9:16 (Etap 5)."}
              </p>
              <button
                type="button"
                onClick={() => setTab("bohater")}
                className="mt-6 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
              >
                Wróć do Bohatera
              </button>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
