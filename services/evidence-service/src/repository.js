import { randomUUID } from 'node:crypto';

function mapEvidence(row) {
  return {
    id: row.id,
    disputeId: row.dispute_id,
    uploaderId: row.uploader_id,
    filename: row.original_filename,
    objectName: row.object_name,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    checksum: row.checksum,
    createdAt: row.created_at
  };
}

export function createRepository(pool) {
  return {
    async create(input) {
      const result = await pool.query(
        `INSERT INTO evidence
          (id, dispute_id, uploader_id, original_filename, object_name, content_type, size_bytes, checksum)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [randomUUID(), input.disputeId, input.uploaderId, input.filename, input.objectName, input.contentType, input.sizeBytes, input.checksum]
      );
      return mapEvidence(result.rows[0]);
    },
    async list(disputeId) {
      const result = await pool.query('SELECT * FROM evidence WHERE dispute_id=$1 ORDER BY created_at DESC', [disputeId]);
      return result.rows.map(mapEvidence);
    },
    async findById(id) {
      const result = await pool.query('SELECT * FROM evidence WHERE id=$1', [id]);
      return result.rowCount ? mapEvidence(result.rows[0]) : null;
    },
    async remove(id) {
      await pool.query('DELETE FROM evidence WHERE id=$1', [id]);
    }
  };
}

