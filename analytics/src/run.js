import { loadConfig } from './config.js';
import { exportNdjson } from './export.js';
import { extractOperationalData } from './extract.js';
import { loadBigQuery } from './load.js';
import { transformToStarSchema } from './transform.js';

const config = loadConfig();
const exportOnly = process.argv.includes('--export-only');
const operationalData = await extractOperationalData(config.ANALYTICS_DATABASE_URL);
const tables = transformToStarSchema(operationalData);
const exports = await exportNdjson(tables, config.ANALYTICS_OUTPUT_DIR);

const summary = {
  mode: exportOnly ? 'export' : 'bigquery-load',
  tables: Object.fromEntries(Object.entries(exports).map(([name, value]) => [name, value.rowCount]))
};

if (!exportOnly) {
  summary.bigquery = await loadBigQuery({
    projectId: config.GCP_PROJECT_ID,
    datasetId: config.BIGQUERY_DATASET,
    location: config.BIGQUERY_LOCATION,
    exports
  });
}

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
