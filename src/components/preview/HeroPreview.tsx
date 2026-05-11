"use client";

import { useEffect, useState } from "react";
import type { AnimationStatus } from "@/types/heroes";
import { mp4AssetUrl, rasterAssetUrl } from "@/lib/preview-assets";

type Props = {
  heroName: string;
  /** URL animacji (GIF/WebP/APNG) lub null */
  rasterUrl: string | null;
  /** Podgląd MP4 gdy brak rastra, a status pending */
  mp4Url: string | null;
  mp4Filename: string | null;
  status: AnimationStatus;
  animationLabel: string;
};

export function HeroPreview({
  heroName,
  rasterUrl,
  mp4Url,
  mp4Filename,
  status,
  animationLabel,
}: Props) {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    setDims(null);
  }, [rasterUrl, mp4Url]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="checkerboard-16 relative w-full max-w-[min(100%,280px)] overflow-hidden rounded-xl border border-neutral-200 shadow-md"
        style={{ aspectRatio: "9 / 16" }}
      >
        {rasterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL z lokalnego API
          <img
            key={rasterUrl}
            src={rasterUrl}
            alt={`${heroName} — ${animationLabel}`}
            className="relative z-10 h-full w-full object-contain"
            onLoad={(e) => {
              const el = e.currentTarget;
              setDims({ w: el.naturalWidth, h: el.naturalHeight });
            }}
          />
        ) : status === "pending" && mp4Url && mp4Filename ? (
          <video
            key={mp4Url}
            src={mp4Url}
            className="relative z-10 h-full w-full object-contain"
            loop
            muted
            playsInline
            autoPlay
            controls
            onLoadedMetadata={(e) => {
              const el = e.currentTarget;
              setDims({ w: el.videoWidth, h: el.videoHeight });
            }}
          />
        ) : (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-4 text-center text-sm text-neutral-600">
            <p className="font-medium">Brak podglądu</p>
            <p className="mt-2 text-xs text-neutral-500">
              {status === "pending"
                ? "Dodaj MP4 lub wykonaj konwersję w zakładce Pliki."
                : "Brak MP4 — wygeneruj w fal.ai i zapisz w folderze mp4."}
            </p>
          </div>
        )}
      </div>
      {dims ? (
        <p className="font-mono text-xs text-neutral-500">
          {dims.w}×{dims.h}px
        </p>
      ) : null}
    </div>
  );
}
