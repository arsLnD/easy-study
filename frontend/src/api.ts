import type { MaterialType, StructureResult, Subject } from "./types";

async function json<T>(input: Response | Promise<Response>): Promise<T> {
  let res: Response;
  try {
    res = await input;
  } catch (e) {
    const msg = (e as Error).message || String(e);
    if (/terminated|abort|timeout/i.test(msg)) {
      throw new Error("Соединение с ИИ оборвалось. Нажми ещё раз.");
    }
    throw e instanceof Error ? e : new Error(msg);
  }
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
  return data;
}

function req(url: string, init?: RequestInit) {
  return fetch(url, { credentials: "include", ...init });
}

export const api = {
  me: () => json<{ login: string }>(req("/api/auth/me")),
  register: (login: string, password: string) =>
    json<{ login: string }>(
      req("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      }),
    ),
  login: (login: string, password: string) =>
    json<{ login: string }>(
      req("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      }),
    ),
  logout: () => json<{ ok: boolean }>(req("/api/auth/logout", { method: "POST" })),
  exportBundle: () => json<{ files: { relativePath: string; body: string }[] }>(req("/api/export-bundle")),
  exportLocal: () => json<{ dest: string; count: number }>(req("/api/export-local", { method: "POST" })),
  settings: () =>
    json<{ hasKey: boolean; deepseekApiKey: string; openRouterApiKey?: string }>(
      req("/api/settings"),
    ),
  saveSettings: (deepseekApiKey: string) =>
    json<{ ok: boolean; hasKey: boolean }>(
      req("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deepseekApiKey }),
      }),
    ),
  subjects: () => json<Subject[]>(req("/api/subjects")),
  createSubject: (name: string) =>
    json<Subject>(
      req("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }),
    ),
  renameSubject: (id: string, name: string) =>
    json<Subject>(
      req(`/api/subjects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }),
    ),
  deleteSubject: (id: string) =>
    json<{ ok: boolean }>(req(`/api/subjects/${id}`, { method: "DELETE" })),
  createMaterial: (subjectId: string, type: MaterialType, title: string, body: string) =>
    json<{ meta: { id: string }; body: string }>(
      req(`/api/subjects/${subjectId}/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, title, body }),
      }),
    ),
  getMaterial: (subjectId: string, id: string) =>
    json<{ meta: { title: string }; body: string }>(
      req(`/api/subjects/${subjectId}/materials/${id}`),
    ),
  updateMaterial: (subjectId: string, id: string, patch: { title?: string; body?: string }) =>
    json<{ meta: { title: string }; body: string }>(
      req(`/api/subjects/${subjectId}/materials/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }),
    ),
  deleteMaterial: (subjectId: string, id: string) =>
    json<{ ok: boolean }>(
      req(`/api/subjects/${subjectId}/materials/${id}`, { method: "DELETE" }),
    ),
  structure: (text: string) =>
    json<StructureResult>(
      req("/api/ai/structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(110_000),
      }),
    ),
};
