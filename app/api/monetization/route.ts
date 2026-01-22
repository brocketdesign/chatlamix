import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Utility to check if user has premium
async function checkPremium(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: isPremium } = await supabase.rpc('user_has_premium', { check_user_id: userId });
  return isPremium || false;
}

// GET - Get monetization settings for a character
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const characterId = searchParams.get('characterId');

    if (!characterId) {
      return NextResponse.json(
        { error: "Character ID required" },
        { status: 400 }
      );
    }

    const { data: monetization, error } = await supabase
      .from('character_monetization')
      .select('*')
      .eq('character_id', characterId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error("Error fetching monetization:", error);
      return NextResponse.json(
        { error: "Failed to fetch monetization settings" },
        { status: 500 }
      );
    }

    // Get tiers for this character
    const { data: tiers } = await supabase
      .from('creator_tiers')
      .select('*')
      .eq('character_id', characterId)
      .eq('is_active', true)
      .order('tier_level', { ascending: true });

    return NextResponse.json({
      monetization: monetization || null,
      tiers: tiers || [],
      isMonetized: monetization?.is_monetized || false,
    });
  } catch (error) {
    console.error("Error fetching monetization:", error);
    return NextResponse.json(
      { error: "Failed to fetch monetization settings" },
      { status: 500 }
    );
  }
}

// POST - Enable monetization for a character (requires Premium)
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

    // Check premium status
    const isPremium = await checkPremium(supabase, user.id);
    if (!isPremium) {
      return NextResponse.json(
        { error: "Premium subscription required for monetization" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { characterId } = body;

    if (!characterId) {
      return NextResponse.json(
        { error: "Character ID required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: character, error: charError } = await supabase
      .from('characters')
      .select('id, user_id')
      .eq('id', characterId)
      .eq('user_id', user.id)
      .single();

    if (charError || !character) {
      return NextResponse.json(
        { error: "Character not found or you don't own it" },
        { status: 403 }
      );
    }

    // Create or update monetization settings
    const { data: monetization, error: createError } = await supabase
      .from('character_monetization')
      .upsert({
        character_id: characterId,
        creator_id: user.id,
        is_monetized: true,
        tips_enabled: true,
        min_tip_amount: 1.00,
      }, {
        onConflict: 'character_id',
      })
      .select()
      .single();

    if (createError) {
      console.error("Error enabling monetization:", createError);
      return NextResponse.json(
        { error: "Failed to enable monetization" },
        { status: 500 }
      );
    }

    // Initialize character ranking if not exists
    await supabase
      .from('character_rankings')
      .upsert({
        character_id: characterId,
        category: (await supabase.from('characters').select('category').eq('id', characterId).single())?.data?.category,
      }, {
        onConflict: 'character_id',
      });

    return NextResponse.json({
      success: true,
      monetization,
      message: "Monetization enabled successfully!",
    });
  } catch (error) {
    console.error("Error enabling monetization:", error);
    return NextResponse.json(
      { error: "Failed to enable monetization" },
      { status: 500 }
    );
  }
}

// PATCH - Update monetization settings
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
    const { characterId, ...updates } = body;

    if (!characterId) {
      return NextResponse.json(
        { error: "Character ID required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: monetization, error: fetchError } = await supabase
      .from('character_monetization')
      .select('*')
      .eq('character_id', characterId)
      .eq('creator_id', user.id)
      .single();

    if (fetchError || !monetization) {
      return NextResponse.json(
        { error: "Monetization settings not found or you don't own this character" },
        { status: 403 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (updates.isMonetized !== undefined) updateData.is_monetized = updates.isMonetized;
    if (updates.tipsEnabled !== undefined) updateData.tips_enabled = updates.tipsEnabled;
    if (updates.minTipAmount !== undefined) updateData.min_tip_amount = updates.minTipAmount;
    if (updates.fanImageRequestsEnabled !== undefined) updateData.fan_image_requests_enabled = updates.fanImageRequestsEnabled;
    if (updates.fanImageRequestCost !== undefined) updateData.fan_image_request_cost = updates.fanImageRequestCost;
    if (updates.welcomeMessage !== undefined) updateData.welcome_message = updates.welcomeMessage;

    const { data: updated, error: updateError } = await supabase
      .from('character_monetization')
      .update(updateData)
      .eq('character_id', characterId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating monetization:", updateError);
      return NextResponse.json(
        { error: "Failed to update monetization settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      monetization: updated,
      message: "Monetization settings updated!",
    });
  } catch (error) {
    console.error("Error updating monetization:", error);
    return NextResponse.json(
      { error: "Failed to update monetization settings" },
      { status: 500 }
    );
  }
}
