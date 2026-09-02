import type { MaterialType, StructureResult, Subject } from "./types";

const TOKEN = "easy_study_token";

function failMessage(data: { error?: string; detail?: unknown }, status: number) {
  const d = data.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    return d
      .map((x) => (typeof x === "object" && x && "msg" in x ? String((x as { msg: string }).msg) : JSON.stringify(x)))
      .join("; ");
  }
  return data.error || `Ошибка ${status}`;
}

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
  const data = (await res.json()) as T & { error?: string; detail?: unknown };
  if (!res.ok) throw new Error(failMessage(data, res.status));
  return data;
}

function req(url: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  const token = localStorage.getItem(TOKEN);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, credentials: "include", headers });
}

function saveAuth(r: { login?: string; access_token?: string }, fallback: string) {
  if (r.access_token) localStorage.setItem(TOKEN, r.access_token);
  return { login: r.login || fallback };
}

export const api = {
  me: async () => {
    const u = await json<{ login?: string; full_name?: string; email?: string }>(req("/api/auth/me"));
    return { login: u.login || u.full_name || (u.email || "").split("@")[0] };
  },
  register: async (login: string, password: string) => {
    const r = await json<{ login?: string; access_token?: string }>(
      req("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password, full_name: login }),
      }),
    );
    return saveAuth(r, login);
  },
  login: async (login: string, password: string) => {
    const r = await json<{ login?: string; access_token?: string }>(
      req("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      }),
    );
    return saveAuth(r, login);
  },
  logout: async () => {
    localStorage.removeItem(TOKEN);
    try {
      await json<{ ok: boolean }>(req("/api/auth/logout", { method: "POST" }));
    } catch {
      /* token already cleared */
    }
    return { ok: true };
  },
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
