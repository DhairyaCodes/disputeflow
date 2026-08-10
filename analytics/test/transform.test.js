import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { transformToStarSchema } from '../src/transform.js';

const loadedAt = new Date('2026-08-11T00:00:00.000Z');
const source = {
  disputes: [
    {
      id: 'dispute-1',
      customer_id: 'customer-1',
      transaction_reference: 'TXN-001',
      amount: '1250.50',
      currency: 'INR',
      merchant_name: 'Demo Travel',
      reason: 'DUPLICATE_CHARGE',
      status: 'RESOLVED',
      version: 2,
      created_at: new Date('2026-08-09T10:00:00.000Z'),
      updated_at: new Date('2026-08-09T12:30:00.000Z')
    },
    {
      id: 'dispute-2',
      customer_id: 'customer-2',
      transaction_reference: 'TXN-002',
      amount: '500.00',
      currency: 'INR',
      merchant_name: 'Demo Travel',
      reason: 'PRODUCT_NOT_RECEIVED',
      status: 'OPEN',
      version: 1,
      created_at: new Date('2026-08-10T08:00:00.000Z'),
      updated_at: new Date('2026-08-10T08:00:00.000Z')
    }
  ],
  transitions: [
    {
      id: 'transition-1',
      dispute_id: 'dispute-1',
      from_status: 'UNDER_REVIEW',
      to_status: 'RESOLVED',
      changed_by: 'agent-1',
      created_at: new Date('2026-08-09T12:30:00.000Z')
    }
  ]
};

describe('analytics transformation', () => {
  it('builds deduplicated dimensions with deterministic keys', () => {
    const result = transformToStarSchema(source, loadedAt);
    assert.equal(result.dim_merchant.length, 1);
    assert.equal(result.dim_dispute_reason.length, 2);
    assert.equal(result.dim_date.length, 2);
    assert.equal(result.fact_disputes[0].merchant_key, result.fact_disputes[1].merchant_key);
  });

  it('calculates resolution time only for terminal disputes', () => {
    const result = transformToStarSchema(source, loadedAt);
    assert.equal(result.fact_disputes[0].resolution_hours, 2.5);
    assert.equal(result.fact_disputes[1].resolution_hours, null);
  });

  it('pseudonymizes customer, transaction, and actor identifiers', () => {
    const result = transformToStarSchema(source, loadedAt);
    assert.notEqual(result.fact_disputes[0].customer_key, 'customer-1');
    assert.notEqual(result.fact_disputes[0].transaction_key, 'TXN-001');
    assert.notEqual(result.fact_status_transitions[0].actor_key, 'agent-1');
  });

  it('creates fact rows linked to date and reason dimensions', () => {
    const result = transformToStarSchema(source, loadedAt);
    const fact = result.fact_disputes[0];
    assert.ok(result.dim_date.some((row) => row.date_key === fact.date_key));
    assert.ok(result.dim_dispute_reason.some((row) => row.reason_key === fact.reason_key));
    assert.equal(fact.loaded_at, loadedAt.toISOString());
  });
});

