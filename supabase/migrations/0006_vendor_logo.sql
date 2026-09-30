-- 0006_vendor_logo.sql
-- Add logo_url column to vendors table for custom vendor logo branding
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS logo_url text;
