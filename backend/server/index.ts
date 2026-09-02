import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import {
  collectExport,
  createMaterial,
  createSubject,
  deleteMaterial,
  deleteSubject,
  getSettings,
  listSubjects,
  migrateLegacyIfNeeded,
  readMaterial,
  renameSubject,
  saveSettings,
  updateMaterial,
  writeLocalFolder,
  type MaterialType,
} from "./store.ts";
import * as pgStore from "./storePg.ts";
import { hasDatabase, initSchema } from "./db.ts";
import { structureWithOpenRouter } from "./ai.ts";
import {
  clearSessionCookie,
  createSession,
  destroySession,
  loginUser,
  readSid,
  registerUser,
  setSessionCookie,
  userFromRequest,
} from "./auth.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "8mb" }));

const fileStore = {
  collectExport,
  createMaterial,
  createSubject,
  deleteMaterial,
  deleteSubject,
  getSettings,
  listSubjects,
  migrateLegacyIfNeeded,
  readMaterial,
  renameSubject,
  saveSettings,
  updateMaterial,
  writeLocalFolder,
};

function store() {
  return hasDatabase() ? pgStore : fileStore;
}

const TYPES = new Set<MaterialType>(["lecture", "exercise", "lab"]);

app.get("/api/health", async (_req, res) => {
  res.json({ ok: true, db: hasDatabase() });
});

async function requireUser(
  req: express.Request,
  res: express.Response,
): Promise<{ id: string; login: string } | null> {
  const user = await userFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Нужно войти" });
    return null;
  }
  await store().migrateLegacyIfNeeded(user.id);
  return user;
}

app.post("/api/auth/register", async (req, res) => {
  try {
    const user = await registerUser(String(req.body?.login ?? ""), String(req.body?.password ?? ""));
    await store().migrateLegacyIfNeeded(user.id);
    const sid = await createSession(user.id);
    setSessionCookie(res, sid);
    res.status(201).json({ login: user.login });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const user = await loginUser(String(req.body?.login ?? ""), String(req.body?.password ?? ""));
    await store().migrateLegacyIfNeeded(user.id);
    const sid = await createSession(user.id);
    setSessionCookie(res, sid);
    res.json({ login: user.login });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.post("/api/auth/logout", async (req, res) => {
  await destroySession(readSid(req));
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get("/api/auth/me", async (req, res) => {
  const user = await userFromRequest(req);
  if (!user) return res.status(401).json({ error: "Нужно войти" });
  res.json({ login: user.login });
});

app.get("/api/settings", async (req, res) => {
  if (!(await requireUser(req, res))) return;
  const s = await store().getSettings();
  res.json({
    hasKey: Boolean(s.openRouterApiKey),
    openRouterApiKey: s.openRouterApiKey,
    deepseekApiKey: s.openRouterApiKey,
  });
});

app.put("/api/settings", async (req, res) => {
  if (!(await requireUser(req, res))) return;
  const openRouterApiKey = String(
    req.body?.openRouterApiKey ?? req.body?.deepseekApiKey ?? "",
  );
  await store().saveSettings({ openRouterApiKey });
  res.json({ ok: true, hasKey: Boolean(openRouterApiKey) });
});

app.get("/api/subjects", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  res.json(await store().listSubjects(user.id));
});

app.post("/api/subjects", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const name = String(req.body?.name ?? "").trim();
  if (!name) return res.status(400).json({ error: "Укажи название предмета" });
  res.status(201).json(await store().createSubject(user.id, name));
});

app.patch("/api/subjects/:id", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const name = String(req.body?.name ?? "").trim();
    if (!name) return res.status(400).json({ error: "Укажи название предмета" });
    res.json(await store().renameSubject(user.id, req.params.id, name));
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
});

app.delete("/api/subjects/:id", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  await store().deleteSubject(user.id, req.params.id);
  res.json({ ok: true });
});

app.post("/api/subjects/:subjectId/materials", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const type = req.body?.type as MaterialType;
    if (!TYPES.has(type)) return res.status(400).json({ error: "Неверный тип" });
    const title = String(req.body?.title ?? "Без названия");
    const body = String(req.body?.body ?? "");
    const created = await store().createMaterial(user.id, {
      subjectId: req.params.subjectId,
      type,
      title,
      body,
    });
    res.status(201).json(created);
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
});

app.get("/api/subjects/:subjectId/materials/:id", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    res.json(await store().readMaterial(user.id, req.params.subjectId, req.params.id));
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
});

app.patch("/api/subjects/:subjectId/materials/:id", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    res.json(
      await store().updateMaterial(user.id, {
        subjectId: req.params.subjectId,
        id: req.params.id,
        title: req.body?.title !== undefined ? String(req.body.title) : undefined,
        body: req.body?.body !== undefined ? String(req.body.body) : undefined,
      }),
    );
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
});

app.delete("/api/subjects/:subjectId/materials/:id", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    await store().deleteMaterial(user.id, req.params.subjectId, req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
});

app.get("/api/export-bundle", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  res.json({ files: await store().collectExport(user.id) });
});

app.post("/api/export-local", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const result = await store().writeLocalFolder(user.id, user.login);
  res.json(result);
});

app.post("/api/ai/structure", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const original = String(req.body?.text ?? "");
  if (!original.trim()) return res.status(400).json({ error: "Пустой текст" });
  const settings = await store().getSettings();
  if (!settings.openRouterApiKey) {
    return res.status(400).json({
      error: "Нет ключа OpenRouter",
      code: "NO_KEY",
    });
  }
  try {
    const result = await structureWithOpenRouter(settings.openRouterApiKey, original);
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: (e as Error).message });
  }
});

const dist = path.join(__dirname, "..", "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(dist, "index.html"));
  });
}

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, "0.0.0.0", async () => {
  if (hasDatabase()) {
    await initSchema();
    if (process.env.OPENROUTER_API_KEY) {
      await pgStore.saveSettings({ openRouterApiKey: process.env.OPENROUTER_API_KEY });
    }
    console.log("PostgreSQL study_* tables ready");
  }
  console.log(`Сервер http://127.0.0.1:${PORT}`);
});
