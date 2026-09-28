-- Migration: 0005_onboarding_and_settings.sql
-- Onboarding event tracking, per-business webhook configuration, and RLS policies for self-service

-- 1. Add webhook_url column to businesses table
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS webhook_url text;

-- 2. Create onboarding_events table for audit and reporting
CREATE TABLE IF NOT EXISTS onboarding_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  user_id uuid,
  event_type text NOT NULL DEFAULT 'business_created',
  step text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_events_business ON onboarding_events(business_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_events_created_at ON onboarding_events(created_at);

-- 3. Enable RLS on onboarding_events
ALTER TABLE onboarding_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "onboarding_events_member_select" ON onboarding_events;
CREATE POLICY "onboarding_events_member_select" ON onboarding_events
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));

DROP POLICY IF EXISTS "service_role_all" ON onboarding_events;
CREATE POLICY "service_role_all" ON onboarding_events
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Enable policies update for authenticated business members
DROP POLICY IF EXISTS "policies_member_update" ON policies;
CREATE POLICY "policies_member_update" ON policies
  FOR UPDATE TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

-- 5. Enable businesses update for authenticated members (e.g. updating webhook_url)
DROP POLICY IF EXISTS "business_member_update" ON businesses;
CREATE POLICY "business_member_update" ON businesses
  FOR UPDATE TO authenticated
  USING (id IN (SELECT get_user_business_ids()))
  WITH CHECK (id IN (SELECT get_user_business_ids()));
