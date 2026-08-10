import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const identityUrl = process.env.IDENTITY_URL || 'http://localhost:8080';
const disputeUrl = process.env.DISPUTE_URL || 'http://localhost:3001';
const evidenceUrl = process.env.EVIDENCE_URL || 'http://localhost:3002';

async function getToken(username, password) {
  const body = new URLSearchParams({
    client_id: 'disputeflow-cli',
    username,
    password,
    grant_type: 'password'
  });
  const response = await fetch(`${identityUrl}/realms/disputeflow/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!response.ok) throw new Error(`Token request failed: ${response.status}`);
  return (await response.json()).access_token;
}

async function jsonRequest(url, { token, ...options } = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${url} failed (${response.status}): ${JSON.stringify(body)}`);
  return { response, body };
}

const customerToken = await getToken('customer1', 'customer-pass');
const agentToken = await getToken('agent1', 'agent-pass');
const idempotencyKey = randomUUID();
const createBody = JSON.stringify({
  transactionReference: `TXN-${randomUUID().slice(0, 8)}`,
  amount: 1499.5,
  currency: 'INR',
  merchantName: 'Demo Travel',
  reason: 'DUPLICATE_CHARGE',
  description: 'Created by the end-to-end smoke test'
});

const created = await jsonRequest(`${disputeUrl}/api/v1/disputes`, {
  method: 'POST',
  token: customerToken,
  headers: { 'idempotency-key': idempotencyKey },
  body: createBody
});
const replayed = await jsonRequest(`${disputeUrl}/api/v1/disputes`, {
  method: 'POST',
  token: customerToken,
  headers: { 'idempotency-key': idempotencyKey },
  body: createBody
});
if (replayed.response.headers.get('idempotency-replayed') !== 'true') {
  throw new Error('Idempotency replay was not detected');
}

const form = new FormData();
const fixture = await readFile(new URL('../test/fixtures/sample-evidence.pdf', import.meta.url));
form.append('file', new Blob([fixture], { type: 'application/pdf' }), 'sample-evidence.pdf');
const uploadResponse = await fetch(`${evidenceUrl}/api/v1/disputes/${created.body.id}/evidence`, {
  method: 'POST',
  headers: { authorization: `Bearer ${customerToken}` },
  body: form
});
if (!uploadResponse.ok) throw new Error(`Evidence upload failed: ${uploadResponse.status} ${await uploadResponse.text()}`);
const evidence = await uploadResponse.json();
const downloadResponse = await fetch(`${evidenceUrl}/api/v1/evidence/${evidence.id}/content`, {
  headers: { authorization: `Bearer ${customerToken}` }
});
if (!downloadResponse.ok) throw new Error(`Evidence download failed: ${downloadResponse.status}`);
const downloadedEvidence = Buffer.from(await downloadResponse.arrayBuffer());
const downloadedChecksum = createHash('sha256').update(downloadedEvidence).digest('hex');
if (downloadedChecksum !== evidence.checksum) throw new Error('Downloaded evidence checksum does not match the upload');

const updated = await jsonRequest(`${disputeUrl}/api/v1/disputes/${created.body.id}/status`, {
  method: 'PATCH',
  token: agentToken,
  body: JSON.stringify({ status: 'UNDER_REVIEW', expectedVersion: 1, note: 'Evidence received' })
});
const history = await jsonRequest(`${disputeUrl}/api/v1/disputes/${created.body.id}/history`, { token: customerToken });

console.log(JSON.stringify({
  disputeId: created.body.id,
  evidenceId: evidence.id,
  status: updated.body.status,
  historyEntries: history.body.items.length,
  idempotencyVerified: true,
  evidenceChecksumVerified: true
}, null, 2));
