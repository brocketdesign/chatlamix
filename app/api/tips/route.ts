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

// Utility to check if user has premium
async function checkPremium(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: isPremium } = await supabase.rpc('user_has_premium', { check_user_id: userId });
  return isPremium || false;
}

// GET - Get tips (for creators) or sent tips (for fans)
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
    const type = searchParams.get('type') || 'received'; // 'received' or 'sent'
    const characterId = searchParams.get('characterId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('tips')
      .select(`
        *,
        characters (id, name, thumbnail),
        profiles!tips_fan_id_fkey (id, full_name, avatar_url)
      `, { count: 'exact' })
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type === 'received') {
      query = query.eq('creator_id', user.id);
    } else {
      query = query.eq('fan_id', user.id);
    }

    if (characterId) {
      query = query.eq('character_id', characterId);
    }

    const { data: tips, error, count } = await query;

    if (error) {
      console.error("Error fetching tips:", error);
      return NextResponse.json(
        { error: "Failed to fetch tips" },
        { status: 500 }
      );
    }

    // Calculate totals
    const total = tips?.reduce((sum, tip) => sum + tip.amount, 0) || 0;

    return NextResponse.json({
      tips,
      total,
      count: count || 0,
    });
  } catch (error) {
    console.error("Error fetching tips:", error);
    return NextResponse.json(
      { error: "Failed to fetch tips" },
      { status: 500 }
    );
  }
}

// POST - Send a tip
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
    const { characterId, amount, useCoins = false, message, isAnonymous = false } = body;

    if (!characterId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: "Character ID and valid amount are required" },
        { status: 400 }
      );
    }

    // Get character and monetization settings
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

    // Check if creator has premium (required for monetization)
    const creatorHasPremium = await checkPremium(supabase, character.user_id);
    if (!creatorHasPremium) {
      return NextResponse.json(
        { error: "Creator does not have monetization enabled" },
        { status: 400 }
      );
    }

    // Get monetization settings
    const { data: monetization } = await supabase
      .from('character_monetization')
      .select('*')
      .eq('character_id', characterId)
      .single();

    if (!monetization?.tips_enabled) {
      return NextResponse.json(
        { error: "Tips are not enabled for this character" },
        { status: 400 }
      );
    }

    if (amount < (monetization.min_tip_amount || 1)) {
      return NextResponse.json(
        { error: `Minimum tip amount is $${monetization.min_tip_amount || 1}` },
        { status: 400 }
      );
    }

    // Can't tip yourself
    if (character.user_id === user.id) {
      return NextResponse.json(
        { error: "Cannot tip your own character" },
        { status: 400 }
      );
    }

    let coinTransactionId: string | undefined;
    let stripePaymentIntentId: string | undefined;
    
    if (useCoins) {
      // Convert dollar amount to coins (1 dollar = 100 coins)
      const coinAmount = Math.round(amount * 100);
      
      // Deduct coins
      const { data: deductResult, error: deductError } = await supabase
        .rpc('deduct_coins', {
          p_user_id: user.id,
          p_amount: coinAmount,
          p_transaction_type: 'tip_sent',
          p_reference_type: 'tip',
          p_description: `Tip to ${character.name}`,
        });

      if (deductError || !deductResult?.[0]?.success) {
        return NextResponse.json(
          { error: "Insufficient coins" },
          { status: 400 }
        );
      }
      coinTransactionId = deductResult[0].transaction_id;
    } else {
      // For real-money tips, we need to check if creator has Stripe Connect
      const { data: creatorSettings } = await supabase
        .from('creator_payout_settings')
        .select('stripe_connect_account_id, stripe_connect_charges_enabled')
        .eq('creator_id', character.user_id)
        .single();

      if (!creatorSettings?.stripe_connect_account_id) {
        return NextResponse.json(
          { error: "Creator has not set up payment receiving. Please use coins instead." },
          { status: 400 }
        );
      }

      // Create a payment intent with direct charge to connected account
      // Platform takes 15% fee using application_fee_amount
      const platformFee = Math.round(amount * PLATFORM_FEE_PERCENTAGE * 100); // in cents
      
      try {
        // Get or create Stripe customer for the tipper
        const { data: tipperProfile } = await supabase
          .from('profiles')
          .select('stripe_customer_id, email')
          .eq('id', user.id)
          .single();

        let customerId = tipperProfile?.stripe_customer_id;

        if (!customerId && tipperProfile?.email) {
          const customer = await stripe.customers.create({
            email: tipperProfile.email,
            metadata: { user_id: user.id },
          });
          customerId = customer.id;

          // Save customer ID
          await getSupabaseAdmin()
            .from('profiles')
            .update({ stripe_customer_id: customerId })
            .eq('id', user.id);
        }

        // Create payment intent using destination charges
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100), // Convert to cents
          currency: 'usd',
          customer: customerId || undefined,
          application_fee_amount: platformFee,
          transfer_data: {
            destination: creatorSettings.stripe_connect_account_id,
          },
          metadata: {
            type: 'tip',
            character_id: characterId,
            creator_id: character.user_id,
            tipper_id: isAnonymous ? 'anonymous' : user.id,
            is_anonymous: isAnonymous.toString(),
          },
          description: `Tip to ${character.name}`,
          automatic_payment_methods: {
            enabled: true,
          },
        });

        // Return client secret for frontend to complete payment
        return NextResponse.json({
          requiresPayment: true,
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          amount,
          characterName: character.name,
        });
      } catch (stripeError) {
        console.error("Stripe payment error:", stripeError);
        return NextResponse.json(
          { error: "Failed to process payment. Please try again." },
          { status: 500 }
        );
      }
    }

    // Create tip record (for coin tips - real money tips are confirmed via webhook)
    const { data: tip, error: tipError } = await supabase
      .from('tips')
      .insert({
        fan_id: isAnonymous ? null : user.id,
        creator_id: character.user_id,
        character_id: characterId,
        amount,
        coin_amount: useCoins ? Math.round(amount * 100) : null,
        message,
        is_anonymous: isAnonymous,
        coin_transaction_id: coinTransactionId,
        stripe_payment_intent_id: stripePaymentIntentId,
        status: 'completed',
      })
      .select()
      .single();

    if (tipError) {
      console.error("Error creating tip:", tipError);
      return NextResponse.json(
        { error: "Failed to send tip" },
        { status: 500 }
      );
    }

    // Record interaction
    await supabase.rpc('record_interaction', {
      p_user_id: user.id,
      p_character_id: characterId,
      p_interaction_type: 'tip_sent',
      p_metadata: { amount, is_anonymous: isAnonymous, use_coins: useCoins },
    });

    // Create earning record for creator (platform takes 15% fee on tips)
    const platformFee = amount * PLATFORM_FEE_PERCENTAGE;
    const netAmount = amount - platformFee;
    
    await supabase
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
        status: 'pending',
      });

    // Update daily stats
    const today = new Date().toISOString().split('T')[0];
    await supabase
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
    console.error("Error sending tip:", error);
    return NextResponse.json(
      { error: "Failed to send tip" },
      { status: 500 }
    );
  }
}
