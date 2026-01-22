-- ========================================
-- Stripe Connect Migration
-- Enables creator payouts via Stripe Connect
-- ========================================

-- Update creator_payout_settings to add more Stripe Connect fields
ALTER TABLE public.creator_payout_settings
ADD COLUMN IF NOT EXISTS stripe_connect_onboarding_complete BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stripe_connect_details_submitted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stripe_connect_payouts_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stripe_connect_country TEXT DEFAULT 'US',
ADD COLUMN IF NOT EXISTS stripe_connect_currency TEXT DEFAULT 'usd',
ADD COLUMN IF NOT EXISTS stripe_connect_requirements JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stripe_connect_created_at TIMESTAMPTZ;

-- Update minimum payout threshold to $20
UPDATE public.creator_payout_settings
SET payout_threshold = 20.00
WHERE payout_threshold > 20.00 OR payout_threshold IS NULL;

-- Add platform fee percentage column to track fee per earning
ALTER TABLE public.creator_earnings
ADD COLUMN IF NOT EXISTS platform_fee_percentage DECIMAL(5, 2) DEFAULT 15.00;

-- Update existing records to use 15% platform fee
UPDATE public.creator_earnings
SET platform_fee_percentage = 15.00,
    platform_fee = gross_amount * 0.15,
    net_amount = gross_amount * 0.85
WHERE platform_fee_percentage IS NULL OR platform_fee_percentage != 15.00;

-- Add Stripe product and price ID columns to creator_tiers for fan subscriptions
ALTER TABLE public.creator_tiers
ADD COLUMN IF NOT EXISTS stripe_product_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

