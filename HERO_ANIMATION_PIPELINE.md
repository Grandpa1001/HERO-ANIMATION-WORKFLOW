# Hero Animation Pipeline — Plan Developmentu

> **Cel**: Aplikacja-kokpit do tworzenia animowanych GIFów postaci (bohaterów, maskotów, postaci UI) z możliwością użycia w aplikacjach mobilnych, onboardingu, powiadomieniach i innych kontekstach.
>
> **Flow**: Zdjęcie PNG 9:16 z greenscreen → Wybór/zapis promptu → Ręczne generowanie w fal.ai → MP4 do folderu → Konwersja → GIF/WebP bez tła → Preview Gallery

---

## Architektura Systemu

```
[PNG 9:16 + greenscreen]
        ↓
  [Kokpit — Tab 1: Bohater]  ←── definicja postaci, upload PNG 9:16, opis, tagi
        ↓
  [Kokpit — Tab 2: Prompt]   ←── biblioteka promptów animacji, filtrowanie, tworzenie nowych
        ↓ (ręczne kopiowanie do fal.ai)
  [fal.ai — zewnętrzne]      ←── generowanie wideo, wynik ląduje w /heroes/{nazwa}/mp4/
        ↓
  [Kokpit — Tab 3: Pliki]    ←── watcher folderów, widok struktury PNG/MP4/GIF per bohater
        ↓
  [Kokpit — Tab 4: Preview]  ←── podgląd animacji w pętli, zmiana animacji kliknięciem, eksport
```

---

## Etap 0 — Środowisko i Stack

**Czas**: ~2h
**Cel**: Przygotowanie projektu, zależności, struktura folderów

### Stack
- **Frontend**: Next.js 14 (App Router) + Tailwind CSS
- **Backend/API**: Next.js API Routes (Node.js)
- **AI Prompt Helper**: Anthropic SDK (`claude-sonnet-4-20250514`) — opcjonalne wspomaganie opisu
- **Konwersja wideo → GIF/WebP**: `ffmpeg` przez `fluent-ffmpeg`
- **Usuwanie tła z MP4**: `ffmpeg` chromakey filter → transparentny GIF lub WebP
- **Folder watcher**: `chokidar`
- **Przechowywanie stanu**: lokalny JSON lub SQLite (`better-sqlite3`)

### Struktura folderów (per bohater)

```
/heroes
  /zara
    /png
      zara_main.png        ← oryginał 9:16, greenscreen
    /mp4
      zara_idle.mp4
      zara_run.mp4
      zara_wave.mp4
      zara_jump_in.mp4     ← nowy, oczekuje konwersji
    /gif
      zara_idle.gif
      zara_run.gif
      zara_wave.gif
  /kael
    /png ...
    /mp4 ...
    /gif ...
/prompts
  prompts.json             ← globalna biblioteka promptów animacji
/src
  /app
    /api                   ← API routes
  /components              ← komponenty kokpitu
  /lib                     ← ffmpeg helpers, prompt helpers
pipeline.config.json
```

### Instalacja zależności
```bash
npm install next react react-dom tailwindcss
npm install @anthropic-ai/sdk
npm install chokidar
npm install better-sqlite3
npm install fluent-ffmpeg
npm install sharp
npm install framer-motion
# + ffmpeg systemowo: brew install ffmpeg / apt install ffmpeg
```

---

## Etap 1 — Definicja Bohatera (Tab: Bohater)

**Czas**: ~3h
**Cel**: Rejestracja postaci, upload PNG 9:16, opis i zarządzanie

### Co zawiera karta bohatera
- Podgląd PNG w proporcjach **9:16** z szachownicowym tłem (transparent preview)
- Nazwa postaci
- Opis / charakter (kontekst użycia, styl ruchu, osobowość)
- Tagi (np. `fantasy`, `female`, `dynamic`)
- Lista animacji ze statusem: GIF gotowy / MP4 oczekuje / brak
- Przyciski szybkiego dostępu: Generuj prompt → Preview

### Formularz nowego bohatera
```
Nazwa bohatera:    [________________]
Opis / charakter:  [________________]
                   [________________]
Zdjęcie PNG:       [Przeciągnij lub kliknij — format 9:16, jednolite tło #00FF00]
```

### Sidebar bohaterów
```
[Zara   ●●●○○]   ← 3 GIF gotowe, 1 oczekuje, 1 brak
[Kael   ●●○○○]
[Nova   ○○○○○]
[+ Nowy bohater]
```
Kropki: zielona = GIF gotowy, żółta = MP4 oczekuje, szara = brak

