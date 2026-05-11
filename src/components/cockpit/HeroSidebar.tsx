"use client";

import type { Hero } from "@/types/heroes";
import { sortAnimationKeys } from "@/lib/anim-labels";

type Props = {
  heroes: Hero[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
};

function StatusDots({ hero }: { hero: Hero }) {
  const keys = sortAnimationKeys(Object.keys(hero.animations));
  const maxDots = 5;
  const shown = keys.slice(0, maxDots);

  return (
    <span className="flex gap-0.5" aria-hidden>
      {shown.map((k) => {
        const s = hero.animations[k]?.status ?? "missing";
        const cls =
          s === "done"
            ? "bg-emerald-500"
            : s === "pending"
              ? "bg-amber-400"
              : "bg-neutral-300";
        return (
          <span
            key={k}
            className={`inline-block h-2 w-2 rounded-full ${cls}`}
            title={`${k}: ${s}`}
          />
        );
      })}
    </span>
  );
}

export function HeroSidebar({
  heroes,
  selectedId,
  onSelect,
  onNew,
}: Props) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        Bohaterowie
      </p>
      <ul className="flex flex-col gap-1">
        {heroes.map((h) => (
          <li key={h.id}>
            <button
              type="button"
              onClick={() => onSelect(h.id)}
              className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                selectedId === h.id
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-300"
              }`}
            >
              <span className="truncate font-medium">{h.name}</span>
              <StatusDots hero={h} />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onNew}
        className="mt-1 rounded-lg border border-dashed border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50"
      >
        + Nowy bohater
      </button>
    </div>
  );
}