-- Create payout requests table for tracking individual payout requests
CREATE TABLE IF NOT EXISTS public.payout_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 20.00), -- Minimum $20 payout
  platform_fee DECIMAL(10, 2) NOT NULL, -- 15% platform fee
  net_amount DECIMAL(10, 2) NOT NULL, -- Amount creator actually receives
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  stripe_transfer_id TEXT, -- Stripe Transfer ID
  stripe_payout_id TEXT, -- Stripe Payout ID if applicable
  failure_reason TEXT,
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create table for tracking connected account events
CREATE TABLE IF NOT EXISTS public.stripe_connect_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_account_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for payout requests
CREATE INDEX IF NOT EXISTS idx_payout_requests_creator_id ON public.payout_requests(creator_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON public.payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_payout_requests_created_at ON public.payout_requests(created_at DESC);

-- Indexes for stripe connect events
CREATE INDEX IF NOT EXISTS idx_stripe_connect_events_creator_id ON public.stripe_connect_events(creator_id);
CREATE INDEX IF NOT EXISTS idx_stripe_connect_events_account_id ON public.stripe_connect_events(stripe_account_id);

-- Function to calculate available balance for a creator
CREATE OR REPLACE FUNCTION public.get_creator_available_balance(p_creator_id UUID)
RETURNS TABLE (
  total_gross DECIMAL(10, 2),
  total_fees DECIMAL(10, 2),
  total_net DECIMAL(10, 2),
  pending_amount DECIMAL(10, 2),
  available_amount DECIMAL(10, 2),
  paid_out_amount DECIMAL(10, 2),
  pending_payout_amount DECIMAL(10, 2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(ce.gross_amount), 0)::DECIMAL(10, 2) as total_gross,
    COALESCE(SUM(ce.platform_fee), 0)::DECIMAL(10, 2) as total_fees,
    COALESCE(SUM(ce.net_amount), 0)::DECIMAL(10, 2) as total_net,
    COALESCE(SUM(CASE WHEN ce.status = 'pending' THEN ce.net_amount ELSE 0 END), 0)::DECIMAL(10, 2) as pending_amount,
    COALESCE(SUM(CASE WHEN ce.status = 'available' THEN ce.net_amount ELSE 0 END), 0)::DECIMAL(10, 2) as available_amount,
    COALESCE(SUM(CASE WHEN ce.status = 'paid_out' THEN ce.net_amount ELSE 0 END), 0)::DECIMAL(10, 2) as paid_out_amount,
    COALESCE((
      SELECT SUM(pr.net_amount) 
      FROM public.payout_requests pr 
      WHERE pr.creator_id = p_creator_id 
      AND pr.status IN ('pending', 'processing')
    ), 0)::DECIMAL(10, 2) as pending_payout_amount
  FROM public.creator_earnings ce
  WHERE ce.creator_id = p_creator_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a payout request
CREATE OR REPLACE FUNCTION public.create_payout_request(
  p_creator_id UUID,
  p_amount DECIMAL(10, 2)
)
RETURNS TABLE (
  success BOOLEAN,
  payout_request_id UUID,
  error_message TEXT
) AS $$
DECLARE
  v_available_balance DECIMAL(10, 2);
  v_platform_fee DECIMAL(10, 2);
  v_net_amount DECIMAL(10, 2);
  v_has_stripe_account BOOLEAN;
  v_payouts_enabled BOOLEAN;
  v_payout_id UUID;
  v_pending_payouts DECIMAL(10, 2);
BEGIN
  -- Check if creator has Stripe Connect set up
  SELECT 
    stripe_connect_account_id IS NOT NULL,
    COALESCE(stripe_connect_payouts_enabled, false)
  INTO v_has_stripe_account, v_payouts_enabled
  FROM public.creator_payout_settings
  WHERE creator_id = p_creator_id;

  IF NOT v_has_stripe_account OR v_has_stripe_account IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Stripe Connect account not set up. Please complete onboarding first.'::TEXT;
    RETURN;
  END IF;

  IF NOT v_payouts_enabled THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Payouts are not enabled on your Stripe account. Please complete account verification.'::TEXT;
    RETURN;
  END IF;

  -- Check minimum payout amount
  IF p_amount < 20.00 THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Minimum payout amount is $20.00'::TEXT;
    RETURN;
  END IF;

  -- Get available balance
  SELECT available_amount, pending_payout_amount
  INTO v_available_balance, v_pending_payouts
  FROM public.get_creator_available_balance(p_creator_id);

  -- Subtract any pending payouts
  v_available_balance := v_available_balance - COALESCE(v_pending_payouts, 0);

  IF v_available_balance < p_amount THEN
    RETURN QUERY SELECT false, NULL::UUID, ('Insufficient available balance. You have $' || v_available_balance::TEXT || ' available.')::TEXT;
    RETURN;
  END IF;

  -- Calculate platform fee (15%)
  v_platform_fee := p_amount * 0.15;
  v_net_amount := p_amount - v_platform_fee;

  -- Create payout request
  INSERT INTO public.payout_requests (
    creator_id,
    amount,
    platform_fee,
    net_amount,
    status
  ) VALUES (
    p_creator_id,
    p_amount,
    v_platform_fee,
    v_net_amount,
    'pending'
  ) RETURNING id INTO v_payout_id;

  RETURN QUERY SELECT true, v_payout_id, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark earnings as paid out after successful payout
CREATE OR REPLACE FUNCTION public.mark_earnings_paid_out(
  p_creator_id UUID,
  p_amount DECIMAL(10, 2),
  p_payout_request_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_remaining DECIMAL(10, 2) := p_amount;
  v_earning RECORD;
BEGIN
  -- Mark available earnings as paid_out up to the payout amount
  FOR v_earning IN 
    SELECT id, net_amount 
    FROM public.creator_earnings 
    WHERE creator_id = p_creator_id 
    AND status = 'available'
    ORDER BY created_at ASC
  LOOP
    IF v_remaining <= 0 THEN
      EXIT;
    END IF;

    UPDATE public.creator_earnings
    SET 
      status = 'paid_out',
      payout_id = p_payout_request_id
    WHERE id = v_earning.id;

    v_remaining := v_remaining - v_earning.net_amount;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for new tables
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_connect_events ENABLE ROW LEVEL SECURITY;

-- Payout requests policies
CREATE POLICY "Users can view their own payout requests"
  ON public.payout_requests FOR SELECT
  USING (auth.uid() = creator_id);

CREATE POLICY "Users can create their own payout requests"
  ON public.payout_requests FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

-- Stripe connect events - only viewable by the creator
CREATE POLICY "Users can view their own stripe events"
  ON public.stripe_connect_events FOR SELECT
  USING (auth.uid() = creator_id);

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION public.get_creator_available_balance TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_payout_request TO authenticated;

-- Comments
COMMENT ON TABLE public.payout_requests IS 'Track individual payout requests from creators';
COMMENT ON TABLE public.stripe_connect_events IS 'Track Stripe Connect webhook events for creators';
COMMENT ON FUNCTION public.get_creator_available_balance IS 'Calculate available balance for a creator including pending payouts';
COMMENT ON FUNCTION public.create_payout_request IS 'Create a new payout request with validation';
