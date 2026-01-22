import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";

// Initialize Stripe if configured
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// Helper function to get or create Stripe product and prices for a plan
async function getOrCreateStripePrices(
  plan: {
    id: string;
    name: string;
    display_name: string;
    description?: string;
    price_monthly: number;
    price_yearly?: number;
    stripe_product_id?: string;
    stripe_monthly_price_id?: string;
    stripe_yearly_price_id?: string;
  },
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ monthlyPriceId: string; yearlyPriceId: string | null }> {
  if (!stripe) {
    throw new Error("Stripe not configured");
  }

  let productId = plan.stripe_product_id;
  let monthlyPriceId = plan.stripe_monthly_price_id;
  let yearlyPriceId = plan.stripe_yearly_price_id;

  // Create or retrieve the Stripe product
  if (!productId) {
    const product = await stripe.products.create({
      name: plan.display_name,
      description: plan.description || `${plan.display_name} subscription plan`,
      metadata: {
        plan_id: plan.id,
        plan_name: plan.name,
      },
    });
    productId = product.id;

    // Save product ID to database
    await supabase
      .from("premium_plans")
      .update({ stripe_product_id: productId })
      .eq("id", plan.id);
  }

  // Create monthly price if not exists
  if (!monthlyPriceId) {
    const monthlyPrice = await stripe.prices.create({
      product: productId,
      unit_amount: Math.round(plan.price_monthly * 100), // Convert to cents
      currency: "usd",
      recurring: {
        interval: "month",
      },
      metadata: {
        plan_id: plan.id,
        billing_cycle: "monthly",
      },
    });
    monthlyPriceId = monthlyPrice.id;

    // Save price ID to database
    await supabase
      .from("premium_plans")
      .update({ stripe_monthly_price_id: monthlyPriceId })
      .eq("id", plan.id);
  }

  // Create yearly price if plan has yearly pricing and price doesn't exist
  if (plan.price_yearly && !yearlyPriceId) {
    const yearlyPrice = await stripe.prices.create({
      product: productId,
      unit_amount: Math.round(plan.price_yearly * 100), // Convert to cents
      currency: "usd",
      recurring: {
        interval: "year",
      },
      metadata: {
        plan_id: plan.id,
        billing_cycle: "yearly",
      },
    });
    yearlyPriceId = yearlyPrice.id;

    // Save price ID to database
    await supabase
      .from("premium_plans")
      .update({ stripe_yearly_price_id: yearlyPriceId })
      .eq("id", plan.id);
  }

  return {
    monthlyPriceId: monthlyPriceId!,
    yearlyPriceId: yearlyPriceId || null,
  };
}

