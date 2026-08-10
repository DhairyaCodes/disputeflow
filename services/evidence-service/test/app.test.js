import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import pino from 'pino';
import request from 'supertest';
import { createApp } from '../src/app.js';

const disputeId = '76b85379-2614-4fc1-84b4-752803eb4f56';
const evidence = {
  id: '4e279e78-a6a5-4c60-a675-0e56ce7b48f0',
  disputeId,
  filename: 'receipt.pdf',
  contentType: 'application/pdf',
  sizeBytes: 20
};

function buildApp({ dispute = { id: disputeId, status: 'OPEN' } } = {}) {
  const repository = {
    create: async (input) => ({ ...evidence, checksum: input.checksum }),
    list: async () => [evidence],
    findById: async () => evidence,
    remove: async () => {}
  };
  const objectStorage = { upload: async () => {}, remove: async () => {} };
  const disputeClient = { getDispute: async () => dispute };
  const authenticate = (req, _res, next) => {
    req.user = { id: 'customer-1', roles: ['customer'] };
    req.accessToken = 'access-token';
    next();
  };
  return createApp({ repository, objectStorage, disputeClient, authenticate, logger: pino({ enabled: false }) });
}

describe('Evidence Service API', () => {
  it('reports service health without authentication', async () => {
    const response = await request(buildApp()).get('/health');
    assert.equal(response.status, 200);
    assert.equal(response.body.service, 'evidence-service');
  });

  it('rejects unsupported evidence formats', async () => {
    const response = await request(buildApp())
      .post(`/api/v1/disputes/${disputeId}/evidence`)
      .attach('file', Buffer.from('not evidence'), { filename: 'notes.txt', contentType: 'text/plain' });
    assert.equal(response.status, 400);
  });

  it('uploads valid evidence and calculates its checksum', async () => {
    const response = await request(buildApp())
      .post(`/api/v1/disputes/${disputeId}/evidence`)
      .attach('file', Buffer.from('%PDF-1.4 example'), { filename: 'receipt.pdf', contentType: 'application/pdf' });
    assert.equal(response.status, 201);
    assert.match(response.body.checksum, /^[a-f0-9]{64}$/);
  });

  it('rejects uploads after a dispute is closed', async () => {
    const response = await request(buildApp({ dispute: { id: disputeId, status: 'RESOLVED' } }))
      .post(`/api/v1/disputes/${disputeId}/evidence`)
      .attach('file', Buffer.from('%PDF-1.4 example'), { filename: 'receipt.pdf', contentType: 'application/pdf' });
    assert.equal(response.status, 409);
    assert.equal(response.body.error.code, 'DISPUTE_CLOSED');
  });
});
