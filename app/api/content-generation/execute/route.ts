import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ExecuteContentGenerationRequest,
  CreativePromptSuggestion,
  ContentType,
  PhysicalAttributes,
  CharacterPersonality,
} from "@/lib/types";
import {
  generateCreativePrompts,
  generateImage,
  buildCharacterPrompt,
} from "@/lib/content-generation";

// POST - Execute content generation (manual or automated)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body: ExecuteContentGenerationRequest = await request.json();
    const {
      scheduleId,
      characterId,
      prompt,
      contentType = "lifestyle",
      customThemes,
      stylePreferences,
      autoPost = false,
      scheduledFor,
    } = body;

    if (!characterId) {
      return NextResponse.json(
        { error: "Character ID is required" },
        { status: 400 }
      );
    }

    // Get character details
    const { data: character, error: charError } = await supabase
      .from("characters")
      .select("*")
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
        { error: "You don't have permission to generate content for this character" },
        { status: 403 }
      );
    }

    // Get schedule details if provided
    let schedule = null;
    if (scheduleId) {
      const { data: scheduleData } = await supabase
        .from("content_generation_schedules")
        .select("*")
        .eq("id", scheduleId)
        .eq("user_id", user.id)
        .single();
      schedule = scheduleData;
    }

    // Get previous prompts to avoid repetition
    const { data: previousContent } = await supabase
      .from("generated_content")
      .select("original_prompt")
      .eq("character_id", characterId)
      .order("created_at", { ascending: false })
      .limit(10);

    const previousPrompts = previousContent?.map((c) => c.original_prompt) || [];

    // Generate creative prompt if not provided
    let finalPrompt = prompt;
    let caption = "";
    let hashtags: string[] = [];
    let aiSuggestions: CreativePromptSuggestion | null = null;

    if (!finalPrompt) {
      try {
        // Use the shared function directly instead of HTTP call
        const prompts = await generateCreativePrompts({
          character: {
            name: character.name,
            personality: character.personality as CharacterPersonality,
            physical_attributes: character.physical_attributes as PhysicalAttributes,
          },
          contentType: (schedule?.content_type || contentType) as ContentType,
          customThemes: schedule?.custom_themes || customThemes,
          stylePreferences: schedule?.style_preferences || stylePreferences,
          previousPrompts,
          count: 1,
        });

        if (prompts && prompts.length > 0) {
          aiSuggestions = prompts[0];
          finalPrompt = aiSuggestions.prompt;
          caption = aiSuggestions.caption;
          hashtags = aiSuggestions.hashtags;
        } else {
          return NextResponse.json(
            { error: "No prompt suggestions generated" },
            { status: 500 }
          );
        }
      } catch (promptError: any) {
        console.error("Error generating creative prompt:", promptError);
        return NextResponse.json(
          { error: promptError.message || "Failed to generate creative prompt" },
          { status: 500 }
        );
      }
    }

    // Build the full prompt with character attributes
    const physicalAttributes = character.physical_attributes as PhysicalAttributes;
    const enhancedPrompt = physicalAttributes
      ? buildCharacterPrompt(physicalAttributes, finalPrompt)
      : finalPrompt;

    // Generate the image using the shared function
    const imageResult = await generateImage({
      supabase,
      userId: user.id,
      characterId,
      character: {
        main_face_image: character.main_face_image,
        physical_attributes: character.physical_attributes as PhysicalAttributes,
        thumbnail: character.thumbnail,
      },
      scenePrompt: finalPrompt,
      width: 1024,
      height: 1024,
      faceSwapBaseUrl: request.nextUrl.origin,
    });

    if (!imageResult.success) {
      return NextResponse.json(
        { error: imageResult.error || "Failed to generate image" },
        { status: 500 }
      );
    }

    // Save generated content to database
    const { data: generatedContent, error: saveError } = await supabase
      .from("generated_content")
      .insert({
        schedule_id: scheduleId,
        user_id: user.id,
        character_id: characterId,
        character_image_id: imageResult.image?.id,
        original_prompt: finalPrompt,
        enhanced_prompt: enhancedPrompt,
        image_url: imageResult.image?.imageUrl,
        caption,
        hashtags,
        ai_suggestions: aiSuggestions ? {
          alternativePrompts: [],
          captionVariations: [],
          hashtagSuggestions: hashtags,
          reasoning: aiSuggestions.reasoning,
          mood: aiSuggestions.mood,
          setting: aiSuggestions.setting,
        } : null,
        content_type: schedule?.content_type || contentType,
        status: "generated",
      })
      .select()
      .single();

    if (saveError) {
      console.error("Error saving generated content:", saveError);
      // Continue even if save fails - user still gets the image
    }

    // Update schedule execution tracking if applicable
    if (scheduleId && schedule) {
      const nextScheduledAt = calculateNextScheduledAt(
        schedule.frequency_type,
        schedule.frequency_value,
        schedule.timezone
      );

      await supabase
        .from("content_generation_schedules")
        .update({
          last_executed_at: new Date().toISOString(),
          next_scheduled_at: nextScheduledAt.toISOString(),
          total_posts_generated: (schedule.total_posts_generated || 0) + 1,
        })
        .eq("id", scheduleId);
    }

    // Auto-post if enabled
    let socialPostResult = null;
    if (autoPost || schedule?.auto_post) {
      const targetPlatforms = schedule?.target_platforms || [];
      const templateId = schedule?.scheduling_template_id;

      if (targetPlatforms.length > 0) {
        // This would integrate with the social-media API
        // For now, we'll just return the content and let the user post manually
        socialPostResult = {
          status: "ready_to_post",
          platforms: targetPlatforms,
          scheduledFor,
          templateId,
        };
      }
    }

    return NextResponse.json({
      success: true,
      generatedContent: {
        id: generatedContent?.id,
        imageUrl: imageResult.image?.imageUrl,
        prompt: finalPrompt,
        enhancedPrompt,
        caption,
        hashtags,
        aiSuggestions,
      },
      socialPost: socialPostResult,
      schedule: scheduleId ? {
        id: scheduleId,
        nextScheduledAt: schedule?.next_scheduled_at,
      } : null,
    });
  } catch (error) {
    console.error("Error executing content generation:", error);
    return NextResponse.json(
      { error: "Failed to execute content generation" },
      { status: 500 }
    );
  }
}

