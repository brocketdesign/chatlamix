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

// GET - Get user's fan subscriptions
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
    const characterId = searchParams.get('characterId');

    let query = supabase
      .from('fan_subscriptions')
      .select(`
        *,
        creator_tiers (*),
        characters (id, name, thumbnail, description)
      `)
      .eq('fan_id', user.id);

    if (characterId) {
      query = query.eq('character_id', characterId);
    }

    const { data: subscriptions, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching subscriptions:", error);
      return NextResponse.json(
        { error: "Failed to fetch subscriptions" },
        { status: 500 }
      );
    }

    return NextResponse.json(subscriptions);
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscriptions" },
      { status: 500 }
    );
  }
}

// POST - Subscribe to a tier
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
    const { tierId } = body;

    if (!tierId) {
      return NextResponse.json(
        { error: "Tier ID required" },
        { status: 400 }
      );
    }

    // Get tier details
    const { data: tier, error: tierError } = await supabase
      .from('creator_tiers')
      .select('*')
      .eq('id', tierId)
      .eq('is_active', true)
      .single();

    if (tierError || !tier) {
      return NextResponse.json(
        { error: "Tier not found or inactive" },
        { status: 404 }
      );
    }

    // Can't subscribe to your own character
    if (tier.creator_id === user.id) {
      return NextResponse.json(
        { error: "Cannot subscribe to your own character" },
        { status: 400 }
      );
    }

    // Check for existing subscription to this character
    const { data: existingSub } = await supabase
      .from('fan_subscriptions')
      .select('id, tier_id, status, stripe_subscription_id')
      .eq('fan_id', user.id)
      .eq('character_id', tier.character_id)
      .eq('status', 'active')
      .single();

    if (existingSub) {
      // Already subscribed - could upgrade/downgrade
      if (existingSub.tier_id === tierId) {
        return NextResponse.json(
          { error: "Already subscribed to this tier" },
          { status: 400 }
        );
      }
      // For tier change, you'd handle proration in a real implementation
    }

    // Check if creator has Stripe Connect set up
    const { data: creatorSettings } = await supabase
      .from('creator_payout_settings')
      .select('stripe_connect_account_id, stripe_connect_charges_enabled')
      .eq('creator_id', tier.creator_id)
      .single();

    if (!creatorSettings?.stripe_connect_account_id) {
      return NextResponse.json(
        { error: "Creator has not set up payment receiving. Subscriptions are not available." },
        { status: 400 }
      );
    }

    // Get or create Stripe customer for the subscriber
    const { data: subscriberProfile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('id', user.id)
      .single();

    let customerId = subscriberProfile?.stripe_customer_id;

    if (!customerId && subscriberProfile?.email) {
      const customer = await stripe.customers.create({
        email: subscriberProfile.email,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;

      // Save customer ID
      await getSupabaseAdmin()
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    if (!customerId) {
      return NextResponse.json(
        { error: "Failed to create payment profile" },
        { status: 500 }
      );
    }

    // Check if tier already has a Stripe price ID, or create one
    let stripePriceId = tier.stripe_price_id;

    if (!stripePriceId) {
      // Create a Stripe product and price for this tier
      const product = await stripe.products.create({
        name: `${tier.name} - Subscription Tier`,
        metadata: {
          tier_id: tier.id,
          character_id: tier.character_id,
          creator_id: tier.creator_id,
        },
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(tier.price_monthly * 100), // Convert to cents
        currency: 'usd',
        recurring: {
          interval: 'month',
        },
        metadata: {
          tier_id: tier.id,
        },
      });

      stripePriceId = price.id;

      // Save the price ID to the tier
      await getSupabaseAdmin()
        .from('creator_tiers')
        .update({ stripe_price_id: stripePriceId, stripe_product_id: product.id })
        .eq('id', tier.id);
    }

    // Create Stripe subscription with application fee
    try {
      const stripeSubscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: stripePriceId }],
        application_fee_percent: PLATFORM_FEE_PERCENTAGE * 100, // 15% platform fee
        transfer_data: {
          destination: creatorSettings.stripe_connect_account_id,
        },
        metadata: {
          type: 'fan_subscription',
          tier_id: tierId,
          character_id: tier.character_id,
          creator_id: tier.creator_id,
          fan_id: user.id,
        },
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent'],
      });

      const invoice = stripeSubscription.latest_invoice as Stripe.Invoice & { payment_intent: Stripe.PaymentIntent };
      const paymentIntent = invoice.payment_intent;

      // Return client secret for payment confirmation
      return NextResponse.json({
        requiresPayment: true,
        clientSecret: paymentIntent?.client_secret,
        subscriptionId: stripeSubscription.id,
        tierId,
        tierName: tier.name,
        amount: tier.price_monthly,
      });
    } catch (stripeError) {
      console.error("Stripe subscription error:", stripeError);
      return NextResponse.json(
        { error: "Failed to create subscription. Please try again." },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error creating subscription:", error);
    return NextResponse.json(
      { error: "Failed to create subscription" },
      { status: 500 }
    );
  }
}

// PATCH - Update subscription (cancel, reactivate)
export async function PATCH(request: NextRequest) {
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
    const { subscriptionId, action } = body;

    if (!subscriptionId || !action) {
      return NextResponse.json(
        { error: "Subscription ID and action required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: subscription, error: subError } = await supabase
      .from('fan_subscriptions')
      .select('*, stripe_subscription_id')
      .eq('id', subscriptionId)
      .eq('fan_id', user.id)
      .single();

    if (subError || !subscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    if (action === 'cancel') {
      // Cancel the Stripe subscription at period end if it exists
      if (subscription.stripe_subscription_id) {
        try {
          await stripe.subscriptions.update(subscription.stripe_subscription_id, {
            cancel_at_period_end: true,
          });
        } catch (stripeError) {
          console.error("Error cancelling Stripe subscription:", stripeError);
          // Continue to update local record even if Stripe fails
        }
      }

      const { data: updated, error: updateError } = await supabase
        .from('fan_subscriptions')
        .update({ cancel_at_period_end: true })
        .eq('id', subscriptionId)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json(
          { error: "Failed to cancel subscription" },
          { status: 500 }
        );
      }

      // Record interaction
      await supabase.rpc('record_interaction', {
        p_user_id: user.id,
        p_character_id: subscription.character_id,
        p_interaction_type: 'subscription_cancelled',
      });

      return NextResponse.json({
        success: true,
        subscription: updated,
        message: "Subscription will be cancelled at the end of the billing period",
      });
    }

    if (action === 'reactivate') {
      if (!subscription.cancel_at_period_end) {
        return NextResponse.json(
          { error: "Subscription is not scheduled for cancellation" },
          { status: 400 }
        );
      }

      // Reactivate the Stripe subscription if it exists
      if (subscription.stripe_subscription_id) {
        try {
          await stripe.subscriptions.update(subscription.stripe_subscription_id, {
            cancel_at_period_end: false,
          });
        } catch (stripeError) {
          console.error("Error reactivating Stripe subscription:", stripeError);
        }
      }

      const { data: updated, error: updateError } = await supabase
        .from('fan_subscriptions')
        .update({ cancel_at_period_end: false })
        .eq('id', subscriptionId)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json(
          { error: "Failed to reactivate subscription" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        subscription: updated,
        message: "Subscription reactivated successfully",
      });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error updating subscription:", error);
    return NextResponse.json(
      { error: "Failed to update subscription" },
      { status: 500 }
    );
  }
}
