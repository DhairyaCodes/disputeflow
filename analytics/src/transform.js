import { createHash } from 'node:crypto';

function stableKey(value) {
  return createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex').slice(0, 20);
}

function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}

function dateKey(value) {
  return Number(toDate(value).toISOString().slice(0, 10).replaceAll('-', ''));
}

function labelReason(reason) {
  return reason.toLowerCase().split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
}

export function transformToStarSchema({ disputes, transitions }, loadedAt = new Date()) {
  const dates = new Map();
  const reasons = new Map();
  const merchants = new Map();

  function registerDate(value) {
    const date = toDate(value);
    const key = dateKey(date);
    if (!dates.has(key)) {
      const month = date.getUTCMonth() + 1;
      dates.set(key, {
        date_key: key,
        full_date: date.toISOString().slice(0, 10),
        year: date.getUTCFullYear(),
        quarter: Math.ceil(month / 3),
        month,
        day: date.getUTCDate()
      });
    }
    return key;
  }

  const factDisputes = disputes.map((dispute) => {
    const reasonKey = stableKey(dispute.reason);
    const merchantName = dispute.merchant_name.trim();
    const merchantKey = stableKey(merchantName);
    reasons.set(reasonKey, {
      reason_key: reasonKey,
      reason_code: dispute.reason,
      reason_label: labelReason(dispute.reason)
    });
    merchants.set(merchantKey, { merchant_key: merchantKey, merchant_name: merchantName });

    const createdAt = toDate(dispute.created_at);
    const updatedAt = toDate(dispute.updated_at);
    const isClosed = ['RESOLVED', 'REJECTED'].includes(dispute.status);
    return {
      dispute_id: dispute.id,
      customer_key: stableKey(dispute.customer_id),
      transaction_key: stableKey(dispute.transaction_reference),
      date_key: registerDate(createdAt),
      reason_key: reasonKey,
      merchant_key: merchantKey,
      amount: Number(dispute.amount),
      currency: dispute.currency,
      status: dispute.status,
      resolution_hours: isClosed ? (updatedAt - createdAt) / 3_600_000 : null,
      version: dispute.version,
      created_at: createdAt.toISOString(),
      updated_at: updatedAt.toISOString(),
      loaded_at: loadedAt.toISOString()
    };
  });

  const factStatusTransitions = transitions.map((transition) => ({
    transition_id: transition.id,
    dispute_id: transition.dispute_id,
    date_key: registerDate(transition.created_at),
    from_status: transition.from_status,
    to_status: transition.to_status,
    actor_key: stableKey(transition.changed_by),
    occurred_at: toDate(transition.created_at).toISOString()
  }));

  return {
    dim_date: [...dates.values()].sort((a, b) => a.date_key - b.date_key),
    dim_dispute_reason: [...reasons.values()].sort((a, b) => a.reason_code.localeCompare(b.reason_code)),
    dim_merchant: [...merchants.values()].sort((a, b) => a.merchant_name.localeCompare(b.merchant_name)),
    fact_disputes: factDisputes,
    fact_status_transitions: factStatusTransitions
  };
}
