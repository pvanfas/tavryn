-- Migration 0012: Explicit Transaction Simulation Tracking
-- Stage 0036: Honest transaction labeling
-- Ensures every transaction record carries an explicit boolean distinguishing live on-chain vs simulated transactions.

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_simulated boolean NOT NULL DEFAULT false;

-- Index for high-performance filtering of live vs simulated transactions
CREATE INDEX IF NOT EXISTS idx_transactions_is_simulated ON transactions(is_simulated);
