/** Format pliku wyjściowego po chromakey (Etap 4). */
export type RasterExportFormat = "gif" | "webp" | "apng";

export type PipelineConfig = {
  greenscreen: {
    color: string;
    similarity: number;
    blend: number;
  };
  output: {
    /** Domyślny format eksportu z MP4. */
    format: string;
    alternativeFormat?: string;
    fps: number;
    width: number;
    loop: boolean;
  };
  folders?: {
    heroesRoot?: string;
    promptsFile?: string;
  };
};
