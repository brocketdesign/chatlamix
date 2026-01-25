import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PUT - Release (make public) or unrelease (make private) auto-generated characters
export async function PUT(request: NextRequest) {
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
    const { characterId, isPublic } = body;

    if (!characterId || isPublic === undefined) {
      return NextResponse.json(
        { error: "Character ID and isPublic status are required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: character, error: charError } = await supabase
      .from("characters")
      .select("id, user_id")
      .eq("id", characterId)
      .single();

    if (charError || !character) {
      return NextResponse.json(
        { error: "Character not found" },
        { status: 404 }
      );
    }

    if (character.user_id !== user.id) {
      return NextResponse.json(
        { error: "You don't have permission to modify this character" },
        { status: 403 }
      );
    }

    // Update character public status
    const { data: updatedChar, error: updateError } = await supabase
      .from("characters")
      .update({ is_public: isPublic })
      .eq("id", characterId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating character:", updateError);
      return NextResponse.json(
        { error: "Failed to update character" },
        { status: 500 }
      );
    }

    // Update auto_generated_characters record if exists
    await supabase
      .from("auto_generated_characters")
      .update({ is_released: isPublic })
      .eq("character_id", characterId)
      .eq("user_id", user.id);

    return NextResponse.json({
      success: true,
      character: {
        id: updatedChar.id,
        name: updatedChar.name,
        isPublic: updatedChar.is_public,
      },
    });
  } catch (error) {
    console.error("Error in PUT release:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Bulk release/unrelease multiple characters
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
    const { characterIds, isPublic } = body;

    if (!characterIds || !Array.isArray(characterIds) || isPublic === undefined) {
      return NextResponse.json(
        { error: "Character IDs array and isPublic status are required" },
        { status: 400 }
      );
    }

    // Update all characters (only those owned by user)
    const { data: updatedChars, error: updateError } = await supabase
      .from("characters")
      .update({ is_public: isPublic })
      .in("id", characterIds)
      .eq("user_id", user.id)
      .select("id, name, is_public");

    if (updateError) {
      console.error("Error bulk updating characters:", updateError);
      return NextResponse.json(
        { error: "Failed to update characters" },
        { status: 500 }
      );
    }

    // Update auto_generated_characters records
    await supabase
      .from("auto_generated_characters")
      .update({ is_released: isPublic })
      .in("character_id", characterIds)
      .eq("user_id", user.id);

    return NextResponse.json({
      success: true,
      updated: updatedChars?.length || 0,
      characters: updatedChars,
    });
  } catch (error) {
    console.error("Error in POST bulk release:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
