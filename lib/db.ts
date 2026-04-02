import { Pool } from 'pg';

const globalForDb = globalThis as unknown as { pool: Pool };

export const pool: Pool = globalForDb.pool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pool = pool;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const result = await pool.query(text, params);
  return (result.rows[0] as T) ?? null;
}

export async function execute(text: string, params?: unknown[]): Promise<void> {
  await pool.query(text, params);
}

async function runSafe(sql: string, params?: unknown[]) {
  try {
    await pool.query(sql, params);
  } catch {
    // 이미 존재하거나 충돌 시 무시
  }
}

export async function initDb(): Promise<void> {
  // ── users ──────────────────────────────────────────────
  await runSafe(`CREATE TABLE IF NOT EXISTS users (
    id           SERIAL PRIMARY KEY,
    username     TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL DEFAULT '',
    role         TEXT NOT NULL DEFAULT 'member',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active    INTEGER NOT NULL DEFAULT 1
  )`);
  // 기존 테이블에 누락된 컬럼 추가
  await runSafe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT ''`);
  await runSafe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member'`);
  await runSafe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active INTEGER NOT NULL DEFAULT 1`);
  await runSafe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
  // display_name이 비어있으면 username으로 채우기
  await runSafe(`UPDATE users SET display_name = username WHERE display_name = ''`);

  // ── groups ─────────────────────────────────────────────
  await runSafe(`CREATE TABLE IF NOT EXISTS groups (
    id         SERIAL PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);

  // ── group_members ──────────────────────────────────────
  await runSafe(`CREATE TABLE IF NOT EXISTS group_members (
    group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
  )`);

  // ── meetings ───────────────────────────────────────────
  await runSafe(`CREATE TABLE IF NOT EXISTS meetings (
    id           SERIAL PRIMARY KEY,
    group_id     INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    meeting_date TEXT NOT NULL,
    location     TEXT,
    location_lat REAL,
    location_lng REAL,
    total_cost   INTEGER DEFAULT 0,
    description  TEXT,
    ai_story     TEXT,
    ai_summary   TEXT,
    topics       TEXT DEFAULT '[]',
    created_by   INTEGER NOT NULL REFERENCES users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  // 기존 meetings 테이블에 누락된 컬럼 추가
  await runSafe(`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE`);
  await runSafe(`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS location_lat REAL`);
  await runSafe(`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS location_lng REAL`);
  await runSafe(`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS total_cost INTEGER DEFAULT 0`);
  await runSafe(`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS description TEXT`);
  await runSafe(`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS ai_story TEXT`);
  await runSafe(`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS ai_summary TEXT`);
  await runSafe(`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS topics TEXT DEFAULT '[]'`);
  await runSafe(`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);

  await runSafe(`CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(meeting_date DESC)`);
  await runSafe(`CREATE INDEX IF NOT EXISTS idx_meetings_group ON meetings(group_id)`);

  // ── photos ─────────────────────────────────────────────
  await runSafe(`CREATE TABLE IF NOT EXISTS photos (
    id            SERIAL PRIMARY KEY,
    meeting_id    INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    filename      TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_path     TEXT NOT NULL,
    file_size     INTEGER,
    mime_type     TEXT,
    exif_taken_at TEXT,
    exif_lat      REAL,
    exif_lng      REAL,
    exif_make     TEXT,
    exif_model    TEXT,
    uploaded_by   INTEGER NOT NULL REFERENCES users(id),
    uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sort_order    INTEGER NOT NULL DEFAULT 0
  )`);
  await runSafe(`ALTER TABLE photos ADD COLUMN IF NOT EXISTS file_size INTEGER`);
  await runSafe(`ALTER TABLE photos ADD COLUMN IF NOT EXISTS mime_type TEXT`);
  await runSafe(`ALTER TABLE photos ADD COLUMN IF NOT EXISTS exif_taken_at TEXT`);
  await runSafe(`ALTER TABLE photos ADD COLUMN IF NOT EXISTS exif_lat REAL`);
  await runSafe(`ALTER TABLE photos ADD COLUMN IF NOT EXISTS exif_lng REAL`);
  await runSafe(`ALTER TABLE photos ADD COLUMN IF NOT EXISTS exif_make TEXT`);
  await runSafe(`ALTER TABLE photos ADD COLUMN IF NOT EXISTS exif_model TEXT`);
  await runSafe(`ALTER TABLE photos ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0`);
  await runSafe(`CREATE INDEX IF NOT EXISTS idx_photos_meeting ON photos(meeting_id, sort_order)`);

  // ── expense_items ──────────────────────────────────────
  await runSafe(`CREATE TABLE IF NOT EXISTS expense_items (
    id          SERIAL PRIMARY KEY,
    meeting_id  INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    item_name   TEXT NOT NULL,
    quantity    INTEGER NOT NULL DEFAULT 1,
    unit_price  INTEGER NOT NULL DEFAULT 0,
    total_price INTEGER NOT NULL DEFAULT 0,
    category    TEXT,
    source      TEXT NOT NULL DEFAULT 'manual',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await runSafe(`ALTER TABLE expense_items ADD COLUMN IF NOT EXISTS category TEXT`);
  await runSafe(`ALTER TABLE expense_items ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'`);

  // ── receipts ───────────────────────────────────────────
  await runSafe(`CREATE TABLE IF NOT EXISTS receipts (
    id            SERIAL PRIMARY KEY,
    meeting_id    INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    filename      TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_path     TEXT NOT NULL,
    ai_raw_text   TEXT,
    processed     INTEGER NOT NULL DEFAULT 0,
    uploaded_by   INTEGER NOT NULL REFERENCES users(id),
    uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await runSafe(`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS ai_raw_text TEXT`);
  await runSafe(`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS processed INTEGER NOT NULL DEFAULT 0`);

  // ── audio_files ────────────────────────────────────────
  await runSafe(`CREATE TABLE IF NOT EXISTS audio_files (
    id               SERIAL PRIMARY KEY,
    meeting_id       INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    filename         TEXT NOT NULL,
    original_name    TEXT NOT NULL,
    file_path        TEXT NOT NULL,
    file_size        INTEGER,
    transcript       TEXT,
    summary          TEXT,
    topics_extracted TEXT DEFAULT '[]',
    processed        INTEGER NOT NULL DEFAULT 0,
    uploaded_by      INTEGER NOT NULL REFERENCES users(id),
    uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await runSafe(`ALTER TABLE audio_files ADD COLUMN IF NOT EXISTS file_size INTEGER`);
  await runSafe(`ALTER TABLE audio_files ADD COLUMN IF NOT EXISTS transcript TEXT`);
  await runSafe(`ALTER TABLE audio_files ADD COLUMN IF NOT EXISTS summary TEXT`);
  await runSafe(`ALTER TABLE audio_files ADD COLUMN IF NOT EXISTS topics_extracted TEXT DEFAULT '[]'`);
  await runSafe(`ALTER TABLE audio_files ADD COLUMN IF NOT EXISTS processed INTEGER NOT NULL DEFAULT 0`);

  // ── comments ───────────────────────────────────────────
  await runSafe(`CREATE TABLE IF NOT EXISTS comments (
    id         SERIAL PRIMARY KEY,
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    author_id  INTEGER NOT NULL REFERENCES users(id),
    content    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_deleted INTEGER NOT NULL DEFAULT 0
  )`);
  await runSafe(`ALTER TABLE comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
  await runSafe(`ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_deleted INTEGER NOT NULL DEFAULT 0`);
  await runSafe(`CREATE INDEX IF NOT EXISTS idx_comments_meeting ON comments(meeting_id, created_at)`);

  // ── meeting_members ────────────────────────────────────
  await runSafe(`CREATE TABLE IF NOT EXISTS meeting_members (
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    PRIMARY KEY (meeting_id, user_id)
  )`);
}
