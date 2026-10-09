-- Migration: 0008_industry_column.sql
-- Add industry column to businesses table for company categorization

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS industry text;
