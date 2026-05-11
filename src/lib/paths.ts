import path from "path";
import fs from "fs";

const ROOT = process.cwd();

type PipelineFolders = {
  folders?: { heroesRoot?: string; promptsFile?: string };
};

export function getProjectRoot(): string {
  return ROOT;
}

export function getPipelineConfigPath(): string {
  return path.join(ROOT, "pipeline.config.json");
}

function loadPipelineFolders(): PipelineFolders {
  const raw = fs.readFileSync(getPipelineConfigPath(), "utf-8");
  return JSON.parse(raw) as PipelineFolders;
}

export function getHeroesRoot(): string {
  const cfg = loadPipelineFolders();
  return path.resolve(ROOT, cfg.folders?.heroesRoot ?? "./heroes");
}

export function getPromptsFilePath(): string {
  const cfg = loadPipelineFolders();
  return path.resolve(ROOT, cfg.folders?.promptsFile ?? "./prompts/prompts.json");
}
