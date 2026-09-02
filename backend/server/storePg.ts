import { randomUUID } from "node:crypto";
import { getPool } from "./db.ts";
import type { MaterialMeta, MaterialType, Settings, Subject } from "./store.ts";

function mapSubject(row: {
  id: string;
  name: string;
  created_at: Date;
  materials: MaterialMeta[] | null;
}): Subject {
  return {
    id: row.id,
    name: row.name,
    createdAt: new Date(row.created_at).toISOString(),
    materials: row.materials ?? [],
  };
}

export async function getSettings(): Promise<Settings> {
  const r = await getPool().query("SELECT openrouter_key FROM study_settings WHERE id = 1");
  const key = r.rows[0]?.openrouter_key ?? "";
  return { openRouterApiKey: key };
}

export async function saveSettings(settings: Settings) {
  await getPool().query(
    "INSERT INTO study_settings (id, openrouter_key) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET openrouter_key = $1",
    [settings.openRouterApiKey],
  );
}

export async function listSubjects(userId: string): Promise<Subject[]> {
  const subs = await getPool().query(
    "SELECT id, name, created_at FROM study_subjects WHERE user_id = $1 ORDER BY created_at",
    [userId],
  );
  const mats = await getPool().query(
    `SELECT id, subject_id, type, title, created_at, updated_at
     FROM study_materials WHERE user_id = $1`,
    [userId],
  );
  return subs.rows.map((s) => ({
    id: s.id,
    name: s.name,
    createdAt: new Date(s.created_at).toISOString(),
    materials: mats.rows
      .filter((m) => m.subject_id === s.id)
      .map((m) => ({
        id: m.id,
        subjectId: m.subject_id,
        type: m.type as MaterialType,
        title: m.title,
        createdAt: new Date(m.created_at).toISOString(),
        updatedAt: new Date(m.updated_at).toISOString(),
      })),
  }));
}

export async function createSubject(userId: string, name: string): Promise<Subject> {
  const id = randomUUID();
  const r = await getPool().query(
    "INSERT INTO study_subjects (id, user_id, name) VALUES ($1,$2,$3) RETURNING created_at",
    [id, userId, name.trim()],
  );
  return { id, name: name.trim(), createdAt: new Date(r.rows[0].created_at).toISOString(), materials: [] };
}

export async function renameSubject(userId: string, id: string, name: string): Promise<Subject> {
  const r = await getPool().query(
    "UPDATE study_subjects SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING created_at",
    [name.trim(), id, userId],
  );
  if (!r.rowCount) throw new Error("Предмет не найден");
  const list = await listSubjects(userId);
  const s = list.find((x) => x.id === id);
  if (!s) throw new Error("Предмет не найден");
  return s;
}

export async function deleteSubject(userId: string, id: string) {
  const r = await getPool().query("DELETE FROM study_subjects WHERE id = $1 AND user_id = $2", [id, userId]);
  if (!r.rowCount) throw new Error("Предмет не найден");
}

export async function createMaterial(
  userId: string,
  input: { subjectId: string; type: MaterialType; title: string; body: string },
) {
  const id = randomUUID();
  const title = input.title.trim() || "Без названия";
  const r = await getPool().query(
    `INSERT INTO study_materials (id, user_id, subject_id, type, title, body)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING created_at, updated_at`,
    [id, userId, input.subjectId, input.type, title, input.body],
  );
  const meta: MaterialMeta = {
    id,
    subjectId: input.subjectId,
    type: input.type,
    title,
    createdAt: new Date(r.rows[0].created_at).toISOString(),
    updatedAt: new Date(r.rows[0].updated_at).toISOString(),
  };
  return { meta, body: input.body };
}

export async function readMaterial(userId: string, subjectId: string, id: string) {
  const r = await getPool().query(
    `SELECT id, subject_id, type, title, body, created_at, updated_at
     FROM study_materials WHERE id = $1 AND user_id = $2 AND subject_id = $3`,
    [id, userId, subjectId],
  );
  if (!r.rows[0]) throw new Error("Материал не найден");
  const m = r.rows[0];
  return {
    meta: {
      id: m.id,
      subjectId: m.subject_id,
      type: m.type as MaterialType,
      title: m.title,
      createdAt: new Date(m.created_at).toISOString(),
      updatedAt: new Date(m.updated_at).toISOString(),
    },
    body: m.body as string,
  };
}

export async function updateMaterial(
  userId: string,
  input: { subjectId: string; id: string; title?: string; body?: string },
) {
  const cur = await readMaterial(userId, input.subjectId, input.id);
  const title = input.title !== undefined ? input.title.trim() || "Без названия" : cur.meta.title;
  const body = input.body !== undefined ? input.body : cur.body;
  await getPool().query(
    `UPDATE study_materials SET title = $1, body = $2, updated_at = NOW()
     WHERE id = $3 AND user_id = $4`,
    [title, body, input.id, userId],
  );
  return readMaterial(userId, input.subjectId, input.id);
}

export async function deleteMaterial(userId: string, subjectId: string, id: string) {
  const r = await getPool().query(
    "DELETE FROM study_materials WHERE id = $1 AND user_id = $2 AND subject_id = $3",
    [id, userId, subjectId],
  );
  if (!r.rowCount) throw new Error("Материал не найден");
}

export async function migrateLegacyIfNeeded(_userId: string) {
  /* postgres: nothing */
}

const TYPE_FOLDER: Record<MaterialType, string> = {
  lecture: "лекция",
  exercise: "упражнение",
  lab: "лабораторная",
};

function safeName(name: string) {
  return name.replace(/[<>:"/\\|?*]+/g, " ").trim().slice(0, 80) || "file";
}

export async function collectExport(userId: string) {
  const subjects = await listSubjects(userId);
  const files: { relativePath: string; body: string }[] = [];
  for (const sub of subjects) {
    for (const m of sub.materials) {
      const full = await readMaterial(userId, sub.id, m.id);
      files.push({
        relativePath: `${safeName(sub.name)}/${TYPE_FOLDER[m.type]}/${safeName(m.title)}.md`,
        body: `# ${m.title}\n\n${full.body.trim()}\n`,
      });
    }
  }
  return files;
}

export async function writeLocalFolder(_userId: string, _login: string) {
  throw new Error("На облачном хосте папка ПК недоступна. Нажми «Выбрать папку…» в браузере.");
}
