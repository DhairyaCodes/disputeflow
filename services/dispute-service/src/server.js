import pino from 'pino';
import { createApp } from './app.js';
import { createAuth } from './auth.js';
import { loadConfig } from './config.js';
import { createDatabase, migrate } from './db.js';
import { createRepository } from './repository.js';

const config = loadConfig();
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const pool = createDatabase(config.DATABASE_URL);

await migrate(pool);
const app = createApp({
  repository: createRepository(pool),
  authenticate: createAuth({ issuer: config.OIDC_ISSUER, jwksUri: config.OIDC_JWKS_URI }),
  logger
});

const server = app.listen(config.PORT, () => logger.info({ port: config.PORT }, 'dispute-service listening'));

async function shutdown(signal) {
  logger.info({ signal }, 'shutting down');
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