### Struktura danych bohatera
```json
{
  "id": "zara",
  "name": "Zara",
  "description": "Wojowniczka z zieloną zbroją. Dynamiczny charakter, szybkie ruchy. Używana w onboardingu i powiadomieniach.",
  "tags": ["fantasy", "female", "dynamic"],
  "png": "/heroes/zara/png/zara_main.png",
  "animations": {
    "idle":    { "mp4": "zara_idle.mp4",    "gif": "zara_idle.gif",    "status": "done" },
    "run":     { "mp4": "zara_run.mp4",     "gif": "zara_run.gif",     "status": "done" },
    "wave":    { "mp4": "zara_wave.mp4",    "gif": "zara_wave.gif",    "status": "done" },
    "jump_in": { "mp4": "zara_jump_in.mp4", "gif": null,               "status": "pending" },
    "dance":   { "mp4": null,               "gif": null,               "status": "missing" }
  }
}
```

---

## Etap 2 — Biblioteka Promptów (Tab: Prompt)

**Czas**: ~3h
**Cel**: Centralny rejestr promptów animacji — zapisywalne, wielokrotnego użytku, filtrowane

### Kluczowe założenie
Prompty **nie są generowane jednorazowo** per animacja. Zamiast tego:
- Użytkownik tworzy i zapisuje własne prompty z nazwą i kategorią
- Każdy prompt można wybrać z listy przy dowolnym bohaterze
- Prompty są przechowywane globalnie w `prompts.json`
- Przy wklejaniu do fal.ai użytkownik ręcznie dodaje opis konkretnego bohatera na początku

### Kategorie promptów
- **loop** — animacje zapętlone (idle, run, jump)
- **one-shot** — jednorazowe (wejście na ekran, upadek)
- **interakcja** — zwracanie się do użytkownika (machanie, wskazywanie, świętowanie)
- **ruch** — przemieszczanie się (bieg, spacer, skok)

### Przykładowe prompty w bibliotece
```
Idle · loop         — postać stoi, subtelny oddech, delikatne kołysanie ciałem
Run · loop          — bieg, praca rąk, cykl nóg, lekkie pochylenie
Jump · loop         — przysiad, odbicie, lot, lądowanie — pętla
Wave hello · loop   — postać macha do kamery, ciepły uśmiech
Jump in · one-shot  — wpadanie z góry w kadr, lądowanie z efektem
Celebration · loop  — skoki z radości, confetti, uniesione ręce
Point at screen     — wskazywanie palcem na kamerę, pewna mina
Tired / sad · loop  — przygarbiona sylwetka, wolny oddech, westchnienie
```

### Formularz nowego promptu
```
Nazwa / typ:   [np. Dance · loop             ]
Kategoria:     [loop / one-shot / interakcja / ruch]
Treść promptu: [_________________________________]
               [_________________________________]
[Anuluj]  [Zapisz]
```

### Użycie promptu przy generowaniu
1. Wybierz prompt z listy (kliknięcie)
2. W prawej kolumnie pojawia się pełna treść + przycisk kopiuj
3. Uwaga: *"Dodaj opis bohatera na początku: 'Zara — wojowniczka z zieloną zbroją,'"*
4. Kliknij "Otwórz fal.ai" → wklej → wygeneruj → pobierz MP4 do folderu

### Struktura `prompts.json`
```json
{
  "prompts": [
    {
      "id": "idle_loop",
      "name": "Idle · loop",
      "category": ["loop"],
      "text": "Character standing still, subtle breathing motion, slight body sway, hair and clothing moving gently in wind. Seamless loop, green bg #00FF00, 9:16 vertical frame."
    },
    {
      "id": "wave_hello",
      "name": "Wave hello · loop",
      "category": ["interaction", "loop"],
      "text": "Character looking at camera, raising one arm and waving enthusiastically with a warm smile. Looped gesture, green bg #00FF00, 9:16 portrait."
    }
  ]
}
```

### API Routes: `/api/prompts`
```typescript
// GET    /api/prompts       → lista wszystkich promptów
// POST   /api/prompts       → zapisz nowy prompt
// PUT    /api/prompts/:id   → edytuj prompt
// DELETE /api/prompts/:id   → usuń prompt
```

---

## Etap 3 — Widok Plików (Tab: Pliki)

**Czas**: ~3h
**Cel**: Przeglądarka struktury folderów per bohater z podglądem statusów

