-- Add juice_bar to business_activity_type (app already uses it; restaurant already exists).
-- Align supermarket orgs: disable variants when activity is supermarket.

ALTER TYPE business_activity_type ADD VALUE IF NOT EXISTS 'juice_bar';

UPDATE app_settings
SET value = value || jsonb_build_object('enable_variants', false)
WHERE key = 'business_activity'
  AND COALESCE(value->>'activity_type', '') = 'supermarket'
  AND COALESCE((value->>'enable_variants')::boolean, true) = true;
