import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { CharacterPersonality, PhysicalAttributes } from "@/lib/types";

// Initialize OpenAI client
const getOpenAIClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
};

// POST - Create a voice session with a character
export async function POST(request: NextRequest) {
  try {
    const openai = getOpenAIClient();
    if (!openai) {
      return NextResponse.json(
        { error: "Voice chat API not configured. Please set OPENAI_API_KEY." },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const body = await request.json();
    const { characterId } = body;

    if (!characterId) {
      return NextResponse.json(
        { error: "Character ID is required" },
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

    // Build system instructions based on character personality
    const personality = character.personality as CharacterPersonality;
    const physicalAttributes = character.physical_attributes as PhysicalAttributes;

    let systemInstructions = `You are ${character.name}, having a voice conversation. ${character.description}

`;

    if (personality) {
      systemInstructions += `PERSONALITY:
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
${personality.interests.join(", ")} - ${personality.hobbies.join(", ")}

PREFERENCES:
Likes: ${personality.likes.join(", ")}
Dislikes: ${personality.dislikes.join(", ")}

CONVERSATION GUIDELINES:
- Favorite topics: ${personality.favoriteTopics.join(", ")}
- Avoid topics: ${personality.avoidTopics.join(", ")}

`;
    }

    systemInstructions += `VOICE CONVERSATION RULES:
1. Speak naturally as ${character.name} in a conversational tone
2. Keep responses brief and natural (1-3 sentences typically)
3. Show emotion and personality through your voice
4. React naturally to what the user says
5. Be engaging and build rapport
6. Match your speaking style to your character profile
7. Never break character or mention you're an AI
8. Use natural speech patterns with appropriate pauses
9. Be warm and personable in your delivery`;

    // Create a session configuration for OpenAI Realtime API
    // Note: The actual WebRTC/WebSocket connection will be handled client-side
    const sessionConfig = {
      characterId: character.id,
      characterName: character.name,
      systemInstructions,
      voice: determineVoice(personality),
      model: "gpt-4o-realtime-preview-2024-10-01", // Latest realtime model
    };

    // Save voice session if user is authenticated
    if (user) {
      try {
        await supabase.from("voice_chat_sessions").insert({
          user_id: user.id,
          character_id: characterId,
          status: "started",
        });
      } catch (sessionError) {
        console.error("Error saving voice session (non-critical):", sessionError);
      }
    }

    return NextResponse.json({
      success: true,
      session: sessionConfig,
      apiKey: process.env.OPENAI_API_KEY, // In production, use a secure method
    });
  } catch (error) {
    console.error("Error creating voice session:", error);
    return NextResponse.json(
      { error: "Failed to create voice session" },
      { status: 500 }
    );
  }
}

// Helper function to determine appropriate voice based on character
function determineVoice(personality?: CharacterPersonality): string {
  if (!personality) return "alloy";

  // OpenAI Realtime API voices: alloy, echo, fable, onyx, nova, shimmer
  const { gender } = personality as any;
  const mood = personality.mood.toLowerCase();
  const tone = personality.tone.toLowerCase();

  // Map character attributes to voices
  if (gender === "female") {
    if (mood.includes("playful") || tone.includes("warm")) return "nova";
    if (mood.includes("mysterious") || tone.includes("sarcastic")) return "shimmer";
    return "alloy"; // Default female voice
  } else if (gender === "male") {
    if (tone.includes("deep") || mood.includes("serious")) return "onyx";
    if (tone.includes("friendly") || mood.includes("cheerful")) return "echo";
    return "fable"; // Default male voice
  }

  return "alloy"; // Fallback
}

// DELETE - End a voice session
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

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (sessionId) {
      // Update session status
      await supabase
        .from("voice_chat_sessions")
        .update({ 
          status: "ended",
          ended_at: new Date().toISOString()
        })
        .eq("id", sessionId)
        .eq("user_id", user.id);
    }

    return NextResponse.json({
      success: true,
      message: "Voice session ended",
    });
  } catch (error) {
    console.error("Error ending voice session:", error);
    return NextResponse.json(
      { error: "Failed to end voice session" },
      { status: 500 }
    );
  }
}
