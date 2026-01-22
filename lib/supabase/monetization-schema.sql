-- ========================================
-- Monetization System Schema
-- AI Influencer Platform - Patreon-style Monetization
-- ========================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- Premium Subscriptions (Platform Level)
-- ========================================

-- Premium plans configuration
CREATE TABLE IF NOT EXISTS public.premium_plans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE, -- 'creator_premium'
  display_name TEXT NOT NULL, -- 'Creator Premium'
  description TEXT,
  price_monthly DECIMAL(10, 2) NOT NULL, -- 6.99
  price_yearly DECIMAL(10, 2), -- Optional yearly discount
  features JSONB NOT NULL DEFAULT '[]', -- List of features
  monthly_coins INTEGER NOT NULL DEFAULT 0, -- Coins included per month
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User premium subscriptions
CREATE TABLE IF NOT EXISTS public.user_premium_subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES public.premium_plans(id) ON DELETE RESTRICT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT, -- For Stripe integration
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- Coins Virtual Currency System
-- ========================================

-- User coin balances
CREATE TABLE IF NOT EXISTS public.user_coin_balances (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_earned INTEGER NOT NULL DEFAULT 0, -- Total coins ever received
  lifetime_spent INTEGER NOT NULL DEFAULT 0, -- Total coins ever spent
  auto_recharge_enabled BOOLEAN DEFAULT false,
  auto_recharge_threshold INTEGER DEFAULT 100, -- Recharge when below this
  auto_recharge_amount INTEGER DEFAULT 500, -- Amount to purchase
  last_monthly_allocation TIMESTAMPTZ, -- Track premium coin allocation
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coin packages for purchase
CREATE TABLE IF NOT EXISTS public.coin_packages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  coin_amount INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  bonus_coins INTEGER DEFAULT 0, -- Extra coins as bonus
  is_popular BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coin transactions (all coin movements)
CREATE TABLE IF NOT EXISTS public.coin_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'purchase', -- Bought coins
    'premium_allocation', -- Monthly premium allocation
    'image_generation', -- Used for generating image
    'tip_sent', -- Converted to tip
    'refund', -- Refund
    'bonus', -- Promotional bonus
    'admin_adjustment' -- Admin adjustment
  )),
  amount INTEGER NOT NULL, -- Positive for credits, negative for debits
  balance_after INTEGER NOT NULL, -- Balance after transaction
  reference_type TEXT, -- 'coin_package', 'character_image', 'tip', etc.
  reference_id UUID, -- ID of related record
  description TEXT,
  metadata JSONB DEFAULT '{}',
  stripe_payment_intent_id TEXT, -- For purchases
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- Creator Monetization - Subscription Tiers
-- ========================================

-- Creator subscription tiers (per character)
CREATE TABLE IF NOT EXISTS public.creator_tiers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  character_id UUID REFERENCES public.characters(id) ON DELETE CASCADE NOT NULL,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL, -- e.g., "Bronze", "Silver", "Gold"
  description TEXT,
  price_monthly DECIMAL(10, 2) NOT NULL CHECK (price_monthly >= 0),
  tier_level INTEGER NOT NULL DEFAULT 1, -- 1, 2, 3... for ordering
  benefits JSONB DEFAULT '[]', -- Array of benefit descriptions
  -- Access controls
  exclusive_posts BOOLEAN DEFAULT false,
  private_chat BOOLEAN DEFAULT false,
  custom_images BOOLEAN DEFAULT false,
  custom_images_per_month INTEGER DEFAULT 0,
  priority_responses BOOLEAN DEFAULT false,
  behind_the_scenes BOOLEAN DEFAULT false,
  early_access BOOLEAN DEFAULT false,
  -- Visual
  badge_color TEXT DEFAULT '#8b5cf6',
  badge_emoji TEXT,
  -- Stats
  subscriber_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(character_id, tier_level)
);

-- User subscriptions to creator tiers
CREATE TABLE IF NOT EXISTS public.fan_subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  fan_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  tier_id UUID REFERENCES public.creator_tiers(id) ON DELETE CASCADE NOT NULL,
  character_id UUID REFERENCES public.characters(id) ON DELETE CASCADE NOT NULL,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  custom_images_used_this_month INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fan_id, character_id) -- One subscription per character per fan
);

