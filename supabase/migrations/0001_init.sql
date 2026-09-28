-- 0001_init.sql
-- Initial schema for Business Money Agent

-- Enable pgcrypto / uuid-ossp for gen_random_uuid() if not enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Businesses
CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  wallet_address text,
  default_currency text DEFAULT 'USDC',
  is_real boolean DEFAULT false,
  treasury_balance numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Vendors
CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  contact text,
  reputation_score numeric,
  is_simulated boolean DEFAULT false,
  wallet_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Contracts
CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL,
  service text NOT NULL,
  category text NOT NULL,
  current_price numeric NOT NULL,
  renewal_date timestamptz NOT NULL,
  seat_count integer,
  active_seats integer,
  usage_metric jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'negotiating', 'renewed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Negotiations
CREATE TABLE IF NOT EXISTS negotiations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  original_price numeric NOT NULL,
  target_price numeric,
  current_offer numeric,
  status text NOT NULL DEFAULT 'initiated',
  conversation jsonb,
  final_price numeric,
  savings numeric,
  rounds integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Policies
CREATE TABLE IF NOT EXISTS policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,
  max_auto_transaction numeric NOT NULL,
  min_savings numeric NOT NULL,
  human_approval_required_above numeric NOT NULL,
  allowed_categories text[] NOT NULL DEFAULT '{}',
  category_budgets jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES contracts(id) ON DELETE SET NULL,
  negotiation_id uuid REFERENCES negotiations(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  currency text DEFAULT 'USDC',
  escrow_address text,
  status text NOT NULL,
  tx_hash text,
  idempotency_key text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Agent Actions (Append-only: never update or delete)
CREATE TABLE IF NOT EXISTS agent_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  action text NOT NULL,
  reason text,
  confidence numeric,
  input jsonb,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. Approvals
CREATE TABLE IF NOT EXISTS approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  negotiation_id uuid REFERENCES negotiations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Helpful indices for lookup performance
CREATE INDEX IF NOT EXISTS idx_contracts_business_id ON contracts(business_id);
CREATE INDEX IF NOT EXISTS idx_contracts_vendor_id ON contracts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_negotiations_contract_id ON negotiations(contract_id);
CREATE INDEX IF NOT EXISTS idx_transactions_business_id ON transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_business_id ON agent_actions(business_id);
