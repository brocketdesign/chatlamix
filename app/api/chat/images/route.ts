import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PhysicalAttributes } from "@/lib/types";

// Extend timeout for image generation (increased for face swap)
export const maxDuration = 180;

const SEGMIND_API_KEY = process.env.SEGMIND_API_KEY;
const SEGMIND_IMAGE_API = "https://api.segmind.com/v1/z-image-turbo";

// Coin cost for chat image generation
const CHAT_IMAGE_COST = 10;

// Logging helper
function log(step: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  console.log(`[chat-images] [${timestamp}] ${step}`, data ? JSON.stringify(data, null, 2) : "");
}

// UUID validation helper
function isValidUUID(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Build a prompt based on character physical attributes (for profile/character creation)
function buildCharacterPrompt(
  physicalAttributes: PhysicalAttributes,
  scenePrompt: string
): string {
  const {
    gender,
    age,
    ethnicity,
    faceShape,
    eyeColor,
    eyeShape,
    skinTone,
    hairColor,
    hairLength,
    hairStyle,
    hairTexture,
    bodyType,
    height,
    distinctiveFeatures,
    fashionStyle,
    makeup,
  } = physicalAttributes;

  const characterDescription = [
    `A ${age} ${ethnicity} ${gender}`,
    `with ${skinTone} skin`,
    `${faceShape} face shape`,
    `${eyeColor} ${eyeShape} eyes`,
    `${hairLength} ${hairTexture} ${hairColor} hair styled in ${hairStyle}`,
    `${bodyType} ${height} build`,
    distinctiveFeatures?.length
      ? `distinctive features: ${distinctiveFeatures.join(", ")}`
      : "",
    `${fashionStyle} fashion style`,
    makeup ? `${makeup} makeup` : "",
  ]
    .filter(Boolean)
    .join(", ");

  return `Portrait photography, ${characterDescription}. ${scenePrompt}. High quality, detailed, professional photography, 8k, sharp focus, beautiful lighting.`;
}

// Build a flexible prompt for chat image generation (user's message is the focus)
function buildChatImagePrompt(
  physicalAttributes: PhysicalAttributes,
  userMessage: string
): string {
  const {
    gender,
    age,
    ethnicity,
    skinTone,
    hairColor,
    hairLength,
    hairStyle,
    eyeColor,
    bodyType,
    fashionStyle,
  } = physicalAttributes;

  // Concise character description for consistency
  const characterDescription = [
    `${age} ${ethnicity} ${gender}`,
    `${skinTone} skin`,
    `${eyeColor} eyes`,
    `${hairLength} ${hairColor} ${hairStyle} hair`,
    `${bodyType} build`,
  ]
    .filter(Boolean)
    .join(", ");

  // User's message is the PRIMARY focus, character description is secondary
  return `${userMessage}. The subject is a ${characterDescription}, ${fashionStyle} style. High quality, detailed, sharp focus, beautiful lighting.`;
}

// GET - Get chat images for a character/session
export async function GET(request: NextRequest) {
  log("GET request started");
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      log("GET - Authentication required, no user");
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const characterId = searchParams.get("characterId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    log("GET - Params", { characterId, limit, offset, userId: user.id });

    if (!characterId) {
      log("GET - Missing characterId");
      return NextResponse.json(
        { error: "Character ID is required" },
        { status: 400 }
      );
    }

    const { data: images, error, count } = await supabase
      .from("chat_images")
      .select("*", { count: "exact" })
      .eq("character_id", characterId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      log("GET - Database error", { error: error.message });
      return NextResponse.json(
        { error: "Failed to fetch chat images" },
        { status: 500 }
      );
    }

    log("GET - Success", { imageCount: images?.length || 0, totalCount: count });
    return NextResponse.json({
      images: images || [],
      totalImages: count || 0,
    });
  } catch (error) {
    log("GET - Unexpected error", { error: String(error) });
    return NextResponse.json(
      { error: "Failed to fetch chat images" },
      { status: 500 }
    );
  }
}