-- ========================================
-- Tips System
-- ========================================

-- Tips from fans to creators
CREATE TABLE IF NOT EXISTS public.tips (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  fan_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  character_id UUID REFERENCES public.characters(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  coin_amount INTEGER, -- If paid with coins
  message TEXT, -- Optional message with tip
  is_anonymous BOOLEAN DEFAULT false,
  stripe_payment_intent_id TEXT, -- For direct payments
  coin_transaction_id UUID REFERENCES public.coin_transactions(id), -- If paid with coins
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- Character Monetization Settings
-- ========================================

-- Monetization settings per character
CREATE TABLE IF NOT EXISTS public.character_monetization (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  character_id UUID REFERENCES public.characters(id) ON DELETE CASCADE NOT NULL UNIQUE,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  is_monetized BOOLEAN DEFAULT false,
  tips_enabled BOOLEAN DEFAULT true,
  min_tip_amount DECIMAL(10, 2) DEFAULT 1.00,
  fan_image_requests_enabled BOOLEAN DEFAULT false, -- Allow fans to request images
  fan_image_request_cost INTEGER DEFAULT 50, -- Coin cost for fan image requests
  welcome_message TEXT, -- Message shown to new subscribers
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- User Interaction Tracking
-- ========================================

-- Detailed interaction tracking per character
CREATE TABLE IF NOT EXISTS public.user_interactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  character_id UUID REFERENCES public.characters(id) ON DELETE CASCADE NOT NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN (
    'message_sent', -- Chat message
    'message_received', -- Response from AI
    'image_generated', -- Image generation
    'image_viewed', -- Viewed character image
    'post_viewed', -- Viewed social post
    'post_liked', -- Liked post
    'post_commented', -- Commented on post
    'post_shared', -- Shared post
    'profile_viewed', -- Viewed character profile
    'subscription_started', -- Started subscription
    'subscription_cancelled', -- Cancelled subscription
    'subscription_upgraded', -- Upgraded tier
    'tip_sent', -- Sent a tip
    'follow', -- Followed character
    'unfollow' -- Unfollowed character
  )),
  session_id UUID, -- Group interactions by session
  metadata JSONB DEFAULT '{}', -- Additional context
  duration_seconds INTEGER, -- For time-based interactions
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily aggregated stats per character (for fast analytics)
CREATE TABLE IF NOT EXISTS public.character_daily_stats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  character_id UUID REFERENCES public.characters(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  -- Engagement
  messages_received INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  images_generated INTEGER DEFAULT 0,
  profile_views INTEGER DEFAULT 0,
  post_views INTEGER DEFAULT 0,
  post_likes INTEGER DEFAULT 0,
  post_comments INTEGER DEFAULT 0,
  post_shares INTEGER DEFAULT 0,
  -- Growth
  new_followers INTEGER DEFAULT 0,
  unfollows INTEGER DEFAULT 0,
  new_subscribers INTEGER DEFAULT 0,
  churned_subscribers INTEGER DEFAULT 0,
  -- Revenue
  subscription_revenue DECIMAL(10, 2) DEFAULT 0,
  tip_revenue DECIMAL(10, 2) DEFAULT 0,
  total_revenue DECIMAL(10, 2) DEFAULT 0,
  -- Unique users
  unique_chatters INTEGER DEFAULT 0,
  unique_viewers INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(character_id, date)
);

-- ========================================
-- Follows System
-- ========================================

-- User follows (free follow, no subscription)
CREATE TABLE IF NOT EXISTS public.user_follows (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  character_id UUID REFERENCES public.characters(id) ON DELETE CASCADE NOT NULL,
  notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, character_id)
);

-- ========================================
-- Creator Payouts
-- ========================================

-- Creator earnings and payouts
CREATE TABLE IF NOT EXISTS public.creator_earnings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  character_id UUID REFERENCES public.characters(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('subscription', 'tip')),
  source_id UUID, -- fan_subscription.id or tip.id
  gross_amount DECIMAL(10, 2) NOT NULL,
  platform_fee DECIMAL(10, 2) NOT NULL, -- Platform's cut
  net_amount DECIMAL(10, 2) NOT NULL, -- Creator receives
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'available', 'paid_out', 'refunded')),
  available_at TIMESTAMPTZ, -- When funds become available
  payout_id UUID, -- Reference to payout batch
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Creator payout settings
CREATE TABLE IF NOT EXISTS public.creator_payout_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  stripe_connect_account_id TEXT, -- Stripe Connect for payouts
  payout_threshold DECIMAL(10, 2) DEFAULT 50.00, -- Minimum for payout
  payout_schedule TEXT DEFAULT 'monthly' CHECK (payout_schedule IN ('weekly', 'biweekly', 'monthly')),
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payout batches
CREATE TABLE IF NOT EXISTS public.creator_payouts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  stripe_transfer_id TEXT,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- Discovery & Ranking
-- ========================================

