import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Lazy initialization for service role client to avoid build-time errors
function getSupabaseAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const PLATFORM_FEE_PERCENTAGE = 0.15; // 15% platform fee

// POST - Confirm tip payment after Stripe payment is complete
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
    const { paymentIntentId, characterId, message, isAnonymous = false } = body;

    if (!paymentIntentId || !characterId) {
      return NextResponse.json(
        { error: "Payment intent ID and character ID are required" },
        { status: 400 }
      );
    }

    // Verify the payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        { error: "Payment has not been completed" },
        { status: 400 }
      );
    }

    // Verify this payment hasn't already been processed
    const { data: existingTip } = await supabase
      .from('tips')
      .select('id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .single();

    if (existingTip) {
      return NextResponse.json(
        { error: "This payment has already been processed" },
        { status: 400 }
      );
    }

    // Verify the metadata matches
    if (paymentIntent.metadata.character_id !== characterId) {
      return NextResponse.json(
        { error: "Invalid payment for this character" },
        { status: 400 }
      );
    }

    // Get character details
    const { data: character, error: charError } = await supabase
      .from('characters')
      .select('id, user_id, name')
      .eq('id', characterId)
      .single();

    if (charError || !character) {
      return NextResponse.json(
        { error: "Character not found" },
        { status: 404 }
      );
    }

    const amount = paymentIntent.amount / 100; // Convert from cents

    // Create tip record
    const { data: tip, error: tipError } = await getSupabaseAdmin()
      .from('tips')
      .insert({
        fan_id: isAnonymous ? null : user.id,
        creator_id: character.user_id,
        character_id: characterId,
        amount,
        message,
        is_anonymous: isAnonymous,
        stripe_payment_intent_id: paymentIntentId,
        status: 'completed',
      })
      .select()
      .single();

    if (tipError) {
      console.error("Error creating tip:", tipError);
      return NextResponse.json(
        { error: "Failed to record tip" },
        { status: 500 }
      );
    }

    // Record interaction
    await supabase.rpc('record_interaction', {
      p_user_id: user.id,
      p_character_id: characterId,
      p_interaction_type: 'tip_sent',
      p_metadata: { amount, is_anonymous: isAnonymous, payment_method: 'stripe' },
    });

    // Create earning record for creator (platform takes 15% fee)
    // Note: The fee was already taken by Stripe via application_fee_amount
    const platformFee = amount * PLATFORM_FEE_PERCENTAGE;
    const netAmount = amount - platformFee;

    await getSupabaseAdmin()
      .from('creator_earnings')
      .insert({
        creator_id: character.user_id,
        character_id: characterId,
        source_type: 'tip',
        source_id: tip.id,
        gross_amount: amount,
        platform_fee: platformFee,
        platform_fee_percentage: PLATFORM_FEE_PERCENTAGE * 100,
        net_amount: netAmount,
        status: 'available', // Funds are immediately available since already transferred
      });

    // Update daily stats
    const today = new Date().toISOString().split('T')[0];
    await getSupabaseAdmin()
      .from('character_daily_stats')
      .upsert({
        character_id: characterId,
        date: today,
        tip_revenue: amount,
        total_revenue: amount,
      }, {
        onConflict: 'character_id,date',
        ignoreDuplicates: false,
      });

    return NextResponse.json({
      success: true,
      tip,
      message: `Successfully sent $${amount.toFixed(2)} tip to ${character.name}!`,
    });
  } catch (error) {
    console.error("Error confirming tip:", error);
    return NextResponse.json(
      { error: "Failed to confirm tip" },
      { status: 500 }
    );
  }
}
