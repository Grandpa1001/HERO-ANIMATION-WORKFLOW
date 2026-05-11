"use client";

import { formatAnimKey } from "@/lib/anim-labels";

type Props = {
  animationKey: string;
  fps: number;
  widthExport: number;
  fileBytes?: number;
};

export function AnimationBadge({
  animationKey,
  fps,
  widthExport,
  fileBytes,
}: Props) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-center">
      <p className="text-sm font-semibold text-neutral-900">
        {formatAnimKey(animationKey)}
      </p>
      <p className="mt-1 font-mono text-xs text-neutral-600">
        Eksport: szer. {widthExport}px · {fps} fps
        {fileBytes !== undefined ? ` · ${formatKb(fileBytes)}` : null}
      </p>
    </div>
  );
}

function formatKb(n: number): string {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}
