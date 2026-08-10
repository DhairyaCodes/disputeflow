import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),
  OIDC_ISSUER: z.string().url(),
  OIDC_JWKS_URI: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development')
});

export function loadConfig(environment = process.env) {
  return schema.parse(environment);
}

