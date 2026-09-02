import { api } from "./api";
import type { StructureResult } from "./types";

const KEY = "easy_study_or_key";
const SHARED = String(import.meta.env.VITE_OPENROUTER_API_KEY || "");

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
  const title = original.trim().split(/\s+/).slice(0, 8).join(" ").slice(0, 80) || "Без названия";
  return {
    title,
    structured: structured.trim() || original,
    wordsChanged: false,
    warning: reason,
  };
}

async function structureOpenRouter(text: string, key: string): Promise<StructureResult> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": typeof location !== "undefined" ? location.origin : "https://easy-study.vercel.app",
      "X-Title": "Easy Study",
    },
    body: JSON.stringify({
      model: "dots-studio/dots-3-note-preview:free",
      temperature: 0,
      max_tokens: 2500,
      messages: [
        {
          role: "system",
          content:
            "Оформи конспект. Не меняй слова. Формат:\nTITLE: заголовок\n---\nтекст с нумерацией",
        },
        { role: "user", content: text.slice(0, 6000) },
      ],
    }),
  });
  const data = (await res.json()) as {
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
  };
  if (!res.ok) throw new Error(data.error?.message || `OpenRouter ${res.status}`);
  const content = data.choices?.[0]?.message?.content || "";
  let title = "Без названия";
  let structured = text;
  if (content.includes("---")) {
    const [head, rest] = content.split("---");
    if (head?.includes("TITLE:")) title = head.split("TITLE:")[1]?.trim() || title;
    structured = rest?.trim() || text;
  }
  return { title, structured, wordsChanged: false };
}

export async function structureNotes(text: string, key: string): Promise<StructureResult> {
  try {
    const res = await fetch("/api/ai-structure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok) return (await res.json()) as StructureResult;
  } catch {
    /* нет serverless — ниже OpenRouter */
  }
  const k = activeKey(key);
  if (k) {
    try {
      return await structureOpenRouter(text, k);
    } catch (e2) {
      return structureLocally(text, `ИИ не ответил. Сделана нумерация. ${(e2 as Error).message}`);
    }
  }
  try {
    return await api.structure(text);
  } catch (e) {
    const msg = (e as Error).message || "";
    if (/not found|404/i.test(msg)) return structureLocally(text);
    return structureLocally(text, msg);
  }
}
