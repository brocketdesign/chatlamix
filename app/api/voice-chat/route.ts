import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { CharacterPersonality, PhysicalAttributes } from "@/lib/types";

// Initialize OpenAI client
const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error("[voice-chat] OPENAI_API_KEY is not set in environment variables");
    console.error("[voice-chat] Available env vars:", Object.keys(process.env).filter(k => k.includes('OPENAI') || k.includes('NEXT')).join(', '));
    return null;
  }
  
  // Log key detection (partial key for security)
  console.log("[voice-chat] OPENAI_API_KEY detected:", apiKey.substring(0, 10) + "...");
  
  return new OpenAI({
    apiKey: apiKey,
  });
};

// POST - Create a voice session with a character
export async function POST(request: NextRequest) {
  try {
    const openai = getOpenAIClient();
    if (!openai) {
      console.error("[voice-chat] OpenAI client initialization failed - API key missing");
      return NextResponse.json(
        { 
          error: "Voice chat API not configured. OPENAI_API_KEY environment variable is not set on the server.",
          hint: "If using Hostinger, add OPENAI_API_KEY to your environment variables in the hosting panel.",
          nodeEnv: process.env.NODE_ENV
        },
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

    const voice = determineVoice(personality);
    // Use the latest realtime model - gpt-4o-realtime-preview-2024-12-17 is the stable dated version
    // Note: Don't use the bare "gpt-4o-realtime-preview" alias as it can cause WebRTC connection issues
    const model = "gpt-4o-realtime-preview-2024-12-17";

    // Get the API key (already validated by getOpenAIClient check above)
    const apiKey = process.env.OPENAI_API_KEY;
    
    // Create an ephemeral token for secure client-side connection
    // This token is valid for 1 minute and can be safely sent to the client
    console.log("[voice-chat] Creating ephemeral token with OpenAI Realtime API...");
    console.log("[voice-chat] Request params:", {
      model,
      voice,
      instructionsLength: systemInstructions.length,
      apiKeyPrefix: apiKey?.substring(0, 10),
    });
    
    const requestBody = {
      model,
      voice,
      instructions: systemInstructions,
    };
    
    console.log("[voice-chat] Request body (truncated):", JSON.stringify(requestBody).substring(0, 500));
    
    const ephemeralTokenResponse = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    console.log("[voice-chat] OpenAI response status:", ephemeralTokenResponse.status);
    console.log("[voice-chat] OpenAI response headers:", Object.fromEntries(ephemeralTokenResponse.headers.entries()));

    if (!ephemeralTokenResponse.ok) {
      const errorData = await ephemeralTokenResponse.text();
      console.error("[voice-chat] Failed to create ephemeral token");
      console.error("[voice-chat] Response status:", ephemeralTokenResponse.status);
      console.error("[voice-chat] Response body:", errorData);
      return NextResponse.json(
        { 
          error: "Failed to create voice session token",
          details: ephemeralTokenResponse.status === 401 ? "API key authentication failed" : errorData,
          status: ephemeralTokenResponse.status,
        },
        { status: 500 }
      );
    }

    const ephemeralData = await ephemeralTokenResponse.json();
    console.log("[voice-chat] Ephemeral token created successfully");
    console.log("[voice-chat] Full response structure:", JSON.stringify(ephemeralData, null, 2));
    console.log("[voice-chat] Token structure:", {
      hasClientSecret: !!ephemeralData.client_secret,
      tokenType: typeof ephemeralData.client_secret,
      hasValue: !!ephemeralData.client_secret?.value,
      expiresAt: ephemeralData.client_secret?.expires_at,
      tokenPrefix: ephemeralData.client_secret?.value?.substring(0, 15),
    });

    // The ephemeral token from OpenAI is returned as { client_secret: { value: "ek_...", expires_at: ... } }
    // We need to extract the value property for the client to use
    const ephemeralToken = ephemeralData.client_secret?.value || ephemeralData.client_secret;
    
    if (!ephemeralToken || (typeof ephemeralToken === 'string' && !ephemeralToken.startsWith('ek_'))) {
      console.error("[voice-chat] Invalid ephemeral token format:", ephemeralData);
      return NextResponse.json(
        { error: "Failed to create valid ephemeral token" },
        { status: 500 }
      );
    }

    // Create a session configuration for OpenAI Realtime API
    const sessionConfig = {
      characterId: character.id,
      characterName: character.name,
      systemInstructions,
      voice,
      model,
      clientSecret: ephemeralToken, // Ephemeral token value (starts with ek_)
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

  // OpenAI Realtime API voices: alloy, ash, ballad, coral, sage, verse
  const { gender } = personality as any;
  const mood = personality.mood?.toLowerCase() || "";
  const tone = personality.tone?.toLowerCase() || "";

  // Map character attributes to voices
  if (gender === "female") {
    if (mood.includes("playful") || tone.includes("warm")) return "coral";
    if (mood.includes("mysterious") || tone.includes("sarcastic")) return "sage";
    return "alloy"; // Default female voice
  } else if (gender === "male") {
    if (tone.includes("deep") || mood.includes("serious")) return "ash";
    if (tone.includes("friendly") || mood.includes("cheerful")) return "verse";
    return "ballad"; // Default male voice
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
