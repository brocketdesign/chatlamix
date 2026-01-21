import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  generateCreativePrompts,
  generateImage,
  buildCharacterPrompt,
} from "@/lib/content-generation";
import { PhysicalAttributes, CharacterPersonality, ContentType } from "@/lib/types";

// This endpoint is meant to be called by a cron job (e.g., Vercel Cron, GitHub Actions)
// It processes all due content generation schedules

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    // Get all active schedules that are due for execution
    const now = new Date();
    const { data: dueSchedules, error: fetchError } = await supabase
      .from("content_generation_schedules")
      .select(`
        *,
        characters (
          id,
          name,
          user_id,
          physical_attributes,
          personality,
          main_face_image,
          thumbnail
        )
      `)
      .eq("is_active", true)
      .lte("next_scheduled_at", now.toISOString());

    if (fetchError) {
      console.error("Error fetching due schedules:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch schedules" },
        { status: 500 }
      );
    }

    if (!dueSchedules || dueSchedules.length === 0) {
      return NextResponse.json({
        message: "No schedules due for execution",
        processed: 0,
      });
    }

    console.log(`[cron] Found ${dueSchedules.length} schedules due for execution`);

    const results: {
      scheduleId: string;
      characterName: string;
      success: boolean;
      error?: string;
    }[] = [];

    // Process each due schedule
    for (const schedule of dueSchedules) {
      try {
        console.log(`[cron] Processing schedule: ${schedule.name} for ${schedule.characters?.name}`);

        // Get previous prompts to avoid repetition
        const { data: previousContent } = await supabase
          .from("generated_content")
          .select("original_prompt")
          .eq("character_id", schedule.character_id)
          .order("created_at", { ascending: false })
          .limit(10);

        const previousPrompts = previousContent?.map((c) => c.original_prompt) || [];

        // Generate creative prompt using the shared function
        const prompts = await generateCreativePrompts({
          character: {
            name: schedule.characters?.name || "Character",
            personality: schedule.characters?.personality as CharacterPersonality,
            physical_attributes: schedule.characters?.physical_attributes as PhysicalAttributes,
          },
          contentType: schedule.content_type as ContentType,
          customThemes: schedule.custom_themes,
          stylePreferences: schedule.style_preferences,
          previousPrompts,
          count: 1,
        });

        const suggestion = prompts?.[0];

        if (!suggestion) {
          throw new Error("No prompt suggestion generated");
        }

        // Generate the image using the shared function
        const imageResult = await generateImage({
          supabase,
          userId: schedule.user_id,
          characterId: schedule.character_id,
          character: {
            main_face_image: schedule.characters?.main_face_image,
            physical_attributes: schedule.characters?.physical_attributes as PhysicalAttributes,
            thumbnail: schedule.characters?.thumbnail,
          },
          scenePrompt: suggestion.prompt,
          width: 1024,
          height: 1024,
          faceSwapBaseUrl: request.nextUrl.origin,
        });

        if (!imageResult.success) {
          throw new Error(imageResult.error || "Failed to generate image");
        }

        // Save generated content
        const { error: saveError } = await supabase
          .from("generated_content")
          .insert({
            schedule_id: schedule.id,
            user_id: schedule.user_id,
            character_id: schedule.character_id,
            character_image_id: imageResult.image?.id,
            original_prompt: suggestion.prompt,
            enhanced_prompt: imageResult.fullPrompt,
            image_url: imageResult.image?.imageUrl,
            caption: suggestion.caption,
            hashtags: suggestion.hashtags,
            ai_suggestions: {
              mood: suggestion.mood,
              setting: suggestion.setting,
              reasoning: suggestion.reasoning,
            },
            content_type: schedule.content_type,
            status: schedule.auto_post ? "scheduled" : "generated",
          });

        if (saveError) {
          console.error("Error saving generated content:", saveError);
        }

        // Auto-post if enabled
        if (schedule.auto_post && schedule.target_platforms?.length > 0) {
          // TODO: Integrate with social-media API for auto-posting
          console.log(`[cron] Auto-post enabled for platforms:`, schedule.target_platforms);
        }

        // Update schedule with next execution time
        const nextScheduledAt = calculateNextScheduledAt(
          schedule.frequency_type,
          schedule.frequency_value,
          schedule.timezone
        );

        await supabase
          .from("content_generation_schedules")
          .update({
            last_executed_at: now.toISOString(),
            next_scheduled_at: nextScheduledAt.toISOString(),
            total_posts_generated: (schedule.total_posts_generated || 0) + 1,
          })
          .eq("id", schedule.id);

        results.push({
          scheduleId: schedule.id,
          characterName: schedule.characters?.name || "Unknown",
          success: true,
        });

        console.log(`[cron] Successfully processed schedule: ${schedule.name}`);
      } catch (error: any) {
        console.error(`[cron] Error processing schedule ${schedule.id}:`, error);
        results.push({
          scheduleId: schedule.id,
          characterName: schedule.characters?.name || "Unknown",
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      message: `Processed ${results.length} schedules: ${successCount} success, ${failureCount} failed`,
      processed: results.length,
      success: successCount,
      failed: failureCount,
      results,
    });
  } catch (error) {
    console.error("[cron] Error in content generation cron:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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