-- Character rankings for discovery (updated periodically)
CREATE TABLE IF NOT EXISTS public.character_rankings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  character_id UUID REFERENCES public.characters(id) ON DELETE CASCADE NOT NULL UNIQUE,
  -- Popularity metrics
  follower_count INTEGER DEFAULT 0,
  subscriber_count INTEGER DEFAULT 0,
  total_interactions INTEGER DEFAULT 0,
  -- Engagement metrics (7-day rolling)
  engagement_score DECIMAL(10, 4) DEFAULT 0,
  messages_7d INTEGER DEFAULT 0,
  images_7d INTEGER DEFAULT 0,
  views_7d INTEGER DEFAULT 0,
  -- Revenue metrics (for premium creators)
  revenue_30d DECIMAL(10, 2) DEFAULT 0,
  -- Calculated scores
  popularity_rank INTEGER,
  engagement_rank INTEGER,
  trending_score DECIMAL(10, 4) DEFAULT 0, -- Based on recent growth
  -- Metadata
  category TEXT,
  tags TEXT[],
  is_featured BOOLEAN DEFAULT false,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- Indexes for Performance
-- ========================================

-- Premium subscriptions
CREATE INDEX IF NOT EXISTS idx_user_premium_user_id ON public.user_premium_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_premium_status ON public.user_premium_subscriptions(status);

-- Coin balances and transactions
CREATE INDEX IF NOT EXISTS idx_coin_balances_user_id ON public.user_coin_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_user_id ON public.coin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_type ON public.coin_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_created ON public.coin_transactions(created_at);

-- Creator tiers
CREATE INDEX IF NOT EXISTS idx_creator_tiers_character_id ON public.creator_tiers(character_id);
CREATE INDEX IF NOT EXISTS idx_creator_tiers_creator_id ON public.creator_tiers(creator_id);

-- Fan subscriptions
CREATE INDEX IF NOT EXISTS idx_fan_subscriptions_fan_id ON public.fan_subscriptions(fan_id);
CREATE INDEX IF NOT EXISTS idx_fan_subscriptions_creator_id ON public.fan_subscriptions(creator_id);
CREATE INDEX IF NOT EXISTS idx_fan_subscriptions_character_id ON public.fan_subscriptions(character_id);
CREATE INDEX IF NOT EXISTS idx_fan_subscriptions_status ON public.fan_subscriptions(status);

-- Tips
CREATE INDEX IF NOT EXISTS idx_tips_creator_id ON public.tips(creator_id);
CREATE INDEX IF NOT EXISTS idx_tips_fan_id ON public.tips(fan_id);
CREATE INDEX IF NOT EXISTS idx_tips_character_id ON public.tips(character_id);

-- Character monetization
CREATE INDEX IF NOT EXISTS idx_character_monetization_character_id ON public.character_monetization(character_id);

