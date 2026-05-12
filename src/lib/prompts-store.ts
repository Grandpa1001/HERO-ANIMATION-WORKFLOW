import fs from "fs";
import path from "path";
import type { Prompt, PromptCategory, PromptsFile } from "@/types/prompts";
import { PROMPT_CATEGORIES } from "@/types/prompts";
import { getPromptsFilePath } from "@/lib/paths";
import { slugifyName } from "@/lib/slugify";

const ALLOWED = new Set<string>(PROMPT_CATEGORIES);

/** Stare wpisy z dokumentacji (np. `interaction`). */
const LEGACY_CATEGORY: Record<string, PromptCategory> = {
  interaction: "interakcja",
  loop: "loop",
  "one-shot": "one-shot",
  interakcja: "interakcja",
  ruch: "ruch",
};

export function normalizePromptCategories(raw: unknown): PromptCategory[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<PromptCategory>();
  for (const c of raw) {
    if (typeof c !== "string") continue;
    const mapped = LEGACY_CATEGORY[c] ?? (ALLOWED.has(c) ? (c as PromptCategory) : null);
    if (mapped) out.add(mapped);
  }
  return Array.from(out);
}

function ensurePromptsDir(): void {
  const p = getPromptsFilePath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Kolejność = kolejność wpisów w bibliotece — ten sam identyfikator łączy prompt, MP4 i eksport. */
export function listPromptAnimationIds(): string[] {
  return readPromptsFile().prompts.map((p) => p.id);
}

export function readPromptsFile(): PromptsFile {
  ensurePromptsDir();
  const p = getPromptsFilePath();
  if (!fs.existsSync(p)) {
    return { prompts: [] };
  }
  const raw = fs.readFileSync(p, "utf-8");
  const data = JSON.parse(raw) as PromptsFile;
  const prompts = (data.prompts ?? []).map((pr) => ({
    ...pr,
    category: normalizePromptCategories(pr.category),
  }));
  return { prompts };
}

export function writePromptsFile(data: PromptsFile): void {
  ensurePromptsDir();
  fs.writeFileSync(
    getPromptsFilePath(),
    JSON.stringify(data, null, 2),
    "utf-8",
  );
}

export function listPrompts(filterCategory?: PromptCategory | null): Prompt[] {
  const { prompts } = readPromptsFile();
  if (!filterCategory) return prompts;
  return prompts.filter((p) => p.category.includes(filterCategory));
}

export function getPromptById(id: string): Prompt | null {
  return readPromptsFile().prompts.find((p) => p.id === id) ?? null;
}

function promptIdFromName(name: string): string {
  const base = slugifyName(name).replace(/-/g, "_") || "prompt";
  return base.slice(0, 80);
}

function uniquePromptId(base: string, taken: Set<string>): string {
  let id = base;
  let n = 2;
  while (taken.has(id)) {
    id = `${base}_${n++}`;
  }
  return id;
}

export function addPrompt(input: {
  name: string;
  category: PromptCategory[];
  text: string;
}): Prompt {
  const data = readPromptsFile();
  const taken = new Set(data.prompts.map((p) => p.id));
  const base = promptIdFromName(input.name);
  const id = uniquePromptId(base, taken);
  const prompt: Prompt = {
    id,
    name: input.name.trim(),
    category: input.category,
    text: input.text.trim(),
  };
  data.prompts.push(prompt);
  writePromptsFile(data);
  return prompt;
}

export function updatePrompt(
  id: string,
  patch: Partial<Pick<Prompt, "name" | "category" | "text">>,
): Prompt | null {
  const data = readPromptsFile();
  const idx = data.prompts.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const cur = data.prompts[idx];
  const next: Prompt = {
    ...cur,
    ...patch,
    name: patch.name !== undefined ? patch.name.trim() : cur.name,
    category: patch.category !== undefined ? patch.category : cur.category,
    text: patch.text !== undefined ? patch.text.trim() : cur.text,
  };
  data.prompts[idx] = next;
  writePromptsFile(data);
  return next;
}

export function deletePrompt(id: string): boolean {
  const data = readPromptsFile();
  const before = data.prompts.length;
  data.prompts = data.prompts.filter((p) => p.id !== id);
  if (data.prompts.length === before) return false;
  writePromptsFile(data);
  return true;
}
