import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  CharacterAutoGenerationSettings,
  CreateAutoGenerationSettingsRequest,
  CharacterProfileType,
} from "@/lib/types";

// Default profile types for diversity
const DEFAULT_PROFILE_TYPES: CharacterProfileType[] = [
  "influencer",
  "gamer",
  "yoga_instructor",
  "tech",
  "billionaire",
  "philosopher",
  "fitness",
  "artist",
  "musician",
  "chef",
];

// Transform database row to API response
function transformSettings(row: any): CharacterAutoGenerationSettings {
  return {
    id: row.id,
    userId: row.user_id,
    isActive: row.is_active,
    charactersPerDay: row.characters_per_day,
    imagesPerCharacter: row.images_per_character,
    profileTypes: row.profile_types || DEFAULT_PROFILE_TYPES,
    genderDistribution: row.gender_distribution || { male: 40, female: 50, nonBinary: 10 },
    timezone: row.timezone,
    generationTimeSlots: row.generation_time_slots || ["09:00", "14:00", "18:00"],
    makePublicByDefault: row.make_public_by_default,
    totalCharactersGenerated: row.total_characters_generated,
    totalImagesGenerated: row.total_images_generated,
    lastGeneratedAt: row.last_generated_at ? new Date(row.last_generated_at) : undefined,
    nextScheduledAt: row.next_scheduled_at ? new Date(row.next_scheduled_at) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// Calculate next scheduled generation time
function calculateNextScheduledAt(
  charactersPerDay: number,
  timezone: string,
  generationTimeSlots: string[]
): Date {
  const now = new Date();
  
  // For simplicity, distribute throughout the day
  // Each slot generates some characters
  const charactersPerSlot = Math.ceil(charactersPerDay / generationTimeSlots.length);
  
  // Find next slot
  const currentHour = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinute;
  
  for (const slot of generationTimeSlots.sort()) {
    const [hours, minutes] = slot.split(":").map(Number);
    const slotTimeMinutes = hours * 60 + minutes;
    
    if (slotTimeMinutes > currentTimeMinutes) {
      const nextDate = new Date(now);
      nextDate.setUTCHours(hours, minutes, 0, 0);
      return nextDate;
    }
  }
  
  // All slots passed today, schedule for first slot tomorrow
  const [hours, minutes] = (generationTimeSlots[0] || "09:00").split(":").map(Number);
  const nextDate = new Date(now);
  nextDate.setDate(nextDate.getDate() + 1);
  nextDate.setUTCHours(hours, minutes, 0, 0);
  return nextDate;
}

// GET - Get user's auto-generation settings
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
    const includeStats = searchParams.get("includeStats") === "true";

    // Get settings
    const { data: settings, error } = await supabase
      .from("character_auto_generation_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") { // PGRST116 = no rows returned
      console.error("Error fetching settings:", error);
      return NextResponse.json(
        { error: "Failed to fetch settings" },
        { status: 500 }
      );
    }

    // If no settings exist, return defaults
    if (!settings) {
      return NextResponse.json({
        exists: false,
        defaults: {
          isActive: false,
          charactersPerDay: 5,
          imagesPerCharacter: 5,
          profileTypes: DEFAULT_PROFILE_TYPES,
          genderDistribution: { male: 40, female: 50, nonBinary: 10 },
          timezone: "UTC",
          generationTimeSlots: ["09:00", "14:00", "18:00"],
          makePublicByDefault: false,
        },
      });
    }

    const result: any = {
      exists: true,
      settings: transformSettings(settings),
    };

    // Include queue and recent generations if requested
    if (includeStats) {
      // Get active queue items
      const { data: queueItems } = await supabase
        .from("character_generation_queue")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["pending", "generating"])
        .order("created_at", { ascending: true });

      // Get recent auto-generated characters
      const { data: recentCharacters } = await supabase
        .from("auto_generated_characters")
        .select(`
          *,
          characters (
            id,
            name,
            description,
            thumbnail,
            category,
            is_public,
            personality,
            physical_attributes,
            tags
          )
        `)
        .eq("user_id", user.id)
        .order("generated_at", { ascending: false })
        .limit(20);

      result.queue = queueItems || [];
      result.recentCharacters = recentCharacters || [];
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in GET auto-generation settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create or update auto-generation settings
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

    const body: CreateAutoGenerationSettingsRequest = await request.json();
    const {
      charactersPerDay = 5,
      imagesPerCharacter = 5,
      profileTypes = DEFAULT_PROFILE_TYPES,
      genderDistribution = { male: 40, female: 50, nonBinary: 10 },
      timezone = "UTC",
      generationTimeSlots = ["09:00", "14:00", "18:00"],
      makePublicByDefault = false,
      isActive = false,
    } = body;

    // Validate gender distribution adds up to 100
    const totalPercent = genderDistribution.male + genderDistribution.female + genderDistribution.nonBinary;
    if (totalPercent !== 100) {
      return NextResponse.json(
        { error: "Gender distribution must add up to 100%" },
        { status: 400 }
      );
    }

    // Calculate next scheduled time
    const nextScheduledAt = isActive
      ? calculateNextScheduledAt(charactersPerDay, timezone, generationTimeSlots)
      : null;

    // Check if settings already exist
    const { data: existing } = await supabase
      .from("character_auto_generation_settings")
      .select("id")
      .eq("user_id", user.id)
      .single();

    let result;
    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from("character_auto_generation_settings")
        .update({
          is_active: isActive,
          characters_per_day: charactersPerDay,
          images_per_character: imagesPerCharacter,
          profile_types: profileTypes,
          gender_distribution: genderDistribution,
          timezone,
          generation_time_slots: generationTimeSlots,
          make_public_by_default: makePublicByDefault,
          next_scheduled_at: nextScheduledAt?.toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating settings:", error);
        return NextResponse.json(
          { error: "Failed to update settings" },
          { status: 500 }
        );
      }
      result = data;
    } else {
      // Create new
      const { data, error } = await supabase
        .from("character_auto_generation_settings")
        .insert({
          user_id: user.id,
          is_active: isActive,
          characters_per_day: charactersPerDay,
          images_per_character: imagesPerCharacter,
          profile_types: profileTypes,
          gender_distribution: genderDistribution,
          timezone,
          generation_time_slots: generationTimeSlots,
          make_public_by_default: makePublicByDefault,
          next_scheduled_at: nextScheduledAt?.toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating settings:", error);
        return NextResponse.json(
          { error: "Failed to create settings" },
          { status: 500 }
        );
      }
      result = data;
    }

    return NextResponse.json({
      success: true,
      settings: transformSettings(result),
    });
  } catch (error) {
    console.error("Error in POST auto-generation settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Toggle active status or update specific fields
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
    const { action, ...updates } = body;

    // Get current settings
    const { data: settings, error: fetchError } = await supabase
      .from("character_auto_generation_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (fetchError || !settings) {
      return NextResponse.json(
        { error: "Settings not found. Please create settings first." },
        { status: 404 }
      );
    }

    // Handle toggle action
    if (action === "toggle") {
      const newIsActive = !settings.is_active;
      const nextScheduledAt = newIsActive
        ? calculateNextScheduledAt(
            settings.characters_per_day,
            settings.timezone,
            settings.generation_time_slots
          )
        : null;

      const { data, error } = await supabase
        .from("character_auto_generation_settings")
        .update({
          is_active: newIsActive,
          next_scheduled_at: nextScheduledAt?.toISOString(),
        })
        .eq("id", settings.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: "Failed to toggle settings" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        settings: transformSettings(data),
      });
    }

    // Handle partial updates
    const dbUpdates: Record<string, any> = {};
    const fieldMapping: Record<string, string> = {
      isActive: "is_active",
      charactersPerDay: "characters_per_day",
      imagesPerCharacter: "images_per_character",
      profileTypes: "profile_types",
      genderDistribution: "gender_distribution",
      timezone: "timezone",
      generationTimeSlots: "generation_time_slots",
      makePublicByDefault: "make_public_by_default",
    };

    for (const [key, value] of Object.entries(updates)) {
      if (fieldMapping[key]) {
        dbUpdates[fieldMapping[key]] = value;
      }
    }

    // Recalculate next scheduled time if relevant fields changed
    if (updates.isActive !== undefined || updates.charactersPerDay || updates.generationTimeSlots) {
      const isActive = updates.isActive ?? settings.is_active;
      const charactersPerDay = updates.charactersPerDay ?? settings.characters_per_day;
      const timeSlots = updates.generationTimeSlots ?? settings.generation_time_slots;
      const tz = updates.timezone ?? settings.timezone;

      if (isActive) {
        dbUpdates.next_scheduled_at = calculateNextScheduledAt(
          charactersPerDay,
          tz,
          timeSlots
        ).toISOString();
      } else {
        dbUpdates.next_scheduled_at = null;
      }
    }

    const { data, error } = await supabase
      .from("character_auto_generation_settings")
      .update(dbUpdates)
      .eq("id", settings.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating settings:", error);
      return NextResponse.json(
        { error: "Failed to update settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      settings: transformSettings(data),
    });
  } catch (error) {
    console.error("Error in PUT auto-generation settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete auto-generation settings
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

    const { error } = await supabase
      .from("character_auto_generation_settings")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting settings:", error);
      return NextResponse.json(
        { error: "Failed to delete settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE auto-generation settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
