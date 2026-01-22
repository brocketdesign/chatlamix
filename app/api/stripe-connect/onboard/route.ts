import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// POST - Create Stripe Connect onboarding link
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
    const { refreshUrl, returnUrl } = body;

    // Check if user has premium (required for monetization)
    const { data: isPremium } = await supabase.rpc('user_has_premium', { check_user_id: user.id });
    if (!isPremium) {
      return NextResponse.json(
        { error: "Premium subscription required for monetization" },
        { status: 403 }
      );
    }

    // Check if user already has a Stripe Connect account
    const { data: existingSettings } = await supabase
      .from('creator_payout_settings')
      .select('stripe_connect_account_id, stripe_connect_onboarding_complete')
      .eq('creator_id', user.id)
      .single();

    let accountId = existingSettings?.stripe_connect_account_id;

    if (!accountId) {
      // Get user profile for account creation
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', user.id)
        .single();

      // Create a new Stripe Connect account (Express type for simpler onboarding)
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: profile?.email || user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        metadata: {
          user_id: user.id,
          platform: 'chatlamix',
        },
        settings: {
          payouts: {
            schedule: {
              interval: 'manual', // We control when payouts happen
            },
          },
        },
      });

      accountId = account.id;

      // Save or update payout settings
      await supabase
        .from('creator_payout_settings')
        .upsert({
          creator_id: user.id,
          stripe_connect_account_id: accountId,
          stripe_connect_country: 'US',
          stripe_connect_currency: 'usd',
          stripe_connect_created_at: new Date().toISOString(),
          payout_threshold: 20.00, // $20 minimum
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'creator_id',
        });
    }

    // Create onboarding link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl || `${baseUrl}/dashboard/monetization/settings?refresh=true`,
      return_url: returnUrl || `${baseUrl}/dashboard/monetization/settings?success=true`,
      type: 'account_onboarding',
    });

    return NextResponse.json({
      url: accountLink.url,
      accountId,
    });
  } catch (error) {
    console.error("Error creating onboarding link:", error);
    return NextResponse.json(
      { error: "Failed to create onboarding link" },
      { status: 500 }
    );
  }
}
