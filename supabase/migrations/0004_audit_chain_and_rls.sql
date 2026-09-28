-- Migration: 0004_audit_chain_and_rls.sql
-- Cryptographic audit trail chaining, database-level immutability triggers,
-- single payment per negotiation constraint, and Supabase Row-Level Security (RLS)

-- 1. Deduplicate historical test transactions before creating unique index
WITH ranked_txs AS (
  SELECT id, negotiation_id,
         ROW_NUMBER() OVER (PARTITION BY negotiation_id ORDER BY created_at DESC) as rn
  FROM transactions
  WHERE negotiation_id IS NOT NULL AND status != 'failed'
)
UPDATE transactions
SET status = 'failed'
WHERE id IN (
  SELECT id FROM ranked_txs WHERE rn > 1
);

-- 2. Partial unique index to strictly enforce one on-chain payment per negotiation
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_unique_negotiation
ON transactions (negotiation_id)
WHERE negotiation_id IS NOT NULL AND status != 'failed';

-- 3. Audit trail hash chaining columns on agent_actions
ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS prev_hash text;
ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS hash text;

-- 4. Backfill existing agent_actions rows with deterministic sha256 hash chain
DO $$
DECLARE
  r RECORD;
  current_prev text := '0000000000000000000000000000000000000000000000000000000000000000';
  computed_h text;
BEGIN
  FOR r IN SELECT id, business_id, action, coalesce(reason, '') as reason, coalesce(input::text, '') as in_txt, coalesce(result::text, '') as res_txt, created_at FROM agent_actions ORDER BY created_at ASC, id ASC LOOP
    computed_h := encode(digest(current_prev || r.business_id::text || r.action || r.reason || r.in_txt || r.res_txt || r.created_at::text, 'sha256'), 'hex');
    UPDATE agent_actions SET prev_hash = current_prev, hash = computed_h WHERE id = r.id;
    current_prev := computed_h;
  END LOOP;
END $$;

-- 5. Trigger function to compute hash on INSERT if not supplied
CREATE OR REPLACE FUNCTION compute_agent_actions_hash()
RETURNS TRIGGER AS $$
DECLARE
  latest_hash text;
BEGIN
  IF NEW.prev_hash IS NULL THEN
    SELECT hash INTO latest_hash FROM agent_actions ORDER BY created_at DESC, id DESC LIMIT 1;
    NEW.prev_hash := COALESCE(latest_hash, '0000000000000000000000000000000000000000000000000000000000000000');
  END IF;

  IF NEW.hash IS NULL THEN
    NEW.hash := encode(digest(
      NEW.prev_hash ||
      NEW.business_id::text ||
      NEW.action ||
      COALESCE(NEW.reason, '') ||
      COALESCE(NEW.input::text, '') ||
      COALESCE(NEW.result::text, '') ||
      COALESCE(NEW.created_at::text, now()::text),
      'sha256'
    ), 'hex');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agent_actions_hash ON agent_actions;
CREATE TRIGGER trg_agent_actions_hash
BEFORE INSERT ON agent_actions
FOR EACH ROW EXECUTE FUNCTION compute_agent_actions_hash();

-- 6. Trigger functions to strictly prevent UPDATE and DELETE on agent_actions (Immutable Ledger)
CREATE OR REPLACE FUNCTION prevent_agent_actions_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'agent_actions is an immutable append-only ledger: UPDATE and DELETE operations are strictly prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agent_actions_no_update ON agent_actions;
CREATE TRIGGER trg_agent_actions_no_update
BEFORE UPDATE ON agent_actions
FOR EACH ROW EXECUTE FUNCTION prevent_agent_actions_mutation();

DROP TRIGGER IF EXISTS trg_agent_actions_no_delete ON agent_actions;
CREATE TRIGGER trg_agent_actions_no_delete
BEFORE DELETE ON agent_actions
FOR EACH ROW EXECUTE FUNCTION prevent_agent_actions_mutation();

-- 7. Multi-tenant Business Membership table
CREATE TABLE IF NOT EXISTS business_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_business_members_user ON business_members(user_id);
CREATE INDEX IF NOT EXISTS idx_business_members_business ON business_members(business_id);

