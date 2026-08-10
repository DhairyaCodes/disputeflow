import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const analyticsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const schema = z.object({
  ANALYTICS_DATABASE_URL: z.string().url().default('postgresql://disputeflow:local-password@localhost:5432/dispute_service'),
  GCP_PROJECT_ID: z.string().min(2).optional(),
  BIGQUERY_DATASET: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).default('disputeflow_analytics'),
  BIGQUERY_LOCATION: z.string().default('asia-south1'),
  ANALYTICS_OUTPUT_DIR: z.string().default(path.join(analyticsRoot, 'output'))
});

export function loadConfig(environment = process.env) {
  return schema.parse(environment);
}

