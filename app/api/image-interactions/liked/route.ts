import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - Get user's liked images
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
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get user's liked images with character info
    const { data: likes, error, count } = await supabase
      .from('image_likes')
      .select(`
        id,
        image_identifier,
        character_id,
        created_at,
        characters (
          id,
          name,
          thumbnail,
          description,
          category,
          images,
          is_public
        )
      `, { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching liked images:", error);
      return NextResponse.json(
        { error: "Failed to fetch liked images" },
        { status: 500 }
      );
    }

    // Transform data to include the actual image URL
    const likedImages = likes?.map(like => {
      // Handle the characters relation - it might be an array or single object
      const charData = like.characters;
      const character = Array.isArray(charData) ? charData[0] : charData;
      
      if (!character) return null;
      
      // Parse image_identifier to get the index
      const parts = like.image_identifier.split('-');
      const imageIndex = parseInt(parts[parts.length - 1]) || 0;
      
      return {
        id: like.id,
        imageIdentifier: like.image_identifier,
        characterId: like.character_id,
        imageIndex,
        imageUrl: character.images?.[imageIndex] || character.thumbnail || null,
        likedAt: like.created_at,
        character: {
          id: character.id,
          name: character.name,
          thumbnail: character.thumbnail,
          description: character.description,
          category: character.category,
          isPublic: character.is_public,
        },
      };
    }).filter((like): like is NonNullable<typeof like> => like !== null && like.imageUrl && like.character) || [];

    return NextResponse.json({
      likedImages,
      total: count || 0,
      hasMore: (offset + limit) < (count || 0),
    });
  } catch (error) {
    console.error("Error in liked images GET:", error);
    return NextResponse.json(
      { error: "Failed to fetch liked images" },
      { status: 500 }
    );
  }
}