-- 8. Helper function for RLS to resolve the authenticated user's authorized business IDs
CREATE OR REPLACE FUNCTION get_user_business_ids()
RETURNS SETOF uuid AS $$
  SELECT business_id FROM business_members WHERE user_id = auth.uid()
  UNION
  SELECT (auth.jwt() -> 'user_metadata' ->> 'business_id')::uuid
  WHERE (auth.jwt() -> 'user_metadata' ->> 'business_id') IS NOT NULL
  UNION
  SELECT (auth.jwt() -> 'app_metadata' ->> 'business_id')::uuid
  WHERE (auth.jwt() -> 'app_metadata' ->> 'business_id') IS NOT NULL;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 9. Enable Row-Level Security (RLS) across all core relational tables
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE negotiations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

-- 10. Drop existing policies to ensure clean idempotent application
DROP POLICY IF EXISTS "business_member_select" ON businesses;
DROP POLICY IF EXISTS "business_member_update" ON businesses;
DROP POLICY IF EXISTS "service_role_all" ON businesses;

DROP POLICY IF EXISTS "business_members_select" ON business_members;
DROP POLICY IF EXISTS "service_role_all" ON business_members;

DROP POLICY IF EXISTS "contracts_member_access" ON contracts;
DROP POLICY IF EXISTS "service_role_all" ON contracts;

DROP POLICY IF EXISTS "policies_member_access" ON policies;
DROP POLICY IF EXISTS "service_role_all" ON policies;

DROP POLICY IF EXISTS "transactions_member_access" ON transactions;
DROP POLICY IF EXISTS "service_role_all" ON transactions;

DROP POLICY IF EXISTS "notifications_member_access" ON notifications;
DROP POLICY IF EXISTS "service_role_all" ON notifications;

DROP POLICY IF EXISTS "approvals_member_access" ON approvals;
DROP POLICY IF EXISTS "service_role_all" ON approvals;

DROP POLICY IF EXISTS "agent_actions_member_select" ON agent_actions;
DROP POLICY IF EXISTS "service_role_all" ON agent_actions;

DROP POLICY IF EXISTS "negotiations_member_access" ON negotiations;
DROP POLICY IF EXISTS "service_role_all" ON negotiations;

DROP POLICY IF EXISTS "vendor_memory_member_access" ON vendor_memory;
DROP POLICY IF EXISTS "service_role_all" ON vendor_memory;

DROP POLICY IF EXISTS "vendors_select" ON vendors;
DROP POLICY IF EXISTS "service_role_all" ON vendors;

-- 11. Create authenticated tenant-isolation policies
CREATE POLICY "business_member_select" ON businesses
  FOR SELECT TO authenticated
  USING (id IN (SELECT get_user_business_ids()));

CREATE POLICY "business_member_update" ON businesses
  FOR UPDATE TO authenticated
  USING (id IN (SELECT get_user_business_ids()));

CREATE POLICY "business_members_select" ON business_members
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()) OR user_id = auth.uid());

CREATE POLICY "contracts_member_access" ON contracts
  FOR ALL TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "policies_member_access" ON policies
  FOR ALL TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "transactions_member_access" ON transactions
  FOR ALL TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "notifications_member_access" ON notifications
  FOR ALL TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "approvals_member_access" ON approvals
  FOR ALL TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "agent_actions_member_select" ON agent_actions
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "negotiations_member_access" ON negotiations
  FOR ALL TO authenticated
  USING (contract_id IN (SELECT id FROM contracts WHERE business_id IN (SELECT get_user_business_ids())))
  WITH CHECK (contract_id IN (SELECT id FROM contracts WHERE business_id IN (SELECT get_user_business_ids())));

CREATE POLICY "vendor_memory_member_access" ON vendor_memory
  FOR ALL TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "vendors_select" ON vendors
  FOR SELECT TO authenticated
  USING (true);

-- 12. Create explicit service_role bypass policies for background deterministic tools
CREATE POLICY "service_role_all" ON businesses FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON business_members FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON contracts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON policies FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON transactions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON notifications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON approvals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON agent_actions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON negotiations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON vendor_memory FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON vendors FOR ALL TO service_role USING (true) WITH CHECK (true);
