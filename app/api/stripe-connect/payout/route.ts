import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Service role client for admin operations
const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PLATFORM_FEE_PERCENTAGE = 0.15; // 15% platform fee
const MINIMUM_PAYOUT_AMOUNT = 20.00; // $20 minimum

// GET - Get payout history and available balance
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get balance using the database function
    const { data: balanceData, error: balanceError } = await supabase
      .rpc('get_creator_available_balance', { p_creator_id: user.id });

    if (balanceError) {
      console.error("Error getting balance:", balanceError);
    }

    const balance = balanceData?.[0] || {
      total_gross: 0,
      total_fees: 0,
      total_net: 0,
      pending_amount: 0,
      available_amount: 0,
      paid_out_amount: 0,
      pending_payout_amount: 0,
    };

    // Get payout history
    const { data: payouts, error: payoutsError, count } = await supabase
      .from('payout_requests')
      .select('*', { count: 'exact' })
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (payoutsError) {
      console.error("Error fetching payouts:", payoutsError);
    }

    // Get payout settings
    const { data: settings } = await supabase
      .from('creator_payout_settings')
      .select('*')
      .eq('creator_id', user.id)
      .single();

    return NextResponse.json({
      balance: {
        totalGross: parseFloat(balance.total_gross) || 0,
        totalFees: parseFloat(balance.total_fees) || 0,
        totalNet: parseFloat(balance.total_net) || 0,
        pending: parseFloat(balance.pending_amount) || 0,
        available: parseFloat(balance.available_amount) - parseFloat(balance.pending_payout_amount || 0),
        paidOut: parseFloat(balance.paid_out_amount) || 0,
        pendingPayout: parseFloat(balance.pending_payout_amount) || 0,
      },
      payouts: payouts || [],
      totalPayouts: count || 0,
      settings: {
        minimumPayout: MINIMUM_PAYOUT_AMOUNT,
        platformFeePercentage: PLATFORM_FEE_PERCENTAGE * 100,
        payoutsEnabled: settings?.stripe_connect_payouts_enabled || false,
        hasStripeAccount: !!settings?.stripe_connect_account_id,
        onboardingComplete: settings?.stripe_connect_onboarding_complete || false,
      },
    });
  } catch (error) {
    console.error("Error fetching payout data:", error);
    return NextResponse.json(
      { error: "Failed to fetch payout data" },
      { status: 500 }
    );
  }
}

// POST - Request a payout
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { amount } = body;

    if (!amount || amount < MINIMUM_PAYOUT_AMOUNT) {
      return NextResponse.json(
        { error: `Minimum payout amount is $${MINIMUM_PAYOUT_AMOUNT}` },
        { status: 400 }
      );
    }

    // Get payout settings and verify Stripe Connect is set up
    const { data: settings, error: settingsError } = await supabase
      .from('creator_payout_settings')
      .select('*')
      .eq('creator_id', user.id)
      .single();

    if (settingsError || !settings) {
      return NextResponse.json(
        { error: "Payout settings not found. Please complete Stripe Connect onboarding." },
        { status: 400 }
      );
    }

    if (!settings.stripe_connect_account_id) {
      return NextResponse.json(
        { error: "Stripe Connect account not set up. Please complete onboarding." },
        { status: 400 }
      );
    }

    if (!settings.stripe_connect_payouts_enabled) {
      return NextResponse.json(
        { error: "Payouts are not enabled on your Stripe account. Please complete account verification." },
        { status: 400 }
      );
    }

    // Use database function to create payout request with validation
    const { data: payoutResult, error: payoutError } = await supabase
      .rpc('create_payout_request', {
        p_creator_id: user.id,
        p_amount: amount,
      });

    if (payoutError || !payoutResult?.[0]?.success) {
      return NextResponse.json(
        { error: payoutResult?.[0]?.error_message || "Failed to create payout request" },
        { status: 400 }
      );
    }

    const payoutRequestId = payoutResult[0].payout_request_id;

    // Calculate net amount after platform fee
    const platformFee = amount * PLATFORM_FEE_PERCENTAGE;
    const netAmount = amount - platformFee;

    // Create Stripe transfer to connected account
    try {
      const transfer = await stripe.transfers.create({
        amount: Math.round(netAmount * 100), // Convert to cents
        currency: 'usd',
        destination: settings.stripe_connect_account_id,
        metadata: {
          payout_request_id: payoutRequestId,
          creator_id: user.id,
          gross_amount: amount.toString(),
          platform_fee: platformFee.toString(),
          net_amount: netAmount.toString(),
        },
        description: `Chatlamix creator payout - $${netAmount.toFixed(2)}`,
      });

      // Update payout request with Stripe transfer ID
      await supabaseAdmin
        .from('payout_requests')
        .update({
          stripe_transfer_id: transfer.id,
          status: 'processing',
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', payoutRequestId);

      // Mark earnings as paid out
      await supabaseAdmin.rpc('mark_earnings_paid_out', {
        p_creator_id: user.id,
        p_amount: amount,
        p_payout_request_id: payoutRequestId,
      });

      return NextResponse.json({
        success: true,
        payoutRequestId,
        transferId: transfer.id,
        grossAmount: amount,
        platformFee,
        netAmount,
        message: `Payout of $${netAmount.toFixed(2)} has been initiated (after 15% platform fee). Funds will arrive in your bank account within 2-7 business days.`,
      });
    } catch (stripeError: unknown) {
      console.error("Stripe transfer error:", stripeError);

      // Mark payout request as failed
      await supabaseAdmin
        .from('payout_requests')
        .update({
          status: 'failed',
          failure_reason: stripeError instanceof Error ? stripeError.message : 'Stripe transfer failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', payoutRequestId);

      return NextResponse.json(
        { error: "Failed to process payout. Please try again later." },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error requesting payout:", error);
    return NextResponse.json(
      { error: "Failed to request payout" },
      { status: 500 }
    );
  }
}
