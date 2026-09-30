-- 0007_receipts.sql
-- Shareable public cryptographic savings receipts for completed transactions

CREATE TABLE IF NOT EXISTS receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  show_business_name boolean NOT NULL DEFAULT true,
  show_vendor_name boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_receipts_token ON receipts(token);
CREATE INDEX IF NOT EXISTS idx_receipts_transaction_id ON receipts(transaction_id);
CREATE INDEX IF NOT EXISTS idx_receipts_business_id ON receipts(business_id);

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- Allow public read of unrevoked receipts
CREATE POLICY "Public read for unrevoked receipts"
  ON receipts FOR SELECT
  USING (revoked_at IS NULL);

-- Allow authenticated business members to manage their receipts
CREATE POLICY "Business members manage receipts"
  ON receipts FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM business_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM business_members WHERE user_id = auth.uid()
    )
  );

GRANT SELECT ON receipts TO anon, authenticated;
GRANT ALL ON receipts TO service_role;
