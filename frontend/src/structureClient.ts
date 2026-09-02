import type { StructureResult } from "./types";

const KEY = "easy_study_or_key";
const SHARED = String(import.meta.env.VITE_OPENROUTER_API_KEY || "");

const MODELS = [
  "inclusionai/ling-3.0-flash-fin:free",
  "dots-studio/dots-3-note-preview:free",
];

const SYSTEM_PROMPT = `Оформи студенческий конспект.

Формат:
1. Короткий заголовок
   Абзац из исходника.
   *   пункт списка

Правила:
- Не меняй и не выкидывай слова исходника.
- Можно только нумерацию, маркеры *, переносы строк и короткие заголовки из слов исходника.
- Разбей сплошной текст на пункты 1. 2. 3.
- Списки внутри пункта — * или 1. 2.
- Ответ: только оформленный конспект. Без TITLE, без ---, без пояснений.`;

export function hasSharedKey() {
  return Boolean(SHARED);
}

export function loadOrKey() {
  return localStorage.getItem(KEY) || "";
}

function activeKey(userKey: string) {
  return userKey.trim() || loadOrKey() || SHARED;
}

export function saveOrKey(key: string) {
  const v = key.trim();
  if (v) localStorage.setItem(KEY, v);
  else localStorage.removeItem(KEY);
}

function parseLecture(content: string): StructureResult {
  let structured = content.trim();
  let title = "Без названия";
  const titled = structured.match(/TITLE:\s*(.+?)\s*\n+---+\s*\n([\s\S]*)/i);
  if (titled) {
    title = titled[1].trim();
    structured = titled[2].trim();
  }
  const heading = structured.match(/^\s*1\.\s+(.+)/m);
  if (heading) title = heading[1].trim().slice(0, 80) || title;
  return { title, structured, wordsChanged: false };
}

export async function structureOpenRouter(text: string, key: string): Promise<StructureResult> {
  const errors: string[] = [];
  for (const model of MODELS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 55_000);
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer":
            typeof location !== "undefined" ? location.origin : "https://easy-study.vercel.app",
          "X-Title": "Easy Study",
        },
        signal: ctrl.signal,
        body: JSON.stringify({
          model,
          temperature: 0.1,
          max_tokens: 6000,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: text.slice(0, 12000) },
          ],
        }),
      });
      const data = (await res.json()) as {
        error?: { message?: string };
        choices?: { message?: { content?: string } }[];
      };
      if (!res.ok) {
        errors.push(`${model}: ${data.error?.message || res.status}`);
        continue;
      }
      const content = data.choices?.[0]?.message?.content?.trim() || "";
      if (content.length < 80) {
        errors.push(`${model}: пустой ответ`);
        continue;
      }
      return parseLecture(content);
    } catch (e) {
      const msg = (e as Error).message || String(e);
      errors.push(`${model}: ${/abort/i.test(msg) ? "таймаут" : msg}`);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(errors[0] || "ИИ не ответил");
}

export async function structureNotes(text: string, key: string): Promise<StructureResult> {
  const k = activeKey(key);
  if (!k) throw new Error("Нет ключа OpenRouter");
  return structureOpenRouter(text, k);
}
