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

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS moim_users (
      id           SERIAL PRIMARY KEY,
      username     TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      role         TEXT NOT NULL DEFAULT 'member',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      is_active    INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS moim_groups (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      created_by INTEGER NOT NULL REFERENCES moim_users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS moim_group_members (
      group_id   INTEGER NOT NULL REFERENCES moim_groups(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES moim_users(id) ON DELETE CASCADE,
      joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (group_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS moim_meetings (
      id           SERIAL PRIMARY KEY,
      group_id     INTEGER REFERENCES moim_groups(id) ON DELETE CASCADE,
      title        TEXT NOT NULL,
      meeting_date TEXT NOT NULL,
      location     TEXT,
      total_cost   INTEGER DEFAULT 0,
      description  TEXT,
      ai_story     TEXT,
      ai_summary   TEXT,
      topics       TEXT DEFAULT '[]',
      created_by   INTEGER NOT NULL REFERENCES moim_users(id),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS moim_photos (
      id            SERIAL PRIMARY KEY,
      meeting_id    INTEGER NOT NULL REFERENCES moim_meetings(id) ON DELETE CASCADE,
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
      uploaded_by   INTEGER NOT NULL REFERENCES moim_users(id),
      uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sort_order    INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS moim_expense_items (
      id          SERIAL PRIMARY KEY,
      meeting_id  INTEGER NOT NULL REFERENCES moim_meetings(id) ON DELETE CASCADE,
      item_name   TEXT NOT NULL,
      quantity    INTEGER NOT NULL DEFAULT 1,
      unit_price  INTEGER NOT NULL DEFAULT 0,
      total_price INTEGER NOT NULL DEFAULT 0,
      category    TEXT,
      source      TEXT NOT NULL DEFAULT 'manual',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS moim_receipts (
      id            SERIAL PRIMARY KEY,
      meeting_id    INTEGER NOT NULL REFERENCES moim_meetings(id) ON DELETE CASCADE,
      filename      TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path     TEXT NOT NULL,
      ai_raw_text   TEXT,
      processed     INTEGER NOT NULL DEFAULT 0,
      uploaded_by   INTEGER NOT NULL REFERENCES moim_users(id),
      uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS moim_audio_files (
      id               SERIAL PRIMARY KEY,
      meeting_id       INTEGER NOT NULL REFERENCES moim_meetings(id) ON DELETE CASCADE,
      filename         TEXT NOT NULL,
      original_name    TEXT NOT NULL,
      file_path        TEXT NOT NULL,
      file_size        INTEGER,
      transcript       TEXT,
      summary          TEXT,
      topics_extracted TEXT DEFAULT '[]',
      processed        INTEGER NOT NULL DEFAULT 0,
      uploaded_by      INTEGER NOT NULL REFERENCES moim_users(id),
      uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS moim_comments (
      id         SERIAL PRIMARY KEY,
      meeting_id INTEGER NOT NULL REFERENCES moim_meetings(id) ON DELETE CASCADE,
      author_id  INTEGER NOT NULL REFERENCES moim_users(id),
      content    TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      is_deleted INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS moim_meeting_members (
      meeting_id INTEGER NOT NULL REFERENCES moim_meetings(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES moim_users(id),
      PRIMARY KEY (meeting_id, user_id)
    );
  `);
}
