import pg from 'pg';

const { Pool } = pg;

export async function extractOperationalData(connectionString) {
  const pool = new Pool({ connectionString, max: 2 });
  try {
    const [disputes, transitions] = await Promise.all([
      pool.query(`
        SELECT id, customer_id, transaction_reference, amount, currency, merchant_name,
               reason, status, version, created_at, updated_at
        FROM disputes
        ORDER BY created_at
      `),
      pool.query(`
        SELECT id, dispute_id, from_status, to_status, changed_by, created_at
        FROM dispute_status_history
        ORDER BY created_at
      `)
    ]);
    return { disputes: disputes.rows, transitions: transitions.rows };
  } finally {
    await pool.end();
  }
}

