import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { CreateCharacterData, GeneratedTags, Character, CharacterPersonality, PhysicalAttributes } from "@/lib/types";

// Initialize OpenAI only when API key is available
const getOpenAIClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
};

// Generate tags using OpenAI based on character attributes
async function generateCharacterTags(
  characterData: CreateCharacterData
): Promise<GeneratedTags> {
  const prompt = `Based on the following AI character profile, generate relevant tags for categorization and search. The character is for an AI influencer platform.

Character Name: ${characterData.name}
Description: ${characterData.description}
Category: ${characterData.category}

Physical Attributes:
- Gender: ${characterData.physicalAttributes.gender}
- Age: ${characterData.physicalAttributes.age}
- Ethnicity: ${characterData.physicalAttributes.ethnicity}
- Hair: ${characterData.physicalAttributes.hairColor} ${characterData.physicalAttributes.hairLength} ${characterData.physicalAttributes.hairStyle}
- Eye Color: ${characterData.physicalAttributes.eyeColor}
- Body Type: ${characterData.physicalAttributes.bodyType}
- Fashion Style: ${characterData.physicalAttributes.fashionStyle}
- Distinctive Features: ${characterData.physicalAttributes.distinctiveFeatures?.join(", ") || "None"}

Personality:
- Traits: ${characterData.personality.traits.join(", ")}
- Speaking Style: ${characterData.personality.speakingStyle}
- Occupation: ${characterData.personality.occupation}
- Interests: ${characterData.personality.interests.join(", ")}
- Relationship Style: ${characterData.personality.relationshipStyle}

Generate 10-15 relevant tags that would help users find this character. Include tags for appearance, personality, style, and content type. Return as JSON array.

Example format: {"tags": ["brunette", "asian", "friendly", "fashion", "lifestyle", "girlfriend", "casual"], "suggestedCategory": "Lifestyle"}`;

  try {
    const openai = getOpenAIClient();
    if (!openai) {
      return {
        tags: [
          characterData.physicalAttributes.gender,
          characterData.physicalAttributes.ethnicity,
          characterData.physicalAttributes.hairColor,
          characterData.category.toLowerCase(),
          ...characterData.personality.traits.slice(0, 3),
        ],
        category: characterData.category,
      };
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that generates relevant tags for AI influencer characters. Return only valid JSON.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");
    return {
      tags: result.tags || [],
      category: result.suggestedCategory || characterData.category,
    };
  } catch (error) {
    console.error("Error generating tags:", error);
    return {
      tags: [
        characterData.physicalAttributes.gender,
        characterData.physicalAttributes.ethnicity,
        characterData.physicalAttributes.hairColor,
        characterData.category.toLowerCase(),
        ...characterData.personality.traits.slice(0, 3),
      ],
      category: characterData.category,
    };
  }
}

// Helper function to transform database row to Character type
function transformDbCharacter(row: any): Character {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    thumbnail: row.thumbnail || "",
    category: row.category,
    images: row.images || [],
    isPublic: row.is_public,
    personality: row.personality as CharacterPersonality,
    physicalAttributes: row.physical_attributes as PhysicalAttributes,
    tags: row.tags || [],
    mainFaceImage: row.main_face_image,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// GET - Get user's characters or all public characters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;
    
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const characterId = searchParams.get("id");
    const includeAll = searchParams.get("includeAll") === "true"; // For dashboard management view

    // Get character limits for current user
    if (type === "limits" && userId) {
      const { data: isPremium } = await supabase.rpc('user_has_premium', { check_user_id: userId });
      const characterLimit = isPremium ? CHARACTER_LIMITS.premium : CHARACTER_LIMITS.free;

      const { count: existingCharacterCount } = await supabase
        .from("characters")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      return NextResponse.json({
        limit: characterLimit,
        current: existingCharacterCount || 0,
        remaining: Math.max(0, characterLimit - (existingCharacterCount || 0)),
        isPremium: isPremium || false,
        canCreate: (existingCharacterCount || 0) < characterLimit,
      });
    }

    // Get single character by ID
    if (characterId) {
      const { data: character, error } = await supabase
        .from("characters")
        .select("*")
        .eq("id", characterId)
        .single();

      if (error || !character) {
        return NextResponse.json(
          { error: "Character not found" },
          { status: 404 }
        );
      }

      // Check access
      if (!character.is_public && character.user_id !== userId) {
        return NextResponse.json(
          { error: "Access denied" },
          { status: 403 }
        );
      }

      // Get character images
      // Only show ALL images (including unposted/archived) if owner AND explicitly requested via includeAll
      const isOwner = character.user_id === userId;
      const showAllImages = isOwner && includeAll;
      
      let imagesQuery = supabase
        .from("character_images")
        .select("image_url, gallery_status")
        .eq("character_id", characterId);
      
      // Only show posted images unless owner explicitly requests all (dashboard view)
      if (!showAllImages) {
        imagesQuery = imagesQuery.eq("gallery_status", "posted");
      }
      
      const { data: images } = await imagesQuery;

      const result = transformDbCharacter(character);
      // For public profile view, only show posted images
      // For dashboard management view (includeAll), show all images for owner
      result.images = images
        ?.filter(img => showAllImages || img.gallery_status === 'posted')
        .map(img => img.image_url) || [];

      return NextResponse.json(result);
    }

    // Get characters list
    let query = supabase.from("characters").select("*");

    if (type === "user" && userId) {
      query = query.eq("user_id", userId);
    } else if (type === "public") {
      query = query.eq("is_public", true);
    } else {
      // Return public + user's own characters
      if (userId) {
        query = query.or(`is_public.eq.true,user_id.eq.${userId}`);
      } else {
        query = query.eq("is_public", true);
      }
    }

    const { data: characters, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching characters:", error);
      return NextResponse.json(
        { error: "Failed to fetch characters" },
        { status: 500 }
      );
    }

    // Get images for all characters - only posted images for public display
    const characterIds = characters?.map(c => c.id) || [];
    const { data: allImages } = characterIds.length > 0 
      ? await supabase
          .from("character_images")
          .select("character_id, image_url, gallery_status")
          .in("character_id", characterIds)
          .eq("gallery_status", "posted")  // Only show posted images in lists
      : { data: [] };

    // Group images by character
    const imagesByCharacter = allImages?.reduce((acc, img) => {
      if (!acc[img.character_id]) acc[img.character_id] = [];
      acc[img.character_id].push(img.image_url);
      return acc;
    }, {} as Record<string, string[]>) || {};

    const result = characters?.map(char => {
      const transformed = transformDbCharacter(char);
      transformed.images = imagesByCharacter[char.id] || [];
      return transformed;
    }) || [];

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching characters:", error);
    return NextResponse.json(
      { error: "Failed to fetch characters" },
      { status: 500 }
    );
  }
}

