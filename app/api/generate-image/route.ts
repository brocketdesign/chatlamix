import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CharacterImage, PhysicalAttributes, GalleryStatus } from "@/lib/types";
import crypto from "crypto";

// Extend timeout for image generation (120 seconds to accommodate generation + face swap)
export const maxDuration = 120;

const SEGMIND_API_KEY = process.env.SEGMIND_API_KEY;
const SEGMIND_IMAGE_API = "https://api.segmind.com/v1/z-image-turbo";

// Coin cost for image generation (varies by quality/size)
const IMAGE_COIN_COSTS = {
  standard: 5,   // 512x512 or lower
  high: 10,      // 1024x1024
  premium: 15,   // Higher than 1024x1024
};

// HD resolution configurations for each aspect ratio
const ASPECT_RATIO_RESOLUTIONS = {
  square: { width: 1024, height: 1024 },
  landscape: { width: 1280, height: 720 },
  portrait: { width: 720, height: 1280 },
} as const;

type AspectRatioKey = keyof typeof ASPECT_RATIO_RESOLUTIONS;

function getImageCost(width: number, height: number): number {
  const pixels = width * height;
  if (pixels <= 512 * 512) return IMAGE_COIN_COSTS.standard;
  if (pixels <= 1024 * 1024) return IMAGE_COIN_COSTS.high;
  return IMAGE_COIN_COSTS.premium;
}

// Build a prompt based on character physical attributes
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

  // Build detailed character description for consistent generation
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

  // Combine character description with scene prompt
  return `Portrait photography, ${characterDescription}. ${scenePrompt}. High quality, detailed, professional photography, 8k, sharp focus, beautiful lighting.`;
}