// Helper function to calculate next scheduled time
function calculateNextScheduledAt(
  frequencyType: string,
  frequencyValue: number,
  timezone: string
): Date {
  const now = new Date();
  
  switch (frequencyType) {
    case "hourly":
      return new Date(now.getTime() + frequencyValue * 60 * 60 * 1000);
    case "daily":
      return new Date(now.getTime() + frequencyValue * 24 * 60 * 60 * 1000);
    case "weekly":
      return new Date(now.getTime() + frequencyValue * 7 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}

// GET - Get generated content history
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const characterId = searchParams.get("characterId");
    const scheduleId = searchParams.get("scheduleId");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "20");

    let query = supabase
      .from("generated_content")
      .select("*")
      .eq("user_id", user.id);

    if (characterId) {
      query = query.eq("character_id", characterId);
    }

    if (scheduleId) {
      query = query.eq("schedule_id", scheduleId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching generated content:", error);
      return NextResponse.json(
        { error: "Failed to fetch generated content" },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("Error in GET generated content:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update generated content status (approve/reject)
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, status, caption, hashtags } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Content ID is required" },
        { status: 400 }
      );
    }

    const updates: Record<string, any> = {};
    
    if (status) {
      updates.status = status;
      if (status === "approved" || status === "rejected") {
        updates.reviewed_at = new Date().toISOString();
      }
    }
    
    if (caption !== undefined) {
      updates.caption = caption;
    }
    
    if (hashtags !== undefined) {
      updates.hashtags = hashtags;
    }

    const { data, error } = await supabase
      .from("generated_content")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating generated content:", error);
      return NextResponse.json(
        { error: "Failed to update content" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in PUT generated content:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
