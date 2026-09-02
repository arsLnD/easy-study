import type { MaterialType, Subject } from "./types";

const TYPE_FOLDER: Record<MaterialType, string> = {
  lecture: "лекция",
  exercise: "упражнение",
  lab: "лабораторная",
};

export type Snapshot = {
  subjects: Subject[];
  bodies: Record<string, string>;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("easy-study-v1", 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("kv")) req.result.createObjectStore("kv");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const d = await openDb();
  return new Promise((resolve, reject) => {
    const r = d.transaction("kv", "readonly").objectStore("kv").get(key);
    r.onsuccess = () => resolve(r.result as T | undefined);
    r.onerror = () => reject(r.error);
  });
}

async function idbSet(key: string, value: unknown) {
  const d = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = d.transaction("kv", "readwrite");
    tx.objectStore("kv").put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function snapKey(login: string) {
  return `snap:${login.trim().toLowerCase()}`;
}

export async function loadSnapshot(login: string): Promise<Snapshot> {
  const fromIdb = await idbGet<Snapshot>(snapKey(login));
  if (fromIdb?.subjects?.length) return fromIdb;
  try {
    const raw = localStorage.getItem(`easy-study-snap:${login.trim().toLowerCase()}`);
    if (raw) return JSON.parse(raw) as Snapshot;
  } catch {
    /* ignore */
  }
  return fromIdb ?? { subjects: [], bodies: {} };
}

export async function saveSnapshot(login: string, snap: Snapshot) {
  await idbSet(snapKey(login), snap);
  try {
    localStorage.setItem(`easy-study-snap:${login.trim().toLowerCase()}`, JSON.stringify(snap));
  } catch {
    /* quota */
  }
}

export async function saveFolderHandle(handle: FileSystemDirectoryHandle) {
  await idbSet("folderHandle", handle);
  await idbSet("folderName", handle.name);
}

export async function getFolderName() {
  return (await idbGet<string>("folderName")) || "";
}

export async function getFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  const handle = await idbGet<FileSystemDirectoryHandle>("folderHandle");
  if (!handle) return null;
  const query = await handle.queryPermission({ mode: "readwrite" });
  if (query === "granted") return handle;
  const next = await handle.requestPermission({ mode: "readwrite" });
  return next === "granted" ? handle : null;
}

export async function pickFolder() {
  const picker = (window as Window & {
    showDirectoryPicker?: (o: { mode: string }) => Promise<FileSystemDirectoryHandle>;
  }).showDirectoryPicker;
  if (!picker) {
    throw new Error("Выбор папки работает в Chrome / Opera GX / Edge.");
  }
  const root = await picker({ mode: "readwrite" });
  await saveFolderHandle(root);
  return root;
}

function safeName(name: string) {
  return name.replace(/[<>:"/\\|?*]+/g, " ").trim().slice(0, 80) || "file";
}

export function filesFromSnapshot(snap: Snapshot) {
  const files = [{ relativePath: "easy-study.json", body: JSON.stringify(snap, null, 2) }];
  for (const sub of snap.subjects) {
    for (const m of sub.materials) {
      const body = snap.bodies[m.id] ?? "";
      files.push({
        relativePath: `${safeName(sub.name)}/${TYPE_FOLDER[m.type]}/${safeName(m.title)}.md`,
        body: `# ${m.title}\n\n${body.trim()}\n`,
      });
    }
  }
  return files;
}

export async function writeToHandle(root: FileSystemDirectoryHandle, snap: Snapshot) {
  for (const file of filesFromSnapshot(snap)) {
    const parts = file.relativePath.split("/");
    let dir = root;
    for (const part of parts.slice(0, -1)) {
      dir = await dir.getDirectoryHandle(part, { create: true });
    }
    const fh = await dir.getFileHandle(parts[parts.length - 1]!, { create: true });
    const writable = await fh.createWritable();
    await writable.write(file.body);
    await writable.close();
  }
}

export async function syncFolder(snap: Snapshot) {
  const handle = await getFolderHandle();
  if (!handle) return 0;
  await writeToHandle(handle, snap);
  return filesFromSnapshot(snap).length;
}
