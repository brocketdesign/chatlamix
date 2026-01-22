import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { CharacterPersonality } from "@/lib/types";

const getOpenAIClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
};

// GET - Get available gift types
export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: gifts, error } = await supabase
      .from("gift_types")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Error fetching gift types:", error);
      return NextResponse.json(
        { error: "Failed to fetch gift types" },
        { status: 500 }
      );
    }

    return NextResponse.json({ gifts: gifts || [] });
  } catch (error) {
    console.error("Error fetching gift types:", error);
    // Return default gifts if table doesn't exist
    return NextResponse.json({
      gifts: [
        { id: "1", name: "rose", display_name: "Rose", emoji: "🌹", coin_cost: 5, description: "A beautiful red rose" },
        { id: "2", name: "heart", display_name: "Heart", emoji: "❤️", coin_cost: 10, description: "Show your love" },
        { id: "3", name: "kiss", display_name: "Kiss", emoji: "💋", coin_cost: 15, description: "Send a sweet kiss" },
        { id: "4", name: "chocolate", display_name: "Chocolate", emoji: "🍫", coin_cost: 20, description: "Sweet chocolate treat" },
        { id: "5", name: "teddy_bear", display_name: "Teddy Bear", emoji: "🧸", coin_cost: 30, description: "A cuddly teddy bear" },
        { id: "6", name: "diamond", display_name: "Diamond", emoji: "💎", coin_cost: 50, description: "A precious diamond" },
        { id: "7", name: "champagne", display_name: "Champagne", emoji: "🍾", coin_cost: 40, description: "Celebrate together" },
        { id: "8", name: "crown", display_name: "Crown", emoji: "👑", coin_cost: 100, description: "Crown them royalty" },
        { id: "9", name: "fire", display_name: "Fire", emoji: "🔥", coin_cost: 25, description: "Things are heating up!" },
        { id: "10", name: "star", display_name: "Star", emoji: "⭐", coin_cost: 35, description: "They are a star!" },
      ]
    });
  }
}

