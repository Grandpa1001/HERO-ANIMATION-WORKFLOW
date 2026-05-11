"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Hero } from "@/types/heroes";
import type { HeroFilesTree } from "@/lib/hero-files";
import { formatAnimKey, sortAnimationKeys } from "@/lib/anim-labels";
import { mp4AssetUrl, pickRasterFile, rasterAssetUrl } from "@/lib/preview-assets";
import { HeroPreview } from "./HeroPreview";
import { AnimationList } from "./AnimationList";
import { AnimationBadge } from "./AnimationBadge";
import { ExportPanel } from "./ExportPanel";

type Props = {
  hero: Hero;
  onGoPrompt: () => void;
  /** Odświeżenie listy bohaterów (rescan animacji) po zmianie plików. */
  onHeroRefresh: () => void | Promise<void>;
};

function firstSensibleAnimKey(hero: Hero): string {
  const keys = sortAnimationKeys(Object.keys(hero.animations));
  const done = keys.find((k) => hero.animations[k]?.status === "done");
  return done ?? keys[0] ?? "idle";
}

export function PreviewGallery({ hero, onGoPrompt, onHeroRefresh }: Props) {
  const heroRefreshRef = useRef(onHeroRefresh);
  heroRefreshRef.current = onHeroRefresh;

  const [activeKey, setActiveKey] = useState(() => firstSensibleAnimKey(hero));
  const [tree, setTree] = useState<HeroFilesTree | null>(null);
  const [settings, setSettings] = useState<{ fps: number; width: number } | null>(
    null,
  );

  useEffect(() => {
    setActiveKey((prev) => {
      const keys = sortAnimationKeys(Object.keys(hero.animations));
      if (keys.includes(prev)) return prev;
      return firstSensibleAnimKey(hero);
    });
  }, [hero]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/heroes/${hero.id}/files`);
    const data = (await res.json()) as {
      tree?: HeroFilesTree;
      exportSettings?: { fps: number; width: number };
    };
    if (res.ok) {
      setTree(data.tree ?? null);
      setSettings(data.exportSettings ?? null);
    }
  }, [hero.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const es = new EventSource("/api/events/files");
    es.onmessage = (ev) => {
      try {
        const d = JSON.parse(ev.data as string) as { type?: string };
        if (d.type === "files_changed") {
          void load();
          void heroRefreshRef.current();
        }
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, [load]);

  const entry = hero.animations[activeKey];
  const raster = pickRasterFile(entry);
  const rasterUrl = raster
    ? rasterAssetUrl(hero.id, raster.filename)
    : null;
  const mp4File = entry?.mp4 ?? null;
  const mp4Url =
    entry?.status === "pending" && mp4File
      ? mp4AssetUrl(hero.id, mp4File)
      : null;

  const fileBytes = useMemo(() => {
    if (!tree || !raster) return undefined;
    const base = `${hero.id}_${activeKey}`;
    const r = tree.rasters.find(
      (f) => f.name.replace(/\.(gif|webp|apng)$/i, "") === base,
    );
    return r?.bytes;
  }, [tree, hero.id, activeKey, raster]);

  const fps = settings?.fps ?? 12;
  const outW = settings?.width ?? 256;

  return (
    <div className="flex w-full flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
      <div className="flex flex-1 flex-col items-center gap-4">
        <HeroPreview
          heroName={hero.name}
          rasterUrl={rasterUrl}
          mp4Url={mp4Url}
          mp4Filename={mp4File}
          status={entry?.status ?? "missing"}
          animationLabel={formatAnimKey(activeKey)}
        />
        <AnimationBadge
          animationKey={activeKey}
          fps={fps}
          widthExport={outW}
          fileBytes={fileBytes}
        />
        <ExportPanel heroId={hero.id} entry={entry} />
      </div>
      <div className="w-full shrink-0 lg:max-w-xs lg:pt-1">
        <AnimationList
          animations={hero.animations}
          activeKey={activeKey}
          onSelect={setActiveKey}
          onGoPrompt={onGoPrompt}
        />
      </div>
    </div>
  );
}
