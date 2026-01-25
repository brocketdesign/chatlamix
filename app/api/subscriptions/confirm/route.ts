import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import Stripe from "stripe";

// Initialize Stripe lazily to avoid build-time errors
const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe secret key not configured");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

// Lazy initialization for service role client to avoid build-time errors
function getSupabaseAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const PLATFORM_FEE_PERCENTAGE = 0.15; // 15% platform fee

// POST - Confirm subscription after Stripe payment is complete
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

    const stripe = getStripe();
    const body = await request.json();
    const { subscriptionId } = body;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "Subscription ID is required" },
        { status: 400 }
      );
    }

    // Retrieve the subscription from Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);

    if (stripeSubscription.status !== 'active' && stripeSubscription.status !== 'trialing') {
      return NextResponse.json(
        { error: "Subscription is not active" },
        { status: 400 }
      );
    }

    // Verify metadata
    const tierId = stripeSubscription.metadata.tier_id;
    const fanId = stripeSubscription.metadata.fan_id;
    const characterId = stripeSubscription.metadata.character_id;
    const creatorId = stripeSubscription.metadata.creator_id;

    if (fanId !== user.id) {
      return NextResponse.json(
        { error: "Subscription does not belong to this user" },
        { status: 403 }
      );
    }

    // Check if subscription already exists in our database
    const { data: existingSub } = await supabase
      .from('fan_subscriptions')
      .select('id')
      .eq('stripe_subscription_id', subscriptionId)
      .single();

    if (existingSub) {
      return NextResponse.json(
        { error: "Subscription already confirmed" },
        { status: 400 }
      );
    }

    // Get tier details
    const { data: tier, error: tierError } = await supabase
      .from('creator_tiers')
      .select('*')
      .eq('id', tierId)
      .single();

    if (tierError || !tier) {
      return NextResponse.json(
        { error: "Tier not found" },
        { status: 404 }
      );
    }

    // Get period dates from subscription items
    const periodStart = stripeSubscription.items.data[0]?.current_period_start || Math.floor(Date.now() / 1000);
    const periodEnd = stripeSubscription.items.data[0]?.current_period_end || Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    const currentPeriodStart = new Date(periodStart * 1000);
    const currentPeriodEnd = new Date(periodEnd * 1000);

    // Check for existing subscription to this character (to handle upgrades)
    const { data: existingCharSub } = await supabase
      .from('fan_subscriptions')
      .select('id, tier_id')
      .eq('fan_id', user.id)
      .eq('character_id', characterId)
      .eq('status', 'active')
      .single();

    // Create or update subscription record
    const { data: subscription, error: subError } = existingCharSub
      ? await getSupabaseAdmin()
          .from('fan_subscriptions')
          .update({
            tier_id: tierId,
            stripe_subscription_id: subscriptionId,
            current_period_start: currentPeriodStart.toISOString(),
            current_period_end: currentPeriodEnd.toISOString(),
            cancel_at_period_end: stripeSubscription.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingCharSub.id)
          .select()
          .single()
      : await getSupabaseAdmin()
          .from('fan_subscriptions')
          .insert({
            fan_id: user.id,
            tier_id: tierId,
            character_id: characterId,
            creator_id: creatorId,
            stripe_subscription_id: subscriptionId,
            status: 'active',
            current_period_start: currentPeriodStart.toISOString(),
            current_period_end: currentPeriodEnd.toISOString(),
          })
          .select()
          .single();

    if (subError) {
      console.error("Error creating subscription record:", subError);
      return NextResponse.json(
        { error: "Failed to create subscription record" },
        { status: 500 }
      );
    }

    // Update subscriber count
    await getSupabaseAdmin()
      .from('creator_tiers')
      .update({ subscriber_count: tier.subscriber_count + (existingCharSub ? 0 : 1) })
      .eq('id', tierId);

    // Record interaction
    await supabase.rpc('record_interaction', {
      p_user_id: user.id,
      p_character_id: characterId,
      p_interaction_type: existingCharSub ? 'subscription_upgraded' : 'subscription_started',
      p_metadata: { tier_id: tierId, tier_name: tier.name },
    });

    // Create earning record for creator (15% platform fee already taken by Stripe)
    const platformFee = tier.price_monthly * PLATFORM_FEE_PERCENTAGE;
    const netAmount = tier.price_monthly - platformFee;

    await getSupabaseAdmin()
      .from('creator_earnings')
      .insert({
        creator_id: creatorId,
        character_id: characterId,
        source_type: 'subscription',
        source_id: subscription.id,
        gross_amount: tier.price_monthly,
        platform_fee: platformFee,
        platform_fee_percentage: PLATFORM_FEE_PERCENTAGE * 100,
        net_amount: netAmount,
        status: 'available', // Funds transferred directly to connected account
      });

    // Update daily stats
    const today = new Date().toISOString().split('T')[0];
    await getSupabaseAdmin()
      .from('character_daily_stats')
      .upsert({
        character_id: characterId,
        date: today,
        subscription_revenue: tier.price_monthly,
        total_revenue: tier.price_monthly,
        new_subscribers: existingCharSub ? 0 : 1,
      }, {
        onConflict: 'character_id,date',
        ignoreDuplicates: false,
      });

    return NextResponse.json({
      success: true,
      subscription,
      message: `Successfully subscribed to ${tier.name}!`,
    });
  } catch (error) {
    console.error("Error confirming subscription:", error);
    return NextResponse.json(
      { error: "Failed to confirm subscription" },
      { status: 500 }
    );
  }
}
