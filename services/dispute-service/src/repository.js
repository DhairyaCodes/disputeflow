import { randomUUID } from 'node:crypto';

const transitions = {
  OPEN: ['UNDER_REVIEW', 'AWAITING_EVIDENCE'],
  AWAITING_EVIDENCE: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['AWAITING_EVIDENCE', 'RESOLVED', 'REJECTED'],
  RESOLVED: [],
  REJECTED: []
};

function mapDispute(row) {
  if (!row) return null;
  return {
    id: row.id,
    customerId: row.customer_id,
    transactionReference: row.transaction_reference,
    amount: Number(row.amount),
    currency: row.currency,
    merchantName: row.merchant_name,
    reason: row.reason,
    description: row.description,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createRepository(pool) {
  return {
    async create(customerId, input, idempotencyKey) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const existing = await client.query(
          'SELECT response_body FROM idempotency_records WHERE customer_id = $1 AND idempotency_key = $2 FOR UPDATE',
          [customerId, idempotencyKey]
        );
        if (existing.rowCount) {
          await client.query('COMMIT');
          return { dispute: existing.rows[0].response_body, replayed: true };
        }

        const id = randomUUID();
        const result = await client.query(
          `INSERT INTO disputes
            (id, customer_id, transaction_reference, amount, currency, merchant_name, reason, description)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [id, customerId, input.transactionReference, input.amount, input.currency, input.merchantName, input.reason, input.description || null]
        );
        const dispute = mapDispute(result.rows[0]);
        await client.query(
          `INSERT INTO dispute_status_history (id, dispute_id, from_status, to_status, changed_by, note)
           VALUES ($1,$2,NULL,'OPEN',$3,'Dispute created')`,
          [randomUUID(), id, customerId]
        );
        await client.query(
          'INSERT INTO idempotency_records (customer_id, idempotency_key, response_body) VALUES ($1,$2,$3)',
          [customerId, idempotencyKey, dispute]
        );
        await client.query('COMMIT');
        return { dispute, replayed: false };
      } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') {
          const conflict = new Error('A dispute already exists for this transaction');
          conflict.status = 409;
          throw conflict;
        }
        throw error;
      } finally {
        client.release();
      }
    },

    async findById(id) {
      const result = await pool.query('SELECT * FROM disputes WHERE id = $1', [id]);
      return mapDispute(result.rows[0]);
    },

    async list({ customerId, status, limit, offset }) {
      const values = [];
      const conditions = [];
      if (customerId) {
        values.push(customerId);
        conditions.push(`customer_id = $${values.length}`);
      }
      if (status) {
        values.push(status);
        conditions.push(`status = $${values.length}`);
      }
      values.push(limit, offset);
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await pool.query(
        `SELECT *, COUNT(*) OVER() AS total_count FROM disputes ${where}
         ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values
      );
      return { items: result.rows.map(mapDispute), total: Number(result.rows[0]?.total_count || 0) };
    },

    async updateStatus(id, { status, expectedVersion, note }, changedBy) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const currentResult = await client.query('SELECT * FROM disputes WHERE id = $1 FOR UPDATE', [id]);
        if (!currentResult.rowCount) {
          await client.query('ROLLBACK');
          return null;
        }
        const current = currentResult.rows[0];
        if (current.version !== expectedVersion) {
          const error = new Error('The dispute was modified; refresh it and retry');
          error.status = 409;
          throw error;
        }
        if (!transitions[current.status]?.includes(status)) {
          const error = new Error(`Invalid status transition from ${current.status} to ${status}`);
          error.status = 422;
          throw error;
        }
        const updated = await client.query(
          `UPDATE disputes SET status=$1, version=version+1, updated_at=NOW()
           WHERE id=$2 AND version=$3 RETURNING *`,
          [status, id, expectedVersion]
        );
        await client.query(
          `INSERT INTO dispute_status_history (id, dispute_id, from_status, to_status, changed_by, note)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [randomUUID(), id, current.status, status, changedBy, note || null]
        );
        await client.query('COMMIT');
        return mapDispute(updated.rows[0]);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async history(id) {
      const result = await pool.query(
        `SELECT id, from_status AS "fromStatus", to_status AS "toStatus", changed_by AS "changedBy",
                note, created_at AS "createdAt"
         FROM dispute_status_history WHERE dispute_id=$1 ORDER BY created_at`,
        [id]
      );
      return result.rows;
    }
  };
}
