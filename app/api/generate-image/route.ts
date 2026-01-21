import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CharacterImage, PhysicalAttributes } from "@/lib/types";

const SEGMIND_API_KEY = process.env.SEGMIND_API_KEY;
const SEGMIND_IMAGE_API = "https://api.segmind.com/v1/z-image-turbo";

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
      width = 1024,
      height = 1024,
      steps = 8,
      guidanceScale = 1,
      seed = -1,
      imageFormat = "webp",
      quality = 90,
    } = body;
    console.log("[generate-image] Parsed params - characterId:", characterId, "width:", width, "height:", height, "steps:", steps, "seed:", seed);

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

    const physicalAttributes = character.physical_attributes as PhysicalAttributes;

    // Build the full prompt with character attributes
    const fullPrompt = physicalAttributes
      ? buildCharacterPrompt(physicalAttributes, scenePrompt || "")
      : scenePrompt;

    // Generate image using Segmind API
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

    console.log("[generate-image] Segmind API response status:", response.status);

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

    // Check if character has a main face image for face swapping
    const shouldFaceSwap = character.main_face_image && character.main_face_image.length > 0;
    let finalImageUrl = imageUrl;

    // If character has a main face image, apply face swap for consistency
    if (shouldFaceSwap) {
      try {
        const faceSwapResponse = await fetch(
          `${request.nextUrl.origin}/api/face-swap`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceImage: character.main_face_image,
              targetImage: imageUrl,
            }),
          }
        );

        if (faceSwapResponse.ok) {
          const faceSwapResult = await faceSwapResponse.json();
          finalImageUrl = faceSwapResult.imageUrl;
        }
      } catch (faceSwapError) {
        console.error("Face swap failed, using original image:", faceSwapError);
      }
    }

    // Save the image to Supabase
    const { data: savedImage, error: saveError } = await supabase
      .from("character_images")
      .insert({
        character_id: characterId,
        image_url: finalImageUrl,
        prompt: fullPrompt,
        is_main_face: !character.main_face_image,
        settings: {
          prompt: fullPrompt,
          steps,
          guidanceScale,
          seed: responseSeed || seed,
          height,
          width,
          imageFormat,
          quality,
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

    // If this is the first image, set it as thumbnail and main face
    if (!character.main_face_image || !character.thumbnail) {
      await supabase
        .from("characters")
        .update({
          main_face_image: finalImageUrl,
          thumbnail: finalImageUrl,
        })
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
    };

    return NextResponse.json({
      success: true,
      image: characterImage,
      faceSwapped: shouldFaceSwap,
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
