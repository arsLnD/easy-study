import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { downloadLecture, previewDocumentHtml } from "./exportLecture";
import type { MaterialMeta, MaterialType, StructureResult, Subject } from "./types";

const TABS: { id: MaterialType; label: string }[] = [
  { id: "lecture", label: "Лекция" },
  { id: "exercise", label: "Упражнение" },
  { id: "lab", label: "Лабораторная работа" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU");
}

async function saveBundleToFolder() {
  const picker = (window as Window & {
    showDirectoryPicker?: (o: { mode: string }) => Promise<FileSystemDirectoryHandle>;
  }).showDirectoryPicker;
  if (!picker) {
    throw new Error("Этот браузер не умеет писать в папку. Используй «На этот ПК».");
  }
  const root = await picker({ mode: "readwrite" });
  const bundle = await api.exportBundle();
  for (const file of bundle.files) {
    const parts = file.relativePath.split("/");
    let dir = root;
    for (const part of parts.slice(0, -1)) {
      dir = await dir.getDirectoryHandle(part, { create: true });
    }
    const handle = await dir.getFileHandle(parts[parts.length - 1]!, { create: true });
    const writable = await handle.createWritable();
    await writable.write(file.body);
    await writable.close();
  }
  return bundle.files.length;
}

export function App() {
  const [loginName, setLoginName] = useState<string | null>(null);
  const [authLogin, setAuthLogin] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<MaterialType>("lecture");
  const [newName, setNewName] = useState("");
  const [view, setView] = useState<"list" | "editor" | "settings">("list");
  const [openId, setOpenId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const selected = subjects.find((s) => s.id === selectedId) ?? null;
  const materials = useMemo(
    () =>
      (selected?.materials ?? [])
        .filter((m) => m.type === tab)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [selected, tab],
  );

  async function reload() {
    const list = await api.subjects();
    setSubjects(list);
    setSelectedId((id) => (id && list.some((s) => s.id === id) ? id : list[0]?.id ?? null));
  }

  async function afterLogin(name: string) {
    setLoginName(name);
    setError("");
    await reload();
    const s = await api.settings();
    setHasKey(s.hasKey);
    setApiKey(s.openRouterApiKey || s.deepseekApiKey);
  }

  useEffect(() => {
    void (async () => {
      try {
        const me = await api.me();
        await afterLogin(me.login);
      } catch {
        setLoginName(null);
      }
    })();
  }, []);

  async function addSubject() {
    if (!newName.trim()) return;
    try {
      setError("");
      const s = await api.createSubject(newName);
      setNewName("");
      await reload();
      setSelectedId(s.id);
      setView("list");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function openMaterial(m: MaterialMeta) {
    const data = await api.getMaterial(m.subjectId, m.id);
    setOpenId(m.id);
    setTitle(data.meta.title);
    setBody(data.body);
    setView("editor");
  }

  async function saveMaterial() {
    if (!selected || !openId) return;
    await api.updateMaterial(selected.id, openId, { title, body });
    await reload();
  }

  async function submitAuth(kind: "login" | "register") {
    setAuthBusy(true);
    setError("");
    try {
      const fn = kind === "login" ? api.login : api.register;
      const r = await fn(authLogin, authPass);
      await afterLogin(r.login);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAuthBusy(false);
    }
  }

  if (!loginName) {
    return (
      <div className="auth-screen">
        <form
          className="auth-box"
          onSubmit={(e) => {
            e.preventDefault();
            void submitAuth("login");
          }}
        >
          <h1>Easy Study</h1>
          <p className="muted">Войди или зарегистрируйся. Данные каждого логина хранятся отдельно.</p>
          {error && <p className="warn">{error}</p>}
          <input
            placeholder="Логин"
            value={authLogin}
            onChange={(e) => setAuthLogin(e.target.value)}
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="Пароль"
            value={authPass}
            onChange={(e) => setAuthPass(e.target.value)}
            autoComplete="current-password"
          />
          <div className="toolbar">
            <button className="primary" type="submit" disabled={authBusy}>
              Войти
            </button>
            <button type="button" disabled={authBusy} onClick={() => void submitAuth("register")}>
              Регистрация
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">Easy Study</div>
        <div className="muted" style={{ fontSize: 13 }}>
          {loginName}
        </div>
        <div className="new-row">
          <input
            placeholder="Новый предмет"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void addSubject();
            }}
          />
          <button className="primary" type="button" onClick={() => void addSubject()}>
            +
          </button>
        </div>
        <ul className="subject-list">
          {subjects.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={`item ${s.id === selectedId ? "active" : ""}`}
                onClick={() => {
                  setSelectedId(s.id);
                  setView("list");
                  setOpenId(null);
                }}
              >
                {s.name}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="ghost"
          onClick={() => setView("settings")}
          style={{ marginTop: "auto" }}
        >
          Настройки ИИ
        </button>
        <button
          type="button"
          className="ghost"
          onClick={async () => {
            try {
              await api.logout();
              setLoginName(null);
              setSubjects([]);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Выйти
        </button>
      </aside>

      <main className="main">
        {error && <p className="warn">{error}</p>}

        {view === "settings" && (
          <section className="settings">
            <h1>Настройки</h1>
            <p className="muted">
              Ключ OpenRouter общий для сервера. Конспекты — только твои, в data/users.
            </p>
            <input
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <div className="toolbar">
              <button
                className="primary"
                type="button"
                onClick={async () => {
                  const r = await api.saveSettings(apiKey);
                  setHasKey(r.hasKey);
                }}
              >
                Сохранить ключ
              </button>
              <span className="muted">{hasKey ? "Ключ OpenRouter задан" : "Ключа нет — ИИ недоступен"}</span>
            </div>
            <h2>Локальные файлы</h2>
            <p className="muted">
              «На этот ПК» пишет папку C:\EASY-WORK\локальные-конспекты\{loginName}\ (предмет / тип /
              файл.md). «Выбрать папку» — любая папка в Chrome / Opera GX.
            </p>
            <div className="toolbar">
              <button
                className="primary"
                type="button"
                onClick={async () => {
                  try {
                    const r = await api.exportLocal();
                    setError(`Сохранено файлов: ${r.count} → ${r.dest}`);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Сохранить все на этот ПК
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const n = await saveBundleToFolder();
                    setError(`В выбранную папку записано файлов: ${n}`);
                  } catch (e) {
                    if ((e as Error).name === "AbortError") return;
                    setError((e as Error).message);
                  }
                }}
              >
                Выбрать папку…
              </button>
            </div>
          </section>
        )}

        {view === "list" && selected && (
          <>
            <h1>{selected.name}</h1>
            <div className="toolbar">
              <button
                type="button"
                onClick={async () => {
                  const name = window.prompt("Новое название предмета", selected.name);
                  if (!name?.trim()) return;
                  await api.renameSubject(selected.id, name);
                  await reload();
                }}
              >
                Переименовать
              </button>
              <button
                type="button"
                className="danger"
                onClick={async () => {
                  if (!window.confirm("Удалить предмет и все материалы?")) return;
                  await api.deleteSubject(selected.id);
                  setSelectedId(null);
                  await reload();
                }}
              >
                Удалить предмет
              </button>
            </div>
            <div className="tabs">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={tab === t.id ? "active" : ""}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="toolbar">
              <button className="primary" type="button" onClick={() => setImportOpen(true)}>
                Добавить материал
              </button>
            </div>
            <div className="cards">
              {materials.length === 0 && <p className="muted">Пока пусто — добавь txt или вставь текст.</p>}
              {materials.map((m) => (
                <div key={m.id} className="card" onClick={() => void openMaterial(m)}>
                  <div>
                    <strong>{m.title}</strong>
                    <div className="muted">{formatDate(m.updatedAt)}</div>
                  </div>
                  <button
                    type="button"
                    className="danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      void (async () => {
                        if (!window.confirm("Удалить материал?")) return;
                        await api.deleteMaterial(selected.id, m.id);
                        await reload();
                      })();
                    }}
                  >
                    Удалить
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {view === "list" && !selected && <p className="muted">Создай первый предмет слева.</p>}

        {view === "editor" && selected && openId && (
          <div className="editor">
            <div className="editor-head">
              <button type="button" onClick={() => setView("list")}>
                Назад
              </button>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
              <button className="primary" type="button" onClick={() => void saveMaterial()}>
                Сохранить
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadLecture({
                    title,
                    subject: selected.name,
                    type: tab,
                    body,
                    format: "md",
                  })
                }
              >
                Скачать Markdown
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadLecture({
                    title,
                    subject: selected.name,
                    type: tab,
                    body,
                    format: "doc",
                  })
                }
              >
                Скачать Word
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadLecture({
                    title,
                    subject: selected.name,
                    type: tab,
                    body,
                    format: "html",
                  })
                }
              >
                Скачать HTML
              </button>
              <button
                type="button"
                disabled={aiBusy}
                onClick={async () => {
                  setAiBusy(true);
                  try {
                    const r = await api.structure(body);
                    setTitle(r.title);
                    setBody(r.structured);
                    await api.updateMaterial(selected.id, openId, {
                      title: r.title,
                      body: r.structured,
                    });
                    await reload();
                    if (r.warning) setError(r.warning);
                    else setError("");
                  } catch (e) {
                    const msg = (e as Error).message;
                    setError(
                      /terminated|abort|timeout/i.test(msg)
                        ? "ИИ оборвался (terminated/таймаут). Нажми ещё раз — если снова долго, сохранится простая нумерация."
                        : msg,
                    );
                  } finally {
                    setAiBusy(false);
                  }
                }}
              >
                {aiBusy ? "ИИ работает…" : "Снова структурировать ИИ"}
              </button>
            </div>
            <div className="editor-split">
              <textarea value={body} onChange={(e) => setBody(e.target.value)} />
              <div
                className="preview"
                dangerouslySetInnerHTML={{
                  __html: previewDocumentHtml(title, body),
                }}
              />
            </div>
          </div>
        )}
      </main>

      {importOpen && selected && (
        <ImportModal
          hasKey={hasKey}
          onClose={() => setImportOpen(false)}
          onSave={async (t, b) => {
            await api.createMaterial(selected.id, tab, t, b);
            await reload();
            setImportOpen(false);
          }}
        />
      )}
    </div>
  );
}

function ImportModal({
  hasKey,
  onClose,
  onSave,
}: {
  hasKey: boolean;
  onClose: () => void;
  onSave: (title: string, body: string) => Promise<void>;
}) {
  const [raw, setRaw] = useState("");
  const [fileName, setFileName] = useState("Новый материал");
  const [title, setTitle] = useState("");
  const [structured, setStructured] = useState("");
  const [preview, setPreview] = useState<StructureResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function runAi() {
    setBusy(true);
    setMsg("");
    try {
      const r = await api.structure(raw);
      setPreview(r);
      setTitle(r.title);
      setStructured(r.structured);
      if (r.warning) setMsg(r.warning);
    } catch (e) {
      setMsg((e as Error).message);
      setTitle(fileName);
      setStructured(raw);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Новый материал</h2>
        <input
          type="file"
          accept=".txt,text/plain,.md"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setFileName(f.name.replace(/\.(txt|md)$/i, ""));
            setRaw(await f.text());
            setPreview(null);
          }}
        />
        <p className="muted">Или вставь текст ниже. ИИ только нумерует и оформляет, слова не меняет.</p>
        <div className="split">
          <div>
            <div className="muted">Исходник</div>
            <textarea value={raw} onChange={(e) => setRaw(e.target.value)} />
          </div>
          <div>
            <div className="muted">Структура и заголовок</div>
            <input
              placeholder="Заголовок"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea value={structured} onChange={(e) => setStructured(e.target.value)} />
          </div>
        </div>
        {msg && <div className="warn">{msg}</div>}
        {!hasKey && (
          <div className="muted">Ключа OpenRouter нет — можно сохранить исходник как есть.</div>
        )}
        <div className="toolbar">
          <button className="primary" type="button" disabled={busy || !raw.trim()} onClick={() => void runAi()}>
            {busy ? "ИИ работает…" : "Структурировать ИИ"}
          </button>
          <button
            type="button"
            disabled={!raw.trim()}
            onClick={() => void onSave(title.trim() || fileName, structured || raw)}
          >
            {preview ? "Принять и сохранить" : "Сохранить без ИИ"}
          </button>
          <button type="button" onClick={onClose}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
