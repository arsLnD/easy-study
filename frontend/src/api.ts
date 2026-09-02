import type { MaterialType, StructureResult, Subject } from "./types";

const TOKEN = "easy_study_token";
const REFRESH = "easy_study_refresh";

function failMessage(data: { error?: string; detail?: unknown }, status: number) {
  const d = data.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    return d
      .map((x) => {
        if (typeof x !== "object" || !x) return JSON.stringify(x);
        const loc = "loc" in x ? (x as { loc: unknown[] }).loc.filter((p) => p !== "body").join(".") : "";
        const msg = "msg" in x ? String((x as { msg: string }).msg) : JSON.stringify(x);
        return loc ? `${loc}: ${msg}` : msg;
      })
      .join("; ");
  }
  return data.error || `Ошибка ${status}`;
}

async function refreshAccess() {
  const refresh_token = localStorage.getItem(REFRESH);
  if (!refresh_token) return false;
  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { access_token?: string; refresh_token?: string };
  if (!data.access_token) return false;
  localStorage.setItem(TOKEN, data.access_token);
  if (data.refresh_token) localStorage.setItem(REFRESH, data.refresh_token);
  return true;
}

function req(url: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  const token = localStorage.getItem(TOKEN);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, credentials: "include", headers });
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await req(url, init);
    if (res.status === 401 && (await refreshAccess())) {
      res = await req(url, init);
    }
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

function accountPayload(login: string, password: string) {
  const local = login
    .trim()
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
  if (local.length < 3) {
    throw new Error("Логин: минимум 3 латинских буквы/цифры, без пробелов и без @");
  }
  if (password.length < 8) {
    throw new Error("Пароль минимум 8 символов");
  }
  return {
    login: local,
    email: `${local}@easy-study.app`,
    password,
    full_name: local,
  };
}

function saveAuth(
  r: { login?: string; access_token?: string; refresh_token?: string },
  fallback: string,
) {
  if (r.access_token) localStorage.setItem(TOKEN, r.access_token);
  if (r.refresh_token) localStorage.setItem(REFRESH, r.refresh_token);
  return { login: r.login || fallback };
}

const jsonHeaders = { "Content-Type": "application/json" };

export const api = {
  me: async () => {
    const u = await json<{ login?: string; full_name?: string; email?: string }>("/api/auth/me");
    return { login: u.login || u.full_name || (u.email || "").split("@")[0] };
  },
  register: async (login: string, password: string) => {
    const r = await json<{ login?: string; access_token?: string; refresh_token?: string }>(
      "/api/auth/register",
      {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(accountPayload(login, password)),
      },
    );
    return saveAuth(r, login);
  },
  login: async (login: string, password: string) => {
    const r = await json<{ login?: string; access_token?: string; refresh_token?: string }>(
      "/api/auth/login",
      {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(accountPayload(login, password)),
      },
    );
    return saveAuth(r, login);
  },
  logout: async () => {
    localStorage.removeItem(TOKEN);
    localStorage.removeItem(REFRESH);
    try {
      await json<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
    } catch {
      /* token already cleared */
    }
    return { ok: true };
  },
  exportBundle: () => json<{ files: { relativePath: string; body: string }[] }>("/api/export-bundle"),
  exportLocal: () => json<{ dest: string; count: number }>("/api/export-local", { method: "POST" }),
  settings: () =>
    json<{ hasKey: boolean; deepseekApiKey: string; openRouterApiKey?: string }>("/api/settings"),
  saveSettings: (deepseekApiKey: string) =>
    json<{ ok: boolean; hasKey: boolean }>("/api/settings", {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify({ deepseekApiKey, openRouterApiKey: deepseekApiKey }),
    }),
  subjects: () => json<Subject[]>("/api/subjects"),
  createSubject: (name: string) =>
    json<Subject>("/api/subjects", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ name }),
    }),
  renameSubject: (id: string, name: string) =>
    json<Subject>(`/api/subjects/${id}`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ name }),
    }),
  deleteSubject: (id: string) => json<{ ok: boolean }>(`/api/subjects/${id}`, { method: "DELETE" }),
  createMaterial: (subjectId: string, type: MaterialType, title: string, body: string) =>
    json<{ meta: { id: string }; body: string }>(`/api/subjects/${subjectId}/materials`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ type, title, body }),
    }),
  getMaterial: (subjectId: string, id: string) =>
    json<{ meta: { title: string }; body: string }>(`/api/subjects/${subjectId}/materials/${id}`),
  updateMaterial: (subjectId: string, id: string, patch: { title?: string; body?: string }) =>
    json<{ meta: { title: string }; body: string }>(`/api/subjects/${subjectId}/materials/${id}`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify(patch),
    }),
  deleteMaterial: (subjectId: string, id: string) =>
    json<{ ok: boolean }>(`/api/subjects/${subjectId}/materials/${id}`, { method: "DELETE" }),
  structure: (text: string) =>
    json<StructureResult>("/api/ai/structure", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(110_000),
    }),
};
