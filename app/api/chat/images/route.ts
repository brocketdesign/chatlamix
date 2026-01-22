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