-- User interactions
CREATE INDEX IF NOT EXISTS idx_user_interactions_user_id ON public.user_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_character_id ON public.user_interactions(character_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_type ON public.user_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_user_interactions_created ON public.user_interactions(created_at);

-- Daily stats
CREATE INDEX IF NOT EXISTS idx_character_daily_stats_character_id ON public.character_daily_stats(character_id);
CREATE INDEX IF NOT EXISTS idx_character_daily_stats_date ON public.character_daily_stats(date);

-- Follows
CREATE INDEX IF NOT EXISTS idx_user_follows_follower_id ON public.user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_character_id ON public.user_follows(character_id);

-- Creator earnings
CREATE INDEX IF NOT EXISTS idx_creator_earnings_creator_id ON public.creator_earnings(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_status ON public.creator_earnings(status);

-- Rankings
CREATE INDEX IF NOT EXISTS idx_character_rankings_popularity ON public.character_rankings(popularity_rank);
CREATE INDEX IF NOT EXISTS idx_character_rankings_engagement ON public.character_rankings(engagement_rank);
CREATE INDEX IF NOT EXISTS idx_character_rankings_trending ON public.character_rankings(trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_character_rankings_category ON public.character_rankings(category);

-- ========================================
-- Row Level Security (RLS)
-- ========================================

ALTER TABLE public.premium_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_premium_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_coin_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fan_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_monetization ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_payout_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_rankings ENABLE ROW LEVEL SECURITY;

-- Premium plans - readable by all
CREATE POLICY "Anyone can view active premium plans" ON public.premium_plans
  FOR SELECT USING (is_active = true);

-- User premium subscriptions
CREATE POLICY "Users can view their own premium subscription" ON public.user_premium_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own premium subscription" ON public.user_premium_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own premium subscription" ON public.user_premium_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

-- Coin balances
CREATE POLICY "Users can view their own coin balance" ON public.user_coin_balances
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own coin balance" ON public.user_coin_balances
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own coin balance" ON public.user_coin_balances
  FOR UPDATE USING (auth.uid() = user_id);

-- Coin packages - readable by all authenticated users
CREATE POLICY "Authenticated users can view coin packages" ON public.coin_packages
  FOR SELECT USING (is_active = true);

-- Coin transactions
CREATE POLICY "Users can view their own coin transactions" ON public.coin_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own coin transactions" ON public.coin_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Creator tiers - public viewing, owner management
CREATE POLICY "Anyone can view active creator tiers" ON public.creator_tiers
  FOR SELECT USING (is_active = true);

CREATE POLICY "Creators can manage their own tiers" ON public.creator_tiers
  FOR ALL USING (auth.uid() = creator_id);

-- Fan subscriptions
CREATE POLICY "Users can view their own fan subscriptions" ON public.fan_subscriptions
  FOR SELECT USING (auth.uid() = fan_id);

CREATE POLICY "Creators can view subscriptions to their characters" ON public.fan_subscriptions
  FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "Users can create their own fan subscriptions" ON public.fan_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = fan_id);

CREATE POLICY "Users can update their own fan subscriptions" ON public.fan_subscriptions
  FOR UPDATE USING (auth.uid() = fan_id);

-- Tips
CREATE POLICY "Users can view tips they sent" ON public.tips
  FOR SELECT USING (auth.uid() = fan_id);

CREATE POLICY "Creators can view tips they received" ON public.tips
  FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "Users can create tips" ON public.tips
  FOR INSERT WITH CHECK (auth.uid() = fan_id OR fan_id IS NULL);

-- Character monetization
CREATE POLICY "Anyone can view monetization status of public characters" ON public.character_monetization
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.characters 
      WHERE id = character_monetization.character_id 
      AND is_public = true
    )
  );

CREATE POLICY "Creators can manage their character monetization" ON public.character_monetization
  FOR ALL USING (auth.uid() = creator_id);

-- User interactions - private to the user
CREATE POLICY "Users can view their own interactions" ON public.user_interactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own interactions" ON public.user_interactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Character daily stats - creators can view their own
CREATE POLICY "Creators can view stats for their characters" ON public.character_daily_stats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.characters 
      WHERE id = character_daily_stats.character_id 
      AND user_id = auth.uid()
    )
  );

-- User follows
CREATE POLICY "Users can view their follows" ON public.user_follows
  FOR SELECT USING (auth.uid() = follower_id);

CREATE POLICY "Users can manage their follows" ON public.user_follows
  FOR ALL USING (auth.uid() = follower_id);

-- Creators can see their followers count (via character_rankings)
CREATE POLICY "Public character follower counts are visible" ON public.user_follows
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.characters 
      WHERE id = user_follows.character_id 
      AND is_public = true
    )
  );

-- Creator earnings
CREATE POLICY "Creators can view their earnings" ON public.creator_earnings
  FOR SELECT USING (auth.uid() = creator_id);

