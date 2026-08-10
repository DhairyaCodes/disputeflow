import { BigQuery } from '@google-cloud/bigquery';
import { tableSchemas } from './schemas.js';

export async function loadBigQuery({ projectId, datasetId, location, exports }) {
  if (!projectId) throw new Error('GCP_PROJECT_ID is required for a BigQuery load');
  const bigquery = new BigQuery({ projectId });
  const dataset = bigquery.dataset(datasetId);
  const [exists] = await dataset.exists();
  if (!exists) await dataset.create({ location });

  const results = {};
  for (const [tableName, exported] of Object.entries(exports)) {
    const table = dataset.table(tableName);
    if (exported.rowCount === 0) {
      await table.delete({ ignoreNotFound: true });
      await table.create({ schema: { fields: tableSchemas[tableName] } });
      results[tableName] = { rowCount: 0, jobId: null };
      continue;
    }
    const [job] = await table.load(exported.filePath, {
      location,
      sourceFormat: 'NEWLINE_DELIMITED_JSON',
      schema: { fields: tableSchemas[tableName] },
      writeDisposition: 'WRITE_TRUNCATE'
    });
    if (job.status?.errors?.length) {
      throw new Error(`BigQuery load failed for ${tableName}: ${JSON.stringify(job.status.errors)}`);
    }
    results[tableName] = { rowCount: exported.rowCount, jobId: job.id };
  }
  return results;
}
