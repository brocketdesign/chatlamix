import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Use service role for webhook handling (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  console.log(`🔔 Stripe webhook received: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      // Stripe Connect events
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await handleAccountUpdated(account);
        break;
      }

      case "transfer.created": {
        const transfer = event.data.object as Stripe.Transfer;
        await handleTransferCreated(transfer);
        break;
      }

      case "transfer.reversed": {
        const transfer = event.data.object as Stripe.Transfer;
        await handleTransferFailed(transfer);
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(paymentIntent);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  // Get the subscription from the session
  if (session.mode !== "subscription" || !session.subscription) {
    return;
  }

  const subscriptionData = await stripe.subscriptions.retrieve(
    session.subscription as string
  );

  // Get user ID from metadata
  const userId = subscriptionData.metadata.user_id;
  const planId = subscriptionData.metadata.plan_id;
  const billingCycle = subscriptionData.metadata.billing_cycle || "monthly";

  if (!userId || !planId) {
    console.error("Missing user_id or plan_id in subscription metadata");
    return;
  }

  // Get period dates from the subscription items
  const periodStart = subscriptionData.items.data[0]?.current_period_start;
  const periodEnd = subscriptionData.items.data[0]?.current_period_end;

  // Update or create the subscription in Supabase
  const { error } = await supabaseAdmin
    .from("user_premium_subscriptions")
    .upsert(
      {
        user_id: userId,
        plan_id: planId,
        status: "active",
        billing_cycle: billingCycle,
        stripe_subscription_id: subscriptionData.id,
        stripe_customer_id: subscriptionData.customer as string,
        current_period_start: periodStart 
          ? new Date(periodStart * 1000).toISOString()
          : new Date().toISOString(),
        current_period_end: periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        cancel_at_period_end: subscriptionData.cancel_at_period_end,
      },
      {
        onConflict: "user_id",
      }
    );

  if (error) {
    console.error("Error creating subscription:", error);
    throw error;
  }

  // Allocate monthly coins
  const { data: plan } = await supabaseAdmin
    .from("premium_plans")
    .select("monthly_coins, display_name")
    .eq("id", planId)
    .single();

  if (plan && plan.monthly_coins > 0) {
    await supabaseAdmin.rpc("add_coins", {
      p_user_id: userId,
      p_amount: plan.monthly_coins,
      p_transaction_type: "premium_allocation",
      p_description: `Premium plan monthly allocation - ${plan.display_name}`,
    });
  }

  console.log(`✅ Subscription created for user ${userId}`);
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.user_id;

  if (!userId) {
    // Try to find user by stripe customer ID
    const { data: existingSub } = await supabaseAdmin
      .from("user_premium_subscriptions")
      .select("user_id")
      .eq("stripe_subscription_id", subscription.id)
      .single();

    if (!existingSub) {
      console.error("Could not find user for subscription:", subscription.id);
      return;
    }
  }

  // Map Stripe status to our status
  let status = "active";
  if (subscription.status === "canceled") {
    status = "cancelled";
  } else if (subscription.status === "past_due") {
    status = "past_due";
  } else if (
    subscription.status === "unpaid" ||
    subscription.status === "incomplete_expired"
  ) {
    status = "expired";
  }

  // Get period dates from subscription items
  const periodStart = subscription.items.data[0]?.current_period_start;
  const periodEnd = subscription.items.data[0]?.current_period_end;

  const { error } = await supabaseAdmin
    .from("user_premium_subscriptions")
    .update({
      status,
      current_period_start: periodStart
        ? new Date(periodStart * 1000).toISOString()
        : undefined,
      current_period_end: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : undefined,
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    console.error("Error updating subscription:", error);
    throw error;
  }

  console.log(`✅ Subscription ${subscription.id} updated to status: ${status}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const { error } = await supabaseAdmin
    .from("user_premium_subscriptions")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    console.error("Error cancelling subscription:", error);
    throw error;
  }

  console.log(`✅ Subscription ${subscription.id} cancelled`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Check if this is a subscription invoice (for renewal)
  const subscriptionId = typeof invoice.parent?.subscription_details?.subscription === 'string' 
    ? invoice.parent.subscription_details.subscription 
    : invoice.parent?.subscription_details?.subscription?.id;
    
  if (!subscriptionId) {
    return;
  }

  // Get the subscription
  const { data: existingSub } = await supabaseAdmin
    .from("user_premium_subscriptions")
    .select("user_id, plan_id")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (!existingSub) {
    return;
  }

  // Allocate monthly coins for renewal
  const { data: plan } = await supabaseAdmin
    .from("premium_plans")
    .select("monthly_coins, display_name")
    .eq("id", existingSub.plan_id)
    .single();

  if (plan && plan.monthly_coins > 0) {
    await supabaseAdmin.rpc("add_coins", {
      p_user_id: existingSub.user_id,
      p_amount: plan.monthly_coins,
      p_transaction_type: "premium_allocation",
      p_description: `Premium plan monthly allocation - ${plan.display_name}`,
    });
  }

  console.log(`✅ Invoice paid, coins allocated for user ${existingSub.user_id}`);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = typeof invoice.parent?.subscription_details?.subscription === 'string' 
    ? invoice.parent.subscription_details.subscription 
    : invoice.parent?.subscription_details?.subscription?.id;
    
  if (!subscriptionId) {
    return;
  }

  // Update subscription status to past_due
  const { error } = await supabaseAdmin
    .from("user_premium_subscriptions")
    .update({
      status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId);

  if (error) {
    console.error("Error updating subscription to past_due:", error);
  }

  console.log(`⚠️ Invoice payment failed for subscription ${subscriptionId}`);
}

// ========================================
// Stripe Connect Event Handlers
// ========================================

async function handleAccountUpdated(account: Stripe.Account) {
  // Find the creator with this connected account
  const { data: settings, error: findError } = await supabaseAdmin
    .from("creator_payout_settings")
    .select("creator_id")
    .eq("stripe_connect_account_id", account.id)
    .single();

  if (findError || !settings) {
    console.log(`No creator found for Stripe account ${account.id}`);
    return;
  }

  // Update the creator's payout settings with account status
  const { error } = await supabaseAdmin
    .from("creator_payout_settings")
    .update({
      stripe_connect_onboarding_complete: account.details_submitted,
      stripe_connect_details_submitted: account.details_submitted,
      stripe_connect_charges_enabled: account.charges_enabled,
      stripe_connect_payouts_enabled: account.payouts_enabled,
      stripe_connect_requirements: account.requirements || {},
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_connect_account_id", account.id);

  if (error) {
    console.error("Error updating creator payout settings:", error);
    return;
  }

  // Log the event
  await supabaseAdmin
    .from("stripe_connect_events")
    .insert({
      creator_id: settings.creator_id,
      stripe_account_id: account.id,
      event_type: "account.updated",
      event_data: {
        details_submitted: account.details_submitted,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
      },
      processed: true,
    });

  console.log(`✅ Account ${account.id} updated - Payouts enabled: ${account.payouts_enabled}`);
}

async function handleTransferCreated(transfer: Stripe.Transfer) {
  const payoutRequestId = transfer.metadata?.payout_request_id;

  if (!payoutRequestId) {
    console.log("Transfer created without payout_request_id metadata");
    return;
  }

  // Update the payout request status
  const { error } = await supabaseAdmin
    .from("payout_requests")
    .update({
      status: "processing",
      stripe_transfer_id: transfer.id,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", payoutRequestId);

  if (error) {
    console.error("Error updating payout request:", error);
  }

  console.log(`✅ Transfer ${transfer.id} created for payout request ${payoutRequestId}`);
}

async function handleTransferFailed(transfer: Stripe.Transfer) {
  const payoutRequestId = transfer.metadata?.payout_request_id;

  if (!payoutRequestId) {
    return;
  }

  // Update the payout request status to failed
  const { error } = await supabaseAdmin
    .from("payout_requests")
    .update({
      status: "failed",
      failure_reason: "Transfer failed or was reversed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", payoutRequestId);

  if (error) {
    console.error("Error updating failed payout request:", error);
  }

  console.log(`❌ Transfer ${transfer.id} failed for payout request ${payoutRequestId}`);
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const metadata = paymentIntent.metadata;

  // Handle tip payments
  if (metadata?.type === "tip") {
    const characterId = metadata.character_id;
    const creatorId = metadata.creator_id;
    const tipperId = metadata.tipper_id;
    const isAnonymous = metadata.is_anonymous === "true";
    const amount = paymentIntent.amount / 100;

    // Check if tip already exists
    const { data: existingTip } = await supabaseAdmin
      .from("tips")
      .select("id")
      .eq("stripe_payment_intent_id", paymentIntent.id)
      .single();

    if (existingTip) {
      console.log(`Tip already recorded for payment intent ${paymentIntent.id}`);
      return;
    }

    // Create tip record
    const { data: tip, error: tipError } = await supabaseAdmin
      .from("tips")
      .insert({
        fan_id: isAnonymous || tipperId === "anonymous" ? null : tipperId,
        creator_id: creatorId,
        character_id: characterId,
        amount,
        is_anonymous: isAnonymous,
        stripe_payment_intent_id: paymentIntent.id,
        status: "completed",
      })
      .select()
      .single();

    if (tipError) {
      console.error("Error creating tip from webhook:", tipError);
      return;
    }

    // Create earning record (15% platform fee)
    const platformFee = amount * 0.15;
    const netAmount = amount - platformFee;

    await supabaseAdmin
      .from("creator_earnings")
      .insert({
        creator_id: creatorId,
        character_id: characterId,
        source_type: "tip",
        source_id: tip.id,
        gross_amount: amount,
        platform_fee: platformFee,
        platform_fee_percentage: 15,
        net_amount: netAmount,
        status: "available",
      });

    console.log(`✅ Tip payment processed: $${amount} for character ${characterId}`);
  }

  // Handle fan subscription payments
  if (metadata?.type === "fan_subscription") {
    // This is handled by the subscription confirmation endpoint
    console.log(`Fan subscription payment succeeded: ${paymentIntent.id}`);
  }
}
