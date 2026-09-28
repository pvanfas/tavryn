-- Migration: 0003_notifications.sql
-- In-app notifications table for proactive agent events, renewals, and policy alerts

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES contracts(id) ON DELETE SET NULL,
  negotiation_id uuid REFERENCES negotiations(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'renewal' CHECK (category IN ('renewal', 'negotiation', 'policy', 'treasury', 'audit')),
  title text NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  link text,
  link_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indices for rapid querying by business, contract, and unread status
CREATE INDEX IF NOT EXISTS idx_notifications_business_id ON notifications(business_id);
CREATE INDEX IF NOT EXISTS idx_notifications_contract_id ON notifications(contract_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
