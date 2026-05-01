-- Fix existing tickets that have NULL sla_deadline
-- Sets the SLA deadline based on priority using the same logic as the app:
--   Critical: 4h, High: 8h, Medium: 24h, Low: 72h
-- Since these are already old tickets, the deadline is set relative to their created_at timestamp.

UPDATE tickets
SET sla_deadline = created_at + CASE priority
  WHEN 'Critical' THEN INTERVAL '4 hours'
  WHEN 'High'     THEN INTERVAL '8 hours'
  WHEN 'Medium'   THEN INTERVAL '24 hours'
  WHEN 'Low'      THEN INTERVAL '72 hours'
  ELSE INTERVAL '24 hours'
END
WHERE sla_deadline IS NULL;
