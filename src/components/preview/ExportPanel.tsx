"use client";

import type { AnimationEntry } from "@/types/heroes";
import { rasterAssetUrl } from "@/lib/preview-assets";

type Props = {
  heroId: string;
  entry: AnimationEntry | undefined;
};

export function ExportPanel({ heroId, entry }: Props) {
  if (!entry) return null;

  const gifHref = entry.gif
    ? rasterAssetUrl(heroId, entry.gif)
    : null;
  const webpHref = entry.webp
    ? rasterAssetUrl(heroId, entry.webp)
    : null;
  const apngHref = entry.apng
    ? rasterAssetUrl(heroId, entry.apng)
    : null;

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {gifHref ? (
        <a
          href={gifHref}
          download={entry.gif ?? undefined}
          className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          ↓ GIF
        </a>
      ) : (
        <span className="rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-400">
          GIF —
        </span>
      )}
      {webpHref ? (
        <a
          href={webpHref}
          download={entry.webp ?? undefined}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
        >
          ↓ WebP
        </a>
      ) : (
        <span className="rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-400">
          WebP —
        </span>
      )}
      {apngHref ? (
        <a
          href={apngHref}
          download={entry.apng ?? undefined}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
        >
          ↓ APNG
        </a>
      ) : (
        <span className="rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-400">
          APNG —
        </span>
      )}
    </div>
  );
}
