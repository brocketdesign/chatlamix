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

// Helper function to get or create a chat session
async function getOrCreateSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  characterId: string
) {
  // Try to find existing session
  const { data: existingSession } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("character_id", characterId)
    .single();

  if (existingSession) {
    return existingSession;
  }

  // Create new session
  const { data: newSession, error } = await supabase
    .from("chat_sessions")
    .insert({
      user_id: userId,
      character_id: characterId,
      relationship_progress: 0,
    })
    .select()
    .single();

  if (error) {
    throw new Error("Failed to create chat session");
  }

  return newSession;
}

// GET - Load chat history for a character
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
    const characterId = searchParams.get("characterId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!characterId) {
      return NextResponse.json(
        { error: "Character ID is required" },
        { status: 400 }
      );
    }

    // Get or create session
    const session = await getOrCreateSession(supabase, user.id, characterId);

    // Load messages for this session
    const { data: messages, error: messagesError, count } = await supabase
      .from("chat_messages")
      .select("*", { count: "exact" })
      .eq("session_id", session.id)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (messagesError) {
      console.error("Error loading messages:", messagesError);
      return NextResponse.json(
        { error: "Failed to load chat history" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      session,
      messages: messages || [],
      totalMessages: count || 0,
    });
  } catch (error) {
    console.error("Error loading chat:", error);
    return NextResponse.json(
      { error: "Failed to load chat history" },
      { status: 500 }
    );
  }
}

// DELETE - Reset chat (clear conversation history)
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
    const characterId = searchParams.get("characterId");

    if (!characterId) {
      return NextResponse.json(
        { error: "Character ID is required" },
        { status: 400 }
      );
    }

    // Get session
    const { data: session } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("user_id", user.id)
      .eq("character_id", characterId)
      .single();

    if (session) {
      // Delete all messages for this session
      await supabase
        .from("chat_messages")
        .delete()
        .eq("session_id", session.id);

      // Reset relationship progress
      await supabase
        .from("chat_sessions")
        .update({ relationship_progress: 0 })
        .eq("id", session.id);
    }

    return NextResponse.json({
      success: true,
      message: "Chat history cleared",
    });
  } catch (error) {
    console.error("Error resetting chat:", error);
    return NextResponse.json(
      { error: "Failed to reset chat" },
      { status: 500 }
    );
  }
}

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

    // Save messages to database if user is authenticated
    let savedUserMessage = null;
    let savedCharacterMessage = null;
    
    if (user) {
      try {
        const session = await getOrCreateSession(supabase, user.id, characterId);
        
        // Save user message
        const { data: userMsg } = await supabase
          .from("chat_messages")
          .insert({
            session_id: session.id,
            character_id: characterId,
            user_id: user.id,
            sender: "user",
            text: message,
            message_type: "text",
          })
          .select()
          .single();
        savedUserMessage = userMsg;

        // Save character response
        const { data: charMsg } = await supabase
          .from("chat_messages")
          .insert({
            session_id: session.id,
            character_id: characterId,
            user_id: user.id,
            sender: "character",
            text: response,
            emotion,
            message_type: "text",
          })
          .select()
          .single();
        savedCharacterMessage = charMsg;

        // Update relationship progress
        await supabase
          .from("chat_sessions")
          .update({ 
            relationship_progress: session.relationship_progress + 1,
            updated_at: new Date().toISOString()
          })
          .eq("id", session.id);
      } catch (saveError) {
        console.error("Error saving messages (non-critical):", saveError);
      }
    }

    return NextResponse.json({
      response,
      emotion,
      characterName: character.name,
      savedUserMessageId: savedUserMessage?.id,
      savedCharacterMessageId: savedCharacterMessage?.id,
    });
  } catch (error) {
    console.error("Error in chat:", error);
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 }
    );
  }
}
