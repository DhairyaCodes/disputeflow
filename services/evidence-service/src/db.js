import pg from 'pg';

const { Pool } = pg;

export function createDatabase(connectionString) {
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
}

export async function migrate(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS evidence (
      id UUID PRIMARY KEY,
      dispute_id UUID NOT NULL,
      uploader_id TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      object_name TEXT NOT NULL UNIQUE,
      content_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
      checksum TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_evidence_dispute_created
      ON evidence(dispute_id, created_at DESC);
  `);
}