export async function POST(request: NextRequest) {
  console.log("[generate-image] POST request started");
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    console.log("[generate-image] User ID:", user?.id);

    if (!user) {
      console.log("[generate-image] Authentication required - no user");
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (!SEGMIND_API_KEY) {
      return NextResponse.json(
        { error: "Image generation API not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    console.log("[generate-image] Request body:", JSON.stringify(body, null, 2));
    const {
      characterId,
      scenePrompt,
      aspectRatio,
      width: requestedWidth,
      height: requestedHeight,
      steps = 8,
      guidanceScale = 1,
      seed = -1,
      imageFormat = "webp",
      quality = 90,
      customBaseFace, // User-uploaded base face for this generation
    } = body;
    
    // Get dimensions from aspect ratio or fallback to requested values
    let width: number;
    let height: number;
    
    if (aspectRatio && aspectRatio in ASPECT_RATIO_RESOLUTIONS) {
      const resolution = ASPECT_RATIO_RESOLUTIONS[aspectRatio as AspectRatioKey];
      width = resolution.width;
      height = resolution.height;
      console.log("[generate-image] Using aspect ratio:", aspectRatio, "->", width, "x", height);
    } else if (requestedWidth && requestedHeight) {
      width = requestedWidth;
      height = requestedHeight;
      console.log("[generate-image] Using requested dimensions:", width, "x", height);
    } else {
      width = 1024;
      height = 1024;
      console.log("[generate-image] Using default dimensions:", width, "x", height);
    }
    
    console.log("[generate-image] Parsed params - characterId:", characterId, "aspectRatio:", aspectRatio, "width:", width, "height:", height, "steps:", steps, "seed:", seed);

    if (!characterId) {
      return NextResponse.json(
        { error: "Character ID is required" },
        { status: 400 }
      );
    }

    // Get character details from Supabase
    const { data: character, error: charError } = await supabase
      .from("characters")
      .select("*")
      .eq("id", characterId)
      .single();

    console.log("[generate-image] Character loaded:", {
      id: character?.id,
      name: character?.name,
      hasMainFaceImage: !!character?.main_face_image,
      mainFaceImageLength: character?.main_face_image?.length || 0,
      mainFaceImagePreview: character?.main_face_image?.substring(0, 50) || "none",
    });

    if (charError || !character) {
      return NextResponse.json(
        { error: "Character not found" },
        { status: 404 }
      );
    }

    // Check ownership
    if (character.user_id !== user.id) {
      return NextResponse.json(
        { error: "You don't have permission to generate images for this character" },
        { status: 403 }
      );
    }

    // Calculate coin cost based on image size
    const coinCost = getImageCost(width, height);

    // Check and deduct coins
    let coinDeductionSuccess = false;
    let coinTransactionId: string | null = null;
    
    try {
      // Try to deduct coins using the database function
      const { data: deductResult, error: deductError } = await supabase
        .rpc('deduct_coins', {
          p_user_id: user.id,
          p_amount: coinCost,
          p_transaction_type: 'image_generation',
          p_reference_type: 'character_image',
          p_reference_id: characterId,
          p_description: `Image generation for ${character.name} (${width}x${height})`
        });

      if (deductError) {
        console.log("[generate-image] Coin deduction error:", deductError);
        // Check if it's because tables don't exist yet
        if (deductError.message?.includes('does not exist') || deductError.code === '42883') {
          console.log("[generate-image] Coin system not set up yet, allowing free generation");
          coinDeductionSuccess = true; // Allow if monetization not set up
        } else {
          throw deductError;
        }
      } else if (deductResult && deductResult.length > 0) {
        const result = deductResult[0];
        if (result.success) {
          coinDeductionSuccess = true;
          coinTransactionId = result.transaction_id;
          console.log("[generate-image] Deducted", coinCost, "coins. New balance:", result.new_balance);
        } else {
          // Not enough coins
          return NextResponse.json(
            { 
              error: "Insufficient coins", 
              required: coinCost,
              message: `You need ${coinCost} coins to generate this image. Please purchase more coins.`
            },
            { status: 402 } // Payment Required
          );
        }
      } else {
        // No balance record exists - try to create one and check
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
              message: `You need ${coinCost} coins to generate this image. You have ${balanceData?.balance || 0} coins.`
            },
            { status: 402 }
          );
        }
      }
    } catch (coinError) {
      // If coin tables don't exist, allow generation (backwards compatibility)
      console.log("[generate-image] Coin system check failed, allowing generation:", coinError);
      coinDeductionSuccess = true;
    }

    if (!coinDeductionSuccess) {
      return NextResponse.json(
        { error: "Failed to process coin payment" },
        { status: 500 }
      );
    }

    const physicalAttributes = character.physical_attributes as PhysicalAttributes;

    // Build the full prompt with character attributes
    const fullPrompt = physicalAttributes
      ? buildCharacterPrompt(physicalAttributes, scenePrompt || "")
      : scenePrompt;

    // Generate image using Segmind API
    console.log("[generate-image] Calling Segmind image generation API...");
    const imageGenStartTime = Date.now();
    
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

    console.log(`[generate-image] Segmind API responded in ${Date.now() - imageGenStartTime}ms, status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[generate-image] Segmind API error:", errorText);
      return NextResponse.json(
        { error: "Image generation failed", details: errorText },
        { status: response.status }
      );
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

    const imageUrl = `data:image/${imageFormat};base64,${imageBase64}`;

    // Determine which face image to use for face swapping
    // Priority: 1. Custom base face (user uploaded for this generation) 2. Character's saved main face image
    const faceImageToUse = customBaseFace || character.main_face_image;
    const shouldFaceSwap = faceImageToUse && faceImageToUse.length > 0;
    let finalImageUrl = imageUrl;
    let faceSwapApplied = false;

    console.log("[generate-image] Face swap check:", {
      hasCustomBaseFace: !!customBaseFace,
      customBaseFaceLength: customBaseFace?.length || 0,
      hasMainFaceImage: !!character.main_face_image,
      mainFaceImageLength: character.main_face_image?.length || 0,
      shouldFaceSwap,
    });

    // If we have a face image to use, apply face swap for consistency
    if (shouldFaceSwap) {
      try {
        console.log("[generate-image] Applying face swap with", customBaseFace ? "custom uploaded face" : "character main face");
        
        // Forward cookies from the original request to maintain authentication
        const cookieHeader = request.headers.get("cookie") || "";
        
        console.log("[generate-image] Calling face swap API...");
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
              sourceImage: faceImageToUse,
              targetImage: imageUrl,
            }),
          }
        );
        
        console.log(`[generate-image] Face swap API responded in ${Date.now() - faceSwapStartTime}ms, status: ${faceSwapResponse.status}`);

        if (faceSwapResponse.ok) {
          const faceSwapResult = await faceSwapResponse.json();
          if (faceSwapResult.success && faceSwapResult.imageUrl) {
            finalImageUrl = faceSwapResult.imageUrl;
            faceSwapApplied = true;
            // Log hash comparison to verify face swap changed the image
            // Extract base64 content from data URLs for proper comparison
            const originalBase64 = imageUrl.includes(",") ? imageUrl.split(",")[1] : imageUrl;
            const swappedBase64 = finalImageUrl.includes(",") ? finalImageUrl.split(",")[1] : finalImageUrl;
            const originalHash = crypto.createHash("md5").update(originalBase64).digest("hex").substring(0, 16);
            const swappedHash = crypto.createHash("md5").update(swappedBase64).digest("hex").substring(0, 16);
            console.log("[generate-image] Face swap applied successfully");
            console.log(`[generate-image] Original image hash: ${originalHash}`);
            console.log(`[generate-image] Face-swapped image hash: ${swappedHash}`);
            console.log(`[generate-image] Images are different: ${originalHash !== swappedHash}`);
            // Log debug info from face-swap API if available
            if (faceSwapResult.debug) {
              console.log(`[generate-image] Face swap debug info:`, faceSwapResult.debug);
            }
          } else {
            console.error("[generate-image] Face swap response missing imageUrl:", faceSwapResult);
          }
        } else {
          const errorData = await faceSwapResponse.json().catch(() => ({}));
          console.error("[generate-image] Face swap API returned error:", faceSwapResponse.status, errorData);
        }
      } catch (faceSwapError) {
        console.error("[generate-image] Face swap failed, using original image:", faceSwapError);
      }
    } else {
      console.log("[generate-image] Skipping face swap - no face image available");
    }

    // Upload the final image to Supabase Storage
    console.log("[generate-image] Uploading to Supabase Storage...");
    
    // Determine image format from the data URL
    const mimeMatch = finalImageUrl.match(/^data:(image\/[^;]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : `image/${imageFormat}`;
    const extension = mimeType.split("/")[1] || imageFormat;
    
    const fileName = `char_${characterId}_${Date.now()}.${extension}`;
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
      console.log("[generate-image] Uploaded to storage:", publicUrl);
    } else if (uploadError) {
      console.error("[generate-image] Storage upload failed (using base64):", uploadError.message);
    }

    // Save the image to Supabase with 'unposted' status by default
    // Images are not automatically added to the gallery
    const { data: savedImage, error: saveError } = await supabase
      .from("character_images")
      .insert({
        character_id: characterId,
        image_url: storedImageUrl,
        prompt: fullPrompt,
        is_main_face: !character.main_face_image && !customBaseFace,
        gallery_status: 'unposted', // New images go to unposted section for review
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
      console.error("[generate-image] Error saving image:", saveError);
      return NextResponse.json(
        { error: "Failed to save image" },
        { status: 500 }
      );
    }

    // Update character's main face and/or thumbnail if needed
    // Note: main_face_image should remain as base64 for face-swap operations
    const updateData: { main_face_image?: string; thumbnail?: string } = {};
    
    // Only update main_face_image if:
    // 1. A custom base face was provided for this generation, OR
    // 2. The character doesn't have a main face yet
    if (customBaseFace) {
      // User explicitly provided a custom face for this generation - use it
      updateData.main_face_image = customBaseFace;
    } else if (!character.main_face_image) {
      // Character has no main face yet - use the generated image as fallback
      updateData.main_face_image = finalImageUrl;
    }
    // Note: If character already has a main_face_image and no customBaseFace was provided,
    // we preserve the existing base face (don't overwrite it with the generated image)
    
    // Update thumbnail if not set
    if (!character.thumbnail) {
      updateData.thumbnail = storedImageUrl;
    }
    
    // Only perform the update if there's something to update
    if (Object.keys(updateData).length > 0) {
      await supabase
        .from("characters")
        .update(updateData)
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

    return NextResponse.json({
      success: true,
      image: characterImage,
      faceSwapped: faceSwapApplied,
      faceSwapAttempted: shouldFaceSwap,
    });
  } catch (error) {
    console.error("[generate-image] Error generating image:", error);
    return NextResponse.json(
      { error: "Failed to generate image" },
      { status: 500 }
    );
  }
}

// GET - Get character images
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { searchParams } = new URL(request.url);
    const characterId = searchParams.get("characterId");

    if (!characterId) {
      return NextResponse.json(
        { error: "Character ID is required" },
        { status: 400 }
      );
    }

    // Get character to check access
    const { data: character, error: charError } = await supabase
      .from("characters")
      .select("user_id, is_public")
      .eq("id", characterId)
      .single();

    if (charError || !character) {
      return NextResponse.json(
        { error: "Character not found" },
        { status: 404 }
      );
    }

    // Check access
    if (!character.is_public && character.user_id !== user?.id) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Get images
    const { data: images, error: imagesError } = await supabase
      .from("character_images")
      .select("*")
      .eq("character_id", characterId)
      .order("created_at", { ascending: false });

    if (imagesError) {
      return NextResponse.json(
        { error: "Failed to fetch images" },
        { status: 500 }
      );
    }

    const result: CharacterImage[] = images.map(img => ({
      id: img.id,
      characterId: img.character_id,
      imageUrl: img.image_url,
      prompt: img.prompt || "",
      isMainFace: img.is_main_face,
      createdAt: new Date(img.created_at),
      settings: img.settings,
      galleryStatus: img.gallery_status || 'posted', // Default to 'posted' for backward compatibility
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching images:", error);
    return NextResponse.json(
      { error: "Failed to fetch images" },
      { status: 500 }
    );
  }
}

// PATCH - Update image gallery status
export async function PATCH(request: NextRequest) {
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
    const { imageId, galleryStatus } = body;

    if (!imageId) {
      return NextResponse.json(
        { error: "Image ID is required" },
        { status: 400 }
      );
    }

    // Validate gallery status
    const validStatuses: GalleryStatus[] = ['unposted', 'posted', 'archived'];
    if (!validStatuses.includes(galleryStatus)) {
      return NextResponse.json(
        { error: "Invalid gallery status. Must be 'unposted', 'posted', or 'archived'" },
        { status: 400 }
      );
    }

    // Get the image and verify ownership
    const { data: image, error: imageError } = await supabase
      .from("character_images")
      .select("*, characters!inner(user_id)")
      .eq("id", imageId)
      .single();

    if (imageError || !image) {
      return NextResponse.json(
        { error: "Image not found" },
        { status: 404 }
      );
    }

    // Check ownership
    if (image.characters.user_id !== user.id) {
      return NextResponse.json(
        { error: "You don't have permission to update this image" },
        { status: 403 }
      );
    }

    // Update the gallery status
    const { data: updatedImage, error: updateError } = await supabase
      .from("character_images")
      .update({ gallery_status: galleryStatus })
      .eq("id", imageId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating image status:", updateError);
      return NextResponse.json(
        { error: "Failed to update image status" },
        { status: 500 }
      );
    }

    const result: CharacterImage = {
      id: updatedImage.id,
      characterId: updatedImage.character_id,
      imageUrl: updatedImage.image_url,
      prompt: updatedImage.prompt || "",
      isMainFace: updatedImage.is_main_face,
      createdAt: new Date(updatedImage.created_at),
      settings: updatedImage.settings,
      galleryStatus: updatedImage.gallery_status,
    };

    return NextResponse.json({
      success: true,
      image: result,
    });
  } catch (error) {
    console.error("Error updating image:", error);
    return NextResponse.json(
      { error: "Failed to update image" },
      { status: 500 }
    );
  }
}

// DELETE - Delete an image
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
    const imageId = searchParams.get("imageId");

    if (!imageId) {
      return NextResponse.json(
        { error: "Image ID is required" },
        { status: 400 }
      );
    }

    // Get the image and verify ownership
    const { data: image, error: imageError } = await supabase
      .from("character_images")
      .select("*, characters!inner(user_id)")
      .eq("id", imageId)
      .single();

    if (imageError || !image) {
      return NextResponse.json(
        { error: "Image not found" },
        { status: 404 }
      );
    }

    // Check ownership
    if (image.characters.user_id !== user.id) {
      return NextResponse.json(
        { error: "You don't have permission to delete this image" },
        { status: 403 }
      );
    }

    // Delete the image
    const { error: deleteError } = await supabase
      .from("character_images")
      .delete()
      .eq("id", imageId);

    if (deleteError) {
      console.error("Error deleting image:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete image" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Image deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting image:", error);
    return NextResponse.json(
      { error: "Failed to delete image" },
      { status: 500 }
    );
  }
}
