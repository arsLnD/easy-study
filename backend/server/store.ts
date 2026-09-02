import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, "..", "data");
const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");
export const LOCAL_FOLDER = path.join(__dirname, "..", "локальные-конспекты");

export type MaterialType = "lecture" | "exercise" | "lab";

export type MaterialMeta = {
  id: string;
  subjectId: string;
  type: MaterialType;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type Subject = {
  id: string;
  name: string;
  createdAt: string;
  materials: MaterialMeta[];
};

export type Settings = {
  openRouterApiKey: string;
  deepseekApiKey?: string;
};

type StoreFile = {
  subjects: Subject[];
};

const TYPE_FOLDER: Record<MaterialType, string> = {
  lecture: "лекция",
  exercise: "упражнение",
  lab: "лабораторная",
};

function userDir(userId: string) {
  return path.join(DATA_DIR, "users", userId);
}

function subjectsPath(userId: string) {
  return path.join(userDir(userId), "subjects.json");
}

function materialPath(userId: string, subjectId: string, type: MaterialType, id: string) {
  return path.join(userDir(userId), "materials", subjectId, type, `${id}.txt`);
}

async function ensureGlobal() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(SETTINGS_PATH);
  } catch {
    await fs.writeFile(
      SETTINGS_PATH,
      JSON.stringify({ openRouterApiKey: "" } satisfies Settings, null, 2),
      "utf8",
    );
  }
}

async function ensureUser(userId: string) {
  await ensureGlobal();
  await fs.mkdir(userDir(userId), { recursive: true });
  try {
    await fs.access(subjectsPath(userId));
  } catch {
    await fs.writeFile(
      subjectsPath(userId),
      JSON.stringify({ subjects: [] } satisfies StoreFile, null, 2),
      "utf8",
    );
  }
}

async function readStore(userId: string): Promise<StoreFile> {
  await ensureUser(userId);
  const raw = await fs.readFile(subjectsPath(userId), "utf8");
  return JSON.parse(raw) as StoreFile;
}

async function writeStore(userId: string, store: StoreFile) {
  await ensureUser(userId);
  await fs.writeFile(subjectsPath(userId), JSON.stringify(store, null, 2), "utf8");
}

export async function migrateLegacyIfNeeded(userId: string) {
  await ensureUser(userId);
  const store = await readStore(userId);
  if (store.subjects.length > 0) return;
  const legacySubjects = path.join(DATA_DIR, "subjects.json");
  try {
    const raw = await fs.readFile(legacySubjects, "utf8");
    const legacy = JSON.parse(raw) as StoreFile;
    if (!legacy.subjects?.length) return;
    const marker = path.join(DATA_DIR, ".legacy-migrated");
    try {
      await fs.access(marker);
      return;
    } catch {
      /* first account gets old notes */
    }
    for (const sub of legacy.subjects) {
      for (const m of sub.materials) {
        const from = path.join(DATA_DIR, "materials", m.subjectId, m.type, `${m.id}.txt`);
        const to = materialPath(userId, m.subjectId, m.type, m.id);
        try {
          await fs.mkdir(path.dirname(to), { recursive: true });
          await fs.copyFile(from, to);
        } catch {
          /* skip missing */
        }
      }
    }
    await writeStore(userId, legacy);
    await fs.writeFile(marker, userId, "utf8");
  } catch {
    /* no legacy */
  }
}

export async function getSettings(): Promise<Settings> {
  await ensureGlobal();
  const raw = await fs.readFile(SETTINGS_PATH, "utf8");
  const parsed = JSON.parse(raw) as Partial<Settings> & { deepseekApiKey?: string };
  const openRouterApiKey =
    parsed.openRouterApiKey ||
    (parsed.deepseekApiKey?.startsWith("sk-or-") ? parsed.deepseekApiKey : "") ||
    "";
  return { openRouterApiKey, deepseekApiKey: parsed.deepseekApiKey };
}

export async function saveSettings(settings: Settings) {
  await ensureGlobal();
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf8");
}

export async function listSubjects(userId: string): Promise<Subject[]> {
  const store = await readStore(userId);
  return store.subjects;
}

