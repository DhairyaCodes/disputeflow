-- Resolution performance by dispute reason.
SELECT
  r.reason_label,
  COUNT(*) AS dispute_count,
  ROUND(AVG(f.resolution_hours), 2) AS average_resolution_hours
FROM `disputeflow_analytics.fact_disputes` AS f
JOIN `disputeflow_analytics.dim_dispute_reason` AS r USING (reason_key)
WHERE f.resolution_hours IS NOT NULL
GROUP BY r.reason_label
ORDER BY dispute_count DESC;

-- Daily case funnel and value under review.
SELECT
  d.full_date,
  f.status,
  COUNT(*) AS dispute_count,
  SUM(f.amount) AS disputed_amount
FROM `disputeflow_analytics.fact_disputes` AS f
JOIN `disputeflow_analytics.dim_date` AS d USING (date_key)
GROUP BY d.full_date, f.status
ORDER BY d.full_date DESC, f.status;

-- Cases exceeding a 48-hour resolution target.
SELECT
  f.dispute_id,
  m.merchant_name,
  r.reason_label,
  f.resolution_hours
FROM `disputeflow_analytics.fact_disputes` AS f
JOIN `disputeflow_analytics.dim_merchant` AS m USING (merchant_key)
JOIN `disputeflow_analytics.dim_dispute_reason` AS r USING (reason_key)
WHERE f.resolution_hours > 48
ORDER BY f.resolution_hours DESC;
