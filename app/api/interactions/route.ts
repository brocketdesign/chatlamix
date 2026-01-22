import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST - Track a user interaction
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Allow tracking for non-authenticated users (basic view tracking)
    // but require auth for detailed tracking
    const body = await request.json();
    const { characterId, interactionType, metadata = {}, durationSeconds } = body;

    if (!characterId || !interactionType) {
      return NextResponse.json(
        { error: "Character ID and interaction type are required" },
        { status: 400 }
      );
    }

    // For authenticated users, use the database function
    if (user) {
      const { data: interactionId, error } = await supabase
        .rpc('record_interaction', {
          p_user_id: user.id,
          p_character_id: characterId,
          p_interaction_type: interactionType,
          p_metadata: metadata,
          p_duration_seconds: durationSeconds || null,
        });

      if (error) {
        console.error("Error recording interaction:", error);
        return NextResponse.json(
          { error: "Failed to record interaction" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        interactionId,
      });
    }

    // For anonymous users, just update daily stats for view counts
    if (['profile_viewed', 'post_viewed', 'image_viewed'].includes(interactionType)) {
      const today = new Date().toISOString().split('T')[0];
      
      // Upsert daily stats
      const { error } = await supabase
        .from('character_daily_stats')
        .upsert({
          character_id: characterId,
          date: today,
        }, {
          onConflict: 'character_id,date',
        });

      if (!error) {
        // Update the specific stat
        const statColumn = interactionType === 'profile_viewed' ? 'profile_views' 
          : interactionType === 'post_viewed' ? 'post_views'
          : null;
        
        if (statColumn) {
          try {
            await supabase.rpc('increment_stat', {
              p_character_id: characterId,
              p_date: today,
              p_column: statColumn,
            });
          } catch {
            // Fallback if RPC doesn't exist - just log
            console.log('Stat increment RPC not available');
          }
        }
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Authentication required for this interaction type" },
      { status: 401 }
    );
  } catch (error) {
    console.error("Error tracking interaction:", error);
    return NextResponse.json(
      { error: "Failed to track interaction" },
      { status: 500 }
    );
  }
}

// GET - Get interaction history for a user
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
    const interactionType = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('user_interactions')
      .select(`
        *,
        characters (id, name, thumbnail)
      `, { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (characterId) {
      query = query.eq('character_id', characterId);
    }

    if (interactionType) {
      query = query.eq('interaction_type', interactionType);
    }

    const { data: interactions, error, count } = await query;

    if (error) {
      console.error("Error fetching interactions:", error);
      return NextResponse.json(
        { error: "Failed to fetch interactions" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      interactions,
      total: count || 0,
    });
  } catch (error) {
    console.error("Error fetching interactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch interactions" },
      { status: 500 }
    );
  }
}