export async function createSubject(userId: string, name: string): Promise<Subject> {
  const store = await readStore(userId);
  const subject: Subject = {
    id: randomUUID(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
    materials: [],
  };
  store.subjects.push(subject);
  await writeStore(userId, store);
  return subject;
}

export async function renameSubject(userId: string, id: string, name: string): Promise<Subject> {
  const store = await readStore(userId);
  const subject = store.subjects.find((s) => s.id === id);
  if (!subject) throw new Error("Предмет не найден");
  subject.name = name.trim();
  await writeStore(userId, store);
  return subject;
}

export async function deleteSubject(userId: string, id: string) {
  const store = await readStore(userId);
  store.subjects = store.subjects.filter((s) => s.id !== id);
  await writeStore(userId, store);
  await fs.rm(path.join(userDir(userId), "materials", id), { recursive: true, force: true });
}

export async function createMaterial(
  userId: string,
  input: {
    subjectId: string;
    type: MaterialType;
    title: string;
    body: string;
  },
): Promise<{ meta: MaterialMeta; body: string }> {
  const store = await readStore(userId);
  const subject = store.subjects.find((s) => s.id === input.subjectId);
  if (!subject) throw new Error("Предмет не найден");
  const now = new Date().toISOString();
  const meta: MaterialMeta = {
    id: randomUUID(),
    subjectId: input.subjectId,
    type: input.type,
    title: input.title.trim() || "Без названия",
    createdAt: now,
    updatedAt: now,
  };
  const file = materialPath(userId, meta.subjectId, meta.type, meta.id);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, input.body, "utf8");
  subject.materials.push(meta);
  await writeStore(userId, store);
  return { meta, body: input.body };
}

export async function readMaterial(userId: string, subjectId: string, id: string) {
  const store = await readStore(userId);
  const subject = store.subjects.find((s) => s.id === subjectId);
  const meta = subject?.materials.find((m) => m.id === id);
  if (!subject || !meta) throw new Error("Материал не найден");
  const body = await fs.readFile(materialPath(userId, subjectId, meta.type, id), "utf8");
  return { meta, body };
}

export async function updateMaterial(
  userId: string,
  input: {
    subjectId: string;
    id: string;
    title?: string;
    body?: string;
  },
) {
  const store = await readStore(userId);
  const subject = store.subjects.find((s) => s.id === input.subjectId);
  const meta = subject?.materials.find((m) => m.id === input.id);
  if (!subject || !meta) throw new Error("Материал не найден");
  if (input.title !== undefined) meta.title = input.title.trim() || "Без названия";
  meta.updatedAt = new Date().toISOString();
  if (input.body !== undefined) {
    const file = materialPath(userId, meta.subjectId, meta.type, meta.id);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, input.body, "utf8");
  }
  await writeStore(userId, store);
  const body = await fs.readFile(materialPath(userId, meta.subjectId, meta.type, meta.id), "utf8");
  return { meta, body };
}

export async function deleteMaterial(userId: string, subjectId: string, id: string) {
  const store = await readStore(userId);
  const subject = store.subjects.find((s) => s.id === subjectId);
  if (!subject) throw new Error("Предмет не найден");
  const meta = subject.materials.find((m) => m.id === id);
  subject.materials = subject.materials.filter((m) => m.id !== id);
  await writeStore(userId, store);
  if (meta) {
    await fs.rm(materialPath(userId, subjectId, meta.type, id), { force: true });
  }
}

function safeName(name: string) {
  return name.replace(/[<>:"/\\|?*]+/g, " ").trim().slice(0, 80) || "file";
}

export type ExportFile = {
  relativePath: string;
  body: string;
};

export async function collectExport(userId: string): Promise<ExportFile[]> {
  const store = await readStore(userId);
  const files: ExportFile[] = [];
  for (const sub of store.subjects) {
    const subName = safeName(sub.name);
    for (const m of sub.materials) {
      let body = "";
      try {
        body = await fs.readFile(materialPath(userId, sub.id, m.type, m.id), "utf8");
      } catch {
        continue;
      }
      const md = `# ${m.title}\n\n${body.trim()}\n`;
      files.push({
        relativePath: path.posix.join(subName, TYPE_FOLDER[m.type], `${safeName(m.title)}.md`),
        body: md,
      });
    }
  }
  return files;
}

export async function writeLocalFolder(userId: string, login: string) {
  const dest = path.join(LOCAL_FOLDER, safeName(login));
  await fs.rm(dest, { recursive: true, force: true });
  const files = await collectExport(userId);
  for (const f of files) {
    const full = path.join(dest, f.relativePath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, f.body, "utf8");
  }
  return { dest, count: files.length };
}
