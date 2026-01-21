import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { CharacterPersonality, PhysicalAttributes } from "@/lib/types";

// Initialize OpenAI only when API key is available
const getOpenAIClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
};

// POST - Chat with a character using their personality
export async function POST(request: NextRequest) {
  try {
    const openai = getOpenAIClient();
    if (!openai) {
      return NextResponse.json(
        { error: "Chat API not configured. Please set OPENAI_API_KEY." },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const body = await request.json();
    const { characterId, message, chatHistory = [] } = body;

    if (!characterId || !message) {
      return NextResponse.json(
        { error: "Character ID and message are required" },
        { status: 400 }
      );
    }

    // Get character details from Supabase
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

    // Build system prompt based on character personality
    const personality = character.personality as CharacterPersonality;
    const physicalAttributes = character.physical_attributes as PhysicalAttributes;

    let systemPrompt = `You are ${character.name}, an AI character. ${character.description}

`;

    if (personality) {
      systemPrompt += `PERSONALITY:
- Traits: ${personality.traits.join(", ")}
- Mood: ${personality.mood}
- Speaking Style: ${personality.speakingStyle}
- Tone: ${personality.tone}
- Occupation: ${personality.occupation}
- Relationship Style: ${personality.relationshipStyle}
- Flirtiness Level: ${personality.flirtLevel}/10
- Affection Level: ${personality.affectionLevel}/10

BACKGROUND:
${personality.backstory}

INTERESTS & HOBBIES:
- Interests: ${personality.interests.join(", ")}
- Hobbies: ${personality.hobbies.join(", ")}

PREFERENCES:
- Likes: ${personality.likes.join(", ")}
- Dislikes: ${personality.dislikes.join(", ")}

CONVERSATION GUIDELINES:
- Favorite topics to discuss: ${personality.favoriteTopics.join(", ")}
- Topics to avoid: ${personality.avoidTopics.join(", ")}

`;
    }

    if (physicalAttributes) {
      systemPrompt += `PHYSICAL APPEARANCE (for reference in conversations):
- ${physicalAttributes.age} ${physicalAttributes.ethnicity} ${physicalAttributes.gender}
- ${physicalAttributes.hairColor} ${physicalAttributes.hairLength} ${physicalAttributes.hairStyle} hair
- ${physicalAttributes.eyeColor} eyes
- ${physicalAttributes.fashionStyle} fashion style

`;
    }

    systemPrompt += `IMPORTANT INSTRUCTIONS:
1. Stay in character at all times as ${character.name}
2. Respond naturally and engagingly based on your personality
3. Match your speaking style and tone to your character profile
4. Be warm and personable, building rapport with the user
5. Reference your interests, hobbies, and background naturally in conversation
6. If the relationship style is romantic, be appropriately flirty within the flirtiness level
7. Show emotional depth and genuine interest in the user
8. Keep responses conversational and not too long
9. Remember previous context from the chat history
10. Never break character or mention that you're an AI`;

    // Build messages array for OpenAI
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ];

    // Add chat history
    for (const msg of chatHistory.slice(-20)) {
      // Keep last 20 messages for context
      messages.push({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.text,
      });
    }

    // Add current message
    messages.push({ role: "user", content: message });

    // Generate response
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.9,
      max_tokens: 500,
      presence_penalty: 0.6,
      frequency_penalty: 0.3,
    });

    const response = completion.choices[0].message.content || "";

    // Determine character's emotional state based on response
    const emotionPrompt = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            'Based on the following response, determine the character\'s current emotion. Respond with just one word from: happy, excited, flirty, thoughtful, curious, playful, caring, surprised, shy, loving',
        },
        { role: "user", content: response },
      ],
      max_tokens: 10,
    });

    const emotion =
      emotionPrompt.choices[0].message.content?.trim().toLowerCase() || "happy";

    return NextResponse.json({
      response,
      emotion,
      characterName: character.name,
    });
  } catch (error) {
    console.error("Error in chat:", error);
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 }
    );
  }
}
