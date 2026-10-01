-- Migration 0014: Active Contract Escrow Lock
-- Prevents duplicate in-flight transactions on the same contract regardless of negotiation_id
-- Guarantees that at most one active escrow (pending, funded, escrowed) can exist per contract

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_active_contract
ON transactions (business_id, contract_id)
WHERE contract_id IS NOT NULL AND status IN ('pending', 'funded', 'escrowed');
