import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import pino from 'pino';
import request from 'supertest';
import { createApp } from '../src/app.js';

const customer = { id: 'customer-1', roles: ['customer'] };
const dispute = {
  id: '76b85379-2614-4fc1-84b4-752803eb4f56',
  customerId: customer.id,
  transactionReference: 'TXN-123',
  amount: 1200,
  currency: 'INR',
  merchantName: 'Example Merchant',
  reason: 'DUPLICATE_CHARGE',
  status: 'OPEN',
  version: 1
};

function buildApp(overrides = {}, user = customer) {
  const repository = {
    create: async () => ({ dispute, replayed: false }),
    findById: async () => dispute,
    list: async () => ({ items: [dispute], total: 1 }),
    updateStatus: async () => ({ ...dispute, status: 'UNDER_REVIEW', version: 2 }),
    history: async () => [],
    ...overrides
  };
  const authenticate = (req, _res, next) => {
    req.user = user;
    next();
  };
  return createApp({ repository, authenticate, logger: pino({ enabled: false }) });
}

describe('Dispute Service API', () => {
  it('reports service health without authentication', async () => {
    const response = await request(buildApp()).get('/health');
    assert.equal(response.status, 200);
    assert.equal(response.body.status, 'ok');
  });

  it('requires an idempotency key when creating a dispute', async () => {
    const response = await request(buildApp()).post('/api/v1/disputes').send({});
    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, 'INVALID_IDEMPOTENCY_KEY');
  });

  it('creates a valid dispute', async () => {
    const response = await request(buildApp())
      .post('/api/v1/disputes')
      .set('Idempotency-Key', 'request-1')
      .send({
        transactionReference: 'TXN-123',
        amount: 1200,
        currency: 'inr',
        merchantName: 'Example Merchant',
        reason: 'DUPLICATE_CHARGE'
      });
    assert.equal(response.status, 201);
    assert.equal(response.body.id, dispute.id);
    assert.equal(response.headers['idempotency-replayed'], 'false');
  });

  it('prevents customers from updating dispute status', async () => {
    const response = await request(buildApp())
      .patch(`/api/v1/disputes/${dispute.id}/status`)
      .send({ status: 'UNDER_REVIEW', expectedVersion: 1 });
    assert.equal(response.status, 403);
  });
});

