import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CharacterProfileType } from "@/lib/types";

// This endpoint is meant to be called by a cron job (e.g., Vercel Cron, GitHub Actions)
// It processes all due character auto-generation schedules

// Helper to pick random item based on weighted distribution
function weightedRandomGender(distribution: { male: number; female: number; nonBinary: number }): "male" | "female" | "non-binary" {
  const rand = Math.random() * 100;
  if (rand < distribution.male) return "male";
  if (rand < distribution.male + distribution.female) return "female";
  return "non-binary";
}

// Helper to pick random profile type from array
function randomPickProfileType(types: CharacterProfileType[]): CharacterProfileType {
  return types[Math.floor(Math.random() * types.length)];
}

export async function GET(request: NextRequest) {
  console.log("[character-automation/cron] Starting cron job...");
  
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

    // Get all active auto-generation settings that are due
    const now = new Date();
    const { data: dueSettings, error: fetchError } = await supabase
      .from("character_auto_generation_settings")
      .select("*")
      .eq("is_active", true)
      .lte("next_scheduled_at", now.toISOString());

    if (fetchError) {
      console.error("[character-automation/cron] Error fetching settings:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch settings" },
        { status: 500 }
      );
    }

    if (!dueSettings || dueSettings.length === 0) {
      console.log("[character-automation/cron] No settings due for execution");
      return NextResponse.json({
        message: "No auto-generation settings due for execution",
        processed: 0,
      });
    }

    console.log(`[character-automation/cron] Found ${dueSettings.length} settings due for execution`);

    const results: {
      userId: string;
      settingsId: string;
      queuedCharacters: number;
      success: boolean;
      error?: string;
    }[] = [];

    // Process each due settings
    for (const settings of dueSettings) {
      try {
        console.log(`[character-automation/cron] Processing settings ID: ${settings.id}`);

        const charactersToGenerate = settings.characters_per_day || 5;
        const imagesPerCharacter = settings.images_per_character || 5;
        const profileTypes = settings.profile_types || ["influencer"];
        const genderDistribution = settings.gender_distribution || { male: 40, female: 50, nonBinary: 10 };

        // Create queue items for each character to generate
        const queueItems = [];
        for (let i = 0; i < charactersToGenerate; i++) {
          const profileType = randomPickProfileType(profileTypes);
          const gender = weightedRandomGender(genderDistribution);

          queueItems.push({
            user_id: settings.user_id,
            settings_id: settings.id,
            profile_type: profileType,
            gender,
            status: "pending",
            total_images: imagesPerCharacter,
          });
        }

        // Insert queue items
        const { data: insertedQueue, error: queueError } = await supabase
          .from("character_generation_queue")
          .insert(queueItems)
          .select();

        if (queueError) {
          console.error("[character-automation/cron] Error creating queue:", queueError);
          results.push({
            userId: settings.user_id,
            settingsId: settings.id,
            queuedCharacters: 0,
            success: false,
            error: queueError.message,
          });
          continue;
        }

        // Calculate next scheduled time
        const nextScheduledAt = calculateNextScheduledAt(
          settings.generation_time_slots || ["09:00", "14:00", "18:00"]
        );

        // Update settings with next scheduled time
        await supabase
          .from("character_auto_generation_settings")
          .update({
            last_generated_at: now.toISOString(),
            next_scheduled_at: nextScheduledAt.toISOString(),
          })
          .eq("id", settings.id);

        results.push({
          userId: settings.user_id,
          settingsId: settings.id,
          queuedCharacters: insertedQueue?.length || 0,
          success: true,
        });

        console.log(`[character-automation/cron] Queued ${insertedQueue?.length} characters for user ${settings.user_id}`);

        // Start processing the first queue item immediately (others will be processed by worker)
        if (insertedQueue && insertedQueue.length > 0) {
          const firstItem = insertedQueue[0];
          
          // Make internal call to generate endpoint
          try {
            const generateUrl = new URL("/api/character-automation/generate", request.url);
            const generateResponse = await fetch(generateUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                // Forward auth for internal call
                "Cookie": request.headers.get("cookie") || "",
              },
              body: JSON.stringify({
                profileType: firstItem.profile_type,
                gender: firstItem.gender,
                imagesPerCharacter: firstItem.total_images,
                settingsId: settings.id,
                queueItemId: firstItem.id,
              }),
            });

            if (!generateResponse.ok) {
              console.error("[character-automation/cron] First character generation failed");
            }
          } catch (genError) {
            console.error("[character-automation/cron] Error triggering generation:", genError);
          }
        }
      } catch (error: any) {
        console.error(`[character-automation/cron] Error processing settings ${settings.id}:`, error);
        results.push({
          userId: settings.user_id,
          settingsId: settings.id,
          queuedCharacters: 0,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;
    const totalQueued = results.reduce((sum, r) => sum + r.queuedCharacters, 0);

    console.log(`[character-automation/cron] Completed: ${successCount} success, ${failureCount} failed, ${totalQueued} characters queued`);

    return NextResponse.json({
      message: `Processed ${results.length} settings: ${successCount} success, ${failureCount} failed`,
      processed: results.length,
      success: successCount,
      failed: failureCount,
      totalCharactersQueued: totalQueued,
      results,
    });
  } catch (error) {
    console.error("[character-automation/cron] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Calculate next scheduled time based on time slots
function calculateNextScheduledAt(generationTimeSlots: string[]): Date {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinute;

  // Sort time slots
  const sortedSlots = [...generationTimeSlots].sort();

  // Find next slot today
  for (const slot of sortedSlots) {
    const [hours, minutes] = slot.split(":").map(Number);
    const slotTimeMinutes = hours * 60 + minutes;

    if (slotTimeMinutes > currentTimeMinutes) {
      const nextDate = new Date(now);
      nextDate.setUTCHours(hours, minutes, 0, 0);
      return nextDate;
    }
  }

  // All slots passed today, schedule for first slot tomorrow
  const [hours, minutes] = (sortedSlots[0] || "09:00").split(":").map(Number);
  const nextDate = new Date(now);
  nextDate.setDate(nextDate.getDate() + 1);
  nextDate.setUTCHours(hours, minutes, 0, 0);
  return nextDate;
}

// POST - Process pending queue items (can be called by worker)
export async function POST(request: NextRequest) {
  console.log("[character-automation/cron] Processing queue items...");
  
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const body = await request.json();
    const { limit = 5 } = body;

    // Get pending queue items
    const { data: pendingItems, error: fetchError } = await supabase
      .from("character_generation_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (fetchError) {
      console.error("[character-automation/cron] Error fetching queue:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch queue" },
        { status: 500 }
      );
    }

    if (!pendingItems || pendingItems.length === 0) {
      return NextResponse.json({
        message: "No pending queue items",
        processed: 0,
      });
    }

    console.log(`[character-automation/cron] Found ${pendingItems.length} pending items`);

    const results: any[] = [];

    for (const item of pendingItems) {
      try {
        // Mark as generating
        await supabase
          .from("character_generation_queue")
          .update({ status: "generating", started_at: new Date().toISOString() })
          .eq("id", item.id);

        // Generate character
        const generateUrl = new URL("/api/character-automation/generate", request.url);
        const generateResponse = await fetch(generateUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cookie": request.headers.get("cookie") || "",
          },
          body: JSON.stringify({
            profileType: item.profile_type,
            gender: item.gender,
            imagesPerCharacter: item.total_images,
            settingsId: item.settings_id,
            queueItemId: item.id,
          }),
        });

        if (generateResponse.ok) {
          const result = await generateResponse.json();
          results.push({
            queueItemId: item.id,
            success: true,
            characterId: result.character?.id,
            imagesGenerated: result.imagesGenerated,
          });
        } else {
          const errorData = await generateResponse.json().catch(() => ({}));
          await supabase
            .from("character_generation_queue")
            .update({
              status: "failed",
              error_message: errorData.error || "Generation failed",
            })
            .eq("id", item.id);

          results.push({
            queueItemId: item.id,
            success: false,
            error: errorData.error || "Generation failed",
          });
        }
      } catch (error: any) {
        console.error(`[character-automation/cron] Error processing item ${item.id}:`, error);
        
        await supabase
          .from("character_generation_queue")
          .update({
            status: "failed",
            error_message: error.message,
          })
          .eq("id", item.id);

        results.push({
          queueItemId: item.id,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      message: `Processed ${results.length} queue items: ${successCount} success`,
      processed: results.length,
      success: successCount,
      results,
    });
  } catch (error) {
    console.error("[character-automation/cron] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
