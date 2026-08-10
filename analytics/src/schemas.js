export const tableSchemas = {
  dim_date: [
    { name: 'date_key', type: 'INTEGER', mode: 'REQUIRED' },
    { name: 'full_date', type: 'DATE', mode: 'REQUIRED' },
    { name: 'year', type: 'INTEGER', mode: 'REQUIRED' },
    { name: 'quarter', type: 'INTEGER', mode: 'REQUIRED' },
    { name: 'month', type: 'INTEGER', mode: 'REQUIRED' },
    { name: 'day', type: 'INTEGER', mode: 'REQUIRED' }
  ],
  dim_dispute_reason: [
    { name: 'reason_key', type: 'STRING', mode: 'REQUIRED' },
    { name: 'reason_code', type: 'STRING', mode: 'REQUIRED' },
    { name: 'reason_label', type: 'STRING', mode: 'REQUIRED' }
  ],
  dim_merchant: [
    { name: 'merchant_key', type: 'STRING', mode: 'REQUIRED' },
    { name: 'merchant_name', type: 'STRING', mode: 'REQUIRED' }
  ],
  fact_disputes: [
    { name: 'dispute_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'customer_key', type: 'STRING', mode: 'REQUIRED' },
    { name: 'transaction_key', type: 'STRING', mode: 'REQUIRED' },
    { name: 'date_key', type: 'INTEGER', mode: 'REQUIRED' },
    { name: 'reason_key', type: 'STRING', mode: 'REQUIRED' },
    { name: 'merchant_key', type: 'STRING', mode: 'REQUIRED' },
    { name: 'amount', type: 'NUMERIC', mode: 'REQUIRED' },
    { name: 'currency', type: 'STRING', mode: 'REQUIRED' },
    { name: 'status', type: 'STRING', mode: 'REQUIRED' },
    { name: 'resolution_hours', type: 'FLOAT' },
    { name: 'version', type: 'INTEGER', mode: 'REQUIRED' },
    { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
    { name: 'updated_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
    { name: 'loaded_at', type: 'TIMESTAMP', mode: 'REQUIRED' }
  ],
  fact_status_transitions: [
    { name: 'transition_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'dispute_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'date_key', type: 'INTEGER', mode: 'REQUIRED' },
    { name: 'from_status', type: 'STRING' },
    { name: 'to_status', type: 'STRING', mode: 'REQUIRED' },
    { name: 'actor_key', type: 'STRING', mode: 'REQUIRED' },
    { name: 'occurred_at', type: 'TIMESTAMP', mode: 'REQUIRED' }
  ]
};

