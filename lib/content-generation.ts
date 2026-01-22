import { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import {
  PhysicalAttributes,
  CharacterPersonality,
  ContentType,
  ContentStylePreferences,
  CreativePromptSuggestion,
  CharacterImage,
} from "@/lib/types";

const SEGMIND_API_KEY = process.env.SEGMIND_API_KEY;
const SEGMIND_IMAGE_API = "https://api.segmind.com/v1/z-image-turbo";

// Content type descriptions for prompt generation
const CONTENT_TYPE_CONTEXT: Record<ContentType, string> = {
  lifestyle: "everyday life moments, morning routines, self-care, home activities, casual outings",
  fashion: "outfit showcases, street style, fashion photoshoots, wardrobe styling, accessory highlights",
  travel: "exotic destinations, adventure activities, scenic views, local culture exploration, travel photography",
  food: "culinary experiences, restaurant visits, cooking moments, food styling, cafe aesthetics",
  fitness: "workout sessions, gym selfies, outdoor exercise, yoga poses, active lifestyle",
  beauty: "makeup looks, skincare routines, beauty tutorials, glam shots, natural beauty",
  tech: "tech reviews, gaming setups, digital lifestyle, gadget showcases, creative workspaces",
  art: "artistic photography, creative expressions, gallery visits, artistic poses, cultural events",
  nature: "outdoor adventures, nature walks, beach vibes, mountain views, sunset/sunrise moments",
  urban: "city life, urban photography, street scenes, nightlife, architectural backgrounds",
  custom: "custom themed content based on user preferences",
};

// Build a prompt based on character physical attributes
export function buildCharacterPrompt(
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

// Build character context for AI prompt generation
function buildCharacterContext(
  name: string,
  personality?: CharacterPersonality | null,
  physicalAttributes?: PhysicalAttributes | null
): string {
  let context = `AI Influencer: ${name}\n`;

  if (personality) {
    context += `\nPersonality:
- Traits: ${personality.traits?.join(", ") || "Not specified"}
- Mood: ${personality.mood || "Varied"}
- Style: ${personality.speakingStyle || "Natural"}
- Interests: ${personality.interests?.join(", ") || "Various"}
- Hobbies: ${personality.hobbies?.join(", ") || "Various"}`;
  }

  if (physicalAttributes) {
    context += `\n\nAppearance:
- ${physicalAttributes.age} ${physicalAttributes.gender}
- Ethnicity: ${physicalAttributes.ethnicity}
- Hair: ${physicalAttributes.hairLength} ${physicalAttributes.hairColor} ${physicalAttributes.hairStyle}
- Eyes: ${physicalAttributes.eyeColor}
- Body type: ${physicalAttributes.bodyType}
- Fashion style: ${physicalAttributes.fashionStyle}`;
  }

  return context;
}

// Build style context for AI
function buildStyleContext(stylePreferences?: ContentStylePreferences): string {
  if (!stylePreferences) return "";

  const parts = [];
  if (stylePreferences.mood?.length) {
    parts.push(`Mood: ${stylePreferences.mood.join(", ")}`);
  }
  if (stylePreferences.settings?.length) {
    parts.push(`Settings: ${stylePreferences.settings.join(", ")}`);
  }
  if (stylePreferences.lighting?.length) {
    parts.push(`Lighting: ${stylePreferences.lighting.join(", ")}`);
  }
  if (stylePreferences.colorScheme?.length) {
    parts.push(`Color scheme: ${stylePreferences.colorScheme.join(", ")}`);
  }
  if (stylePreferences.composition?.length) {
    parts.push(`Composition: ${stylePreferences.composition.join(", ")}`);
  }
  if (stylePreferences.additionalInstructions) {
    parts.push(`Additional: ${stylePreferences.additionalInstructions}`);
  }

  return parts.length > 0 ? `\n\nStyle preferences:\n${parts.join("\n")}` : "";
}

export interface GenerateCreativePromptsParams {
  character: {
    name: string;
    personality?: CharacterPersonality | null;
    physical_attributes?: PhysicalAttributes | null;
  };
  contentType: ContentType;
  customThemes?: string[];
  stylePreferences?: ContentStylePreferences;
  previousPrompts?: string[];
  count?: number;
}

// Generate creative prompts using OpenAI
export async function generateCreativePrompts(
  params: GenerateCreativePromptsParams
): Promise<CreativePromptSuggestion[]> {
  const {
    character,
    contentType,
    customThemes = [],
    stylePreferences,
    previousPrompts = [],
    count = 3,
  } = params;

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API not configured");
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const characterContext = buildCharacterContext(
    character.name,
    character.personality as CharacterPersonality,
    character.physical_attributes as PhysicalAttributes
  );

  const styleContext = buildStyleContext(stylePreferences);
  const contentTypeDescription = CONTENT_TYPE_CONTEXT[contentType] || CONTENT_TYPE_CONTEXT.custom;
  const customThemesText = customThemes.length > 0
    ? `\n\nCustom themes to incorporate: ${customThemes.join(", ")}`
    : "";

  const previousPromptsText = previousPrompts.length > 0
    ? `\n\nPreviously used prompts (AVOID similar ideas):\n${previousPrompts.slice(-10).map(p => `- ${p}`).join("\n")}`
    : "";

  const systemPrompt = `You are a creative content strategist for AI influencers on social media. 
Your task is to generate unique, engaging image prompts that will help create consistent, high-quality content for an AI influencer.

The prompts should be:
1. Detailed enough for image generation (describe pose, setting, lighting, mood)
2. Consistent with the character's personality and appearance
3. Appropriate for social media (Instagram, TikTok, etc.)
4. Diverse and creative - avoid repetitive ideas
5. Trendy and engaging for the target audience

For each prompt, also provide:
- A catchy caption that fits the character's voice
- Relevant hashtags (5-10)
- The mood/vibe of the image
- The setting/location

Respond in JSON format with an array of suggestions.`;

  const userPrompt = `${characterContext}
${styleContext}

Content type: ${contentType}
Description: ${contentTypeDescription}
${customThemesText}
${previousPromptsText}

Generate ${count} unique, creative image prompts for this AI influencer. Each prompt should create a visually stunning, engaging social media post.

Respond with a JSON object:
{
  "prompts": [
    {
      "prompt": "detailed image generation prompt",
      "caption": "engaging social media caption in character's voice",
      "hashtags": ["hashtag1", "hashtag2", ...],
      "mood": "mood/vibe description",
      "setting": "setting/location description",
      "reasoning": "brief explanation of why this works for the character"
    }
  ]
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.9,
    max_tokens: 2000,
  });

  const responseContent = completion.choices[0]?.message?.content;
  if (!responseContent) {
    throw new Error("Failed to generate prompts");
  }

  const parsedResponse = JSON.parse(responseContent);

  // Validate and clean up the response
  const validatedPrompts: CreativePromptSuggestion[] = parsedResponse.prompts.map((p: any) => ({
    prompt: p.prompt || "",
    caption: p.caption || "",
    hashtags: Array.isArray(p.hashtags) ? p.hashtags : [],
    mood: p.mood || "",
    setting: p.setting || "",
    reasoning: p.reasoning || "",
  }));

  return validatedPrompts;
}

export interface GenerateImageParams {
  supabase: SupabaseClient;
  userId: string;
  characterId: string;
  character: {
    main_face_image?: string | null;
    physical_attributes?: PhysicalAttributes | null;
    thumbnail?: string | null;
  };
  scenePrompt: string;
  width?: number;
  height?: number;
  steps?: number;
  guidanceScale?: number;
  seed?: number;
  imageFormat?: "jpeg" | "png" | "webp";
  quality?: number;
  faceSwapBaseUrl?: string;
}

export interface GenerateImageResult {
  success: boolean;
  image?: CharacterImage;
  fullPrompt?: string;
  faceSwapped?: boolean;
  error?: string;
}

// Generate image using Segmind API
export async function generateImage(
  params: GenerateImageParams
): Promise<GenerateImageResult> {
  const {
    supabase,
    userId,
    characterId,
    character,
    scenePrompt,
    width = 1024,
    height = 1024,
    steps = 8,
    guidanceScale = 1,
    seed = -1,
    imageFormat = "webp",
    quality = 90,
    faceSwapBaseUrl,
  } = params;

  if (!SEGMIND_API_KEY) {
    return { success: false, error: "Image generation API not configured" };
  }

  const physicalAttributes = character.physical_attributes as PhysicalAttributes;

  // Build the full prompt with character attributes
  const fullPrompt = physicalAttributes
    ? buildCharacterPrompt(physicalAttributes, scenePrompt || "")
    : scenePrompt;

  // Generate image using Segmind API
  const response = await fetch(SEGMIND_IMAGE_API, {
    method: "POST",
    headers: {
      "x-api-key": SEGMIND_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: fullPrompt,
      steps,
      guidance_scale: guidanceScale,
      seed,
      height,
      width,
      image_format: imageFormat,
      quality,
      base_64: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[generateImage] Segmind API error:", errorText);
    return { success: false, error: "Image generation failed" };
  }

  // Handle both binary image response and JSON response
  const contentType = response.headers.get("content-type") || "";
  let imageBase64: string;
  let responseSeed: number | undefined;

  if (contentType.includes("application/json")) {
    const result = await response.json();
    imageBase64 = result.image;
    responseSeed = result.seed;
  } else {
    const arrayBuffer = await response.arrayBuffer();
    imageBase64 = Buffer.from(arrayBuffer).toString("base64");
  }

  let finalImageUrl = `data:image/${imageFormat};base64,${imageBase64}`;
  let faceSwapApplied = false;

  // Check if character has a main face image for face swapping
  const shouldFaceSwap = character.main_face_image && character.main_face_image.length > 0;

  // If character has a main face image and we have a base URL, apply face swap
  if (shouldFaceSwap && faceSwapBaseUrl) {
    try {
      const faceSwapResponse = await fetch(
        `${faceSwapBaseUrl}/api/face-swap`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceImage: character.main_face_image,
            targetImage: finalImageUrl,
          }),
        }
      );

      if (faceSwapResponse.ok) {
        const faceSwapResult = await faceSwapResponse.json();
        finalImageUrl = faceSwapResult.imageUrl;
        faceSwapApplied = true;
      }
    } catch (faceSwapError) {
      console.error("Face swap failed, using original image:", faceSwapError);
    }
  }

  // Upload to Supabase Storage
  console.log("[generateImage] Uploading to Supabase Storage...");
  
  const mimeMatch = finalImageUrl.match(/^data:(image\/[^;]+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : `image/${imageFormat}`;
  const extension = mimeType.split("/")[1] || imageFormat;
  
  const fileName = `auto_${characterId}_${Date.now()}.${extension}`;
  const uploadBuffer = Buffer.from(finalImageUrl.split(",")[1], "base64");
  
  let storedImageUrl = finalImageUrl; // Fallback to base64 if upload fails
  
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("character-images")
    .upload(fileName, uploadBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (!uploadError && uploadData) {
    const { data: { publicUrl } } = supabase.storage
      .from("character-images")
      .getPublicUrl(fileName);
    storedImageUrl = publicUrl;
    console.log("[generateImage] Uploaded to storage:", publicUrl);
  } else if (uploadError) {
    console.error("[generateImage] Storage upload failed (using base64):", uploadError.message);
  }

  // Save the image to Supabase
  const { data: savedImage, error: saveError } = await supabase
    .from("character_images")
    .insert({
      character_id: characterId,
      image_url: storedImageUrl,
      prompt: fullPrompt,
      is_main_face: !character.main_face_image,
      settings: {
        prompt: fullPrompt,
        steps,
        guidanceScale,
        seed: responseSeed || seed,
        height,
        width,
        imageFormat,
        quality,
        faceSwapApplied,
      },
    })
    .select()
    .single();

  if (saveError) {
    console.error("[generateImage] Error saving image:", saveError);
    return { success: false, error: "Failed to save image" };
  }

  // If this is the first image, set it as thumbnail and main face
  // Note: main_face_image stays as base64 for face-swap operations
  if (!character.main_face_image || !character.thumbnail) {
    await supabase
      .from("characters")
      .update({
        main_face_image: finalImageUrl, // Keep base64 for face swapping
        thumbnail: storedImageUrl, // Use storage URL for display
      })
      .eq("id", characterId);
  }

  const characterImage: CharacterImage = {
    id: savedImage.id,
    characterId: savedImage.character_id,
    imageUrl: savedImage.image_url,
    prompt: savedImage.prompt || "",
    isMainFace: savedImage.is_main_face,
    createdAt: new Date(savedImage.created_at),
    settings: savedImage.settings,
    galleryStatus: savedImage.gallery_status || 'unposted',
  };

  return {
    success: true,
    image: characterImage,
    fullPrompt,
    faceSwapped: !!shouldFaceSwap,
  };
}
