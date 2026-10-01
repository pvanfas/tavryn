-- Migration 0013: Strict Unlinked Contract Idempotency Index
-- Prevents duplicate in-flight transactions for the same contract when negotiation_id is NULL

-- 1. Deduplicate historical unlinked transactions by marking older duplicates as failed
WITH ranked_contract_txs AS (
  SELECT id, business_id, contract_id,
         ROW_NUMBER() OVER (PARTITION BY business_id, contract_id ORDER BY created_at DESC) as rn
  FROM transactions
  WHERE contract_id IS NOT NULL AND negotiation_id IS NULL AND status != 'failed'
)
UPDATE transactions
SET status = 'failed'
WHERE id IN (
  SELECT id FROM ranked_contract_txs WHERE rn > 1
);

-- 2. Drop any legacy unlinked index if it exists
DROP INDEX IF EXISTS idx_transactions_unique_contract_unlinked;

-- 3. Create partial unique index scoped to (business_id, contract_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_unique_contract_unlinked
ON transactions (business_id, contract_id)
WHERE negotiation_id IS NULL AND status != 'failed';
