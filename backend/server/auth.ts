import { randomBytes, scryptSync, timingSafeEqual, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage } from "node:http";
import { hasDatabase, getPool } from "./db.ts";
import { DATA_DIR } from "./store.ts";

export type User = {
  id: string;
  login: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
};

type UsersFile = { users: User[] };
type SessionsFile = { sessions: Record<string, { userId: string; exp: number }> };

const USERS_PATH = () => path.join(DATA_DIR, "users.json");
const SESSIONS_PATH = () => path.join(DATA_DIR, "sessions.json");
const COOKIE = "study_sid";
const DAY = 7 * 24 * 60 * 60 * 1000;

async function readUsers(): Promise<UsersFile> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    return JSON.parse(await fs.readFile(USERS_PATH(), "utf8")) as UsersFile;
  } catch {
    const empty: UsersFile = { users: [] };
    await fs.writeFile(USERS_PATH(), JSON.stringify(empty, null, 2), "utf8");
    return empty;
  }
}

async function writeUsers(file: UsersFile) {
  await fs.writeFile(USERS_PATH(), JSON.stringify(file, null, 2), "utf8");
}

async function readSessions(): Promise<SessionsFile> {
  try {
    return JSON.parse(await fs.readFile(SESSIONS_PATH(), "utf8")) as SessionsFile;
  } catch {
    return { sessions: {} };
  }
}

async function writeSessions(file: SessionsFile) {
  await fs.writeFile(SESSIONS_PATH(), JSON.stringify(file, null, 2), "utf8");
}

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 32).toString("hex");
}

function normalizeLogin(login: string) {
  return login.trim().toLowerCase();
}

export async function registerUser(login: string, password: string): Promise<User> {
  const norm = normalizeLogin(login);
  if (norm.length < 3) throw new Error("Логин минимум 3 символа");
  if (password.length < 6) throw new Error("Пароль минимум 6 символов");
  if (!/^[a-z0-9._-]+$/i.test(norm)) throw new Error("Логин: латиница, цифры, . _ -");
  const salt = randomBytes(16).toString("hex");
  const user: User = {
    id: randomUUID(),
    login: norm,
    salt,
    passwordHash: hashPassword(password, salt),
    createdAt: new Date().toISOString(),
  };
  if (hasDatabase()) {
    try {
      await getPool().query(
        `INSERT INTO study_users (id, login, password_hash, salt, created_at)
         VALUES ($1,$2,$3,$4,$5)`,
        [user.id, user.login, user.passwordHash, user.salt, user.createdAt],
      );
    } catch (e) {
      if (String(e).includes("unique") || String(e).includes("duplicate")) {
        throw new Error("Такой логин уже есть");
      }
      throw e;
    }
    return user;
  }
  const file = await readUsers();
  if (file.users.some((u) => u.login === norm)) throw new Error("Такой логин уже есть");
  file.users.push(user);
  await writeUsers(file);
  return user;
}

export async function loginUser(login: string, password: string): Promise<User> {
  let user: User | undefined;
  if (hasDatabase()) {
    const r = await getPool().query("SELECT * FROM study_users WHERE login = $1", [
      normalizeLogin(login),
    ]);
    const row = r.rows[0];
    if (row) {
      user = {
        id: row.id,
        login: row.login,
        passwordHash: row.password_hash,
        salt: row.salt,
        createdAt: new Date(row.created_at).toISOString(),
      };
    }
  } else {
    const file = await readUsers();
    user = file.users.find((u) => u.login === normalizeLogin(login));
  }
  if (!user) throw new Error("Неверный логин или пароль");
  const hash = hashPassword(password, user.salt);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(user.passwordHash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Неверный логин или пароль");
  }
  return user;
}

export async function createSession(userId: string) {
  const sid = randomBytes(24).toString("hex");
  const now = Date.now();
  const exp = now + DAY;
  if (hasDatabase()) {
    await getPool().query("DELETE FROM study_sessions WHERE exp < $1", [now]);
    await getPool().query("INSERT INTO study_sessions (sid, user_id, exp) VALUES ($1,$2,$3)", [
      sid,
      userId,
      exp,
    ]);
    return sid;
  }
  const file = await readSessions();
  for (const [k, v] of Object.entries(file.sessions)) {
    if (v.exp < now) delete file.sessions[k];
  }
  file.sessions[sid] = { userId, exp };
  await writeSessions(file);
  return sid;
}

export async function destroySession(sid: string) {
  if (hasDatabase()) {
    await getPool().query("DELETE FROM study_sessions WHERE sid = $1", [sid]);
    return;
  }
  const file = await readSessions();
  delete file.sessions[sid];
  await writeSessions(file);
}

export function readSid(req: IncomingMessage) {
  const raw = req.headers.cookie ?? "";
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === COOKIE) return rest.join("=");
  }
  return "";
}

export function setSessionCookie(res: { setHeader: (n: string, v: string) => void }, sid: string) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(DAY / 1000)}`,
  );
}

export function clearSessionCookie(res: { setHeader: (n: string, v: string) => void }) {
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export async function userFromRequest(req: IncomingMessage): Promise<User | null> {
  const sid = readSid(req);
  if (!sid) return null;
  if (hasDatabase()) {
    const r = await getPool().query(
      `SELECT u.id, u.login, u.password_hash, u.salt, u.created_at, s.exp
       FROM study_sessions s JOIN study_users u ON u.id = s.user_id
       WHERE s.sid = $1`,
      [sid],
    );
    const row = r.rows[0];
    if (!row || Number(row.exp) < Date.now()) return null;
    return {
      id: row.id,
      login: row.login,
      passwordHash: row.password_hash,
      salt: row.salt,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }
  const file = await readSessions();
  const s = file.sessions[sid];
  if (!s || s.exp < Date.now()) return null;
  const users = await readUsers();
  return users.users.find((u) => u.id === s.userId) ?? null;
}