-- Creator payout settings
CREATE POLICY "Creators can manage their payout settings" ON public.creator_payout_settings
  FOR ALL USING (auth.uid() = creator_id);

-- Creator payouts
CREATE POLICY "Creators can view their payouts" ON public.creator_payouts
  FOR SELECT USING (auth.uid() = creator_id);

-- Character rankings - public view
CREATE POLICY "Anyone can view public character rankings" ON public.character_rankings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.characters 
      WHERE id = character_rankings.character_id 
      AND is_public = true
    )
  );

-- ========================================
-- Triggers for updated_at
-- ========================================

CREATE TRIGGER update_premium_plans_updated_at
  BEFORE UPDATE ON public.premium_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_premium_subscriptions_updated_at
  BEFORE UPDATE ON public.user_premium_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_coin_balances_updated_at
  BEFORE UPDATE ON public.user_coin_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_creator_tiers_updated_at
  BEFORE UPDATE ON public.creator_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fan_subscriptions_updated_at
  BEFORE UPDATE ON public.fan_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_character_monetization_updated_at
  BEFORE UPDATE ON public.character_monetization
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_character_daily_stats_updated_at
  BEFORE UPDATE ON public.character_daily_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_creator_payout_settings_updated_at
  BEFORE UPDATE ON public.creator_payout_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_character_rankings_updated_at
  BEFORE UPDATE ON public.character_rankings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========================================
-- Functions for Monetization Logic
-- ========================================

