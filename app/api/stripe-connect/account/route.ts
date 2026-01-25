import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";

// Initialize Stripe lazily to avoid build-time errors
const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe secret key not configured");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

// GET - Get Stripe Connect account status
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

    // Get payout settings
    const { data: settings } = await supabase
      .from('creator_payout_settings')
      .select('*')
      .eq('creator_id', user.id)
      .single();

    if (!settings?.stripe_connect_account_id) {
      return NextResponse.json({
        hasAccount: false,
        onboardingComplete: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        requirements: null,
      });
    }

    // Fetch current account status from Stripe
    try {
      const stripe = getStripe();
      const account = await stripe.accounts.retrieve(settings.stripe_connect_account_id);

      // Update local settings with latest status
      const updatedSettings = {
        stripe_connect_onboarding_complete: account.details_submitted,
        stripe_connect_details_submitted: account.details_submitted,
        stripe_connect_charges_enabled: account.charges_enabled,
        stripe_connect_payouts_enabled: account.payouts_enabled,
        stripe_connect_requirements: account.requirements || {},
        updated_at: new Date().toISOString(),
      };

      await supabase
        .from('creator_payout_settings')
        .update(updatedSettings)
        .eq('creator_id', user.id);

      return NextResponse.json({
        hasAccount: true,
        accountId: account.id,
        onboardingComplete: account.details_submitted,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        requirements: {
          currentlyDue: account.requirements?.currently_due || [],
          eventuallyDue: account.requirements?.eventually_due || [],
          pastDue: account.requirements?.past_due || [],
          pendingVerification: account.requirements?.pending_verification || [],
          disabledReason: account.requirements?.disabled_reason,
        },
        payoutSchedule: account.settings?.payouts?.schedule,
        defaultCurrency: account.default_currency,
        country: account.country,
      });
    } catch (stripeError) {
      console.error("Error fetching Stripe account:", stripeError);
      // Account may have been deleted or is invalid
      return NextResponse.json({
        hasAccount: true,
        accountId: settings.stripe_connect_account_id,
        onboardingComplete: settings.stripe_connect_onboarding_complete || false,
        chargesEnabled: settings.stripe_connect_charges_enabled || false,
        payoutsEnabled: settings.stripe_connect_payouts_enabled || false,
        detailsSubmitted: settings.stripe_connect_details_submitted || false,
        requirements: null,
        error: "Could not fetch latest account status",
      });
    }
  } catch (error) {
    console.error("Error getting account status:", error);
    return NextResponse.json(
      { error: "Failed to get account status" },
      { status: 500 }
    );
  }
}

// POST - Create Stripe Connect dashboard link (for existing accounts)
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

    // Get payout settings
    const { data: settings } = await supabase
      .from('creator_payout_settings')
      .select('stripe_connect_account_id')
      .eq('creator_id', user.id)
      .single();

    if (!settings?.stripe_connect_account_id) {
      return NextResponse.json(
        { error: "No Stripe Connect account found. Please complete onboarding first." },
        { status: 404 }
      );
    }

    // Create login link for existing accounts
    const stripe = getStripe();
    const loginLink = await stripe.accounts.createLoginLink(
      settings.stripe_connect_account_id
    );

    return NextResponse.json({
      url: loginLink.url,
    });
  } catch (error) {
    console.error("Error creating dashboard link:", error);
    return NextResponse.json(
      { error: "Failed to create dashboard link" },
      { status: 500 }
    );
  }
}
