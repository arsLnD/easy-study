import pg from "pg";

function toNodeUrl(url: string) {
  return url.replace(/^postgresql\+asyncpg:/, "postgresql:");
}

let pool: pg.Pool | null = null;

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL не задан");
  if (!pool) {
    pool = new pg.Pool({
      connectionString: toNodeUrl(process.env.DATABASE_URL),
      ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
      max: 8,
    });
  }
  return pool;
}

export async function initSchema() {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS study_users (
      id UUID PRIMARY KEY,
      login TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS study_sessions (
      sid TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES study_users(id) ON DELETE CASCADE,
      exp BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS study_settings (
      id INT PRIMARY KEY DEFAULT 1,
      openrouter_key TEXT NOT NULL DEFAULT ''
    );
    INSERT INTO study_settings (id, openrouter_key) VALUES (1, '')
      ON CONFLICT (id) DO NOTHING;
    CREATE TABLE IF NOT EXISTS study_subjects (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES study_users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS study_materials (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES study_users(id) ON DELETE CASCADE,
      subject_id UUID NOT NULL REFERENCES study_subjects(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}
