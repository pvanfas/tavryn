-- Migration: 0002_vendor_memory.sql
-- Persistent business memory for vendor negotiation outcomes and concession patterns

CREATE TABLE IF NOT EXISTS vendor_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES contracts(id) ON DELETE SET NULL,
  negotiation_id uuid REFERENCES negotiations(id) ON DELETE SET NULL,
  last_price numeric NOT NULL,
  accepted_discount_pct numeric NOT NULL,
  rounds_to_close integer NOT NULL DEFAULT 1,
  outcome text NOT NULL CHECK (outcome IN ('success', 'walked_away', 'disputed', 'pending')),
  delivered_ok boolean DEFAULT true,
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indices for rapid lookup during negotiation intelligence gathering
CREATE INDEX IF NOT EXISTS idx_vendor_memory_vendor ON vendor_memory(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_memory_business ON vendor_memory(business_id);
CREATE INDEX IF NOT EXISTS idx_vendor_memory_outcome ON vendor_memory(outcome);
