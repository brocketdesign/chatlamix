import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ContentGenerationSchedule,
  CreateContentScheduleRequest,
  FrequencyType,
} from "@/lib/types";

// Calculate next scheduled execution time
function calculateNextScheduledAt(
  frequencyType: FrequencyType,
  frequencyValue: number,
  timezone: string,
  customCron?: string
): Date {
  const now = new Date();
  
  switch (frequencyType) {
    case "hourly":
      return new Date(now.getTime() + frequencyValue * 60 * 60 * 1000);
    case "daily":
      return new Date(now.getTime() + frequencyValue * 24 * 60 * 60 * 1000);
    case "weekly":
      return new Date(now.getTime() + frequencyValue * 7 * 24 * 60 * 60 * 1000);
    case "custom":
      // For custom cron, default to next day - actual cron parsing would need a library
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}

// Transform database row to API response
function transformSchedule(row: any): ContentGenerationSchedule {
  return {
    id: row.id,
    userId: row.user_id,
    characterId: row.character_id,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    frequencyType: row.frequency_type,
    frequencyValue: row.frequency_value,
    customCron: row.custom_cron,
    timezone: row.timezone,
    contentType: row.content_type,
    customThemes: row.custom_themes,
    stylePreferences: row.style_preferences,
    autoGenerateCaption: row.auto_generate_caption,
    includeHashtags: row.include_hashtags,
    hashtagCount: row.hashtag_count,
    autoPost: row.auto_post,
    schedulingTemplateId: row.scheduling_template_id,
    targetPlatforms: row.target_platforms || [],
    autoConnectToScheduleTemplate: row.auto_connect_to_schedule_template || false,
    lastExecutedAt: row.last_executed_at ? new Date(row.last_executed_at) : undefined,
    nextScheduledAt: row.next_scheduled_at ? new Date(row.next_scheduled_at) : undefined,
    totalPostsGenerated: row.total_posts_generated,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// GET - List content generation schedules
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
    const id = searchParams.get("id");
    const activeOnly = searchParams.get("activeOnly") === "true";

    // Get a specific schedule
    if (id) {
      const { data, error } = await supabase
        .from("content_generation_schedules")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: "Schedule not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(transformSchedule(data));
    }

    // List schedules
    let query = supabase
      .from("content_generation_schedules")
      .select("*")
      .eq("user_id", user.id);

    if (characterId) {
      query = query.eq("character_id", characterId);
    }

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching schedules:", error);
      return NextResponse.json(
        { error: "Failed to fetch schedules" },
        { status: 500 }
      );
    }

    return NextResponse.json((data || []).map(transformSchedule));
  } catch (error) {
    console.error("Error in GET schedules:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create a new content generation schedule
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

    const body: CreateContentScheduleRequest = await request.json();
    const {
      characterId,
      name,
      description,
      frequencyType,
      frequencyValue,
      customCron,
      timezone = "UTC",
      contentType,
      customThemes,
      stylePreferences,
      autoGenerateCaption = true,
      includeHashtags = true,
      hashtagCount = 5,
      autoPost = false,
      schedulingTemplateId,
      targetPlatforms = [],
      autoConnectToScheduleTemplate = false,
    } = body;

    // Validate required fields
    if (!characterId || !name || !frequencyType || !contentType) {
      return NextResponse.json(
        { error: "Missing required fields: characterId, name, frequencyType, contentType" },
        { status: 400 }
      );
    }

    // Verify character ownership
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
        { error: "You don't have permission to create schedules for this character" },
        { status: 403 }
      );
    }

    // Calculate next scheduled time
    const nextScheduledAt = calculateNextScheduledAt(
      frequencyType,
      frequencyValue || 1,
      timezone,
      customCron
    );

    // Create the schedule
    const { data, error } = await supabase
      .from("content_generation_schedules")
      .insert({
        user_id: user.id,
        character_id: characterId,
        name,
        description,
        frequency_type: frequencyType,
        frequency_value: frequencyValue || 1,
        custom_cron: customCron,
        timezone,
        content_type: contentType,
        custom_themes: customThemes,
        style_preferences: stylePreferences,
        auto_generate_caption: autoGenerateCaption,
        include_hashtags: includeHashtags,
        hashtag_count: hashtagCount,
        auto_post: autoPost,
        scheduling_template_id: schedulingTemplateId || null,
        target_platforms: targetPlatforms,
        auto_connect_to_schedule_template: autoConnectToScheduleTemplate,
        next_scheduled_at: nextScheduledAt.toISOString(),
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating schedule:", error);
      return NextResponse.json(
        { error: "Failed to create schedule" },
        { status: 500 }
      );
    }

    return NextResponse.json(transformSchedule(data), { status: 201 });
  } catch (error) {
    console.error("Error in POST schedule:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update a content generation schedule
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
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Schedule ID is required" },
        { status: 400 }
      );
    }

    // Verify ownership and get full schedule data for frequency recalculation
    const { data: existing, error: fetchError } = await supabase
      .from("content_generation_schedules")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }

    if (existing.user_id !== user.id) {
      return NextResponse.json(
        { error: "You don't have permission to update this schedule" },
        { status: 403 }
      );
    }

    // Transform camelCase to snake_case for database
    const dbUpdates: Record<string, any> = {};
    const fieldMapping: Record<string, string> = {
      name: "name",
      description: "description",
      isActive: "is_active",
      frequencyType: "frequency_type",
      frequencyValue: "frequency_value",
      customCron: "custom_cron",
      timezone: "timezone",
      contentType: "content_type",
      customThemes: "custom_themes",
      stylePreferences: "style_preferences",
      autoGenerateCaption: "auto_generate_caption",
      includeHashtags: "include_hashtags",
      hashtagCount: "hashtag_count",
      autoPost: "auto_post",
      schedulingTemplateId: "scheduling_template_id",
      targetPlatforms: "target_platforms",
    };

    for (const [key, value] of Object.entries(updates)) {
      if (fieldMapping[key]) {
        dbUpdates[fieldMapping[key]] = value;
      }
    }

    // Recalculate next scheduled time if frequency changed
    if (updates.frequencyType || updates.frequencyValue) {
      const frequencyType = updates.frequencyType || existing.frequency_type;
      const frequencyValue = updates.frequencyValue || existing.frequency_value;
      const timezone = updates.timezone || existing.timezone;
      const customCron = updates.customCron || existing.custom_cron;

      dbUpdates.next_scheduled_at = calculateNextScheduledAt(
        frequencyType,
        frequencyValue,
        timezone,
        customCron
      ).toISOString();
    }

    const { data, error } = await supabase
      .from("content_generation_schedules")
      .update(dbUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating schedule:", error);
      return NextResponse.json(
        { error: "Failed to update schedule" },
        { status: 500 }
      );
    }

    return NextResponse.json(transformSchedule(data));
  } catch (error) {
    console.error("Error in PUT schedule:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a content generation schedule
export async function DELETE(request: NextRequest) {
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
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Schedule ID is required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from("content_generation_schedules")
      .select("id, user_id")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }

    if (existing.user_id !== user.id) {
      return NextResponse.json(
        { error: "You don't have permission to delete this schedule" },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from("content_generation_schedules")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting schedule:", error);
      return NextResponse.json(
        { error: "Failed to delete schedule" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE schedule:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
