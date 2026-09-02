export type StructureResult = {
  title: string;
  structured: string;
  wordsChanged: boolean;
  warning?: string;
  model?: string;
};

function stripStructurePrefixes(text: string): string {
  return text
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s{0,3}#{1,6}\s+/, "")
        .replace(/^\s*(\d+(\.\d+)*[.)]?|[*\-+•])\s+/, ""),
    )
    .join("\n");
}

function contentWords(text: string): string[] {
  return text.normalize("NFC").toLocaleLowerCase("ru").match(/[\p{L}\p{N}]+/gu) ?? [];
}

function isSubsequence(small: string[], big: string[]): boolean {
  let i = 0;
  for (const w of big) {
    if (i < small.length && w === small[i]) i += 1;
  }
  return i === small.length;
}

export function analyzeWordChange(original: string, structured: string): boolean {
  const orig = contentWords(original);
  const stru = contentWords(stripStructurePrefixes(structured));
  if (orig.length === 0) return stru.length > 0;
  const origSet = new Set(orig);
  const extraUnknown = stru.some((w) => !origSet.has(w));
  return extraUnknown || !isSubsequence(orig, stru);
}

const SYSTEM_PROMPT = `Оформи студенческий конспект.
Нельзя менять, удалять, перефразировать слова.
Можно только нумерацию, пустые строки, маркеры.
Формат ответа строго такой, без JSON и без рассуждений:

TITLE: короткий заголовок 3-8 слов
---
текст с нумерацией`;

const REQUEST_MS = 35_000;
const MODELS = [
  "dots-studio/dots-3-note-preview:free",
  "inclusionai/ling-3.0-flash-fin:free",
];

export function structureLocally(original: string, reason?: string): StructureResult {
  const lines = original.replace(/\r\n/g, "\n").split("\n");
  let n = 0;
  const structured = lines
    .map((line) => {
      const t = line.trim();
      if (!t) return "";
      n += 1;
      if (/^\d+(\.\d+)*[.)]?\s+/.test(t) || /^[*\-+•]\s+/.test(t)) return t;
      return `${n}. ${t}`;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
  const title =
    original.trim().split(/\s+/).slice(0, 8).join(" ").slice(0, 80) || "Без названия";
  return {
    title,
    structured: structured.trim() || original,
    wordsChanged: false,
    model: "local",
    warning: reason
      ? `ИИ не ответил (${reason}). Сделана быстрая нумерация без смены слов.`
      : undefined,
  };
}

function parseOutput(content: string): { title?: string; structured?: string } | null {
  const titled = content.match(/TITLE:\s*(.+?)\s*\n+---+\s*\n([\s\S]*)/i);
  if (titled) {
    return { title: titled[1].trim(), structured: titled[2].trim() };
  }
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as {
        title?: string;
        structured?: string;
      };
    } catch {
      return null;
    }
  }
  return null;
}

async function callModel(apiKey: string, model: string, snippet: string) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_MS);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://127.0.0.1:5173",
        "X-Title": "Uchebnye konspekty",
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 2500,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: snippet },
        ],
      }),
    });
    const data = (await res.json()) as {
      error?: { message?: string };
      choices?: { message?: { content?: string } }[];
    };
    if (!res.ok) {
      return { error: data.error?.message || `HTTP ${res.status}` };
    }
    return { content: data.choices?.[0]?.message?.content ?? "" };
  } catch (e) {
    const raw = (e as Error).message || String(e);
    return {
      error: /abort|timeout|terminated/i.test(raw) ? "таймаут или обрыв соединения" : raw,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function structureWithOpenRouter(
  apiKey: string,
  original: string,
): Promise<StructureResult> {
  const snippet = original.length > 6000 ? original.slice(0, 6000) : original;
  const errors: string[] = [];
  for (const model of MODELS) {
    const result = await callModel(apiKey, model, snippet);
    if (result.error || !result.content?.trim()) {
      errors.push(`${model}: ${result.error || "пусто"}`);
      continue;
    }
    const parsed = parseOutput(result.content);
    if (!parsed?.structured) {
      errors.push(`${model}: не разобрать ответ`);
      continue;
    }
    const structured = parsed.structured;
    const title = (parsed.title ?? "").trim() || "Без названия";
    const wordsChanged = analyzeWordChange(snippet, structured);
    return {
      title,
      structured,
      wordsChanged,
      model,
      warning: wordsChanged
        ? "ИИ мог изменить слова. Проверь текст."
        : undefined,
    };
  }
  return structureLocally(original, errors[0] ?? "нет ответа");
}
