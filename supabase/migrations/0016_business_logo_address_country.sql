-- Migration: 0016_business_logo_address_country.sql
-- Add logo_url, address, and country columns to businesses table for richer organization profiling

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS country text;
