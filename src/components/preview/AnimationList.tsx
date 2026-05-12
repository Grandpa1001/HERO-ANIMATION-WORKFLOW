"use client";

import type { AnimationEntry } from "@/types/heroes";
import { formatAnimKey, sortAnimationKeys } from "@/lib/anim-labels";

type Props = {
  animations: Record<string, AnimationEntry>;
  activeKey: string;
  /** Kolejność = identyfikatory promptów z biblioteki. */
  animationKeyOrder?: string[];
  onSelect: (key: string) => void;
  onGoPrompt?: () => void;
};

function statusIcon(status: AnimationEntry["status"], active: boolean): string {
  if (status === "done") return active ? "●" : "○";
  if (status === "pending") return "⏳";
  return "✗";
}

export function AnimationList({
  animations,
  activeKey,
  animationKeyOrder,
  onSelect,
  onGoPrompt,
}: Props) {
  const keys = sortAnimationKeys(Object.keys(animations), animationKeyOrder);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      <p className="px-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
        Animacje (id promptu)
      </p>
      <ul className="mt-2 space-y-1">
        {keys.map((key) => {
          const a = animations[key];
          if (!a) return null;
          const active = key === activeKey;
          const icon = statusIcon(a.status, active);
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onSelect(key)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition ${
                  active
                    ? "bg-neutral-900 text-white ring-2 ring-neutral-900 ring-offset-2"
                    : "text-neutral-800 hover:bg-neutral-100"
                }`}
              >
                <span
                  className={`w-5 shrink-0 text-center ${
                    a.status === "done"
                      ? active
                        ? "text-emerald-300"
                        : "text-emerald-600"
                      : a.status === "pending"
                        ? "text-amber-600"
                        : "text-neutral-400"
                  }`}
                  aria-hidden
                >
                  {icon}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {formatAnimKey(key)}
                </span>
                <span
                  className={`shrink-0 text-xs ${
                    active ? "text-neutral-300" : "text-neutral-500"
                  }`}
                >
                  {a.status === "done"
                    ? "GIF/WebP"
                    : a.status === "pending"
                      ? "MP4"
                      : "brak"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {onGoPrompt ? (
        <button
          type="button"
          onClick={onGoPrompt}
          className="mt-3 w-full rounded-lg border border-dashed border-neutral-300 px-2 py-2 text-xs font-medium text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50"
        >
          → Biblioteka promptów
        </button>
      ) : null}
    </div>
  );
}
