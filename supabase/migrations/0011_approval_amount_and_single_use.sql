-- Migration 0011: Approval Amount and Single-Use Consumption Tracking
-- Stage 0010: Policy authorization patch
-- Fixes security vulnerabilities where approvals had no amount limits and could be reused indefinitely.

ALTER TABLE approvals ADD COLUMN IF NOT EXISTS amount numeric;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS used_at timestamptz;

-- Index for high-performance scoped lookup of active approvals
CREATE INDEX IF NOT EXISTS idx_approvals_negotiation_unused
ON approvals (business_id, negotiation_id, status)
WHERE used_at IS NULL;
