import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3002),
  DATABASE_URL: z.string().url(),
  OIDC_ISSUER: z.string().url(),
  OIDC_JWKS_URI: z.string().url().optional(),
  DISPUTE_SERVICE_URL: z.string().url(),
  GCS_BUCKET: z.string().min(3),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development')
});

export function loadConfig(environment = process.env) {
  return schema.parse(environment);
}

