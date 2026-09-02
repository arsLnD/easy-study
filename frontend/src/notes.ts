import { api } from "./api";
import * as persist from "./persist";
import type { MaterialMeta, MaterialType, Subject } from "./types";

let login = "";

export function setNotesLogin(name: string) {
  login = name.trim();
}

function nowIso() {
  return new Date().toISOString();
}

async function persistNow(snap: persist.Snapshot) {
  if (!login) return;
  await persist.saveSnapshot(login, snap);
  try {
    await persist.syncFolder(snap);
  } catch {
    /* папка ещё не выбрана или нет разрешения */
  }
}

function mergeSubjects(local: Subject[], remote: Subject[]) {
  const map = new Map<string, Subject>();
  for (const s of local) map.set(s.id, s);
  for (const s of remote) {
    const prev = map.get(s.id);
    if (!prev) {
      map.set(s.id, s);
      continue;
    }
    const mats = new Map<string, MaterialMeta>();
    for (const m of prev.materials) mats.set(m.id, m);
    for (const m of s.materials) mats.set(m.id, m);
    map.set(s.id, { ...s, materials: [...mats.values()] });
  }
  return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function loadAll() {
  let remote: Subject[] | null = null;
  try {
    remote = await api.subjects();
  } catch {
    remote = null;
  }
  const local = await persist.loadSnapshot(login);
  const subjects = remote ? mergeSubjects(local.subjects, remote) : local.subjects;
  const snap = { subjects, bodies: local.bodies };
  await persistNow(snap);
  return snap;
}

export async function createSubject(name: string) {
  const snap = await persist.loadSnapshot(login);
  let subject: Subject;
  try {
    subject = await api.createSubject(name);
  } catch {
    subject = {
      id: crypto.randomUUID(),
      name: name.trim(),
      createdAt: nowIso(),
      materials: [],
    };
  }
  snap.subjects = mergeSubjects(snap.subjects, [subject]);
  await persistNow(snap);
  return subject;
}

export async function renameSubject(id: string, name: string) {
  const snap = await persist.loadSnapshot(login);
  try {
    await api.renameSubject(id, name);
  } catch {
    /* local only */
  }
  snap.subjects = snap.subjects.map((s) => (s.id === id ? { ...s, name: name.trim() } : s));
  await persistNow(snap);
}

export async function deleteSubject(id: string) {
  const snap = await persist.loadSnapshot(login);
  try {
    await api.deleteSubject(id);
  } catch {
    /* local only */
  }
  const gone = snap.subjects.find((s) => s.id === id);
  for (const m of gone?.materials ?? []) delete snap.bodies[m.id];
  snap.subjects = snap.subjects.filter((s) => s.id !== id);
  await persistNow(snap);
}

export async function createMaterial(subjectId: string, type: MaterialType, title: string, body: string) {
  const snap = await persist.loadSnapshot(login);
  let id = crypto.randomUUID();
  const metaTitle = title.trim() || "Без названия";
  try {
    const created = await api.createMaterial(subjectId, type, title, body);
    id = created.meta.id;
  } catch {
    /* local id */
  }
  const meta: MaterialMeta = {
    id,
    subjectId,
    type,
    title: metaTitle,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  snap.subjects = snap.subjects.map((s) =>
    s.id === subjectId ? { ...s, materials: [...s.materials, meta] } : s,
  );
  snap.bodies[id] = body;
  await persistNow(snap);
}

export async function getMaterial(subjectId: string, id: string) {
  const snap = await persist.loadSnapshot(login);
  try {
    const data = await api.getMaterial(subjectId, id);
    snap.bodies[id] = data.body;
    await persist.saveSnapshot(login, snap);
    return data;
  } catch {
    const sub = snap.subjects.find((s) => s.id === subjectId);
    const meta = sub?.materials.find((m) => m.id === id);
    return { meta: { title: meta?.title || "Без названия" }, body: snap.bodies[id] || "" };
  }
}

export async function updateMaterial(subjectId: string, id: string, patch: { title?: string; body?: string }) {
  const snap = await persist.loadSnapshot(login);
  try {
    await api.updateMaterial(subjectId, id, patch);
  } catch {
    /* local only */
  }
  if (patch.body !== undefined) snap.bodies[id] = patch.body;
  snap.subjects = snap.subjects.map((s) =>
    s.id !== subjectId
      ? s
      : {
          ...s,
          materials: s.materials.map((m) =>
            m.id === id
              ? {
                  ...m,
                  title: patch.title?.trim() || m.title,
                  updatedAt: nowIso(),
                }
              : m,
          ),
        },
  );
  await persistNow(snap);
}

export async function deleteMaterial(subjectId: string, id: string) {
  const snap = await persist.loadSnapshot(login);
  try {
    await api.deleteMaterial(subjectId, id);
  } catch {
    /* local only */
  }
  delete snap.bodies[id];
  snap.subjects = snap.subjects.map((s) =>
    s.id === subjectId ? { ...s, materials: s.materials.filter((m) => m.id !== id) } : s,
  );
  await persistNow(snap);
}

export async function chooseSaveFolder() {
  const snap = await persist.loadSnapshot(login);
  const root = await persist.pickFolder();
  await persist.writeToHandle(root, snap);
  return { name: root.name, count: persist.filesFromSnapshot(snap).length };
}

export async function writeChosenFolder() {
  const snap = await persist.loadSnapshot(login);
  const n = await persist.syncFolder(snap);
  if (!n && !(await persist.getFolderName())) {
    throw new Error("Сначала выбери папку в настройках.");
  }
  return n;
}
