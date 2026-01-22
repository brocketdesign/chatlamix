import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Utility to check if user has premium
async function checkPremium(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: isPremium } = await supabase.rpc('user_has_premium', { check_user_id: userId });
  return isPremium || false;
}

// GET - Get tiers for a character
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const characterId = searchParams.get('characterId');
    const creatorId = searchParams.get('creatorId');

    let query = supabase
      .from('creator_tiers')
      .select('*')
      .eq('is_active', true)
      .order('tier_level', { ascending: true });

    if (characterId) {
      query = query.eq('character_id', characterId);
    } else if (creatorId) {
      query = query.eq('creator_id', creatorId);
    } else {
      return NextResponse.json(
        { error: "Character ID or Creator ID required" },
        { status: 400 }
      );
    }

    const { data: tiers, error } = await query;

    if (error) {
      console.error("Error fetching tiers:", error);
      return NextResponse.json(
        { error: "Failed to fetch tiers" },
        { status: 500 }
      );
    }

    return NextResponse.json(tiers);
  } catch (error) {
    console.error("Error fetching tiers:", error);
    return NextResponse.json(
      { error: "Failed to fetch tiers" },
      { status: 500 }
    );
  }
}

// POST - Create a new tier (Premium only)
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
        { error: "Premium subscription required to create tiers" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      characterId,
      name,
      description,
      priceMonthly,
      benefits = [],
      exclusivePosts = false,
      privateChat = false,
      customImages = false,
      customImagesPerMonth = 0,
      priorityResponses = false,
      behindTheScenes = false,
      earlyAccess = false,
      badgeColor = '#8b5cf6',
      badgeEmoji,
    } = body;

    if (!characterId || !name || typeof priceMonthly !== 'number') {
      return NextResponse.json(
        { error: "Character ID, name, and price are required" },
        { status: 400 }
      );
    }

    // Verify ownership of character
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

    // Get the next tier level
    const { data: existingTiers } = await supabase
      .from('creator_tiers')
      .select('tier_level')
      .eq('character_id', characterId)
      .order('tier_level', { ascending: false })
      .limit(1);

    const nextTierLevel = (existingTiers?.[0]?.tier_level || 0) + 1;

    // Create the tier
    const { data: tier, error: createError } = await supabase
      .from('creator_tiers')
      .insert({
        character_id: characterId,
        creator_id: user.id,
        name,
        description,
        price_monthly: priceMonthly,
        tier_level: nextTierLevel,
        benefits: JSON.stringify(benefits),
        exclusive_posts: exclusivePosts,
        private_chat: privateChat,
        custom_images: customImages,
        custom_images_per_month: customImagesPerMonth,
        priority_responses: priorityResponses,
        behind_the_scenes: behindTheScenes,
        early_access: earlyAccess,
        badge_color: badgeColor,
        badge_emoji: badgeEmoji,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating tier:", createError);
      return NextResponse.json(
        { error: "Failed to create tier" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      tier,
      message: "Tier created successfully!",
    });
  } catch (error) {
    console.error("Error creating tier:", error);
    return NextResponse.json(
      { error: "Failed to create tier" },
      { status: 500 }
    );
  }
}

// PATCH - Update a tier
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
    const { tierId, ...updates } = body;

    if (!tierId) {
      return NextResponse.json(
        { error: "Tier ID required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: tier, error: tierError } = await supabase
      .from('creator_tiers')
      .select('*')
      .eq('id', tierId)
      .eq('creator_id', user.id)
      .single();

    if (tierError || !tier) {
      return NextResponse.json(
        { error: "Tier not found or you don't own it" },
        { status: 403 }
      );
    }

    // Build update object with snake_case keys
    const updateData: Record<string, unknown> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.priceMonthly !== undefined) updateData.price_monthly = updates.priceMonthly;
    if (updates.benefits !== undefined) updateData.benefits = JSON.stringify(updates.benefits);
    if (updates.exclusivePosts !== undefined) updateData.exclusive_posts = updates.exclusivePosts;
    if (updates.privateChat !== undefined) updateData.private_chat = updates.privateChat;
    if (updates.customImages !== undefined) updateData.custom_images = updates.customImages;
    if (updates.customImagesPerMonth !== undefined) updateData.custom_images_per_month = updates.customImagesPerMonth;
    if (updates.priorityResponses !== undefined) updateData.priority_responses = updates.priorityResponses;
    if (updates.behindTheScenes !== undefined) updateData.behind_the_scenes = updates.behindTheScenes;
    if (updates.earlyAccess !== undefined) updateData.early_access = updates.earlyAccess;
    if (updates.badgeColor !== undefined) updateData.badge_color = updates.badgeColor;
    if (updates.badgeEmoji !== undefined) updateData.badge_emoji = updates.badgeEmoji;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    const { data: updated, error: updateError } = await supabase
      .from('creator_tiers')
      .update(updateData)
      .eq('id', tierId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating tier:", updateError);
      return NextResponse.json(
        { error: "Failed to update tier" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      tier: updated,
      message: "Tier updated successfully!",
    });
  } catch (error) {
    console.error("Error updating tier:", error);
    return NextResponse.json(
      { error: "Failed to update tier" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a tier (only if no active subscribers)
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

    const { searchParams } = new URL(request.url);
    const tierId = searchParams.get('tierId');

    if (!tierId) {
      return NextResponse.json(
        { error: "Tier ID required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: tier, error: tierError } = await supabase
      .from('creator_tiers')
      .select('*')
      .eq('id', tierId)
      .eq('creator_id', user.id)
      .single();

    if (tierError || !tier) {
      return NextResponse.json(
        { error: "Tier not found or you don't own it" },
        { status: 403 }
      );
    }

    // Check for active subscribers
    const { count: subscriberCount } = await supabase
      .from('fan_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('tier_id', tierId)
      .eq('status', 'active');

    if (subscriberCount && subscriberCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete tier with active subscribers. Deactivate it instead." },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabase
      .from('creator_tiers')
      .delete()
      .eq('id', tierId);

    if (deleteError) {
      console.error("Error deleting tier:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete tier" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Tier deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting tier:", error);
    return NextResponse.json(
      { error: "Failed to delete tier" },
      { status: 500 }
    );
  }
}
