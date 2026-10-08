-- Migration 0015: Hot-path Query Performance Indexes
-- Adds missing indexes for contracts renewal dates, transaction timestamps, audit trails, and approvals

-- 1. Contracts renewal date & business scoping (dashboard, contracts ledger, agent cron)
CREATE INDEX IF NOT EXISTS idx_contracts_renewal_date ON contracts(renewal_date);
CREATE INDEX IF NOT EXISTS idx_contracts_business_renewal ON contracts(business_id, renewal_date);

-- 2. Transactions recency and status (dashboard latest transaction, metrics velocity)
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_business_created ON transactions(business_id, created_at DESC);

-- 3. Agent actions chronological sequence (audit ledger chain verification)
CREATE INDEX IF NOT EXISTS idx_agent_actions_business_created ON agent_actions(business_id, created_at ASC);

-- 4. Approvals scoping by business and status (dashboard approvals count, metrics)
CREATE INDEX IF NOT EXISTS idx_approvals_business_status ON approvals(business_id, status);

-- 5. Negotiations ordering (metrics & negotiations list)
CREATE INDEX IF NOT EXISTS idx_negotiations_created_at ON negotiations(created_at DESC);
