import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Extend timeout for face swap processing
export const maxDuration = 120;

// Coin cost for face swap retry
const FACE_SWAP_RETRY_COST = 5;

// Logging helper
function log(step: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  console.log(`[chat-images-faceswap] [${timestamp}] ${step}`, data ? JSON.stringify(data, null, 2) : "");
}

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

    const body = await request.json();
    const { characterId, targetImageUrl } = body;

    log("POST - Request body", { 
      characterId, 
      hasTargetImageUrl: !!targetImageUrl,
      targetImageUrlLength: targetImageUrl?.length || 0,
    });

    if (!characterId || !targetImageUrl) {
      log("POST - Missing required params");
      return NextResponse.json(
        { error: "Character ID and target image URL are required" },
        { status: 400 }
      );
    }

    // Get character details to get the main face image
    log("POST - Fetching character");
    const { data: character, error: charError } = await supabase
      .from("characters")
      .select("id, name, main_face_image")
      .eq("id", characterId)
      .single();

    if (charError || !character) {
      log("POST - Character not found", { error: charError?.message });
      return NextResponse.json(
        { error: "Character not found" },
        { status: 404 }
      );
    }

    if (!character.main_face_image) {
      log("POST - Character has no main face image");
      return NextResponse.json(
        { error: "Character has no base face image for face swap" },
        { status: 400 }
      );
    }

    log("POST - Character loaded", {
      characterId: character.id,
      characterName: character.name,
      mainFaceImageLength: character.main_face_image?.length || 0,
    });

    // Deduct coins for face swap retry
    log("POST - Starting coin deduction", { cost: FACE_SWAP_RETRY_COST });
    let coinDeductionSuccess = false;
    let newBalance: number | null = null;

    try {
      const { data: deductResult, error: deductError } = await supabase
        .rpc('deduct_coins', {
          p_user_id: user.id,
          p_amount: FACE_SWAP_RETRY_COST,
          p_transaction_type: 'image_generation',
          p_reference_type: 'face_swap_retry',
          p_reference_id: characterId,
          p_description: `Face swap retry for ${character.name}`
        });

      if (deductError) {
        if (deductError.message?.includes('does not exist') || deductError.code === '42883') {
          log("POST - Coin system not set up, allowing free face swap");
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
          log("POST - Insufficient coins", { required: FACE_SWAP_RETRY_COST });
          return NextResponse.json(
            { 
              error: "Insufficient coins", 
              required: FACE_SWAP_RETRY_COST,
              message: `You need ${FACE_SWAP_RETRY_COST} coins to retry face swap.`
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
        
        if (!balanceData || balanceData.balance < FACE_SWAP_RETRY_COST) {
          log("POST - Insufficient coins (fallback)", { balance: balanceData?.balance });
          return NextResponse.json(
            { 
              error: "Insufficient coins", 
              required: FACE_SWAP_RETRY_COST,
              currentBalance: balanceData?.balance || 0,
              message: `You need ${FACE_SWAP_RETRY_COST} coins. You have ${balanceData?.balance || 0} coins.`
            },
            { status: 402 }
          );
        }
        
        const { data: updated } = await supabase
          .from('user_coin_balances')
          .update({ 
            balance: balanceData.balance - FACE_SWAP_RETRY_COST,
            lifetime_spent: (balanceData.lifetime_spent || 0) + FACE_SWAP_RETRY_COST
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
      log("POST - Coin system check failed, allowing face swap", { error: String(coinError) });
      coinDeductionSuccess = true;
    }

    if (!coinDeductionSuccess) {
      log("POST - Coin deduction failed");
      return NextResponse.json(
        { error: "Failed to process coin payment" },
        { status: 500 }
      );
    }

    // Fetch the target image if it's a URL (not base64)
    let targetImageBase64 = targetImageUrl;
    if (targetImageUrl.startsWith('http')) {
      log("POST - Fetching target image from URL");
      try {
        const imageResponse = await fetch(targetImageUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.status}`);
        }
        const imageBuffer = await imageResponse.arrayBuffer();
        const base64 = Buffer.from(imageBuffer).toString('base64');
        const contentType = imageResponse.headers.get('content-type') || 'image/webp';
        targetImageBase64 = `data:${contentType};base64,${base64}`;
        log("POST - Target image fetched", { contentType, base64Length: base64.length });
      } catch (fetchError) {
        log("POST - Failed to fetch target image", { error: String(fetchError) });
        return NextResponse.json(
          { error: "Failed to fetch the image for face swap" },
          { status: 500 }
        );
      }
    }

    // Call the face swap API
    log("POST - Calling face swap API");
    const cookieHeader = request.headers.get("cookie") || "";
    const faceSwapStartTime = Date.now();

    const faceSwapResponse = await fetch(
      `${request.nextUrl.origin}/api/face-swap`,
      {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Cookie": cookieHeader,
        },
        body: JSON.stringify({
          sourceImage: character.main_face_image,
          targetImage: targetImageBase64,
        }),
      }
    );

    log("POST - Face swap API responded", { 
      status: faceSwapResponse.status, 
      timeMs: Date.now() - faceSwapStartTime 
    });

    if (!faceSwapResponse.ok) {
      const errorData = await faceSwapResponse.json().catch(() => ({}));
      log("POST - Face swap API error", { status: faceSwapResponse.status, error: errorData });
      return NextResponse.json(
        { error: "Face swap failed", message: errorData.error || "Unable to apply face swap" },
        { status: 500 }
      );
    }

    const faceSwapResult = await faceSwapResponse.json();
    log("POST - Face swap result", { 
      success: faceSwapResult.success, 
      hasImageUrl: !!faceSwapResult.imageUrl,
    });

    if (!faceSwapResult.success || !faceSwapResult.imageUrl) {
      log("POST - Face swap response missing imageUrl");
      return NextResponse.json(
        { error: "Face swap failed", message: "No image returned from face swap" },
        { status: 500 }
      );
    }

    // Upload the face-swapped image to storage
    log("POST - Uploading to Supabase Storage");
    const finalImageUrl = faceSwapResult.imageUrl;
    
    const mimeMatch = finalImageUrl.match(/^data:(image\/[^;]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
    const extension = mimeType.split("/")[1] || "png";
    
    const fileName = `faceswap_${characterId}_${Date.now()}.${extension}`;
    const uploadBuffer = Buffer.from(finalImageUrl.split(",")[1], "base64");
    
    let storedImageUrl = finalImageUrl;
    
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
      log("POST - Uploaded to storage", { publicUrl });
    } else if (uploadError) {
      log("POST - Storage upload failed (using base64)", { error: uploadError.message });
    }

    const totalTime = Date.now() - startTime;
    log("POST - Request completed", { 
      totalTimeMs: totalTime,
      success: true,
    });

    return NextResponse.json({
      success: true,
      imageUrl: storedImageUrl,
      coinCost: FACE_SWAP_RETRY_COST,
      newBalance,
      message: "Face swap applied successfully!",
    });
  } catch (error) {
    log("POST - Unexpected error", { error: String(error) });
    return NextResponse.json(
      { error: "Failed to apply face swap" },
      { status: 500 }
    );
  }
}
