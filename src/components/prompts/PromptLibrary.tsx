"use client";

import { useCallback, useEffect, useState } from "react";
import type { Hero } from "@/types/heroes";
import type { Prompt, PromptCategory } from "@/types/prompts";
import { PROMPT_CATEGORIES } from "@/types/prompts";

const FAL_DASHBOARD = "https://fal.ai/dashboard";

const CATEGORY_LABELS: Record<PromptCategory, string> = {
  loop: "loop — zapętlone (idle, run, jump…)",
  "one-shot": "one-shot — jednorazowe (wejście, upadek…)",
  interakcja: "interakcja — do użytkownika (machanie, wskazywanie…)",
  ruch: "ruch — przemieszczenie (bieg, spacer, skok…)",
};

type PanelMode = "detail" | "create" | "edit";

type Props = {
  hero: Hero | null;
  /** Po zmianie listy promptów (dodanie/usunięcie) — odświeżenie bohaterów w kokpicie. */
  onLibraryChanged?: () => void;
};

async function fetchPromptsList(
  cat: PromptCategory | "all",
): Promise<{ prompts: Prompt[]; error?: string }> {
  const q = cat === "all" ? "" : `?category=${encodeURIComponent(cat)}`;
  const res = await fetch(`/api/prompts${q}`);
  const data = (await res.json()) as { prompts?: Prompt[]; error?: string };
  if (!res.ok) {
    return { prompts: [], error: data.error ?? "Nie udało się wczytać promptów." };
  }
  return { prompts: data.prompts ?? [] };
}