-- Function to check if user has premium subscription
CREATE OR REPLACE FUNCTION public.user_has_premium(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_premium_subscriptions
    WHERE user_id = check_user_id
    AND status = 'active'
    AND current_period_end > NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deduct coins
CREATE OR REPLACE FUNCTION public.deduct_coins(
  p_user_id UUID,
  p_amount INTEGER,
  p_transaction_type TEXT,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, new_balance INTEGER, transaction_id UUID) AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_transaction_id UUID;
BEGIN
  -- Get current balance with lock
  SELECT balance INTO v_current_balance
  FROM public.user_coin_balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN QUERY SELECT false, 0, NULL::UUID;
    RETURN;
  END IF;

  IF v_current_balance < p_amount THEN
    RETURN QUERY SELECT false, v_current_balance, NULL::UUID;
    RETURN;
  END IF;

  v_new_balance := v_current_balance - p_amount;

  -- Update balance
  UPDATE public.user_coin_balances
  SET balance = v_new_balance,
      lifetime_spent = lifetime_spent + p_amount
  WHERE user_id = p_user_id;

  -- Create transaction record
  INSERT INTO public.coin_transactions (
    user_id, transaction_type, amount, balance_after,
    reference_type, reference_id, description
  ) VALUES (
    p_user_id, p_transaction_type, -p_amount, v_new_balance,
    p_reference_type, p_reference_id, p_description
  ) RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT true, v_new_balance, v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add coins
CREATE OR REPLACE FUNCTION public.add_coins(
  p_user_id UUID,
  p_amount INTEGER,
  p_transaction_type TEXT,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_stripe_payment_intent_id TEXT DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, new_balance INTEGER, transaction_id UUID) AS $$
DECLARE
  v_new_balance INTEGER;
  v_transaction_id UUID;
BEGIN
  -- Upsert coin balance
  INSERT INTO public.user_coin_balances (user_id, balance, lifetime_earned)
  VALUES (p_user_id, p_amount, p_amount)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = user_coin_balances.balance + p_amount,
      lifetime_earned = user_coin_balances.lifetime_earned + p_amount
  RETURNING balance INTO v_new_balance;

  -- Create transaction record
  INSERT INTO public.coin_transactions (
    user_id, transaction_type, amount, balance_after,
    reference_type, reference_id, description, stripe_payment_intent_id
  ) VALUES (
    p_user_id, p_transaction_type, p_amount, v_new_balance,
    p_reference_type, p_reference_id, p_description, p_stripe_payment_intent_id
  ) RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT true, v_new_balance, v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record interaction and update daily stats
CREATE OR REPLACE FUNCTION public.record_interaction(
  p_user_id UUID,
  p_character_id UUID,
  p_interaction_type TEXT,
  p_metadata JSONB DEFAULT '{}',
  p_duration_seconds INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_interaction_id UUID;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Insert interaction
  INSERT INTO public.user_interactions (
    user_id, character_id, interaction_type, metadata, duration_seconds
  ) VALUES (
    p_user_id, p_character_id, p_interaction_type, p_metadata, p_duration_seconds
  ) RETURNING id INTO v_interaction_id;

  -- Update daily stats (upsert)
  INSERT INTO public.character_daily_stats (character_id, date)
  VALUES (p_character_id, v_today)
  ON CONFLICT (character_id, date) DO NOTHING;

  -- Update specific stat based on interaction type
  CASE p_interaction_type
    WHEN 'message_sent' THEN
      UPDATE public.character_daily_stats
      SET messages_received = messages_received + 1
      WHERE character_id = p_character_id AND date = v_today;
    WHEN 'message_received' THEN
      UPDATE public.character_daily_stats
      SET messages_sent = messages_sent + 1
      WHERE character_id = p_character_id AND date = v_today;
    WHEN 'image_generated' THEN
      UPDATE public.character_daily_stats
      SET images_generated = images_generated + 1
      WHERE character_id = p_character_id AND date = v_today;
    WHEN 'profile_viewed' THEN
      UPDATE public.character_daily_stats
      SET profile_views = profile_views + 1
      WHERE character_id = p_character_id AND date = v_today;
    WHEN 'post_viewed' THEN
      UPDATE public.character_daily_stats
      SET post_views = post_views + 1
      WHERE character_id = p_character_id AND date = v_today;
    WHEN 'post_liked' THEN
      UPDATE public.character_daily_stats
      SET post_likes = post_likes + 1
      WHERE character_id = p_character_id AND date = v_today;
    WHEN 'post_commented' THEN
      UPDATE public.character_daily_stats
      SET post_comments = post_comments + 1
      WHERE character_id = p_character_id AND date = v_today;
    WHEN 'post_shared' THEN
      UPDATE public.character_daily_stats
      SET post_shares = post_shares + 1
      WHERE character_id = p_character_id AND date = v_today;
    WHEN 'follow' THEN
      UPDATE public.character_daily_stats
      SET new_followers = new_followers + 1
      WHERE character_id = p_character_id AND date = v_today;
    WHEN 'unfollow' THEN
      UPDATE public.character_daily_stats
      SET unfollows = unfollows + 1
      WHERE character_id = p_character_id AND date = v_today;
    WHEN 'subscription_started' THEN
      UPDATE public.character_daily_stats
      SET new_subscribers = new_subscribers + 1
      WHERE character_id = p_character_id AND date = v_today;
    WHEN 'subscription_cancelled' THEN
      UPDATE public.character_daily_stats
      SET churned_subscribers = churned_subscribers + 1
      WHERE character_id = p_character_id AND date = v_today;
    ELSE
      NULL; -- No specific stat update
  END CASE;

  RETURN v_interaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- Seed Data for Premium Plans and Coin Packages
-- ========================================

-- Insert default premium plan
INSERT INTO public.premium_plans (name, display_name, description, price_monthly, price_yearly, features, monthly_coins)
VALUES (
  'creator_premium',
  'Creator Premium',
  'Unlock monetization features and grow your AI influencer business',
  6.99,
  59.99,
  '[
    "Enable monetization on AI characters",
    "Create unlimited subscription tiers",
    "Receive tips from fans",
    "Access detailed analytics dashboard",
    "Priority content generation",
    "500 coins included monthly"
  ]'::jsonb,
  500
) ON CONFLICT (name) DO NOTHING;

-- Insert coin packages
INSERT INTO public.coin_packages (name, coin_amount, price, bonus_coins, is_popular, sort_order)
VALUES
  ('Starter Pack', 100, 0.99, 0, false, 1),
  ('Basic Pack', 500, 4.49, 25, false, 2),
  ('Popular Pack', 1200, 9.99, 100, true, 3),
  ('Pro Pack', 2500, 19.99, 300, false, 4),
  ('Creator Pack', 6000, 44.99, 1000, false, 5),
  ('Enterprise Pack', 15000, 99.99, 3000, false, 6)
ON CONFLICT DO NOTHING;