// GET - Get user's premium status and subscription details
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

    // Try to check premium status using the database function
    let isPremium = false;
    try {
      const { data } = await supabase
        .rpc('user_has_premium', { check_user_id: user.id });
      isPremium = data || false;
    } catch {
      // Function might not exist yet - return default
      console.log("Premium function not available yet");
    }

    // Get subscription details if exists
    let subscription = null;
    try {
      const { data: subData, error: subError } = await supabase
        .from('user_premium_subscriptions')
        .select(`
          *,
          premium_plans (*)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (!subError || subError.code === 'PGRST116') {
        subscription = subData;
      }
    } catch {
      // Table might not exist yet
      console.log("Premium tables not available yet");
    }

    let daysRemaining = 0;
    if (subscription) {
      const endDate = new Date(subscription.current_period_end);
      const now = new Date();
      daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }

    return NextResponse.json({
      isPremium: isPremium || false,
      subscription: subscription || null,
      plan: subscription?.premium_plans || null,
      daysRemaining,
    });
  } catch (error) {
    console.error("Error checking premium status:", error);
    return NextResponse.json(
      { error: "Failed to check premium status" },
      { status: 500 }
    );
  }
}

// POST - Create/subscribe to premium plan
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
    const { planId, planName, billingCycle = 'monthly', adminBypass = false } = body;

    // Check if user already has an active subscription
    const { data: existingSub } = await supabase
      .from('user_premium_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (existingSub) {
      return NextResponse.json(
        { error: "User already has an active subscription" },
        { status: 400 }
      );
    }

    // Get the plan details - support lookup by ID first, then name
    let plan = null;
    
    // Try lookup by ID first
    if (planId) {
      const result = await supabase
        .from('premium_plans')
        .select('*')
        .eq('id', planId)
        .eq('is_active', true)
        .single();
      plan = result.data;
    }
    
    // If not found by ID, try lookup by name
    if (!plan && planName) {
      const result = await supabase
        .from('premium_plans')
        .select('*')
        .eq('name', planName)
        .eq('is_active', true)
        .single();
      plan = result.data;
    }
    
    // If still not found, try to get any active plan as fallback
    if (!plan) {
      const result = await supabase
        .from('premium_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true })
        .limit(1)
        .single();
      plan = result.data;
    }

    // If no plans exist at all, create a default plan for development/testing
    if (!plan) {
      const { data: newPlan, error: createPlanError } = await supabase
        .from('premium_plans')
        .insert({
          name: 'creator_premium',
          display_name: 'Creator Premium',
          description: 'Unlock monetization features for your AI characters',
          price_monthly: 6.99,
          price_yearly: 59.99,
          features: JSON.stringify([
            "Enable monetization on AI characters",
            "Create unlimited subscription tiers",
            "Receive tips from fans",
            "Access detailed analytics dashboard",
            "Priority content generation"
          ]),
          monthly_coins: 500,
          is_active: true,
        })
        .select()
        .single();
      
      if (createPlanError) {
        console.error("Error creating default plan:", createPlanError);
        return NextResponse.json(
          { error: "No premium plans available" },
          { status: 400 }
        );
      }
      plan = newPlan;
    }

    // If Stripe is configured and adminBypass is not set, create checkout session
    if (stripe && !adminBypass) {
      // Get or create Stripe product and prices dynamically
      let stripePriceId: string;
      try {
        const stripePrices = await getOrCreateStripePrices(plan, supabase);
        stripePriceId = billingCycle === 'yearly' && stripePrices.yearlyPriceId
          ? stripePrices.yearlyPriceId
          : stripePrices.monthlyPriceId;
      } catch (stripeError) {
        console.error("Error creating Stripe prices:", stripeError);
        return NextResponse.json(
          { error: "Failed to set up payment. Please try again." },
          { status: 500 }
        );
      }

      // Get or create Stripe customer
      let stripeCustomerId: string | null = null;
      const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', user.id)
        .single();
      
      if (profile?.stripe_customer_id) {
        stripeCustomerId = profile.stripe_customer_id;
      } else {
        const customer = await stripe.customers.create({
          email: user.email ?? undefined,
          metadata: { user_id: user.id },
        });
        stripeCustomerId = customer.id;
        
        // Save customer ID to profile
        await supabase
          .from('profiles')
          .update({ stripe_customer_id: stripeCustomerId })
          .eq('id', user.id);
      }

      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId ?? undefined,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: stripePriceId,
            quantity: 1,
          },
        ],
        success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/monetization?success=true`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/monetization/upgrade?canceled=true`,
        subscription_data: {
          metadata: {
            user_id: user.id,
            plan_id: plan.id,
            billing_cycle: billingCycle,
          },
        },
      });

      return NextResponse.json({
        checkoutUrl: session.url,
        sessionId: session.id,
      });
    }

    // Calculate period end date
    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // Fallback: Create subscription directly for development/testing (no Stripe configured)
    // In production, the subscription should only be created via Stripe webhook
    const { data: subscription, error: createError } = await supabase
      .from('user_premium_subscriptions')
      .insert({
        user_id: user.id,
        plan_id: plan.id,
        status: 'active',
        billing_cycle: billingCycle,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating subscription:", createError);
      return NextResponse.json(
        { error: "Failed to create subscription" },
        { status: 500 }
      );
    }

    // Allocate monthly coins to the user
    if (plan.monthly_coins > 0) {
      await supabase.rpc('add_coins', {
        p_user_id: user.id,
        p_amount: plan.monthly_coins,
        p_transaction_type: 'premium_allocation',
        p_description: `Premium plan monthly allocation - ${plan.display_name}`,
      });
    }

    return NextResponse.json({
      success: true,
      subscription,
      message: "Premium subscription activated successfully!",
    });
  } catch (error) {
    console.error("Error creating subscription:", error);
    return NextResponse.json(
      { error: "Failed to create subscription" },
      { status: 500 }
    );
  }
}

// PATCH - Update subscription (cancel, change plan)
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

    const body = await request.json();
    const { action, subscriptionId } = body;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "Subscription ID required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: subscription, error: fetchError } = await supabase
      .from('user_premium_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !subscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    if (action === 'cancel') {
      // Cancel at period end
      const { data: updated, error: updateError } = await supabase
        .from('user_premium_subscriptions')
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

      return NextResponse.json({
        success: true,
        subscription: updated,
        message: "Subscription will be cancelled at the end of the billing period",
      });
    }

    if (action === 'reactivate') {
      // Reactivate a cancelled subscription
      if (!subscription.cancel_at_period_end) {
        return NextResponse.json(
          { error: "Subscription is not scheduled for cancellation" },
          { status: 400 }
        );
      }

      const { data: updated, error: updateError } = await supabase
        .from('user_premium_subscriptions')
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

// DELETE - Immediately cancel subscription (for admin/testing)
export async function DELETE(request: NextRequest) {
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
    const { subscriptionId, immediate = false } = body;

    // If no subscriptionId provided, cancel any active subscription for the user
    let targetSubscriptionId = subscriptionId;

    if (!targetSubscriptionId) {
      const { data: activeSub } = await supabase
        .from('user_premium_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (activeSub) {
        targetSubscriptionId = activeSub.id;
      } else {
        return NextResponse.json(
          { error: "No active subscription found" },
          { status: 404 }
        );
      }
    }

    // Verify ownership
    const { data: subscription, error: fetchError } = await supabase
      .from('user_premium_subscriptions')
      .select('*')
      .eq('id', targetSubscriptionId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !subscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    if (immediate) {
      // Immediately cancel and deactivate the subscription
      const { error: deleteError } = await supabase
        .from('user_premium_subscriptions')
        .update({ 
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', targetSubscriptionId);

      if (deleteError) {
        console.error("Error deleting subscription:", deleteError);
        return NextResponse.json(
          { error: "Failed to cancel subscription" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Subscription cancelled immediately",
      });
    } else {
      // Schedule cancellation at period end
      const { data: updated, error: updateError } = await supabase
        .from('user_premium_subscriptions')
        .update({ cancel_at_period_end: true })
        .eq('id', targetSubscriptionId)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json(
          { error: "Failed to schedule cancellation" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        subscription: updated,
        message: "Subscription will be cancelled at the end of the billing period",
      });
    }
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    return NextResponse.json(
      { error: "Failed to cancel subscription" },
      { status: 500 }
    );
  }
}
