import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - Get user's follows
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { searchParams } = new URL(request.url);
    const characterId = searchParams.get('characterId');
    const stats = searchParams.get('stats');

    // If requesting stats for a character (no auth required)
    if (characterId && stats === 'true') {
      // Get follower count
      const { count: followerCount } = await supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('character_id', characterId);

      // Get subscriber count
      const { count: subscriberCount } = await supabase
        .from('user_subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('character_id', characterId)
        .eq('status', 'active');

      return NextResponse.json({
        followerCount: followerCount || 0,
        subscriberCount: subscriberCount || 0,
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (characterId) {
      // Check if following specific character
      const { data: follow } = await supabase
        .from('user_follows')
        .select('*')
        .eq('follower_id', user.id)
        .eq('character_id', characterId)
        .single();

      return NextResponse.json({
        isFollowing: !!follow,
        follow,
      });
    }

    // Get all follows
    const { data: follows, error } = await supabase
      .from('user_follows')
      .select(`
        *,
        characters (id, name, thumbnail, description, category)
      `)
      .eq('follower_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching follows:", error);
      return NextResponse.json(
        { error: "Failed to fetch follows" },
        { status: 500 }
      );
    }

    return NextResponse.json(follows);
  } catch (error) {
    console.error("Error fetching follows:", error);
    return NextResponse.json(
      { error: "Failed to fetch follows" },
      { status: 500 }
    );
  }
}

// POST - Follow a character
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
    const { characterId, notificationsEnabled = true } = body;

    if (!characterId) {
      return NextResponse.json(
        { error: "Character ID required" },
        { status: 400 }
      );
    }

    // Verify character exists and is public
    const { data: character, error: charError } = await supabase
      .from('characters')
      .select('id, user_id, name')
      .eq('id', characterId)
      .eq('is_public', true)
      .single();

    if (charError || !character) {
      return NextResponse.json(
        { error: "Character not found" },
        { status: 404 }
      );
    }

    // Can't follow your own character
    if (character.user_id === user.id) {
      return NextResponse.json(
        { error: "Cannot follow your own character" },
        { status: 400 }
      );
    }

    // Create follow
    const { data: follow, error: followError } = await supabase
      .from('user_follows')
      .insert({
        follower_id: user.id,
        character_id: characterId,
        notifications_enabled: notificationsEnabled,
      })
      .select()
      .single();

    if (followError) {
      if (followError.code === '23505') { // Unique violation
        return NextResponse.json(
          { error: "Already following this character" },
          { status: 400 }
        );
      }
      console.error("Error creating follow:", followError);
      return NextResponse.json(
        { error: "Failed to follow character" },
        { status: 500 }
      );
    }

    // Record interaction
    await supabase.rpc('record_interaction', {
      p_user_id: user.id,
      p_character_id: characterId,
      p_interaction_type: 'follow',
    });

    // Update ranking follower count
    await supabase
      .from('character_rankings')
      .upsert({
        character_id: characterId,
        follower_count: 1,
      }, {
        onConflict: 'character_id',
      });

    return NextResponse.json({
      success: true,
      follow,
      message: `Now following ${character.name}!`,
    });
  } catch (error) {
    console.error("Error following character:", error);
    return NextResponse.json(
      { error: "Failed to follow character" },
      { status: 500 }
    );
  }
}

// DELETE - Unfollow a character
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

    // Try to get characterId from URL params first, then from body
    const { searchParams } = new URL(request.url);
    let characterId = searchParams.get('characterId');

    if (!characterId) {
      try {
        const body = await request.json();
        characterId = body.characterId;
      } catch {
        // Body parsing failed, continue with null
      }
    }

    if (!characterId) {
      return NextResponse.json(
        { error: "Character ID required" },
        { status: 400 }
      );
    }

    // Delete follow
    const { error } = await supabase
      .from('user_follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('character_id', characterId);

    if (error) {
      console.error("Error deleting follow:", error);
      return NextResponse.json(
        { error: "Failed to unfollow character" },
        { status: 500 }
      );
    }

    // Record interaction
    await supabase.rpc('record_interaction', {
      p_user_id: user.id,
      p_character_id: characterId,
      p_interaction_type: 'unfollow',
    });

    return NextResponse.json({
      success: true,
      message: "Unfollowed successfully",
    });
  } catch (error) {
    console.error("Error unfollowing:", error);
    return NextResponse.json(
      { error: "Failed to unfollow character" },
      { status: 500 }
    );
  }
}

// PATCH - Update follow settings
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
    const { characterId, notificationsEnabled } = body;

    if (!characterId) {
      return NextResponse.json(
        { error: "Character ID required" },
        { status: 400 }
      );
    }

    const { data: follow, error } = await supabase
      .from('user_follows')
      .update({ notifications_enabled: notificationsEnabled })
      .eq('follower_id', user.id)
      .eq('character_id', characterId)
      .select()
      .single();

    if (error) {
      console.error("Error updating follow:", error);
      return NextResponse.json(
        { error: "Failed to update follow settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      follow,
    });
  } catch (error) {
    console.error("Error updating follow:", error);
    return NextResponse.json(
      { error: "Failed to update follow settings" },
      { status: 500 }
    );
  }
}
