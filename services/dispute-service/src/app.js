import crypto from 'node:crypto';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { ZodError } from 'zod';
import { requireRole } from './auth.js';
import { createDisputeSchema, updateStatusSchema } from './validation.js';

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function canRead(user, dispute) {
  return user.roles.includes('ops_agent') || user.roles.includes('admin') || dispute.customerId === user.id;
}

export function createApp({ repository, authenticate, logger }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));
  app.use(pinoHttp({
    logger,
    genReqId: (req, res) => {
      const id = req.headers['x-correlation-id'] || crypto.randomUUID();
      res.setHeader('x-correlation-id', id);
      return id;
    }
  }));

  app.get('/health', (_req, res) => res.json({ service: 'dispute-service', status: 'ok' }));

  app.use('/api/v1', authenticate);

  app.post('/api/v1/disputes', requireRole('customer'), asyncRoute(async (req, res) => {
    const idempotencyKey = req.headers['idempotency-key'];
    if (!idempotencyKey || String(idempotencyKey).length > 100) {
      return res.status(400).json({ error: { code: 'INVALID_IDEMPOTENCY_KEY', message: 'A valid Idempotency-Key header is required' } });
    }
    const input = createDisputeSchema.parse(req.body);
    const result = await repository.create(req.user.id, input, String(idempotencyKey));
    res.setHeader('Idempotency-Replayed', String(result.replayed));
    return res.status(result.replayed ? 200 : 201).json(result.dispute);
  }));

  app.get('/api/v1/disputes', asyncRoute(async (req, res) => {
    const isOperator = req.user.roles.some((role) => ['ops_agent', 'admin'].includes(role));
    const page = Math.max(Number.parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit || '20', 10), 1), 100);
    const result = await repository.list({
      customerId: isOperator ? req.query.customerId : req.user.id,
      status: req.query.status,
      limit,
      offset: (page - 1) * limit
    });
    return res.json({ ...result, page, limit });
  }));

  app.get('/api/v1/disputes/:id', asyncRoute(async (req, res) => {
    const dispute = await repository.findById(req.params.id);
    if (!dispute) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Dispute not found' } });
    if (!canRead(req.user, dispute)) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    return res.json(dispute);
  }));

  app.get('/api/v1/disputes/:id/history', asyncRoute(async (req, res) => {
    const dispute = await repository.findById(req.params.id);
    if (!dispute) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Dispute not found' } });
    if (!canRead(req.user, dispute)) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    return res.json({ items: await repository.history(req.params.id) });
  }));

  app.patch('/api/v1/disputes/:id/status', requireRole('ops_agent', 'admin'), asyncRoute(async (req, res) => {
    const input = updateStatusSchema.parse(req.body);
    const dispute = await repository.updateStatus(req.params.id, input, req.user.id);
    if (!dispute) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Dispute not found' } });
    return res.json(dispute);
  }));

  app.use((req, res) => res.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: 'Route not found' } }));

  app.use((error, req, res, _next) => {
    const status = error instanceof ZodError ? 400 : error.status || 500;
    if (status >= 500) req.log.error({ err: error }, 'request failed');
    const message = error instanceof ZodError ? 'Request validation failed' : error.message;
    res.status(status).json({
      error: {
        code: error instanceof ZodError ? 'VALIDATION_ERROR' : status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
        message,
        ...(error instanceof ZodError ? { details: error.issues } : {})
      }
    });
  });

  return app;
}

