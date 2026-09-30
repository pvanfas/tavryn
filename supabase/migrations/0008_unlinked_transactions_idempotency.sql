-- Migration 0008: Strict Unlinked Transactions Idempotency
-- Prevents duplicate transactions on the same contract when negotiation_id is NULL

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_unique_contract_unlinked
ON transactions (contract_id)
WHERE negotiation_id IS NULL AND contract_id IS NOT NULL AND status != 'failed';
