-- Migration 033: Add Stripe fields to billing_info
-- Description: Add stripe_customer_id and stripe_payment_method_id to billing_info

ALTER TABLE auth_schema.billing_info ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE auth_schema.billing_info ADD COLUMN IF NOT EXISTS stripe_payment_method_id VARCHAR(255);
