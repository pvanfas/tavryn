-- Migration 0009: Reviewer Agent Table
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  negotiation_id uuid REFERENCES negotiations(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES contracts(id) ON DELETE CASCADE,
  verdict text NOT NULL CHECK (verdict IN ('agree', 'challenge', 'reject')),
  concerns jsonb NOT NULL DEFAULT '[]'::jsonb,
  suggested_action text,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_negotiation_id ON reviews(negotiation_id);
CREATE INDEX IF NOT EXISTS idx_reviews_business_id ON reviews(business_id);