export function PromptLibrary({ hero, onLibraryChanged }: Props) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [filter, setFilter] = useState<PromptCategory | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>("detail");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);

  const [formName, setFormName] = useState("");
  const [formText, setFormText] = useState("");
  const [formCats, setFormCats] = useState<Set<PromptCategory>>(new Set());

  const applyPrompts = useCallback((list: Prompt[], preferId: string | null) => {
    setPrompts(list);
    setSelectedId((cur) => {
      const pick = preferId ?? cur;
      if (pick && list.some((p) => p.id === pick)) return pick;
      return list[0]?.id ?? null;
    });
  }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const { prompts: list, error } = await fetchPromptsList(filter);
      if (error) {
        setLoadError(error);
        setPrompts([]);
        return;
      }
      applyPrompts(list, null);
    } catch {
      setLoadError("Błąd sieci przy wczytywaniu promptów.");
      setPrompts([]);
    }
  }, [filter, applyPrompts]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = prompts.find((p) => p.id === selectedId) ?? null;

  function openCreate() {
    setFormError(null);
    setFormName("");
    setFormText("");
    setFormCats(new Set());
    setPanelMode("create");
    setSelectedId(null);
  }

  function openEdit(p: Prompt) {
    setFormError(null);
    setFormName(p.name);
    setFormText(p.text);
    setFormCats(new Set(p.category));
    setPanelMode("edit");
    setSelectedId(p.id);
  }

  function cancelForm() {
    setPanelMode("detail");
    setFormError(null);
    setSelectedId((prev) => prev ?? prompts[0]?.id ?? null);
  }

  async function submitForm() {
    setFormError(null);
    const category = Array.from(formCats);
    if (!formName.trim()) {
      setFormError("Podaj nazwę / typ promptu.");
      return;
    }
    if (category.length === 0) {
      setFormError("Wybierz co najmniej jedną kategorię.");
      return;
    }
    if (!formText.trim()) {
      setFormError("Podaj treść promptu.");
      return;
    }

    setFormBusy(true);
    try {
      if (panelMode === "create") {
        const res = await fetch("/api/prompts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            text: formText,
            category,
          }),
        });
        const data = (await res.json()) as { prompt?: Prompt; error?: string };
        if (!res.ok) {
          setFormError(data.error ?? "Błąd zapisu.");
          return;
        }
        setFilter("all");
        const { prompts: list, error } = await fetchPromptsList("all");
        if (error) {
          setLoadError(error);
          return;
        }
        applyPrompts(list, data.prompt?.id ?? null);
        setPanelMode("detail");
        onLibraryChanged?.();
      } else if (panelMode === "edit" && selectedId) {
        const res = await fetch(`/api/prompts/${selectedId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            text: formText,
            category,
          }),
        });
        const data = (await res.json()) as { prompt?: Prompt; error?: string };
        if (!res.ok) {
          setFormError(data.error ?? "Błąd zapisu.");
          return;
        }
        const { prompts: list, error } = await fetchPromptsList(filter);
        if (error) {
          setLoadError(error);
          return;
        }
        applyPrompts(list, data.prompt?.id ?? selectedId);
        setPanelMode("detail");
      }
    } catch {
      setFormError("Błąd sieci.");
    } finally {
      setFormBusy(false);
    }
  }

  async function removePrompt(id: string) {
    if (!window.confirm("Usunąć ten prompt z biblioteki?")) return;
    try {
      const res = await fetch(`/api/prompts/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setLoadError(data.error ?? "Nie udało się usunąć.");
        return;
      }
      await load();
      setPanelMode("detail");
      onLibraryChanged?.();
    } catch {
      setLoadError("Błąd sieci przy usuwaniu.");
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg("Skopiowano do schowka.");
      window.setTimeout(() => setCopyMsg(null), 2000);
    } catch {
      setCopyMsg("Nie udało się skopiować (przeglądarka).");
      window.setTimeout(() => setCopyMsg(null), 3000);
    }
  }

  function toggleCat(c: PromptCategory) {
    setFormCats((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  const formBlock = (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-neutral-900">
        {panelMode === "create" ? "Nowy prompt" : "Edycja promptu"}
      </h3>
      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-neutral-700">
            Nazwa / typ
          </span>
          <input
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
            placeholder="np. Dance · loop"
          />
        </label>
        <fieldset>
          <legend className="text-sm font-medium text-neutral-700">
            Kategoria (możesz zaznaczyć kilka)
          </legend>
          <div className="mt-2 flex flex-col gap-2">
            {PROMPT_CATEGORIES.map((c) => (
              <label
                key={c}
                className="flex cursor-pointer items-start gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={formCats.has(c)}
                  onChange={() => toggleCat(c)}
                  className="mt-0.5 rounded border-neutral-300"
                />
                <span>{CATEGORY_LABELS[c]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="text-sm font-medium text-neutral-700">
            Treść promptu
          </span>
          <textarea
            value={formText}
            onChange={(e) => setFormText(e.target.value)}
            rows={8}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
          />
        </label>
      </div>
      {formError ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {formError}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={formBusy}
          onClick={() => void submitForm()}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {formBusy ? "Zapisywanie…" : "Zapisz"}
        </button>
        <button
          type="button"
          onClick={cancelForm}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Anuluj
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex w-full flex-1 flex-col gap-4 lg:flex-row lg:gap-6">
      <div className="flex w-full flex-col gap-4 lg:max-w-sm lg:shrink-0">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-neutral-900">
            Biblioteka promptów
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Prompty globalne — przy wklejaniu do fal.ai dodaj na początku opis
            konkretnego bohatera.
          </p>
          <label className="mt-4 block">
            <span className="text-sm font-medium text-neutral-700">Filtr</span>
            <select
              value={filter}
              onChange={(e) =>
                setFilter(e.target.value as PromptCategory | "all")
              }
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
            >
              <option value="all">Wszystkie kategorie</option>
              {PROMPT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          + Nowy prompt
        </button>

        {loadError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {loadError}
          </p>
        ) : null}

        <ul className="flex flex-col gap-1">
          {prompts.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(p.id);
                  setPanelMode("detail");
                }}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                  selectedId === p.id && panelMode === "detail"
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-300"
                }`}
              >
                <span className="font-medium">{p.name}</span>
                <span
                  className={`mt-0.5 block text-xs ${
                    selectedId === p.id && panelMode === "detail"
                      ? "text-neutral-300"
                      : "text-neutral-500"
                  }`}
                >
                  {p.category.join(", ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {prompts.length === 0 && !loadError ? (
          <p className="text-sm text-neutral-500">Brak promptów w tym filtrze.</p>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        {panelMode === "create" || panelMode === "edit" ? (
          formBlock
        ) : selected ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">
                    {selected.name}
                  </h2>
                  <p className="mt-1 text-xs text-neutral-500">id: {selected.id}</p>
                  <p className="mt-2 text-sm text-neutral-600">
                    {selected.category.map((c) => CATEGORY_LABELS[c]).join(" · ")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(selected)}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
                  >
                    Edytuj
                  </button>
                  <button
                    type="button"
                    onClick={() => void removePrompt(selected.id)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-50"
                  >
                    Usuń
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-lg bg-neutral-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Treść (wklej do fal.ai + prefix bohatera)
                </p>
                <pre className="mt-2 max-h-[min(50vh,420px)] overflow-auto whitespace-pre-wrap break-words font-mono text-sm text-neutral-900">
                  {selected.text}
                </pre>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void copyText(selected.text)}
                  className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                >
                  Kopiuj treść
                </button>
                <a
                  href={FAL_DASHBOARD}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
                >
                  Otwórz fal.ai ↗
                </a>
              </div>
              {copyMsg ? (
                <p className="mt-2 text-sm text-emerald-700">{copyMsg}</p>
              ) : null}
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
              <p className="font-medium">Uwaga przy generowaniu</p>
              <p className="mt-2 text-amber-900/90">
                Dodaj na początku promptu opis konkretnego bohatera, np.{" "}
                <span className="font-medium">
                  „Zara — wojowniczka z zieloną zbroją,”
                </span>{" "}
                a potem treść poniżej.
              </p>
              {hero ? (
                <blockquote className="mt-3 rounded-lg border border-amber-200/80 bg-white px-3 py-2 text-neutral-800">
                  <span className="text-neutral-500">Sugestia z aktualnego bohatera:</span>
                  <br />
                  <span className="font-medium">
                    {hero.name} — {hero.description.trim().slice(0, 200)}
                    {hero.description.trim().length > 200 ? "…" : ""}
                  </span>
                </blockquote>
              ) : (
                <p className="mt-3 text-amber-900/85">
                  Wybierz bohatera w zakładce „Bohater”, żeby zobaczyć sugerowany
                  prefix z jego opisu.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-neutral-600">
            <p>Wybierz prompt z listy lub utwórz nowy.</p>
          </div>
        )}
      </div>
    </div>
  );
}
