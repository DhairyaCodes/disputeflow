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
    CREATE TABLE IF NOT EXISTS disputes (
      id UUID PRIMARY KEY,
      customer_id TEXT NOT NULL,
      transaction_reference TEXT NOT NULL,
      amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
      currency CHAR(3) NOT NULL,
      merchant_name TEXT NOT NULL,
      reason TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'OPEN',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (customer_id, transaction_reference)
    );

    CREATE TABLE IF NOT EXISTS dispute_status_history (
      id UUID PRIMARY KEY,
      dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
      from_status TEXT,
      to_status TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS idempotency_records (
      customer_id TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      response_body JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (customer_id, idempotency_key)
    );

    CREATE INDEX IF NOT EXISTS idx_disputes_customer_created
      ON disputes(customer_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_disputes_status_created
      ON disputes(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_history_dispute_created
      ON dispute_status_history(dispute_id, created_at);
  `);
}