// POST - Send a gift to a character
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

    const body = await request.json();
    const { characterId, giftType, giftName, giftEmoji, coinCost, message } = body;

    if (!characterId || !giftType || !coinCost) {
      return NextResponse.json(
        { error: "Character ID, gift type, and coin cost are required" },
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

    // Deduct coins
    let coinDeductionSuccess = false;
    let newBalance: number | null = null;
    
    try {
      const { data: deductResult, error: deductError } = await supabase
        .rpc('deduct_coins', {
          p_user_id: user.id,
          p_amount: coinCost,
          p_transaction_type: 'tip_sent',
          p_reference_type: 'chat_gift',
          p_reference_id: characterId,
          p_description: `Gift (${giftName}) to ${character.name}`
        });

      if (deductError) {
        if (deductError.message?.includes('does not exist') || deductError.code === '42883') {
          // Coin system not set up, allow free gifts for now
          coinDeductionSuccess = true;
        } else {
          console.error("Coin deduction error:", deductError);
          return NextResponse.json(
            { 
              error: "Failed to deduct coins", 
              message: "Unable to process payment. Please try again."
            },
            { status: 500 }
          );
        }
      } else if (deductResult && deductResult.length > 0) {
        const result = deductResult[0];
        if (result.success) {
          coinDeductionSuccess = true;
          newBalance = result.new_balance;
        } else {
          return NextResponse.json(
            { 
              error: "Insufficient coins", 
              required: coinCost,
              message: `You need ${coinCost} coins to send this gift.`
            },
            { status: 402 }
          );
        }
      } else {
        // No result returned - try manual deduction as fallback
        const { data: balanceData } = await supabase
          .from('user_coin_balances')
          .select('balance')
          .eq('user_id', user.id)
          .single();
        
        if (!balanceData || balanceData.balance < coinCost) {
          return NextResponse.json(
            { 
              error: "Insufficient coins", 
              required: coinCost,
              currentBalance: balanceData?.balance || 0,
              message: `You need ${coinCost} coins to send this gift. You have ${balanceData?.balance || 0} coins.`
            },
            { status: 402 }
          );
        }
        
        // Manual deduction
        const { data: updated } = await supabase
          .from('user_coin_balances')
          .update({ 
            balance: balanceData.balance - coinCost,
            lifetime_spent: (balanceData as { lifetime_spent?: number }).lifetime_spent || 0 + coinCost
          })
          .eq('user_id', user.id)
          .select('balance')
          .single();
        
        if (updated) {
          coinDeductionSuccess = true;
          newBalance = updated.balance;
        }
      }
    } catch (coinError) {
      console.log("Coin system check failed:", coinError);
      // If coin tables don't exist at all, allow the gift
      coinDeductionSuccess = true;
    }

    if (!coinDeductionSuccess) {
      return NextResponse.json(
        { error: "Failed to process coin payment" },
        { status: 500 }
      );
    }

    // Generate character's reaction to the gift
    let characterResponse = `Thank you so much for the ${giftName}! ${giftEmoji} That's so sweet of you!`;
    
    const openai = getOpenAIClient();
    if (openai) {
      try {
        const personality = character.personality as CharacterPersonality | null;
        
        let reactionPrompt = `You are ${character.name}. ${character.description}`;
        if (personality) {
          reactionPrompt += ` Your personality traits are: ${personality.traits.join(", ")}. Your speaking style is ${personality.speakingStyle} and your tone is ${personality.tone}.`;
        }
        reactionPrompt += `\n\nSomeone just sent you a ${giftName} ${giftEmoji} as a gift${message ? ` with the message: "${message}"` : ""}. React with genuine emotion and gratitude in character. Keep it brief (1-2 sentences).`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: reactionPrompt },
            { role: "user", content: `I'm sending you a ${giftName} ${giftEmoji}!${message ? ` ${message}` : ""}` },
          ],
          temperature: 0.9,
          max_tokens: 100,
        });

        characterResponse = completion.choices[0].message.content || characterResponse;
      } catch (aiError) {
        console.error("Error generating gift reaction:", aiError);
      }
    }

    // Get or create session
    let session;
    const { data: existingSession } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("user_id", user.id)
      .eq("character_id", characterId)
      .single();

    if (existingSession) {
      session = existingSession;
    } else {
      const { data: newSession } = await supabase
        .from("chat_sessions")
        .insert({
          user_id: user.id,
          character_id: characterId,
          relationship_progress: 0,
        })
        .select()
        .single();
      session = newSession;
    }

    // Save gift to database
    let savedGift = null;
    if (session) {
      try {
        const { data: gift } = await supabase
          .from("chat_gifts")
          .insert({
            session_id: session.id,
            character_id: characterId,
            user_id: user.id,
            gift_type: giftType,
            gift_name: giftName,
            coin_cost: coinCost,
            message,
            character_response: characterResponse,
          })
          .select()
          .single();
        savedGift = gift;

        // Save gift message to chat
        await supabase.from("chat_messages").insert({
          session_id: session.id,
          character_id: characterId,
          user_id: user.id,
          sender: "user",
          text: `Sent a ${giftName} ${giftEmoji}${message ? `: ${message}` : ""}`,
          message_type: "gift",
          gift_id: gift?.id,
        });

        // Save character's reaction
        await supabase.from("chat_messages").insert({
          session_id: session.id,
          character_id: characterId,
          user_id: user.id,
          sender: "character",
          text: characterResponse,
          emotion: "happy",
          message_type: "text",
        });

        // Boost relationship progress for gifts
        await supabase
          .from("chat_sessions")
          .update({ 
            relationship_progress: session.relationship_progress + 5,
            updated_at: new Date().toISOString()
          })
          .eq("id", session.id);
      } catch (saveError) {
        console.error("Error saving gift (non-critical):", saveError);
      }
    }

    return NextResponse.json({
      success: true,
      characterResponse,
      giftId: savedGift?.id,
      newBalance,
      coinCost,
      message: `${giftName} sent successfully!`,
    });
  } catch (error) {
    console.error("Error sending gift:", error);
    return NextResponse.json(
      { error: "Failed to send gift" },
      { status: 500 }
    );
  }
}