### UI — drzewo folderów
```
zara/
  ├── png/
  │     zara_main.png        480×854px · 92KB · greenscreen
  ├── mp4/                                              [1 nowy]
  │     zara_idle.mp4        3s · 1080×1920 · 2.1MB   [skonwertowany]
  │     zara_run.mp4         3s · 1080×1920 · 1.8MB   [skonwertowany]
  │     zara_wave.mp4        3s · 1080×1920 · 2.4MB   [skonwertowany]
  │     zara_jump_in.mp4     nowy · oczekuje            [→ Konwertuj]
  └── gif/                                              [3 pliki]
        zara_idle.gif        256×455px · 12fps · 340KB  [↓]
        zara_run.gif         256×455px · 12fps · 290KB  [↓]
        zara_wave.gif        256×455px · 12fps · 410KB  [↓]
```

### Folder watcher — mechanizm
```typescript
// /src/lib/watcher.ts
import chokidar from 'chokidar';

const watcher = chokidar.watch('./heroes', {
  persistent: true,
  ignoreInitial: false,
  awaitWriteFinish: { stabilityThreshold: 2000 }
});

watcher.on('add', (filePath) => {
  // 1. Wykryj bohatera po ścieżce (/heroes/{nazwa}/mp4/*.mp4)
  // 2. Zapisz jako "pending" w JSON
  // 3. Wyślij SSE event → frontend odświeża listę
});
```

### Konwersja z widoku plików
- Nowe (nieskonwertowane) MP4 mają przycisk "Konwertuj"
- Gotowe pliki mają przycisk pobierania
- Przycisk "Konwertuj nowe MP4" w panelu bocznym przetwarza wszystkie oczekujące

---

## Etap 4 — Konwersja MP4 → GIF/WebP

**Czas**: ~4h
**Cel**: Wycięcie greenscreen z MP4 i konwersja do GIF lub WebP

### Pipeline (ffmpeg)
```
MP4 [greenscreen 9:16]
    ↓
  ffmpeg chromakey (#00FF00)
    ↓
  scale → docelowa szerokość (256px)
    ↓
  fps limit (12fps)
    ↓
  GIF (1-bit alpha) lub WebP animated (pełna alpha)
    ↓
  /heroes/{nazwa}/gif/{nazwa}_{animacja}.gif
```

### Implementacja
```typescript
// /src/lib/convert.ts
import ffmpeg from 'fluent-ffmpeg';

export async function convertMp4ToGif(
  inputPath: string,
  outputPath: string,
  options: ConvertOptions
) {
  const { greenColor = '0x00FF00', similarity = 0.3, fps = 12, width = 256 } = options;

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters([
        `chromakey=color=${greenColor}:similarity=${similarity}:blend=0.1`,
        `scale=${width}:-1:flags=lanczos`,
        `fps=${fps}`
      ])
      .outputOptions(['-loop', '0', '-plays', '0'])
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}
```

### Uwaga o transparencji
> GIF obsługuje tylko 1-bitową transparencję (schodkowe krawędzie). Dla lepszej jakości eksportuj do **animated WebP** — pełna alpha, 2–3× mniejszy plik, idealny dla aplikacji mobilnych.
> Wybór formatu w ustawieniach: GIF / WebP / APNG

### API Route: `/api/convert`
```typescript
// POST /api/convert
// Body: { heroId, mp4Path, animationName, options }
// Zwraca: { gifPath, frames, duration, fileSize }
```

---

## Etap 5 — Preview Gallery (Tab: Preview)

**Czas**: ~4h
**Cel**: Centralny widok bohatera 9:16 z animacjami w pętli — zmiana kliknięciem

### Układ widoku
```
[Bohater 9:16 w pętli]  |  Lista animacji:
                         |  ● Idle        ← aktywna (GIF gotowy)
  256×455px              |  ○ Run         (GIF gotowy)
  transparent bg         |  ○ Wave hello  (GIF gotowy)
  checkered pattern      |  ⏳ Jump in    (MP4 oczekuje konwersji)
                         |  ✗ Dance       (brak pliku → Prompt)
[↓ GIF]  [↓ WebP]       |
```

### Zmiana animacji
```typescript
const [activeAnim, setActiveAnim] = useState<string>('idle');

// Kliknięcie animacji na liście:
// → zmiana src GIF w centralnym widoku 9:16
// → GIF odgrywa się w nieskończonej pętli
// → aktualizacja badge z nazwą i metadanymi (fps, rozmiar)
```

### Komponenty
```typescript
HeroPreview.tsx       // widok 9:16 z GIF w pętli
AnimationList.tsx     // lista z ikonami statusów, klikalna
AnimationBadge.tsx    // nazwa aktywnej animacji + metadane
ExportPanel.tsx       // pobieranie GIF/WebP, sprite sheet
```