// Character limits based on subscription status
const CHARACTER_LIMITS = {
  free: 1,
  premium: 10,
};

// POST - Create a new character
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

    // Check premium status and character limits
    const { data: isPremium } = await supabase.rpc('user_has_premium', { check_user_id: user.id });
    const characterLimit = isPremium ? CHARACTER_LIMITS.premium : CHARACTER_LIMITS.free;

    // Count existing characters for this user
    const { count: existingCharacterCount, error: countError } = await supabase
      .from("characters")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (countError) {
      console.error("Error counting characters:", countError);
      return NextResponse.json(
        { error: "Failed to check character limit" },
        { status: 500 }
      );
    }

    if ((existingCharacterCount || 0) >= characterLimit) {
      const limitMessage = isPremium 
        ? `Premium users can create up to ${CHARACTER_LIMITS.premium} characters. You have reached this limit.`
        : `Free users can only create ${CHARACTER_LIMITS.free} character. Upgrade to Premium to create up to ${CHARACTER_LIMITS.premium} characters.`;
      
      return NextResponse.json(
        { 
          error: "Character limit reached",
          message: limitMessage,
          limit: characterLimit,
          current: existingCharacterCount || 0,
          isPremium: isPremium || false
        },
        { status: 403 }
      );
    }

    const data: CreateCharacterData = await request.json();

    if (!data.name || !data.description) {
      return NextResponse.json(
        { error: "Name and description are required" },
        { status: 400 }
      );
    }

    // Generate tags using OpenAI
    const { tags, category } = await generateCharacterTags(data);

    // Create the character in Supabase
    const { data: character, error } = await supabase
      .from("characters")
      .insert({
        user_id: user.id,
        name: data.name,
        description: data.description,
        category: category || data.category,
        personality: data.personality,
        physical_attributes: data.physicalAttributes,
        tags,
        is_public: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating character:", error);
      return NextResponse.json(
        { error: "Failed to create character" },
        { status: 500 }
      );
    }

    return NextResponse.json(transformDbCharacter(character), { status: 201 });
  } catch (error) {
    console.error("Error creating character:", error);
    return NextResponse.json(
      { error: "Failed to create character" },
      { status: 500 }
    );
  }
}

// PUT - Update a character
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

    const { id, ...updates } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Character ID is required" },
        { status: 400 }
      );
    }

    // Check ownership
    const { data: existing, error: fetchError } = await supabase
      .from("characters")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Character not found" },
        { status: 404 }
      );
    }

    if (existing.user_id !== user.id) {
      return NextResponse.json(
        { error: "You don't have permission to update this character" },
        { status: 403 }
      );
    }

    // Prepare update object
    const updateData: any = {};
    if (updates.name) updateData.name = updates.name;
    if (updates.description) updateData.description = updates.description;
    if (updates.category) updateData.category = updates.category;
    if (updates.isPublic !== undefined) updateData.is_public = updates.isPublic;
    if (updates.thumbnail) updateData.thumbnail = updates.thumbnail;
    if (updates.personality) updateData.personality = updates.personality;
    if (updates.physicalAttributes) updateData.physical_attributes = updates.physicalAttributes;
    if (updates.tags) updateData.tags = updates.tags;
    if (updates.mainFaceImage) {
      updateData.main_face_image = updates.mainFaceImage;
      console.log("[characters PUT] Updating main_face_image, length:", updates.mainFaceImage.length);
    }

    console.log("[characters PUT] Update data keys:", Object.keys(updateData));

    const { data: updated, error: updateError } = await supabase
      .from("characters")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating character:", updateError);
      return NextResponse.json(
        { error: "Failed to update character" },
        { status: 500 }
      );
    }

    console.log("[characters PUT] Updated character main_face_image length:", updated.main_face_image?.length);

    return NextResponse.json(transformDbCharacter(updated));
  } catch (error) {
    console.error("Error updating character:", error);
    return NextResponse.json(
      { error: "Failed to update character" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a character
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
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Character ID is required" },
        { status: 400 }
      );
    }

    // Check ownership
    const { data: existing, error: fetchError } = await supabase
      .from("characters")
      .select("user_id")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Character not found" },
        { status: 404 }
      );
    }

    if (existing.user_id !== user.id) {
      return NextResponse.json(
        { error: "You don't have permission to delete this character" },
        { status: 403 }
      );
    }

    // Delete the character (cascade will handle images)
    const { error: deleteError } = await supabase
      .from("characters")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting character:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete character" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting character:", error);
    return NextResponse.json(
      { error: "Failed to delete character" },
      { status: 500 }
    );
  }
}
