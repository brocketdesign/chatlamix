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

// POST - Generate an image from a chat message
export async function POST(request: NextRequest) {
  log("POST request started");
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      log("POST - Authentication required, no user");
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    log("POST - User authenticated", { userId: user.id });

    if (!SEGMIND_API_KEY) {
      log("POST - SEGMIND_API_KEY not configured");
      return NextResponse.json(
        { error: "Image generation API not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { characterId, messageId, messageText, customPrompt } = body;

    log("POST - Request body", { 
      characterId, 
      messageId, 
      messageTextLength: messageText?.length,
      hasCustomPrompt: !!customPrompt 
    });

    if (!characterId || !messageText) {
      log("POST - Missing required params");
      return NextResponse.json(
        { error: "Character ID and message text are required" },
        { status: 400 }
      );
    }

    // Get character details
    log("POST - Fetching character");
    const { data: character, error: charError } = await supabase
      .from("characters")
      .select("*")
      .eq("id", characterId)
      .single();

    if (charError || !character) {
      log("POST - Character not found", { error: charError?.message });
      return NextResponse.json(
        { error: "Character not found" },
        { status: 404 }
      );
    }

    log("POST - Character loaded", {
      characterId: character.id,
      characterName: character.name,
      hasMainFaceImage: !!character.main_face_image,
      mainFaceImageLength: character.main_face_image?.length || 0,
      mainFaceImagePreview: character.main_face_image?.substring(0, 80) || "none",
      hasPhysicalAttributes: !!character.physical_attributes,
    });

    // Deduct coins
    log("POST - Starting coin deduction", { cost: CHAT_IMAGE_COST });
    let coinDeductionSuccess = false;
    let newBalance: number | null = null;
    
    try {
      const { data: deductResult, error: deductError } = await supabase
        .rpc('deduct_coins', {
          p_user_id: user.id,
          p_amount: CHAT_IMAGE_COST,
          p_transaction_type: 'image_generation',
          p_reference_type: 'chat_image',
          p_reference_id: characterId,
          p_description: `Chat image generation for ${character.name}`
        });

      if (deductError) {
        if (deductError.message?.includes('does not exist') || deductError.code === '42883') {
          log("POST - Coin system not set up, allowing free generation");
          coinDeductionSuccess = true;
        } else {
          log("POST - Coin deduction error", { error: deductError.message });
          return NextResponse.json(
            { error: "Failed to deduct coins", message: "Unable to process payment." },
            { status: 500 }
          );
        }
      } else if (deductResult && deductResult.length > 0) {
        const result = deductResult[0];
        if (result.success) {
          coinDeductionSuccess = true;
          newBalance = result.new_balance;
          log("POST - Coins deducted successfully", { newBalance });
        } else {
          log("POST - Insufficient coins", { required: CHAT_IMAGE_COST });
          return NextResponse.json(
            { 
              error: "Insufficient coins", 
              required: CHAT_IMAGE_COST,
              message: `You need ${CHAT_IMAGE_COST} coins to generate this image.`
            },
            { status: 402 }
          );
        }
      } else {
        // Fallback: manual balance check and deduction
        log("POST - Fallback coin check");
        const { data: balanceData } = await supabase
          .from('user_coin_balances')
          .select('balance, lifetime_spent')
          .eq('user_id', user.id)
          .single();
        
        if (!balanceData || balanceData.balance < CHAT_IMAGE_COST) {
          log("POST - Insufficient coins (fallback)", { balance: balanceData?.balance });
          return NextResponse.json(
            { 
              error: "Insufficient coins", 
              required: CHAT_IMAGE_COST,
              currentBalance: balanceData?.balance || 0,
              message: `You need ${CHAT_IMAGE_COST} coins. You have ${balanceData?.balance || 0} coins.`
            },
            { status: 402 }
          );
        }
        
        const { data: updated } = await supabase
          .from('user_coin_balances')
          .update({ 
            balance: balanceData.balance - CHAT_IMAGE_COST,
            lifetime_spent: (balanceData.lifetime_spent || 0) + CHAT_IMAGE_COST
          })
          .eq('user_id', user.id)
          .select('balance')
          .single();
        
        if (updated) {
          coinDeductionSuccess = true;
          newBalance = updated.balance;
          log("POST - Coins deducted (fallback)", { newBalance });
        }
      }
    } catch (coinError) {
      log("POST - Coin system check failed, allowing generation", { error: String(coinError) });
      coinDeductionSuccess = true;
    }

    if (!coinDeductionSuccess) {
      log("POST - Coin deduction failed");
      return NextResponse.json(
        { error: "Failed to process coin payment" },
        { status: 500 }
      );
    }

    // Build the prompt
    const physicalAttributes = character.physical_attributes as PhysicalAttributes;
    let imagePrompt: string;

    if (customPrompt) {
      imagePrompt = customPrompt;
      log("POST - Using custom prompt");
    } else if (physicalAttributes) {
      // Use the chat-specific prompt builder (user message is the focus)
      imagePrompt = buildChatImagePrompt(physicalAttributes, messageText);
      log("POST - Built prompt from physical attributes");
    } else {
      // Fallback: use character name and user's message
      imagePrompt = `${messageText}. Featuring ${character.name}. High quality, detailed, sharp focus.`;
      log("POST - Using fallback prompt");
    }

    log("POST - Final prompt", { 
      promptLength: imagePrompt.length, 
      promptPreview: imagePrompt.substring(0, 200) + "..." 
    });

    // Generate image using Segmind
    log("POST - Calling Segmind image generation API");
    const imageGenStartTime = Date.now();

    const segmindResponse = await fetch(SEGMIND_IMAGE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": SEGMIND_API_KEY,
      },
      body: JSON.stringify({
        prompt: imagePrompt,
        negative_prompt: "ugly, deformed, noisy, blurry, low quality, distorted, disfigured, bad anatomy",
        steps: 8,
        guidance_scale: 1,
        seed: -1,
        width: 1024,
        height: 1024,
        img_format: "webp",
        quality: 90,
      }),
    });

    log("POST - Segmind API responded", { 
      status: segmindResponse.status, 
      timeMs: Date.now() - imageGenStartTime 
    });

    if (!segmindResponse.ok) {
      const errorText = await segmindResponse.text();
      log("POST - Segmind error", { status: segmindResponse.status, error: errorText });
      return NextResponse.json(
        { error: "Failed to generate image" },
        { status: 500 }
      );
    }

    // Get image as base64
    const imageBuffer = await segmindResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");
    let imageUrl = `data:image/webp;base64,${base64Image}`;

    log("POST - Image generated successfully", { imageSizeBytes: imageBuffer.byteLength });

    // ========== FACE SWAP SECTION ==========
    // Check if character has a main face image for face swapping
    const mainFaceImage = character.main_face_image;
    const shouldFaceSwap = mainFaceImage && mainFaceImage.length > 0;
    let faceSwapApplied = false;

    log("POST - Face swap check", {
      hasMainFaceImage: !!mainFaceImage,
      mainFaceImageLength: mainFaceImage?.length || 0,
      shouldFaceSwap,
    });

    if (shouldFaceSwap) {
      try {
        log("POST - Starting face swap with character's main face");
        
        // Forward cookies from the original request to maintain authentication
        const cookieHeader = request.headers.get("cookie") || "";
        
        const faceSwapStartTime = Date.now();
        log("POST - Calling face swap API", { 
          sourceImageLength: mainFaceImage.length,
          targetImageLength: imageUrl.length,
        });

        const faceSwapResponse = await fetch(
          `${request.nextUrl.origin}/api/face-swap`,
          {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Cookie": cookieHeader,
            },
            body: JSON.stringify({
              sourceImage: mainFaceImage,  // Character's base face
              targetImage: imageUrl,        // Generated image to swap face into
            }),
          }
        );

        log("POST - Face swap API responded", { 
          status: faceSwapResponse.status, 
          timeMs: Date.now() - faceSwapStartTime 
        });

        if (faceSwapResponse.ok) {
          const faceSwapResult = await faceSwapResponse.json();
          log("POST - Face swap result", { 
            success: faceSwapResult.success, 
            hasImageUrl: !!faceSwapResult.imageUrl,
            resultImageLength: faceSwapResult.imageUrl?.length || 0,
          });
          
          if (faceSwapResult.success && faceSwapResult.imageUrl) {
            imageUrl = faceSwapResult.imageUrl;
            faceSwapApplied = true;
            log("POST - Face swap applied successfully");
          } else {
            log("POST - Face swap response missing imageUrl", { result: faceSwapResult });
          }
        } else {
          const errorData = await faceSwapResponse.json().catch(() => ({}));
          log("POST - Face swap API error", { 
            status: faceSwapResponse.status, 
            error: errorData 
          });
        }
      } catch (faceSwapError) {
        log("POST - Face swap failed, using original image", { 
          error: String(faceSwapError) 
        });
      }
    } else {
      log("POST - Skipping face swap - no main face image available for character");
    }

    const finalImageUrl = imageUrl;
    log("POST - Final image ready", { 
      faceSwapApplied, 
      finalImageUrlLength: finalImageUrl.length 
    });

    // Determine image format from the data URL
    const mimeMatch = finalImageUrl.match(/^data:(image\/[^;]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/webp";
    const extension = mimeType.split("/")[1] || "webp";
    
    // Upload to Supabase Storage
    log("POST - Uploading to Supabase Storage", { mimeType, extension });
    const fileName = `chat_${characterId}_${Date.now()}.${extension}`;
    
    // Convert data URL back to buffer for upload
    const uploadBuffer = Buffer.from(finalImageUrl.split(",")[1], "base64");
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("character-images")
      .upload(fileName, uploadBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    let storedImageUrl = finalImageUrl;
    if (!uploadError && uploadData) {
      const { data: { publicUrl } } = supabase.storage
        .from("character-images")
        .getPublicUrl(fileName);
      storedImageUrl = publicUrl;
      log("POST - Uploaded to storage", { publicUrl });
    } else if (uploadError) {
      log("POST - Storage upload failed (using base64)", { error: uploadError.message });
    }

    // Get or create session
    log("POST - Getting or creating chat session");
    let session;
    const { data: existingSession } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("user_id", user.id)
      .eq("character_id", characterId)
      .single();

    if (existingSession) {
      session = existingSession;
      log("POST - Using existing session", { sessionId: session.id });
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
      log("POST - Created new session", { sessionId: session?.id });
    }

    // Save chat image to database
    log("POST - Saving to database");
    let savedImage = null;
    
    // Validate messageId is a proper UUID before using it
    const validMessageId = messageId && isValidUUID(messageId) ? messageId : null;
    if (messageId && !validMessageId) {
      log("POST - Invalid messageId format (not a UUID), ignoring", { messageId });
    }
    
    if (session) {
      try {
        const { data: chatImage, error: chatImageError } = await supabase
          .from("chat_images")
          .insert({
            session_id: session.id,
            message_id: validMessageId,
            character_id: characterId,
            user_id: user.id,
            image_url: storedImageUrl,
            prompt: imagePrompt,
            coin_cost: CHAT_IMAGE_COST,
            settings: { 
              width: 1024, 
              height: 1024,
              faceSwapApplied,
            },
          })
          .select()
          .single();
        
        if (chatImageError) {
          log("POST - Error saving chat_image", { error: chatImageError.message });
        } else {
          savedImage = chatImage;
          log("POST - Saved to chat_images", { imageId: chatImage?.id });
        }

        // Also add to character_images gallery
        const { error: galleryError } = await supabase.from("character_images").insert({
          character_id: characterId,
          image_url: storedImageUrl,
          prompt: imagePrompt,
          is_main_face: false,
          gallery_status: "unposted",
          settings: { 
            width: 1024, 
            height: 1024,
            source: "chat",
            original_message: messageText,
            faceSwapApplied,
          },
        });

        if (galleryError) {
          log("POST - Error saving to gallery", { error: galleryError.message });
        } else {
          log("POST - Saved to character_images gallery");
        }

        // Create an image message in chat (from character)
        const { data: imageMessage, error: messageError } = await supabase
          .from("chat_messages")
          .insert({
            session_id: session.id,
            character_id: characterId,
            user_id: user.id,
            sender: "character",
            text: "Here's the image I generated for you! 📸",
            message_type: "image",
            image_url: storedImageUrl,
            image_id: chatImage?.id,
          })
          .select()
          .single();

        if (messageError) {
          log("POST - Error creating image message", { error: messageError.message });
        } else {
          savedImage = { ...savedImage, messageId: imageMessage?.id };
          log("POST - Created image message", { messageId: imageMessage?.id });
        }
      } catch (saveError) {
        log("POST - Error saving chat image (non-critical)", { error: String(saveError) });
      }
    }

    const totalTime = Date.now() - startTime;
    log("POST - Request completed", { 
      totalTimeMs: totalTime,
      faceSwapApplied,
      imageId: savedImage?.id,
    });

    return NextResponse.json({
      success: true,
      imageUrl: storedImageUrl,
      imageId: savedImage?.id,
      prompt: imagePrompt,
      coinCost: CHAT_IMAGE_COST,
      newBalance,
      faceSwapApplied,
      message: faceSwapApplied 
        ? "Image generated with face swap!" 
        : "Image generated successfully!",
    });
  } catch (error) {
    log("POST - Unexpected error", { error: String(error) });
    return NextResponse.json(
      { error: "Failed to generate image" },
      { status: 500 }
    );
  }
}
