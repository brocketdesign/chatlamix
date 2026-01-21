import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  GenerateCreativePromptRequest,
  GenerateCreativePromptResponse,
  CreativePromptSuggestion,
  ContentType,
  PhysicalAttributes,
  CharacterPersonality,
  ContentStylePreferences,
} from "@/lib/types";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

// Build character context for AI
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

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API not configured" },
        { status: 500 }
      );
    }

    const body: GenerateCreativePromptRequest = await request.json();
    const {
      characterId,
      contentType,
      customThemes = [],
      stylePreferences,
      previousPrompts = [],
      count = 3,
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

    // Check ownership
    if (character.user_id !== user.id) {
      return NextResponse.json(
        { error: "You don't have permission to generate content for this character" },
        { status: 403 }
      );
    }

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
      temperature: 0.9, // Higher creativity
      max_tokens: 2000,
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      return NextResponse.json(
        { error: "Failed to generate prompts" },
        { status: 500 }
      );
    }

    let parsedResponse: { prompts: CreativePromptSuggestion[] };
    try {
      parsedResponse = JSON.parse(responseContent);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", responseContent);
      return NextResponse.json(
        { error: "Invalid response from AI" },
        { status: 500 }
      );
    }

    // Validate and clean up the response
    const validatedPrompts: CreativePromptSuggestion[] = parsedResponse.prompts.map((p) => ({
      prompt: p.prompt || "",
      caption: p.caption || "",
      hashtags: Array.isArray(p.hashtags) ? p.hashtags : [],
      mood: p.mood || "",
      setting: p.setting || "",
      reasoning: p.reasoning || "",
    }));

    const response: GenerateCreativePromptResponse = {
      prompts: validatedPrompts,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error generating creative prompts:", error);
    return NextResponse.json(
      { error: "Failed to generate creative prompts" },
      { status: 500 }
    );
  }
}