---

## Etap 6 — Konfiguracja Pipeline'u

**Czas**: ~2h
**Cel**: Plik konfiguracyjny i panel ustawień

```json
{
  "greenscreen": {
    "color": "#00FF00",
    "similarity": 0.30,
    "blend": 0.1
  },
  "output": {
    "format": "gif",
    "alternativeFormat": "webp",
    "fps": 12,
    "width": 256,
    "loop": true
  },
  "fal": {
    "model": "fal-ai/kling-video",
    "duration": 3,
    "aspectRatio": "9:16"
  },
  "folders": {
    "heroesRoot": "./heroes",
    "promptsFile": "./prompts/prompts.json"
  }
}
```

> Zmiana względem v1: `aspectRatio` to `9:16` (pionowy kadr postaci) zamiast `1:1`.

---

## Decyzja Architektoniczna: Format wyjściowy

### Opcja A: GIF (transparent) — domyślna
```
MP4 → ffmpeg chromakey → GIF
```
Zalety: powszechnie wspierany, prosta implementacja
Wady: 1-bit alpha (schodkowe krawędzie), duże pliki

### Opcja B: Animated WebP — rekomendowany dla aplikacji
```
MP4 → ffmpeg chromakey → WebP animated
```
Zalety: pełna alpha, 2–3× mniejszy niż GIF, nowoczesny format
Wady: starsze środowiska mogą nie wspierać

### Opcja C: Sekwencja PNG → gifski
```
MP4 → klatki PNG → rembg/sharp per-frame → gifski
```
Zalety: najlepsza jakość krawędzi, działa bez greenscreen
Wady: wolne, wymaga Python/rembg

> Implementuj A jako domyślną + B jako opcję eksportu. Toggle w ustawieniach.

---

## Kolejność Implementacji

| Etap | Priorytet | Czas |
|------|-----------|------|
| 0 — Setup środowiska | Krytyczny | 2h |
| 1 — Definicja bohatera + upload PNG 9:16 | Krytyczny | 3h |
| 2 — Biblioteka promptów (zapis, filtr, kopiuj) | Krytyczny | 3h |
| 4 — Konwersja MP4 → GIF/WebP | Krytyczny | 4h |
| 3 — Widok plików + folder watcher | Wysoki | 3h |
| 5 — Preview Gallery 9:16 | Wysoki | 4h |
| 6 — Konfiguracja | Średni | 2h |

**Łączny szacowany czas**: ~21h developmentu

---

## Zależności

```bash
# System
brew install ffmpeg        # macOS
apt install ffmpeg         # Linux

# Node.js
npm install @anthropic-ai/sdk
npm install fluent-ffmpeg
npm install @ffmpeg-installer/ffmpeg
npm install chokidar
npm install sharp
npm install better-sqlite3
npm install next@14 react react-dom
npm install tailwindcss @tailwindcss/forms
npm install framer-motion
```

---

## Przykładowe prompty do fal.ai

### Idle — pełny prompt z bohaterem
```
Zara — female warrior in green armor, slim athletic build.
Character standing still, subtle breathing motion, slight body sway,
hair and clothing moving gently in wind. Seamless loop, 9:16 vertical
frame, solid green background #00FF00 for chroma key. No camera movement.
```

### Wave hello
```
Zara — female warrior in green armor, slim athletic build.
Character looking directly at camera, raising one arm and waving
enthusiastically with a warm smile. Looped gesture, 9:16 vertical
frame, solid green background #00FF00.
```

### Jump in (one-shot)
```
Zara — female warrior in green armor, slim athletic build.
Character enters from above, falling into frame from top, lands with
impact pose — knees bent, arms out, looks up at camera. One-shot
3-second animation, 9:16 frame, solid green background #00FF00.
```

---

## Dalszy Rozwój (Post-MVP)

- **Sprite Sheet Generator** — wszystkie klatki GIF ułożone w jeden PNG
- **Batch Conversion** — kolejka konwersji wielu MP4 naraz
- **fal.ai Direct Integration** — odpalanie generowania bezpośrednio z kokpitu przez API
- **Prompt Templates** — zmienne `{hero_name}`, `{hero_description}` auto-uzupełniane przy kopiowaniu
- **Animation Blending Preview** — podgląd przejść idle→run→attack
- **Export Presets** — paczki gotowe dla Unity, Godot, React Native

---

*Dokument: HERO_ANIMATION_PIPELINE.md | Wersja: 2.0*
