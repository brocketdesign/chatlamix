import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST - Initialize a new chat session and save the greeting message
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

    const { characterId, greetingText, emotion } = await request.json();

    if (!characterId || !greetingText) {
      return NextResponse.json(
        { error: "Character ID and greeting text are required" },
        { status: 400 }
      );
    }

    // Verify the character exists
    const { data: character, error: charError } = await supabase
      .from("characters")
      .select("id, name")
      .eq("id", characterId)
      .single();

    if (charError || !character) {
      return NextResponse.json(
        { error: "Character not found" },
        { status: 404 }
      );
    }

    // Check if session already exists with messages
    const { data: existingSession } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("user_id", user.id)
      .eq("character_id", characterId)
      .single();

    if (existingSession) {
      // Check if there are already messages in this session
      const { count } = await supabase
        .from("chat_messages")
        .select("*", { count: "exact", head: true })
        .eq("session_id", existingSession.id);

      if (count && count > 0) {
        // Session already has messages, don't create a new greeting
        return NextResponse.json({
          success: true,
          sessionId: existingSession.id,
          alreadyInitialized: true,
        });
      }
    }

    // Create new session if doesn't exist
    let sessionId = existingSession?.id;
    
    if (!sessionId) {
      const { data: newSession, error: sessionError } = await supabase
        .from("chat_sessions")
        .insert({
          user_id: user.id,
          character_id: characterId,
          relationship_progress: 0,
        })
        .select()
        .single();

      if (sessionError) {
        console.error("Error creating chat session:", sessionError);
        return NextResponse.json(
          { error: "Failed to create chat session" },
          { status: 500 }
        );
      }

      sessionId = newSession.id;
    }

    // Save the greeting message
    const { data: greetingMessage, error: msgError } = await supabase
      .from("chat_messages")
      .insert({
        session_id: sessionId,
        character_id: characterId,
        user_id: user.id,
        sender: "character",
        text: greetingText,
        emotion: emotion || "happy",
        message_type: "text",
      })
      .select()
      .single();

    if (msgError) {
      console.error("Error saving greeting message:", msgError);
      return NextResponse.json(
        { error: "Failed to save greeting message" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId,
      messageId: greetingMessage.id,
    });
  } catch (error) {
    console.error("Error initializing chat:", error);
    return NextResponse.json(
      { error: "Failed to initialize chat" },
      { status: 500 }
    );
  }
}
