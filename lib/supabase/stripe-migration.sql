-- Add Stripe price ID columns to premium_plans for Stripe integration
-- Run this migration in your Supabase SQL editor

-- Add Stripe product and price ID columns
ALTER TABLE public.premium_plans
ADD COLUMN IF NOT EXISTS stripe_product_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_monthly_price_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_yearly_price_id TEXT;

-- Add Stripe customer ID to profiles if not exists
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id 
ON public.profiles(stripe_customer_id) 
WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_premium_subscriptions_stripe_subscription_id 
ON public.user_premium_subscriptions(stripe_subscription_id) 
WHERE stripe_subscription_id IS NOT NULL;

-- Update the premium plan with Stripe price IDs
-- Replace these with your actual Stripe Price IDs from your Stripe Dashboard
-- You can find these in Stripe Dashboard > Products > Your Product > Pricing

-- Example (uncomment and update with your actual price IDs):
-- UPDATE public.premium_plans
-- SET 
--   stripe_monthly_price_id = 'price_xxxxxxxxxxxxx', -- Your monthly price ID
--   stripe_yearly_price_id = 'price_yyyyyyyyyyyyy'   -- Your yearly price ID  
-- WHERE name = 'creator_premium';

-- Insert a default premium plan if it doesn't exist
INSERT INTO public.premium_plans (name, display_name, description, price_monthly, price_yearly, monthly_coins, features, is_active)
VALUES (
  'creator_premium',
  'Creator Premium', 
  'Unlock monetization features and earn from your AI characters',
  6.99,
  59.99,
  500,
  '["Enable monetization on AI characters", "Create unlimited subscription tiers", "Receive tips from fans", "Access detailed analytics dashboard", "Priority content generation", "500 coins included monthly"]'::jsonb,
  true
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  monthly_coins = EXCLUDED.monthly_coins,
  features = EXCLUDED.features;

COMMENT ON COLUMN public.premium_plans.stripe_product_id IS 'Stripe Product ID (auto-created by the application)';
COMMENT ON COLUMN public.premium_plans.stripe_monthly_price_id IS 'Stripe Price ID for monthly billing (auto-created by the application)';
COMMENT ON COLUMN public.premium_plans.stripe_yearly_price_id IS 'Stripe Price ID for yearly billing (auto-created by the application)';
