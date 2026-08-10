import pino from 'pino';
import { createApp } from './app.js';
import { createAuth } from './auth.js';
import { loadConfig } from './config.js';
import { createDatabase, migrate } from './db.js';
import { createDisputeClient } from './disputeClient.js';
import { createRepository } from './repository.js';
import { createObjectStorage } from './storage.js';

const config = loadConfig();
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const pool = createDatabase(config.DATABASE_URL);
const objectStorage = createObjectStorage(config.GCS_BUCKET, config.GCP_PROJECT_ID, config.GCS_API_ENDPOINT);

await migrate(pool);
await objectStorage.ensureBucket();

const app = createApp({
  repository: createRepository(pool),
  objectStorage,
  disputeClient: createDisputeClient(config.DISPUTE_SERVICE_URL),
  authenticate: createAuth({ issuer: config.OIDC_ISSUER, jwksUri: config.OIDC_JWKS_URI }),
  logger
});

const server = app.listen(config.PORT, () => logger.info({ port: config.PORT }, 'evidence-service listening'));

async function shutdown(signal) {
  logger.info({ signal }, 'shutting down');
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
