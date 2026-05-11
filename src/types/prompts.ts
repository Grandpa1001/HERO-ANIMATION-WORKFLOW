export const PROMPT_CATEGORIES = [
  "loop",
  "one-shot",
  "interakcja",
  "ruch",
] as const;

export type PromptCategory = (typeof PROMPT_CATEGORIES)[number];

export type Prompt = {
  id: string;
  name: string;
  category: PromptCategory[];
  text: string;
};

export type PromptsFile = {
  prompts: Prompt[];
};
